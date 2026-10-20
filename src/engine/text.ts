/** Типографика: стили, перенос строк, анимированное появление текста. */

import { clamp01, easeOutCubic, easeOutQuart } from './anim.ts';
import { C, FONT } from './theme.ts';

type Ctx = CanvasRenderingContext2D;

export interface TextStyle {
  size: number;
  weight?: number;
  family?: 'sans' | 'mono';
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  /** Межбуквенное расстояние, px. */
  tracking?: number;
  /** Межстрочный интервал как множитель размера. */
  lineHeight?: number;
  /** Ширина блока для переноса строк. */
  maxWidth?: number;
  upper?: boolean;
  /**
   * Начертание капители. По умолчанию `small` — фирменный вид презентации
   * (строчные буквы рисуются уменьшёнными прописными).
   */
  caps?: 'small' | 'normal';
  glowColor?: string;
  glowBlur?: number;
}

/**
 * Минимальный кегль в координатах сцены. Мельче в презентации не бывает:
 * кадр смотрят с дивана, поэтому любая подпись читается издалека.
 * Все размеры прогоняются через `sizeOf`, так что поднять планку можно здесь.
 */
export const MIN_TEXT = 46;

export const sizeOf = (st: Pick<TextStyle, 'size'>) => Math.max(MIN_TEXT, st.size);

export function applyStyle(ctx: Ctx, st: TextStyle): void {
  const fam = st.family ?? 'sans';
  // Моноширинный оставляем обычным: капитель ломает выравнивание цифр.
  const caps = st.caps ?? (fam === 'mono' ? 'normal' : 'small');
  const variant = caps === 'small' ? 'small-caps ' : '';
  ctx.font = `${variant}${st.weight ?? 700} ${sizeOf(st)}px ${FONT[fam]}`;
  // Дублируем отдельным свойством: не во всех сборщиках типов оно объявлено.
  (ctx as unknown as { fontVariantCaps: string }).fontVariantCaps =
    caps === 'small' ? 'small-caps' : 'normal';
  ctx.fillStyle = st.color ?? C.text;
  ctx.textAlign = st.align ?? 'left';
  ctx.textBaseline = st.baseline ?? 'alphabetic';
  ctx.letterSpacing = `${st.tracking ?? 0}px`;
  if (st.glowColor) {
    ctx.shadowColor = st.glowColor;
    ctx.shadowBlur = st.glowBlur ?? 24;
  } else {
    ctx.shadowBlur = 0;
  }
}

const prep = (t: string, st: TextStyle) => (st.upper ? t.toUpperCase() : t);

export function measure(ctx: Ctx, text: string, st: TextStyle): number {
  ctx.save();
  applyStyle(ctx, st);
  const w = ctx.measureText(prep(text, st)).width;
  ctx.restore();
  return w;
}

/** Разбивает текст на строки по ширине. Уважает явные переводы строк. */
export function wrap(ctx: Ctx, text: string, st: TextStyle): string[] {
  const max = st.maxWidth;
  const paras = text.split('\n');
  if (!max) return paras;
  ctx.save();
  applyStyle(ctx, st);
  const out: string[] = [];
  for (const para of paras) {
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(prep(next, st)).width > max && line) {
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    out.push(line);
  }
  ctx.restore();
  return out;
}

export const lineStep = (st: TextStyle) => sizeOf(st) * (st.lineHeight ?? 1.22);

/** Высота блока текста при заданном стиле. */
export function blockHeight(ctx: Ctx, text: string, st: TextStyle): number {
  return wrap(ctx, text, st).length * lineStep(st);
}

/**
 * Вывод текста. Если задан `maxWidth`, строка переносится по словам.
 * Возвращает ширину самой длинной строки.
 */
export function text(ctx: Ctx, str: string, x: number, y: number, st: TextStyle): number {
  ctx.save();
  applyStyle(ctx, st);
  const lines = st.maxWidth || str.includes('\n') ? wrap(ctx, str, st) : [str];
  const step = lineStep(st);
  let w = 0;
  lines.forEach((ln, i) => {
    const s = prep(ln, st);
    ctx.fillText(s, x, y + i * step);
    w = Math.max(w, ctx.measureText(s).width);
  });
  ctx.restore();
  return w;
}

/** Многострочный блок. `y` — базовая линия первой строки. Возвращает высоту. */
export function paragraph(ctx: Ctx, str: string, x: number, y: number, st: TextStyle): number {
  const lines = wrap(ctx, str, st);
  const step = lineStep(st);
  ctx.save();
  applyStyle(ctx, st);
  lines.forEach((ln, i) => ctx.fillText(prep(ln, st), x, y + i * step));
  ctx.restore();
  return lines.length * step;
}

interface WordBox {
  w: string;
  x: number;
  line: number;
  width: number;
}

function layout(ctx: Ctx, str: string, x: number, st: TextStyle): WordBox[] {
  const lines = wrap(ctx, str, st);
  const boxes: WordBox[] = [];
  ctx.save();
  applyStyle(ctx, st);
  const space = ctx.measureText(' ').width;
  lines.forEach((ln, li) => {
    const words = ln.split(' ').filter(Boolean);
    const widths = words.map((w) => ctx.measureText(prep(w, st)).width);
    const total = widths.reduce((s, w) => s + w, 0) + space * Math.max(0, words.length - 1);
    let cx = x;
    if ((st.align ?? 'left') === 'center') cx = x - total / 2;
    else if (st.align === 'right') cx = x - total;
    words.forEach((w, i) => {
      boxes.push({ w, x: cx, line: li, width: widths[i] });
      cx += widths[i] + space;
    });
  });
  ctx.restore();
  return boxes;
}

export interface RevealOpts {
  /** Доля прогресса, на которую слова расходятся во времени (0..0.9). */
  stagger?: number;
  /** Вертикальный сдвиг слова на старте, px. */
  rise?: number;
  /** Смещение по X на старте, px. */
  slide?: number;
  /** Масштаб на старте. */
  from?: number;
  /**
   * Слова выезжают снизу «из-под маски» своей строки, без прозрачности —
   * плотная подача заголовков. `rise` тогда не нужен.
   */
  mask?: boolean;
}

/**
 * Пословное появление: снизу вверх с прозрачностью.
 * `p` — общий прогресс 0..1, слова стартуют по очереди.
 */
export function reveal(
  ctx: Ctx,
  str: string,
  x: number,
  y: number,
  st: TextStyle,
  p: number,
  o: RevealOpts = {},
): number {
  const pr = clamp01(p);
  if (pr <= 0) return 0;
  const stagger = o.stagger ?? 0.35;
  const rise = o.rise ?? 22;
  const slide = o.slide ?? 0;
  const boxes = layout(ctx, str, x, st);
  const n = boxes.length || 1;
  const span = 1 + stagger * (n - 1);
  const step = lineStep(st);
  const size = sizeOf(st);

  ctx.save();
  applyStyle(ctx, st);
  ctx.textAlign = 'left';
  boxes.forEach((b, i) => {
    const wp = clamp01(pr * span - i * stagger);
    if (wp <= 0) return;
    const e = easeOutQuart(wp);
    const by = y + b.line * step;
    ctx.save();
    if (o.mask) {
      ctx.beginPath();
      ctx.rect(b.x - size * 0.1, by - size * 1.02, b.width + size * 0.2, size * 1.28);
      ctx.clip();
      ctx.translate(b.x + slide * (1 - e), by + size * 1.15 * (1 - e));
    } else {
      ctx.globalAlpha *= e;
      ctx.translate(b.x + slide * (1 - e), by + rise * (1 - e));
    }
    if (o.from && o.from !== 1) {
      const s = o.from + (1 - o.from) * e;
      ctx.scale(s, s);
    }
    ctx.fillText(prep(b.w, st), 0, 0);
    ctx.restore();
  });
  ctx.restore();
  return wrap(ctx, str, st).length * step;
}

/** Печатная машинка с курсором. `p` — доля напечатанного. */
export function typewriter(
  ctx: Ctx,
  str: string,
  x: number,
  y: number,
  st: TextStyle,
  p: number,
  gt = 0,
  caretColor?: string,
): void {
  const pr = clamp01(p);
  const n = Math.round(str.length * pr);
  const shown = str.slice(0, n);
  const w = text(ctx, shown, x, y, st);
  if (pr < 1 || Math.sin(gt * 7) > 0) {
    ctx.save();
    ctx.fillStyle = caretColor ?? st.color ?? C.text;
    ctx.globalAlpha *= pr < 1 ? 1 : 0.7;
    const s = sizeOf(st);
    const ax = (st.align ?? 'left') === 'center' ? x + w / 2 : st.align === 'right' ? x : x + w;
    ctx.fillRect(ax + 4, y - s * 0.78, Math.max(2, s * 0.06), s * 0.86);
    ctx.restore();
  }
}

/** Заголовок-«кикер»: мелкий разряженный капс с линией слева. */
export function kicker(
  ctx: Ctx,
  str: string,
  x: number,
  y: number,
  p = 1,
  color: string = C.accent,
  size = 22,
): void {
  const pr = clamp01(p);
  if (pr <= 0) return;
  const e = easeOutCubic(pr);
  ctx.save();
  ctx.globalAlpha *= e;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y - size * 0.35);
  ctx.lineTo(x + 34 * e, y - size * 0.35);
  ctx.stroke();
  text(ctx, str, x + 48, y, {
    size,
    weight: 700,
    color,
    tracking: 3.4,
    upper: true,
  });
  ctx.restore();
}
