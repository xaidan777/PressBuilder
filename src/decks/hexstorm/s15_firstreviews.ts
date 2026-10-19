/** Сцена 15. Первые отзывы и эмоции автора. */

import { clamp01, easeOutQuart, seg } from '../../engine/anim.ts';
import { arrow, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { chip } from '../../engine/ui.ts';
import { reviewCard } from '../../engine/widgets.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

const EMOTIONS = ['год работы', 'год бессонных ночей', 'истощённый организм'];

export const scene15: SceneDef = {
  id: 's15',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cR = f.cue('reviews');
    const cE = f.cue('emotions');
    const cY = f.cue('year');
    const cN = f.cue('nosleep');

    const rp = seg(cR.t, 0, 0.9);

    // свечение — часть заголовка: двигается вместе с ним
    f.obj('title', { x: 150, y: 288, abs: true, text: cR.show, label: 'Заголовок' }, (o) => {
      ctx.save();
      ctx.globalAlpha *= clamp01(rp * 2);
      softLight(ctx, 600, 250, 420, C.pos, 0.12);
      ctx.restore();

      reveal(
        ctx,
        o.text,
        150,
        288,
        { size: 96, color: C.pos, tracking: 0.6, glowColor: a(C.pos, 0.3), glowBlur: 30 },
        rp,
        { stagger: 0.2, rise: 28 },
      );
    });

    f.obj('stars', { x: 1290 + 2 * 92, y: 258, abs: true, label: 'Звёзды' }, () => {
      for (let i = 0; i < 5; i++) {
        const sp = clamp01(rp * 2 - 0.6 - i * 0.1);
        if (sp <= 0) continue;
        ctx.save();
        ctx.globalAlpha *= sp;
        icon(ctx, 'star', 1290 + i * 92, 258, 62 * (0.7 + sp * 0.3), C.accent);
        ctx.restore();
      }
    });

    [0, 1, 2].forEach((i) => {
      f.obj(
        `review:${i}`,
        { x: 150 + i * 560 + 250, y: 380 + 95, abs: true, label: `Карточка отзыва ${i + 1}` },
        () => {
          reviewCard(ctx, {
            x: 150 + i * 560,
            y: 380,
            w: 500,
            h: 190,
            positive: true,
            p: clamp01(rp * 1.8 - 0.5 - i * 0.18),
            seed: i + 3,
          });
        },
      );
    });

    // эмоции
    const ep = seg(cE.t, 0, 0.9);
    EMOTIONS.forEach((e2, i) => {
      f.obj(
        `emotion:${i}`,
        { x: 150 + i * 420, y: 680, abs: true, text: e2, label: `Эмоция ${i + 1}` },
        (o) => {
          chip(ctx, o.text, 150 + i * 420, 680, {
            color: i === 2 ? C.accent : C.h1,
            size: 28,
            p: clamp01(ep * 1.8 - i * 0.2),
          });
        },
      );
    });

    const yp = seg(cY.t, 0, 0.9);
    f.obj('year', { x: 150, y: 850, abs: true, text: cY.show, label: 'Крупная фраза' }, (o) => {
      if (yp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= easeOutQuart(yp);
      reveal(
        ctx,
        o.text,
        150,
        850,
        { size: 108, color: C.accent, tracking: 0.6 },
        yp,
        { stagger: 0.24, rise: 30 },
      );
      ctx.restore();
    });

    // «каждый отзыв → патч»
    const np = seg(cN.t, 0, 0.9);
    f.obj(
      'feedback',
      { x: 240, y: 996, abs: true, text: 'каждый отзыв', label: 'Каждый отзыв' },
      (o) => {
        if (np <= 0) return;
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(np);
        icon(ctx, 'eye', 190, 980, 48, C.h1, gt);
        text(ctx, o.text, 240, 996, { size: 40, color: a(C.text, 0.8) });
        ctx.restore();
      },
    );
    f.obj('patchArrow', { x: 630, y: 980, abs: true, label: 'Стрелка к патчу' }, () => {
      if (np <= 0) return;
      ctx.save();
      ctx.globalAlpha *= easeOutQuart(np);
      arrow(ctx, 560, 980, 700, 980, clamp01(np * 1.6 - 0.3), { color: C.pos, width: 3, head: 16 });
      ctx.restore();
    });
    f.obj(
      'patch',
      { x: 800, y: 996, abs: true, text: 'мгновенный патч', label: 'Мгновенный патч' },
      (o) => {
        if (np <= 0) return;
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(np);
        icon(ctx, 'wrench', 750, 980, 48, C.pos, gt);
        text(ctx, o.text, 800, 996, { size: 40, color: C.pos });
        ctx.restore();
      },
    );
  },
};
