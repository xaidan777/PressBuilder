/** Сцена 32. Спустя две недели: плато продаж и планы на возврат показов. */

import { clamp01, easeOutQuart, seg } from '../../engine/anim.ts';
import { panel, rrPath } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { curve } from '../../engine/widgets.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

/** Всплеск релиза и выход на ровную полку. */
const SALES = [0.18, 1.0, 0.86, 0.58, 0.34, 0.22, 0.16, 0.14, 0.13, 0.13, 0.13];

const PLANS = [
  { icon: 'wrench', title: 'крупное обновление', color: C.h1 },
  { icon: 'rocket', title: 'расширение кампании', color: C.accent },
  { icon: 'refund', title: 'циклы показа Steam', color: C.pos },
];

export const scene32: SceneDef = {
  id: 's32',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cP = f.cue('plateau');
    const cPl = f.cue('plans');
    const cPol = f.cue('polish');

    const pp = seg(cP.t, 0, 1.0);

    f.obj('title', { x: 150, y: 288, abs: true, text: 'игра вышла на плато', label: 'Заголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        288,
        { size: 88, color: C.h1, tracking: 0.6 },
        seg(cP.t, 0, 0.8),
        { stagger: 0.2, rise: 26 },
      );
    });

    // кривая продаж
    const lp = clamp01(pp * 1.6 - 0.6);
    const py = 430 + 320 * (1 - 0.13);
    f.obj('chart', { x: 590, y: 590, abs: true, label: 'График продаж' }, () => {
      if (pp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= clamp01(pp * 3);
      text(ctx, 'копий в сутки', 150, 400, { size: 28, color: a(C.text, 0.5), tracking: 2.2 });
      ctx.restore();

      curve(ctx, {
        x: 150,
        y: 430,
        w: 880,
        h: 320,
        data: SALES,
        p: pp,
        color: C.h1,
        fill: true,
      });

      if (lp > 0) {
        ctx.save();
        ctx.globalAlpha *= lp;
        ctx.strokeStyle = a(C.pos, 0.5);
        ctx.setLineDash([8, 9]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(620, py);
        ctx.lineTo(1030, py);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    });
    // подпись над полкой, с запасом от самой кривой
    f.obj('plateau', { x: 620, y: py - 76, abs: true, text: '20–30 копий в сутки', label: 'Подпись плато' }, (o) => {
      if (lp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= lp;
      text(ctx, o.text, 620, py - 76, {
        size: 46,
        color: C.pos,
        tracking: 0.8,
      });
      ctx.restore();
    });
    f.obj('ended', { x: 150, y: 800, abs: true, text: 'показы Steam закончились', label: 'Подпись под графиком' }, (o) => {
      if (lp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= lp;
      text(ctx, o.text, 150, 800, {
        size: 32,
        color: a(C.text, 0.5),
        tracking: 1.2,
      });
      ctx.restore();
    });

    // планы
    const plP = seg(cPl.t, -0.1, 1.1);
    f.obj('plans:title', { x: 1120, y: 400, abs: true, text: 'что дальше', label: 'Планы: заголовок' }, (o) => {
      if (plP <= 0) return;
      ctx.save();
      ctx.globalAlpha *= clamp01(plP * 3);
      text(ctx, o.text, 1120, 400, { size: 28, color: a(C.text, 0.5), tracking: 2.6 });
      ctx.restore();
    });

    PLANS.forEach((pl, i) => {
      const p = clamp01(plP * 1.8 - i * 0.22);
      const y = 440 + i * 130;
      f.obj(`plan:${i}`, { x: 1445, y: y + 54, abs: true, text: pl.title, label: `План ${i + 1}` }, (o) => {
        if (p <= 0) return;
        const e = easeOutQuart(p);
        ctx.save();
        ctx.globalAlpha *= e;
        ctx.translate((1 - e) * 34, 0);
        panel(ctx, 1120, y, 650, 108, {
          fill: C.panel,
          stroke: a(pl.color, 0.3),
          radius: 12,
          lineWidth: 1.6,
          accentBar: { color: pl.color, width: 4 },
        });
        icon(ctx, pl.icon, 1190, y + 54, 48, pl.color, gt);
        text(ctx, o.text, 1250, y + 68, { size: 40, color: C.text, maxWidth: 480 });
        ctx.restore();
      });
    });

    f.obj(
      'plans:note',
      { x: 1120, y: 852, abs: true, text: 'циклы показа могут вернуть игру на главную Steam', label: 'Планы: пояснение' },
      (o) => {
        if (plP <= 0) return;
        ctx.save();
        ctx.globalAlpha *= clamp01(plP * 1.4 - 0.6);
        text(ctx, o.text, 1120, 852, {
          size: 30,
          color: a(C.accent, 0.85),
          maxWidth: 650,
          tracking: 1,
          lineHeight: 1.2,
        });
        ctx.restore();
      },
    );

    // полировка вместе с сообществом
    const polP = seg(cPol.t, 0, 0.9);
    f.obj(
      'polish',
      {
        x: 960,
        y: 1018,
        abs: true,
        text: 'к этому моменту игра будет отполирована плотной работой с сообществом',
        label: 'Плашка про сообщество',
      },
      (o) => {
        if (polP <= 0) return;
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(polP);
        ctx.fillStyle = a(C.pos, 0.1);
        rrPath(ctx, 150, 962, 1620, 112, 14);
        ctx.fill();
        ctx.strokeStyle = a(C.pos, 0.3);
        ctx.lineWidth = 1.6;
        rrPath(ctx, 150, 962, 1620, 112, 14);
        ctx.stroke();
        icon(ctx, 'users', 232, 1018, 52, C.pos, gt);
        text(ctx, o.text, 296, 1034, {
          size: 40,
          color: C.text,
          maxWidth: 1420,
        });
        ctx.restore();
      },
    );
  },
};
