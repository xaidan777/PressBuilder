/** Низкоуровневые примитивы рисования: панели, линии, гексы, свечение. */

import { clamp01, easeOutCubic } from './anim.ts';
import { a, C } from './theme.ts';

type Ctx = CanvasRenderingContext2D;

export function save(ctx: Ctx, fn: () => void): void {
  ctx.save();
  fn();
  ctx.restore();
}

export function alphaGroup(ctx: Ctx, alpha: number, fn: () => void): void {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha *= clamp01(alpha);
  fn();
  ctx.restore();
}

/** Путь скруглённого прямоугольника (r — число или [tl,tr,br,bl]). */
export function rrPath(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number | [number, number, number, number] = 8,
): void {
  const [tl, tr, br, bl] = typeof r === 'number' ? [r, r, r, r] : r;
  const m = Math.min(w, h) / 2;
  const c = (v: number) => Math.max(0, Math.min(v, m));
  ctx.beginPath();
  ctx.moveTo(x + c(tl), y);
  ctx.lineTo(x + w - c(tr), y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + c(tr));
  ctx.lineTo(x + w, y + h - c(br));
  ctx.quadraticCurveTo(x + w, y + h, x + w - c(br), y + h);
  ctx.lineTo(x + c(bl), y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - c(bl));
  ctx.lineTo(x, y + c(tl));
  ctx.quadraticCurveTo(x, y, x + c(tl), y);
  ctx.closePath();
}

export interface PanelOpts {
  fill?: string;
  stroke?: string;
  lineWidth?: number;
  radius?: number | [number, number, number, number];
  /** Цвет мягкого свечения за панелью. */
  glow?: string;
  glowBlur?: number;
  /** Толщина акцентной полосы слева. */
  accentBar?: { color: string; width?: number };
}

export function panel(ctx: Ctx, x: number, y: number, w: number, h: number, o: PanelOpts = {}): void {
  const radius = o.radius ?? 10;
  if (o.glow) {
    ctx.save();
    ctx.shadowColor = o.glow;
    ctx.shadowBlur = o.glowBlur ?? 40;
    ctx.fillStyle = o.fill ?? C.panel;
    rrPath(ctx, x, y, w, h, radius);
    ctx.fill();
    ctx.restore();
  }
  if (o.fill !== 'none') {
    ctx.fillStyle = o.fill ?? C.panel;
    rrPath(ctx, x, y, w, h, radius);
    ctx.fill();
  }
  if (o.stroke) {
    ctx.strokeStyle = o.stroke;
    ctx.lineWidth = o.lineWidth ?? 1.5;
    rrPath(ctx, x, y, w, h, radius);
    ctx.stroke();
  }
  if (o.accentBar) {
    const bw = o.accentBar.width ?? 4;
    ctx.save();
    rrPath(ctx, x, y, w, h, radius);
    ctx.clip();
    ctx.fillStyle = o.accentBar.color;
    ctx.fillRect(x, y, bw, h);
    ctx.restore();
  }
}

/** Рисует `fn` со свечением заданного цвета. */
export function glow(ctx: Ctx, color: string, blur: number, fn: () => void): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  fn();
  ctx.restore();
}

/** Открывает содержимое слева направо (маска-шторка). */
export function wipeX(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  p: number,
  fn: () => void,
): void {
  if (p <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w * clamp01(p), h);
  ctx.clip();
  fn();
  ctx.restore();
}

/** Открывает содержимое снизу вверх. */
export function wipeY(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  p: number,
  fn: () => void,
): void {
  if (p <= 0) return;
  ctx.save();
  ctx.beginPath();
  const hh = h * clamp01(p);
  ctx.rect(x, y + h - hh, w, hh);
  ctx.clip();
  fn();
  ctx.restore();
}

/** Горизонтальная линия-разделитель, растущая от левого края. */
export function divider(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  p = 1,
  color = a(C.text, 0.14),
  lw = 1.5,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w * easeOutCubic(clamp01(p)), y);
  ctx.stroke();
}

/** Путь правильного шестиугольника (flat-top при rot=0). */
export function hexPath(ctx: Ctx, cx: number, cy: number, r: number, rot = 0): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const ang = rot + (Math.PI / 3) * i;
    const px = cx + Math.cos(ang) * r;
    const py = cy + Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function polyline(ctx: Ctx, pts: Array<[number, number]>, close = false): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (close) ctx.closePath();
}

/** Плавная кривая через точки (Catmull-Rom → безье). */
export function smoothPath(ctx: Ctx, pts: Array<[number, number]>, tension = 0.5): void {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension * 2;
    const c1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension * 2;
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension * 2;
    const c2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension * 2;
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2[0], p2[1]);
  }
}

export interface ArrowOpts {
  color?: string;
  width?: number;
  head?: number;
  dash?: number[];
}

/** Стрелка с анимируемым прогрессом рисования. */
export function arrow(
  ctx: Ctx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  p = 1,
  o: ArrowOpts = {},
): void {
  const pr = clamp01(p);
  if (pr <= 0) return;
  const color = o.color ?? C.accent;
  const width = o.width ?? 3;
  const head = o.head ?? 16;
  const ex = x1 + (x2 - x1) * pr;
  const ey = y1 + (y2 - y1) * pr;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  if (o.dash) ctx.setLineDash(o.dash);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.setLineDash([]);

  if (pr > 0.92) {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const k = clamp01((pr - 0.92) / 0.08);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - Math.cos(ang - 0.42) * head * k, y2 - Math.sin(ang - 0.42) * head * k);
    ctx.lineTo(x2 - Math.cos(ang + 0.42) * head * k, y2 - Math.sin(ang + 0.42) * head * k);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Расходящееся кольцо ударной волны. */
export function shockRing(
  ctx: Ctx,
  cx: number,
  cy: number,
  p: number,
  maxR: number,
  color: string = C.accent,
  width = 3,
): void {
  const pr = clamp01(p);
  if (pr <= 0 || pr >= 1) return;
  const r = maxR * easeOutCubic(pr);
  ctx.save();
  ctx.globalAlpha *= (1 - pr) * 0.8;
  ctx.strokeStyle = color;
  ctx.lineWidth = width * (1 - pr * 0.6);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Мягкое радиальное пятно света. */
export function softLight(ctx: Ctx, cx: number, cy: number, r: number, color: string, alpha = 0.25): void {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, a(color, alpha));
  g.addColorStop(1, a(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
}

/** Уголковая рамка-«прицел» вокруг области. */
export function corners(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  len = 26,
  color: string = C.h1,
  lw = 2.5,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  const seg2 = (px: number, py: number, dx: number, dy: number) => {
    ctx.beginPath();
    ctx.moveTo(px + dx * len, py);
    ctx.lineTo(px, py);
    ctx.lineTo(px, py + dy * len);
    ctx.stroke();
  };
  seg2(x, y, 1, 1);
  seg2(x + w, y, -1, 1);
  seg2(x + w, y + h, -1, -1);
  seg2(x, y + h, 1, -1);
  ctx.restore();
}
