/** Графики и счётчики: линия выручки, столбцы, кольцевая диаграмма. */

import { clamp01, easeOutCubic, easeOutExpo, fmtNum } from './anim.ts';
import { polyline, rrPath, smoothPath } from './draw.ts';
import { measure, text, type TextStyle } from './text.ts';
import { a, C } from './theme.ts';

type Ctx = CanvasRenderingContext2D;

export interface LineChartOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  data: number[];
  /** Прогресс прорисовки 0..1. */
  p: number;
  color?: string;
  /** Заливка под линией. */
  fill?: boolean;
  /** Верхняя граница шкалы (по умолчанию max(data) * 1.12). */
  max?: number;
  /** Горизонтальные линии сетки. */
  grid?: number;
  /** Светящаяся точка на конце нарисованной части. */
  head?: boolean;
  lineWidth?: number;
  /** Сглаживать линию (для «спайка» лучше выключать). */
  smooth?: boolean;
  labels?: string[];
}

export function lineChart(ctx: Ctx, o: LineChartOpts): void {
  const { x, y, w, h, data } = o;
  const p = clamp01(o.p);
  const color = o.color ?? C.h1;
  const max = o.max ?? Math.max(...data, 1) * 1.12;
  const px = (i: number) => x + (w * i) / Math.max(1, data.length - 1);
  const py = (v: number) => y + h - (h * v) / max;
  const pts: Array<[number, number]> = data.map((v, i) => [px(i), py(v)]);

  // сетка
  const gridN = o.grid ?? 4;
  if (gridN > 0) {
    ctx.save();
    ctx.strokeStyle = a(C.text, 0.07);
    ctx.lineWidth = 1;
    for (let i = 0; i <= gridN; i++) {
      const gy = y + (h * i) / gridN;
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
      ctx.stroke();
    }
    ctx.restore();
  }

  const cut = x + w * p;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - 4, y - h, w + 8, h * 3);
  ctx.clip();
  ctx.beginPath();
  ctx.rect(x - 4, y - h * 2, cut - x + 4, h * 4);
  ctx.clip();

  if (o.fill !== false) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, a(color, 0.32));
    g.addColorStop(1, a(color, 0));
    ctx.fillStyle = g;
    if (o.smooth) smoothPath(ctx, pts);
    else polyline(ctx, pts);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = o.lineWidth ?? 4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = a(color, 0.55);
  ctx.shadowBlur = 18;
  if (o.smooth) smoothPath(ctx, pts);
  else polyline(ctx, pts);
  ctx.stroke();
  ctx.restore();

  if (o.head !== false && p > 0 && p < 1.0001) {
    const fi = (data.length - 1) * p;
    const i0 = Math.floor(fi);
    const i1 = Math.min(data.length - 1, i0 + 1);
    const k = fi - i0;
    const hx = px(i0) + (px(i1) - px(i0)) * k;
    const hy = py(data[i0] + (data[i1] - data[i0]) * k);
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 22;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(hx, hy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (o.labels) {
    const st: TextStyle = { size: 46, weight: 700, color: a(C.text, 0.4), align: 'center', tracking: 1 };
    o.labels.forEach((l, i) => {
      if (px(i) <= cut + 2) text(ctx, l, px(i), y + h + 60, st);
    });
  }
}

export interface BarItem {
  label: string;
  value: number;
  color?: string;
  note?: string;
}

export interface BarsOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  items: BarItem[];
  p: number;
  max?: number;
  /** Задержка между появлением столбцов, в долях прогресса. */
  stagger?: number;
  valueFmt?: (v: number) => string;
}

export function bars(ctx: Ctx, o: BarsOpts): void {
  const { x, y, w, h, items } = o;
  const max = o.max ?? Math.max(...items.map((i) => i.value), 1);
  const stagger = o.stagger ?? 0.18;
  const span = 1 + stagger * (items.length - 1);
  const gap = w / items.length / 3;
  const bw = (w - gap * (items.length - 1)) / items.length;

  items.forEach((it, i) => {
    const bp = easeOutExpo(clamp01(clamp01(o.p) * span - i * stagger));
    if (bp <= 0) return;
    const bh = (h * it.value * bp) / max;
    const bx = x + i * (bw + gap);
    const col = it.color ?? C.h1;
    ctx.save();
    ctx.fillStyle = a(col, 0.9);
    ctx.shadowColor = a(col, 0.5);
    ctx.shadowBlur = 16;
    rrPath(ctx, bx, y + h - bh, bw, bh, [6, 6, 2, 2]);
    ctx.fill();
    ctx.restore();

    text(ctx, it.label, bx + bw / 2, y + h + 58, {
      size: 46,
      color: a(C.text, 0.55),
      align: 'center',
      tracking: 1,
      maxWidth: bw + gap,
    });
    const v = o.valueFmt ? o.valueFmt(it.value) : fmtNum(it.value);
    ctx.save();
    ctx.globalAlpha *= clamp01((bp - 0.55) / 0.45);
    text(ctx, v, bx + bw / 2, y + h - bh - 22, { size: 56, color: col, align: 'center' });
    ctx.restore();
  });
}

export interface DonutSeg {
  value: number;
  color: string;
  label?: string;
}

/** Кольцевая диаграмма; сегменты растут по очереди. */
export function donut(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  segs: DonutSeg[],
  p: number,
  thickness = 34,
): void {
  const total = segs.reduce((s, x) => s + x.value, 0) || 1;
  const pr = easeOutCubic(clamp01(p));
  const start = -Math.PI / 2;

  ctx.save();
  ctx.lineWidth = thickness;
  ctx.lineCap = 'butt';
  ctx.strokeStyle = a(C.text, 0.08);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  let acc = 0;
  for (const s of segs) {
    const from = start + Math.PI * 2 * (acc / total);
    const to = start + Math.PI * 2 * ((acc + s.value) / total);
    const end = from + (to - from) * clamp01((pr * total - acc) / s.value);
    if (end > from) {
      ctx.strokeStyle = s.color;
      ctx.shadowColor = a(s.color, 0.5);
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(cx, cy, r, from, end);
      ctx.stroke();
    }
    acc += s.value;
  }
  ctx.restore();
}

export interface CounterOpts {
  prefix?: string;
  suffix?: string;
  /** Отдельный стиль для префикса/суффикса. */
  affixStyle?: Partial<TextStyle>;
  decimals?: number;
  /** Функция сглаживания подъёма числа. */
  ease?: (t: number) => number;
}

/**
 * Счётчик: число «набегает» от 0 до value.
 * Возвращает итоговую ширину — удобно для подрисовки подписей.
 */
export function counter(
  ctx: Ctx,
  value: number,
  x: number,
  y: number,
  st: TextStyle,
  p: number,
  o: CounterOpts = {},
): number {
  const e = (o.ease ?? easeOutExpo)(clamp01(p));
  const cur = value * e;
  const body =
    o.decimals && o.decimals > 0
      ? cur.toFixed(o.decimals).replace('.', ',')
      : fmtNum(Math.round(cur));
  const affix: TextStyle = {
    ...st,
    size: st.size * 0.52,
    color: o.affixStyle?.color ?? st.color,
    ...o.affixStyle,
  };

  ctx.save();
  const align = st.align ?? 'left';
  const wPre = o.prefix ? measure(ctx, o.prefix, affix) + st.size * 0.1 : 0;
  const wBody = measure(ctx, body, st);
  const wSuf = o.suffix ? measure(ctx, o.suffix, affix) + st.size * 0.12 : 0;
  const total = wPre + wBody + wSuf;
  let cx = x;
  if (align === 'center') cx = x - total / 2;
  else if (align === 'right') cx = x - total;

  const left: TextStyle = { ...st, align: 'left' };
  const leftAffix: TextStyle = { ...affix, align: 'left' };
  if (o.prefix) text(ctx, o.prefix, cx, y, leftAffix);
  text(ctx, body, cx + wPre, y, left);
  if (o.suffix) text(ctx, o.suffix, cx + wPre + wBody + st.size * 0.12, y, leftAffix);
  ctx.restore();
  return total;
}
