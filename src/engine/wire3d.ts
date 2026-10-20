/**
 * Псевдо-3D на канвасе: поворот, перспектива, каркасы и плоская заливка граней.
 * Нужен там, где речь идёт о трёхмерной графике: кубы, низкополигональные тела,
 * сетка «пола». Всё считается из времени, без состояния.
 *
 * Система координат: X — вправо, Y — вверх, Z — на зрителя.
 */

import { clamp01, easeOutCubic } from './anim.ts';

type Ctx = CanvasRenderingContext2D;
export type V3 = [number, number, number];

export interface Mesh {
  verts: V3[];
  /**
   * Грани. У выпуклого тела порядок обхода не важен: нормаль выправляется от центра.
   * У `oriented` — обход против часовой стрелки, если смотреть снаружи (так строит `extrude`).
   */
  faces: number[][];
  edges: Array<[number, number]>;
  /** Нормали берутся из порядка обхода — для невыпуклых тел (выдавленный контур). */
  oriented?: boolean;
}

export interface View {
  cx: number;
  cy: number;
  /** Пикселей на единицу модели (на плоскости фокуса). */
  size: number;
  /** Наклон камеры вниз, рад (π/2 — вид строго сверху). */
  pitch?: number;
  /** Поворот камеры вокруг вертикали, рад. */
  yaw?: number;
  /** Дистанция камеры в единицах модели; Infinity — без перспективы. */
  dist?: number;
}

export interface Xform {
  pos?: V3;
  scale?: number | V3;
  /** Собственное вращение тела: вокруг Y, затем X, затем Z. */
  ry?: number;
  rx?: number;
  rz?: number;
}

// ---------------------------------------------------------------- меши

function meshOf(verts: V3[], faces: number[][]): Mesh {
  const seen = new Set<string>();
  const edges: Array<[number, number]> = [];
  for (const f of faces) {
    f.forEach((v, i) => {
      const w = f[(i + 1) % f.length];
      const key = v < w ? `${v}:${w}` : `${w}:${v}`;
      if (seen.has(key)) return;
      seen.add(key);
      edges.push([v, w]);
    });
  }
  return { verts, faces, edges };
}

/** Правильная n-угольная призма: радиус 0.5, высота 1. При n ≥ 12 читается как цилиндр. */
function prism(n: number): Mesh {
  const verts: V3[] = [];
  for (const y of [0.5, -0.5]) {
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n;
      verts.push([Math.cos(ang) * 0.5, y, Math.sin(ang) * 0.5]);
    }
  }
  const ring = (from: number) => Array.from({ length: n }, (_, i) => from + i);
  const faces = [ring(0), ring(n)];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push([i, j, n + j, n + i]);
  }
  return meshOf(verts, faces);
}

/**
 * Выдавливание плоского контура в тело толщиной `depth` (контур в плоскости XY,
 * Y вверх; вогнутый — можно). Так из знака «MY» получается объёмный логотип:
 * `extrude(ICON_POINTS.map(([u, v]) => [(u - 0.5) * ICON_ASPECT, 0.5 - v]), 0.3)`.
 */
export function extrude(pts: Array<[number, number]>, depth: number): Mesh {
  let area = 0;
  pts.forEach(([x1, y1], i) => {
    const [x2, y2] = pts[(i + 1) % pts.length];
    area += x1 * y2 - x2 * y1;
  });
  const ring = area >= 0 ? pts : [...pts].reverse();
  const n = ring.length;
  const verts: V3[] = [
    ...ring.map(([x, y]): V3 => [x, y, depth / 2]),
    ...ring.map(([x, y]): V3 => [x, y, -depth / 2]),
  ];
  const faces: number[][] = [
    Array.from({ length: n }, (_, i) => i),
    Array.from({ length: n }, (_, i) => 2 * n - 1 - i),
  ];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push([i, n + i, n + j, j]);
  }
  return { ...meshOf(verts, faces), oriented: true };
}

const PHI = (1 + Math.sqrt(5)) / 2;
const ICO_R = 0.62 / Math.hypot(1, PHI);

export const MESH = {
  cube: meshOf(
    [
      [-0.5, -0.5, -0.5],
      [0.5, -0.5, -0.5],
      [0.5, 0.5, -0.5],
      [-0.5, 0.5, -0.5],
      [-0.5, -0.5, 0.5],
      [0.5, -0.5, 0.5],
      [0.5, 0.5, 0.5],
      [-0.5, 0.5, 0.5],
    ],
    [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [0, 1, 5, 4],
      [3, 2, 6, 7],
      [0, 3, 7, 4],
      [1, 2, 6, 5],
    ],
  ),
  pyramid: meshOf(
    [
      [-0.5, -0.5, -0.5],
      [0.5, -0.5, -0.5],
      [0.5, -0.5, 0.5],
      [-0.5, -0.5, 0.5],
      [0, 0.5, 0],
    ],
    [
      [0, 1, 2, 3],
      [0, 1, 4],
      [1, 2, 4],
      [2, 3, 4],
      [3, 0, 4],
    ],
  ),
  octa: meshOf(
    [
      [0.62, 0, 0],
      [-0.62, 0, 0],
      [0, 0.62, 0],
      [0, -0.62, 0],
      [0, 0, 0.62],
      [0, 0, -0.62],
    ],
    [
      [2, 0, 4],
      [2, 4, 1],
      [2, 1, 5],
      [2, 5, 0],
      [3, 4, 0],
      [3, 1, 4],
      [3, 5, 1],
      [3, 0, 5],
    ],
  ),
  icosa: meshOf(
    (
      [
        [-1, PHI, 0],
        [1, PHI, 0],
        [-1, -PHI, 0],
        [1, -PHI, 0],
        [0, -1, PHI],
        [0, 1, PHI],
        [0, -1, -PHI],
        [0, 1, -PHI],
        [PHI, 0, -1],
        [PHI, 0, 1],
        [-PHI, 0, -1],
        [-PHI, 0, 1],
      ] as V3[]
    ).map(([x, y, z]): V3 => [x * ICO_R, y * ICO_R, z * ICO_R]),
    [
      [0, 11, 5],
      [0, 5, 1],
      [0, 1, 7],
      [0, 7, 10],
      [0, 10, 11],
      [1, 5, 9],
      [5, 11, 4],
      [11, 10, 2],
      [10, 7, 6],
      [7, 1, 8],
      [3, 9, 4],
      [3, 4, 2],
      [3, 2, 6],
      [3, 6, 8],
      [3, 8, 9],
      [4, 9, 5],
      [2, 4, 11],
      [6, 2, 10],
      [8, 6, 7],
      [9, 8, 1],
    ],
  ),
  hexPrism: prism(6),
  cylinder: prism(14),
} as const;

// ---------------------------------------------------------------- преобразования

const sub = (p: V3, q: V3): V3 => [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
const dot = (p: V3, q: V3) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
function unit(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** Нормаль многоугольника методом Ньюэлла — верна и для невыпуклых граней. */
function newell(pts: V3[]): V3 {
  const n: V3 = [0, 0, 0];
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    n[0] += (p[1] - q[1]) * (p[2] + q[2]);
    n[1] += (p[2] - q[2]) * (p[0] + q[0]);
    n[2] += (p[0] - q[0]) * (p[1] + q[1]);
  });
  return n;
}

/** Модель → мир: масштаб, собственное вращение, перенос. */
function place(v: V3, xf: Xform): V3 {
  const s = xf.scale ?? 1;
  const [sx, sy, sz] = typeof s === 'number' ? [s, s, s] : s;
  let x = v[0] * sx;
  let y = v[1] * sy;
  let z = v[2] * sz;
  if (xf.ry) {
    const c = Math.cos(xf.ry);
    const n = Math.sin(xf.ry);
    [x, z] = [x * c + z * n, -x * n + z * c];
  }
  if (xf.rx) {
    const c = Math.cos(xf.rx);
    const n = Math.sin(xf.rx);
    [y, z] = [y * c - z * n, y * n + z * c];
  }
  if (xf.rz) {
    const c = Math.cos(xf.rz);
    const n = Math.sin(xf.rz);
    [x, y] = [x * c - y * n, x * n + y * c];
  }
  const p = xf.pos;
  return p ? [x + p[0], y + p[1], z + p[2]] : [x, y, z];
}

/** Мир → пространство камеры. */
function look(v: V3, view: View): V3 {
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

const DEFAULT_DIST = 7;

function toScreen(c: V3, view: View): [number, number] {
  const d = view.dist ?? DEFAULT_DIST;
  const f = Number.isFinite(d) ? d / Math.max(0.2, d - c[2]) : 1;
  return [view.cx + c[0] * view.size * f, view.cy - c[1] * view.size * f];
}

/** Точка мира → экран. Третье значение — глубина (больше = ближе к зрителю). */
export function project(v: V3, view: View): [number, number, number] {
  const c = look(v, view);
  const [sx, sy] = toScreen(c, view);
  return [sx, sy, c[2]];
}

/** Глубина точки мира — для сортировки тел «дальние сначала». */
export const depthOf = (pos: V3, view: View) => look(pos, view)[2];

// ---------------------------------------------------------------- цвет

function rgbOf(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Цвет грани при освещённости i (0..1): тень уходит в тёмное, пик чуть выбеливается. */
function shade(hex: string, i: number): string {
  const [r, g, b] = rgbOf(hex);
  const k = 0.2 + 0.8 * clamp01(i);
  const hi = Math.max(0, i - 0.84) * 1.5;
  const m = (c: number) => Math.round(Math.min(255, c * k + (255 - c * k) * hi));
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`;
}

/** Свет задан в пространстве камеры: слева-сверху и немного спереди. */
const LIGHT = unit([-0.5, 0.78, 0.5]);

// ---------------------------------------------------------------- отрисовка

export interface SolidOpts {
  /** Цвет тела, hex. */
  color: string;
  /** Число ступеней света (тун-шейдинг); 0 — плавная заливка. */
  bands?: number;
  /** Цвет рёбер; `null` — без рёбер. По умолчанию — светлый оттенок тела. */
  edge?: string | null;
  edgeWidth?: number;
  /** Доля рассеянного света. */
  ambient?: number;
}

/** Выпуклое тело с плоской заливкой граней и отсечением невидимых. */
export function drawSolid(ctx: Ctx, mesh: Mesh, view: View, xf: Xform, o: SolidOpts): void {
  const cam = mesh.verts.map((v) => look(place(v, xf), view));
  const pts = cam.map((c) => toScreen(c, view));
  const center = look(place([0, 0, 0], xf), view);
  const d = view.dist ?? DEFAULT_DIST;
  const ambient = o.ambient ?? 0.3;

  const visible: Array<{ f: number[]; z: number; light: number }> = [];
  for (const f of mesh.faces) {
    const mid: V3 = [0, 0, 0];
    for (const i of f) {
      mid[0] += cam[i][0] / f.length;
      mid[1] += cam[i][1] / f.length;
      mid[2] += cam[i][2] / f.length;
    }
    let n = unit(newell(f.map((i) => cam[i])));
    if (!mesh.oriented && dot(n, sub(mid, center)) < 0) n = [-n[0], -n[1], -n[2]];
    const toCam: V3 = Number.isFinite(d) ? [-mid[0], -mid[1], d - mid[2]] : [0, 0, 1];
    if (dot(n, toCam) <= 0) continue;
    visible.push({ f, z: mid[2], light: Math.max(0, dot(n, LIGHT)) });
  }
  visible.sort((p, q) => p.z - q.z);

  ctx.save();
  ctx.lineJoin = 'round';
  for (const face of visible) {
    let i = ambient + (1 - ambient) * face.light;
    if (o.bands && o.bands > 1) i = Math.min(1, Math.floor(i * o.bands) / (o.bands - 1));
    ctx.beginPath();
    face.f.forEach((vi, k) => (k ? ctx.lineTo(pts[vi][0], pts[vi][1]) : ctx.moveTo(pts[vi][0], pts[vi][1])));
    ctx.closePath();
    ctx.fillStyle = shade(o.color, i);
    ctx.fill();
    if (o.edge !== null) {
      ctx.strokeStyle = o.edge ?? shade(o.color, 1.06);
      ctx.lineWidth = o.edgeWidth ?? 2;
      ctx.stroke();
    }
  }
  ctx.restore();
}

export interface WireOpts {
  color: string;
  width?: number;
  /** Прогресс прорисовки 0..1: рёбра вычерчиваются по очереди. */
  p?: number;
  /** Насколько дальние рёбра тусклее ближних (0 — одинаковые). */
  depthFade?: number;
  /** Радиус точек в вершинах; 0 — без точек. */
  dots?: number;
}

/** Каркас: рёбра с затуханием по глубине. */
export function drawWire(ctx: Ctx, mesh: Mesh, view: View, xf: Xform, o: WireOpts): void {
  const p = clamp01(o.p ?? 1);
  if (p <= 0) return;
  const cam = mesh.verts.map((v) => look(place(v, xf), view));
  const pts = cam.map((c) => toScreen(c, view));
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const c of cam) {
    zMin = Math.min(zMin, c[2]);
    zMax = Math.max(zMax, c[2]);
  }
  const fade = o.depthFade ?? 0.7;
  const near = (z: number) => (zMax > zMin ? (z - zMin) / (zMax - zMin) : 1);
  // каждое ребро чертится 40% общего времени, старты разнесены на остальные 60%
  const each = 0.4;
  const stagger = (1 - each) / Math.max(1, mesh.edges.length - 1);

  ctx.save();
  ctx.strokeStyle = o.color;
  ctx.fillStyle = o.color;
  ctx.lineWidth = o.width ?? 2.5;
  ctx.lineCap = 'round';
  const base = ctx.globalAlpha;
  mesh.edges.forEach(([i, j], k) => {
    const ep = easeOutCubic(clamp01((p - k * stagger) / each));
    if (ep <= 0) return;
    ctx.globalAlpha = base * (1 - fade + fade * near((cam[i][2] + cam[j][2]) / 2));
    ctx.beginPath();
    ctx.moveTo(pts[i][0], pts[i][1]);
    ctx.lineTo(pts[i][0] + (pts[j][0] - pts[i][0]) * ep, pts[i][1] + (pts[j][1] - pts[i][1]) * ep);
    ctx.stroke();
  });
  if (o.dots) {
    cam.forEach((c, i) => {
      ctx.globalAlpha = base * p * (1 - fade + fade * near(c[2]));
      ctx.beginPath();
      ctx.arc(pts[i][0], pts[i][1], o.dots as number, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.restore();
}

export interface GridOpts {
  /** Полуразмер сетки в единицах модели. */
  half: number;
  step?: number;
  color: string;
  width?: number;
  /** Высота плоскости. */
  y?: number;
  /** Полуразмер по Z, если сетка не квадратная. */
  halfZ?: number;
}

/** Сетка «пола» в плоскости XZ. Дальние линии тусклее. */
export function drawGrid(ctx: Ctx, view: View, o: GridOpts): void {
  const step = o.step ?? 1;
  const hx = o.half;
  const hz = o.halfZ ?? o.half;
  const y = o.y ?? 0;
  ctx.save();
  ctx.strokeStyle = o.color;
  ctx.lineWidth = o.width ?? 1.5;
  const base = ctx.globalAlpha;
  const line = (p: V3, q: V3) => {
    const [x1, y1, z1] = project(p, view);
    const [x2, y2, z2] = project(q, view);
    const zRange = Math.max(hx, hz) * 2;
    ctx.globalAlpha = base * (0.35 + 0.65 * clamp01(((z1 + z2) / 2 + zRange / 2) / zRange));
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  for (let x = -hx; x <= hx + 1e-6; x += step) line([x, y, -hz], [x, y, hz]);
  for (let z = -hz; z <= hz + 1e-6; z += step) line([-hx, y, z], [hx, y, z]);
  ctx.restore();
}

/** Путь многоугольника, лежащего на «полу» (точки — пары x, z). */
export function groundPath(ctx: Ctx, view: View, pts: Array<[number, number]>, y = 0): void {
  ctx.beginPath();
  pts.forEach(([x, z], i) => {
    const [sx, sy] = project([x, y, z], view);
    if (i) ctx.lineTo(sx, sy);
    else ctx.moveTo(sx, sy);
  });
  ctx.closePath();
}

// ---------------------------------------------------------------- шар: toon и реалистичный

/**
 * Шар с затенением — для сравнения стилей. `toon` — три жёстких тона и контур,
 * `real` — мягкий градиент, рефлекс от пола, блик и контактная тень.
 */
export function ball(ctx: Ctx, cx: number, cy: number, r: number, color: string, mode: 'toon' | 'real'): void {
  const [cr, cg, cb] = rgbOf(color);
  const tone = (k: number, al = 1) => `rgba(${Math.round(cr * k)}, ${Math.round(cg * k)}, ${Math.round(cb * k)}, ${al})`;
  const lx = cx - r * 0.38;
  const ly = cy - r * 0.42;
  ctx.save();
  // контактная тень
  const sh = ctx.createRadialGradient(cx, cy + r * 1.02, 0, cx, cy + r * 1.02, r * 1.1);
  sh.addColorStop(0, 'rgba(0,0,0,0.55)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.save();
  ctx.translate(cx, cy + r * 1.02);
  ctx.scale(1, 0.22);
  ctx.translate(-cx, -(cy + r * 1.02));
  ctx.fillRect(cx - r * 1.2, cy + r * 1.02 - r * 1.2, r * 2.4, r * 2.4);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.save();
  ctx.clip();
  if (mode === 'toon') {
    ctx.fillStyle = tone(0.42);
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = tone(0.78);
    ctx.beginPath();
    ctx.arc(cx - r * 0.16, cy - r * 0.18, r * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = tone(1);
    ctx.beginPath();
    ctx.arc(lx + r * 0.08, ly + r * 0.08, r * 0.46, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const g = ctx.createRadialGradient(lx, ly, r * 0.05, cx, cy, r * 1.05);
    g.addColorStop(0, tone(1));
    g.addColorStop(0.45, tone(0.75));
    g.addColorStop(1, tone(0.16));
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    // рефлекс снизу и ободок
    const b = ctx.createRadialGradient(cx + r * 0.2, cy + r * 1.1, 0, cx + r * 0.2, cy + r * 1.1, r * 0.9);
    b.addColorStop(0, tone(0.9, 0.55));
    b.addColorStop(1, tone(0.9, 0));
    ctx.fillStyle = b;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    const sp = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * 0.32);
    sp.addColorStop(0, 'rgba(255,255,255,0.95)');
    sp.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sp;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  ctx.restore();
  if (mode === 'toon') {
    ctx.strokeStyle = '#0F0F0F';
    ctx.lineWidth = Math.max(3, r * 0.05);
    ctx.stroke();
  }
  ctx.restore();
}
