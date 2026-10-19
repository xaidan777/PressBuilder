/** Сцена 14. День релиза: ценник, скидка и первые двое суток продаж. */

import { clamp01, easeOutQuart, pulse, seg } from '../../engine/anim.ts';
import { bars } from '../../engine/charts.ts';
import { softLight } from '../../engine/draw.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { chip, statTile } from '../../engine/ui.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

const PRICES = [
  { value: '$10,99', label: 'сша', icon: 'money', color: C.h1 },
  { value: '490 ₽', label: 'страны бывшего снг', icon: 'globe', color: C.h1 },
  { value: '−15%', label: 'скидка на старте', icon: 'star', color: C.accent },
];

export const scene14: SceneDef = {
  id: 's14',

  energy(t, cue) {
    return pulse(t, cue('day').start, 1.2) * 0.8;
  },

  render(f: Frame) {
    const { ctx, gt } = f;
    const cDay = f.cue('day');
    const cPrice = f.cue('price');
    const c1 = f.cue('d1');
    const c2 = f.cue('d2');

    const dp = seg(cDay.t, 0, 0.8);

    // свечение — часть заголовка: двигается вместе с ним
    f.obj('title', { x: 150, y: 300, abs: true, text: cDay.show, label: 'Заголовок' }, (o) => {
      ctx.save();
      ctx.globalAlpha *= clamp01(dp * 2);
      softLight(ctx, 520, 250, 420, C.accent, 0.14);
      ctx.restore();

      reveal(
        ctx,
        o.text,
        150,
        300,
        { size: 116, color: C.accent, tracking: 0.6, glowColor: a(C.accent, 0.35), glowBlur: 34 },
        dp,
        { stagger: 0.24, rise: 32 },
      );
    });

    const pp = seg(cPrice.t, 0, 1.0);
    PRICES.forEach((p, i) => {
      f.obj(
        `price:${i}`,
        { x: 150 + i * 560 + 250, y: 505, abs: true, text: p.value, label: `Плитка «${p.label}»` },
        (o) => {
          statTile(ctx, {
            x: 150 + i * 560,
            y: 400,
            w: 500,
            h: 210,
            value: o.text,
            label: p.label,
            icon: p.icon,
            color: p.color,
            p: clamp01(pp * 1.7 - i * 0.22),
            t: gt,
          });
        },
      );
    });

    const b1 = seg(c1.t, 0, 0.8);
    const b2 = seg(c2.t, 0, 0.8);
    f.obj(
      'sales',
      { x: 460, y: 870, abs: true, text: 'продано копий', label: 'График продаж' },
      (o) => {
        if (b1 <= 0) return;
        ctx.save();
        ctx.globalAlpha *= clamp01(b1 * 3);
        text(ctx, o.text, 150, 720, { size: 28, color: a(C.text, 0.5), tracking: 2.4 });
        ctx.restore();

        bars(ctx, {
          x: 150,
          y: 760,
          w: 620,
          h: 220,
          items: [
            { label: 'первые сутки', value: 250, color: C.h1 },
            { label: 'вторые сутки', value: 280, color: C.pos },
          ],
          p: Math.max(b1 * 0.55, b2),
          max: 320,
          stagger: 0,
        });
      },
    );

    f.obj(
      'total',
      { x: 900, y: 830, abs: true, text: '530 копий за двое суток', label: 'Итог за двое суток' },
      (o) => {
        if (b2 <= 0) return;
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(b2);
        chip(ctx, o.text, 900, 830, {
          color: C.accent,
          size: 30,
          icon: 'chart',
          p: b2,
        });
        ctx.restore();
      },
    );
  },
};
