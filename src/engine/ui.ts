/** Составные элементы инфографики: чипы, плитки, списки, таблица статистики. */

import { clamp01, easeOutBack, easeOutCubic, easeOutQuart } from './anim.ts';
import { divider, hexPath, panel, rrPath } from './draw.ts';
import { icon } from './icons.ts';
import { measure, MIN_TEXT, text, type TextStyle } from './text.ts';
import { a, C } from './theme.ts';

type Ctx = CanvasRenderingContext2D;

// ---------------------------------------------------------------- chip

export interface ChipOpts {
  color?: string;
  bg?: string;
  size?: number;
  icon?: string;
  padX?: number;
  height?: number;
  /** 0..1 — появление снизу с лёгким «перелётом». */
  p?: number;
  align?: 'left' | 'center';
}

/** Пилюля с текстом и опциональной иконкой. Возвращает ширину. */
export function chip(ctx: Ctx, label: string, x: number, y: number, o: ChipOpts = {}): number {
  const p = clamp01(o.p ?? 1);
  if (p <= 0) return 0;
  const size = Math.max(MIN_TEXT, o.size ?? 26);
  const h = o.height ?? size * 1.86;
  const padX = o.padX ?? size * 0.78;
  const color = o.color ?? C.h1;
  const st: TextStyle = { size, weight: 700, color, tracking: 1.6, baseline: 'middle' };
  const icoW = o.icon ? h * 0.62 : 0;
  const w = padX * 2 + measure(ctx, label, st) + icoW + (o.icon ? padX * 0.45 : 0);
  const bx = o.align === 'center' ? x - w / 2 : x;

  ctx.save();
  ctx.globalAlpha *= p;
  ctx.translate(0, (1 - easeOutBack(p)) * 16);
  panel(ctx, bx, y - h / 2, w, h, {
    fill: o.bg ?? a(color, 0.1),
    stroke: a(color, 0.42),
    lineWidth: 1.6,
    radius: h / 2,
  });
  let tx = bx + padX;
  if (o.icon) {
    icon(ctx, o.icon, tx + icoW / 2, y, icoW, color);
    tx += icoW + padX * 0.45;
  }
  text(ctx, label, tx, y + 1, st);
  ctx.restore();
  return w;
}

// ---------------------------------------------------------------- stat tile

export interface StatTileOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  value: string;
  label: string;
  icon?: string;
  color?: string;
  p?: number;
  /** Время для «живых» иконок. */
  t?: number;
}

export function statTile(ctx: Ctx, o: StatTileOpts): void {
  const p = clamp01(o.p ?? 1);
  if (p <= 0) return;
  const e = easeOutQuart(p);
  const color = o.color ?? C.h1;
  ctx.save();
  ctx.globalAlpha *= e;
  ctx.translate(0, (1 - e) * 34);
  panel(ctx, o.x, o.y, o.w, o.h, {
    fill: C.panel,
    stroke: a(color, 0.28),
    lineWidth: 1.6,
    radius: 12,
    accentBar: { color: a(color, 0.9), width: 4 },
  });
  if (o.icon) icon(ctx, o.icon, o.x + o.w - 64, o.y + 62, 52, a(color, 0.55), o.t ?? 0);
  text(ctx, o.value, o.x + 34, o.y + o.h * 0.55, { size: o.h * 0.42, weight: 700, color });
  text(ctx, o.label, o.x + 34, o.y + o.h - 30, {
    size: 46,
    weight: 700,
    color: a(C.text, 0.6),
    tracking: 1.2,
    maxWidth: o.w - 68,
  });
  ctx.restore();
}

// ---------------------------------------------------------------- list row

export interface ListRowOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  index: number;
  label: string;
  icon?: string;
  color?: string;
  /** Появление строки. */
  p?: number;
  /** Приглушение уже «прочитанных» строк. */
  dim?: number;
  /** Подсветка активной строки. */
  active?: number;
  t?: number;
}

export function listRow(ctx: Ctx, o: ListRowOpts): void {
  const p = clamp01(o.p ?? 1);
  if (p <= 0) return;
  const e = easeOutQuart(p);
  const act = clamp01(o.active ?? 0);
  const color = o.color ?? C.h1;
  const dim = clamp01(o.dim ?? 0);
  const alpha = e * (1 - dim * 0.55);

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate((1 - e) * -40, 0);

  // фон активной строки
  if (act > 0.01) {
    ctx.save();
    ctx.globalAlpha *= act;
    const g = ctx.createLinearGradient(o.x, 0, o.x + o.w, 0);
    g.addColorStop(0, a(color, 0.14));
    g.addColorStop(1, a(color, 0));
    ctx.fillStyle = g;
    rrPath(ctx, o.x, o.y, o.w, o.h, 8);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillRect(o.x, o.y + 6, 3, o.h - 12);
    ctx.restore();
  }

  const cy = o.y + o.h / 2;
  const box = o.h * 0.62;
  // иконка в гексе
  ctx.save();
  ctx.globalAlpha *= 0.9;
  hexPath(ctx, o.x + 46, cy, box * 0.72, Math.PI / 6);
  ctx.strokeStyle = a(color, 0.35 + act * 0.5);
  ctx.lineWidth = 1.8;
  ctx.stroke();
  if (o.icon) icon(ctx, o.icon, o.x + 46, cy, box * 0.62, a(color, 0.7 + act * 0.3), o.t ?? 0);
  ctx.restore();

  text(ctx, String(o.index).padStart(2, '0'), o.x + 96, cy + 9, {
    size: 26,
    family: 'mono',
    weight: 700,
    color: a(C.pos, 0.65),
  });

  text(ctx, o.label, o.x + 156, cy + 11, {
    size: 34,
    weight: 700,
    color: act > 0.4 ? C.text : a(C.text, 0.82),
    tracking: 0.6,
    maxWidth: o.w - 190,
  });

  divider(ctx, o.x, o.y + o.h, o.w, e, a(C.text, 0.08), 1);
  ctx.restore();
}

// ---------------------------------------------------------------- таблица статистики (стиль Steam)

export interface TableCol {
  title: string;
  /** Доля ширины таблицы. */
  flex: number;
  align?: 'left' | 'right';
  /** Приглушённая колонка (как «прошлый период» в Steam). */
  muted?: boolean;
}

export interface TableCell {
  text: string;
  color?: string;
  /** Подчёркивание (ссылка). */
  link?: boolean;
}

export interface TableRow {
  cells: Array<string | TableCell>;
  /** Уровень вложенности первой колонки. */
  indent?: number;
  /** Подсветить строку. */
  highlight?: number;
}

export interface TableOpts {
  x: number;
  y: number;
  w: number;
  rowH?: number;
  headH?: number;
  cols: TableCol[];
  rows: TableRow[];
  /** Общий прогресс появления (строки выезжают по очереди). */
  p?: number;
  stagger?: number;
  title?: string;
  titleAccent?: string;
  fontSize?: number;
}

const cellOf = (c: string | TableCell): TableCell => (typeof c === 'string' ? { text: c } : c);

/** Таблица в духе Steam Partner Stats: тёмные полосы, ссылки, зелёные дельты. */
export function statsTable(ctx: Ctx, o: TableOpts): number {
  const fs = Math.max(MIN_TEXT, o.fontSize ?? 28);
  // геометрия строк тянется за кеглем, иначе текст вылезает из полос
  const rowH = Math.max(o.rowH ?? 58, fs * 1.72);
  const headH = Math.max(o.headH ?? 74, fs * 2.5);
  const p = clamp01(o.p ?? 1);
  const stagger = o.stagger ?? 0.12;
  const n = o.rows.length;
  const span = 1 + stagger * n;

  const totalFlex = o.cols.reduce((s, c) => s + c.flex, 0);
  const padX = 22;
  const bounds: Array<{ x: number; w: number }> = [];
  let cx = o.x;
  for (const c of o.cols) {
    const w = (o.w * c.flex) / totalFlex;
    bounds.push({ x: cx, w });
    cx += w;
  }

  const colX = (i: number, align: 'left' | 'right') =>
    align === 'right' ? bounds[i].x + bounds[i].w - padX : bounds[i].x + padX;

  // шапка
  const headP = clamp01(p * span);
  ctx.save();
  ctx.globalAlpha *= easeOutCubic(headP);
  o.cols.forEach((c, i) => {
    const align = c.align ?? (i === 0 ? 'left' : 'right');
    const st: TextStyle = {
      size: fs * 0.98,
      weight: 700,
      color: c.muted ? a(C.text, 0.42) : C.text,
      align,
      tracking: 0.4,
      maxWidth: bounds[i].w - padX * 2,
      lineHeight: 1.02,
    };
    if (i === 0 && o.title) {
      const tw = text(ctx, o.title, colX(i, 'left'), o.y + headH - 24, {
        ...st,
        color: C.h1,
        size: fs * 1.16,
      });
      if (o.titleAccent) {
        text(ctx, o.titleAccent, colX(i, 'left') + tw + fs * 0.34, o.y + headH - 24, {
          ...st,
          color: C.accent,
          size: fs * 1.16,
        });
      }
    } else {
      // Заголовки колонок могут переноситься в две строки, как в Steam.
      const lines = c.title.split('\n');
      lines.forEach((ln, li) =>
        text(ctx, ln, colX(i, align), o.y + headH - 24 - (lines.length - 1 - li) * fs * 1.05, st),
      );
    }
  });
  divider(ctx, o.x, o.y + headH, o.w, headP, a(C.text, 0.16), 1.5);
  ctx.restore();

  // строки
  o.rows.forEach((r, ri) => {
    const rp = clamp01(p * span - (ri + 1) * stagger);
    if (rp <= 0) return;
    const e = easeOutQuart(rp);
    const ry = o.y + headH + ri * rowH;
    ctx.save();
    ctx.globalAlpha *= e;

    if (ri % 2 === 0) {
      ctx.fillStyle = C.panel;
      ctx.fillRect(o.x, ry, o.w, rowH);
    }
    const hl = clamp01(r.highlight ?? 0);
    if (hl > 0.01) {
      ctx.save();
      ctx.globalAlpha *= hl;
      const g = ctx.createLinearGradient(o.x, 0, o.x + o.w, 0);
      g.addColorStop(0, a(C.accent, 0.2));
      g.addColorStop(1, a(C.accent, 0.04));
      ctx.fillStyle = g;
      ctx.fillRect(o.x, ry, o.w, rowH);
      ctx.fillStyle = C.accent;
      ctx.fillRect(o.x, ry, 3, rowH);
      ctx.restore();
    }

    r.cells.forEach((raw, ci) => {
      if (ci >= o.cols.length) return;
      const cell = cellOf(raw);
      const col = o.cols[ci];
      const align = col.align ?? (ci === 0 ? 'left' : 'right');
      const indent = ci === 0 ? (r.indent ?? 0) * 34 : 0;
      const tx = colX(ci, align) + (align === 'left' ? indent : 0);
      const ty = ry + rowH / 2 + fs * 0.36;
      const st: TextStyle = {
        size: fs,
        weight: 700,
        color: cell.color ?? (col.muted ? a(C.text, 0.42) : C.text),
        align,
        tracking: 0.3,
      };
      const tw = text(ctx, cell.text, tx, ty, st);
      if (cell.link) {
        ctx.strokeStyle = a(st.color as string, 0.55);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        const lx = align === 'right' ? tx - tw : tx;
        ctx.moveTo(lx, ty + 7);
        ctx.lineTo(lx + tw, ty + 7);
        ctx.stroke();
      }
    });
    ctx.restore();
  });

  return headH + n * rowH;
}

// ---------------------------------------------------------------- прочее

/** Гекс-аватар с инициалами. */
export function avatarHex(
  ctx: Ctx,
  cx: number,
  cy: number,
  r: number,
  initials: string,
  p = 1,
  t = 0,
): void {
  const e = easeOutQuart(clamp01(p));
  if (e <= 0) return;
  ctx.save();
  ctx.globalAlpha *= e;
  ctx.translate(cx, cy);
  ctx.scale(0.9 + e * 0.1, 0.9 + e * 0.1);
  hexPath(ctx, 0, 0, r, Math.PI / 6);
  ctx.fillStyle = C.panel;
  ctx.fill();
  ctx.strokeStyle = a(C.h1, 0.55);
  ctx.lineWidth = 3;
  ctx.stroke();
  hexPath(ctx, 0, 0, r + 16 + Math.sin(t * 1.4) * 3, Math.PI / 6);
  ctx.strokeStyle = a(C.h1, 0.16);
  ctx.lineWidth = 1.6;
  ctx.stroke();
  text(ctx, initials, 0, r * 0.34, {
    size: r * 0.92,
    weight: 700,
    color: C.h1,
    align: 'center',
    tracking: 2,
  });
  ctx.restore();
}

export interface VideoCardOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  tag?: string;
  p?: number;
  t?: number;
  color?: string;
}

/** Карточка-превью ролика (плейсхолдер под ссылку в описании). */
export function videoCard(ctx: Ctx, o: VideoCardOpts): void {
  const p = clamp01(o.p ?? 1);
  if (p <= 0) return;
  const e = easeOutQuart(p);
  const color = o.color ?? C.h1;
  ctx.save();
  ctx.globalAlpha *= e;
  ctx.translate(0, (1 - e) * 40);
  const thumbH = o.h - 140;
  panel(ctx, o.x, o.y, o.w, o.h, {
    fill: C.panel,
    stroke: a(color, 0.3),
    radius: 14,
    lineWidth: 1.6,
  });
  // «превью»
  ctx.save();
  rrPath(ctx, o.x + 12, o.y + 12, o.w - 24, thumbH, 10);
  ctx.clip();
  const g = ctx.createLinearGradient(o.x, o.y, o.x + o.w, o.y + thumbH);
  g.addColorStop(0, a(color, 0.22));
  g.addColorStop(1, a(C.accent, 0.08));
  ctx.fillStyle = g;
  ctx.fillRect(o.x + 12, o.y + 12, o.w - 24, thumbH);
  const t = o.t ?? 0;
  ctx.strokeStyle = a(C.text, 0.07);
  ctx.lineWidth = 1;
  for (let i = -6; i < 14; i++) {
    const gx = o.x + 12 + ((i * 60 + ((t * 14) % 60)) % (o.w + 360)) - 60;
    ctx.beginPath();
    ctx.moveTo(gx, o.y + 12);
    ctx.lineTo(gx - 60, o.y + 12 + thumbH);
    ctx.stroke();
  }
  ctx.restore();

  // play-кнопка
  const pcx = o.x + o.w / 2;
  const pcy = o.y + 12 + thumbH / 2;
  ctx.save();
  ctx.globalAlpha *= 0.95;
  ctx.beginPath();
  ctx.arc(pcx, pcy, 38, 0, Math.PI * 2);
  ctx.fillStyle = a(C.bg, 0.7);
  ctx.fill();
  ctx.strokeStyle = a(color, 0.8);
  ctx.lineWidth = 2.4;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pcx - 12, pcy - 17);
  ctx.lineTo(pcx + 20, pcy);
  ctx.lineTo(pcx - 12, pcy + 17);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  text(ctx, o.title, o.x + 22, o.y + o.h - 72, {
    size: 46,
    weight: 700,
    color: C.text,
    maxWidth: o.w - 44,
  });
  if (o.tag) {
    text(ctx, o.tag, o.x + 22, o.y + o.h - 20, {
      size: 46,
      color: a(C.pos, 0.85),
      tracking: 1.2,
    });
  }
  ctx.restore();
}
