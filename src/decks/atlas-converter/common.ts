/** Общие блоки ролика «Atlas Converter»: спрайт-персонаж, шахматка альфы, кадры, окно. */

import { clamp01, easeOutBack, easeOutQuart } from '../../engine/anim.ts';
import { rrPath } from '../../engine/draw.ts';
import { a, C, mix } from '../../engine/theme.ts';

type Ctx = CanvasRenderingContext2D;

/** Зелёный фон «хромакея» — в палитре ролика. */
export const GREEN = mix(C.pos, '#1f7a2e', 0.55);
/** Фон «экранов» — темнее панелей. */
export const SCREEN_BG = '#22252a';

export interface AppearOpts {
  dx?: number;
  dy?: number;
  /** Стартовый масштаб и его центр. */
  from?: number;
  cx?: number;
  cy?: number;
  /** Масштаб с «перелётом». */
  back?: boolean;
}

/** Обёртка появления: прозрачность + сдвиг и/или масштаб, затем рисует `fn`. */
export function appear(ctx: Ctx, p: number, fn: () => void, o: AppearOpts = {}): void {
  const pr = clamp01(p);
  if (pr <= 0) return;
  const e = easeOutQuart(pr);
  ctx.save();
  ctx.globalAlpha *= Math.min(1, pr * 2.4);
  ctx.translate((1 - e) * (o.dx ?? 0), (1 - e) * (o.dy ?? 0));
  if (o.from !== undefined) {
    const s = o.from + (1 - o.from) * (o.back ? easeOutBack(pr) : e);
    ctx.translate(o.cx ?? 0, o.cy ?? 0);
    ctx.scale(s, s);
    ctx.translate(-(o.cx ?? 0), -(o.cy ?? 0));
  }
  fn();
  ctx.restore();
}

/**
 * Персонаж спрайта — шагающий кругляш с антенной. `phase` (0..1) — фаза цикла
 * ходьбы: разные фазы дают разные кадры атласа. Вписан в квадрат `size`.
 */
export function sprite(ctx: Ctx, cx: number, cy: number, size: number, phase: number, color: string = C.accent): void {
  const s = size / 100;
  const ang = phase * Math.PI * 2;
  const bob = Math.abs(Math.sin(ang)) * 6;
  const sq = 1 + Math.sin(ang * 2) * 0.05;
  const step = Math.sin(ang) * 12;
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';

  // ноги и руки
  line(-12, 20 - bob, -12 + step, 44);
  line(12, 20 - bob, 12 - step, 44);
  line(-27, -2 - bob, -41, 10 - bob + step * 0.6);
  line(27, -2 - bob, 41, 10 - bob - step * 0.6);
  // антенна
  ctx.lineWidth = 5;
  line(0, -30 - bob, Math.sin(ang) * 5, -43 - bob);
  ctx.beginPath();
  ctx.arc(Math.sin(ang) * 5, -45 - bob, 4.5, 0, Math.PI * 2);
  ctx.fill();
  // тело
  ctx.beginPath();
  ctx.ellipse(0, -2 - bob, 30 * sq, 30 / sq, 0, 0, Math.PI * 2);
  ctx.fill();
  // глаза смотрят по ходу движения
  ctx.fillStyle = C.bg;
  for (const ex of [-5, 15]) {
    ctx.beginPath();
    ctx.arc(ex, -8 - bob, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Шахматка прозрачности в прямоугольнике. */
export function checker(ctx: Ctx, x: number, y: number, w: number, h: number, cell = 18): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = SCREEN_BG;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = a(C.text, 0.11);
  for (let j = 0; j * cell < h; j++) {
    for (let i = (j % 2); i * cell < w; i += 2) ctx.fillRect(x + i * cell, y + j * cell, cell, cell);
  }
  ctx.restore();
}

export interface CellOpts {
  /** Граница вырезания фона по X (в координатах сцены): левее — альфа, правее — зелёный. */
  keyX?: number;
  radius?: number;
  color?: string;
  /** Размер персонажа относительно ячейки. */
  fill?: number;
}

/** Кадр спрайта: шахматка, поверх — зелёный фон (до границы вырезания), персонаж. */
export function spriteCell(ctx: Ctx, x: number, y: number, size: number, phase: number, o: CellOpts = {}): void {
  const r = o.radius ?? 10;
  ctx.save();
  rrPath(ctx, x, y, size, size, r);
  ctx.clip();
  checker(ctx, x, y, size, size, Math.max(10, size / 9));
  const from = Math.max(x, o.keyX ?? -Infinity);
  if (from < x + size) {
    ctx.fillStyle = GREEN;
    ctx.fillRect(from, y, x + size - from, size);
  }
  sprite(ctx, x + size / 2, y + size / 2 + size * 0.02, size * (o.fill ?? 0.78), phase, o.color);
  ctx.restore();
  ctx.save();
  rrPath(ctx, x, y, size, size, r);
  ctx.strokeStyle = a(C.text, 0.22);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/** Окно приложения: рамка, шапка с тремя точками. Возвращает область содержимого. */
export function appWindow(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  o: { glow?: string; bar?: number } = {},
): { x: number; y: number; w: number; h: number } {
  const bar = o.bar ?? 56;
  ctx.save();
  if (o.glow) {
    ctx.shadowColor = o.glow;
    ctx.shadowBlur = 40;
  }
  rrPath(ctx, x, y, w, h, 16);
  ctx.fillStyle = SCREEN_BG;
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
  rrPath(ctx, x, y, w, h, 16);
  ctx.strokeStyle = a(C.h1, 0.4);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
  return { x, y: y + bar, w, h: h - bar };
}
