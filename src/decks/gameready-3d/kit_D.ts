/**
 * Помощники сцен 13–16 (группа D): агент-гекс, текстурированная «земля» с травой игры,
 * разбор реальной модели на куски для пошаговой сборки, мир из нескольких моделей,
 * маленький буфер для «пиксельного» рендера.
 */

import { clamp01, easeOutBack, lerp } from '../../engine/anim.ts';
import { hexPath } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { text } from '../../engine/text.ts';
import { a, C, mix } from '../../engine/theme.ts';
import {
  camSpace,
  drawModel,
  grassTexture,
  toScreen,
  type ModelOpts,
  type P2,
  type Part,
  type Root,
  type Soup,
  type View,
} from './common.ts';

type Ctx = CanvasRenderingContext2D;

// ================================================================ агент

export interface AgentOpts {
  r?: number;
  /** Подпись под гексом (название инструмента). */
  label?: string;
  labelSize?: number;
  p?: number;
  t?: number;
  /** «Работает» 0..1 — свечение и пульс. */
  busy?: number;
  color?: string;
  icon?: string;
}

/** Гекс агента с иконкой робота и подписью под ним. `x, y` — центр гекса. */
export function agentHex(ctx: Ctx, x: number, y: number, o: AgentOpts = {}): void {
  const p = clamp01(o.p ?? 1);
  if (p <= 0) return;
  const r = o.r ?? 96;
  const color = o.color ?? C.h1;
  const busy = clamp01(o.busy ?? 0);
  const s = easeOutBack(p, 1.6);
  ctx.save();
  ctx.globalAlpha *= Math.min(1, p * 2.5);
  ctx.translate(x, y);
  ctx.save();
  ctx.scale(s, s);
  ctx.save();
  ctx.shadowColor = a(color, 0.35 + 0.45 * busy);
  ctx.shadowBlur = 40 + 40 * busy;
  hexPath(ctx, 0, 0, r, Math.PI / 6);
  ctx.fillStyle = C.panel;
  ctx.fill();
  ctx.restore();
  hexPath(ctx, 0, 0, r, Math.PI / 6);
  ctx.strokeStyle = a(color, 0.75 + 0.25 * busy);
  ctx.lineWidth = 3 + 2 * busy;
  ctx.stroke();
  if (busy > 0) {
    const k = ((o.t ?? 0) * 1.4) % 1;
    hexPath(ctx, 0, 0, r * (1 + k * 0.35), Math.PI / 6);
    ctx.strokeStyle = a(color, 0.5 * busy * (1 - k));
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  icon(ctx, o.icon ?? 'robot', 0, 0, r * 1.05, color, o.t ?? 0);
  ctx.restore();
  if (o.label) {
    text(ctx, o.label, 0, r + (o.labelSize ?? 58) * 1.05, {
      size: o.labelSize ?? 58,
      color,
      align: 'center',
      tracking: 1,
      caps: 'normal',
    });
  }
  ctx.restore();
}

/** Номер шага в кружке. */
export function stepBadge(ctx: Ctx, x: number, y: number, n: string, p: number, active = 1, color: string = C.accent): void {
  const pr = clamp01(p);
  if (pr <= 0) return;
  const s = easeOutBack(pr, 2);
  ctx.save();
  ctx.globalAlpha *= Math.min(1, pr * 3) * (0.45 + 0.55 * active);
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.shadowColor = a(color, 0.6 * active);
  ctx.shadowBlur = 26;
  ctx.fillStyle = active > 0.5 ? color : C.panel;
  ctx.beginPath();
  ctx.arc(0, 0, 40, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  text(ctx, n, 0, 19, { size: 58, color: active > 0.5 ? C.bg : color, align: 'center' });
  ctx.restore();
}

// ================================================================ земля с травой

export interface GroundOpts {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** Размер плитки текстуры в единицах мира. */
  tile?: number;
  /** Число клеток по каждой оси (аффинная аппроксимация перспективы). */
  n?: number;
  y?: number;
  /** Яркость 0..2 (1 — как есть): подсветка травы. */
  bright?: number;
}

/** Цвет «земли», пока картинка травы не загрузилась. */
export const GROUND = mix(C.pos, C.bg, 0.55);

/**
 * Прямоугольник «пола» с картинкой травы игры в перспективе: пол бьётся на клетки,
 * каждая — два треугольника, и в каждом свой аффинный перенос текстуры.
 */
export function grassGround(ctx: Ctx, view: View, o: GroundOpts): void {
  const n = o.n ?? 10;
  const y = o.y ?? 0;
  const img = grassTexture();
  const scr = (x: number, z: number) => toScreen([x, y, z], view);
  const X = (i: number) => lerp(o.x0, o.x1, i / n);
  const Z = (j: number) => lerp(o.z0, o.z1, j / n);

  // подложка: средний цвет травы — прячет щели между треугольниками
  ctx.save();
  ctx.beginPath();
  const ring: P2[] = [];
  for (let i = 0; i <= n; i++) ring.push(scr(X(i), o.z0));
  for (let j = 0; j <= n; j++) ring.push(scr(o.x1, Z(j)));
  for (let i = n; i >= 0; i--) ring.push(scr(X(i), o.z1));
  for (let j = n; j >= 0; j--) ring.push(scr(o.x0, Z(j)));
  ring.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  ctx.fillStyle = GROUND;
  ctx.fill();

  const pat = img && typeof DOMMatrix !== 'undefined' ? ctx.createPattern(img, 'repeat') : null;
  if (pat && img) {
    const tile = o.tile ?? 4;
    const k = img.naturalWidth / tile;
    const tri = (pa: [number, number], pb: [number, number], pc: [number, number]) => {
      const [x0, y0] = scr(pa[0], pa[1]);
      const [x1, y1] = scr(pb[0], pb[1]);
      const [x2, y2] = scr(pc[0], pc[1]);
      const u0 = (pa[0] - o.x0) * k;
      const v0 = (pa[1] - o.z0) * k;
      const du1 = (pb[0] - pa[0]) * k;
      const dv1 = (pb[1] - pa[1]) * k;
      const du2 = (pc[0] - pa[0]) * k;
      const dv2 = (pc[1] - pa[1]) * k;
      const det = du1 * dv2 - du2 * dv1;
      if (Math.abs(det) < 1e-9) return;
      const dx1 = x1 - x0;
      const dy1 = y1 - y0;
      const dx2 = x2 - x0;
      const dy2 = y2 - y0;
      const ma = (dx1 * dv2 - dx2 * dv1) / det;
      const mc = (dx2 * du1 - dx1 * du2) / det;
      const mb = (dy1 * dv2 - dy2 * dv1) / det;
      const md = (dy2 * du1 - dy1 * du2) / det;
      pat.setTransform(new DOMMatrix([ma, mb, mc, md, x0 - ma * u0 - mc * v0, y0 - mb * u0 - md * v0]));
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };
    ctx.fillStyle = pat;
    ctx.strokeStyle = pat;
    ctx.lineWidth = 1.2;
    ctx.lineJoin = 'round';
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        tri([X(i), Z(j)], [X(i + 1), Z(j)], [X(i + 1), Z(j + 1)]);
        tri([X(i), Z(j)], [X(i + 1), Z(j + 1)], [X(i), Z(j + 1)]);
      }
    }
  }
  const br = o.bright ?? 1;
  if (br !== 1) {
    ctx.beginPath();
    ring.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
    ctx.fillStyle = br > 1 ? a(C.pos, clamp01(br - 1) * 0.35) : a(C.bg, clamp01(1 - br));
    ctx.fill();
  }
  ctx.restore();
}

/** Контур прямоугольника пола на экране (для обводки/подсветки). */
export function groundOutline(ctx: Ctx, view: View, x0: number, x1: number, z0: number, z1: number, n = 12): void {
  const pts: P2[] = [];
  for (let i = 0; i <= n; i++) pts.push(toScreen([lerp(x0, x1, i / n), 0, z0], view));
  for (let j = 0; j <= n; j++) pts.push(toScreen([x1, 0, lerp(z0, z1, j / n)], view));
  for (let i = n; i >= 0; i--) pts.push(toScreen([lerp(x0, x1, i / n), 0, z1], view));
  for (let j = n; j >= 0; j--) pts.push(toScreen([x0, 0, lerp(z0, z1, j / n)], view));
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
}

// ================================================================ мир из моделей

export interface WorldItem {
  parts: Part[];
  root: Root;
  o?: ModelOpts;
  alpha?: number;
}

/** Несколько моделей: сортировка «дальние сначала» по точке установки. */
export function drawWorld(ctx: Ctx, view: View, items: WorldItem[]): void {
  const sorted = items
    .filter((it) => (it.alpha ?? 1) > 0.001)
    .map((it) => ({ it, z: camSpace(it.root.pos ?? [0, 0, 0], view)[2] }))
    .sort((p, q) => p.z - q.z);
  for (const { it } of sorted) {
    ctx.save();
    ctx.globalAlpha *= clamp01(it.alpha ?? 1);
    drawModel(ctx, it.parts, view, it.root, it.o ?? {});
    ctx.restore();
  }
}

const BOUNDS = new WeakMap<Part[], { w: number; h: number; d: number }>();

/** Габариты модели (без поворотов частей): ширина по X, высота, глубина по Z. */
export function bounds(parts: Part[]): { w: number; h: number; d: number } {
  const hit = BOUNDS.get(parts);
  if (hit) return hit;
  const mn = [Infinity, Infinity, Infinity];
  const mx = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) {
    if (!p.soup) continue;
    const sp = p.soup;
    for (let i = 0; i < sp.pos.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const v = p.pos[k] + sp.pos[i + k] * p.size[k];
        mn[k] = Math.min(mn[k], v);
        mx[k] = Math.max(mx[k], v);
      }
    }
  }
  const out = { w: mx[0] - mn[0], h: mx[1] - mn[1], d: mx[2] - mn[2] };
  BOUNDS.set(parts, out);
  return out;
}

/** Перекрасить меш в один цвет (деталь «в руках» агента). */
export function recolor(part: Part, hex: string): Part {
  if (!part.soup) return { ...part, color: hex };
  const c = parseInt(hex.replace('#', ''), 16);
  return { ...part, soup: { ...part.soup, col: part.soup.col.map(() => c), glow: new Set() } };
}

// ================================================================ куски модели

export interface Piece {
  part: Part;
  /** Центр куска в координатах модели (после масштаба части). */
  c: [number, number, number];
  /** Нижняя точка куска по Y. */
  minY: number;
  tris: number;
}

const PIECES = new WeakMap<Soup, Soup[]>();

/** Связные компоненты меша (вершины в одной точке считаются общими). */
function components(sp: Soup): Soup[] {
  const hit = PIECES.get(sp);
  if (hit) return hit;
  const n = sp.pos.length / 3;
  const par = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    while (par[x] !== x) {
      par[x] = par[par[x]];
      x = par[x];
    }
    return x;
  };
  const join = (p: number, q: number) => {
    const rp = find(p);
    const rq = find(q);
    if (rp !== rq) par[rq] = rp;
  };
  const byPos = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const key = `${sp.pos[i * 3].toFixed(4)}:${sp.pos[i * 3 + 1].toFixed(4)}:${sp.pos[i * 3 + 2].toFixed(4)}`;
    const j = byPos.get(key);
    if (j === undefined) byPos.set(key, i);
    else join(j, i);
  }
  const T = sp.idx.length / 3;
  for (let t = 0; t < T; t++) {
    join(sp.idx[t * 3], sp.idx[t * 3 + 1]);
    join(sp.idx[t * 3], sp.idx[t * 3 + 2]);
  }
  const groups = new Map<number, Soup>();
  for (let t = 0; t < T; t++) {
    const r = find(sp.idx[t * 3]);
    let g = groups.get(r);
    if (!g) groups.set(r, (g = { pos: sp.pos, idx: [], col: [], glow: new Set() }));
    if (sp.glow.has(t)) g.glow.add(g.col.length);
    g.idx.push(sp.idx[t * 3], sp.idx[t * 3 + 1], sp.idx[t * 3 + 2]);
    g.col.push(sp.col[t]);
  }
  const out = [...groups.values()];
  PIECES.set(sp, out);
  return out;
}

/**
 * Модель → отдельные куски (связные компоненты каждой части) — для пошаговой
 * сборки «агент добавляет деталь за деталью». Порядок — снизу вверх.
 */
export function pieces(parts: Part[]): Piece[] {
  const out: Piece[] = [];
  for (const p of parts) {
    if (!p.soup) {
      out.push({ part: p, c: p.pos, minY: p.pos[1] - p.size[1] / 2, tris: 0 });
      continue;
    }
    for (const sp of components(p.soup)) {
      let minY = Infinity;
      const c: [number, number, number] = [0, 0, 0];
      const used = new Set(sp.idx);
      for (const i of used) {
        c[0] += sp.pos[i * 3];
        c[1] += sp.pos[i * 3 + 1];
        c[2] += sp.pos[i * 3 + 2];
        minY = Math.min(minY, sp.pos[i * 3 + 1]);
      }
      const k = p.size[0] / used.size;
      out.push({
        part: { ...p, soup: sp },
        c: [p.pos[0] + c[0] * k, p.pos[1] + c[1] * k, p.pos[2] + c[2] * k],
        minY: p.pos[1] + minY * p.size[1],
        tris: sp.idx.length / 3,
      });
    }
  }
  return out.sort((p, q) => p.minY - q.minY || q.tris - p.tris);
}

// ================================================================ пиксельный буфер

let PIX: HTMLCanvasElement | null = null;

/** Маленький общий буфер для «пиксельного» рендера (в браузере), очищенный. */
export function pixelBuffer(w: number, h: number): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!PIX) PIX = document.createElement('canvas');
  if (PIX.width !== w || PIX.height !== h) {
    PIX.width = w;
    PIX.height = h;
  }
  const c = PIX.getContext('2d');
  if (!c) return null;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, w, h);
  return c;
}
