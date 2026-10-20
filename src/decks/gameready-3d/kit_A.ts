/**
 * Помощники группы A (слайды 1–4): расстановка моделей игры в одной сцене,
 * трава игры на «полу», плотные версии моделей игры и их «баги», ноутбук,
 * стопка монет, пиксельный спрайт, переходы между этапами слайда.
 */

import { clamp01, easeInOutCubic, easeOutQuart, hash11 } from '../../engine/anim.ts';
import { panel, rrPath, softLight } from '../../engine/draw.ts';
import { a, C } from '../../engine/theme.ts';
import { grassTexture, M, SCREEN_BG, toScreen, type Part, type Rect, type V3, type View } from './common.ts';

type Ctx = CanvasRenderingContext2D;

// ================================================================ этапы

/**
 * Этап слайда: вход (`pin` 0→1) и уход (`pout` 0→1) — прозрачность, сдвиг и масштаб
 * вокруг (cx, cy). Рисует `fn`, только если этап виден.
 */
export function stage(
  ctx: Ctx,
  pin: number,
  pout: number,
  fn: () => void,
  o: { cx?: number; cy?: number; dx?: number; dy?: number; outDx?: number; outDy?: number; from?: number; to?: number } = {},
): void {
  const i = easeOutQuart(clamp01(pin));
  const u = easeInOutCubic(clamp01(pout));
  const alpha = Math.min(1, clamp01(pin) * 2.2) * (1 - u);
  if (alpha <= 0.002) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate((1 - i) * (o.dx ?? 0) + u * (o.outDx ?? 0), (1 - i) * (o.dy ?? 0) + u * (o.outDy ?? 0));
  const s = (o.from !== undefined ? o.from + (1 - o.from) * i : 1) * (o.to !== undefined ? 1 + (o.to - 1) * u : 1);
  if (s !== 1) {
    ctx.translate(o.cx ?? 0, o.cy ?? 0);
    ctx.scale(s, s);
    ctx.translate(-(o.cx ?? 0), -(o.cy ?? 0));
  }
  fn();
  ctx.restore();
}

/** Плавная интерполяция прямоугольников. */
export function lerpRect(r0: Rect, r1: Rect, k: number): Rect {
  return {
    x: r0.x + (r1.x - r0.x) * k,
    y: r0.y + (r1.y - r0.y) * k,
    w: r0.w + (r1.w - r0.w) * k,
    h: r0.h + (r1.h - r0.h) * k,
  };
}

// ================================================================ модели в одной сцене

/**
 * Поставить модель в сцену: поворот вокруг вертикали, масштаб, сдвиг.
 * Несколько моделей, собранных так в один массив, рисуются одним drawModel —
 * с общей сортировкой граней по глубине.
 */
export function place(parts: Part[], o: { pos?: V3; ry?: number; scale?: number } = {}): Part[] {
  const s = o.scale ?? 1;
  const R = M.ry(o.ry ?? 0);
  const T = o.pos ?? [0, 0, 0];
  return parts.map((p) => {
    const q = M.apply(R, [p.pos[0] * s, p.pos[1] * s, p.pos[2] * s]);
    return {
      ...p,
      pos: [T[0] + q[0], T[1] + q[1], T[2] + q[2]] as V3,
      size: [p.size[0] * s, p.size[1] * s, p.size[2] * s] as V3,
      rot: M.mul(R, p.rot ?? M.id()),
    };
  });
}

/**
 * Пол из травы игры: текстура ложится на плоскость y = 0 (аффинно, по трём точкам
 * проекции), обрезка — честный круг радиуса `r` в перспективе, края уходят в фон.
 */
export function grassGround(
  ctx: Ctx,
  view: View,
  r: number,
  o: { tile?: number; dark?: number; cx?: number; cz?: number; /** Сдвиг текстуры (бег земли), в единицах мира. */ scroll?: [number, number] } = {},
): void {
  const cx = o.cx ?? 0;
  const cz = o.cz ?? 0;
  const O = toScreen([cx, 0, cz], view);
  const X = toScreen([cx + 1, 0, cz], view);
  const Z = toScreen([cx, 0, cz + 1], view);
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= 56; i++) {
    const an = (Math.PI * 2 * i) / 56;
    const [x, y] = toScreen([cx + Math.cos(an) * r, 0, cz + Math.sin(an) * r], view);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.clip();
  ctx.transform(X[0] - O[0], X[1] - O[1], Z[0] - O[0], Z[1] - O[1], O[0], O[1]);
  const img = grassTexture();
  if (img) {
    const k = (o.tile ?? 5) / img.width;
    const [sx, sz] = o.scroll ?? [0, 0];
    ctx.save();
    ctx.translate(sx % (o.tile ?? 5), sz % (o.tile ?? 5));
    ctx.scale(k, k);
    const pat = ctx.createPattern(img, 'repeat');
    if (pat) ctx.fillStyle = pat;
    ctx.fillRect((-r - (o.tile ?? 5)) / k, (-r - (o.tile ?? 5)) / k, (2 * r + 2 * (o.tile ?? 5)) / k, (2 * r + 2 * (o.tile ?? 5)) / k);
    ctx.restore();
  } else {
    ctx.fillStyle = a(C.pos, 0.3);
    ctx.fillRect(-r, -r, 2 * r, 2 * r);
  }
  // приглушение под палитру ролика и уход краёв в фон
  ctx.fillStyle = a(C.bg, o.dark ?? 0.28);
  ctx.fillRect(-r, -r, 2 * r, 2 * r);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, a(SCREEN_BG, 0));
  g.addColorStop(0.55, a(SCREEN_BG, 0.05));
  g.addColorStop(1, a(SCREEN_BG, 1));
  ctx.fillStyle = g;
  ctx.fillRect(-r, -r, 2 * r, 2 * r);
  ctx.restore();
}

// ================================================================ ноутбук

export interface LaptopOpts {
  /** Нагрев 0..1: свечение корпуса и волны жара. */
  heat?: number;
  /** Глобальное время — для волн жара. */
  t?: number;
  /** Цвет рамки. */
  color?: string;
}

/**
 * Ноутбук: экран (x, y, w, h — область изображения) и клавиатурная часть под ним.
 * Возвращает прямоугольник экрана, в который сцена рисует содержимое.
 */
export function laptop(ctx: Ctx, r: Rect, o: LaptopOpts = {}): Rect {
  const heat = clamp01(o.heat ?? 0);
  const color = o.color ?? C.h1;
  const bez = Math.max(14, r.w * 0.025);
  const bx = r.x - bez;
  const by = r.y - bez;
  const bw = r.w + bez * 2;
  const bh = r.h + bez * 2;
  const baseH = Math.max(26, r.w * 0.045);
  const over = r.w * 0.08;
  const t = o.t ?? 0;

  if (heat > 0) {
    softLight(ctx, r.x + r.w / 2, r.y + r.h + baseH, r.w * 0.85, C.accent, 0.42 * heat);
    // волны жара над крышкой
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const x0 = bx + bw * 0.25 + (bw * 0.5 * (i + 0.5)) / 9;
      const ph = (t * 0.9 + hash11(i * 7.3)) % 1;
      const len = 70 + 50 * hash11(i * 3.1);
      ctx.strokeStyle = a(C.accent, 0.55 * heat * Math.sin(ph * Math.PI));
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let k = 0; k <= 16; k++) {
        const yy = by - 22 - ph * 70 - (k / 16) * len;
        const xx = x0 + Math.sin(k * 0.8 + t * 6 + i) * 12;
        if (k) ctx.lineTo(xx, yy);
        else ctx.moveTo(xx, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // крышка с экраном
  panel(ctx, bx, by, bw, bh, {
    fill: C.panel,
    stroke: heat > 0.02 ? a(C.accent, 0.4 + 0.5 * heat) : a(color, 0.45),
    lineWidth: 2.5,
    radius: 18,
    glow: heat > 0.02 ? a(C.accent, 0.5 * heat) : a(color, 0.12),
    glowBlur: 40 + 50 * heat,
  });
  // клавиатурная часть: трапеция
  const y0 = by + bh;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(bx - 4, y0);
  ctx.lineTo(bx + bw + 4, y0);
  ctx.lineTo(bx + bw + over, y0 + baseH);
  ctx.lineTo(bx - over, y0 + baseH);
  ctx.closePath();
  ctx.fillStyle = C.panel;
  ctx.fill();
  ctx.strokeStyle = heat > 0.02 ? a(C.accent, 0.4 + 0.5 * heat) : a(color, 0.45);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = a(C.text, 0.18);
  rrPath(ctx, r.x + r.w / 2 - r.w * 0.09, y0 + baseH * 0.3, r.w * 0.18, baseH * 0.36, 6);
  ctx.fill();
  ctx.restore();
  return r;
}

// ================================================================ монеты

/** Стопка монет: растёт снизу вверх (`n` — сколько монет уже легло, дробное). */
export function coinStack(ctx: Ctx, cx: number, bottom: number, rx: number, n: number, color: string = C.accent): void {
  const ry = rx * 0.32;
  const h = rx * 0.26;
  const full = Math.floor(n);
  const part = n - full;
  for (let i = 0; i <= full; i++) {
    const k = i < full ? 1 : part;
    if (k <= 0) continue;
    // последняя монета падает сверху
    const drop = (1 - easeOutQuart(k)) * 160;
    const y = bottom - i * h - drop;
    ctx.save();
    ctx.globalAlpha *= Math.min(1, k * 3);
    ctx.fillStyle = a(color, 0.55);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(cx, y, rx, ry, 0, 0, Math.PI);
    ctx.lineTo(cx - rx, y - h);
    ctx.ellipse(cx, y - h, rx, ry, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = a(color, 0.9);
    ctx.beginPath();
    ctx.ellipse(cx, y - h, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = a(C.bg, 0.6);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, y - h, rx * 0.66, ry * 0.66, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// ================================================================ пиксельный спрайт

/** Пиксельный монстрик (2D-арт): «g» — тело, «d» — тень, «w» — глаза, «k» — зрачки/рот. */
const SPRITE = [
  '....gggggg....',
  '..gggggggggg..',
  '.gggggggggggg.',
  '.ggwwwggwwwgg.',
  'gggwkwggwkwggg',
  'gggwwwggwwwggg',
  'gggggggggggggg',
  'ggggkkkkkkgggg',
  'gggkwkwwkwkggg',
  'dggggggggggggd',
  'ddgggggggggggd',
  '.dddggggggddd.',
  '..dd.dddd.dd..',
];

/**
 * Пиксельный спрайт, центр — (cx, cy), `px` — размер «пикселя».
 * `squash` — «дыхание» спрайта (кадры анимации): 0..1.
 */
export function pixelSprite(ctx: Ctx, cx: number, cy: number, px: number, squash = 0, color: string = C.pos): void {
  const rows = SPRITE.length;
  const cols = SPRITE[0].length;
  const pal: Record<string, string> = {
    g: color,
    d: a(color, 0.55),
    w: C.text,
    k: C.bg,
  };
  const sy = 1 - 0.12 * squash;
  const sx = 1 + 0.08 * squash;
  const w = cols * px * sx;
  const h = rows * px * sy;
  const x0 = cx - w / 2;
  const y0 = cy + rows * px * 0.5 - h;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const ch = SPRITE[j][i];
      const col = pal[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(x0 + i * px * sx), Math.round(y0 + j * px * sy), Math.ceil(px * sx) + 0.5, Math.ceil(px * sy) + 0.5);
    }
  }
}

// ================================================================ «знак не равно»

/** Крупный знак ≠, прочерчиваемый по `p`. */
export function notEqual(ctx: Ctx, cx: number, cy: number, s: number, p: number, color: string = C.accent): void {
  const pr = clamp01(p);
  if (pr <= 0) return;
  const k1 = easeOutQuart(clamp01(pr * 2.2));
  const k2 = easeOutQuart(clamp01(pr * 2.2 - 0.5));
  const k3 = easeOutQuart(clamp01(pr * 2 - 1));
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = s * 0.13;
  ctx.shadowColor = a(color, 0.6);
  ctx.shadowBlur = s * 0.3;
  const hw = s * 0.5;
  for (const [dy, k] of [
    [-s * 0.2, k1],
    [s * 0.2, k2],
  ] as const) {
    if (k <= 0) continue;
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy + dy);
    ctx.lineTo(cx - hw + 2 * hw * k, cy + dy);
    ctx.stroke();
  }
  if (k3 > 0) {
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.26, cy - s * 0.55);
    ctx.lineTo(cx + s * 0.26 - s * 0.52 * k3, cy - s * 0.55 + s * 1.1 * k3);
    ctx.stroke();
  }
  ctx.restore();
}

// ================================================================ сканирующее появление

/**
 * «Генерация»: модель проявляется снизу вверх за светящейся линией сканера.
 * `draw` рисует модель; выше линии видна только полупрозрачная тень.
 */
export function scanReveal(ctx: Ctx, r: Rect, p: number, draw: () => void, color: string = C.h1): void {
  const pr = clamp01(p);
  if (pr <= 0) return;
  if (pr >= 1) {
    draw();
    return;
  }
  const y = r.y + r.h - r.h * easeInOutCubic(pr);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, y, r.w, r.y + r.h - y);
  ctx.clip();
  draw();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, y - r.y);
  ctx.clip();
  ctx.globalAlpha *= 0.14;
  draw();
  ctx.restore();
  ctx.save();
  const g = ctx.createLinearGradient(0, y - 40, 0, y + 4);
  g.addColorStop(0, a(color, 0));
  g.addColorStop(1, a(color, 0.35));
  ctx.fillStyle = g;
  ctx.fillRect(r.x, y - 40, r.w, 44);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.fillRect(r.x, y - 1.5, r.w, 3);
  ctx.restore();
}

// ================================================================ «высокополигональная» версия модели игры

type Soup = NonNullable<Part['soup']>;
const SUBDIV = new WeakMap<Soup, Map<number, Soup>>();

/**
 * Плотная гладкая версия меша: вершины свариваются, каждый треугольник делится на 4
 * (`levels` раз), после каждого деления — сглаживание Таубина (без усадки).
 * Получается «скульпт» из тысяч треугольников той же формы — как генерации с YouTube.
 */
function subdivSoup(sp: Soup, levels: number): Soup {
  let byLv = SUBDIV.get(sp);
  if (!byLv) SUBDIV.set(sp, (byLv = new Map()));
  const hit = byLv.get(levels);
  if (hit) return hit;

  // сварка вершин по положению
  const key = new Map<string, number>();
  const P: number[] = [];
  const remap: number[] = [];
  for (let i = 0; i < sp.pos.length / 3; i++) {
    const x = sp.pos[i * 3];
    const y = sp.pos[i * 3 + 1];
    const z = sp.pos[i * 3 + 2];
    const k = `${Math.round(x * 2e4)}:${Math.round(y * 2e4)}:${Math.round(z * 2e4)}`;
    let id = key.get(k);
    if (id === undefined) {
      id = P.length / 3;
      key.set(k, id);
      P.push(x, y, z);
    }
    remap.push(id);
  }
  let idx = sp.idx.map((i) => remap[i]);
  let col = sp.col.slice();
  let glow = new Set(sp.glow);

  for (let lv = 0; lv < levels; lv++) {
    const mid = new Map<string, number>();
    const midOf = (p: number, q: number) => {
      const k = p < q ? `${p}:${q}` : `${q}:${p}`;
      let id = mid.get(k);
      if (id === undefined) {
        id = P.length / 3;
        mid.set(k, id);
        P.push((P[p * 3] + P[q * 3]) / 2, (P[p * 3 + 1] + P[q * 3 + 1]) / 2, (P[p * 3 + 2] + P[q * 3 + 2]) / 2);
      }
      return id;
    };
    const nIdx: number[] = [];
    const nCol: number[] = [];
    const nGlow = new Set<number>();
    for (let t = 0; t < idx.length / 3; t++) {
      const A = idx[t * 3];
      const B = idx[t * 3 + 1];
      const Cc = idx[t * 3 + 2];
      const ab = midOf(A, B);
      const bc = midOf(B, Cc);
      const ca = midOf(Cc, A);
      for (const tri of [
        [A, ab, ca],
        [ab, B, bc],
        [ca, bc, Cc],
        [ab, bc, ca],
      ]) {
        if (glow.has(t)) nGlow.add(nCol.length);
        nIdx.push(tri[0], tri[1], tri[2]);
        nCol.push(col[t]);
      }
    }
    idx = nIdx;
    col = nCol;
    glow = nGlow;
    // сглаживание Таубина: шаг λ внутрь, шаг μ наружу — форма не усаживается
    const n = P.length / 3;
    const nb: Array<Set<number>> = Array.from({ length: n }, () => new Set<number>());
    for (let t = 0; t < idx.length / 3; t++) {
      const v = [idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]];
      for (let e = 0; e < 3; e++) {
        nb[v[e]].add(v[(e + 1) % 3]);
        nb[v[e]].add(v[(e + 2) % 3]);
      }
    }
    for (const lam of [0.5, -0.53]) {
      const Q = P.slice();
      for (let i = 0; i < n; i++) {
        const s = nb[i];
        if (!s.size) continue;
        let ax = 0;
        let ay = 0;
        let az = 0;
        for (const j of s) {
          ax += Q[j * 3];
          ay += Q[j * 3 + 1];
          az += Q[j * 3 + 2];
        }
        P[i * 3] += lam * (ax / s.size - Q[i * 3]);
        P[i * 3 + 1] += lam * (ay / s.size - Q[i * 3 + 1]);
        P[i * 3 + 2] += lam * (az / s.size - Q[i * 3 + 2]);
      }
    }
  }
  const out: Soup = { pos: P, idx, col, glow };
  byLv.set(levels, out);
  return out;
}

/** Плотная гладкая версия модели игры (см. subdivSoup). */
export function subdivide(parts: Part[], levels = 1): Part[] {
  return parts.map((p) => (p.soup ? { ...p, soup: subdivSoup(p.soup, levels) } : p));
}

/** Точка и радиус/длина: доли габарита части по x, y, z и доля её высоты. */
export type Spot = [number, number, number, number];

export interface DefectOpts {
  /** Дыры: треугольники внутри сфер выкидываются. */
  holes?: Spot[];
  /** Пятна «грязной» сетки: треугольники перекрашиваются в `markColor`. */
  marks?: Spot[];
  markColor?: string;
  /** Шипы-артефакты: ближайшая вершина выбрасывается наружу. */
  spikes?: Spot[];
}

/** Габарит меша части. */
export function soupBox(sp: Soup): { mn: V3; mx: V3 } {
  const mn: V3 = [Infinity, Infinity, Infinity];
  const mx: V3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < sp.pos.length / 3; i++) {
    for (let k = 0; k < 3; k++) {
      mn[k] = Math.min(mn[k], sp.pos[i * 3 + k]);
      mx[k] = Math.max(mx[k], sp.pos[i * 3 + k]);
    }
  }
  return { mn, mx };
}

/** Точка `Spot` в координатах меша части. */
export function spotPoint(sp: Soup, s: Spot): V3 {
  const { mn, mx } = soupBox(sp);
  return [mn[0] + (mx[0] - mn[0]) * s[0], mn[1] + (mx[1] - mn[1]) * s[1], mn[2] + (mx[2] - mn[2]) * s[2]];
}

/** Генерация «с багами»: дыры, перекрашенные пятна и шипы на части с меткой `tag`. */
export function defects(parts: Part[], tag: string, o: DefectOpts): Part[] {
  return parts.map((p) => {
    if (p.tag !== tag || !p.soup) return p;
    const sp = p.soup;
    const n = sp.pos.length / 3;
    const { mn, mx } = soupBox(sp);
    const H = mx[1] - mn[1];
    const ctr: V3 = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
    const pos = sp.pos.slice();
    for (const s of o.spikes ?? []) {
      const c = spotPoint(sp, s);
      let best = 0;
      let bd = Infinity;
      for (let i = 0; i < n; i++) {
        const d = (pos[i * 3] - c[0]) ** 2 + (pos[i * 3 + 1] - c[1]) ** 2 + (pos[i * 3 + 2] - c[2]) ** 2;
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
      const dir: V3 = [pos[best * 3] - ctr[0], pos[best * 3 + 1] - ctr[1], pos[best * 3 + 2] - ctr[2]];
      const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
      for (let k = 0; k < 3; k++) pos[best * 3 + k] += (dir[k] / l) * H * s[3];
    }
    const centers = (list: Spot[]) => list.map((s) => ({ c: spotPoint(sp, s), r2: (s[3] * H) ** 2 }));
    const holes = centers(o.holes ?? []);
    const marks = centers(o.marks ?? []);
    const inside = (t: number, list: Array<{ c: V3; r2: number }>) => {
      let cx = 0;
      let cy = 0;
      let cz = 0;
      for (let e = 0; e < 3; e++) {
        const v = sp.idx[t * 3 + e];
        cx += sp.pos[v * 3] / 3;
        cy += sp.pos[v * 3 + 1] / 3;
        cz += sp.pos[v * 3 + 2] / 3;
      }
      return list.some((h) => (cx - h.c[0]) ** 2 + (cy - h.c[1]) ** 2 + (cz - h.c[2]) ** 2 < h.r2);
    };
    const markInt = parseInt((o.markColor ?? C.accent).replace('#', ''), 16);
    const idx: number[] = [];
    const col: number[] = [];
    const glow = new Set<number>();
    for (let t = 0; t < sp.idx.length / 3; t++) {
      if (holes.length && inside(t, holes)) continue;
      if (sp.glow.has(t)) glow.add(col.length);
      idx.push(sp.idx[t * 3], sp.idx[t * 3 + 1], sp.idx[t * 3 + 2]);
      col.push(marks.length && inside(t, marks) ? markInt : sp.col[t]);
    }
    return { ...p, soup: { pos, idx, col, glow } };
  });
}
