/** Общие визуальные блоки, которые переиспользуют несколько сцен. */

import { clamp01, easeOutQuart, hash11, hash21 } from '../../engine/anim.ts';
import { rrPath } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text, type TextStyle } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';

type Ctx = CanvasRenderingContext2D;

/** Крупный заголовок сцены. Возвращает Y базовой линии последней строки. */
export function header(
  ctx: Ctx,
  title: string,
  x: number,
  y: number,
  p: number,
  o: { size?: number; color?: string; maxWidth?: number } = {},
): number {
  const st: TextStyle = {
    size: o.size ?? 86,
    weight: 700,
    color: o.color ?? C.h1,
    maxWidth: o.maxWidth ?? 900,
    lineHeight: 1.02,
    tracking: 0.5,
  };
  const h = reveal(ctx, title, x, y + (o.size ?? 86) * 0.92, st, clamp01((p - 0.1) / 0.9), {
    stagger: 0.22,
    rise: 26,
  });
  return y + (o.size ?? 86) * 0.92 + h;
}

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/{}[]=+*#$%&_|';

/** Падающий «дождь» из кода. Полностью детерминирован по gt. */
export function codeRain(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  gt: number,
  alpha = 1,
): void {
  if (alpha <= 0.01) return;
  const step = 26;
  const cols = Math.floor(w / step);
  ctx.save();
  ctx.beginPath();
  rrPath(ctx, x, y, w, h, 12);
  ctx.clip();
  ctx.globalAlpha *= alpha;
  ctx.font = `700 20px 'Cascadia Mono', Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let c = 0; c < cols; c++) {
    const spd = 40 + hash11(c * 2.3) * 130;
    const len = 6 + Math.floor(hash11(c * 5.7) * 12);
    const headY = ((gt * spd + hash11(c) * h * 4) % (h + len * step)) - len * step;
    for (let i = 0; i < len; i++) {
      const gy = y + headY + i * step;
      if (gy < y - step || gy > y + h + step) continue;
      const k = i / len;
      const ch = GLYPHS[Math.floor(hash21(c, Math.floor((gy + gt * spd) / step)) * GLYPHS.length)];
      ctx.fillStyle =
        i === len - 1 ? a(C.h1, 0.85) : a(i > len - 4 ? C.h1 : C.text, 0.1 + k * 0.35);
      ctx.fillText(ch, x + c * step + step / 2, gy);
    }
  }
  ctx.restore();
}

/** Карточка с иконкой и подписью (используется в «реакциях» и «промптах»). */
export interface FaceCardOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  icon?: string;
  color?: string;
  p?: number;
  dim?: number;
  t?: number;
  index?: string;
}

export function faceCard(ctx: Ctx, o: FaceCardOpts): void {
  const p = clamp01(o.p ?? 1);
  if (p <= 0) return;
  const e = easeOutQuart(p);
  const dim = clamp01(o.dim ?? 0);
  const color = o.color ?? C.h1;
  ctx.save();
  ctx.globalAlpha *= e * (1 - dim * 0.62);
  ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
  const s = 0.86 + e * 0.14 - dim * 0.06;
  ctx.scale(s, s);
  ctx.translate(-o.w / 2, -o.h / 2);

  const g = ctx.createLinearGradient(0, 0, 0, o.h);
  g.addColorStop(0, a(color, 0.1));
  g.addColorStop(1, C.panel);
  ctx.fillStyle = g;
  rrPath(ctx, 0, 0, o.w, o.h, 16);
  ctx.fill();
  ctx.strokeStyle = a(color, 0.34 + (1 - dim) * 0.2);
  ctx.lineWidth = 1.8;
  rrPath(ctx, 0, 0, o.w, o.h, 16);
  ctx.stroke();

  if (o.index) {
    text(ctx, o.index, 22, 46, { size: 26, family: 'mono', color: a(color, 0.45) });
  }
  if (o.icon) icon(ctx, o.icon, o.w / 2, o.h * 0.4, o.h * 0.3, color, o.t ?? 0);
  text(ctx, o.label, o.w / 2, o.h * 0.84, {
    size: Math.min(42, o.w * 0.12),
    weight: 700,
    color: C.text,
    align: 'center',
    tracking: 0.8,
    maxWidth: o.w - 36,
    lineHeight: 1.05,
  });
  ctx.restore();
}

/** Мягкая «плашка-титр» внизу кадра для короткой фразы. */
export function caption(
  ctx: Ctx,
  str: string,
  x: number,
  y: number,
  p: number,
  color: string = C.text,
): void {
  const pr = clamp01(p);
  if (pr <= 0) return;
  reveal(
    ctx,
    str,
    x,
    y,
    { size: 40, weight: 700, color, tracking: 1.2, maxWidth: 1300, lineHeight: 1.15 },
    pr,
    { stagger: 0.16, rise: 16 },
  );
}
