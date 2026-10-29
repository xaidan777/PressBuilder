/**
 * Строительные блоки сцен, которые раньше каждый ролик писал себе сам:
 * появление/уход, ключевые кадры, окно приложения, курсор, потоки по кривой,
 * печать кода с подсветкой, строки терминала, бейджи, зачёркивание, штамп,
 * частицы, развёртка-сканер, звуковая дорожка, слайдер и переключатель.
 */

import { clamp01, easeInOutCubic, easeOutBack, easeOutCubic, easeOutQuart, hash11, lerp } from './anim.ts';
import { rrPath } from './draw.ts';
import { measure, MIN_TEXT, text, type TextStyle } from './text.ts';
import { a, C } from './theme.ts';

type Ctx = CanvasRenderingContext2D;
export type Pt = [number, number];
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ---------------------------------------------------------------- появление и уход

export interface AppearOpts {
  /** Сдвиг на старте. */
  dx?: number;
  dy?: number;
  /** Масштаб на старте вокруг (cx, cy). */
  from?: number;
  cx?: number;
  cy?: number;
  /** Масштаб с «перелётом» (easeOutBack). */
  back?: boolean;
}

/** Появление группы: прозрачность + сдвиг + масштаб. `p` 0..1. */
export function appear(ctx: Ctx, p: number, fn: () => void, o: AppearOpts = {}): void {
  const pr = clamp01(p);
  if (pr <= 0) return;
  const e = easeOutQuart(pr);
  ctx.save();
  ctx.globalAlpha *= Math.min(1, pr * 1.6);
  ctx.translate((o.dx ?? 0) * (1 - e), (o.dy ?? 24) * (1 - e));
  if (o.from !== undefined && o.from !== 1) {
    const s = o.from + (1 - o.from) * (o.back ? easeOutBack(pr) : e);
    ctx.translate(o.cx ?? 0, o.cy ?? 0);
    ctx.scale(s, s);
    ctx.translate(-(o.cx ?? 0), -(o.cy ?? 0));
  }
  fn();
  ctx.restore();
}

export interface StageOpts extends AppearOpts {
  /** Куда уезжает на уходе. */
  outDx?: number;
  outDy?: number;
  /** Масштаб на уходе. */
  to?: number;
}

/** Вход по `pin` и уход по `pout` (оба 0..1) — для частей сцены, сменяющих друг друга. */
export function stage(ctx: Ctx, pin: number, pout: number, fn: () => void, o: StageOpts = {}): void {
  const po = clamp01(pout);
  if (clamp01(pin) <= 0 || po >= 1) return;
  const e = easeInOutCubic(po);
  ctx.save();
  ctx.globalAlpha *= 1 - e;
  ctx.translate((o.outDx ?? 0) * e, (o.outDy ?? -24) * e);
  if (o.to !== undefined && o.to !== 1) {
    const s = 1 + (o.to - 1) * e;
    ctx.translate(o.cx ?? 0, o.cy ?? 0);
    ctx.scale(s, s);
    ctx.translate(-(o.cx ?? 0), -(o.cy ?? 0));
  }
  appear(ctx, pin, fn, o);
  ctx.restore();
}

// ---------------------------------------------------------------- траектории

/**
 * Позиция по ключевым кадрам `[k, x, y]` (k — время или доля, по возрастанию).
 * Между ключами — easeInOutCubic: так двигается курсор или камера.
 */
export function along(p: number, keys: Array<[number, number, number]>): Pt {
  if (!keys.length) return [0, 0];
  if (p <= keys[0][0]) return [keys[0][1], keys[0][2]];
  for (let i = 1; i < keys.length; i++) {
    const [k1, x1, y1] = keys[i];
    if (p <= k1) {
      const [k0, x0, y0] = keys[i - 1];
      const e = easeInOutCubic(clamp01((p - k0) / Math.max(1e-6, k1 - k0)));
      return [lerp(x0, x1, e), lerp(y0, y1, e)];
    }
  }
  const last = keys[keys.length - 1];
  return [last[1], last[2]];
}

/** «Наезд камеры»: промежуточная рамка между двумя областями. */
export const lerpRect = (r1: Rect, r2: Rect, k: number): Rect => ({
  x: lerp(r1.x, r2.x, k),
  y: lerp(r1.y, r2.y, k),
  w: lerp(r1.w, r2.w, k),
  h: lerp(r1.h, r2.h, k),
});

/** Точка квадратичной кривой Безье. */
export function bez(p0: Pt, p1: Pt, p2: Pt, k: number): Pt {
  const u = 1 - k;
  return [u * u * p0[0] + 2 * u * k * p1[0] + k * k * p2[0], u * u * p0[1] + 2 * u * k * p1[1] + k * k * p2[1]];
}

export interface FlowOpts {
  color?: string;
  width?: number;
  /** Сколько светящихся точек бежит по линии. */
  dots?: number;
  /** Оборотов в секунду. */
  speed?: number;
  /** Пунктирная основа. */
  dash?: boolean;
}

/**
 * Поток по кривой p0→p2 (p1 — контрольная): линия прорисовывается по `p`,
 * по нарисованной части бегут светящиеся точки. `t` — время для бега.
 */
export function flow(ctx: Ctx, p0: Pt, p1: Pt, p2: Pt, p: number, t: number, o: FlowOpts = {}): void {
  const pr = clamp01(p);
  if (pr <= 0) return;
  const color = o.color ?? C.h1;
  const steps = 40;
  ctx.save();
  ctx.strokeStyle = a(color, 0.4);
  ctx.lineWidth = o.width ?? 3;
  ctx.lineCap = 'round';
  if (o.dash) ctx.setLineDash([10, 10]);
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const [x, y] = bez(p0, p1, p2, (i / steps) * pr);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  const n = o.dots ?? 4;
  const r = (o.width ?? 3) * 2;
  ctx.fillStyle = color;
  ctx.shadowColor = a(color, 0.8);
  ctx.shadowBlur = 14;
  for (let i = 0; i < n; i++) {
    const k = (((t * (o.speed ?? 0.45) + i / n) % 1) + 1) % 1;
    if (k > pr) continue;
    const [x, y] = bez(p0, p1, p2, k);
    ctx.beginPath();
    ctx.arc(x, y, r * (0.6 + 0.4 * Math.sin(k * Math.PI)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- окно, курсор

export interface WindowOpts {
  /** Подпись в заголовке (функциональная: имя файла, программы). */
  title?: string;
  /** Высота заголовка. */
  bar?: number;
  /** Цвет свечения вокруг окна. */
  glow?: string;
}

/** Окно приложения: тёмное тело, заголовок с тремя кружками. Возвращает рамку содержимого. */
export function windowFrame(ctx: Ctx, x: number, y: number, w: number, h: number, o: WindowOpts = {}): Rect {
  const bar = o.bar ?? 56;
  ctx.save();
  if (o.glow) {
    ctx.shadowColor = o.glow;
    ctx.shadowBlur = 40;
  }
  rrPath(ctx, x, y, w, h, 16);
  ctx.fillStyle = C.bg;
  ctx.fill();
  ctx.restore();
  ctx.save();
  rrPath(ctx, x, y, w, bar, [16, 16, 0, 0]);
  ctx.fillStyle = C.panel;
  ctx.fill();
  [C.accent, a(C.text, 0.4), a(C.text, 0.4)].forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x + 30 + i * 26, y + bar / 2, 7, 0, Math.PI * 2);
    ctx.fill();
  });
  if (o.title) {
    text(ctx, o.title, x + 120, y + bar / 2 + 16, { size: MIN_TEXT, color: a(C.text, 0.55) });
  }
  rrPath(ctx, x, y, w, h, 16);
  ctx.strokeStyle = a(C.h1, 0.4);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
  return { x, y: y + bar, w, h: h - bar };
}

/** Уголки-скобки вокруг «экрана» (видоискатель). */
export function brackets(ctx: Ctx, r: Rect, len = 40, color: string = C.h1, lw = 4): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  const c = (x: number, y: number, sx: number, sy: number) => {
    ctx.beginPath();
    ctx.moveTo(x + len * sx, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + len * sy);
    ctx.stroke();
  };
  c(r.x, r.y, 1, 1);
  c(r.x + r.w, r.y, -1, 1);
  c(r.x, r.y + r.h, 1, -1);
  c(r.x + r.w, r.y + r.h, -1, -1);
  ctx.restore();
}

/** Курсор мыши (кончик в x, y). `press` 0..1 — нажатие: курсор приседает, расходится кольцо. */
export function cursor(ctx: Ctx, x: number, y: number, press = 0, color: string = C.text): void {
  const pr = clamp01(press);
  ctx.save();
  if (pr > 0 && pr < 1) {
    ctx.strokeStyle = a(C.h1, 1 - pr);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, 14 + pr * 34, 0, Math.PI * 2);
    ctx.stroke();
  }
  const s = 1 - Math.sin(pr * Math.PI) * 0.14;
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 46);
  ctx.lineTo(11, 35);
  ctx.lineTo(20, 55);
  ctx.lineTo(29, 51);
  ctx.lineTo(20, 32);
  ctx.lineTo(36, 32);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = C.bg;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

/** Пунктирная рамка выделения с «бегущими муравьями» и ручками по углам. */
export function selection(ctx: Ctx, r: Rect, gt: number, color: string = C.h1, handles = true): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 8]);
  ctx.lineDashOffset = -gt * 30;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.setLineDash([]);
  if (handles) {
    ctx.fillStyle = C.text;
    for (const [hx, hy] of [
      [r.x, r.y],
      [r.x + r.w, r.y],
      [r.x, r.y + r.h],
      [r.x + r.w, r.y + r.h],
    ]) {
      ctx.beginPath();
      ctx.arc(hx, hy, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- код и терминал

export type TokKind = 'kw' | 'fn' | 'str' | 'num' | 'com' | 'txt';
/** Строка кода — токены с типом для подсветки. */
export type CodeLine = Array<[string, TokKind]>;

/** Подсветка кода: ключевые слова голубые, функции жёлтые, строки зелёные. */
export const TOK_COLOR: Record<TokKind, string> = {
  // геттеры: цвета берутся из стиля ролика в момент рисования
  get kw() { return C.h1; },
  get fn() { return C.accent; },
  get str() { return C.pos; },
  get num() { return C.accent; },
  get com() { return a(C.text, 0.4); },
  get txt() { return C.text; },
};

/** Разбивка однострочника на токены: «fn:reveal§txt:(ctx, §str:'x'§txt:);» → CodeLine. */
export function tok(src: string): CodeLine {
  return src.split('§').map((part) => {
    const m = /^(kw|fn|str|num|com|txt):([\s\S]*)$/.exec(part);
    return m ? [m[2], m[1] as TokKind] : [part, 'txt'];
  });
}

export interface CodeOpts {
  size?: number;
  lineH?: number;
  /** Время для мигания курсора. */
  gt?: number;
  /** Номера строк слева. */
  numbers?: boolean;
}

/**
 * Печать кода с подсветкой: `typed` 0..1 — доля напечатанных знаков всего листинга.
 * Возвращает позицию курсора (для «живого» превью рядом).
 */
export function codeTyping(ctx: Ctx, lines: CodeLine[], x: number, y: number, typed: number, o: CodeOpts = {}): Pt {
  const size = Math.max(MIN_TEXT, o.size ?? MIN_TEXT);
  const lh = o.lineH ?? size * 1.32;
  const total = lines.reduce((s, l) => s + l.reduce((q, [str]) => q + str.length, 0), 0);
  let left = Math.round(total * clamp01(typed));
  let caret: Pt = [x, y];
  const gx = o.numbers ? x + size * 1.6 : x;
  lines.forEach((line, i) => {
    const ly = y + i * lh;
    const lineLen = line.reduce((q, [str]) => q + str.length, 0);
    if (left <= 0 && i > 0) return;
    if (o.numbers) text(ctx, String(i + 1), x + size * 0.9, ly, { size, family: 'mono', color: a(C.text, 0.3), align: 'right' });
    let cx = gx;
    for (const [str, kind] of line) {
      const shown = str.slice(0, Math.max(0, left));
      left -= shown.length;
      if (shown) cx += text(ctx, shown, cx, ly, { size, family: 'mono', color: TOK_COLOR[kind] });
    }
    caret = [cx, ly];
    if (lineLen === 0) caret = [gx, ly];
  });
  if (typed < 1 || Math.sin((o.gt ?? 0) * 7) > 0) {
    ctx.fillStyle = C.h1;
    ctx.fillRect(caret[0] + 4, caret[1] - size * 0.82, Math.max(4, size * 0.09), size * 1.02);
  }
  return caret;
}

export interface LogLine {
  /** Команда (рисуется после «$»). */
  cmd?: string;
  /** Обычная строка вывода. */
  out?: string;
  /** Итог: галочка или крест в конце. */
  ok?: boolean;
}

/** Терминал: строки появляются по очереди по `p`, команды печатаются. Возвращает высоту. */
export function terminal(ctx: Ctx, lines: LogLine[], x: number, y: number, p: number, o: { size?: number; maxWidth?: number } = {}): number {
  const size = Math.max(MIN_TEXT, o.size ?? MIN_TEXT);
  const lh = size * 1.4;
  const pr = clamp01(p) * lines.length;
  lines.forEach((ln, i) => {
    const lp = clamp01(pr - i);
    if (lp <= 0) return;
    const ly = y + i * lh;
    const st: TextStyle = { size, family: 'mono', color: C.text };
    let cx = x;
    if (ln.cmd !== undefined) {
      cx += text(ctx, '$ ', cx, ly, { ...st, color: C.h1 });
      cx += text(ctx, ln.cmd.slice(0, Math.round(ln.cmd.length * clamp01(lp * 1.4))), cx, ly, st);
    } else if (ln.out !== undefined) {
      ctx.save();
      ctx.globalAlpha *= easeOutCubic(lp);
      cx += text(ctx, ln.out, cx, ly, { ...st, color: a(C.text, 0.55), maxWidth: o.maxWidth });
      ctx.restore();
    }
    if (ln.ok !== undefined && lp > 0.7) badge(ctx, cx + size * 0.75, ly - size * 0.32, size * 0.42, ln.ok, (lp - 0.7) / 0.3);
  });
  return lines.length * lh;
}

// ---------------------------------------------------------------- акценты

/** Бейдж «готово / ошибка»: круг с галочкой или крестом, появляется с перелётом. */
export function badge(ctx: Ctx, cx: number, cy: number, r: number, ok: boolean, p = 1): void {
  const pr = clamp01(p);
  if (pr <= 0) return;
  const s = easeOutBack(pr, 2.4);
  const color = ok ? C.pos : C.accent;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.shadowColor = a(color, 0.6);
  ctx.shadowBlur = r * 0.8;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = C.bg;
  ctx.lineWidth = r * 0.26;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (ok) {
    ctx.moveTo(-r * 0.45, 0);
    ctx.lineTo(-r * 0.1, r * 0.36);
    ctx.lineTo(r * 0.5, -r * 0.38);
  } else {
    ctx.moveTo(-r * 0.38, -r * 0.38);
    ctx.lineTo(r * 0.38, r * 0.38);
    ctx.moveTo(r * 0.38, -r * 0.38);
    ctx.lineTo(-r * 0.38, r * 0.38);
  }
  ctx.stroke();
  ctx.restore();
}

/** Зачёркивание, которое прочерчивается по `p`. */
export function strike(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, p: number, color: string = C.accent, width = 8): void {
  const pr = easeOutCubic(clamp01(p));
  if (pr <= 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.shadowColor = a(color, 0.6);
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 + (x2 - x1) * pr, y1 + (y2 - y1) * pr);
  ctx.stroke();
  ctx.restore();
}

/** Штамп-вердикт: рамка с крупной надписью, «падает» с увеличения и чуть повёрнут. */
export function stamp(ctx: Ctx, label: string, cx: number, cy: number, p: number, o: { color?: string; size?: number; rot?: number } = {}): void {
  const pr = clamp01(p);
  if (pr <= 0) return;
  const color = o.color ?? C.accent;
  const size = o.size ?? 110;
  const s = lerp(2.4, 1, easeOutQuart(clamp01(pr / 0.6)));
  ctx.save();
  ctx.globalAlpha *= clamp01(pr / 0.25);
  ctx.translate(cx, cy);
  ctx.rotate(o.rot ?? -0.12);
  ctx.scale(s, s);
  const st: TextStyle = { size, color, align: 'center' };
  const w = measure(ctx, label, st) + size * 0.7;
  const h = size * 1.25;
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.08;
  rrPath(ctx, -w / 2, -h / 2, w, h, size * 0.16);
  ctx.stroke();
  text(ctx, label, 0, size * 0.34, st);
  ctx.restore();
}

// ---------------------------------------------------------------- частицы

export interface BurstOpts {
  n?: number;
  /** Дальность разлёта, px. */
  r?: number;
  colors?: readonly string[];
  seed?: number;
  /** Длительность, сек. */
  dur?: number;
  size?: number;
}

/**
 * Разлёт искр из точки — салют на кульминации.
 * `t` — секунды с момента взрыва; частицы летят по баллистике и гаснут.
 */
export function burst(ctx: Ctx, cx: number, cy: number, t: number, o: BurstOpts = {}): void {
  const dur = o.dur ?? 1.6;
  if (t <= 0 || t >= dur) return;
  const n = o.n ?? 40;
  const R = o.r ?? 420;
  const colors = o.colors ?? [C.h1, C.accent, C.pos, C.text];
  const seed = o.seed ?? 0;
  const k = t / dur;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const h1 = hash11(seed * 13.1 + i * 1.37);
    const h2 = hash11(seed * 7.7 + i * 2.91);
    const ang = h1 * Math.PI * 2;
    const dist = R * (0.35 + 0.65 * h2) * easeOutCubic(k);
    const x = cx + Math.cos(ang) * dist;
    const y = cy + Math.sin(ang) * dist + 260 * k * k;
    const s = (o.size ?? 7) * (0.6 + h2) * (1 - k * 0.6);
    const col = colors[i % colors.length];
    ctx.globalAlpha = 1 - k * k;
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Поле плывущих частиц в прямоугольнике (пыль, «данные», искры). Зациклено:
 * каждая частица всплывает снизу вверх со своей фазой — детерминированно от `gt`.
 */
export function drift(ctx: Ctx, r: Rect, gt: number, o: { n?: number; colors?: readonly string[]; size?: number; speed?: number; seed?: number } = {}): void {
  const n = o.n ?? 30;
  const colors = o.colors ?? [C.h1];
  ctx.save();
  for (let i = 0; i < n; i++) {
    const h = hash11((o.seed ?? 0) * 3.1 + i * 1.91);
    const k = (((gt * (o.speed ?? 0.08) * (0.6 + h) + h) % 1) + 1) % 1;
    const x = r.x + hash11(i * 4.7 + (o.seed ?? 0)) * r.w + Math.sin(gt * 0.8 + i) * 12;
    const y = r.y + r.h * (1 - k);
    ctx.globalAlpha = Math.sin(k * Math.PI) * 0.8;
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.arc(x, y, ((o.size ?? 8) * (0.5 + h)) / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Развёртка-сканер: содержимое проявляется снизу вверх за светящейся линией,
 * выше линии — слабый «призрак». `p` 0..1.
 */
export function scan(ctx: Ctx, r: Rect, p: number, fn: () => void, color: string = C.h1): void {
  const pr = clamp01(p);
  if (pr <= 0) return;
  const ly = r.y + r.h * (1 - pr);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, ly, r.w, r.y + r.h - ly);
  ctx.clip();
  fn();
  ctx.restore();
  if (pr < 1) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, ly - r.y);
    ctx.clip();
    ctx.globalAlpha *= 0.14;
    fn();
    ctx.restore();
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = color;
    ctx.fillRect(r.x - 10, ly - 2, r.w + 20, 4);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- звуковая дорожка

export interface WaveOpts {
  color?: string;
  /** Шаг столбиков, px. */
  bar?: number;
  /** Где в дорожке паузы между фразами (доли 0..1) — там волна затихает. */
  gaps?: number[];
  seed?: number;
}

/**
 * Звуковая дорожка-«волна»: столбики громкости, детерминированные от `seed`,
 * с паузами в `gaps`. Проявляется слева направо по `p`.
 */
export function waveform(ctx: Ctx, x: number, y: number, w: number, h: number, p: number, o: WaveOpts = {}): void {
  const pr = clamp01(p);
  if (pr <= 0) return;
  const bar = o.bar ?? 7;
  const n = Math.floor(w / bar);
  const seed = o.seed ?? 1;
  ctx.save();
  ctx.fillStyle = o.color ?? C.h1;
  for (let i = 0; i < n * pr; i++) {
    const u = i / n;
    let amp = 0.3 + 0.7 * Math.abs(Math.sin(i * 0.37 + seed) * (0.45 + 0.55 * hash11(i * 1.7 + seed)));
    amp *= 0.55 + 0.45 * Math.sin(i * 0.11 + seed * 2) ** 2;
    for (const g of o.gaps ?? []) {
      const d = Math.abs(u - g) * w;
      if (d < 16) amp *= d / 16;
    }
    const bh = Math.max(2, amp * h);
    rrPath(ctx, x + i * bar, y + (h - bh) / 2, bar - 2, bh, (bar - 2) / 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- элементы управления

/** Слайдер: дорожка, заливка до значения, круглая ручка. `v` 0..1. Возвращает центр ручки. */
export function slider(ctx: Ctx, x: number, y: number, w: number, v: number, color: string = C.h1): Pt {
  const k = clamp01(v);
  ctx.save();
  rrPath(ctx, x, y - 4, w, 8, 4);
  ctx.fillStyle = a(C.text, 0.14);
  ctx.fill();
  rrPath(ctx, x, y - 4, Math.max(8, w * k), 8, 4);
  ctx.fillStyle = color;
  ctx.fill();
  const hx = x + w * k;
  ctx.shadowColor = a(color, 0.6);
  ctx.shadowBlur = 12;
  ctx.fillStyle = C.text;
  ctx.beginPath();
  ctx.arc(hx, y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return [hx, y];
}

/** Переключатель: `on` 0..1 (можно анимировать). */
export function toggle(ctx: Ctx, x: number, y: number, on: number, color: string = C.h1): void {
  const k = easeInOutCubic(clamp01(on));
  const w = 96;
  const h = 48;
  ctx.save();
  rrPath(ctx, x, y - h / 2, w, h, h / 2);
  ctx.fillStyle = k > 0.5 ? color : a(C.text, 0.2);
  ctx.fill();
  ctx.fillStyle = C.text;
  ctx.beginPath();
  ctx.arc(x + h / 2 + (w - h) * k, y, h / 2 - 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
