/**
 * Лицо мага крупным планом для сравнения топологии (s09): сетка P2.0 и ретопологии Tripo
 * рисуются живыми мешами, хай-поли — рендером из Blender (face_hi.png) с лупой, где видны
 * настоящие треугольники. Петли у рта и глаз — из faces.ts (найдены в Blender).
 */

import { clamp01, easeOutBack, easeOutQuart } from '../../engine/anim.ts';
import { a, C } from '../../engine/theme.ts';
import { CLAY, drawModel, placePoint, toScreen, type Part, type Rect, type Root, type V3, type View } from './common.ts';
import { FACES, type FaceMesh } from './faces.ts';

type Ctx = CanvasRenderingContext2D;
export type FaceKind = 'p2' | 'retopo' | 'hi';

/** Окно вырезки вокруг губ (как у рендера хай-поли): x ±0.075, y −0.07…0.065. */
const BOX = { w: 0.15, h: 0.135, cy: -0.0025 };

const SOUPS = new Map<FaceKind, Part[]>();
function parts(kind: FaceKind): Part[] {
  const hit = SOUPS.get(kind);
  if (hit) return hit;
  const m = FACES[kind];
  const idx: number[] = [];
  const mask: number[] = [];
  for (const poly of m.polys) {
    const k = poly.length;
    for (let i = 1; i < k - 1; i++) {
      idx.push(poly[0], poly[i], poly[i + 1]);
      mask.push((i === 1 ? 1 : 0) | 2 | (i + 1 === k - 1 ? 4 : 0));
    }
  }
  const clay = parseInt(CLAY.slice(1), 16);
  const p: Part[] = [
    {
      soup: { pos: m.verts, idx, col: idx.map(() => clay).filter((_, i) => i % 3 === 0), glow: new Set(), mask: kind === 'hi' ? undefined : mask, welded: true },
      pos: [0, 0, 0],
      size: [1, 1, 1],
    },
  ];
  SOUPS.set(kind, p);
  return p;
}

let IMG: HTMLImageElement | null = null;
function hiImage(): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  if (!IMG) {
    IMG = new Image();
    IMG.src = new URL('./face_hi.png', import.meta.url).href;
  }
  return IMG.complete && IMG.naturalWidth > 0 ? IMG : null;
}
hiImage();

/** Вид на лицо, вписанное в прямоугольник. */
export function faceView(r: Rect, yaw = 0): View {
  const size = Math.min(r.w / BOX.w, r.h / BOX.h);
  return { cx: r.x + r.w / 2, cy: r.y + r.h / 2, size, pitch: 0, yaw, dist: Infinity };
}

const ROOT: Root = { pos: [0, -BOX.cy, 0] };

/** Точка лица (координаты от губ) на экране. */
export function facePoint(kind: FaceKind, vi: number, view: View): [number, number] {
  const v = FACES[kind].verts;
  return toScreen(placePoint([v[vi * 3], v[vi * 3 + 1], v[vi * 3 + 2]] as V3, ROOT), view);
}

/** Центры рта и глаз: у P2.0 — центры найденных колец, у остальных — по пропорциям лица. */
export function focusPoints(kind: FaceKind): Record<'mouth' | 'eyeL' | 'eyeR', V3> {
  const m = FACES[kind];
  const cen = (key: string, fb: V3): V3 => {
    const l = m.loops[key];
    if (!l || !l.closed || !l.loops.length) return fb;
    const lp = l.loops[0];
    const s: V3 = [0, 0, 0];
    for (const i of lp) for (let k = 0; k < 3; k++) s[k] += m.verts[i * 3 + k] / lp.length;
    return s;
  };
  // у ретопологии и хай-поли — измерено по рендеру хай-поли (та же генерация)
  const ey = kind === 'p2' ? 0.04 : 0.0325;
  const ex = kind === 'p2' ? 0.017 : 0.0155;
  return {
    mouth: cen('mouth', [0, kind === 'p2' ? 0.004 : -0.004, 0]),
    eyeL: cen('eyeL', [ex, ey, -0.01]),
    eyeR: cen('eyeR', [-ex, ey, -0.01]),
  };
}

export interface FaceOpts {
  yaw?: number;
  /** Каркас: цвет рёбер (квады — без диагоналей; у хай-поли — треугольники). */
  wire?: string;
  /** Проявление 0..1 снизу вверх. */
  p?: number;
}

/** Лицо: живая сетка (p2, retopo) или рендер хай-поли. */
export function drawFace(ctx: Ctx, kind: FaceKind, r: Rect, o: FaceOpts = {}): View {
  const view = faceView(r, kind === 'hi' ? 0 : (o.yaw ?? 0));
  const p = clamp01(o.p ?? 1);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y + r.h * (1 - easeOutQuart(p)), r.w, r.h * easeOutQuart(p));
  ctx.clip();
  if (kind === 'hi') {
    const img = hiImage();
    if (img) {
      const w = BOX.w * view.size;
      const h = BOX.h * view.size;
      ctx.drawImage(img, view.cx - w / 2, view.cy - h / 2, w, h);
    }
  } else {
    drawModel(ctx, parts(kind), view, ROOT, { tint: CLAY, wire: o.wire ?? a(C.bg, 0.55), wireWidth: 1.4, smooth: 0.9 });
  }
  ctx.restore();
  return view;
}

/** Лупа у уголка рта хай-поли (справа от рамки r): настоящие треугольники сетки. */
export function hiLoupe(ctx: Ctx, view: View, r: Rect, p: number, t = 0): void {
  const pr = clamp01(p);
  if (pr <= 0) return;
  const at = toScreen(placePoint([0.015, 0, 0], ROOT), view);
  const R0 = 160;
  const R = R0 * easeOutBack(pr, 1.4);
  const zoom = 3.2;
  const lc: [number, number] = [r.x + r.w + 40 + R0, at[1] - 90];
  const lv: View = { ...view, size: view.size * zoom, cx: lc[0], cy: lc[1] };
  ctx.save();
  ctx.globalAlpha *= Math.min(1, pr * 2);
  ctx.strokeStyle = a(C.accent, 0.8);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(at[0], at[1], 26, 0, Math.PI * 2);
  const dx = lc[0] - at[0];
  const dy = lc[1] - at[1];
  const dl = Math.hypot(dx, dy);
  ctx.moveTo(at[0] + (dx / dl) * 26, at[1] + (dy / dl) * 26);
  ctx.lineTo(lc[0] - (dx / dl) * R, lc[1] - (dy / dl) * R);
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.arc(lc[0], lc[1], R, 0, Math.PI * 2);
  ctx.fillStyle = '#22252a';
  ctx.fill();
  ctx.clip();
  // в лупе — пятно у уголка рта: центр пятна в лупе
  const lroot: Root = { pos: [-0.015, 0, 0] };
  const lview: View = { ...lv, cx: lc[0], cy: lc[1] };
  drawModel(ctx, parts('hi'), lview, lroot, { tint: CLAY, wire: a(C.bg, 0.7), wireWidth: 1, smooth: 0.9 });
  ctx.restore();
  ctx.strokeStyle = C.accent;
  ctx.lineWidth = 5 + Math.sin(t * 3) * 0.6;
  ctx.shadowColor = a(C.accent, 0.6);
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(lc[0], lc[1], R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Радиусы кружков фокуса (доли роста). */
const RAD = { mouth: 0.016, eyeL: 0.0105, eyeR: 0.0105 };

/** Радиус кружка фокуса: не меньше RAD и с запасом снаружи найденного кольца. */
function focusRadius(kind: FaceKind, k: 'mouth' | 'eyeL' | 'eyeR', c: V3): number {
  const l = FACES[kind].loops[k];
  let r = RAD[k];
  if (l && l.closed) {
    const v = FACES[kind].verts;
    for (const lp of l.loops) for (const i of lp) r = Math.max(r, Math.hypot(v[i * 3] - c[0], v[i * 3 + 1] - c[1]) * 1.3);
  }
  return r;
}

/** Рёбра сетки, обращённые к камере (для подсветки участка). */
const EDGES = new Map<FaceKind, [number, number][]>();
function frontEdges(kind: FaceKind): [number, number][] {
  const hit = EDGES.get(kind);
  if (hit) return hit;
  const m = FACES[kind];
  const v = m.verts;
  const seen = new Set<number>();
  const out: [number, number][] = [];
  const n = v.length / 3;
  for (const poly of m.polys) {
    const [i0, i1, i2] = poly;
    const ax = v[i1 * 3] - v[i0 * 3], ay = v[i1 * 3 + 1] - v[i0 * 3 + 1];
    const bx = v[i2 * 3] - v[i0 * 3], by = v[i2 * 3 + 1] - v[i0 * 3 + 1];
    const az = v[i1 * 3 + 2] - v[i0 * 3 + 2], bz = v[i2 * 3 + 2] - v[i0 * 3 + 2];
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    if (nz <= 0.25 * Math.hypot(nx, ny, nz)) continue;
    for (let j = 0; j < poly.length; j++) {
      const a0 = poly[j];
      const b0 = poly[(j + 1) % poly.length];
      const key = Math.min(a0, b0) * n + Math.max(a0, b0);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push([a0, b0]);
    }
  }
  EDGES.set(kind, out);
  return out;
}

/** Пунктирные кружки фокуса вокруг рта и глаз. */
export function focusRings(ctx: Ctx, kind: FaceKind, view: View, p: number, color: string, t = 0): void {
  const pr = clamp01(p);
  if (pr <= 0) return;
  const F = focusPoints(kind);
  (['eyeL', 'eyeR', 'mouth'] as const).forEach((k, i) => {
    const kp = clamp01(pr * 3 - i * 0.6);
    if (kp <= 0) return;
    const [x, y] = toScreen(placePoint(F[k], ROOT), view);
    ctx.save();
    ctx.globalAlpha *= Math.min(1, kp * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 9]);
    ctx.lineDashOffset = -t * 20;
    ctx.beginPath();
    ctx.arc(x, y, focusRadius(kind, k, F[k]) * view.size * (1.3 - 0.3 * easeOutQuart(kp)), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

/**
 * Петли у рта и глаз: кольца (P2.0) зажигаются по очереди и светятся; у ретопологии — линии
 * сетки сквозь рот и глаза, обрезанные кружком фокуса.
 */
export function drawLoops(ctx: Ctx, kind: FaceKind, view: View, p: number, color: string): void {
  const pr = clamp01(p);
  if (pr <= 0) return;
  const m: FaceMesh = FACES[kind];
  const F = focusPoints(kind);
  (['eyeL', 'eyeR', 'mouth'] as const).forEach((k, i) => {
    const l = m.loops[k];
    if (!l) return;
    const kp = clamp01(pr * 3 - i * 0.7);
    if (kp <= 0) return;
    ctx.save();
    if (!l.closed) {
      // колец нет: подсвечиваем сетку внутри кружка — рёбра идут сквозь рот и глаз
      const [cx, cy] = toScreen(placePoint(F[k], ROOT), view);
      ctx.beginPath();
      ctx.arc(cx, cy, RAD[k] * view.size * easeOutQuart(kp), 0, Math.PI * 2);
      ctx.clip();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.shadowColor = a(color, 0.7);
      ctx.shadowBlur = 10;
      ctx.beginPath();
      for (const [i0, i1] of frontEdges(kind)) {
        const [x0, y0] = facePoint(kind, i0, view);
        const [x1, y1] = facePoint(kind, i1, view);
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
      }
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.strokeStyle = color;
    // несколько концентрических колец — тоньше, чтобы не сливались
    ctx.lineWidth = l.loops.length > 1 ? 4 : 6;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = a(color, 0.7);
    ctx.shadowBlur = 16;
    for (const lp of l.loops) {
      const n = Math.max(2, Math.round(lp.length * easeOutQuart(kp)));
      ctx.beginPath();
      for (let j = 0; j < n; j++) {
        const [x, y] = facePoint(kind, lp[j], view);
        if (j) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      if (l.closed && kp >= 1) ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  });
}
