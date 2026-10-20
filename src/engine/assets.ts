/**
 * Картинки сцен (png/jpg/webp рядом с кодом ролика).
 *
 * Объявлять на уровне модуля сцены — тогда загрузка стартует при импорте ролика:
 *
 *   const ART = picture(new URL('./key_art.webp', import.meta.url).href);
 *   ...
 *   const im = ART.get();            // null, пока не загрузилась (и всегда в Node)
 *   if (im) cover(ctx, im, x, y, w, h);
 *
 * Экспорт перед первым кадром ждёт `assetsReady()`, поэтому в MP4 картинки есть
 * с первого кадра. Плеер перерисовывает кадр, когда картинка догрузилась.
 */

type Ctx = CanvasRenderingContext2D;

export interface Picture {
  readonly url: string;
  /** Готовая картинка или null (ещё грузится, не нашлась, или мы в Node). */
  get(): HTMLImageElement | null;
}

const IMGS = new Map<string, HTMLImageElement>();
const PENDING = new Set<Promise<void>>();
const listeners = new Set<() => void>();

export function picture(url: string): Picture {
  if (typeof Image !== 'undefined' && !IMGS.has(url)) {
    const im = new Image();
    const done = new Promise<void>((resolve) => {
      im.onload = () => resolve();
      im.onerror = () => {
        console.warn(`Картинка не загрузилась: ${url}`);
        resolve();
      };
    });
    PENDING.add(done);
    void done.then(() => {
      PENDING.delete(done);
      listeners.forEach((fn) => fn());
    });
    im.src = url;
    IMGS.set(url, im);
  }
  return {
    url,
    get: () => {
      const im = IMGS.get(url);
      return im && im.complete && im.naturalWidth > 0 ? im : null;
    },
  };
}

/** Все объявленные картинки догрузились (или упали с ошибкой). */
export async function assetsReady(): Promise<void> {
  while (PENDING.size) await Promise.all([...PENDING]);
}

/** Подписка «догрузилась картинка» — плеер перерисовывает кадр. */
export function onAsset(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export interface CoverOpts {
  /** Какая точка картинки (доли 0..1) встаёт в центр области — фокус кадрирования. */
  u?: number;
  v?: number;
  /** Дополнительное увеличение поверх «cover» (1 — ровно впритык). */
  zoom?: number;
}

/** Картинка, заполняющая прямоугольник с обрезкой (как CSS object-fit: cover). */
export function cover(ctx: Ctx, im: CanvasImageSource & { width: number; height: number }, x: number, y: number, w: number, h: number, o: CoverOpts = {}): void {
  const k = Math.max(w / im.width, h / im.height) * (o.zoom ?? 1);
  const sw = w / k;
  const sh = h / k;
  const sx = Math.max(0, Math.min(im.width - sw, im.width * (o.u ?? 0.5) - sw / 2));
  const sy = Math.max(0, Math.min(im.height - sh, im.height * (o.v ?? 0.5) - sh / 2));
  ctx.drawImage(im, sx, sy, sw, sh, x, y, w, h);
}

/**
 * Картинка, вписанная по высоте `h` (ширина — по пропорции) с опорной точкой
 * внизу по центру — так ставят персонажей «на пол». Возвращает ширину.
 */
export function standing(ctx: Ctx, im: CanvasImageSource & { width: number; height: number }, cx: number, bottom: number, h: number): number {
  const w = (im.width * h) / im.height;
  ctx.drawImage(im, cx - w / 2, bottom - h, w, h);
  return w;
}

/**
 * Кадр из атласа (видео, разложенное сеткой кадров `cols` × строки, кадр fw×fh):
 * детерминированное «видео» — номер кадра считается из времени.
 */
export function atlasFrame(
  ctx: Ctx,
  im: CanvasImageSource,
  frame: number,
  cols: number,
  fw: number,
  fh: number,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const i = Math.max(0, Math.floor(frame));
  ctx.drawImage(im, (i % cols) * fw, Math.floor(i / cols) * fh, fw, fh, x, y, w, h);
}
