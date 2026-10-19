/** Сцена 21. Разбор: восемь одинаковых отзывов с нулевым временем в игре. */

import { clamp01, easeOutQuart, seg } from '../../engine/anim.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { reviewCard } from '../../engine/widgets.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

/** Языки отзывов разные, а регион у всех один — ру. Это и выдало флешмоб. */
const FAKES = [
  { quote: 'AI slop', lang: 'RU', pt: '0.1 ч' },
  { quote: 'mobile game port', lang: 'RU', pt: '0.2 ч' },
  { quote: 'AI 垃圾，手游移植', lang: 'RU', pt: '0.1 ч' },
  { quote: 'ИИ-помойка', lang: 'RU', pt: '0.2 ч' },
];

const FINDINGS = [
  { icon: 'clock', text: '0.1–0.2 часа в игре' },
  { icon: 'chat', text: 'один и тот же текст' },
  { icon: 'globe', text: 'разные языки, даже китайский' },
];

export const scene21: SceneDef = {
  id: 's21',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cB = f.cue('build');
    const cBurst = f.cue('burst');
    const cSame = f.cue('same');
    const cSlop = f.cue('slop');

    f.obj('title', { x: 150, y: 278, abs: true, text: cB.show, label: 'Заголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        278,
        { size: 84, color: C.h1, tracking: 0.6, maxWidth: 700 },
        seg(cB.t, 0, 0.8),
        { stagger: 0.2, rise: 26 },
      );
    });

    // счётчик «8 подряд»
    const burst = seg(cBurst.t, 0, 0.8);
    f.obj('count', { x: 150, y: 470, abs: true, text: '8', label: 'Число отзывов' }, (o) => {
      if (burst <= 0) return;
      ctx.save();
      ctx.globalAlpha *= easeOutQuart(burst);
      text(ctx, o.text, 150, 470, { size: 150, color: C.accent, family: 'mono' });
      ctx.restore();
    });
    f.obj(
      'countLabel',
      { x: 300, y: 442, abs: true, text: 'отзывов подряд', label: 'Подпись числа' },
      (o) => {
        if (burst <= 0) return;
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(burst);
        text(ctx, o.text, 300, 442, { size: 42, color: C.text });
        ctx.restore();
      },
    );
    f.obj(
      'countNote',
      { x: 300, y: 492, abs: true, text: 'за пару часов', label: 'Подпись «за пару часов»' },
      (o) => {
        if (burst <= 0) return;
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(burst);
        text(ctx, o.text, 300, 492, { size: 30, color: a(C.text, 0.5), tracking: 1.6 });
        ctx.restore();
      },
    );

    // находки
    const findP = seg(cSame.t, 0, 1.0);
    FINDINGS.forEach((it, i) => {
      const p = clamp01(findP * 1.8 - i * 0.24);
      const y = 590 + i * 90;
      f.obj(
        `finding:${i}`,
        { x: 236, y: y + 14, abs: true, text: it.text, label: `Находка ${i + 1}` },
        (o) => {
          if (p <= 0) return;
          const e = easeOutQuart(p);
          ctx.save();
          ctx.globalAlpha *= e;
          ctx.translate((1 - e) * -30, 0);
          icon(ctx, it.icon, 186, y, 44, C.accent, gt);
          text(ctx, o.text, 236, y + 14, { size: 38, color: a(C.text, 0.8), maxWidth: 640 });
          ctx.restore();
        },
      );
    });

    // цитаты
    const slopP = seg(cSlop.t, 0, 0.8);
    f.obj(
      'quotes',
      { x: 150, y: 900, abs: true, text: '«AI slop», «mobile game port»', label: 'Цитаты' },
      (o) => {
        if (slopP <= 0) return;
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(slopP);
        text(ctx, o.text, 150, 900, {
          size: 44,
          color: C.accent,
          maxWidth: 700,
          caps: 'normal',
        });
        ctx.restore();
      },
    );

    // стопка фейковых отзывов
    FAKES.forEach((r, i) => {
      const p = clamp01(seg(cBurst.t, 0.1, 1.2) * 2 - i * 0.22);
      f.obj(
        `card:${i}`,
        { x: 1355, y: 291 + i * 202, abs: true, text: r.quote, label: `Карточка отзыва ${i + 1}` },
        (o) => {
          reviewCard(ctx, {
            x: 940,
            y: 200 + i * 202,
            w: 830,
            h: 182,
            positive: false,
            playtime: r.pt,
            lang: r.lang,
            quote: o.text,
            p,
            seed: i,
            flag: clamp01(findP * 2 - i * 0.1),
          });
        },
      );
    });


  },
};
