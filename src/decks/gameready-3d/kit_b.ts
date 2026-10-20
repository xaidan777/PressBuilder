/**
 * Помощники сцен s05–s08 (группа B): генератор-гекс, облако мысли,
 * модель в кадре-картинке, «чужой» танк из кубов, танк игры с эволюцией,
 * иконки «один ракурс / мультивью».
 */

import { clamp01, easeOutBack, hash11 } from '../../engine/anim.ts';
import { hexPath, rrPath, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { a, C } from '../../engine/theme.ts';
import { MESH } from '../../engine/wire3d.ts';
import {
  DARK,
  drawModel,
  groundShadow,
  imageFrame,
  prop,
  type ModelOpts,
  type Part,
  type Rect,
  type Root,
  type V3,
  type View,
} from './common.ts';

type Ctx = CanvasRenderingContext2D;

/** Линейная интерполяция прямоугольников. */
export function lerpRect(p: Rect, q: Rect, k: number): Rect {
  return {
    x: p.x + (q.x - p.x) * k,
    y: p.y + (q.y - p.y) * k,
    w: p.w + (q.w - p.w) * k,
    h: p.h + (q.h - p.h) * k,
  };
}

/** Генератор: гекс с крутящимся кубом; `busy` — светится и крутится быстрее. */
export function genHex(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  o: { p?: number; busy?: number; t: number; color?: string },
): void {
  const p = clamp01(o.p ?? 1);
  if (p <= 0) return;
  const color = o.color ?? C.h1;
  const busy = clamp01(o.busy ?? 0);
  const s = easeOutBack(p, 1.6);
  ctx.save();
  ctx.globalAlpha *= Math.min(1, p * 2.4);
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  if (busy > 0) softLight(ctx, 0, 0, r * 2.4, color, 0.28 * busy);
  ctx.save();
  ctx.shadowColor = a(color, 0.25 + 0.5 * busy);
  ctx.shadowBlur = 30 + 40 * busy;
  hexPath(ctx, 0, 0, r, Math.PI / 6);
  ctx.fillStyle = C.panel;
  ctx.fill();
  ctx.restore();
  hexPath(ctx, 0, 0, r, Math.PI / 6);
  ctx.strokeStyle = a(color, 0.65 + 0.35 * busy);
  ctx.lineWidth = 3.5;
  ctx.stroke();
  // внутреннее кольцо — бегущий пунктир
  ctx.save();
  ctx.setLineDash([r * 0.18, r * 0.12]);
  ctx.lineDashOffset = -o.t * r * (0.3 + busy * 1.6);
  hexPath(ctx, 0, 0, r * 0.82, Math.PI / 6);
  ctx.strokeStyle = a(color, 0.25 + 0.45 * busy);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  icon(ctx, 'cube', 0, 0, r * 0.92, color, o.t * (1 + busy * 3));
  ctx.restore();
}

/** Облако мысли (центр, размеры) с хвостиком из пузырьков к точке `tail`. */
export function thoughtCloud(
  ctx: Ctx,
  cx: number,
  cy: number,
  w: number,
  h: number,
  o: { p?: number; color?: string; tail?: [number, number]; glow?: number },
): void {
  const p = clamp01(o.p ?? 1);
  if (p <= 0) return;
  const color = o.color ?? C.h1;
  const rb = h * 0.27;
  const ex = w / 2 - rb;
  const ey = h / 2 - rb;
  const N = 11;
  const bumps: Array<[number, number, number]> = [];
  for (let i = 0; i < N; i++) {
    const ang = (Math.PI * 2 * i) / N + 0.2;
    const r = rb * (0.82 + 0.36 * hash11(i * 7.1 + 3));
    bumps.push([cx + Math.cos(ang) * ex, cy + Math.sin(ang) * ey, r]);
  }
  const s = easeOutBack(p, 1.4);
  ctx.save();
  ctx.globalAlpha *= Math.min(1, p * 2.4);
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.translate(-cx, -cy);
  const shape = () => {
    ctx.beginPath();
    for (const [x, y, r] of bumps) {
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.moveTo(cx + ex, cy);
    ctx.ellipse(cx, cy, ex, ey, 0, 0, Math.PI * 2);
  };
  // хвостик
  if (o.tail) {
    const [tx, ty] = o.tail;
    for (let i = 0; i < 3; i++) {
      const k = 0.25 + i * 0.25;
      const x = tx + (cx - tx) * k * 0.62;
      const y = ty + (cy + ey * 0.6 - ty) * k * 0.9;
      ctx.beginPath();
      ctx.arc(x, y, 8 + i * 7, 0, Math.PI * 2);
      ctx.fillStyle = C.panel;
      ctx.fill();
      ctx.strokeStyle = a(color, 0.55);
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }
  const g = clamp01(o.glow ?? 0);
  ctx.save();
  ctx.shadowColor = a(color, 0.2 + 0.5 * g);
  ctx.shadowBlur = 40 + 40 * g;
  ctx.strokeStyle = a(color, 0.55 + 0.4 * g);
  ctx.lineWidth = 6;
  shape();
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = C.panel;
  shape();
  ctx.fill();
  ctx.restore();
}

/** Модель внутри кадра-картинки: свет, тень, модель. `foot` — экранная y «пола». */
export function modelShot(
  ctx: Ctx,
  r: Rect,
  parts: Part[],
  o: {
    size: number;
    yaw?: number;
    pitch?: number;
    dist?: number;
    foot?: number;
    cx?: number;
    root?: Root;
    model?: ModelOpts;
    color?: string;
    shadow?: [number, number];
    tilt?: number;
  },
): void {
  imageFrame(
    ctx,
    r,
    () => {
      const view: View = {
        cx: o.cx ?? r.x + r.w / 2,
        cy: o.foot ?? r.y + r.h * 0.8,
        size: o.size,
        pitch: o.pitch ?? 0.3,
        yaw: o.yaw ?? 0,
        dist: o.dist ?? 9,
      };
      softLight(ctx, r.x + r.w / 2, r.y + r.h * 0.45, Math.max(r.w, r.h) * 0.7, o.color ?? C.accent, 0.1);
      const sh = o.shadow ?? [1, 0.8];
      groundShadow(ctx, view, 0, 0, sh[0], sh[1], 0.4);
      drawModel(ctx, parts, view, o.root ?? {}, o.model ?? { bands: 3 });
    },
    { color: o.color, tilt: o.tilt },
  );
}

const box = (pos: V3, size: V3, color: string): Part => ({ mesh: MESH.cube, pos, size, color });

const OLIVE = '#7f8b5e';
const OLIVE_D = '#646d49';
const STEEL = '#8d949a';

/**
 * «Какой-то» танк, которого не задумывали: грубые кубы, перёд — +Z, длина ≈ 3.4
 * (как у танка игры в масштабе prop).
 */
export const ALIEN_TANK: Part[] = [
  box([0.74, 0.3, 0], [0.42, 0.6, 3.4], DARK),
  box([-0.74, 0.3, 0], [0.42, 0.6, 3.4], DARK),
  box([0, 0.66, 0.05], [1.3, 0.42, 3.0], OLIVE),
  box([0, 0.66, 1.62], [1.1, 0.24, 0.3], OLIVE_D),
  box([0, 1.06, -0.25], [1.06, 0.42, 1.3], OLIVE_D),
  box([0.62, 1.04, -0.35], [0.24, 0.32, 0.9], STEEL),
  box([-0.62, 1.04, -0.35], [0.24, 0.32, 0.9], STEEL),
  box([0.17, 1.1, 1.3], [0.12, 0.12, 2.0], STEEL),
  box([-0.17, 1.1, 1.3], [0.12, 0.12, 2.0], STEEL),
  box([-0.32, 1.66, -0.7], [0.04, 0.84, 0.04], STEEL),
];

/** Танк игры DULO с навесными деталями эволюции (броня, руны, флаг); перёд — +Z. */
export const EVO_TANK: Part[] = [...prop('tank'), ...prop('tank_evo')];
/** Танк игры без эволюции; перёд — +Z. */
export const BASE_TANK: Part[] = prop('tank');

/** Иконка «один ракурс»: один кадр с силуэтом. */
export function oneViewIcon(ctx: Ctx, cx: number, cy: number, s: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2.5, s * 0.06);
  ctx.lineJoin = 'round';
  rrPath(ctx, cx - s * 0.5, cy - s * 0.4, s, s * 0.8, s * 0.08);
  ctx.stroke();
  silhouette(ctx, cx, cy + s * 0.04, s * 0.5, color);
  ctx.restore();
}

/** Иконка «мультивью»: четыре кадра 2×2. */
export function multiViewIcon(ctx: Ctx, cx: number, cy: number, s: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2.5, s * 0.05);
  ctx.lineJoin = 'round';
  const w = s * 0.47;
  const h = s * 0.37;
  for (let i = 0; i < 4; i++) {
    const x = cx - s * 0.5 + (i % 2) * (w + s * 0.06);
    const y = cy - s * 0.4 + Math.floor(i / 2) * (h + s * 0.06);
    rrPath(ctx, x, y, w, h, s * 0.05);
    ctx.stroke();
    silhouette(ctx, x + w / 2, y + h / 2 + h * 0.05, h * 0.62, color);
  }
  ctx.restore();
}

/** Силуэт «персонажа»: голова и плечи. */
function silhouette(ctx: Ctx, cx: number, cy: number, s: number, color: string): void {
  ctx.fillStyle = a(color, 0.85);
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.32, s * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.32, s * 0.38, s * 0.3, 0, Math.PI, 0);
  ctx.fill();
}
