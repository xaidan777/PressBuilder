/**
 * 2D-скелет: прямая и обратная кинематика, кости «как в Blender», шагающий
 * человечек. Всё — чистые функции: поза считается из пройденного пути,
 * поэтому ноги не проскальзывают, а перемотка даёт тот же кадр.
 */

import { clamp, clamp01, easeInOutCubic } from './anim.ts';
import { a, C } from './theme.ts';

type Ctx = CanvasRenderingContext2D;
export type Pt = [number, number];

/**
 * Обратная кинематика двух костей (бедро+голень, плечо+предплечье):
 * где сустав `mid`, если кость начинается в `root` и тянется к `target`.
 * `bend` +1 / −1 — в какую сторону сгибается сустав.
 */
export function ik2(root: Pt, target: Pt, l1: number, l2: number, bend = 1): { mid: Pt; end: Pt } {
  let dx = target[0] - root[0];
  let dy = target[1] - root[1];
  let d = Math.hypot(dx, dy) || 1e-6;
  const dMax = l1 + l2 - 1e-3;
  const dMin = Math.abs(l1 - l2) + 1e-3;
  const dc = clamp(d, dMin, dMax);
  dx *= dc / d;
  dy *= dc / d;
  d = dc;
  const A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const ang = Math.atan2(dy, dx) - A * bend;
  return { mid: [root[0] + Math.cos(ang) * l1, root[1] + Math.sin(ang) * l1], end: [root[0] + dx, root[1] + dy] };
}

/** Прямая кинематика: цепочка от `root`, каждый сегмент — [длина, угол относительно предыдущего]. */
export function fk(root: Pt, segs: Array<[number, number]>, base = 0): Pt[] {
  const pts: Pt[] = [root];
  let ang = base;
  let [x, y] = root;
  for (const [len, rel] of segs) {
    ang += rel;
    x += Math.cos(ang) * len;
    y += Math.sin(ang) * len;
    pts.push([x, y]);
  }
  return pts;
}

/** Кость как в Blender: вытянутый ромб от головы `h` к хвосту `t`, кружок на голове. */
export function bone(ctx: Ctx, h: Pt, t: Pt, color: string = C.h1, width?: number): void {
  const dx = t[0] - h[0];
  const dy = t[1] - h[1];
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const w = width ?? len * 0.13;
  const ux = dx / len;
  const uy = dy / len;
  const mx = h[0] + dx * 0.18;
  const my = h[1] + dy * 0.18;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(h[0], h[1]);
  ctx.lineTo(mx - uy * w, my + ux * w);
  ctx.lineTo(t[0], t[1]);
  ctx.lineTo(mx + uy * w, my - ux * w);
  ctx.closePath();
  ctx.fillStyle = a(color, 0.35);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(h[0], h[1], w * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = C.bg;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Поза человечка в координатах кадра. */
export interface Pose {
  hip: Pt;
  chest: Pt;
  head: Pt;
  /** Радиус головы. */
  headR: number;
  /** Ноги и руки: [дальняя, ближняя] — дальнюю рисуют первой и темнее. */
  knee: [Pt, Pt];
  foot: [Pt, Pt];
  elbow: [Pt, Pt];
  hand: [Pt, Pt];
}

/** Длина шага человечка ростом `h`. */
export const strideOf = (h: number) => h * 0.36;

/**
 * Поза при ходьбе. `dist` — сколько пройдено (px) с начала: фаза цикла считается
 * из него, поэтому при `x = x0 + dist` стопа на опоре стоит на месте.
 * `ground` — линия пола, `h` — рост, `dir` — 1 вправо, −1 влево.
 */
export function walkPose(x: number, ground: number, h: number, dist: number, dir = 1): Pose {
  const S = strideOf(h);
  const thigh = h * 0.25;
  const shin = h * 0.24;
  const phase = (((dist / (2 * S)) % 1) + 1) % 1;
  const hipY = ground - (thigh + shin) * 0.96 + Math.cos(phase * Math.PI * 4) * h * 0.012;
  const hip: Pt = [x, hipY];

  const leg = (u: number): { foot: Pt; knee: Pt } => {
    let rel: number;
    let lift = 0;
    if (u < 0.5) {
      rel = S / 2 - S * (u / 0.5);
    } else {
      const s = (u - 0.5) / 0.5;
      rel = -S / 2 + S * easeInOutCubic(s);
      lift = Math.sin(s * Math.PI) * h * 0.075;
    }
    const foot: Pt = [x + rel * dir, ground - lift];
    return { foot, knee: ik2(hip, foot, thigh, shin, dir).mid };
  };
  const l1 = leg(phase);
  const l2 = leg((phase + 0.5) % 1);

  const chest: Pt = [x + dir * h * 0.025, hipY - h * 0.3];
  const head: Pt = [chest[0] + dir * h * 0.02, chest[1] - h * 0.13];
  const arm = (u: number): { elbow: Pt; hand: Pt } => {
    const swing = Math.sin(u * Math.PI * 2) * 0.5 * dir;
    const [, elbow, hand] = fk(chest, [
      [h * 0.16, Math.PI / 2 - swing],
      [h * 0.15, -0.35 * dir - Math.max(0, swing * dir) * 0.6 * dir],
    ]);
    return { elbow, hand };
  };
  // рука движется в противофазе со своей ногой
  const a1 = arm((phase + 0.5) % 1);
  const a2 = arm(phase);
  return {
    hip,
    chest,
    head,
    headR: h * 0.085,
    knee: [l1.knee, l2.knee],
    foot: [l1.foot, l2.foot],
    elbow: [a1.elbow, a2.elbow],
    hand: [a1.hand, a2.hand],
  };
}

export interface FigureOpts {
  /** Цвет «кожи» фигуры (плоский силуэт). */
  color?: string;
  /** Толщина конечностей, по умолчанию от роста. */
  limb?: number;
  /** Непрозрачность силуэта 0..1 (0 — только кости). */
  skin?: number;
  /** Непрозрачность костей поверх 0..1. */
  bones?: number;
  boneColor?: string;
}

/** Рисует фигуру по позе: плоский силуэт и/или кости. */
export function figure(ctx: Ctx, P: Pose, o: FigureOpts = {}): void {
  const color = o.color ?? C.text;
  const lw = o.limb ?? P.headR * 0.75;
  const skin = clamp01(o.skin ?? 1);
  const bones = clamp01(o.bones ?? 0);
  ctx.save();
  if (skin > 0) {
    ctx.save();
    ctx.globalAlpha *= skin;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const limb = (pts: Pt[], c: string) => {
      ctx.strokeStyle = c;
      ctx.lineWidth = lw;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    };
    const far = a(color, 0.55);
    limb([P.chest, P.elbow[0], P.hand[0]], far);
    limb([P.hip, P.knee[0], P.foot[0]], far);
    ctx.lineWidth = lw * 1.7;
    limb([P.hip, P.chest], color);
    ctx.lineWidth = lw;
    limb([P.hip, P.knee[1], P.foot[1]], color);
    limb([P.chest, P.elbow[1], P.hand[1]], color);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(P.head[0], P.head[1], P.headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (bones > 0) {
    ctx.save();
    ctx.globalAlpha *= bones;
    const bc = o.boneColor ?? C.h1;
    bone(ctx, P.hip, P.chest, bc);
    bone(ctx, P.chest, P.head, bc);
    for (let i = 0; i < 2; i++) {
      bone(ctx, P.hip, P.knee[i], bc);
      bone(ctx, P.knee[i], P.foot[i], bc);
      bone(ctx, P.chest, P.elbow[i], bc);
      bone(ctx, P.elbow[i], P.hand[i], bc);
    }
    ctx.restore();
  }
  ctx.restore();
}
