/**
 * Общие блоки сцен 18–20 (видеореференс → анимация по кадрам → итог):
 * камера на огра, «сгенерированный ролик» с огром, идущим по кругу,
 * кадр-миниатюра, лента кадров, поле промпта без слов, спидометр, таймлайн с ключами.
 */

import { clamp01, easeOutBack, hash21, lerp } from '../../engine/anim.ts';
import { panel, rrPath } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { a, C } from '../../engine/theme.ts';
import {
  drawModel,
  groundShadow,
  imageFrame,
  SCREEN_BG,
  type OgreModel,
  type OgrePose,
  type Rect,
  type Root,
  type View,
  IDLE,
  mage,
  mageWalkCycle,
} from './common.ts';

type Ctx = CanvasRenderingContext2D;

/** Камера на огра: земля (y = 0) под началом координат попадает в (cx, groundY). */
export function ogreView(cx: number, groundY: number, size: number, yaw = 0, pitch = 0.12, dist = 9): View {
  return { cx, cy: groundY, size, yaw, pitch, dist };
}

export interface OgreDraw {
  /** Цвет треугольников реальной модели (показать сетку). */
  wire?: string;
  /** Перекрасить в один цвет (hex). */
  tint?: string;
  alpha?: number;
  /** Сила тени под ногами; 0 — без тени. */
  shadow?: number;
  /** Упрощение (LOD): > 0 — упрощённая версия. */
  decim?: number;
  /** Уровень детализации мага напрямую. */
  lod?: 0 | 1 | 2;
}

/** Огр игры с тенью. Возвращает модель (суставы — для костей). */
export function drawOgre(ctx: Ctx, view: View, pose: OgrePose, root: Root = {}, o: OgreDraw = {}): OgreModel {
  // персонаж — маг из assets (риг и скиннинг)
  const m = mage(pose, { lod: o.lod ?? (o.decim ? (o.decim > 0.1 ? 2 : 1) : 0) });
  const parts = m.parts;
  const s = root.scale ?? 1;
  ctx.save();
  ctx.globalAlpha *= clamp01(o.alpha ?? 1);
  if ((o.shadow ?? 0.38) > 0) {
    groundShadow(ctx, view, root.pos?.[0] ?? 0, root.pos?.[2] ?? 0, 0.95 * s, 0.7 * s, o.shadow ?? 0.38);
  }
  drawModel(ctx, parts, view, root, { wire: o.wire, tint: o.tint, edge: a(C.bg, 0.3) });
  ctx.restore();
  return m;
}

/** Цикл «сгенерированного ролика»: три цикла шага, сек. */
export const loopLen = (): number => 3 * mageWalkCycle();

// ---------------------------------------------------------------- настоящее видео из Seedance (assets/seedance.mp4)

/** Видео Seedance: 97 кадров 1280×720 при 24 к/с; в атласе — по 640×360, 10 в ряд. */
export const SEEDANCE = { frames: 97, fps: 24, cols: 10, fw: 640, fh: 360, w: 1280, h: 720 };
/** Длительность видео Seedance, сек. */
export const seedanceDur = SEEDANCE.frames / SEEDANCE.fps;
/** Номер кадра видео в момент vt (видео зациклено). */
export const seedanceFrameAt = (vt: number): number =>
  ((Math.floor(vt * SEEDANCE.fps) % SEEDANCE.frames) + SEEDANCE.frames) % SEEDANCE.frames;

const IMGS = new Map<string, HTMLImageElement>();
/** Картинка из папки ролика; null, пока не загрузилась (и в Node). */
export function picture(file: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  let im = IMGS.get(file);
  if (!im) {
    im = new Image();
    im.src = new URL(`./${file}`, import.meta.url).href;
    IMGS.set(file, im);
  }
  return im.complete && im.naturalWidth > 0 ? im : null;
}
picture('seedance_atlas.jpg');
picture('seedance_first.jpg');

/** Часть кадра: весь, левая панель (профиль) или правая (анфас). */
export type SeedancePart = 'all' | 'side' | 'front';
// панели в кадре: профиль x 0…640, анфас x 703…1280 (между ними чёрная полоса)
const PART: Record<SeedancePart, [number, number]> = { all: [0, 1], side: [0, 640 / 1280], front: [703 / 1280, 1] };

/** Кадр видео Seedance в прямоугольнике (заполняет его, лишнее обрезается). first — первый кадр в полном размере. */
export function seedanceImage(ctx: Ctx, r: Rect, frame: number | 'first', part: SeedancePart = 'all'): void {
  const [u0, u1] = PART[part];
  let im: HTMLImageElement | null;
  let sx: number, sy: number, fw: number, fh: number;
  if (frame === 'first') {
    im = picture('seedance_first.jpg');
    sx = 0; sy = 0; fw = SEEDANCE.w; fh = SEEDANCE.h;
  } else {
    im = picture('seedance_atlas.jpg');
    const i = ((Math.floor(frame) % SEEDANCE.frames) + SEEDANCE.frames) % SEEDANCE.frames;
    sx = (i % SEEDANCE.cols) * SEEDANCE.fw; sy = Math.floor(i / SEEDANCE.cols) * SEEDANCE.fh;
    fw = SEEDANCE.fw; fh = SEEDANCE.fh;
  }
  if (!im) return;
  const cx = sx + fw * u0;
  const cw = fw * (u1 - u0);
  const k = Math.max(r.w / cw, r.h / fh);
  const sw = r.w / k, sh = r.h / k;
  ctx.drawImage(im, cx + (cw - sw) / 2, sy + (fh - sh) / 2, sw, sh, r.x, r.y, r.w, r.h);
}

/** Кадр видео Seedance (номер кадра) в рамке — для лент кадров и сравнения. */
export function seedanceThumb(ctx: Ctx, r: Rect, frame: number, part: SeedancePart, o: { color?: string; tilt?: number } = {}): void {
  imageFrame(ctx, r, () => seedanceImage(ctx, r, frame, part), { color: o.color ?? C.accent, tilt: o.tilt });
}

/** Скриншот из Blender (первый кадр видео): весь кадр или один ракурс, в рамке. */
export function seedanceShot(ctx: Ctx, r: Rect, part: SeedancePart, o: { color?: string; tilt?: number } = {}): void {
  imageFrame(ctx, r, () => seedanceImage(ctx, r, 'first', part), { color: o.color ?? C.h1, tilt: o.tilt });
}

export interface TwoViewOpts {
  shadow?: number;
}

/**
 * Персонаж в двух ракурсах на одном кадре: слева — сбоку (профиль, смотрит вправо), справа — спереди.
 * Так готовится картинка для видеогенератора и так же выглядит цикличный ролик из него.
 */
export function twoViews(ctx: Ctx, r: Rect, pose: OgrePose, o: TwoViewOpts = {}): void {
  // камера неподвижна: строго спереди и строго сбоку, персонаж на месте
  const size = Math.min((r.h * 0.74) / 2.2, (r.w * 0.36) / 0.9);
  [
    { u: 0.3, ry: Math.PI / 2 },
    { u: 0.7, ry: 0 },
  ].forEach((v) => {
    const view: View = { cx: r.x + r.w * v.u, cy: r.y + r.h * 0.88, size, pitch: 0.1, yaw: 0, dist: 9 };
    drawOgre(ctx, view, pose, { ry: v.ry }, { shadow: o.shadow ?? 0.42 });
  });
}

/** Скриншот для генератора: персонаж спереди и сбоку на одной картинке. */
export function twoViewImage(ctx: Ctx, r: Rect, o: { color?: string; tilt?: number } = {}): void {
  imageFrame(ctx, r, () => twoViews(ctx, r, IDLE), { color: o.color ?? C.h1, tilt: o.tilt });
}

/** Иконка цикла: две дуги со стрелками, медленно вращается. */
export function loopIcon(ctx: Ctx, x: number, y: number, s: number, color: string, t = 0): void {
  const r = s * 0.38;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 1.3);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2.4, s * 0.09);
  ctx.lineCap = 'round';
  for (const k of [0, Math.PI]) {
    const e = k + Math.PI - 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, r, k + 0.3, e);
    ctx.stroke();
    const ex = Math.cos(e) * r;
    const ey = Math.sin(e) * r;
    const tx = -Math.sin(e);
    const ty = Math.cos(e);
    const h = s * 0.17;
    ctx.beginPath();
    ctx.moveTo(ex + tx * h, ey + ty * h);
    ctx.lineTo(ex + Math.cos(e) * h * 0.75, ey + Math.sin(e) * h * 0.75);
    ctx.lineTo(ex - Math.cos(e) * h * 0.75, ey - Math.sin(e) * h * 0.75);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export interface ClipOpts {
  color?: string;
  /** Полоса проигрывания внизу 0..1 (видимость). */
  bar?: number;
  /** Иконка цикла 0..1 (видимость). */
  loop?: number;
  /** Генерация 0..1: шум проявляется в картинку. */
  gen?: number;
  tilt?: number;
  /** Подсветка рамки 0..1. */
  glow?: number;
}

/** «Ролик» из видеогенератора: персонаж в двух ракурсах идёт на месте, полоса проигрывания и значок цикла. */
export function videoClip(ctx: Ctx, r: Rect, vt: number, o: ClipOpts = {}): void {
  const color = o.color ?? C.accent;
  const gen = clamp01(o.gen ?? 1);
  imageFrame(
    ctx,
    r,
    () => {
      if (gen > 0) {
        ctx.save();
        ctx.globalAlpha *= gen;
        // настоящее видео из Seedance: персонаж в двух ракурсах идёт на месте
        seedanceImage(ctx, r, seedanceFrameAt(vt));
        ctx.restore();
      }
      if (gen < 1) {
        // шум «диффузии»: крупные клетки, которые гаснут по мере генерации
        const cell = Math.max(18, r.w / 22);
        const step = Math.floor(vt * 10);
        for (let j = 0; j * cell < r.h; j++) {
          for (let i = 0; i * cell < r.w; i++) {
            const n = hash21(i * 7.1 + step * 0.37, j * 3.3 + step);
            const k = (1 - gen) * (0.35 + 0.65 * n);
            if (k < 0.08) continue;
            ctx.fillStyle = a(n > 0.6 ? C.text : n > 0.3 ? C.accent : C.panel, 0.55 * k);
            ctx.fillRect(r.x + i * cell, r.y + j * cell, cell + 0.5, cell + 0.5);
          }
        }
      }
    },
    { color, tilt: o.tilt },
  );

  if ((o.glow ?? 0) > 0) {
    ctx.save();
    ctx.shadowColor = a(color, 0.7 * (o.glow ?? 0));
    ctx.shadowBlur = 40;
    ctx.strokeStyle = a(color, 0.8 * (o.glow ?? 0));
    ctx.lineWidth = 3;
    rrPath(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.stroke();
    ctx.restore();
  }

  const bar = clamp01(o.bar ?? 1);
  if (bar > 0) {
    const k = ((vt / seedanceDur) % 1 + 1) % 1;
    const pad = Math.max(18, r.w * 0.04);
    const by = r.y + r.h - Math.max(18, r.h * 0.06);
    const bw = r.w - pad * 2;
    const th = Math.max(5, r.h * 0.014);
    ctx.save();
    ctx.globalAlpha *= bar;
    ctx.fillStyle = a(C.bg, 0.7);
    rrPath(ctx, r.x + pad, by - th / 2, bw, th, th / 2);
    ctx.fill();
    ctx.fillStyle = color;
    rrPath(ctx, r.x + pad, by - th / 2, Math.max(th, bw * k), th, th / 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r.x + pad + bw * k, by, th * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const lp = clamp01(o.loop ?? 0);
  if (lp > 0) {
    const s = Math.max(48, r.h * 0.13);
    const cx = r.x + r.w - s * 0.9;
    const cy = r.y + s * 0.9;
    ctx.save();
    ctx.globalAlpha *= lp;
    ctx.translate(cx, cy);
    const sc = easeOutBack(lp);
    ctx.scale(sc, sc);
    ctx.fillStyle = a(C.bg, 0.75);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.62, 0, Math.PI * 2);
    ctx.fill();
    loopIcon(ctx, 0, 0, s, color, vt);
    ctx.restore();
  }
}

export interface ThumbOpts {
  color?: string;
  tint?: string;
  wire?: string;
  tilt?: number;
  /** Поворот огра вокруг вертикали. */
  ry?: number;
  /** Камера: поворот. */
  yaw?: number;
  /** Доля высоты кадра, которую занимает огр. */
  fill?: number;
}

/** Кадр-миниатюра с огром в позе: скриншот, кадр ролика, тестовый рендер. */
export function ogreThumb(ctx: Ctx, r: Rect, pose: OgrePose, o: ThumbOpts = {}): OgreModel {
  let model: OgreModel | null = null;
  imageFrame(
    ctx,
    r,
    () => {
      const size = Math.min((r.h * (o.fill ?? 0.74)) / 2.2, (r.w * 0.8) / 2.1);
      const view = ogreView(r.x + r.w / 2, r.y + r.h * 0.88, size, o.yaw ?? 0, 0.12, 9);
      model = drawOgre(ctx, view, pose, { ry: o.ry ?? 0 }, { tint: o.tint, wire: o.wire, shadow: 0.4 });
    },
    { color: o.color ?? C.accent, tilt: o.tilt },
  );
  return model ?? mage(pose, { jointsOnly: true });
}

export interface StripOpts {
  /** Ширина клетки. */
  cell: number;
  gap?: number;
  /** Сдвиг ленты, px (прокрутка). */
  scroll?: number;
  color?: string;
}

/**
 * Кинолента: тёмная полоса с перфорацией, в окнах — кадры (`draw(i, rect)`).
 * Кадры с отрицательным индексом тоже рисуются — при прокрутке лента бесконечна.
 */
export function filmStrip(ctx: Ctx, r: Rect, o: StripOpts, draw: (i: number, cell: Rect) => void): void {
  const color = o.color ?? C.accent;
  const gap = o.gap ?? 16;
  const hole = Math.max(14, r.h * 0.07);
  const band = hole * 2.2;
  ctx.save();
  panel(ctx, r.x, r.y, r.w, r.h, { fill: SCREEN_BG, stroke: a(color, 0.35), lineWidth: 1.6, radius: 10 });
  rrPath(ctx, r.x, r.y, r.w, r.h, 10);
  ctx.clip();
  const scroll = o.scroll ?? 0;
  // перфорация
  const hs = hole * 2.1;
  const off = ((scroll % hs) + hs) % hs;
  ctx.fillStyle = a(C.text, 0.22);
  for (let x = r.x - off; x < r.x + r.w + hs; x += hs) {
    rrPath(ctx, x + hole * 0.4, r.y + (band - hole) / 2, hole * 1.2, hole, 3);
    ctx.fill();
    rrPath(ctx, x + hole * 0.4, r.y + r.h - band + (band - hole) / 2, hole * 1.2, hole, 3);
    ctx.fill();
  }
  const step = o.cell + gap;
  const first = Math.floor((scroll - gap) / step) - 1;
  for (let i = first; i < first + Math.ceil(r.w / step) + 3; i++) {
    const cx = r.x + gap + i * step - scroll;
    if (cx > r.x + r.w || cx + o.cell < r.x) continue;
    draw(i, { x: cx, y: r.y + band, w: o.cell, h: r.h - band * 2 });
  }
  ctx.restore();
}

export interface PromptPanelOpts {
  /** Доля «напечатанных» строк 0..1. */
  typed: number;
  color?: string;
  icon?: string;
  /** Размытость строк 0..1 («расплывчатый запрос»). */
  fuzzy?: number;
  /** Ширины строк (доли). */
  rows?: number[];
  /** Время для мигания курсора. */
  t?: number;
}

/**
 * Поле промпта без слов: иконка чата и строки-полоски, которые «печатаются».
 * `x, y` — левый верхний угол.
 */
export function promptPanel(ctx: Ctx, x: number, y: number, w: number, h: number, o: PromptPanelOpts): void {
  const color = o.color ?? C.h1;
  panel(ctx, x, y, w, h, {
    fill: a(C.bg, 0.92),
    stroke: a(color, 0.5),
    lineWidth: 2,
    radius: 14,
    accentBar: { color, width: 5 },
    glow: a(color, 0.12),
    glowBlur: 40,
  });
  icon(ctx, o.icon ?? 'chat', x + 64, y + 64, 58, color);
  const rows = o.rows ?? [0.92, 0.72, 0.84];
  const total = rows.reduce((s, v) => s + v, 0);
  let left = clamp01(o.typed) * total;
  const bx = x + 124;
  const full = w - 124 - 44;
  const fz = clamp01(o.fuzzy ?? 0);
  let cx = bx;
  let cy = y + 38;
  for (let i = 0; i < rows.length; i++) {
    const rw = rows[i];
    const k = clamp01(left / rw);
    left -= rw;
    if (k <= 0) break;
    const bw = full * rw * k;
    const by = y + 46 + i * 50;
    ctx.save();
    if (fz > 0) {
      ctx.filter = `blur(${(fz * 7).toFixed(1)}px)`;
      ctx.globalAlpha *= 1 - fz * 0.35;
    }
    ctx.fillStyle = a(fz > 0 ? C.text : color, 0.7);
    rrPath(ctx, bx, by, bw, 22, 11);
    ctx.fill();
    ctx.restore();
    cx = bx + bw + 8;
    cy = by - 8;
  }
  if (fz <= 0 && (o.typed < 1 || Math.sin((o.t ?? 0) * 7) > 0)) {
    ctx.fillStyle = color;
    ctx.fillRect(cx, cy, 4, 38);
  }
}

export interface GaugeOpts {
  /** Положение стрелки 0..1. */
  value: number;
  /** Появление 0..1. */
  p?: number;
  icon?: string;
  t?: number;
}

/** Спидометр: полукруг шкалы с зонами, зелёная зона справа, стрелка. */
export function gauge(ctx: Ctx, cx: number, cy: number, r: number, o: GaugeOpts): void {
  const p = clamp01(o.p ?? 1);
  if (p <= 0) return;
  const lw = r * 0.16;
  const A0 = Math.PI;
  const zones: Array<[number, number, string]> = [
    [0, 0.42, a(C.text, 0.22)],
    [0.42, 0.66, a(C.accent, 0.7)],
    [0.66, 1, C.pos],
  ];
  ctx.save();
  ctx.globalAlpha *= Math.min(1, p * 2);
  ctx.lineCap = 'butt';
  for (const [z0, z1, col] of zones) {
    const e = Math.min(z1, p);
    if (e <= z0) continue;
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(cx, cy, r, A0 + z0 * Math.PI + 0.012, A0 + e * Math.PI - 0.012);
    ctx.stroke();
  }
  // риски
  ctx.strokeStyle = a(C.text, 0.45);
  ctx.lineWidth = 2.4;
  for (let i = 0; i <= 10; i++) {
    const an = A0 + (i / 10) * Math.PI;
    const r1 = r - lw * 0.5 - 8;
    const r2 = r1 - (i % 5 === 0 ? 22 : 12);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(an) * r1, cy + Math.sin(an) * r1);
    ctx.lineTo(cx + Math.cos(an) * r2, cy + Math.sin(an) * r2);
    ctx.stroke();
  }
  // стрелка
  const v = clamp01(o.value);
  const an = A0 + v * Math.PI;
  const hot = v > 0.66 ? C.pos : C.accent;
  ctx.save();
  ctx.shadowColor = a(hot, 0.7);
  ctx.shadowBlur = 18;
  ctx.strokeStyle = hot;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(an) * r * 0.12, cy - Math.sin(an) * r * 0.12);
  ctx.lineTo(cx + Math.cos(an) * (r - lw), cy + Math.sin(an) * (r - lw));
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = C.panel;
  ctx.strokeStyle = hot;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (o.icon) icon(ctx, o.icon, cx, cy - r * 0.42, r * 0.36, a(C.text, 0.8), o.t ?? 0);
  ctx.restore();
}

export interface KeysOpts {
  /** Положение курсора времени 0..1. */
  head: number;
  /** Ключи: [дорожка, время 0..1]. */
  keys: Array<[number, number]>;
  rows?: number;
  /** Появление ключей 0..1 (по очереди). */
  p?: number;
  /** Номера «плохих» ключей (подсвечены). */
  bad?: number[];
  badColor?: string;
  color?: string;
}

/** Таймлайн Blender: дорожки, ключи-ромбы, курсор времени. `x, y` — левый верхний угол. */
export function keyTimeline(ctx: Ctx, x: number, y: number, w: number, h: number, o: KeysOpts): void {
  const color = o.color ?? C.accent;
  const rows = o.rows ?? 3;
  panel(ctx, x, y, w, h, { fill: SCREEN_BG, stroke: a(C.text, 0.14), lineWidth: 1.4, radius: 8 });
  const pad = 30;
  const rh = h / (rows + 0.5);
  ctx.strokeStyle = a(C.text, 0.08);
  ctx.lineWidth = 1;
  for (let i = 0; i <= 20; i++) {
    const gx = x + pad + ((w - pad * 2) * i) / 20;
    ctx.beginPath();
    ctx.moveTo(gx, y + 8);
    ctx.lineTo(gx, y + h - 8);
    ctx.stroke();
  }
  const p = clamp01(o.p ?? 1);
  const n = o.keys.length;
  o.keys.forEach(([row, kt], i) => {
    const kp = clamp01((p * (n + 2) - i) / 3);
    if (kp <= 0) return;
    const kx = x + pad + (w - pad * 2) * kt;
    const ky = y + rh * (row + 0.75);
    const bad = o.bad?.includes(i);
    const s = 13 * easeOutBack(kp);
    ctx.save();
    ctx.translate(kx, ky);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = bad ? (o.badColor ?? C.accent) : color;
    if (bad) {
      ctx.shadowColor = a(o.badColor ?? C.accent, 0.9);
      ctx.shadowBlur = 16;
    }
    ctx.fillRect(-s, -s, s * 2, s * 2);
    ctx.strokeStyle = a(C.bg, 0.8);
    ctx.lineWidth = 2;
    ctx.strokeRect(-s, -s, s * 2, s * 2);
    ctx.restore();
  });
  const hx = x + pad + (w - pad * 2) * clamp01(o.head);
  ctx.strokeStyle = C.h1;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(hx, y + 4);
  ctx.lineTo(hx, y + h - 4);
  ctx.stroke();
  ctx.fillStyle = C.h1;
  rrPath(ctx, hx - 12, y - 6, 24, 18, 5);
  ctx.fill();
}

/** Линейная интерполяция прямоугольников. */
export function lerpRect(p: Rect, q: Rect, k: number): Rect {
  return { x: lerp(p.x, q.x, k), y: lerp(p.y, q.y, k), w: lerp(p.w, q.w, k), h: lerp(p.h, q.h, k) };
}

/** Слой: прозрачность и сдвиг для перехода между этапами. */
export function layer(ctx: Ctx, vis: number, fn: () => void, dx = 0, dy = 0, scale = 1, cx = 960, cy = 600): void {
  if (vis <= 0.002) return;
  ctx.save();
  ctx.globalAlpha *= clamp01(vis);
  if (dx || dy) ctx.translate(dx, dy);
  if (scale !== 1) {
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
  }
  fn();
  ctx.restore();
}
