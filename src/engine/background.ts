/**
 * Непрерывный фон презентации: он живёт независимо от сцен,
 * поэтому на стыках сцен кадр не «моргает».
 */

import { hash11, hash21, noise1 } from './anim.ts';
import { hexPath } from './draw.ts';
import { a, C, H, W } from './theme.ts';

type Ctx = CanvasRenderingContext2D;

const HEX_R = 62;
const COLS = Math.ceil(W / (HEX_R * 1.5)) + 3;
const ROWS = Math.ceil(H / (HEX_R * Math.sqrt(3))) + 3;

const PARTICLES = Array.from({ length: 70 }, (_, i) => ({
  x: hash11(i * 1.7) * W,
  y: hash11(i * 3.3 + 11) * H,
  r: 1 + hash11(i * 5.1) * 2.6,
  spd: 6 + hash11(i * 7.7) * 16,
  drift: (hash11(i * 9.1) - 0.5) * 22,
  seed: i,
}));

export function drawBackground(ctx: Ctx, gt: number, energy = 0): void {
  ctx.save();

  // база
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // два мягких источника света
  const lx = W * 0.22 + noise1(gt * 0.09, 1) * 60;
  const ly = H * 0.18 + noise1(gt * 0.11, 2) * 40;
  let g = ctx.createRadialGradient(lx, ly, 0, lx, ly, W * 0.62);
  g.addColorStop(0, a(C.h1, 0.075 + energy * 0.05));
  g.addColorStop(1, a(C.h1, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const ax = W * 0.84 + noise1(gt * 0.07, 5) * 50;
  const ay = H * 0.82 + noise1(gt * 0.08, 6) * 40;
  g = ctx.createRadialGradient(ax, ay, 0, ax, ay, W * 0.5);
  g.addColorStop(0, a(C.accent, 0.05 + energy * 0.04));
  g.addColorStop(1, a(C.accent, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  drawHexField(ctx, gt, energy);
  drawParticles(ctx, gt);
  drawVignette(ctx);

  ctx.restore();
}

function drawHexField(ctx: Ctx, gt: number, energy: number): void {
  const dx = ((gt * 7) % (HEX_R * 1.5)) - HEX_R * 1.5;
  const dy = ((gt * -4) % (HEX_R * Math.sqrt(3))) + HEX_R * Math.sqrt(3);
  ctx.save();
  ctx.lineWidth = 1.2;
  for (let c = -2; c < COLS; c++) {
    const cx = c * HEX_R * 1.5 + dx;
    for (let r = -2; r < ROWS; r++) {
      const cy = r * HEX_R * Math.sqrt(3) + (c % 2 ? (HEX_R * Math.sqrt(3)) / 2 : 0) + dy;
      // волна подсветки, бегущая по полю
      const wave = Math.sin(cx * 0.004 + cy * 0.005 - gt * 0.9);
      const base = 0.035 + Math.max(0, wave) * (0.05 + energy * 0.16);
      const flick = hash21(c, r);
      const alpha = base * (0.5 + flick * 0.9);
      ctx.strokeStyle = a(flick > 0.94 ? C.h1 : C.text, alpha);
      hexPath(ctx, cx, cy, HEX_R * 0.92);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawParticles(ctx: Ctx, gt: number): void {
  ctx.save();
  for (const p of PARTICLES) {
    const y = (((p.y - gt * p.spd) % (H + 60)) + H + 60) % (H + 60);
    const x = p.x + noise1(gt * 0.25, p.seed) * p.drift;
    const tw = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(gt * 1.6 + p.seed));
    ctx.fillStyle = a(p.seed % 7 === 0 ? C.accent : C.h1, tw * 0.5);
    ctx.beginPath();
    ctx.arc(x, y - 30, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawVignette(ctx: Ctx): void {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
