/**
 * Общие блоки ролика «Game-Ready 3D с помощью AI».
 *
 *   появление и подложки   appear, textBacking, headline
 *   окна и экраны          windowFrame, viewport, imageFrame, promptBox, toolCard
 *   связи и отметки        bez, flow, checkBadge, crossBadge, strike
 *   low-poly модели        drawModel + ogre/tankParts/prop (игра DULO), arcCar (машины ArcRace), carParts, houseParts
 *   полигональные сетки    drawSurf + sphereSurf, blobSurf, limbSurf (квады, треугольники, LOD, лупы)
 *
 * 3D здесь своё, поверх математики wire3d: модель — набор выпуклых частей,
 * части сортируются по глубине, каждая рисуется drawSolid. Этого хватает
 * для угловатого low-poly, который и нужен ролику.
 */

import { clamp01, easeInOutCubic, easeOutBack, easeOutQuart, lerp, seg } from '../../engine/anim.ts';
import { corners, panel, rrPath, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text, wrap, type RevealOpts, type TextStyle } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import type { CueTime, Frame } from '../../engine/types.ts';
import { drawWire, MESH, type Mesh, type V3, type View } from '../../engine/wire3d.ts';
import { ARC } from './arcrace.ts';
import { DULO } from './dulo.ts';
import { HEROES, type HeroData } from './heroes.ts';
import { MAGE } from './mage.ts';
import { MAGE_WALKS } from './mage_walk.ts';

type Ctx = CanvasRenderingContext2D;
export type P2 = [number, number];
export type { V3, View };

/** Фон «экранов» (вьюпорт Blender, окно генератора) — темнее панелей. */
export const SCREEN_BG = '#22252a';
/** Тёмные детали моделей: гусеницы, шины, стёкла. */
export const DARK = '#4a4f57';
/** Нейтральный серый «глины» — модель без материала. */
export const CLAY = '#9aa1a8';
/** Кожа огра игры (brute.glb). */
export const OGRE = '#dda983';

// ================================================================ появление

export interface AppearOpts {
  dx?: number;
  dy?: number;
  /** Стартовый масштаб и его центр. */
  from?: number;
  cx?: number;
  cy?: number;
  /** Масштаб с «перелётом». */
  back?: boolean;
}

/** Обёртка появления: прозрачность + сдвиг и/или масштаб, затем рисует `fn`. */
export function appear(ctx: Ctx, p: number, fn: () => void, o: AppearOpts = {}): void {
  const pr = clamp01(p);
  if (pr <= 0) return;
  const e = easeOutQuart(pr);
  ctx.save();
  ctx.globalAlpha *= Math.min(1, pr * 2.4);
  ctx.translate((1 - e) * (o.dx ?? 0), (1 - e) * (o.dy ?? 0));
  if (o.from !== undefined) {
    const s = o.from + (1 - o.from) * (o.back ? easeOutBack(pr) : e);
    ctx.translate(o.cx ?? 0, o.cy ?? 0);
    ctx.scale(s, s);
    ctx.translate(-(o.cx ?? 0), -(o.cy ?? 0));
  }
  fn();
  ctx.restore();
}

/**
 * Мягкое тёмное пятно под крупный текст поверх графики. Именно пятно, а не
 * полоса: заливка цветом фона во всю ширину видна на виньетке как прямоугольник.
 */
export function textBacking(ctx: Ctx, cx: number, cy: number, r: number, alpha: number): void {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, 0.34);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, a(C.bg, alpha));
  g.addColorStop(0.55, a(C.bg, alpha * 0.8));
  g.addColorStop(1, a(C.bg, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  ctx.restore();
}

export interface HeadlineOpts {
  x: number;
  y: number;
  /** Текст по умолчанию — `show` реплики. */
  text?: string;
  label?: string;
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  maxWidth?: number;
  lineHeight?: number;
  /** С какой секунды реплики начинается появление (можно отрицательное). */
  at?: number;
  /** Длительность появления, сек. */
  dur?: number;
  /** Приглушение 0..1 (когда заголовок уступает место следующему). */
  dim?: number;
  glow?: boolean;
  reveal?: RevealOpts;
}

/**
 * Текстовый объект реплики: пословное появление `o.text` (правка из редактора
 * применяется). Опорная точка — точка привязки текста (x, y базовой линии).
 */
export function headline(f: Frame, id: string, c: CueTime, o: HeadlineOpts): void {
  const { ctx } = f;
  const color = o.color ?? C.h1;
  f.obj(id, { x: o.x, y: o.y, text: o.text ?? c.show, label: o.label ?? id }, (ob) => {
    const p = seg(c.t, o.at ?? 0, o.dur ?? 0.7);
    if (p <= 0) return;
    ctx.save();
    ctx.globalAlpha *= 1 - 0.55 * clamp01(o.dim ?? 0);
    const st: TextStyle = {
      size: o.size ?? 96,
      color,
      align: o.align ?? 'left',
      tracking: 0.6,
      maxWidth: o.maxWidth,
      lineHeight: o.lineHeight ?? 1.1,
    };
    if (o.glow) {
      st.glowColor = a(color, 0.35);
      st.glowBlur = 36;
    }
    reveal(ctx, ob.text, 0, 0, st, p, { stagger: 0.18, rise: 26, ...o.reveal });
    ctx.restore();
  });
}

export interface TitleBeat {
  /** Реплика, с которой появляется заголовок; текст — её `show`. */
  c: CueTime;
  color?: string;
  /** Текст вместо `show` (редко). */
  text?: string;
}

/**
 * Заголовок слайда, который сменяется по репликам (как в эталонах llm3d/hexstorm):
 * каждый следующий вытесняет предыдущий. Объекты `title:0`, `title:1`…
 */
export function titles(
  f: Frame,
  beats: TitleBeat[],
  o: { x?: number; y?: number; size?: number; maxWidth?: number } = {},
): void {
  const { ctx } = f;
  const x = o.x ?? 150;
  const y = o.y ?? 230;
  beats.forEach((b, i) => {
    const next = beats[i + 1];
    f.obj(`title:${i}`, { x, y, abs: true, text: b.text ?? b.c.show, label: `Заголовок ${i + 1}` }, (ob) => {
      const out = next ? seg(next.c.t, -0.3, 0.3) : 0;
      if (!b.c.began || out >= 1) return;
      const color = b.color ?? (i === 0 ? C.h1 : C.accent);
      ctx.save();
      ctx.globalAlpha *= 1 - out;
      reveal(
        ctx,
        ob.text,
        x,
        y,
        { size: o.size ?? 100, color, tracking: 0.6, maxWidth: o.maxWidth, lineHeight: 1.08, glowColor: a(color, 0.25), glowBlur: 26 },
        seg(b.c.t, 0, 0.55),
        { stagger: 0.2, rise: 26 },
      );
      ctx.restore();
    });
  });
}

// ================================================================ окна и экраны

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WindowOpts {
  title?: string;
  color?: string;
  /** Высота шапки. */
  bar?: number;
  icon?: string;
  glow?: number;
  t?: number;
}

/** Окно: рамка, шапка с тремя точками и заголовком. Возвращает область содержимого. */
export function windowFrame(ctx: Ctx, x: number, y: number, w: number, h: number, o: WindowOpts = {}): Rect {
  const color = o.color ?? C.h1;
  const bar = o.bar ?? 78;
  panel(ctx, x, y, w, h, {
    fill: C.panel,
    stroke: a(color, 0.34),
    lineWidth: 1.8,
    radius: 16,
    glow: a(color, 0.1 + (o.glow ?? 0) * 0.25),
    glowBlur: 50,
  });

  ctx.save();
  rrPath(ctx, x, y, w, h, 16);
  ctx.clip();
  ctx.fillStyle = a(color, 0.07);
  ctx.fillRect(x, y, w, bar);
  ctx.fillStyle = a(C.text, 0.12);
  ctx.fillRect(x, y + bar - 1.5, w, 1.5);
  ctx.restore();

  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = a(i === 0 ? C.accent : C.text, i === 0 ? 0.7 : 0.25);
    ctx.beginPath();
    ctx.arc(x + 38 + i * 34, y + bar / 2, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  let tx = x + 150;
  if (o.icon) {
    icon(ctx, o.icon, tx + 22, y + bar / 2, 44, a(color, 0.9), o.t ?? 0);
    tx += 62;
  }
  if (o.title) {
    text(ctx, o.title, tx, y + bar / 2 + 16, { size: 46, color: a(C.text, 0.72), tracking: 1.6 });
  }
  return { x, y: y + bar, w, h: h - bar };
}

/** «Экран»: тёмная область с обрезкой по рамке. Содержимое рисует `draw`. */
export function viewport(
  ctx: Ctx,
  r: Rect,
  draw: () => void,
  o: { color?: string; bg?: string | CanvasGradient; radius?: number; frame?: boolean; corners?: boolean } = {},
): void {
  const radius = o.radius ?? 12;
  ctx.save();
  rrPath(ctx, r.x, r.y, r.w, r.h, radius);
  ctx.clip();
  ctx.fillStyle = o.bg ?? SCREEN_BG;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  draw();
  ctx.restore();
  if (o.frame !== false) {
    ctx.strokeStyle = a(o.color ?? C.h1, 0.4);
    ctx.lineWidth = 1.8;
    rrPath(ctx, r.x, r.y, r.w, r.h, radius);
    ctx.stroke();
    if (o.corners !== false) corners(ctx, r.x - 10, r.y - 10, r.w + 20, r.h + 20, 26, a(o.color ?? C.h1, 0.55), 2.5);
  }
}

/**
 * Картинка-референс (концепт, скриншот, кадр видео): светлая «фотобумага»
 * с мягким градиентом, содержимое рисует `draw` в обрезке.
 */
export function imageFrame(ctx: Ctx, r: Rect, draw: () => void, o: { color?: string; tilt?: number } = {}): void {
  const color = o.color ?? C.accent;
  ctx.save();
  if (o.tilt) {
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.rotate(o.tilt);
    ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
  }
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = C.panel;
  rrPath(ctx, r.x, r.y, r.w, r.h, 10);
  ctx.fill();
  ctx.restore();
  ctx.save();
  rrPath(ctx, r.x, r.y, r.w, r.h, 10);
  ctx.clip();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, a(color, 0.16));
  g.addColorStop(1, a(C.bg, 0.9));
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  draw();
  ctx.restore();
  ctx.strokeStyle = a(color, 0.55);
  ctx.lineWidth = 2.5;
  rrPath(ctx, r.x, r.y, r.w, r.h, 10);
  ctx.stroke();
  ctx.restore();
}

export interface PromptOpts {
  /** Доля напечатанного 0..1. */
  p: number;
  color?: string;
  size?: number;
  /** Время для мигания курсора. */
  gt?: number;
  /** Иконка слева. */
  icon?: string;
}

/**
 * Поле промпта: панель с иконкой и текстом, который «печатается».
 * Возвращает высоту панели. `x, y` — левый верхний угол.
 */
export function promptBox(ctx: Ctx, str: string, x: number, y: number, w: number, o: PromptOpts): number {
  const color = o.color ?? C.h1;
  const size = o.size ?? 56;
  const st: TextStyle = { size, color: C.text, maxWidth: w - 170, lineHeight: 1.16, caps: 'normal' };
  const lines = wrap(ctx, str, st);
  const h = Math.max(1, lines.length) * size * 1.16 + size * 1.1;
  panel(ctx, x, y, w, h, {
    fill: a(C.bg, 0.92),
    stroke: a(color, 0.5),
    lineWidth: 2,
    radius: 14,
    accentBar: { color, width: 5 },
  });
  icon(ctx, o.icon ?? 'chat', x + 66, y + size * 0.55 + size * 0.5, size * 0.95, color);

  const n = Math.round(str.length * clamp01(o.p));
  let left = n;
  const tx = x + 128;
  let ty = y + size * 0.55 + size * 0.86;
  let caretX = tx;
  let caretY = ty;
  for (const ln of lines) {
    const part = ln.slice(0, Math.max(0, left));
    if (part) {
      const wPart = text(ctx, part, tx, ty, st);
      caretX = tx + wPart;
      caretY = ty;
    }
    left -= ln.length + 1;
    if (left < 0) break;
    ty += size * 1.16;
  }
  if (o.p < 1 || Math.sin((o.gt ?? 0) * 7) > 0) {
    ctx.fillStyle = color;
    ctx.fillRect(caretX + 5, caretY - size * 0.78, Math.max(3, size * 0.07), size * 0.9);
  }
  return h;
}

export interface ToolCardOpts {
  name: string;
  /** Вторая строка мелким (цена, версия) — только слова из озвучки. */
  sub?: string;
  color?: string;
  icon?: string;
  p?: number;
  /** Подсветка выбранной карточки 0..1. */
  active?: number;
  /** Приглушение 0..1. */
  dim?: number;
  t?: number;
}

/** Карточка инструмента: гекс с иконкой и название. `x, y` — левый верхний угол. */
export function toolCard(ctx: Ctx, x: number, y: number, w: number, h: number, o: ToolCardOpts): void {
  const p = clamp01(o.p ?? 1);
  if (p <= 0) return;
  const color = o.color ?? C.h1;
  const act = clamp01(o.active ?? 0);
  const dim = clamp01(o.dim ?? 0);
  const e = easeOutQuart(p);
  ctx.save();
  ctx.globalAlpha *= Math.min(1, p * 2.4) * (1 - dim * 0.6);
  ctx.translate(0, (1 - e) * 40);
  if (act > 0) softLight(ctx, x + w / 2, y + h / 2, w * 0.9, color, 0.18 * act);
  panel(ctx, x, y, w, h, {
    fill: C.panel,
    stroke: a(color, 0.3 + 0.5 * act),
    lineWidth: 2 + act * 1.5,
    radius: 18,
    glow: a(color, 0.08 + 0.2 * act),
    glowBlur: 50,
    accentBar: { color: a(color, 0.9), width: 6 },
  });
  const hr = Math.min(h * 0.3, 70);
  const hx = x + hr + 46;
  const cy = y + h / 2 - (o.sub ? h * 0.1 : 0);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const ang = Math.PI / 6 + (Math.PI / 3) * i;
    const px = hx + Math.cos(ang) * hr;
    const py = cy + Math.sin(ang) * hr;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.strokeStyle = a(color, 0.6);
  ctx.lineWidth = 2.4;
  ctx.stroke();
  icon(ctx, o.icon ?? 'cube', hx, cy, hr * 1.05, color, o.t ?? 0);
  const size = Math.min(84, h * 0.36);
  text(ctx, o.name, hx + hr + 36, cy + size * 0.36, {
    size,
    color: act > 0.5 ? color : C.text,
    tracking: 1.2,
    caps: 'normal',
    maxWidth: w - (hx - x) - hr - 60,
  });
  if (o.sub) {
    text(ctx, o.sub, x + 40, y + h - 34, { size: 46, color: a(C.text, 0.62), tracking: 1.2 });
  }
  ctx.restore();
}

// ================================================================ связи и отметки

/** Точка квадратичной кривой Безье. */
export function bez(p0: P2, p1: P2, p2: P2, k: number): P2 {
  const u = 1 - k;
  return [
    u * u * p0[0] + 2 * u * k * p1[0] + k * k * p2[0],
    u * u * p0[1] + 2 * u * k * p1[1] + k * k * p2[1],
  ];
}

export interface FlowOpts {
  t: number;
  color: string;
  /** Прогресс «прокладки» линии 0..1. */
  p?: number;
  n?: number;
  speed?: number;
  r?: number;
  dash?: number[];
  width?: number;
  lineAlpha?: number;
}

/** Линия связи с бегущими по ней точками (квадратичная кривая p0 → p2 через p1). */
export function flow(ctx: Ctx, p0: P2, p1: P2, p2: P2, o: FlowOpts): void {
  const p = clamp01(o.p ?? 1);
  if (p <= 0) return;
  const steps = 28;
  ctx.save();
  ctx.strokeStyle = a(o.color, o.lineAlpha ?? 0.4);
  ctx.lineWidth = o.width ?? 3;
  ctx.lineCap = 'round';
  if (o.dash) ctx.setLineDash(o.dash);
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const [x, y] = bez(p0, p1, p2, (i / steps) * p);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  const n = o.n ?? 3;
  ctx.fillStyle = o.color;
  ctx.shadowColor = a(o.color, 0.8);
  ctx.shadowBlur = 14;
  for (let i = 0; i < n; i++) {
    const k = (((o.t * (o.speed ?? 0.5) + i / n) % 1) + 1) % 1;
    if (k > p) continue;
    const [x, y] = bez(p0, p1, p2, k);
    ctx.beginPath();
    ctx.arc(x, y, (o.r ?? 6) * (0.6 + 0.4 * Math.sin(k * Math.PI)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Круглая отметка «проверено / годится». */
export function checkBadge(ctx: Ctx, cx: number, cy: number, r: number, p: number, color: string = C.pos): void {
  badge(ctx, cx, cy, r, p, color, 'check');
}

/** Круглая отметка «нет / не надо» — косой крест. */
export function crossBadge(ctx: Ctx, cx: number, cy: number, r: number, p: number, color: string = C.accent): void {
  badge(ctx, cx, cy, r, p, color, 'cross');
}

function badge(ctx: Ctx, cx: number, cy: number, r: number, p: number, color: string, kind: 'check' | 'cross'): void {
  const pr = clamp01(p);
  if (pr <= 0) return;
  const s = easeOutBack(pr, 2.4);
  ctx.save();
  ctx.globalAlpha *= Math.min(1, pr * 3);
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.shadowColor = a(color, 0.6);
  ctx.shadowBlur = r * 0.8;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  if (kind === 'check') {
    icon(ctx, 'check', 0, 0, r * 1.2, C.bg);
  } else {
    ctx.strokeStyle = C.bg;
    ctx.lineWidth = r * 0.24;
    ctx.lineCap = 'round';
    const k = r * 0.38;
    ctx.beginPath();
    ctx.moveTo(-k, -k);
    ctx.lineTo(k, k);
    ctx.moveTo(k, -k);
    ctx.lineTo(-k, k);
    ctx.stroke();
  }
  ctx.restore();
}

/** Зачёркивание: линия, прочерчиваемая от (x1, y1) к (x2, y2). */
export function strike(
  ctx: Ctx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  p: number,
  color: string = C.accent,
  width = 8,
): void {
  const pr = easeOutQuart(clamp01(p));
  if (pr <= 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.shadowColor = a(C.bg, 0.9);
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(lerp(x1, x2, pr), lerp(y1, y2, pr));
  ctx.stroke();
  ctx.restore();
}

// ================================================================ 3D: матрицы и камера

/** Матрица 3×3 по строкам. */
export type M3 = [number, number, number, number, number, number, number, number, number];

export const M = {
  id: (): M3 => [1, 0, 0, 0, 1, 0, 0, 0, 1],
  rx(t: number): M3 {
    const c = Math.cos(t);
    const s = Math.sin(t);
    return [1, 0, 0, 0, c, -s, 0, s, c];
  },
  ry(t: number): M3 {
    const c = Math.cos(t);
    const s = Math.sin(t);
    return [c, 0, s, 0, 1, 0, -s, 0, c];
  },
  rz(t: number): M3 {
    const c = Math.cos(t);
    const s = Math.sin(t);
    return [c, -s, 0, s, c, 0, 0, 0, 1];
  },
  scale(x: number, y = x, z = x): M3 {
    return [x, 0, 0, 0, y, 0, 0, 0, z];
  },
  /** A·B (сначала применяется B). */
  mul(A: M3, B: M3): M3 {
    const o = new Array<number>(9) as M3;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        o[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
      }
    }
    return o;
  },
  /** Произведение слева направо: chain(A, B, C) = A·B·C. */
  chain(...ms: M3[]): M3 {
    return ms.reduce((acc, m) => M.mul(acc, m), M.id());
  },
  apply(m: M3, v: V3): V3 {
    return [
      m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
      m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
      m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
    ];
  },
};

const add3 = (p: V3, q: V3): V3 => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
const sub3 = (p: V3, q: V3): V3 => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const dot3 = (p: V3, q: V3) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
const cross3 = (p: V3, q: V3): V3 => [
  p[1] * q[2] - p[2] * q[1],
  p[2] * q[0] - p[0] * q[2],
  p[0] * q[1] - p[1] * q[0],
];
function unit3(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** Мир → пространство камеры (как в wire3d). */
export function camSpace(v: V3, view: View): V3 {
  let [x, y, z] = v;
  const yaw = view.yaw ?? 0;
  if (yaw) {
    const c = Math.cos(yaw);
    const n = Math.sin(yaw);
    [x, z] = [x * c + z * n, -x * n + z * c];
  }
  const pitch = view.pitch ?? 0;
  if (pitch) {
    const c = Math.cos(pitch);
    const n = Math.sin(pitch);
    [y, z] = [y * c - z * n, y * n + z * c];
  }
  return [x, y, z];
}

/** Пространство камеры → экран. */
export function camToScreen(c: V3, view: View): P2 {
  const d = view.dist ?? 7;
  const f = Number.isFinite(d) ? d / Math.max(0.2, d - c[2]) : 1;
  return [view.cx + c[0] * view.size * f, view.cy - c[1] * view.size * f];
}

/** Точка мира → экран. */
export const toScreen = (v: V3, view: View): P2 => camToScreen(camSpace(v, view), view);

/** Положение всей модели в мире. */
export interface Root {
  pos?: V3;
  /** Равномерный масштаб. */
  scale?: number;
  /** Поворот вокруг вертикали. */
  ry?: number;
  /** Наклон вперёд/назад (после ry) — для падения, кивка. */
  rx?: number;
  /** Крен (после rx). */
  rz?: number;
}

export function rootMatrix(r: Root = {}): M3 {
  return M.chain(M.rz(r.rz ?? 0), M.rx(r.rx ?? 0), M.ry(r.ry ?? 0), M.scale(r.scale ?? 1));
}

/** Точка модели → мир. */
export function placePoint(v: V3, r: Root = {}): V3 {
  return add3(r.pos ?? [0, 0, 0], M.apply(rootMatrix(r), v));
}

/** Свет в пространстве камеры: слева-сверху и немного спереди (как в wire3d). */
const LIGHT = unit3([-0.5, 0.78, 0.5]);

function rgbOf(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Цвет грани при освещённости i (0..1). */
export function shadeHex(hex: string, i: number): string {
  const [r, g, b] = rgbOf(hex);
  const k = 0.2 + 0.8 * clamp01(i);
  const hi = Math.max(0, i - 0.84) * 1.5;
  const m = (c: number) => Math.round(Math.min(255, c * k + (255 - c * k) * hi));
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`;
}

// ================================================================ 3D: модели из частей

/** Готовый треугольный меш (реальная модель игры): вершины относительно точки крепления. */
export interface Soup {
  /** x, y, z подряд, относительно точки крепления узла. */
  pos: number[];
  /** По три индекса на треугольник. */
  idx: number[];
  /** Цвет треугольника 0xRRGGBB. */
  col: number[];
  /** Треугольники-«свечения» (глаза, руны): без тени. */
  glow: Set<number>;
  /** Какие рёбра треугольника — рёбра полигона (биты 1|2|4): каркас рисует квады без диагоналей. */
  mask?: number[];
  /** Вершины не продублированы (сваренный меш): нормали сглаживаются по индексам, без поиска совпадений. */
  welded?: boolean;
}

/**
 * Часть модели. Либо выпуклое тело движка (`mesh`, `size`, `color`), либо готовый
 * треугольный меш реальной модели (`soup`: `size` — масштаб, `color` не нужен).
 */
export interface Part {
  mesh?: Mesh;
  soup?: Soup;
  /** Центр части (для soup — точка крепления). */
  pos: V3;
  /** Размер по осям (меши движка — единичные, от −0.5 до 0.5); для soup — масштаб. */
  size: V3;
  /** Поворот части. */
  rot?: M3;
  /** Цвет, hex. Для soup необязателен (у треугольников свои цвета); если задан — перекрашивает часть. */
  color?: string;
  /** Не рисовать часть (для пошаговой сборки). */
  hide?: boolean;
  /** Прозрачность части 0..1. */
  alpha?: number;
  /** Метка части — по ней сцена может подсветить/спрятать кусок. */
  tag?: string;
}

export interface ModelOpts {
  /** Ступени тун-шейдинга; 0 — плавная заливка. */
  bands?: number;
  /** Цвет рёбер выпуклых частей; `null` — без рёбер. */
  edge?: string | null;
  edgeWidth?: number;
  ambient?: number;
  /** Перекрасить все части в один цвет (силуэт, «глина»). */
  tint?: string;
  /** Показать треугольники реальной модели: цвет рёбер (например, `a(C.bg, 0.6)`). */
  wire?: string;
  /**
   * Сглаживание света реальных моделей: нормаль грани усредняется по соседним граням через
   * вершины, и сетка не «искрит» отдельными треугольниками. 0..1, по умолчанию 0.8.
   */
  smooth?: number;
  wireWidth?: number;
}

/**
 * Мягкий свет реальных моделей: половинный Ламберт (теневая сторона не проваливается
 * в черноту), узкий диапазон яркости и без пересвета — грани не выпячиваются.
 */
function softShade(rgb: number, nl: number, base: number): string {
  const wrap = 0.5 + 0.5 * nl;
  const f = base + (1.04 - base) * wrap * wrap;
  const m = (c: number) => Math.round(Math.min(255, c * f));
  return `rgb(${m((rgb >> 16) & 255)}, ${m((rgb >> 8) & 255)}, ${m(rgb & 255)})`;
}

function shadeRGB(rgb: number, i: number): string {
  const k = 0.2 + 0.8 * clamp01(i);
  const hi = Math.max(0, i - 0.84) * 1.5;
  const m = (c: number) => Math.round(Math.min(255, c * k + (255 - c * k) * hi));
  return `rgb(${m((rgb >> 16) & 255)}, ${m((rgb >> 8) & 255)}, ${m(rgb & 255)})`;
}

const hexToInt = (hex: string) => parseInt(hex.replace('#', ''), 16);

/** Нормали вершин меша (сумма нормалей соседних граней), в координатах меша. */
const VNORM = new WeakMap<Soup, Float32Array>();
function vertexNormals(sp: Soup): Float32Array {
  const hit = VNORM.get(sp);
  if (hit) return hit;
  const n = new Float32Array(sp.pos.length);
  // вершины с одинаковым положением считаем одной: у плоских low-poly мешей они продублированы
  const key = sp.welded
    ? (i: number) => String(i)
    : (i: number) => `${sp.pos[i * 3].toFixed(3)},${sp.pos[i * 3 + 1].toFixed(3)},${sp.pos[i * 3 + 2].toFixed(3)}`;
  const acc = new Map<string, V3>();
  for (let t = 0; t < sp.idx.length / 3; t++) {
    const [a1, b1, c1] = [sp.idx[t * 3], sp.idx[t * 3 + 1], sp.idx[t * 3 + 2]];
    const A: V3 = [sp.pos[a1 * 3], sp.pos[a1 * 3 + 1], sp.pos[a1 * 3 + 2]];
    const B: V3 = [sp.pos[b1 * 3], sp.pos[b1 * 3 + 1], sp.pos[b1 * 3 + 2]];
    const Cc: V3 = [sp.pos[c1 * 3], sp.pos[c1 * 3 + 1], sp.pos[c1 * 3 + 2]];
    const fn = cross3(sub3(B, A), sub3(Cc, A)); // длина ~ площадь: крупные грани весят больше
    for (const v of [a1, b1, c1]) {
      const k = key(v);
      const cur = acc.get(k) ?? [0, 0, 0];
      acc.set(k, [cur[0] + fn[0], cur[1] + fn[1], cur[2] + fn[2]]);
    }
  }
  for (let i = 0; i < sp.pos.length / 3; i++) {
    const u = unit3(acc.get(key(i)) ?? [0, 1, 0]);
    n[i * 3] = u[0];
    n[i * 3 + 1] = u[1];
    n[i * 3 + 2] = u[2];
  }
  VNORM.set(sp, n);
  return n;
}

interface FaceItem {
  pts: P2[];
  z: number;
  fill: string;
  stroke: string | null;
  lw: number;
  alpha: number;
  /** Каркас поверх: только эти рёбра (биты 1|2|4) и их цвет. */
  wire?: { mask: number; color: string; width: number };
}

/**
 * Модель из частей: все грани всех частей сортируются по глубине вместе
 * (художник), заливка плоская со светом слева-сверху.
 */
export function drawModel(ctx: Ctx, parts: Part[], view: View, root: Root = {}, o: ModelOpts = {}): void {
  const R = rootMatrix(root);
  const base = root.pos ?? [0, 0, 0];
  const d = view.dist ?? 7;
  const ambient = o.ambient ?? 0.32;
  const tint = o.tint ? hexToInt(o.tint) : null;
  const light = (n: V3) => {
    let i = ambient + (1 - ambient) * Math.max(0, dot3(n, LIGHT));
    if (o.bands && o.bands > 1) i = Math.min(1, Math.floor(i * o.bands) / (o.bands - 1));
    return i;
  };
  const faces: FaceItem[] = [];

  for (const part of parts) {
    const alpha = clamp01(part.alpha ?? 1);
    if (part.hide || alpha <= 0.001) continue;
    const local = M.mul(R, M.mul(part.rot ?? M.id(), M.scale(part.size[0], part.size[1], part.size[2])));
    const center = add3(base, M.apply(R, part.pos));

    if (part.soup) {
      const sp = part.soup;
      // у реальной модели свои цвета; `color` части — перекраска только её (веса, подсветка)
      const ptint = part.color ? hexToInt(part.color) : null;
      const smooth = clamp01(o.smooth ?? 0.8);
      const base = o.ambient !== undefined ? 0.4 + 0.5 * o.ambient : 0.64;
      const vn = smooth > 0 ? vertexNormals(sp) : null;
      const n = sp.pos.length / 3;
      const cam: V3[] = new Array(n);
      const scr: P2[] = new Array(n);
      for (let i = 0; i < n; i++) {
        const w = add3(center, M.apply(local, [sp.pos[i * 3], sp.pos[i * 3 + 1], sp.pos[i * 3 + 2]]));
        cam[i] = camSpace(w, view);
        scr[i] = camToScreen(cam[i], view);
      }
      for (let t = 0; t < sp.idx.length / 3; t++) {
        const A = cam[sp.idx[t * 3]];
        const B = cam[sp.idx[t * 3 + 1]];
        const Cc = cam[sp.idx[t * 3 + 2]];
        const nrm = cross3(sub3(B, A), sub3(Cc, A));
        const mid: V3 = [(A[0] + B[0] + Cc[0]) / 3, (A[1] + B[1] + Cc[1]) / 3, (A[2] + B[2] + Cc[2]) / 3];
        const toCam: V3 = Number.isFinite(d) ? [-mid[0], -mid[1], d - mid[2]] : [0, 0, 1];
        if (dot3(nrm, toCam) <= 0) continue;
        const col = tint ?? ptint ?? sp.col[t];
        const glow = tint === null && ptint === null && sp.glow.has(t);
        let ln = unit3(nrm);
        if (vn) {
          // средняя нормаль вершин грани: из меша в мир (поворот части и модели), затем в камеру
          const i0 = sp.idx[t * 3] * 3;
          const i1 = sp.idx[t * 3 + 1] * 3;
          const i2 = sp.idx[t * 3 + 2] * 3;
          const m: V3 = [vn[i0] + vn[i1] + vn[i2], vn[i0 + 1] + vn[i1 + 1] + vn[i2 + 1], vn[i0 + 2] + vn[i1 + 2] + vn[i2 + 2]];
          const sm = unit3(camSpace(M.apply(local, m), view));
          ln = unit3([lerp(ln[0], sm[0], smooth), lerp(ln[1], sm[1], smooth), lerp(ln[2], sm[2], smooth)]);
        }
        let nl = dot3(ln, LIGHT);
        if (o.bands && o.bands > 1) nl = Math.round(((nl + 1) / 2) * (o.bands - 1)) / (o.bands - 1) * 2 - 1;
        const fill = glow ? shadeRGB(col, 0.95) : softShade(col, nl, base);
        const masked = o.wire && sp.mask;
        faces.push({
          pts: [scr[sp.idx[t * 3]], scr[sp.idx[t * 3 + 1]], scr[sp.idx[t * 3 + 2]]],
          z: mid[2],
          fill,
          stroke: masked ? fill : (o.wire ?? fill),
          lw: masked ? 0.8 : o.wire ? (o.wireWidth ?? 1.2) : 0.8,
          alpha,
          wire: masked ? { mask: sp.mask![t], color: o.wire!, width: o.wireWidth ?? 1.2 } : undefined,
        });
      }
      continue;
    }

    if (!part.mesh) continue;
    const mesh = part.mesh;
    const cam = mesh.verts.map((v) => camSpace(add3(center, M.apply(local, v)), view));
    const scr = cam.map((c) => camToScreen(c, view));
    const cc = camSpace(center, view);
    const color = o.tint ?? part.color ?? CLAY;
    for (const f of mesh.faces) {
      const mid: V3 = [0, 0, 0];
      for (const i of f) {
        mid[0] += cam[i][0] / f.length;
        mid[1] += cam[i][1] / f.length;
        mid[2] += cam[i][2] / f.length;
      }
      let nrm = unit3(cross3(sub3(cam[f[1]], cam[f[0]]), sub3(cam[f[2]], cam[f[0]])));
      if (dot3(nrm, sub3(mid, cc)) < 0) nrm = [-nrm[0], -nrm[1], -nrm[2]];
      const toCam: V3 = Number.isFinite(d) ? [-mid[0], -mid[1], d - mid[2]] : [0, 0, 1];
      if (dot3(nrm, toCam) <= 0) continue;
      const fill = shadeHex(color, light(nrm));
      faces.push({
        pts: f.map((i) => scr[i]),
        z: mid[2],
        fill,
        stroke: o.edge === null ? fill : (o.edge ?? shadeHex(color, 1.06)),
        lw: o.edge === null ? 0.8 : (o.edgeWidth ?? 1.5),
        alpha,
      });
    }
  }

  faces.sort((p, q) => p.z - q.z);
  ctx.save();
  ctx.lineJoin = 'round';
  const baseAlpha = ctx.globalAlpha;
  for (const f of faces) {
    ctx.globalAlpha = baseAlpha * f.alpha;
    ctx.beginPath();
    ctx.moveTo(f.pts[0][0], f.pts[0][1]);
    for (let i = 1; i < f.pts.length; i++) ctx.lineTo(f.pts[i][0], f.pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = f.fill;
    ctx.fill();
    if (f.stroke) {
      ctx.strokeStyle = f.stroke;
      ctx.lineWidth = f.lw;
      ctx.stroke();
    }
    if (f.wire && f.wire.mask) {
      ctx.beginPath();
      for (let e = 0; e < 3; e++) {
        if (!(f.wire.mask & (1 << e))) continue;
        const p0 = f.pts[e];
        const p1 = f.pts[(e + 1) % 3];
        ctx.moveTo(p0[0], p0[1]);
        ctx.lineTo(p1[0], p1[1]);
      }
      ctx.strokeStyle = f.wire.color;
      ctx.lineWidth = f.wire.width;
      ctx.stroke();
    }
  }
  ctx.restore();
}

const DECIM = new WeakMap<Soup, Map<number, Soup>>();

/** Упрощение меша кластеризацией вершин: всё, что попало в одну клетку, сливается. */
function decimateSoup(sp: Soup, cell: number): Soup {
  let byCell = DECIM.get(sp);
  if (!byCell) DECIM.set(sp, (byCell = new Map()));
  const hit = byCell.get(cell);
  if (hit) return hit;
  const n = sp.pos.length / 3;
  const keyOf = new Map<string, number>();
  const sum: number[] = [];
  const cnt: number[] = [];
  const map = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const x = sp.pos[i * 3];
    const y = sp.pos[i * 3 + 1];
    const z = sp.pos[i * 3 + 2];
    const key = `${Math.round(x / cell)}:${Math.round(y / cell)}:${Math.round(z / cell)}`;
    let k = keyOf.get(key);
    if (k === undefined) {
      k = cnt.length;
      keyOf.set(key, k);
      cnt.push(0);
      sum.push(0, 0, 0);
    }
    map[i] = k;
    cnt[k]++;
    sum[k * 3] += x;
    sum[k * 3 + 1] += y;
    sum[k * 3 + 2] += z;
  }
  const pos = sum.map((v, i) => v / cnt[Math.floor(i / 3)]);
  const idx: number[] = [];
  const col: number[] = [];
  const glow = new Set<number>();
  const seen = new Set<string>();
  for (let t = 0; t < sp.idx.length / 3; t++) {
    const a1 = map[sp.idx[t * 3]];
    const b1 = map[sp.idx[t * 3 + 1]];
    const c1 = map[sp.idx[t * 3 + 2]];
    if (a1 === b1 || b1 === c1 || a1 === c1) continue;
    const key = [a1, b1, c1].sort((p, q) => p - q).join(':');
    if (seen.has(key)) continue;
    seen.add(key);
    if (sp.glow.has(t)) glow.add(col.length);
    idx.push(a1, b1, c1);
    col.push(sp.col[t]);
  }
  const out = { pos, idx, col, glow };
  byCell.set(cell, out);
  return out;
}

/**
 * Упрощённая версия реальной модели (для LOD и «автоматической оптимизации»):
 * вершины сливаются по сетке с шагом `cell` в единицах игры (огр ростом 1.0):
 * 0.04 — лёгкое упрощение, 0.08 — заметное, 0.14 — грубое. Силуэт сохраняется.
 */
export function decimate(parts: Part[], cell: number): Part[] {
  if (cell <= 0) return parts;
  return parts.map((p) => (p.soup ? { ...p, soup: decimateSoup(p.soup, cell) } : p));
}

/** Число треугольников модели (реальные меши) — для подписей и полос бюджета. */
export function triCount(parts: Part[]): number {
  return parts.reduce((s, p) => s + (p.soup ? p.soup.idx.length / 3 : 0), 0);
}

/** Тень-эллипс на «полу» под моделью. */
export function groundShadow(ctx: Ctx, view: View, x: number, z: number, rx: number, rz: number, alpha = 0.35): void {
  const [cx, cy] = toScreen([x, 0, z], view);
  const [ex] = toScreen([x + rx, 0, z], view);
  const [, ey] = toScreen([x, 0, z + rz], view);
  const w = Math.max(4, Math.abs(ex - cx));
  const h = Math.max(3, Math.abs(ey - cy));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, h / w);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w);
  g.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(-w, -w, w * 2, w * 2);
  ctx.restore();
}

const box = (pos: V3, size: V3, color: string, tag?: string, rot?: M3): Part => ({
  mesh: MESH.cube,
  pos,
  size,
  color,
  tag,
  rot,
});

/** Колесо: цилиндр с осью вдоль Z. */
const wheel = (pos: V3, r: number, w: number, color: string, spin = 0): Part => ({
  mesh: MESH.cylinder,
  pos,
  size: [r * 2, w, r * 2],
  rot: M.mul(M.rx(Math.PI / 2), M.ry(spin)),
  color,
  tag: 'wheel',
});

export interface CarOpts {
  color?: string;
  /** Расстояние между осями (по умолчанию 1.5). */
  wheelbase?: number;
  /** Сдвиг фар по высоте. */
  lights?: number;
  /** Форма крыши: 0 — купе, 1 — длинная «универсал». */
  roof?: number;
  /** Высота кабины. */
  cabin?: number;
  /** Поворот колёс при езде, рад. */
  spin?: number;
}

/**
 * Автомобиль: длина ≈ 2.4 вдоль X (перёд — +X), колёса стоят на y = 0.
 * Параметры дают «вариации» одной машины — для ракурсов, которые не сходятся.
 */
export function carParts(o: CarOpts = {}): Part[] {
  const color = o.color ?? C.h1;
  const wb = o.wheelbase ?? 1.5;
  const roof = clamp01(o.roof ?? 0);
  const ch = o.cabin ?? 0.36;
  const r = 0.26;
  const parts: Part[] = [
    box([0, 0.42, 0], [2.4, 0.36, 1.06], color, 'body'),
    box([1.02, 0.36, 0], [0.42, 0.26, 1.04], color, 'nose'),
    box([-0.2 - roof * 0.25, 0.6 + ch / 2, 0], [1.0 + roof * 0.6, ch, 0.9], color, 'cabin'),
    box([0.32 - roof * 0.05, 0.6 + ch / 2, 0], [0.12, ch * 0.82, 0.86], DARK, 'glass'),
    box([1.21, 0.44 + (o.lights ?? 0), 0.33], [0.06, 0.1, 0.22], C.accent, 'light'),
    box([1.21, 0.44 + (o.lights ?? 0), -0.33], [0.06, 0.1, 0.22], C.accent, 'light'),
  ];
  for (const sx of [wb / 2, -wb / 2]) {
    for (const sz of [0.5, -0.5]) parts.push(wheel([sx, r, sz], r, 0.18, DARK, o.spin ?? 0));
  }
  return parts;
}

// ---------------------------------------------------------------- реальные модели игры DULO

interface DuloPart {
  soup: Soup;
  /** Точка крепления в единицах игры. */
  pivot: V3;
  /** Кончик конечности относительно точки крепления (кисть, стопа) — для суставов. */
  tip: V3;
  parent: string | null;
}

const NODE_CACHE = new Map<string, Map<string, DuloPart>>();
const sc3 = (v: V3, k: number): V3 => [v[0] * k, v[1] * k, v[2] * k];

/** Узлы модели игры: меш относительно точки крепления, точка крепления, кончик. */
function nodesOf(model: string): Map<string, DuloPart> {
  const hit = NODE_CACHE.get(model);
  if (hit) return hit;
  const src = DULO[model];
  if (!src) throw new Error(`Нет модели DULO «${model}»`);
  const out = new Map<string, DuloPart>();
  for (const nd of src.nodes) {
    const [px, py, pz] = nd.pivot;
    const pos = nd.pos.map((v, i) => v - (i % 3 === 0 ? px : i % 3 === 1 ? py : pz));
    let minY = Infinity;
    for (let i = 1; i < pos.length; i += 3) minY = Math.min(minY, pos[i]);
    const low: V3 = [0, 0, 0];
    let cnt = 0;
    for (let i = 0; i < pos.length; i += 3) {
      if (pos[i + 1] > minY + 0.04) continue;
      low[0] += pos[i];
      low[1] += pos[i + 1];
      low[2] += pos[i + 2];
      cnt++;
    }
    out.set(nd.name, {
      soup: { pos, idx: nd.idx, col: nd.col, glow: new Set(nd.glow) },
      pivot: [px, py, pz],
      tip: cnt ? [low[0] / cnt, low[1] / cnt, low[2] / cnt] : [0, 0, 0],
      parent: nd.parent,
    });
  }
  NODE_CACHE.set(model, out);
  return out;
}

let HEAD: Soup | null = null;
/** Голова огра: треугольники корпуса выше шеи. */
function headSoup(): Soup {
  if (HEAD) return HEAD;
  const body = nodesOf('brute').get('body')!;
  const sp = body.soup;
  const py = body.pivot[1];
  const idx: number[] = [];
  const col: number[] = [];
  const glow = new Set<number>();
  for (let t = 0; t < sp.idx.length / 3; t++) {
    const tri = [sp.idx[t * 3], sp.idx[t * 3 + 1], sp.idx[t * 3 + 2]];
    // выше шеи и без наплечников (они по бокам)
    if (tri.some((i) => sp.pos[i * 3 + 1] + py < BRUTE_NECK || Math.abs(sp.pos[i * 3]) > 0.21)) continue;
    if (sp.glow.has(t)) glow.add(col.length);
    idx.push(...tri);
    col.push(sp.col[t]);
  }
  HEAD = { pos: sp.pos, idx, col, glow };
  return HEAD;
}

/** Названия моделей игры, доступных через prop(). */
export const PROPS = Object.keys(DULO);

/**
 * Любая модель игры DULO целиком, в покое: brute (огр), goblin, alien, tank, oak, pine,
 * rock, bush, grass, tent, campfire, crates, barrel, stump, deadtree, mushrooms, log.
 * tank_evo — только навесные детали эволюции (броня, руны, флаг): рисовать вместе с tank.
 * Масштаб общий (`DULO_SCALE`, как у ogre()), поэтому модели рядом сохраняют игровые
 * пропорции. Стоят на y = 0, перёд — +Z. Метки частей — имена узлов (body, turret, leaves…).
 */
export function prop(name: string, o: { scale?: number } = {}): Part[] {
  const S = DULO_SCALE * (o.scale ?? 1);
  return [...nodesOf(name).entries()].map(([tag, nd]) => ({
    soup: nd.soup,
    pos: sc3(nd.pivot, S),
    size: [S, S, S] as V3,
    tag,
  }));
}

let GRASS: HTMLImageElement | null = null;
/**
 * Текстура травы игры DULO (единственное в прототипе, что сделано не агентом).
 * Картинка грузится асинхронно: пока не загружена — `null`, рисуй без неё.
 */
export function grassTexture(): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  if (!GRASS) {
    GRASS = new Image();
    GRASS.src = new URL('./grass.jpg', import.meta.url).href;
  }
  return GRASS.complete && GRASS.naturalWidth > 0 ? GRASS : null;
}
// начать загрузку сразу, а не на первом кадре сцены
grassTexture();

// ---------------------------------------------------------------- машины игры ArcRace

/** Масштаб машин ArcRace в сценах: машина ≈ 4.5 м становится ≈ 2.4 (как carParts). */
export const ARC_SCALE = 0.53;
/** Машины ArcRace: audi_tt, classic, hatchback, monster, muscle, pickup, sport, van. */
export const ARC_CARS = Object.keys(ARC);

export interface ArcCarOpts {
  /** Перекраска кузова (материал Body_color), hex. */
  paint?: string;
  /** Колёсная база длиннее (+) или короче (−), метры машины. */
  wheelbase?: number;
  /** Фары выше (+) или ниже (−), метры. */
  lights?: number;
  /** Форма крыши 0..1: кабина выше и с завалом назад. */
  roof?: number;
  /** Поворот колёс, рад. */
  spin?: number;
  /** Масштаб (по умолчанию ARC_SCALE). */
  scale?: number;
}

export interface ArcCarInfo {
  /** Центры колёс FL, FR, BL, BR в координатах сцены (после масштаба). */
  wheels: V3[];
  wheelR: number;
  /** Центры левой и правой фары. */
  lights: V3[];
  /** Верхняя кромка крыши: перёд и зад (z = 0). */
  roof: [V3, V3];
}

const ARC_BODY = new Map<string, { soup: Soup; info: Omit<ArcCarInfo, 'wheels' | 'wheelR'> }>();
const ARC_WHEEL = new Map<string, Soup>();

function arcBody(id: string, o: ArcCarOpts): { soup: Soup; info: Omit<ArcCarInfo, 'wheels' | 'wheelR'> } {
  const key = `${id}|${o.paint ?? ''}|${o.lights ?? 0}|${o.roof ?? 0}`;
  const hit = ARC_BODY.get(key);
  if (hit) return hit;
  const car = ARC[id];
  if (!car) throw new Error(`Нет машины ArcRace «${id}»`);
  const b = car.body;
  const pos = b.pos.slice();
  const [y0, y1] = car.bbox.y;
  const roof = clamp01(o.roof ?? 0);
  const roofY = y0 + 0.62 * (y1 - y0);
  if (roof > 0) {
    for (let i = 0; i < pos.length; i += 3) {
      const y = pos[i + 1];
      if (y <= roofY) continue;
      const t = (y - roofY) / (y1 - roofY);
      pos[i + 1] = roofY + (y - roofY) * (1 + 0.45 * roof);
      pos[i] -= 0.35 * roof * t;
    }
  }
  const headMat = b.mats.findIndex((m) => /headlight/i.test(m));
  const headVerts = new Set<number>();
  for (let t = 0; t < b.mat.length; t++) {
    if (b.mat[t] === headMat) for (let k = 0; k < 3; k++) headVerts.add(b.idx[t * 3 + k]);
  }
  if (o.lights) for (const v of headVerts) pos[v * 3 + 1] += o.lights;
  const bodyMat = b.mats.indexOf('Body_color');
  const paint = o.paint ? hexToInt(o.paint) : null;
  const col = paint === null ? b.col : b.col.map((c, t) => (b.mat[t] === bodyMat ? paint : c));

  // точки для маркеров: фары слева/справа, верх крыши
  const side = (sign: number): V3 => {
    const m: V3 = [0, 0, 0];
    let n = 0;
    for (const v of headVerts) {
      if (Math.sign(pos[v * 3 + 2]) !== sign) continue;
      m[0] += pos[v * 3];
      m[1] += pos[v * 3 + 1];
      m[2] += pos[v * 3 + 2];
      n++;
    }
    return n ? [m[0] / n, m[1] / n, m[2] / n] : [car.bbox.x[1], roofY, 0];
  };
  let top = -Infinity;
  for (let i = 1; i < pos.length; i += 3) top = Math.max(top, pos[i]);
  let xMin = Infinity;
  let xMax = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    if (pos[i + 1] < top - 0.06 * (y1 - y0)) continue;
    xMin = Math.min(xMin, pos[i]);
    xMax = Math.max(xMax, pos[i]);
  }
  const out = {
    soup: { pos, idx: b.idx, col, glow: new Set(b.glow) },
    info: { lights: [side(-1), side(1)], roof: [[xMax, top, 0], [xMin, top, 0]] as [V3, V3] },
  };
  ARC_BODY.set(key, out);
  return out;
}

function arcWheel(id: string): Soup {
  const hit = ARC_WHEEL.get(id);
  if (hit) return hit;
  const w = ARC[id].wheel;
  const soup = { pos: w.pos, idx: w.idx, col: w.col, glow: new Set(w.glow) };
  ARC_WHEEL.set(id, soup);
  return soup;
}

/**
 * Машина игры ArcRace (настоящий меш): кузов + 4 колеса на сокетах. Перёд — +X,
 * колёса стоят на y ≈ 0, длина ≈ 2.4 при масштабе по умолчанию. Метки: body, wheel.
 * Вариации (wheelbase, lights, roof) — для «ракурсов, которые не сходятся».
 */
export function arcCar(id: string, o: ArcCarOpts = {}): Part[] {
  const S = o.scale ?? ARC_SCALE;
  const car = ARC[id];
  const { soup } = arcBody(id, o);
  const parts: Part[] = [{ soup, pos: [0, 0, 0], size: [S, S, S], tag: 'body' }];
  const wheel = arcWheel(id);
  const face = car.wheel.face;
  for (const k of ['FL', 'FR', 'BL', 'BR'] as const) {
    const s = car.sockets[k];
    const dx = (k[0] === 'F' ? 1 : -1) * (o.wheelbase ?? 0) / 2;
    // наружная сторона колеса — face; правым колёсам (z > 0) её разворачиваем
    const flip = Math.sign(s.pos[2]) !== Math.sign(face);
    const rot = M.mul(flip ? M.ry(Math.PI) : M.id(), M.rz((flip ? 1 : -1) * (o.spin ?? 0)));
    parts.push({ soup: wheel, pos: [(s.pos[0] + dx) * S, s.pos[1] * S, s.pos[2] * S], size: [S, S, S], rot, tag: 'wheel' });
  }
  return parts;
}

/** Где у машины колёса, фары и крыша (для маркеров и выносок). */
export function arcCarInfo(id: string, o: ArcCarOpts = {}): ArcCarInfo {
  const S = o.scale ?? ARC_SCALE;
  const car = ARC[id];
  const { info } = arcBody(id, o);
  const sc = (v: V3): V3 => [v[0] * S, v[1] * S, v[2] * S];
  return {
    wheels: (['FL', 'FR', 'BL', 'BR'] as const).map((k) => {
      const s = car.sockets[k];
      const dx = (k[0] === 'F' ? 1 : -1) * (o.wheelbase ?? 0) / 2;
      return sc([s.pos[0] + dx, s.pos[1], s.pos[2]]);
    }),
    wheelR: car.sockets.FL.radius * S,
    lights: info.lights.map(sc),
    roof: [sc(info.roof[0]), sc(info.roof[1])],
  };
}

export interface TankOpts {
  /** Не используется: у реального танка свои цвета (оставлено для совместимости). */
  color?: string;
  /** Поворот башни, рад. */
  turret?: number;
  /** Подъём ствола, рад. */
  barrel?: number;
}

/**
 * Танк игры DULO (tank.glb). Длина ≈ 2.4 вдоль X (перёд — +X), гусеницы на y = 0.
 * Метки частей: hull, track, turret, barrel.
 */
export function tankParts(o: TankOpts = {}): Part[] {
  const S = 1.5;
  const T = nodesOf('tank');
  const Rm = M.ry(Math.PI / 2);
  const tr = M.mul(Rm, M.ry(o.turret ?? 0));
  const turretP = sc3(T.get('turret')!.pivot, S);
  const gunP = sc3(T.get('gun1')!.pivot, S);
  const gunRot = M.mul(tr, M.rx(-(o.barrel ?? 0)));
  const gunBase = add3(M.apply(Rm, turretP), M.apply(tr, sub3(gunP, turretP)));
  const parts: Part[] = [];
  for (const [name, nd] of T) {
    const piv = sc3(nd.pivot, S);
    let pos: V3;
    let rot: M3;
    let tag: string;
    if (name === 'turret') {
      pos = M.apply(Rm, piv);
      rot = tr;
      tag = 'turret';
    } else if (name.startsWith('gun')) {
      pos = add3(gunBase, M.apply(gunRot, sub3(piv, gunP)));
      rot = gunRot;
      tag = 'barrel';
    } else {
      pos = M.apply(Rm, piv);
      rot = Rm;
      tag = name.startsWith('track') ? 'track' : 'hull';
    }
    parts.push({ soup: nd.soup, pos, size: [S, S, S], rot, tag });
  }
  return parts;
}

/** Домик: коробка, крыша-пирамида, труба, дверь. Ширина ≈ 1.6. */
export function houseParts(color: string = C.accent): Part[] {
  return [
    box([0, 0.5, 0], [1.6, 1.0, 1.3], color, 'walls'),
    { mesh: MESH.pyramid, pos: [0, 1.3, 0], size: [1.86, 0.6, 1.5], color: CLAY, tag: 'roof' },
    box([0.45, 1.45, -0.25], [0.2, 0.5, 0.2], CLAY, 'chimney'),
    box([0, 0.3, 0.66], [0.36, 0.6, 0.04], DARK, 'door'),
  ];
}

// ---------------------------------------------------------------- огр

/** Поза огра: углы в радианах. Положительный «мах» — конечность вперёд (к +Z). */
export interface OgrePose {
  /** Подскок корпуса. */
  bob: number;
  /** Наклон корпуса вперёд. */
  lean: number;
  /** Поворот корпуса вокруг вертикали. */
  twist: number;
  /** Наклон головы. */
  head: number;
  armL: number;
  armR: number;
  /** Отведение рук в стороны. */
  spreadL: number;
  spreadR: number;
  elbowL: number;
  elbowR: number;
  legL: number;
  legR: number;
  kneeL: number;
  kneeR: number;
  /** Фаза клипа ходьбы (мокап) — для мага; как у gait(): 0.25 — касание левой, 0.75 — правой. */
  walk?: number;
  /** Вес клипа 0..1 (0 — процедурная поза). */
  walkW?: number;
  /** Вес клипа для ног и подъёма корпуса, если отличается (ноги стоят по шагу, верх — своя поза). */
  walkLegW?: number;
  /** «Сбой захвата» правой руки 0..1: рука уходит вверх-в сторону поверх любой позы (s19). */
  glitchArmR?: number;
}

export const IDLE: OgrePose = {
  bob: 0,
  lean: 0.05,
  twist: 0,
  head: 0,
  armL: 0.1,
  armR: 0.1,
  spreadL: 0.18,
  spreadR: 0.18,
  elbowL: 0.35,
  elbowR: 0.35,
  legL: 0,
  legR: 0,
  kneeL: 0.05,
  kneeR: 0.05,
};

export function mixPose(p: OgrePose, q: OgrePose, k: number): OgrePose {
  const o: OgrePose = { ...p };
  for (const key of new Set([...Object.keys(p), ...Object.keys(q)]) as Set<keyof OgrePose>) {
    if (key === 'walk' || key === 'walkW' || key === 'walkLegW') continue;
    // необязательные поля, которых нет у одной из поз, считаются нулём
    o[key] = lerp(p[key] ?? 0, q[key] ?? 0, k);
  }
  // клип ходьбы: вес смешивается, фаза — у того, где клип есть (у обоих — по кратчайшей)
  const wp = p.walkW ?? 0;
  const wq = q.walkW ?? 0;
  const lp = p.walkLegW ?? wp;
  const lq = q.walkLegW ?? wq;
  if (lp !== wp || lq !== wq) o.walkLegW = lerp(lp, lq, k);
  else delete o.walkLegW;
  if (wp > 0 || wq > 0 || lp > 0 || lq > 0) {
    o.walkW = lerp(wp, wq, k);
    if (wp > 0 && wq > 0) {
      const d = (((q.walk! - p.walk!) % 1) + 1.5) % 1 - 0.5;
      o.walk = p.walk! + d * k;
    } else o.walk = wp > 0 ? p.walk : q.walk;
  } else {
    delete o.walk;
    delete o.walkW;
    delete o.walkLegW;
  }
  return o;
}

export type Move = 'idle' | 'walk' | 'attack' | 'hit' | 'death';

/**
 * Поза по типу движения и фазе 0..1 (цикл для idle/walk/attack/hit, для death —
 * однократное падение: фаза 1 = лежит).
 */
export function ogrePose(move: Move, phase: number): OgrePose {
  const ph = phase - Math.floor(phase);
  const w = Math.PI * 2 * ph;
  switch (move) {
    case 'idle':
      return { ...IDLE, bob: Math.sin(w) * 0.02, head: Math.sin(w) * 0.04, elbowL: 0.35 + Math.sin(w) * 0.06, elbowR: 0.35 + Math.sin(w + 0.6) * 0.06 };
    case 'walk': {
      const s = Math.sin(w);
      return {
        ...IDLE,
        bob: Math.abs(Math.cos(w)) * 0.05 - 0.03,
        lean: 0.12,
        twist: s * 0.12,
        armL: -s * 0.35,
        armR: s * 0.35,
        elbowL: 0.45 + Math.max(0, -s) * 0.4,
        elbowR: 0.45 + Math.max(0, s) * 0.4,
        legL: s * 0.55,
        legR: -s * 0.55,
        // колено сгибается у ноги, которая идёт вперёд (перенос), опорная почти прямая
        kneeL: 0.06 + Math.pow(Math.max(0, Math.cos(w)), 1.5) * 0.95,
        kneeR: 0.06 + Math.pow(Math.max(0, -Math.cos(w)), 1.5) * 0.95,
      };
    }
    case 'attack': {
      // как в игре: замах обеими руками над головой (150°) → удар → руки чуть назад → покой
      const up = easeOutQuart(seg(ph, 0, 0.45));
      const slam = seg(ph, 0.45, 0.1);
      const back = seg(ph, 0.72, 0.28);
      const arms = lerp(lerp(IDLE.armL, 2.6, up), -0.5, slam);
      const k = 1 - back;
      return {
        ...IDLE,
        lean: lerp(IDLE.lean, lerp(-0.17, 0.25, slam), k),
        head: -0.1 * up * (1 - slam) * k,
        armL: lerp(IDLE.armL, arms, k),
        armR: lerp(IDLE.armR, arms, k),
        bob: -0.06 * slam * k,
        legL: 0.2 * slam * k,
        legR: -0.1 * slam * k,
      };
    }
    case 'hit': {
      const k = Math.sin(Math.min(1, ph / 0.5) * Math.PI);
      return {
        ...IDLE,
        lean: -0.4 * k,
        head: -0.35 * k,
        armL: -0.5 * k,
        armR: -0.6 * k,
        spreadL: 0.18 + 0.5 * k,
        spreadR: 0.18 + 0.5 * k,
        elbowL: 0.35 + 0.5 * k,
        elbowR: 0.35 + 0.5 * k,
        legL: -0.15 * k,
        kneeL: 0.05 + 0.2 * k,
        kneeR: 0.05 + 0.2 * k,
      };
    }
    case 'death': {
      // как в игре: ноги врозь, руки закинуты за голову, тело оседает
      const k = easeOutQuart(clamp01(phase));
      return {
        ...IDLE,
        bob: -0.45 * k,
        lean: 0,
        head: 0.3 * k,
        armL: lerp(IDLE.armL, 2.8, k),
        armR: lerp(IDLE.armR, 2.6, k),
        spreadL: 0.18 + 0.35 * k,
        spreadR: 0.18 + 0.35 * k,
        legL: 0.3 * k,
        legR: -0.2 * k,
        kneeL: 0.05 + 0.9 * k,
        kneeR: 0.05 + 0.6 * k,
      };
    }
  }
}

/** Длина ноги (от бедра до стопы) в единицах сцены: огр или персонаж из assets. */
export function legLength(kind: 'ogre' | HeroKind = 'ogre'): number {
  const t = kind === 'ogre' ? nodesOf('brute').get('legL')!.tip : HEROES[kind].tips.legL;
  return Math.hypot(t[0], t[1], t[2]) * DULO_SCALE;
}

/** Мах ног в позе ходьбы (как в ogrePose('walk')). */
const WALK_SWING = 0.55;

/**
 * Шаг без проскальзывания. `phase` — непрерывная фаза (1 = цикл из двух шагов). Возвращает
 * позу ходьбы и пройденный путь `dist`: тело уходит вперёд (+Z модели) ровно настолько,
 * насколько опорная нога отходит назад, поэтому опорная стопа стоит на земле. Подскок — из
 * геометрии прямых ног: на краях шага корпус ниже, обе стопы касаются земли.
 * `L` — длина ноги (legLength() × масштаб модели).
 */
export function walkCycle(phase: number, L = legLength('ogre')): { pose: OgrePose; dist: number; stride: number } {
  const A = WALK_SWING;
  const w = Math.PI * 2 * phase;
  const stride = 2 * L * Math.sin(A); // за один шаг (полцикла)
  // опорная нога меняется на краях маха: w = π/2 + nπ
  const n = Math.floor((w - Math.PI / 2) / Math.PI);
  const sign = ((n % 2) + 2) % 2 === 0 ? 1 : -1;
  const fStance = L * Math.sin(A * Math.sin(w) * sign);
  const dist = n * stride + (L * Math.sin(A) - fStance);
  const swing = A * Math.sin(w);
  const base = ogrePose('walk', phase);
  // маг ходит по мокапу (mage_walk.ts) — процедурные ноги остаются для огра
  return { pose: { ...base, legL: swing, legR: -swing, bob: L * (Math.cos(swing) - 1), walk: phase, walkW: 1 }, dist, stride };
}

/** Половина ширины шага (x тазобедренного сустава) в единицах сцены. */
export function hipWidth(kind: 'ogre' | HeroKind = 'ogre'): number {
  const p = kind === 'ogre' ? nodesOf('brute').get('legL')!.pivot : HEROES[kind].pivots.legL;
  return Math.abs(p[0]) * DULO_SCALE;
}

export interface GaitOpts {
  /** Поворот за один шаг, рад (0 — по прямой; ± — налево/направо). */
  turn?: number;
  /** Длина ноги (по умолчанию — огр в масштабе 1). */
  L?: number;
  /** Где стоит и куда смотрит модель в фазе 0: позиция (x, z) и ry. */
  x?: number;
  z?: number;
  heading?: number;
  /** Суставы модели в позе (по умолчанию — огр): стопы берутся из них. */
  joints?: (pose: OgrePose) => Record<Joint, V3>;
  /** Опорная точка ноги (x, z модели) на фазе — вместо стопы из суставов (маг: путь из мокапа). */
  anchor?: (leg: 0 | 1, phase: number) => [number, number];
}

/**
 * Ходьба с поворотами без проскальзывания: в каждом шаге тело поворачивается вокруг
 * опорной стопы, а следующая стопа встаёт туда, куда пришла нога. Возвращает корень модели
 * (позиция и ry) и позу шага. Чистая функция фазы: шаги пересчитываются от фазы 0.
 */
export function gait(phase: number, o: GaitOpts = {}): { root: Root; pose: OgrePose } {
  const L = o.L ?? legLength('ogre');
  const turn = o.turn ?? 0;
  const ph = Math.max(0, phase);
  const { pose } = walkCycle(ph, L);
  const jointsOf = o.joints ?? ((p: OgrePose) => ogre(p).joints);
  // стопа в координатах модели (x, z) — из суставов модели в позе шага этой фазы
  const anchor = o.anchor;
  const foot = (leg: 0 | 1, w: number): [number, number] => {
    if (anchor) return anchor(leg, w / (Math.PI * 2));
    const j = jointsOf(walkCycle(w / (Math.PI * 2), L).pose)[leg === 0 ? 'footL' : 'footR'];
    return [j[0], j[2]];
  };
  const toWorld = (px: number, pz: number, th: number, l: [number, number]): [number, number] => [
    px + l[0] * Math.cos(th) + l[1] * Math.sin(th),
    pz - l[0] * Math.sin(th) + l[1] * Math.cos(th),
  ];
  const w = Math.PI * 2 * ph;
  // шаг n: w от π/2 + nπ до π/2 + (n+1)π; опора — левая при чётном n. Начинаем с шага −1 (w = 0 внутри него).
  const stepOf = (ww: number) => Math.floor((ww - Math.PI / 2) / Math.PI);
  const nNow = stepOf(w);
  let th = o.heading ?? 0;
  let px = o.x ?? 0;
  let pz = o.z ?? 0;
  // состояние в фазе 0: шаг −1, опора — правая
  let stance: 0 | 1 = 1;
  let F = toWorld(px, pz, th, foot(stance, 0));
  let thStart = th - turn * 0.5; // в фазе 0 мы на середине шага −1
  for (let n = -1; n < nNow; n++) {
    const wEnd = Math.PI / 2 + (n + 1) * Math.PI;
    const thEnd = thStart + turn;
    const fl = foot(stance, wEnd);
    // тело в конце шага: опорная стопа на месте
    const c = Math.cos(thEnd);
    const sn = Math.sin(thEnd);
    px = F[0] - (fl[0] * c + fl[1] * sn);
    pz = F[1] - (-fl[0] * sn + fl[1] * c);
    // перенесённая нога встаёт — она опора следующего шага
    stance = stance === 0 ? 1 : 0;
    F = toWorld(px, pz, thEnd, foot(stance, wEnd));
    thStart = thEnd;
  }
  const wStart = Math.PI / 2 + nNow * Math.PI;
  const k = (w - wStart) / Math.PI;
  th = thStart + turn * k;
  const fl = foot(stance, w);
  const c = Math.cos(th);
  const sn = Math.sin(th);
  px = F[0] - (fl[0] * c + fl[1] * sn);
  pz = F[1] - (-fl[0] * sn + fl[1] * c);
  return { root: { pos: [px, 0, pz], ry: th }, pose };
}

/** Пройденный путь по прямой точно по опорной стопе (из gait), в единицах огра масштаба 1. */
export function walkDist(phase: number): number {
  return gait(Math.max(0, phase)).root.pos![2];
}

const CIRCLE_CENTERS = new Map<string, [number, number]>();

/**
 * Ходьба по кругу без проскальзывания (gait), путь отцентрирован в (x, z). Фаза ≤ 0 — модель
 * стоит в начале пути (walking = false: рисовать idle) — поэтому старт ходьбы без скачка.
 */
export function circleGait(
  phase: number,
  o: { turn?: number; heading?: number; x?: number; z?: number; who?: 'ogre' | 'mage'; fromIdle?: boolean } = {},
): { root: Root; pose: OgrePose; walking: boolean } {
  // маг с места: шаг клипа с фазы WALK_START (правая стопа под корпусом), курс — как стоял
  const start = o.who === 'mage' && o.fromIdle ? WALK_START : 0;
  let heading = o.heading ?? 0;
  if (start) heading -= (gait(start, { turn: o.turn ?? -0.8, heading: 0, ...MAGE_GAIT }).root.ry ?? 0);
  const opts: GaitOpts = { turn: o.turn ?? -0.8, heading, ...(o.who === 'mage' ? MAGE_GAIT : {}) };
  const key = `${opts.turn}|${opts.heading}|${o.who ?? 'ogre'}`;
  let c = CIRCLE_CENTERS.get(key);
  if (!c) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (let i = 0; i < 300; i++) {
      const r = gait(i * 0.1, opts).root.pos!;
      x0 = Math.min(x0, r[0]);
      x1 = Math.max(x1, r[0]);
      z0 = Math.min(z0, r[2]);
      z1 = Math.max(z1, r[2]);
    }
    c = [(x0 + x1) / 2, (z0 + z1) / 2];
    CIRCLE_CENTERS.set(key, c);
  }
  const ph = start ? walkRamp(phase) : Math.max(0, phase);
  const g = gait(start + ph, opts);
  const p = g.root.pos!;
  // с места: поза входит в шаг за первую четверть цикла (до этого — стойка)
  const pose = start ? (phase <= 0 ? IDLE : mixPose(IDLE, g.pose, easeInOutCubic(clamp01(phase / 0.25)))) : g.pose;
  return {
    root: { pos: [p[0] - c[0] + (o.x ?? 0), 0, p[2] - c[1] + (o.z ?? 0)], ry: g.root.ry },
    pose,
    walking: phase > 0,
  };
}

/**
 * Ходьба туда-обратно по полосе шириной `span` вдоль X (для карточек): путь — из шага,
 * у краёв полосы модель гаснет и появляется с другой стороны. Возвращает x и прозрачность.
 */
export function laneWalk(phase: number, span = 3): { x: number; z: number; alpha: number; pose: OgrePose } {
  // путь вдоль +X точно по опорной стопе (с лёгким боковым покачиванием таза)
  const g = gait(Math.max(0, phase), { heading: Math.PI / 2 });
  const p = g.root.pos!;
  const u = ((p[0] % span) + span) % span;
  const x = u - span / 2;
  return { x, z: p[2], alpha: clamp01((span / 2 - Math.abs(x)) / 0.35), pose: g.pose };
}

/** Наклон всей фигуры при падении (death): применять как `root.rx`. */
export const deathTilt = (phase: number) => -1.45 * easeOutQuart(clamp01((phase - 0.15) / 0.85));

export type Joint =
  | 'pelvis'
  | 'chest'
  | 'neck'
  | 'head'
  | 'shoulderL'
  | 'elbowL'
  | 'handL'
  | 'shoulderR'
  | 'elbowR'
  | 'handR'
  | 'hipL'
  | 'kneeL'
  | 'footL'
  | 'hipR'
  | 'kneeR'
  | 'footR';

/** Кости огра: пары суставов (родитель → потомок). */
export const OGRE_BONES: Array<[Joint, Joint]> = [
  ['pelvis', 'chest'],
  ['chest', 'neck'],
  ['neck', 'head'],
  ['chest', 'shoulderL'],
  ['shoulderL', 'elbowL'],
  ['elbowL', 'handL'],
  ['chest', 'shoulderR'],
  ['shoulderR', 'elbowR'],
  ['elbowR', 'handR'],
  ['pelvis', 'hipL'],
  ['hipL', 'kneeL'],
  ['kneeL', 'footL'],
  ['pelvis', 'hipR'],
  ['hipR', 'kneeR'],
  ['kneeR', 'footR'],
];

export interface OgreOpts {
  color?: string;
  /** Вместо гладкого тела — грубые кубы-примитивы (первый прототип). */
  blocky?: boolean;
  /** Показать только голову. */
  headOnly?: boolean;
}

export interface OgreModel {
  parts: Part[];
  joints: Record<Joint, V3>;
}

/** Направление «вниз», повёрнутое махом (вокруг X) и отведением (вокруг Z). */
function limbRot(swing: number, spread: number, side: number): M3 {
  return M.mul(M.rz(spread * side), M.rx(-swing));
}

/** Масштаб моделей игры в сценах: огр (рост 1.0 в игре) становится ростом 2.2. */
export const DULO_SCALE = 2.2;
/** Высота шеи огра в единицах игры: выше — голова (для headOnly). */
const BRUTE_NECK = 0.74;

/**
 * Огр игры DULO (brute.glb) ростом ≈ 2.2, ступни на y = 0, лицом к +Z.
 * Части жёсткие, как в игре: body, armL (на +X), armR, legL, legR — поворачиваются
 * вокруг точек крепления. Суставы (для drawBones) идут вдоль этих частей.
 * `blocky` — прототип из кубов-примитивов (до реальной модели).
 */
export function ogre(pose: OgrePose = IDLE, o: OgreOpts = {}): OgreModel {
  if (o.blocky) return ogreProcedural(pose, o);
  const S = DULO_SCALE;
  const B = nodesOf('brute');
  const body = B.get('body')!;
  const bodyRest = sc3(body.pivot, S);
  const bodyP = add3(bodyRest, [0, pose.bob, 0]);
  const Rb = M.mul(M.ry(pose.twist), M.rx(pose.lean));
  const onBody = (v: V3): V3 => add3(bodyP, M.apply(Rb, sub3(v, bodyRest)));
  const parts: Part[] = [];

  if (o.headOnly) {
    parts.push({ soup: headSoup(), pos: bodyP, size: [S, S, S], rot: Rb, tag: 'head' });
  } else {
    parts.push({ soup: body.soup, pos: bodyP, size: [S, S, S], rot: Rb, tag: 'body' });
  }

  const joints = {} as Record<Joint, V3>;
  joints.pelvis = onBody(add3(bodyRest, [0, 0.06 * S, 0]));
  joints.chest = onBody([0, 0.56 * S, 0.02 * S]);
  joints.neck = onBody([0, 0.74 * S, 0.06 * S]);
  joints.head = onBody([0, 0.9 * S, 0.08 * S]);

  // руки: крепятся к корпусу; мах вперёд — к +Z, разведение — наружу
  for (const [sfx, side] of [
    ['L', 1],
    ['R', -1],
  ] as const) {
    const nd = B.get(`arm${sfx}`)!;
    const swing = (sfx === 'L' ? pose.armL : pose.armR) - IDLE.armL;
    const spread = (sfx === 'L' ? pose.spreadL : pose.spreadR) - IDLE.spreadL;
    const sh = onBody(sc3(nd.pivot, S));
    const Ra = M.chain(Rb, M.rz(spread * side), M.rx(-swing));
    if (!o.headOnly) parts.push({ soup: nd.soup, pos: sh, size: [S, S, S], rot: Ra, tag: `arm${sfx}` });
    const tip = sc3(nd.tip, S);
    joints[`shoulder${sfx}` as Joint] = sh;
    joints[`elbow${sfx}` as Joint] = add3(sh, M.apply(Ra, [tip[0] * 0.5, tip[1] * 0.5, tip[2] * 0.5]));
    joints[`hand${sfx}` as Joint] = add3(sh, M.apply(Ra, tip));
  }

  // ноги: ходят вместе с подскоком корпуса, но наклон корпуса не наследуют
  for (const [sfx, side] of [
    ['L', 1],
    ['R', -1],
  ] as const) {
    const nd = B.get(`leg${sfx}`)!;
    const swing = sfx === 'L' ? pose.legL : pose.legR;
    const splay = Math.max(0, (sfx === 'L' ? pose.kneeL : pose.kneeR) - 0.05) * 0.25 * (pose.bob < -0.2 ? 1 : 0);
    const hip = add3(sc3(nd.pivot, S), [0, pose.bob, 0]);
    const Rl = M.chain(M.ry(pose.twist * 0.5), M.rz(splay * side), M.rx(-swing));
    if (!o.headOnly) parts.push({ soup: nd.soup, pos: hip, size: [S, S, S], rot: Rl, tag: `leg${sfx}` });
    const tip = sc3(nd.tip, S);
    joints[`hip${sfx}` as Joint] = hip;
    joints[`knee${sfx}` as Joint] = add3(hip, M.apply(Rl, [tip[0] * 0.5, tip[1] * 0.5, tip[2] * 0.5]));
    joints[`foot${sfx}` as Joint] = add3(hip, M.apply(Rl, tip));
  }
  return { parts, joints };
}

// ---------------------------------------------------------------- эльф и волшебник (assets)

export type HeroKind = 'elf' | 'wizard';
/** Персонажи из PresBuilder/assets: модели Tripo, раскрашенные по концептам. */
export const HERO_KINDS: HeroKind[] = ['elf', 'wizard'];

const HERO_SOUP = new Map<string, Soup>();
function heroSoup(kind: HeroKind, part: keyof HeroData['parts']): Soup {
  const key = `${kind}:${part}`;
  const hit = HERO_SOUP.get(key);
  if (hit) return hit;
  const h = HEROES[kind];
  const src = h.parts[part];
  const cols = h.colors.map(hexToInt);
  const soup: Soup = { pos: src.pos, idx: src.idx, col: src.col.map((i) => cols[i]), glow: new Set() };
  HERO_SOUP.set(key, soup);
  return soup;
}

export interface HeroOpts {
  /** Руки в стороны, как на концепте (по умолчанию руки опущены). */
  tpose?: boolean;
}

/**
 * Эльф или волшебник ростом ≈ 2.2 (как ogre), ступни на y = 0, лицом к +Z. Те же позы
 * (ogrePose, mixPose, deathTilt) и суставы для drawBones. Части жёсткие: body, armL (на +X),
 * armR, legL, legR. Цвета — по концептам assets/*.webp.
 */
export function hero(kind: HeroKind, pose: OgrePose = IDLE, o: HeroOpts = {}): OgreModel {
  const S = DULO_SCALE;
  const H = HEROES[kind];
  const bodyRest = sc3(H.pivots.body, S);
  const bodyP = add3(bodyRest, [0, pose.bob, 0]);
  const Rb = M.mul(M.ry(pose.twist), M.rx(pose.lean));
  const onBody = (v: V3): V3 => add3(bodyP, M.apply(Rb, sub3(v, bodyRest)));
  const parts: Part[] = [{ soup: heroSoup(kind, 'body'), pos: bodyP, size: [S, S, S], rot: Rb, tag: 'body' }];

  const joints = {} as Record<Joint, V3>;
  joints.pelvis = onBody(add3(bodyRest, [0, 0.03 * S, 0]));
  joints.chest = onBody([0, 0.5 * S, 0]);
  joints.neck = onBody([0, 0.64 * S, 0]);
  joints.head = onBody([0, 0.8 * S, 0]);

  // руки смоделированы в T-позе: опускаем их поворотом вокруг Z, мах вперёд — вокруг X
  const hang = o.tpose ? 0 : 1.32;
  for (const [sfx, side] of [
    ['L', 1],
    ['R', -1],
  ] as const) {
    const part = `arm${sfx}` as const;
    const swing = (sfx === 'L' ? pose.armL : pose.armR) - IDLE.armL;
    const spread = (sfx === 'L' ? pose.spreadL : pose.spreadR) - IDLE.spreadL;
    const sh = onBody(sc3(H.pivots[part], S));
    const Ra = M.chain(Rb, M.rx(-swing), M.rz(-side * (hang - spread)));
    parts.push({ soup: heroSoup(kind, part), pos: sh, size: [S, S, S], rot: Ra, tag: part });
    const tip = sc3(H.tips[part], S);
    joints[`shoulder${sfx}` as Joint] = sh;
    joints[`elbow${sfx}` as Joint] = add3(sh, M.apply(Ra, sc3(tip, 0.5)));
    joints[`hand${sfx}` as Joint] = add3(sh, M.apply(Ra, tip));
  }

  for (const sfx of ['L', 'R'] as const) {
    const part = `leg${sfx}` as const;
    const swing = sfx === 'L' ? pose.legL : pose.legR;
    const hip = add3(sc3(H.pivots[part], S), [0, pose.bob, 0]);
    const Rl = M.mul(M.ry(pose.twist * 0.5), M.rx(-swing));
    parts.push({ soup: heroSoup(kind, part), pos: hip, size: [S, S, S], rot: Rl, tag: part });
    const tip = sc3(H.tips[part], S);
    joints[`hip${sfx}` as Joint] = hip;
    joints[`knee${sfx}` as Joint] = add3(hip, M.apply(Rl, sc3(tip, 0.5)));
    joints[`foot${sfx}` as Joint] = add3(hip, M.apply(Rl, tip));
  }
  return { parts, joints };
}

/**
 * Мелкие детали силуэта персонажа (то, что съедает грубая оптимизация), в координатах
 * модели hero() в покое: у эльфа — кончики ушей, у волшебника — кончик шляпы и края полей.
 */
export function heroDetails(kind: HeroKind): V3[] {
  const H = HEROES[kind];
  const b = H.parts.body;
  const pv = H.pivots.body;
  const pts: V3[] = [];
  for (let i = 0; i < b.pos.length; i += 3) pts.push([b.pos[i] + pv[0], b.pos[i + 1] + pv[1], b.pos[i + 2] + pv[2]]);
  const S = DULO_SCALE;
  if (kind === 'elf') {
    const head = pts.filter((p) => p[1] > 0.68 && p[1] < 0.86);
    const right = head.reduce((m, p) => (p[0] > m[0] ? p : m));
    const left = head.reduce((m, p) => (p[0] < m[0] ? p : m));
    return [sc3(right, S), sc3(left, S)];
  }
  const top = pts.reduce((m, p) => (p[1] > m[1] ? p : m));
  return [sc3(top, S)];
}

const CONCEPTS = new Map<HeroKind, HTMLImageElement>();
/**
 * Концепт персонажа (assets/*.webp: 1280×956, серый фон, T-поза). Грузится асинхронно:
 * пока не загружен — `null`.
 */
export function conceptImage(kind: HeroKind): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  let img = CONCEPTS.get(kind);
  if (!img) {
    img = new Image();
    img.src = kind === 'elf' ? new URL('./concept_elf.webp', import.meta.url).href : new URL('./concept_wizard.webp', import.meta.url).href;
    CONCEPTS.set(kind, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}
conceptImage('elf');
conceptImage('wizard');

/** Нарисовать концепт в прямоугольник (обрезка по центру, без искажений). */
export function drawConcept(ctx: Ctx, kind: HeroKind, r: Rect, zoom = 1): void {
  const img = conceptImage(kind);
  if (!img) return;
  const k = Math.max(r.w / img.naturalWidth, r.h / img.naturalHeight) * zoom;
  const w = img.naturalWidth * k;
  const h = img.naturalHeight * k;
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.drawImage(img, r.x + (r.w - w) / 2, r.y + (r.h - h) / 2, w, h);
  ctx.restore();
}

// ---------------------------------------------------------------- маг (assets/5k model.fbx): риг и скиннинг

/** Минимальный поворот, переводящий единичный вектор a в b. */
function alignRot(a: V3, b: V3): M3 {
  const v = cross3(a, b);
  const c = dot3(a, b);
  if (c < -0.9999) return M.rx(Math.PI);
  const k = 1 / (1 + c);
  return [
    v[0] * v[0] * k + c, v[0] * v[1] * k - v[2], v[0] * v[2] * k + v[1],
    v[1] * v[0] * k + v[2], v[1] * v[1] * k + c, v[1] * v[2] * k - v[0],
    v[2] * v[0] * k - v[1], v[2] * v[1] * k + v[0], v[2] * v[2] * k + c,
  ];
}
const transpose = (m: M3): M3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
const DOWN: V3 = [0, -1, 0];

type Q4 = [number, number, number, number];
function m3q(m: M3): Q4 {
  const t = m[0] + m[4] + m[8];
  let q: Q4;
  if (t > 0) {
    const s = Math.sqrt(t + 1) * 2;
    q = [(m[7] - m[5]) / s, (m[2] - m[6]) / s, (m[3] - m[1]) / s, 0.25 * s];
  } else if (m[0] > m[4] && m[0] > m[8]) {
    const s = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2;
    q = [0.25 * s, (m[1] + m[3]) / s, (m[2] + m[6]) / s, (m[7] - m[5]) / s];
  } else if (m[4] > m[8]) {
    const s = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2;
    q = [(m[1] + m[3]) / s, 0.25 * s, (m[5] + m[7]) / s, (m[2] - m[6]) / s];
  } else {
    const s = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2;
    q = [(m[2] + m[6]) / s, (m[5] + m[7]) / s, 0.25 * s, (m[3] - m[1]) / s];
  }
  return q;
}
function qm3([x, y, z, w]: Q4): M3 {
  const l = x * x + y * y + z * z + w * w || 1;
  const k = 2 / l;
  return [
    1 - k * (y * y + z * z), k * (x * y - z * w), k * (x * z + y * w),
    k * (x * y + z * w), 1 - k * (x * x + z * z), k * (y * z - x * w),
    k * (x * z - y * w), k * (y * z + x * w), 1 - k * (x * x + y * y),
  ];
}
/** Смешивание поворотов (nlerp кватернионов по кратчайшей). */
function qmix(p: Q4, q: Q4, t: number): Q4 {
  const d = p[0] * q[0] + p[1] * q[1] + p[2] * q[2] + p[3] * q[3];
  const s = d < 0 ? -1 : 1;
  const r: Q4 = [p[0] + (s * q[0] - p[0]) * t, p[1] + (s * q[1] - p[1]) * t, p[2] + (s * q[2] - p[2]) * t, p[3] + (s * q[3] - p[3]) * t];
  const l = Math.hypot(r[0], r[1], r[2], r[3]) || 1;
  return [r[0] / l, r[1] / l, r[2] / l, r[3] / l];
}

/** Кости ног и таза — для отдельного веса клипа (walkLegW). */
const LEG_BONES = new Set(['hips', 'thigh.L', 'shin.L', 'foot.L', 'thigh.R', 'shin.R', 'foot.R']);

/** Фаза клипа, с которой маг начинает идти с места: правая стопа под корпусом, левая оторвалась. */
export const WALK_START = 0.95;
/** Разгон с места: скорость фазы растёт от нуля за первые `a` цикла (положение и скорость без скачков). */
export const walkRamp = (p: number, a = 0.3): number => (p <= 0 ? 0 : p < a ? (p * p) / (2 * a) : p - a / 2);

/**
 * Клип ходьбы мага (см. mage_walk.ts): основной — мокап CMU 35_01; есть ещё цикл по видео Seedance
 * (MAGE_WALK_NAME = 'seedance', для него WALK_START = 0.04 и Q0 = 0.04 в s18).
 */
const MAGE_WALK_NAME = '35_01';
let WALK = MAGE_WALKS[MAGE_WALK_NAME];
/** Выбор клипа ходьбы мага (для сравнения вариантов). */
export function setMageWalk(name: string): void {
  WALK = MAGE_WALKS[name] ?? WALK;
  ANCHOR_K = null;
}
/** Длительность цикла шага в записи мокапа, сек (естественный темп: 1 / cycle фаз в секунду). */
export const mageWalkCycle = () => WALK.cycle;
/** Фаза клипа seedance в кадре видео Seedance (кадр 0 — первый): поза мага совпадает с кадром. */
export const seedancePhase = (frame: number): number => {
  const v = MAGE_WALKS.seedance.video!;
  return v.phase0 + frame / v.period;
};
/** Путь корпуса по клипу (x, z в единицах сцены) на непрерывной фазе: за цикл — длина цикла вперёд. */
function walkRoot(u: number): [number, number] {
  const n = WALK.n;
  const c = Math.floor(u);
  const x = (u - c) * n;
  const i0 = Math.floor(x);
  const t = x - i0;
  const r = WALK.root;
  const at = (i: number): [number, number] => (i < n ? [r[i * 2], r[i * 2 + 1]] : [r[0], r[1] + WALK.stride]);
  const p0 = at(i0);
  const p1 = at(i0 + 1);
  return [lerp(p0[0], p1[0], t) * DULO_SCALE, (lerp(p0[1], p1[1], t) + c * WALK.stride) * DULO_SCALE];
}
let ANCHOR_K: [[number, number], [number, number]] | null = null;
/**
 * Опора шага мага для gait(): точка в координатах модели (x, z), неподвижная в мире, пока нога
 * стоит. Корпус идёт по пути из записи, ноги — по IK к щиколоткам записи, поэтому опора — это
 * щиколотка в середине стойки, сдвинутая назад ровно на путь корпуса.
 */
export function mageAnchor(leg: 0 | 1, phase: number): [number, number] {
  if (!ANCHOR_K) {
    const k = (lg: 0 | 1, um: number): [number, number] => {
      const j = mage(walkCycle(um).pose, { jointsOnly: true }).joints[lg === 0 ? 'footL' : 'footR'];
      const d = walkRoot(um);
      return [j[0] + d[0], j[2] + d[1]];
    };
    ANCHOR_K = [k(0, 0.5), k(1, 1.0)];
  }
  // окно фазы ноги: стойка левой — [0.25, 0.75), правой — [0.75, 1.25)
  const u = leg === 0 ? phase - Math.floor(phase) : phase - Math.floor(phase - 0.5);
  const d = walkRoot(u);
  const K = ANCHOR_K[leg];
  return [K[0] - d[0], K[1] - d[1]];
}

/** Поза клипа в фазе: повороты костей (порядок MAGE.bones) и подъём корпуса. */
function walkSample(phase: number): { q: Q4[]; bob: number } {
  const n = WALK.n;
  const u = (((phase % 1) + 1) % 1) * n;
  const i0 = Math.floor(u) % n;
  const i1 = (i0 + 1) % n;
  const t = u - Math.floor(u);
  const nb = MAGE.bones.length;
  const q: Q4[] = [];
  for (let b = 0; b < nb; b++) {
    const o0 = (i0 * nb + b) * 4;
    const o1 = (i1 * nb + b) * 4;
    const w = WALK.q;
    q.push(qmix([w[o0], w[o0 + 1], w[o0 + 2], w[o0 + 3]], [w[o1], w[o1 + 1], w[o1 + 2], w[o1 + 3]], t));
  }
  return { q, bob: lerp(WALK.bob[i0], WALK.bob[i1], t) };
}

interface MageLodCache {
  base: Soup;
  /** Веса: на вершину до 4 пар (кость, вес). */
  wb: Int32Array;
  ww: Float32Array;
  wn: Uint8Array;
  dom: Int16Array;
}
/** Цвета, которые не чистим: кожа (кончики пальцев — мелкие пятна) и свиток. */
const MAGE_KEEP = new Set([0xd9a189, 0xdcc79c]);
/** Белое свечение глаз с концепта легло на рот и подбородок — убирается целиком, любого размера. */
const MAGE_DROP = new Set([0xf4ecff]);

/**
 * Раскраска по концепту даёт «крошку»: руны и потёртости ложатся на сетку отдельными
 * треугольниками и квадами, на экране это выглядит как битая геометрия. Пятна одного цвета
 * не больше `maxN` треугольников перекрашиваются в цвет, которым они окружены (и перестают светиться).
 */
function cleanSpeckles(idx: number[], col0: number[], glow0: number[], maxN: number): { col: number[]; glow: Set<number> } {
  const nt = idx.length / 3;
  const nb: number[][] = Array.from({ length: nt }, () => []);
  const edge = new Map<string, number>();
  for (let t = 0; t < nt; t++) {
    for (let e = 0; e < 3; e++) {
      const p = idx[t * 3 + e];
      const q = idx[t * 3 + ((e + 1) % 3)];
      const key = p < q ? `${p}:${q}` : `${q}:${p}`;
      const o = edge.get(key);
      if (o === undefined) edge.set(key, t);
      else {
        nb[t].push(o);
        nb[o].push(t);
      }
    }
  }
  const col = col0.slice();
  const glow = new Set(glow0);
  for (let pass = 0; pass < 2; pass++) {
    const seen = new Uint8Array(nt);
    for (let t = 0; t < nt; t++) {
      if (seen[t]) continue;
      const c = col[t];
      const mem = [t];
      seen[t] = 1;
      for (let i = 0; i < mem.length; i++) {
        for (const n of nb[mem[i]]) {
          if (!seen[n] && col[n] === c) {
            seen[n] = 1;
            mem.push(n);
          }
        }
      }
      if ((mem.length > maxN && !MAGE_DROP.has(c)) || MAGE_KEEP.has(c)) continue;
      const around = new Map<number, number>();
      for (const u of mem) for (const n of nb[u]) if (col[n] !== c) around.set(col[n], (around.get(col[n]) ?? 0) + 1);
      let best = c;
      let bn = 0;
      for (const [cc, n] of around) if (n > bn) [best, bn] = [cc, n];
      for (const u of mem) {
        col[u] = best;
        glow.delete(u);
      }
    }
  }
  return { col, glow };
}

/** Кости стоп: подошва ниже щиколотки следует только за стопой (иначе голень «тянет» стоящую подошву). */
const FOOT_BONES =new Set(['foot.L', 'foot.R'].map((nm) => MAGE.bones.findIndex((x) => x.name === nm)));
const MAGE_LODS: MageLodCache[] = MAGE.lods.map((l) => {
  const n = l.pos.length / 3;
  const wb = new Int32Array(n * 4);
  const ww = new Float32Array(n * 4);
  const wn = new Uint8Array(n);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const c = l.weights[k++];
    wn[i] = c;
    for (let j = 0; j < c; j++) {
      wb[i * 4 + j] = l.weights[k++];
      ww[i * 4 + j] = l.weights[k++];
    }
    // ниже 0.045 — только стопа, до 0.075 — плавный переход к весам из Blender
    let fj = -1;
    for (let j = 0; j < c; j++) if (FOOT_BONES.has(wb[i * 4 + j])) fj = j;
    const y = l.pos[i * 3 + 1];
    if (fj >= 0 && y < 0.075) {
      const wf = ww[i * 4 + fj];
      const nf = Math.max(wf, clamp01((0.075 - y) / 0.03));
      const rest = 1 - wf;
      for (let j = 0; j < c; j++) ww[i * 4 + j] = j === fj ? nf : rest > 0 ? (ww[i * 4 + j] * (1 - nf)) / rest : 0;
    }
  }
  // главная кость каждого треугольника — для выборки части тела
  const dom = new Int16Array(l.idx.length / 3);
  for (let t = 0; t < dom.length; t++) {
    const acc = new Map<number, number>();
    for (let k = 0; k < 3; k++) {
      const v = l.idx[t * 3 + k];
      for (let j = 0; j < wn[v]; j++) acc.set(wb[v * 4 + j], (acc.get(wb[v * 4 + j]) ?? 0) + ww[v * 4 + j]);
    }
    let best = 0;
    let bw = -1;
    for (const [b, w] of acc) if (w > bw) [best, bw] = [b, w];
    dom[t] = best;
  }
  const clean = cleanSpeckles(l.idx, l.col, l.glow, Math.max(2, Math.round((10 * l.idx.length) / MAGE.lods[0].idx.length)));
  return { base: { pos: l.pos, idx: l.idx, col: clean.col, glow: clean.glow, mask: l.mask, welded: true }, wb, ww, wn, dom };
});
const MB = MAGE.bones;
const MBI = new Map(MB.map((b, i) => [b.name, i]));
const restDir = (name: string): V3 => {
  const b = MB[MBI.get(name)!];
  return unit3(sub3(b.tail as V3, b.head as V3));
};
/** Поворот «вниз → кость в покое» для конечностей: поза задаётся от опущенной вниз руки/ноги. */
const MAGE_REST = new Map<string, M3>(
  ['upper_arm', 'forearm', 'hand', 'thigh', 'shin', 'foot'].flatMap((n) =>
    ['L', 'R'].map((sx) => [`${n}.${sx}`, alignRot(DOWN, restDir(`${n}.${sx}`))] as [string, M3]),
  ),
);

/** Длина ноги мага (бедро → стопа) в единицах сцены — для шага без проскальзывания. */
export function mageLegLength(scale = 1): number {
  const j = MAGE.joints;
  return Math.hypot(j.hipL[0] - j.footL[0], j.hipL[1] - j.footL[1], j.hipL[2] - j.footL[2]) * DULO_SCALE * scale;
}

export interface MageOpts {
  /** 0 — полная сетка, 1 и 2 — упрощённые (LOD). */
  lod?: 0 | 1 | 2;
  /** Руки как в модели (A-поза), без позы. */
  rest?: boolean;
  /** Только суставы, без деформации сетки (для расчёта шага). */
  jointsOnly?: boolean;
  /** Только треугольники, которыми управляют эти кости (подсветка руки и т.п.). */
  only?: string[];
}

/**
 * Маг из assets: настоящая сетка со скелетом и весами (скиннинг), ростом ≈ 2.2, ступни на
 * y = 0, лицом к +Z. Позы — те же ogrePose/mixPose/gait, локти и колени гнутся по-настоящему.
 * Возвращает одну часть (деформированную сетку) и суставы для drawBones / gait.
 */
export function mage(pose: OgrePose = IDLE, o: MageOpts = {}): OgreModel {
  const S = DULO_SCALE;
  const L = MAGE_LODS[o.lod ?? 0];
  let bob = pose.bob / S;
  const tw = pose.twist;
  const Rh = M.ry(tw * 0.5);
  const Rs = M.mul(M.ry(tw), M.rx(pose.lean));
  const W = new Map<string, M3>();
  W.set('hips', Rh);
  W.set('spine', Rs);
  W.set('chest', Rs);
  W.set('neck', Rs);
  W.set('head', M.mul(Rs, M.rx(pose.head)));
  for (const [sx, side] of [
    ['L', 1],
    ['R', -1],
  ] as const) {
    W.set(`shoulder.${sx}`, Rs);
    if (o.rest) {
      for (const n of ['upper_arm', 'forearm', 'hand']) W.set(`${n}.${sx}`, Rs);
      for (const n of ['thigh', 'shin', 'foot']) W.set(`${n}.${sx}`, Rh);
      continue;
    }
    const swing = sx === 'L' ? pose.armL : pose.armR;
    const spread = sx === 'L' ? pose.spreadL : pose.spreadR;
    const bend = sx === 'L' ? pose.elbowL : pose.elbowR;
    const Rdd = M.mul(M.rz(spread * side), M.rx(-swing));
    W.set(`upper_arm.${sx}`, M.chain(Rs, Rdd, transpose(MAGE_REST.get(`upper_arm.${sx}`)!)));
    const Rf = M.chain(Rs, Rdd, M.rx(-bend), transpose(MAGE_REST.get(`forearm.${sx}`)!));
    W.set(`forearm.${sx}`, Rf);
    W.set(`hand.${sx}`, Rf);
    const lsw = sx === 'L' ? pose.legL : pose.legR;
    const kb = sx === 'L' ? pose.kneeL : pose.kneeR;
    W.set(`thigh.${sx}`, M.chain(Rh, M.rx(-lsw), transpose(MAGE_REST.get(`thigh.${sx}`)!)));
    const Rsh = M.chain(Rh, M.rx(-lsw), M.rx(kb), transpose(MAGE_REST.get(`shin.${sx}`)!));
    W.set(`shin.${sx}`, Rsh);
    // стопа держит ровный пол
    W.set(`foot.${sx}`, Rh);
  }
  // мокап: повороты костей из клипа ходьбы, с весом walkW поверх процедурной позы
  const ww = o.rest ? 0 : clamp01(pose.walkW ?? 0);
  const wl = o.rest ? 0 : clamp01(pose.walkLegW ?? ww);
  if (ww > 0 || wl > 0) {
    const c = walkSample(pose.walk ?? 0);
    MB.forEach((b, i) => {
      const w = LEG_BONES.has(b.name) ? wl : ww;
      if (w <= 0) return;
      const cq = c.q[i];
      W.set(b.name, w >= 1 ? qm3(cq) : qm3(qmix(m3q(W.get(b.name) ?? M.id()), cq, w)));
    });
    bob = lerp(bob, c.bob, wl);
  }
  const ga = o.rest ? 0 : clamp01(pose.glitchArmR ?? 0);
  if (ga > 0) {
    const E = M.mul(M.rz(-1.35 * ga), M.rx(1.0 * ga));
    for (const n of ['upper_arm.R', 'forearm.R', 'hand.R']) W.set(n, M.mul(E, W.get(n) ?? M.id()));
  }
  // головы костей: от корня по иерархии
  const head = new Map<string, V3>();
  const rot: M3[] = [];
  const hd: V3[] = [];
  const rest: V3[] = [];
  MB.forEach((b, i) => {
    const R = W.get(b.name) ?? M.id();
    let h: V3;
    if (!b.parent) h = [b.head[0], b.head[1] + bob, b.head[2]];
    else {
      const pb = MB[MBI.get(b.parent)!];
      const pr = W.get(pb.name) ?? M.id();
      h = add3(head.get(pb.name)!, M.apply(pr, sub3(b.head as V3, pb.head as V3)));
    }
    head.set(b.name, h);
    rot[i] = R;
    hd[i] = h;
    rest[i] = b.head as V3;
  });
  const sc = (v: V3): V3 => sc3(v, S);
  const tailOf = (name: string): V3 => {
    const i = MBI.get(name)!;
    return add3(hd[i], M.apply(rot[i], sub3(MB[i].tail as V3, MB[i].head as V3)));
  };
  const joints = {
    pelvis: sc(head.get('spine')!),
    chest: sc(head.get('chest')!),
    neck: sc(head.get('neck')!),
    head: sc(head.get('head')!),
    shoulderL: sc(head.get('upper_arm.L')!),
    elbowL: sc(head.get('forearm.L')!),
    handL: sc(head.get('hand.L')!),
    shoulderR: sc(head.get('upper_arm.R')!),
    elbowR: sc(head.get('forearm.R')!),
    handR: sc(head.get('hand.R')!),
    hipL: sc(head.get('thigh.L')!),
    kneeL: sc(head.get('shin.L')!),
    footL: sc(tailOf('shin.L')),
    hipR: sc(head.get('thigh.R')!),
    kneeR: sc(head.get('shin.R')!),
    footR: sc(tailOf('shin.R')),
  } as Record<Joint, V3>;
  if (o.jointsOnly) return { parts: [], joints };
  // скиннинг: v' = Σ w (H_b + R_b (v − rest_b))
  const src = L.base.pos;
  const n = src.length / 3;
  const pos = new Array<number>(src.length);
  for (let i = 0; i < n; i++) {
    const x = src[i * 3];
    const y = src[i * 3 + 1];
    const z = src[i * 3 + 2];
    let ox = 0;
    let oy = 0;
    let oz = 0;
    const c = L.wn[i];
    for (let j = 0; j < c; j++) {
      const b = L.wb[i * 4 + j];
      const w = L.ww[i * 4 + j];
      const R = rot[b];
      const r = rest[b];
      const dx = x - r[0];
      const dy = y - r[1];
      const dz = z - r[2];
      ox += w * (hd[b][0] + R[0] * dx + R[1] * dy + R[2] * dz);
      oy += w * (hd[b][1] + R[3] * dx + R[4] * dy + R[5] * dz);
      oz += w * (hd[b][2] + R[6] * dx + R[7] * dy + R[8] * dz);
    }
    pos[i * 3] = ox;
    pos[i * 3 + 1] = oy;
    pos[i * 3 + 2] = oz;
  }
  let soup: Soup = { ...L.base, pos };
  if (o.only) {
    const keep = new Set(o.only.map((nm) => MBI.get(nm)));
    const idx: number[] = [];
    const col: number[] = [];
    const mask: number[] = [];
    for (let t = 0; t < L.dom.length; t++) {
      if (!keep.has(L.dom[t])) continue;
      idx.push(L.base.idx[t * 3], L.base.idx[t * 3 + 1], L.base.idx[t * 3 + 2]);
      col.push(L.base.col[t]);
      mask.push(L.base.mask![t]);
    }
    soup = { pos, idx, col, mask, glow: new Set(), welded: true };
  }
  return { parts: [{ soup, pos: [0, 0, 0], size: [S, S, S], tag: 'mage' }], joints };
}

/** Суставы мага в позе — для gait({ joints: mageJoints }). */
export const mageJoints = (p: OgrePose) => mage(p, { jointsOnly: true }).joints;

/** Параметры шага мага для gait / walkCycle / circleGait: длина ноги и суставы стоп. */
export const MAGE_GAIT = { L: mageLegLength(), joints: mageJoints, anchor: mageAnchor };

/** Статистика доработки меша мага в Blender (до/после). */
export const MAGE_STATS = MAGE.stats;

/** Процедурный огр из примитивов (blocky — прототип «наборы примитивов»). */
function ogreProcedural(pose: OgrePose, o: OgreOpts): OgreModel {
  const skin = o.color ?? OGRE;
  const cloth = '#7a5c3e';
  const pelvis: V3 = [0, 1.02 + pose.bob, 0];
  const body = M.mul(M.ry(pose.twist), M.rx(pose.lean));
  const up = (v: V3): V3 => add3(pelvis, M.apply(body, v));
  const chest = up([0, 0.62, 0]);
  const neck = up([0, 1.0, 0.2]);
  const headRot = M.mul(body, M.rx(pose.head));
  const head = add3(neck, M.apply(headRot, [0, 0.24, 0.16]));

  const joints = { pelvis, chest, neck, head } as Record<Joint, V3>;
  const parts: Part[] = [];
  const seg3 = (from: V3, rot: M3, len: number): V3 => add3(from, M.apply(rot, [0, -len, 0]));

  // руки: плечо → локоть → кисть
  for (const [side, sfx] of [
    [-1, 'L'],
    [1, 'R'],
  ] as const) {
    const swing = sfx === 'L' ? pose.armL : pose.armR;
    const spread = sfx === 'L' ? pose.spreadL : pose.spreadR;
    const bend = sfx === 'L' ? pose.elbowL : pose.elbowR;
    const sh = up([side * 0.62, 0.84, 0]);
    const r1 = M.mul(body, limbRot(swing, spread, side));
    const el = seg3(sh, r1, 0.52);
    const r2 = M.mul(r1, M.rx(-bend));
    const hd = seg3(el, r2, 0.5);
    joints[`shoulder${sfx}` as Joint] = sh;
    joints[`elbow${sfx}` as Joint] = el;
    joints[`hand${sfx}` as Joint] = hd;
    parts.push(
      limb(sh, el, r1, [0.3, 0.3], skin, `arm${sfx}`, o.blocky),
      limb(el, hd, r2, [0.28, 0.26], skin, `forearm${sfx}`, o.blocky),
      {
        mesh: o.blocky ? MESH.cube : MESH.icosa,
        pos: seg3(el, r2, 0.56),
        size: o.blocky ? [0.3, 0.3, 0.3] : [0.42, 0.42, 0.42],
        rot: r2,
        color: skin,
        tag: `fist${sfx}`,
      },
    );
  }

  // ноги: бедро → колено → стопа
  for (const [side, sfx] of [
    [-1, 'L'],
    [1, 'R'],
  ] as const) {
    const swing = sfx === 'L' ? pose.legL : pose.legR;
    const bend = sfx === 'L' ? pose.kneeL : pose.kneeR;
    const hip = add3(pelvis, M.apply(M.ry(pose.twist * 0.5), [side * 0.3, -0.04, 0]));
    const r1 = M.mul(M.ry(pose.twist * 0.5), M.rx(-swing));
    const kn = seg3(hip, r1, 0.5);
    const r2 = M.mul(r1, M.rx(bend));
    const ft = seg3(kn, r2, 0.46);
    joints[`hip${sfx}` as Joint] = hip;
    joints[`knee${sfx}` as Joint] = kn;
    joints[`foot${sfx}` as Joint] = ft;
    parts.push(
      limb(hip, kn, r1, [0.34, 0.34], cloth, `thigh${sfx}`, o.blocky),
      limb(kn, ft, r2, [0.28, 0.28], skin, `shin${sfx}`, o.blocky),
      box(add3(ft, M.apply(r2, [0, -0.02, 0.1])), [0.3, 0.14, 0.44], skin, `foot${sfx}`, M.mul(M.ry(pose.twist * 0.5), M.rx(-swing + bend))),
    );
  }

  // корпус
  if (o.blocky) {
    parts.push(
      box(up([0, 0.5, 0]), [1.0, 0.9, 0.7], skin, 'torso', body),
      box(up([0, 0.05, 0]), [0.8, 0.3, 0.6], cloth, 'belt', body),
    );
  } else {
    parts.push(
      { mesh: MESH.icosa, pos: up([0, 0.55, -0.06]), size: [1.45, 1.25, 1.05], rot: body, color: skin, tag: 'torso' },
      { mesh: MESH.icosa, pos: up([0, 0.22, 0.14]), size: [1.1, 0.9, 0.92], rot: body, color: skin, tag: 'belly' },
      { mesh: MESH.cylinder, pos: up([0, 0.04, 0]), size: [0.98, 0.26, 0.78], rot: body, color: cloth, tag: 'belt' },
      { mesh: MESH.icosa, pos: up([-0.6, 0.86, 0]), size: [0.5, 0.42, 0.5], rot: body, color: skin, tag: 'shoulderL' },
      { mesh: MESH.icosa, pos: up([0.6, 0.86, 0]), size: [0.5, 0.42, 0.5], rot: body, color: skin, tag: 'shoulderR' },
    );
  }
  parts.push(...ogreHead(head, headRot, skin, o.blocky));
  if (o.headOnly) return { parts: parts.filter((p) => p.tag?.startsWith('head')), joints };
  return { parts, joints };
}

/** Голова огра: череп, челюсть, клыки, уши, надбровье. */
function ogreHead(c: V3, rot: M3, skin: string, blocky?: boolean): Part[] {
  const at = (v: V3): V3 => add3(c, M.apply(rot, v));
  if (blocky) return [box(c, [0.5, 0.5, 0.5], skin, 'head', rot)];
  return [
    { mesh: MESH.icosa, pos: at([0, 0.02, 0]), size: [0.74, 0.66, 0.68], rot, color: skin, tag: 'head' },
    { mesh: MESH.cube, pos: at([0, -0.19, 0.12]), size: [0.56, 0.2, 0.42], rot, color: skin, tag: 'head-jaw' },
    { mesh: MESH.cube, pos: at([0, 0.13, 0.27]), size: [0.5, 0.09, 0.12], rot: M.mul(rot, M.rx(-0.25)), color: skin, tag: 'head-brow' },
    { mesh: MESH.pyramid, pos: at([-0.17, -0.06, 0.32]), size: [0.07, 0.17, 0.07], rot, color: '#e9e4d4', tag: 'head-tusk' },
    { mesh: MESH.pyramid, pos: at([0.17, -0.06, 0.32]), size: [0.07, 0.17, 0.07], rot, color: '#e9e4d4', tag: 'head-tusk' },
    { mesh: MESH.pyramid, pos: at([-0.37, 0.08, -0.02]), size: [0.1, 0.26, 0.12], rot: M.mul(rot, M.rz(1.1)), color: skin, tag: 'head-ear' },
    { mesh: MESH.pyramid, pos: at([0.37, 0.08, -0.02]), size: [0.1, 0.26, 0.12], rot: M.mul(rot, M.rz(-1.1)), color: skin, tag: 'head-ear' },
    { mesh: MESH.cube, pos: at([-0.13, 0.06, 0.3]), size: [0.08, 0.05, 0.03], rot, color: C.accent, tag: 'head-eye' },
    { mesh: MESH.cube, pos: at([0.13, 0.06, 0.3]), size: [0.08, 0.05, 0.03], rot, color: C.accent, tag: 'head-eye' },
  ];
}

/** Сегмент конечности между суставами a и b (ось сегмента — локальная Y). */
function limb(from: V3, to: V3, rot: M3, wd: [number, number], color: string, tag: string, blocky?: boolean): Part {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  return {
    mesh: blocky ? MESH.cube : MESH.hexPrism,
    pos: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2],
    size: [wd[0], len * 1.08, wd[1]],
    rot,
    color,
    tag,
  };
}

export interface BonesOpts {
  color?: string;
  /** Появление костей по очереди 0..1. */
  p?: number;
  /** Толщина ромба кости как доля длины. */
  width?: number;
  /** Подсветка суставов (имена) — например, локти и колени. */
  focus?: Joint[];
  focusColor?: string;
  /** Пульс подсветки. */
  t?: number;
}

/** Скелет поверх модели: ромбовидные кости в стиле Blender и суставы. */
export function drawBones(
  ctx: Ctx,
  joints: Record<Joint, V3>,
  view: View,
  root: Root = {},
  o: BonesOpts = {},
  bones: Array<[Joint, Joint]> = OGRE_BONES,
): void {
  const p = clamp01(o.p ?? 1);
  if (p <= 0) return;
  const color = o.color ?? C.h1;
  const scr = (j: Joint) => toScreen(placePoint(joints[j], root), view);
  const each = 0.35;
  const stagger = (1 - each) / Math.max(1, bones.length - 1);
  ctx.save();
  ctx.lineJoin = 'round';
  bones.forEach(([ja, jb], i) => {
    const bp = easeOutQuart(clamp01((p - i * stagger) / each));
    if (bp <= 0) return;
    const [x1, y1] = scr(ja);
    const [x2t, y2t] = scr(jb);
    const x2 = lerp(x1, x2t, bp);
    const y2 = lerp(y1, y2t, bp);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 2) return;
    const nx = -dy / len;
    const ny = dx / len;
    const wd = Math.min(18, len * (o.width ?? 0.12));
    const mx = x1 + dx * 0.15;
    const my = y1 + dy * 0.15;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(mx + nx * wd, my + ny * wd);
    ctx.lineTo(x2, y2);
    ctx.lineTo(mx - nx * wd, my - ny * wd);
    ctx.closePath();
    ctx.fillStyle = a(color, 0.28);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.6;
    ctx.stroke();
  });
  const seen = new Set<Joint>();
  for (const [ja, jb] of bones) {
    for (const j of [ja, jb]) {
      if (seen.has(j)) continue;
      seen.add(j);
      const [x, y] = scr(j);
      const hot = o.focus?.includes(j);
      const r = hot ? 13 + Math.sin((o.t ?? 0) * 6) * 3 : 7;
      ctx.fillStyle = hot ? (o.focusColor ?? C.accent) : color;
      if (hot) {
        ctx.save();
        ctx.shadowColor = a(o.focusColor ?? C.accent, 0.9);
        ctx.shadowBlur = 24;
      }
      ctx.beginPath();
      ctx.arc(x, y, r * Math.min(1, p * 2), 0, Math.PI * 2);
      ctx.fill();
      if (hot) ctx.restore();
    }
  }
  ctx.restore();
}

// ================================================================ логотип канала

/**
 * Каркас кристалла логотипа в 3D (пропорции иконки arcadia): внешний кристалл — длинное
 * остриё вверх, пояс на 73% высоты; внутри малый кристалл; перемычки между поясами и оси.
 * Высота 2 (от y = −1 до 1).
 */
const LOGO_OUTER: Mesh = { verts: [], faces: [], edges: [] };
const LOGO_INNER: Mesh = { verts: [], faces: [], edges: [] };
(() => {
  const n = 6;
  const ring = (m: Mesh, y: number, R: number) => {
    const s = m.verts.length;
    for (let k = 0; k < n; k++) {
      const ang = Math.PI / 2 + (Math.PI * 2 * k) / n; // ребро смотрит на зрителя, как на логотипе
      m.verts.push([Math.cos(ang) * R, y, Math.sin(ang) * R]);
    }
    return s;
  };
  const bipyramid = (m: Mesh, top: number, girdle: number, bottom: number, half: number) => {
    const A = m.verts.push([0, top, 0]) - 1;
    const O = ring(m, girdle, half / Math.cos(Math.PI / 6));
    const B = m.verts.push([0, bottom, 0]) - 1;
    for (let k = 0; k < n; k++) m.edges.push([A, O + k], [O + k, O + ((k + 1) % n)], [O + k, B]);
    return { A, O, B };
  };
  const out = bipyramid(LOGO_OUTER, 1, -0.468, -1, 0.596);
  // внутренний кристалл, перемычки к поясу внешнего и осевые линии — отдельным цветом
  const inn = bipyramid(LOGO_INNER, 0.224, -0.378, -0.614, 0.216);
  const oA = LOGO_INNER.verts.push(LOGO_OUTER.verts[out.A]) - 1;
  const oB = LOGO_INNER.verts.push(LOGO_OUTER.verts[out.B]) - 1;
  const oR = LOGO_INNER.verts.length;
  for (let k = 0; k < n; k++) LOGO_INNER.verts.push(LOGO_OUTER.verts[out.O + k]);
  for (let k = 0; k < n; k++) LOGO_INNER.edges.push([oR + k, inn.O + k]);
  LOGO_INNER.edges.push([oA, inn.A], [inn.B, oB]);
})();

export interface CrystalOpts {
  /** Сборка 0..1: рёбра прочерчиваются по очереди. */
  p?: number;
  /** Время для вращения. */
  t?: number;
  /** Оставлено для совместимости. */
  solid?: number;
  /** Сила свечения 0..1. */
  glow?: number;
}

/**
 * Логотип канала в 3D: каркас кристалла из тонких рёбер с точками в вершинах, вращается
 * (как икосаэдр в ролике про 3D-движок). Центр — (view.cx, view.cy), полувысота = view.size.
 */
export function crystal(ctx: Ctx, view: View, o: CrystalOpts = {}): void {
  const p = clamp01(o.p ?? 1);
  if (p <= 0) return;
  const t = o.t ?? 0;
  const glow = clamp01(o.glow ?? 1);
  const xf = { ry: t * 0.55 };
  ctx.save();
  if (glow > 0) {
    ctx.save();
    ctx.globalAlpha *= clamp01(p * 3);
    softLight(ctx, view.cx, view.cy, view.size * 1.9, C.h1, 0.13 * glow);
    ctx.restore();
  }
  drawWire(ctx, LOGO_OUTER, view, xf, {
    color: a(C.h1, 0.6),
    width: Math.max(1.6, view.size * 0.009),
    p,
    depthFade: 0.85,
    dots: Math.max(2.5, view.size * 0.02),
  });
  drawWire(ctx, LOGO_INNER, view, xf, {
    color: a(C.accent, 0.55),
    width: Math.max(1.4, view.size * 0.007),
    p: seg(p, 0.3, 0.7),
    depthFade: 0.8,
    dots: Math.max(2, view.size * 0.014),
  });
  ctx.restore();
}

/** Плоский логотип канала (иконка arcadia) с голубым свечением — для карточек и подписей. */
export function logoFlat(ctx: Ctx, cx: number, cy: number, h: number, t = 0): void {
  ctx.save();
  ctx.shadowColor = a(C.h1, 0.75);
  ctx.shadowBlur = h * (0.05 + 0.012 * Math.sin(t * 2.2));
  icon(ctx, 'arcadia', cx, cy, h, C.h1);
  ctx.restore();
}

// ================================================================ полигональные сетки

/** Сетка-поверхность: строки по v, в строке точки по u. */
export interface Surf {
  pts: V3[][];
  /** Сетка замкнута по u (кольцо). */
  closedU: boolean;
}

/** Сфера (эллипсоид) из nu × nv квадов; у полюсов квады вырождаются в треугольники. */
export function sphereSurf(nu: number, nv: number, r: V3 = [1, 1, 1]): Surf {
  return blobSurf(nu, nv, 0, r);
}

/**
 * «Камень/голова»: сфера с плавными буграми. Форма от разрешения не зависит —
 * поэтому подходит для LOD: та же модель, меньше полигонов.
 */
export function blobSurf(nu: number, nv: number, amp = 0.16, r: V3 = [1, 1, 1], seed = 1): Surf {
  const pts: V3[][] = [];
  for (let j = 0; j <= nv; j++) {
    const th = (Math.PI * j) / nv;
    const row: V3[] = [];
    for (let i = 0; i < nu; i++) {
      const ph = (Math.PI * 2 * i) / nu;
      const d: V3 = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
      const bump =
        1 +
        amp *
          (0.55 * Math.sin(d[0] * 3.1 + seed) * Math.cos(d[2] * 2.7 - seed) +
            0.3 * Math.sin(d[1] * 4.3 + seed * 2.1) +
            0.15 * Math.cos((d[0] + d[2]) * 6.1 + seed));
      row.push([d[0] * r[0] * bump, d[1] * r[1] * bump, d[2] * r[2] * bump]);
    }
    pts.push(row);
  }
  return { pts, closedU: true };
}

/**
 * Конечность-труба длиной 2 (от y = 1 вниз), со сгибом посередине на угол
 * `bend` (положительный — нижняя половина уходит вперёд, к +Z). `bulge` —
 * утолщение у сгиба (колено, локоть).
 */
export function limbSurf(nu: number, nv: number, bend = 0, r = 0.36, bulge = 0.08): Surf {
  const smooth = (x: number) => x * x * (3 - 2 * x);
  const angAt = (s: number) => bend * smooth(clamp01((s - 0.42) / 0.16));
  const pts: V3[][] = [];
  let ay = 1;
  let az = 0;
  let prev = 0;
  const SUB = 6;
  for (let j = 0; j <= nv; j++) {
    const s = j / nv;
    // ось трубы интегрируется по длине: до сгиба прямо вниз, после — под углом
    for (let k = 0; k < SUB && j > 0; k++) {
      const an = angAt(prev + ((s - prev) * (k + 0.5)) / SUB);
      const ds = ((s - prev) / SUB) * 2;
      ay -= Math.cos(an) * ds;
      az += Math.sin(an) * ds;
    }
    prev = s;
    const an = angAt(s);
    const rad = r * (1 + bulge * Math.exp(-((s - 0.5) ** 2) / 0.006)) * (1 - 0.18 * s);
    const ny = Math.sin(an);
    const nz = Math.cos(an);
    const row: V3[] = [];
    for (let i = 0; i < nu; i++) {
      const ph = (Math.PI * 2 * i) / nu;
      const k = Math.sin(ph) * rad;
      row.push([Math.cos(ph) * rad, ay + k * ny, az + k * nz]);
    }
    pts.push(row);
  }
  return { pts, closedU: true };
}

export interface SurfOpts {
  /** Цвет заливки, hex; `null` — только каркас. */
  fill?: string | null;
  /** Цвет рёбер. */
  wire?: string;
  width?: number;
  /** Рисовать диагонали — квады становятся треугольниками. */
  tris?: boolean;
  /** Цвет диагоналей (по умолчанию как у рёбер). */
  triColor?: string;
  /** Номера строк v, которые подсветить как edge loops. */
  loops?: number[];
  loopColor?: string;
  loopWidth?: number;
  /** Пропустить грани (дыры): ключ `${j}:${i}`. */
  holes?: Set<string>;
  /** Подсветить отдельные грани: ключ `${j}:${i}` → цвет. */
  marks?: Map<string, string>;
  /** Прогресс «сборки» по строкам 0..1. */
  p?: number;
  ambient?: number;
  /** Ступени света (тун). */
  bands?: number;
  /** Показывать задние грани каркасом (прозрачная сетка). */
  xray?: boolean;
}

/** Поверхность из квадов: заливка граней по глубине, рёбра, диагонали, лупы. */
export function drawSurf(ctx: Ctx, surf: Surf, view: View, root: Root = {}, o: SurfOpts = {}): void {
  const R = rootMatrix(root);
  const base = root.pos ?? [0, 0, 0];
  const nv = surf.pts.length - 1;
  const nu = surf.pts[0].length;
  const cols = surf.closedU ? nu : nu - 1;
  const cam = surf.pts.map((row) => row.map((v) => camSpace(add3(base, M.apply(R, v)), view)));
  const scr = cam.map((row) => row.map((c) => camToScreen(c, view)));
  const d = view.dist ?? 7;
  const fill = o.fill === undefined ? CLAY : o.fill;
  const wire = o.wire ?? a(C.bg, 0.55);
  const ambient = o.ambient ?? 0.32;
  const shown = Math.ceil(nv * clamp01(o.p ?? 1));
  const loops = new Set(o.loops ?? []);

  // центр масс — чтобы развернуть нормали наружу
  let cx = 0;
  let cy = 0;
  let cz = 0;
  let cnt = 0;
  for (const row of cam) {
    for (const c of row) {
      cx += c[0];
      cy += c[1];
      cz += c[2];
      cnt++;
    }
  }
  const center: V3 = [cx / cnt, cy / cnt, cz / cnt];

  const faces: Array<{ j: number; i: number; i2: number; z: number; light: number; front: boolean }> = [];
  for (let j = 0; j < Math.min(nv, shown); j++) {
    for (let i = 0; i < cols; i++) {
      const i2 = (i + 1) % nu;
      if (o.holes?.has(`${j}:${i}`)) continue;
      const q = [cam[j][i], cam[j][i2], cam[j + 1][i2], cam[j + 1][i]];
      const mid: V3 = [
        (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4,
        (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4,
        (q[0][2] + q[1][2] + q[2][2] + q[3][2]) / 4,
      ];
      let n = cross3(sub3(q[2], q[0]), sub3(q[3], q[1]));
      if (Math.hypot(n[0], n[1], n[2]) < 1e-9) continue;
      n = unit3(n);
      if (dot3(n, sub3(mid, center)) < 0) n = [-n[0], -n[1], -n[2]];
      const toCam: V3 = Number.isFinite(d) ? [-mid[0], -mid[1], d - mid[2]] : [0, 0, 1];
      const front = dot3(n, toCam) > 0;
      if (!front && !o.xray) continue;
      faces.push({ j, i, i2, z: mid[2], light: Math.max(0, dot3(n, LIGHT)), front });
    }
  }
  faces.sort((p, q) => p.z - q.z);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const baseAlpha = ctx.globalAlpha;
  for (const f of faces) {
    const A = scr[f.j][f.i];
    const B = scr[f.j][f.i2];
    const Cc = scr[f.j + 1][f.i2];
    const D = scr[f.j + 1][f.i];
    ctx.beginPath();
    ctx.moveTo(A[0], A[1]);
    ctx.lineTo(B[0], B[1]);
    ctx.lineTo(Cc[0], Cc[1]);
    ctx.lineTo(D[0], D[1]);
    ctx.closePath();
    ctx.globalAlpha = baseAlpha * (f.front ? 1 : 0.25);
    const mark = o.marks?.get(`${f.j}:${f.i}`);
    if (fill && f.front) {
      let li = ambient + (1 - ambient) * f.light;
      if (o.bands && o.bands > 1) li = Math.min(1, Math.floor(li * o.bands) / (o.bands - 1));
      ctx.fillStyle = shadeHex(mark ?? fill, li);
      ctx.fill();
    } else if (mark && f.front) {
      ctx.fillStyle = a(mark, 0.5);
      ctx.fill();
    }
    ctx.strokeStyle = wire;
    ctx.lineWidth = o.width ?? 1.6;
    ctx.stroke();
    if (o.tris) {
      ctx.strokeStyle = o.triColor ?? wire;
      ctx.beginPath();
      ctx.moveTo(A[0], A[1]);
      ctx.lineTo(Cc[0], Cc[1]);
      ctx.stroke();
    }
    if (f.front && (loops.has(f.j) || loops.has(f.j + 1))) {
      ctx.strokeStyle = o.loopColor ?? C.accent;
      ctx.lineWidth = o.loopWidth ?? 4;
      ctx.beginPath();
      if (loops.has(f.j)) {
        ctx.moveTo(A[0], A[1]);
        ctx.lineTo(B[0], B[1]);
      }
      if (loops.has(f.j + 1)) {
        ctx.moveTo(D[0], D[1]);
        ctx.lineTo(Cc[0], Cc[1]);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Число граней сетки (квадов) — для подписей LOD. */
export const surfQuads = (s: Surf) => (s.pts.length - 1) * (s.closedU ? s.pts[0].length : s.pts[0].length - 1);
