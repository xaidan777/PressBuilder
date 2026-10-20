/**
 * Помощники группы C (слайды s09–s12): тайминг по словам озвучки, окна
 * Blender / Claude Code / Tripo, «лог» агента, переключатель, гексы с иконками,
 * силуэт и подсветка частей реальной модели, дыры в сетке, трава на полу,
 * полоса бюджета треугольников.
 */

import { clamp01, easeOutBack, easeOutQuart, hash11, lerp } from '../../engine/anim.ts';
import { panel, rrPath } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { measure, text, type TextStyle } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import type { CueTime } from '../../engine/types.ts';
import { drawGrid } from '../../engine/wire3d.ts';
import {
  M,
  grassTexture,
  rootMatrix,
  toScreen,
  viewport,
  windowFrame,
  type P2,
  type Part,
  type Rect,
  type Root,
  type Soup,
  type V3,
  type View,
  heroDetails,
} from './common.ts';
import { SYNC } from './sync.ts';

type Ctx = CanvasRenderingContext2D;

// ================================================================ время и геометрия

/**
 * Доля реплики (0..1), на которой в озвучке звучит фраза: по времени слов записи
 * (`sync.ts`), а если реплики там нет (текст поменяли) — по месту фразы в тексте `say`.
 */
function phraseFrac(c: CueTime, phrase: string, fallback: number): number {
  const i = c.say.toLowerCase().indexOf(phrase.toLowerCase());
  if (i < 0) return fallback;
  const words = SYNC[c.say];
  if (!words) return i / Math.max(1, c.say.length);
  const before = c.say.slice(0, i);
  const n = before.split(/\s+/).filter(Boolean).length - (/\S$/.test(before) ? 1 : 0);
  return words[Math.min(n, words.length - 1)] ?? fallback;
}

/** Секунда реплики, на которой звучит фраза (чуть раньше, чтобы картинка не опаздывала за словом). */
export function sayAt(c: CueTime, phrase: string, fallback = 0): number {
  return Math.max(0, c.dur * phraseFrac(c, phrase, fallback) - 0.15);
}

/** То же, долей реплики — для анимаций по `c.p`. */
export function sayFrac(c: CueTime, phrase: string, fallback = 0): number {
  return c.dur > 0 ? sayAt(c, phrase, fallback) / c.dur : fallback;
}

export const lerpRect = (p: Rect, q: Rect, k: number): Rect => ({
  x: lerp(p.x, q.x, k),
  y: lerp(p.y, q.y, k),
  w: lerp(p.w, q.w, k),
  h: lerp(p.h, q.h, k),
});

export const inset = (r: Rect, d: number): Rect => ({ x: r.x + d, y: r.y + d, w: r.w - d * 2, h: r.h - d * 2 });

export const mid = (r: Rect): P2 => [r.x + r.w / 2, r.y + r.h / 2];

// ================================================================ окна

/** Окно Blender: рамка + тёмный вьюпорт (с сеткой пола). Возвращает область вьюпорта. */
export function blenderWindow(
  ctx: Ctx,
  r: Rect,
  t: number,
  draw: (area: Rect) => void,
  o: { glow?: number; grid?: View | null; color?: string } = {},
): Rect {
  const area = windowFrame(ctx, r.x, r.y, r.w, r.h, { title: 'Blender', icon: 'cube', t, glow: o.glow, color: o.color });
  const vp = inset(area, 14);
  viewport(
    ctx,
    vp,
    () => {
      if (o.grid) drawGrid(ctx, o.grid, { half: 3, step: 0.5, color: a(C.h1, 0.14), width: 1.4 });
      draw(vp);
    },
    { frame: false },
  );
  return vp;
}

/** Окно Claude Code: рамка в цвете акцента, иконка робота. Возвращает область содержимого. */
export function claudeWindow(ctx: Ctx, r: Rect, t: number, o: { glow?: number } = {}): Rect {
  return windowFrame(ctx, r.x, r.y, r.w, r.h, { title: 'Claude Code', icon: 'robot', color: C.accent, t, glow: o.glow });
}

/** Окно генератора Tripo. */
export function tripoWindow(ctx: Ctx, r: Rect, t: number, o: { glow?: number; title?: string } = {}): Rect {
  return windowFrame(ctx, r.x, r.y, r.w, r.h, { title: o.title ?? 'Tripo P2.0', icon: 'hex', t, glow: o.glow });
}

/**
 * «Лог» агента: строки-полоски без слов, прокручиваются со скоростью `speed`
 * строк в секунду. Рисует в обрезке по области.
 */
export function logLines(
  ctx: Ctx,
  r: Rect,
  t: number,
  o: { speed?: number; color?: string; alpha?: number; step?: number } = {},
): void {
  const step = o.step ?? 46;
  const color = o.color ?? C.accent;
  const pos = t * (o.speed ?? 1.2);
  const first = Math.floor(pos);
  const frac = pos - first;
  const rows = Math.ceil(r.h / step) + 1;
  ctx.save();
  rrPath(ctx, r.x, r.y, r.w, r.h, 10);
  ctx.clip();
  ctx.globalAlpha *= o.alpha ?? 1;
  for (let k = 0; k < rows; k++) {
    const n = first + k;
    const y = r.y + 30 + (k - frac) * step;
    const fade = k === rows - 1 ? 1 - frac : 1;
    const indent = hash11(n * 3.1) > 0.6 ? 44 : hash11(n * 1.7) > 0.75 ? 88 : 0;
    const isCmd = hash11(n * 5.3) > 0.8;
    let x = r.x + 28 + indent;
    ctx.save();
    ctx.globalAlpha *= fade;
    if (isCmd) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x + 10, y);
      ctx.lineTo(x, y + 9);
      ctx.stroke();
      x += 30;
    }
    const words = 1 + Math.floor(hash11(n * 7.7) * 4);
    for (let w = 0; w < words; w++) {
      const len = 40 + hash11(n * 11.3 + w * 2.9) * 150;
      if (x + len > r.x + r.w - 24) break;
      const hot = hash11(n * 13.1 + w) > 0.78;
      ctx.fillStyle = hot ? a(color, 0.75) : a(C.text, 0.26);
      rrPath(ctx, x, y - 7, len, 14, 7);
      ctx.fill();
      x += len + 16;
    }
    ctx.restore();
  }
  ctx.restore();
}

/** Плашка модели (например, «Opus 5.5»): панель с текстом. `x, y` — центр. Возвращает ширину. */
export function plate(
  ctx: Ctx,
  str: string,
  x: number,
  y: number,
  o: { color?: string; size?: number; glow?: number; icon?: string; t?: number } = {},
): number {
  const color = o.color ?? C.accent;
  const size = o.size ?? 58;
  const st: TextStyle = { size, color, tracking: 1.2, caps: 'normal' };
  const iconW = o.icon ? size * 1.1 : 0;
  const tw = measure(ctx, str, st);
  const w = tw + iconW + size * 0.9;
  const h = size * 1.5;
  const g = clamp01(o.glow ?? 0);
  panel(ctx, x - w / 2, y - h / 2, w, h, {
    fill: a(C.bg, 0.92),
    stroke: a(color, 0.55 + 0.4 * g),
    lineWidth: 2.5 + g * 1.5,
    radius: h / 2,
    glow: a(color, 0.12 + 0.4 * g),
    glowBlur: 30 + 30 * g,
  });
  let tx = x - w / 2 + size * 0.45;
  if (o.icon) {
    icon(ctx, o.icon, tx + size * 0.45, y, size * 0.85, color, o.t ?? 0);
    tx += iconW;
  }
  text(ctx, str, tx, y + size * 0.36, st);
  return w;
}

// ================================================================ элементы интерфейса

/** Переключатель: `on` 0..1. `x, y` — центр. */
export function toggle(ctx: Ctx, x: number, y: number, h: number, on: number, color: string = C.pos): void {
  const k = easeOutBack(clamp01(on), 2);
  const w = h * 1.9;
  ctx.save();
  const fillA = 0.15 + 0.7 * clamp01(on);
  panel(ctx, x - w / 2, y - h / 2, w, h, {
    fill: on > 0.02 ? a(color, fillA) : a(C.text, 0.12),
    stroke: on > 0.02 ? a(color, 0.9) : a(C.text, 0.4),
    lineWidth: 2.5,
    radius: h / 2,
    glow: on > 0.5 ? a(color, 0.5 * clamp01(on)) : undefined,
    glowBlur: 30,
  });
  const r = h * 0.38;
  const kx = lerp(x - w / 2 + h / 2, x + w / 2 - h / 2, k);
  ctx.fillStyle = on > 0.5 ? C.bg : C.text;
  ctx.beginPath();
  ctx.arc(kx, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Иконка «картинка»: рамка, горы, солнце. `x, y` — центр. */
export function pictureIcon(ctx: Ctx, x: number, y: number, size: number, color: string): void {
  const w = size * 0.9;
  const h = size * 0.7;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.075);
  ctx.lineJoin = 'round';
  rrPath(ctx, x - w / 2, y - h / 2, w, h, size * 0.08);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - w * 0.36, y + h * 0.3);
  ctx.lineTo(x - w * 0.1, y - h * 0.05);
  ctx.lineTo(x + w * 0.06, y + h * 0.14);
  ctx.lineTo(x + w * 0.2, y + h * 0.0);
  ctx.lineTo(x + w * 0.38, y + h * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + w * 0.2, y - h * 0.2, size * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Иконка по имени: движковая или своя ('picture'). */
export function anyIcon(ctx: Ctx, name: string, x: number, y: number, size: number, color: string, t = 0): void {
  if (name === 'picture') pictureIcon(ctx, x, y, size, color);
  else icon(ctx, name, x, y, size, color, t);
}

/** Гекс с иконкой. `x, y` — центр; `glowK` — свечение 0..1. */
export function hexIcon(ctx: Ctx, name: string, x: number, y: number, r: number, color: string, t = 0, glowK = 0): void {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const ang = Math.PI / 6 + (Math.PI / 3) * i;
    const px = x + Math.cos(ang) * r;
    const py = y + Math.sin(ang) * r;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = a(color, 0.08 + 0.14 * glowK);
  if (glowK > 0) {
    ctx.shadowColor = a(color, 0.7 * glowK);
    ctx.shadowBlur = 36;
  }
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = a(color, 0.5 + 0.4 * glowK);
  ctx.lineWidth = 2.6 + glowK * 1.4;
  ctx.stroke();
  ctx.restore();
  anyIcon(ctx, name, x, y, r * 1.0, color, t);
}

/**
 * Полоса бюджета треугольников: заполнение `value / max`, риска лимита `limit / max`.
 * `x, y` — левый верхний угол. Цвет заливки — зелёный, если в лимите, иначе акцент.
 */
export function budgetBar(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  value: number,
  max: number,
  o: { limit?: number; color?: string; p?: number } = {},
): void {
  const p = clamp01(o.p ?? 1);
  if (p <= 0) return;
  const k = clamp01(value / max);
  const over = o.limit !== undefined && value > o.limit;
  const color = o.color ?? (over ? C.accent : C.pos);
  ctx.save();
  ctx.globalAlpha *= Math.min(1, p * 2);
  panel(ctx, x, y, w, h, { fill: a(C.bg, 0.8), stroke: a(C.text, 0.3), lineWidth: 2, radius: h / 2 });
  ctx.save();
  rrPath(ctx, x, y, w, h, h / 2);
  ctx.clip();
  const fw = w * k * easeOutQuart(p);
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, a(color, 0.55));
  g.addColorStop(1, a(color, 0.95));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, fw, h);
  ctx.restore();
  if (o.limit !== undefined) {
    const lx = x + w * clamp01(o.limit / max);
    ctx.strokeStyle = C.text;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lx, y - 14);
    ctx.lineTo(lx, y + h + 14);
    ctx.stroke();
  }
  ctx.restore();
}

/** Значок камеры (вид сбоку): корпус, объектив, две катушки. Рисует в начале координат, объективом к +X. */
export function cameraGlyph(ctx: Ctx, color: string = C.h1): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = a(color, 0.16);
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  rrPath(ctx, -70, -34, 100, 68, 10);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(30, -14);
  ctx.lineTo(66, -32);
  ctx.lineTo(66, 32);
  ctx.lineTo(30, 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  for (const cx of [-46, -6]) {
    ctx.beginPath();
    ctx.arc(cx, -54, 19, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// ================================================================ реальные модели: силуэт, подсветка, дыры

/** Мировые координаты вершин soup-части (как в drawModel). */
export function soupWorld(part: Part, root: Root = {}): V3[] {
  const sp = part.soup;
  if (!sp) return [];
  const R = rootMatrix(root);
  const base = root.pos ?? [0, 0, 0];
  const local = M.mul(R, M.mul(part.rot ?? M.id(), M.scale(part.size[0], part.size[1], part.size[2])));
  const c = M.apply(R, part.pos);
  const out: V3[] = [];
  for (let i = 0; i < sp.pos.length; i += 3) {
    const w = M.apply(local, [sp.pos[i], sp.pos[i + 1], sp.pos[i + 2]]);
    out.push([base[0] + c[0] + w[0], base[1] + c[1] + w[1], base[2] + c[2] + w[2]]);
  }
  return out;
}

/**
 * Силуэт модели одной заливкой (все треугольники, без сортировки). С `stroke`
 * и `width` — обводка: рисуй силуэт, затем модель поверх — останется кайма.
 */
export function silhouette(
  ctx: Ctx,
  parts: Part[],
  view: View,
  root: Root = {},
  o: { fill?: string | null; stroke?: string; width?: number } = {},
): void {
  ctx.save();
  ctx.beginPath();
  for (const part of parts) {
    if (part.hide || !part.soup) continue;
    const w = soupWorld(part, root);
    const s = w.map((v) => toScreen(v, view));
    const idx = part.soup.idx;
    for (let t = 0; t < idx.length; t += 3) {
      const p0 = s[idx[t]];
      let p1 = s[idx[t + 1]];
      let p2 = s[idx[t + 2]];
      // все треугольники в одну сторону обхода, иначе передние и задние гасят друг друга
      if ((p1[0] - p0[0]) * (p2[1] - p0[1]) - (p1[1] - p0[1]) * (p2[0] - p0[0]) < 0) [p1, p2] = [p2, p1];
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]);
      ctx.lineTo(p2[0], p2[1]);
      ctx.closePath();
    }
  }
  if (o.stroke && o.width) {
    ctx.strokeStyle = o.stroke;
    ctx.lineWidth = o.width * 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
  if (o.fill !== null) {
    ctx.fillStyle = o.fill ?? o.stroke ?? C.accent;
    ctx.fill();
  }
  ctx.restore();
}

const TINT = new WeakMap<Soup, Map<string, Soup>>();

function hexInt(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

function mixInt(p: number, q: number, k: number): number {
  const ch = (s: number) => {
    const u = (p >> s) & 255;
    const v = (q >> s) & 255;
    return Math.round(u + (v - u) * k) << s;
  };
  return ch(16) | ch(8) | ch(0);
}

/** Перекрашенная копия меша: цвета треугольников смешаны с `hex` на долю `k` (кэш по 10 ступеням). */
export function tintSoup(sp: Soup, hex: string, k: number): Soup {
  const q = Math.round(clamp01(k) * 10);
  if (q === 0) return sp;
  let byKey = TINT.get(sp);
  if (!byKey) TINT.set(sp, (byKey = new Map()));
  const key = `${hex}:${q}`;
  const hit = byKey.get(key);
  if (hit) return hit;
  const to = hexInt(hex);
  const out: Soup = { ...sp, col: sp.col.map((c) => mixInt(c, to, q / 10)), glow: new Set() };
  byKey.set(key, out);
  return out;
}

/** Подсветить части модели по меткам (armL, legR…) цветом `hex` с силой `k`. */
export function highlight(parts: Part[], tags: string[], hex: string, k: number): Part[] {
  if (k <= 0.05) return parts;
  return parts.map((p) => (p.soup && p.tag && tags.includes(p.tag) ? { ...p, soup: tintSoup(p.soup, hex, k) } : p));
}

export interface Holes {
  parts: Part[];
  /** Края дыр: пары точек в координатах модели (мир при root = {}). */
  rim: Array<[V3, V3]>;
}

const HOLES = new WeakMap<Soup, Map<string, { soup: Soup; rim: Array<[number, number]> }>>();

/**
 * Дыры в сетке: у части `tag` убираются треугольники, центр которых ближе `r`
 * к одной из точек `centers` (в координатах модели при root = {}). Возвращает
 * модель с дырами и края дыр.
 */
export function punchHoles(parts: Part[], tag: string, centers: V3[], r: number): Holes {
  const rim: Array<[V3, V3]> = [];
  const out = parts.map((part) => {
    if (part.tag !== tag || !part.soup) return part;
    const sp = part.soup;
    const world = soupWorld(part);
    let byKey = HOLES.get(sp);
    if (!byKey) HOLES.set(sp, (byKey = new Map()));
    const key = `${centers.map((c) => c.map((v) => v.toFixed(2)).join(',')).join(';')}:${r}`;
    let hit = byKey.get(key);
    if (!hit) {
      const idx: number[] = [];
      const col: number[] = [];
      const glow = new Set<number>();
      const edgeCount = new Map<string, { n: number; removed: number; pair: [number, number] }>();
      const pkey = (i: number) =>
        `${sp.pos[i * 3].toFixed(4)}:${sp.pos[i * 3 + 1].toFixed(4)}:${sp.pos[i * 3 + 2].toFixed(4)}`;
      for (let t = 0; t < sp.idx.length / 3; t++) {
        const tri = [sp.idx[t * 3], sp.idx[t * 3 + 1], sp.idx[t * 3 + 2]];
        const cx = (world[tri[0]][0] + world[tri[1]][0] + world[tri[2]][0]) / 3;
        const cy = (world[tri[0]][1] + world[tri[1]][1] + world[tri[2]][1]) / 3;
        const cz = (world[tri[0]][2] + world[tri[1]][2] + world[tri[2]][2]) / 3;
        const gone = centers.some((c) => Math.hypot(cx - c[0], cy - c[1], cz - c[2]) < r);
        for (let e = 0; e < 3; e++) {
          const i1 = tri[e];
          const i2 = tri[(e + 1) % 3];
          const k1 = pkey(i1);
          const k2 = pkey(i2);
          const ek = k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
          const rec = edgeCount.get(ek) ?? { n: 0, removed: 0, pair: [i1, i2] as [number, number] };
          rec.n++;
          if (gone) rec.removed++;
          edgeCount.set(ek, rec);
        }
        if (gone) continue;
        if (sp.glow.has(t)) glow.add(col.length);
        idx.push(...tri);
        col.push(sp.col[t]);
      }
      const rimIdx: Array<[number, number]> = [];
      for (const rec of edgeCount.values()) {
        if (rec.removed > 0 && rec.removed < rec.n) rimIdx.push(rec.pair);
      }
      hit = { soup: { pos: sp.pos, idx, col, glow }, rim: rimIdx };
      byKey.set(key, hit);
    }
    for (const [i1, i2] of hit.rim) rim.push([world[i1], world[i2]]);
    return { ...part, soup: hit.soup };
  });
  return { parts: out, rim };
}

/** Края дыр: светящиеся отрезки. */
export function drawRim(ctx: Ctx, rim: Array<[V3, V3]>, view: View, root: Root, color: string, width = 4): void {
  if (!rim.length) return;
  const R = rootMatrix(root);
  const base = root.pos ?? [0, 0, 0];
  const place = (v: V3): V3 => {
    const w = M.apply(R, v);
    return [base[0] + w[0], base[1] + w[1], base[2] + w[2]];
  };
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.shadowColor = a(color, 0.8);
  ctx.shadowBlur = 14;
  ctx.beginPath();
  for (const [p, q] of rim) {
    const s1 = toScreen(place(p), view);
    const s2 = toScreen(place(q), view);
    ctx.moveTo(s1[0], s1[1]);
    ctx.lineTo(s2[0], s2[1]);
  }
  ctx.stroke();
  ctx.restore();
}

/** Пунктирный круг-отметка (пропавшая деталь, проблемное место). */
export function dashRing(ctx: Ctx, x: number, y: number, r: number, color: string, t = 0, width = 4): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash([12, 10]);
  ctx.lineDashOffset = -t * 30;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Мелкие детали силуэта, которые съедает грубая оптимизация: кончики ушей эльфа. */
export const SPIKES: V3[] = heroDetails('elf');

// ================================================================ пол

/**
 * Трава игры на плоскости y = 0 под ортографической камерой (`dist: Infinity`):
 * пол тогда аффинный, и текстура ложится одним преобразованием. `tile` — размер
 * плитки текстуры в единицах мира. Пока текстура грузится — тёмно-зелёная заливка.
 */
export function grassFloor(ctx: Ctx, view: View, r: Rect, o: { tile?: number; alpha?: number; shade?: number } = {}): void {
  const yaw = view.yaw ?? 0;
  const pitch = view.pitch ?? 0;
  const c = Math.cos(yaw);
  const n = Math.sin(yaw);
  const sp = Math.sin(pitch);
  const s = view.size;
  const img = grassTexture();
  ctx.save();
  rrPath(ctx, r.x, r.y, r.w, r.h, 12);
  ctx.clip();
  ctx.globalAlpha *= o.alpha ?? 1;
  if (img) {
    const tile = o.tile ?? 4;
    const pat = ctx.createPattern(img, 'repeat');
    if (pat) {
      ctx.save();
      ctx.transform(s * c, -s * sp * n, s * n, s * sp * c, view.cx, view.cy);
      const k = tile / img.naturalWidth;
      ctx.scale(k, k);
      ctx.fillStyle = pat;
      const big = 40 / k;
      ctx.fillRect(-big, -big, big * 2, big * 2);
      ctx.restore();
    }
  } else {
    ctx.fillStyle = '#4f7a2e';
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  // приглушить под палитру презентации
  ctx.fillStyle = a(C.bg, o.shade ?? 0.35);
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}

/** Линия по точкам экрана. */
export function polyLine(ctx: Ctx, pts: P2[], close = false): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (close) ctx.closePath();
}

/** Эллипс-кольцо на полу (y = 0) вокруг точки (x, z) радиуса r — в проекции вида. */
export function groundRing(ctx: Ctx, view: View, x: number, z: number, r: number, n = 64): void {
  const pts: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const ang = (Math.PI * 2 * i) / n;
    pts.push(toScreen([x + Math.cos(ang) * r, 0, z + Math.sin(ang) * r], view));
  }
  polyLine(ctx, pts);
}
