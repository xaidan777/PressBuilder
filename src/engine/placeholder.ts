/**
 * Сцена по умолчанию — для слайдов, у которых ещё нет своего кода.
 * Показывает экранный текст реплик одну за другой: черновик ролика смотрится
 * и экспортируется сразу после разбивки текста, ещё до работы над сценами.
 */

import { lerp, seg } from './anim.ts';
import { lineStep, reveal, wrap, type TextStyle } from './text.ts';
import { a, C, currentStyle, H, PAD, TYPE, W } from './theme.ts';
import type { SceneDef } from './types.ts';

type Ctx = CanvasRenderingContext2D;

const MAX_W = W - PAD.x * 2 - 40;
const TOP = 170;
/** Сцены верстаются в полном кадре, движок потом ужимает их над зоной плеера. */
const BOTTOM = H - 90;
const SIZES = [116, 104, 92, 82, 74, 66, 60, 54, 50, 46];

/** На экране хвостовая запятая или точка не нужны. */
export const screenText = (s: string) => s.trim().replace(/[\s,;:.—–-]+$/u, '');

interface Layout {
  size: number;
  gap: number;
  /** Базовая линия первой строки каждой реплики. */
  ys: number[];
}

const cache = new Map<string, Layout>();

/** Первая реплика слайда — шрифтом заголовков стиля, остальные — основным. */
const familyOf = (i: number) => (i === 0 ? 'display' : 'sans');

function layoutFor(ctx: Ctx, texts: string[]): Layout {
  // метрики зависят от шрифтов стиля
  const key = currentStyle().id + texts.join('');
  const hit = cache.get(key);
  if (hit) return hit;
  let best: Layout = { size: 46, gap: 20, ys: [] };
  for (const size of SIZES) {
    const st = (i: number): TextStyle => ({ size, maxWidth: MAX_W, lineHeight: 1.12, family: familyOf(i), tracking: TYPE.tracking });
    const gap = size * 0.5;
    const heights = texts.map((t, i) => wrap(ctx, t, st(i)).length * lineStep(st(i)));
    const total = heights.reduce((s, h) => s + h, 0) + gap * Math.max(0, texts.length - 1);
    const ys: number[] = [];
    // блок центруется по вертикали в рабочей зоне
    let y = TOP + Math.max(0, (BOTTOM - TOP - total) / 2) + size * 0.8;
    heights.forEach((h) => {
      ys.push(y);
      y += h + gap;
    });
    best = { size, gap, ys };
    if (total <= BOTTOM - TOP) break;
  }
  if (cache.size > 200) cache.clear();
  cache.set(key, best);
  return best;
}

export const placeholderScene: SceneDef = {
  id: '*',
  render(f) {
    const { ctx } = f;
    const texts = f.cues.map((c) => screenText(c.show));
    if (!texts.length) return;
    const L = layoutFor(ctx, texts);

    // тонкая направляющая слева растёт вместе с текстом
    const last = f.cues[f.cues.length - 1];
    const grow = seg(f.t, f.cues[0].start, Math.max(0.4, last.start - f.cues[0].start + 0.6));
    if (grow > 0) {
      ctx.save();
      ctx.strokeStyle = a(C.h1, 0.55);
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      const y0 = L.ys[0] - L.size * 0.78;
      const y1 = L.ys[L.ys.length - 1] + L.size * 0.2;
      ctx.beginPath();
      ctx.moveTo(PAD.x - 44, y0);
      ctx.lineTo(PAD.x - 44, lerp(y0, y1, grow));
      ctx.stroke();
      ctx.restore();
    }

    f.cues.forEach((c, i) => {
      const next = f.cues[i + 1];
      f.obj(`text:${c.id}`, { x: PAD.x, y: L.ys[i], text: texts[i], label: texts[i] }, (o) => {
        if (!c.began) return;
        // прозвучавшие реплики тускнеют, чтобы читалась текущая
        const fade = next ? seg(next.t, 0, 0.5) : 0;
        ctx.globalAlpha *= lerp(1, 0.42, fade);
        reveal(
          ctx,
          o.text,
          0,
          0,
          {
            size: L.size,
            maxWidth: MAX_W,
            lineHeight: 1.12,
            color: fade < 0.5 ? (i === 0 ? C.h1 : C.accent) : C.text,
            family: familyOf(i),
            tracking: TYPE.tracking,
          },
          seg(c.t, 0, Math.min(0.9, c.dur * 0.6)),
          { stagger: 0.16, rise: 26 },
        );
      });
    });
  },
};
