/** Сцена 10. Ссылки на прошлые ролики и переход к публикации в Steam. */

import { clamp01, easeOutQuart, seg } from '../../engine/anim.ts';
import { arrow, divider } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { chip, videoCard } from '../../engine/ui.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

export const scene10: SceneDef = {
  id: 's10',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cLinks = f.cue('links');
    const cNext = f.cue('next');

    const lp = seg(cLinks.t, 0, 0.9);
    const np = seg(cNext.t, 0, 0.9);
    const dim = 1 - np * 0.62;

    ctx.save();
    ctx.globalAlpha *= dim;

    f.obj('title', { x: 150, y: 278, abs: true, text: cLinks.show, label: 'Заголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        278,
        { size: 84, color: C.h1, tracking: 0.6 },
        lp,
        { stagger: 0.2, rise: 26 },
      );
    });

    const cw = 680;
    const chh = 400;
    const gap = 60;
    const x0 = 960 - (cw * 2 + gap) / 2;
    [
      { title: 'о сложностях разработки', tag: 'видео 1' },
      { title: 'о сложностях разработки', tag: 'видео 2' },
    ].forEach((v, i) => {
      f.obj(
        `card:${i}`,
        {
          x: x0 + i * (cw + gap) + cw / 2,
          y: 360 + chh / 2,
          abs: true,
          text: v.title,
          label: `Карточка видео ${i + 1}`,
        },
        (o) => {
          videoCard(ctx, {
            x: x0 + i * (cw + gap),
            y: 360,
            w: cw,
            h: chh,
            title: o.text,
            tag: v.tag,
            p: clamp01(lp * 1.6 - i * 0.22),
            t: gt,
            color: i === 0 ? C.h1 : C.accent,
          });
        },
      );
    });

    const hp = clamp01(lp * 1.6 - 0.7);
    f.obj(
      'hint',
      {
        x: 750,
        y: 854,
        abs: true,
        text: 'ссылки — в комментариях под видео',
        label: 'Подпись про ссылки',
      },
      (o) => {
        if (hp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= hp;
        icon(ctx, 'chat', 700, 840, 46, C.pos, gt);
        text(ctx, o.text, 750, 854, {
          size: 36,
          color: a(C.text, 0.75),
          tracking: 1.4,
        });
        ctx.restore();
      },
    );
    ctx.restore();

    // переход к следующей главе
    const e = easeOutQuart(np);
    f.obj('divider', { x: 960, y: 920, abs: true, label: 'Разделитель' }, () => {
      if (np <= 0) return;
      ctx.save();
      ctx.globalAlpha *= e;
      divider(ctx, 150, 920, 1620, clamp01(np * 1.6), a(C.accent, 0.3), 2);
      ctx.restore();
    });
    f.obj(
      'next',
      { x: 340, y: 1018, abs: true, text: cNext.show, label: 'Следующая глава' },
      (o) => {
        if (np <= 0) return;
        ctx.save();
        ctx.globalAlpha *= e;
        arrow(ctx, 160, 1000, 300, 1000, clamp01(np * 1.8), {
          color: C.accent,
          width: 4,
          head: 20,
        });
        reveal(
          ctx,
          o.text,
          340,
          1018,
          { size: 68, color: C.accent, tracking: 0.8 },
          clamp01(np * 1.3),
          { stagger: 0.16, rise: 20 },
        );
        ctx.restore();
      },
    );
    f.obj(
      'nextChip',
      { x: 1440, y: 998, abs: true, text: 'реакция игроков', label: 'Чип «реакция игроков»' },
      (o) => {
        if (np <= 0) return;
        ctx.save();
        ctx.globalAlpha *= e;
        chip(ctx, o.text, 1440, 998, {
          color: C.pos,
          size: 26,
          p: clamp01(np * 1.6 - 0.5),
        });
        ctx.restore();
      },
    );
  },
};
