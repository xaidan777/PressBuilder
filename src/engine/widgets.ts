/** Виджеты второй части: рейтинг Steam, карточки отзывов, таймлайн, полосы сравнения. */

import { clamp01, easeOutCubic, easeOutQuart, hash11 } from './anim.ts';
import { arrow, hexPath, panel, polyline, rrPath, smoothPath } from './draw.ts';
import { icon } from './icons.ts';
import { measure, text, wrap, type TextStyle } from './text.ts';
import { a, C } from './theme.ts';

type Ctx = CanvasRenderingContext2D;

// ---------------------------------------------------------------- рейтинг Steam

export interface RatingOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Показатель 0..100. */
  percent: number;
  label: string;
  color?: string;
  p?: number;
  /** Подпись под шкалой. */
  note?: string;
}

/** Плашка «оценка обзоров»: процент, словесная метка и шкала. */
export function ratingBadge(ctx: Ctx, o: RatingOpts): void {
  const p = clamp01(o.p ?? 1);
  if (p <= 0) return;
  const e = easeOutQuart(p);
  const color = o.color ?? C.pos;
  ctx.save();
  ctx.globalAlpha *= e;
  ctx.translate(0, (1 - e) * 24);
  panel(ctx, o.x, o.y, o.w, o.h, {
    fill: C.panel,
    stroke: a(color, 0.34),
    radius: 14,
    lineWidth: 1.8,
    glow: a(color, 0.12),
    glowBlur: 44,
  });

  text(ctx, 'оценка обзоров', o.x + 34, o.y + 58, {
    size: 46,
    color: a(C.text, 0.45),
    tracking: 1.6,
  });
  const pctStr = `${Math.round(o.percent)}%`;
  // проценту нужен воздух под шапкой, иначе цифра наезжает на подпись
  const pctY = o.y + 182;
  text(ctx, pctStr, o.x + 34, pctY, { size: 118, color });
  const pw = measure(ctx, pctStr, { size: 118 });
  // длинная метка переносится в две строки — поднимаем её, чтобы не налезть на шкалу
  const labelSt: TextStyle = {
    size: 52,
    color,
    tracking: 1.2,
    lineHeight: 1.04,
    maxWidth: o.w - pw - 100,
  };
  const lines = wrap(ctx, o.label, labelSt).length;
  text(ctx, o.label, o.x + 54 + pw, pctY - 10 - (lines - 1) * labelSt.size * 1.04, labelSt);

  // шкала
  const bx = o.x + 34;
  const bw = o.w - 68;
  const by = pctY + 36;
  ctx.fillStyle = a(C.text, 0.1);
  rrPath(ctx, bx, by, bw, 14, 7);
  ctx.fill();
  ctx.fillStyle = color;
  rrPath(ctx, bx, by, Math.max(14, (bw * clamp01(o.percent / 100)) * e), 14, 7);
  ctx.fill();

  if (o.note) {
    text(ctx, o.note, bx, by + 72, { size: 46, color: a(C.text, 0.45), tracking: 1.2 });
  }
  ctx.restore();
}

// ---------------------------------------------------------------- карточка отзыва

export interface ReviewOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  positive: boolean;
  /** Наигранное время, например «0.2 ч». */
  playtime?: string;
  /** Языковая метка: «RU», «EN», «中文». */
  lang?: string;
  /** Текст отзыва; если не задан — рисуются абстрактные полосы. */
  quote?: string;
  p?: number;
  seed?: number;
  /** Подсветить как «подозрительный». */
  flag?: number;
}

export function reviewCard(ctx: Ctx, o: ReviewOpts): void {
  const p = clamp01(o.p ?? 1);
  if (p <= 0) return;
  const e = easeOutQuart(p);
  const color = o.positive ? C.pos : C.accent;
  const seed = o.seed ?? 0;
  ctx.save();
  ctx.globalAlpha *= e;
  ctx.translate((1 - e) * 40, 0);
  panel(ctx, o.x, o.y, o.w, o.h, {
    fill: C.panel,
    stroke: a(color, 0.3 + (o.flag ?? 0) * 0.4),
    radius: 12,
    lineWidth: 1.6,
    accentBar: { color: a(color, 0.85), width: 4 },
  });

  // палец вниз — тот же значок, повёрнутый на 180°
  ctx.save();
  ctx.translate(o.x + 52, o.y + 54);
  if (!o.positive) ctx.rotate(Math.PI);
  icon(ctx, 'thumb', 0, 0, 40, color);
  ctx.restore();
  text(ctx, o.positive ? 'рекомендую' : 'не рекомендую', o.x + 88, o.y + 70, {
    size: 46,
    color: a(color, 0.9),
    tracking: 0.8,
  });

  if (o.playtime) {
    text(ctx, o.playtime, o.x + o.w - 26, o.y + 68, {
      size: 46,
      family: 'mono',
      color: a(C.text, 0.5),
      align: 'right',
    });
  }

  if (o.quote) {
    text(ctx, o.quote, o.x + 28, o.y + 138, {
      size: 50,
      color: a(C.text, 0.85),
      maxWidth: o.w - 170,
      tracking: 0.4,
    });
  } else {
    for (let i = 0; i < 2; i++) {
      ctx.fillStyle = a(C.text, 0.16);
      const bw = (o.w - 150) * (0.55 + hash11(seed * 3.7 + i) * 0.4);
      rrPath(ctx, o.x + 28, o.y + 112 + i * 30, bw, 12, 6);
      ctx.fill();
    }
  }

  if (o.lang) {
    const lw = measure(ctx, o.lang, { size: 40 }) + 34;
    panel(ctx, o.x + o.w - lw - 26, o.y + o.h - 66, lw, 52, {
      fill: a(C.text, 0.08),
      stroke: a(C.text, 0.18),
      radius: 26,
      lineWidth: 1,
    });
    text(ctx, o.lang, o.x + o.w - lw / 2 - 26, o.y + o.h - 30, {
      size: 40,
      color: a(C.text, 0.6),
      align: 'center',
      caps: 'normal',
    });
  }
  ctx.restore();
}

// ---------------------------------------------------------------- таймлайн дат

export interface TrackMark {
  /** Позиция 0..1 вдоль дорожки. */
  k: number;
  label: string;
  sub?: string;
  color?: string;
}

export interface TrackOpts {
  x: number;
  y: number;
  w: number;
  marks: TrackMark[];
  /** Докуда дошла «жёлтая» линия времени, 0..1. */
  progress: number;
  /** Где сейчас спрайт релиза, 0..1. */
  sprite: number;
  /** Общая прозрачность/появление. */
  p?: number;
  t?: number;
  /** Подпрыгивание спрайта (0..1) в момент переноса. */
  jump?: number;
}

/** Горизонтальная дорожка времени с метками и «спрайтом» релиза. */
export function track(ctx: Ctx, o: TrackOpts): void {
  const p = clamp01(o.p ?? 1);
  if (p <= 0) return;
  const gt = o.t ?? 0;
  ctx.save();
  ctx.globalAlpha *= easeOutCubic(p);

  // основа
  ctx.strokeStyle = a(C.text, 0.16);
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(o.x, o.y);
  ctx.lineTo(o.x + o.w, o.y);
  ctx.stroke();

  // засечки
  for (let i = 0; i <= 24; i++) {
    const tx = o.x + (o.w * i) / 24;
    ctx.strokeStyle = a(C.text, i % 6 === 0 ? 0.28 : 0.12);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx, o.y - (i % 6 === 0 ? 14 : 7));
    ctx.lineTo(tx, o.y + (i % 6 === 0 ? 14 : 7));
    ctx.stroke();
  }

  // жёлтая линия времени
  const pw = o.w * clamp01(o.progress);
  ctx.save();
  ctx.shadowColor = a(C.accent, 0.6);
  ctx.shadowBlur = 18;
  ctx.strokeStyle = C.accent;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(o.x, o.y);
  ctx.lineTo(o.x + pw, o.y);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = C.accent;
  ctx.beginPath();
  ctx.arc(o.x + pw, o.y, 9, 0, Math.PI * 2);
  ctx.fill();

  // метки
  o.marks.forEach((m) => {
    const mx = o.x + o.w * m.k;
    const col = m.color ?? a(C.text, 0.5);
    ctx.strokeStyle = a(col, 0.5);
    ctx.setLineDash([5, 7]);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(mx, o.y - 26);
    ctx.lineTo(mx, o.y - 96);
    ctx.stroke();
    ctx.setLineDash([]);
    text(ctx, m.label, mx, o.y - 114, { size: 52, color: col, align: 'center', tracking: 0.8 });
    if (m.sub) {
      text(ctx, m.sub, mx, o.y + 76, {
        size: 46,
        color: a(C.text, 0.42),
        align: 'center',
        tracking: 1.2,
      });
    }
  });

  // спрайт релиза
  const sx = o.x + o.w * clamp01(o.sprite);
  const jump = clamp01(o.jump ?? 0);
  const sy = o.y - 46 - Math.sin(jump * Math.PI) * 90;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(Math.sin(gt * 1.2) * 0.06 + jump * 0.5);
  // свечение — тенью по контуру, а не заливкой прямоугольника:
  // прямоугольная заливка давала видимый «квадрат» поверх фона
  ctx.shadowColor = a(C.h1, 0.75);
  ctx.shadowBlur = 46;
  hexPath(ctx, 0, 0, 34, Math.PI / 6);
  ctx.fillStyle = C.panel;
  ctx.fill();
  ctx.strokeStyle = C.h1;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.shadowBlur = 0;
  icon(ctx, 'rocket', 0, 0, 34, C.h1, gt);
  ctx.restore();

  ctx.restore();
}

// ---------------------------------------------------------------- полоса сравнения

export interface CompareOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  /** Доля заполнения 0..1. */
  value: number;
  valueText: string;
  color?: string;
  p?: number;
  icon?: string;
}

/** Горизонтальная полоса «подпись — шкала — значение». */
export function compareBar(ctx: Ctx, o: CompareOpts): void {
  const p = clamp01(o.p ?? 1);
  if (p <= 0) return;
  const e = easeOutQuart(p);
  const color = o.color ?? C.h1;
  ctx.save();
  ctx.globalAlpha *= e;
  text(ctx, o.label, o.x, o.y - 26, { size: 46, color: a(C.text, 0.7), tracking: 0.8 });
  ctx.fillStyle = a(C.text, 0.08);
  rrPath(ctx, o.x, o.y, o.w, o.h, o.h / 2);
  ctx.fill();
  ctx.save();
  ctx.shadowColor = a(color, 0.45);
  ctx.shadowBlur = 20;
  ctx.fillStyle = color;
  rrPath(ctx, o.x, o.y, Math.max(o.h, o.w * clamp01(o.value) * e), o.h, o.h / 2);
  ctx.fill();
  ctx.restore();
  if (o.icon) icon(ctx, o.icon, o.x + o.w + 54, o.y + o.h / 2, 40, color);
  text(ctx, o.valueText, o.x + o.w + (o.icon ? 96 : 32), o.y + o.h / 2 + 16, {
    size: 44,
    color,
  });
  ctx.restore();
}

// ---------------------------------------------------------------- абстрактный график

export interface CurveOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Значения 0..1 по высоте. */
  data: number[];
  p: number;
  color?: string;
  lineWidth?: number;
  fill?: boolean;
  dashed?: boolean;
  smooth?: boolean;
}

/** Безосный график в нормированных координатах — для «абстрактных» кривых. */
export function curve(ctx: Ctx, o: CurveOpts): void {
  const p = clamp01(o.p);
  if (p <= 0) return;
  const color = o.color ?? C.h1;
  const pts: Array<[number, number]> = o.data.map((v, i) => [
    o.x + (o.w * i) / Math.max(1, o.data.length - 1),
    o.y + o.h * (1 - clamp01(v)),
  ]);
  ctx.save();
  ctx.beginPath();
  ctx.rect(o.x - 6, o.y - o.h, o.w * p + 12, o.h * 3);
  ctx.clip();

  if (o.fill) {
    const g = ctx.createLinearGradient(0, o.y, 0, o.y + o.h);
    g.addColorStop(0, a(color, 0.28));
    g.addColorStop(1, a(color, 0));
    ctx.fillStyle = g;
    if (o.smooth !== false) smoothPath(ctx, pts);
    else polyline(ctx, pts);
    ctx.lineTo(o.x + o.w, o.y + o.h);
    ctx.lineTo(o.x, o.y + o.h);
    ctx.closePath();
    ctx.fill();
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = o.lineWidth ?? 5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (o.dashed) ctx.setLineDash([14, 12]);
  ctx.shadowColor = a(color, 0.5);
  ctx.shadowBlur = 16;
  if (o.smooth !== false) smoothPath(ctx, pts);
  else polyline(ctx, pts);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- воронка денег

export interface WaterfallStep {
  label: string;
  value: number;
  color?: string;
}

export interface WaterfallOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  steps: WaterfallStep[];
  /** Подписи вычетов между столбцами (на одну меньше, чем столбцов). */
  losses?: string[];
  p: number;
  fmt?: (v: number) => string;
  stagger?: number;
}

/**
 * Каскад «сколько осталось на каждом шаге»: столбцы + пунктирные переходы
 * с подписью, сколько именно съел очередной вычет.
 */
export function waterfall(ctx: Ctx, o: WaterfallOpts): void {
  const p = clamp01(o.p);
  if (p <= 0) return;
  const n = o.steps.length;
  const max = Math.max(...o.steps.map((s) => s.value));
  const slot = o.w / n;
  const bw = slot * 0.54;
  const stagger = o.stagger ?? 0.26;
  const span = 1 + stagger * (n - 1);
  const fmt = o.fmt ?? ((v: number) => `$${Math.round(v)}`);

  const cx = (i: number) => o.x + slot * (i + 0.5);
  const top = (i: number) => o.y + o.h - (o.h * o.steps[i].value) / max;

  o.steps.forEach((s, i) => {
    const sp = clamp01(p * span - i * stagger);
    if (sp <= 0) return;
    const e = easeOutQuart(sp);
    const color = s.color ?? C.h1;
    const bh = (o.h * s.value * e) / max;
    const bx = cx(i) - bw / 2;

    ctx.save();
    ctx.globalAlpha *= Math.min(1, sp * 3);
    ctx.shadowColor = a(color, 0.45);
    ctx.shadowBlur = 22;
    const g = ctx.createLinearGradient(0, o.y + o.h - bh, 0, o.y + o.h);
    g.addColorStop(0, a(color, 0.95));
    g.addColorStop(1, a(color, 0.35));
    ctx.fillStyle = g;
    rrPath(ctx, bx, o.y + o.h - bh, bw, bh, [10, 10, 3, 3]);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha *= clamp01((sp - 0.4) / 0.4);
    text(ctx, fmt(s.value), cx(i), o.y + o.h - bh - 30, {
      size: 66,
      color,
      align: 'center',
    });
    text(ctx, s.label, cx(i), o.y + o.h + 62, {
      size: 46,
      color: a(C.text, 0.55),
      align: 'center',
      tracking: 1,
      maxWidth: slot - 20,
      lineHeight: 1.12,
    });
    ctx.restore();
  });

  // переходы между столбцами
  (o.losses ?? []).forEach((label, i) => {
    const sp = clamp01(p * span - (i + 1) * stagger);
    if (sp <= 0) return;
    const y0 = top(i);
    const y1 = top(i + 1);
    const x0 = cx(i) + bw / 2;
    // спуск рисуем у левого края следующего столбца, чтобы не наехать на его цифру
    const ax = cx(i + 1) - bw / 2;
    const mid = (x0 + ax) / 2;
    ctx.save();
    ctx.globalAlpha *= easeOutQuart(sp) * 0.9;
    ctx.strokeStyle = a(C.accent, 0.5);
    ctx.setLineDash([7, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(ax, y0);
    ctx.stroke();
    ctx.setLineDash([]);
    arrow(ctx, ax, y0 + 6, ax, y1 - 12, clamp01(sp * 1.6 - 0.3), {
      color: C.accent,
      width: 3,
      head: 14,
    });
    const delta = o.steps[i].value - o.steps[i + 1].value;
    text(ctx, `−${fmt(delta)}`, mid, y0 - 26, {
      size: 50,
      color: C.accent,
      align: 'center',
    });
    text(ctx, label, mid, y0 + 44, {
      size: 46,
      color: a(C.text, 0.5),
      align: 'center',
      tracking: 0.8,
      maxWidth: ax - x0 - 4,
      lineHeight: 1.12,
    });
    ctx.restore();
  });
}

/** Подпись-выноска с рамкой — для терминов и пояснений. */
export function callout(
  ctx: Ctx,
  title: string,
  body: string,
  x: number,
  y: number,
  w: number,
  p: number,
  color: string = C.h1,
): void {
  const e = easeOutQuart(clamp01(p));
  if (e <= 0) return;
  const st: TextStyle = { size: 46, color: a(C.text, 0.8), maxWidth: w - 60, lineHeight: 1.2 };
  const h = 128 + wrap(ctx, body, st).length * st.size * 1.2;
  ctx.save();
  ctx.globalAlpha *= e;
  ctx.translate(0, (1 - e) * 20);
  panel(ctx, x, y, w, h, {
    fill: a(C.panel, 0.95),
    stroke: a(color, 0.35),
    radius: 12,
    lineWidth: 1.6,
    accentBar: { color, width: 4 },
  });
  text(ctx, title, x + 30, y + 62, { size: 46, color, tracking: 1.6 });
  text(ctx, body, x + 30, y + 126, st);
  ctx.restore();
}
