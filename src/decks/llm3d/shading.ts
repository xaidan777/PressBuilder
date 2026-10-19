/**
 * «Шейдинг» на канвасе: одна и та же постановка из трёх шаров в тун-стиле
 * и в реалистичном виде. Используется там, где речь о казуальной графике
 * против реалистичной демосцены.
 */

import { hash11, noise1 } from '../../engine/anim.ts';
import { a, C } from '../../engine/theme.ts';
import type { Rect } from './common.ts';

type Ctx = CanvasRenderingContext2D;

function rgbOf(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** k < 1 — темнее (к чёрному), k > 1 — светлее (к белому). */
function tone(hex: string, k: number): string {
  const [r, g, b] = rgbOf(hex);
  const m = (c: number) =>
    Math.round(k <= 1 ? c * k : c + (255 - c) * Math.min(1, k - 1));
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`;
}

function disc(ctx: Ctx, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

const INK = '#15171b';

/** Тун-шейдинг: три жёсткие ступени света, блик-пятно и толстый контур. */
export function toonBall(ctx: Ctx, cx: number, cy: number, r: number, hex: string): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.2, cy + r * 0.97, r * 0.95, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = tone(hex, 0.48);
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.fillStyle = tone(hex, 0.76);
  disc(ctx, cx - r * 0.16, cy - r * 0.18, r * 0.98);
  ctx.fillStyle = hex;
  disc(ctx, cx - r * 0.32, cy - r * 0.36, r * 0.68);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.44, cy - r * 0.48, r * 0.17, r * 0.1, -0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(4, r * 0.075);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

/** Реалистичный шар: плавный свет, рефлекс от пола, контровой и мягкий блик. */
export function realBall(ctx: Ctx, cx: number, cy: number, r: number, hex: string, shadow = true): void {
  if (shadow) {
    ctx.save();
    ctx.translate(cx + r * 0.08, cy + r * 0.98);
    ctx.scale(1, 0.2);
    const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.4);
    sh.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
    sh.addColorStop(0.45, 'rgba(0, 0, 0, 0.34)');
    sh.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = sh;
    ctx.fillRect(-r * 1.5, -r * 1.5, r * 3, r * 3);
    ctx.restore();
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  const body = ctx.createRadialGradient(
    cx - r * 0.36,
    cy - r * 0.42,
    r * 0.04,
    cx - r * 0.12,
    cy - r * 0.12,
    r * 1.28,
  );
  body.addColorStop(0, tone(hex, 1.55));
  body.addColorStop(0.2, hex);
  body.addColorStop(0.62, tone(hex, 0.34));
  body.addColorStop(1, tone(hex, 0.08));
  ctx.fillStyle = body;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  // рефлекс: пол подсвечивает шар снизу
  const bounce = ctx.createRadialGradient(cx, cy + r * 1.15, 0, cx, cy + r * 1.15, r);
  bounce.addColorStop(0, a(hex, 0.4));
  bounce.addColorStop(1, a(hex, 0));
  ctx.fillStyle = bounce;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  // холодный контровой свет по правому краю
  ctx.strokeStyle = a(C.h1, 0.22);
  ctx.lineWidth = r * 0.05;
  ctx.shadowColor = a(C.h1, 0.85);
  ctx.shadowBlur = r * 0.34;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.0, -Math.PI * 0.3, Math.PI * 0.28);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // блик
  const sx = cx - r * 0.38;
  const sy = cy - r * 0.44;
  const spec = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 0.34);
  spec.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  spec.addColorStop(0.3, 'rgba(255, 255, 255, 0.4)');
  spec.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = spec;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

/** Постановка: три шара на полу. Координаты — доли области. */
const BALLS = [
  { x: 0.25, contact: 0.76, r: 0.15, color: C.h1 },
  { x: 0.78, contact: 0.74, r: 0.125, color: C.pos },
  { x: 0.52, contact: 0.86, r: 0.235, color: C.accent },
] as const;

const HORIZON = 0.6;

function ballsOf(r: Rect, t: number): Array<{ cx: number; cy: number; rad: number; color: string }> {
  // лёгкий дрейф камеры, общий для обоих стилей — кадры «до» и «после» совпадают
  const sway = noise1(t * 0.5, 3) * r.w * 0.008;
  return BALLS.map((b, i) => {
    const rad = b.r * r.h;
    return {
      cx: r.x + b.x * r.w + sway * (1 + i * 0.4),
      cy: r.y + b.contact * r.h - rad,
      rad,
      color: b.color,
    };
  });
}

/** Казуальная версия: плоские заливки, жёсткий горизонт, контуры. */
export function toonScene(ctx: Ctx, r: Rect, t: number): void {
  const hy = r.y + r.h * HORIZON;
  ctx.fillStyle = '#4a5666';
  ctx.fillRect(r.x, r.y, r.w, hy - r.y);
  ctx.fillStyle = '#3a4350';
  ctx.fillRect(r.x, hy, r.w, r.y + r.h - hy);
  ctx.fillStyle = INK;
  ctx.fillRect(r.x, hy - 2, r.w, 4);
  for (const b of ballsOf(r, t)) toonBall(ctx, b.cx, b.cy, b.rad, b.color);
}

/** Реалистичная версия: студийный свет, глянцевый пол с отражениями, пыль в луче. */
export function realScene(ctx: Ctx, r: Rect, t: number): void {
  const hy = r.y + r.h * HORIZON;
  const bottom = r.y + r.h;

  const wall = ctx.createLinearGradient(0, r.y, 0, hy);
  wall.addColorStop(0, '#0b0c10');
  wall.addColorStop(1, '#1c2028');
  ctx.fillStyle = wall;
  ctx.fillRect(r.x, r.y, r.w, hy - r.y);

  const floor = ctx.createLinearGradient(0, hy, 0, bottom);
  floor.addColorStop(0, '#232831');
  floor.addColorStop(1, '#0a0b0e');
  ctx.fillStyle = floor;
  ctx.fillRect(r.x, hy, r.w, bottom - hy);

  // пятно прожектора на стене и на полу
  const lx = r.x + r.w * 0.42;
  let g = ctx.createRadialGradient(lx, r.y, 0, lx, r.y, r.h * 0.95);
  g.addColorStop(0, 'rgba(255, 244, 220, 0.2)');
  g.addColorStop(1, 'rgba(255, 244, 220, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);

  ctx.save();
  ctx.translate(r.x + r.w * 0.5, r.y + r.h * 0.84);
  ctx.scale(1, 0.3);
  g = ctx.createRadialGradient(0, 0, 0, 0, 0, r.w * 0.5);
  g.addColorStop(0, 'rgba(255, 240, 210, 0.16)');
  g.addColorStop(1, 'rgba(255, 240, 210, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(-r.w, -r.w, r.w * 2, r.w * 2);
  ctx.restore();

  const balls = ballsOf(r, t);

  // отражения в полу: зеркальная копия под точкой касания, тающая книзу
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, hy, r.w, bottom - hy);
  ctx.clip();
  for (const b of balls) {
    const contact = b.cy + b.rad;
    ctx.save();
    ctx.globalAlpha *= 0.3;
    ctx.translate(0, contact * 2);
    ctx.scale(1, -1);
    realBall(ctx, b.cx, b.cy, b.rad, b.color, false);
    ctx.restore();
  }
  const melt = ctx.createLinearGradient(0, hy, 0, bottom);
  melt.addColorStop(0, 'rgba(10, 11, 14, 0)');
  melt.addColorStop(1, 'rgba(10, 11, 14, 0.92)');
  ctx.fillStyle = melt;
  ctx.fillRect(r.x, hy, r.w, bottom - hy);
  ctx.restore();

  for (const b of balls) realBall(ctx, b.cx, b.cy, b.rad, b.color);

  // пыль в луче
  for (let i = 0; i < 26; i++) {
    const k = (t * (0.02 + hash11(i * 3.1) * 0.03) + hash11(i * 7.7)) % 1;
    const px = r.x + r.w * (0.12 + hash11(i * 1.3) * 0.76) + noise1(t * 0.3, i) * 14;
    const py = r.y + r.h * (0.9 - k * 0.85);
    const tw = 0.25 + 0.75 * Math.abs(Math.sin(t * 0.9 + i * 2.1));
    ctx.fillStyle = `rgba(255, 240, 215, ${0.34 * tw * Math.sin(k * Math.PI)})`;
    disc(ctx, px, py, r.h * (0.003 + hash11(i * 9.4) * 0.004));
  }

  // виньетка
  g = ctx.createRadialGradient(
    r.x + r.w / 2,
    r.y + r.h / 2,
    r.h * 0.4,
    r.x + r.w / 2,
    r.y + r.h / 2,
    r.w * 0.72,
  );
  g.addColorStop(0, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
}
