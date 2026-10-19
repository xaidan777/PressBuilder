/** Общие визуальные блоки ролика: модели-роботы, окна, карточки скиллов, потоки. */

import { clamp01, easeOutBack, easeOutQuart } from '../../engine/anim.ts';
import { corners, hexPath, panel, rrPath, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';

type Ctx = CanvasRenderingContext2D;
export type P2 = [number, number];

/** Фон «экранов» (вьюпорт редактора, окно проекта) — темнее панелей. */
export const SCREEN_BG = '#22252a';

// ---------------------------------------------------------------- появление

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

// ---------------------------------------------------------------- робот в гексе

export interface BotOpts {
  r: number;
  color?: string;
  p?: number;
  t?: number;
  icon?: string;
  /** Подпись под гексом. */
  label?: string;
  labelSize?: number;
  labelColor?: string;
  /** Приглушение 0..1. */
  dim?: number;
  /** Сила свечения 0..1. */
  glow?: number;
}

/** Так в ролике выглядит любая модель или агент: значок в шестиугольнике. */
export function botHex(ctx: Ctx, cx: number, cy: number, o: BotOpts): void {
  const p = clamp01(o.p ?? 1);
  if (p <= 0) return;
  const color = o.color ?? C.h1;
  const dim = clamp01(o.dim ?? 0);
  const t = o.t ?? 0;
  const s = 0.6 + 0.4 * easeOutBack(p);

  ctx.save();
  ctx.globalAlpha *= Math.min(1, p * 2.4) * (1 - dim * 0.65);
  if (o.glow) softLight(ctx, cx, cy, o.r * 2.6, color, 0.3 * o.glow);
  ctx.translate(cx, cy);
  ctx.scale(s, s);

  hexPath(ctx, 0, 0, o.r, Math.PI / 6);
  ctx.fillStyle = C.panel;
  ctx.fill();
  ctx.strokeStyle = a(color, 0.8);
  ctx.lineWidth = Math.max(2.4, o.r * 0.034);
  ctx.stroke();
  hexPath(ctx, 0, 0, o.r * 1.16 + Math.sin(t * 1.5) * o.r * 0.025, Math.PI / 6);
  ctx.strokeStyle = a(color, 0.2);
  ctx.lineWidth = 1.8;
  ctx.stroke();

  icon(ctx, o.icon ?? 'robot', 0, 0, o.r * 0.95, color, t);
  if (o.label) {
    text(ctx, o.label, 0, o.r * 1.16 + (o.labelSize ?? 52) * 0.95, {
      size: o.labelSize ?? 52,
      color: o.labelColor ?? color,
      align: 'center',
      tracking: 1.6,
    });
  }
  ctx.restore();
}

// ---------------------------------------------------------------- окна

export interface WindowOpts {
  title?: string;
  color?: string;
  /** Высота шапки. */
  bar?: number;
  icon?: string;
  glow?: number;
  t?: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Окно-заглушка: рамка, шапка с тремя точками и заголовком. Возвращает область содержимого. */
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
    text(ctx, o.title, tx, y + bar / 2 + 16, {
      size: 46,
      color: a(C.text, 0.72),
      tracking: 1.6,
    });
  }
  return { x, y: y + bar, w, h: h - bar };
}

/** «Экран»: тёмная область с обрезкой по рамке. Содержимое рисует `draw`. */
export function viewport(
  ctx: Ctx,
  r: Rect,
  draw: () => void,
  o: { color?: string; bg?: string | CanvasGradient; radius?: number; frame?: boolean } = {},
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
    corners(ctx, r.x - 10, r.y - 10, r.w + 20, r.h + 20, 26, a(o.color ?? C.h1, 0.55), 2.5);
  }
}

// ---------------------------------------------------------------- мелочи

export interface SkillCardOpts {
  rot?: number;
  color?: string;
  alpha?: number;
}

/** Карточка скилла: листок с молнией и парой строк. `s` — высота. */
export function skillCard(ctx: Ctx, cx: number, cy: number, s: number, o: SkillCardOpts = {}): void {
  const alpha = clamp01(o.alpha ?? 1);
  if (alpha <= 0) return;
  const color = o.color ?? C.accent;
  const w = s * 0.76;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(cx, cy);
  ctx.rotate(o.rot ?? 0);
  const fold = s * 0.2;
  ctx.beginPath();
  ctx.moveTo(-w / 2, -s / 2);
  ctx.lineTo(w / 2 - fold, -s / 2);
  ctx.lineTo(w / 2, -s / 2 + fold);
  ctx.lineTo(w / 2, s / 2);
  ctx.lineTo(-w / 2, s / 2);
  ctx.closePath();
  ctx.fillStyle = C.panel;
  ctx.fill();
  ctx.strokeStyle = a(color, 0.85);
  ctx.lineWidth = Math.max(2, s * 0.03);
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w / 2 - fold, -s / 2);
  ctx.lineTo(w / 2 - fold, -s / 2 + fold);
  ctx.lineTo(w / 2, -s / 2 + fold);
  ctx.stroke();
  icon(ctx, 'bolt', -w * 0.04, -s * 0.1, s * 0.44, color);
  ctx.fillStyle = a(C.text, 0.3);
  rrPath(ctx, -w * 0.32, s * 0.22, w * 0.64, s * 0.06, s * 0.03);
  ctx.fill();
  rrPath(ctx, -w * 0.32, s * 0.34, w * 0.42, s * 0.06, s * 0.03);
  ctx.fill();
  ctx.restore();
}

/** Круглая отметка «проверено / справился». */
export function checkBadge(ctx: Ctx, cx: number, cy: number, r: number, p: number, color: string = C.pos): void {
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
  icon(ctx, 'check', 0, 0, r * 1.2, C.bg);
  ctx.restore();
}

export interface ModelCardOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
  color: string;
  p?: number;
  dim?: number;
  /** 0..1 — перечёркивание. */
  strike?: number;
  /** Сдвиг карточки от «удара», px. */
  jolt?: P2;
  t?: number;
}

/** Большая карточка флагманской модели: робот в гексе и имя. */
export function modelCard(ctx: Ctx, o: ModelCardOpts): void {
  const p = clamp01(o.p ?? 1);
  if (p <= 0) return;
  const dim = clamp01(o.dim ?? 0);
  const e = easeOutQuart(p);
  const [jx, jy] = o.jolt ?? [0, 0];
  ctx.save();
  ctx.globalAlpha *= Math.min(1, p * 2.4) * (1 - dim * 0.6);
  ctx.translate(o.x + o.w / 2 + jx, o.y + o.h / 2 + jy + (1 - e) * 40);
  const s = 0.9 + 0.1 * easeOutBack(p);
  ctx.scale(s, s);
  ctx.translate(-o.w / 2, -o.h / 2);

  panel(ctx, 0, 0, o.w, o.h, {
    fill: C.panel,
    stroke: a(o.color, 0.42),
    lineWidth: 2,
    radius: 18,
    glow: a(o.color, 0.12 * (1 - dim)),
    glowBlur: 54,
    accentBar: { color: a(o.color, 0.9), width: 6 },
  });
  const hr = o.h * 0.3;
  const hx = o.h * 0.5 + 8;
  hexPath(ctx, hx, o.h / 2, hr, Math.PI / 6);
  ctx.strokeStyle = a(o.color, 0.55);
  ctx.lineWidth = 2.4;
  ctx.stroke();
  icon(ctx, 'robot', hx, o.h / 2, hr * 1.0, o.color, o.t ?? 0);
  text(ctx, o.name, hx + hr + 44, o.h / 2 + o.h * 0.15, {
    size: o.h * 0.44,
    color: o.color,
    tracking: 3,
    caps: 'normal',
  });

  const strike = clamp01(o.strike ?? 0);
  if (strike > 0) {
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.shadowColor = a(C.bg, 0.9);
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(26, o.h - 30);
    ctx.lineTo(26 + (o.w - 52) * easeOutQuart(strike), o.h - 30 - (o.h - 60) * easeOutQuart(strike));
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- потоки по кривой

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

/** Линия связи с бегущими по ней точками. */
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
    const k = (o.t * (o.speed ?? 0.5) + i / n) % 1;
    if (k > p) continue;
    const [x, y] = bez(p0, p1, p2, k);
    ctx.globalAlpha *= 1;
    ctx.beginPath();
    ctx.arc(x, y, (o.r ?? 6) * (0.6 + 0.4 * Math.sin(k * Math.PI)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
