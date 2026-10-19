/** Сцена 24. Рейтинг дополз до 71%, но два из пяти дней витрины потеряны. */

import { clamp01, easeOutExpo, easeOutQuart, seg } from '../../engine/anim.ts';
import { rrPath, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { curve, ratingBadge } from '../../engine/widgets.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

const RECOVER = [0.55, 0.55, 0.57, 0.6, 0.63, 0.66, 0.69, 0.71, 0.71];

export const scene24: SceneDef = {
  id: 's24',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cW = f.cue('wait');
    const cU = f.cue('up');
    const cS = f.cue('seventy');
    const cH = f.cue('hit');
    const cL = f.cue('lost');

    const wp = seg(cW.t, 0, 0.8);
    const up = seg(cU.t, 0, 1.0);
    const sp = seg(cS.t, 0, 1.0);
    const hp = seg(cH.t, 0, 1.0);
    const lp = seg(cL.t, 0, 0.9);

    f.obj('title', { x: 150, y: 282, abs: true, text: cW.show, label: 'Заголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        282,
        { size: 88, color: C.h1, tracking: 0.6, maxWidth: 900 },
        wp,
        { stagger: 0.2, rise: 26 },
      );
    });

    // кривая восстановления
    f.obj(
      'chart',
      {
        x: 560,
        y: 580,
        abs: true,
        text: 'рейтинг обзоров, следующие дни',
        label: 'График рейтинга',
      },
      (o) => {
        if (up <= 0) return;
        ctx.save();
        ctx.globalAlpha *= clamp01(up * 3);
        text(ctx, o.text, 150, 400, {
          size: 28,
          color: a(C.text, 0.5),
          tracking: 2,
        });
        ctx.restore();
        curve(ctx, {
          x: 150,
          y: 430,
          w: 820,
          h: 300,
          data: RECOVER,
          p: Math.max(up, sp),
          color: C.pos,
          fill: true,
        });
      },
    );
    f.obj('chartFrom', { x: 150, y: 760, abs: true, text: '55%', label: 'График: «55%»' }, (o) => {
      if (up <= 0) return;
      ctx.save();
      ctx.globalAlpha *= clamp01(up * 2);
      text(ctx, o.text, 150, 760, { size: 32, color: a(C.text, 0.4), family: 'mono' });
      ctx.restore();
    });
    f.obj('chartTo', { x: 970, y: 500, abs: true, text: '71%', label: 'График: «71%»' }, (o) => {
      if (up <= 0 || sp <= 0.3) return;
      ctx.save();
      ctx.globalAlpha *= clamp01((sp - 0.3) / 0.4);
      text(ctx, o.text, 970, 500, { size: 44, color: C.pos, align: 'right', family: 'mono' });
      ctx.restore();
    });

    // плашка нового рейтинга
    f.obj(
      'rating',
      { x: 1395, y: 450, abs: true, text: 'дополз за пару дней', label: 'Плашка рейтинга' },
      (o) => {
        if (sp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= clamp01(sp * 2);
        softLight(ctx, 1380, 420, 380, C.pos, 0.1);
        ctx.restore();
        ratingBadge(ctx, {
          x: 1020,
          y: 300,
          w: 750,
          h: 300,
          percent: 55 + 16 * easeOutExpo(clamp01(sp * 1.4)),
          label: 'в основном\nположительные',
          color: C.pos,
          p: sp,
          note: o.text,
        });
      },
    );

    // окно видимости: 5 дней, 2 потеряны
    f.obj(
      'window',
      { x: 940, y: 938, abs: true, text: 'окно показов Steam', label: 'Окно показов' },
      (o) => {
        if (hp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= clamp01(hp * 3);
        text(ctx, o.text, 150, 850, { size: 28, color: a(C.text, 0.5), tracking: 2.2 });
        ctx.restore();

        const bw = 300;
        const gap = 20;
        for (let i = 0; i < 5; i++) {
          const p = clamp01(hp * 1.9 - i * 0.14);
          if (p <= 0) continue;
          const e = easeOutQuart(p);
          // MIXED держался на третий и четвёртый день витрины
          const isLost = (i === 2 || i === 3) && lp > 0.15;
          const x = 150 + i * (bw + gap);
          ctx.save();
          ctx.globalAlpha *= e;
          ctx.fillStyle = isLost ? a(C.accent, 0.16) : a(C.pos, 0.16);
          rrPath(ctx, x, 890, bw, 96, 10);
          ctx.fill();
          ctx.strokeStyle = isLost ? a(C.accent, 0.7) : a(C.pos, 0.55);
          ctx.lineWidth = 1.8;
          rrPath(ctx, x, 890, bw, 96, 10);
          ctx.stroke();
          text(ctx, `день ${i + 1}`, x + 22, 950, {
            size: 32,
            color: isLost ? C.accent : a(C.text, 0.75),
          });
          if (isLost) {
            icon(ctx, 'warning', x + bw - 44, 938, 36, C.accent, gt);
          }
          ctx.restore();
        }
      },
    );

    f.obj(
      'lost',
      {
        x: 150,
        y: 1030,
        abs: true,
        text: '2 дня из 5 игра выглядела непривлекательно',
        label: 'Подпись про потерянные дни',
      },
      (o) => {
        if (hp <= 0 || lp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(lp);
        text(ctx, o.text, 150, 1030, {
          size: 34,
          color: C.accent,
          tracking: 1,
        });
        ctx.restore();
      },
    );
  },
};
