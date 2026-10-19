/** Сцена 23. Ошибка №2: подарочные копии и отзывы, которые не считаются. */

import { clamp01, easeOutQuart, seg } from '../../engine/anim.ts';
import { arrow, panel, rrPath } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { reviewCard } from '../../engine/widgets.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

export const scene23: SceneDef = {
  id: 's23',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cM = f.cue('mistake');
    const cG = f.cue('gift');
    const cL = f.cue('liked');
    const cR = f.cue('rule');

    f.obj('title', { x: 150, y: 292, abs: true, text: cM.show, label: 'Заголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        292,
        { size: 100, color: C.accent, tracking: 0.6 },
        seg(cM.t, 0, 0.8),
        { stagger: 0.22, rise: 28 },
      );
    });

    // подарки друзьям
    const gp = seg(cG.t, 0, 1.0);
    const lp = seg(cL.t, 0, 0.9);
    const rp = seg(cR.t, 0, 1.0);

    f.obj(
      'gifts',
      { x: 440, y: 520, abs: true, text: 'раздал друзьям', label: 'Подарки друзьям' },
      (o) => {
        for (let i = 0; i < 3; i++) {
          const p = clamp01(gp * 1.9 - i * 0.22);
          if (p <= 0) continue;
          const e = easeOutQuart(p);
          const x = 230 + i * 210;
          ctx.save();
          ctx.globalAlpha *= e;
          ctx.translate(x, 480 - (1 - e) * 30);
          icon(ctx, 'gift', 0, 0, 92, C.h1, gt);
          ctx.restore();
        }
        ctx.save();
        ctx.globalAlpha *= clamp01(gp * 2);
        text(ctx, o.text, 230, 580, { size: 36, color: a(C.text, 0.7), tracking: 1 });
        ctx.restore();
      },
    );

    f.obj('arrow', { x: 780, y: 480, abs: true, label: 'Стрелка' }, () => {
      arrow(ctx, 700, 480, 860, 480, clamp01(gp * 1.6 - 0.5), {
        color: a(C.h1, 0.7),
        width: 3,
        head: 16,
      });
    });

    // отзывы друзей — положительные, но не в зачёт
    ctx.save();
    ctx.globalAlpha *= 1 - clamp01(rp * 1.8) * 0.5;
    [0, 1, 2].forEach((i) => {
      f.obj(
        `card:${i}`,
        { x: 1330, y: 411 + i * 202, abs: true, label: `Карточка отзыва ${i + 1}` },
        () => {
          reviewCard(ctx, {
            x: 920,
            y: 320 + i * 202,
            w: 820,
            h: 182,
            positive: true,
            p: clamp01(lp * 1.8 - i * 0.2),
            seed: 20 + i,
          });
        },
      );
    });
    ctx.restore();

    // один штамп поверх всей стопки
    f.obj(
      'stamp',
      { x: 1330, y: 612, abs: true, text: 'не учитывается в рейтинге', label: 'Штамп' },
      (o) => {
        if (rp <= 0) return;
        const sp = easeOutQuart(clamp01(rp * 1.7));
        ctx.save();
        ctx.globalAlpha *= sp;
        ctx.translate(1330, 612);
        ctx.rotate(-0.1);
        ctx.scale(1.06 - sp * 0.06, 1.06 - sp * 0.06);
        ctx.fillStyle = a(C.bg, 0.72);
        rrPath(ctx, -390, -56, 780, 112, 12);
        ctx.fill();
        ctx.strokeStyle = C.accent;
        ctx.lineWidth = 4;
        rrPath(ctx, -390, -56, 780, 112, 12);
        ctx.stroke();
        text(ctx, o.text, 0, 18, {
          size: 54,
          color: C.accent,
          align: 'center',
          tracking: 1.6,
        });
        ctx.restore();
      },
    );

    // правило Steam: плашка и три строки — отдельные объекты с общим появлением
    const ruleE = easeOutQuart(clamp01(rp * 1.4 - 0.3));
    const ruleIn = (draw: () => void) => {
      if (rp <= 0 || ruleE <= 0) return;
      ctx.save();
      ctx.globalAlpha *= ruleE;
      ctx.translate(0, (1 - ruleE) * 24);
      draw();
      ctx.restore();
    };
    f.obj('rule', { x: 500, y: 900, abs: true, label: 'Плашка правила Steam' }, () => {
      ruleIn(() => {
        panel(ctx, 150, 800, 700, 200, {
          fill: C.panel,
          stroke: a(C.accent, 0.34),
          radius: 14,
          lineWidth: 1.8,
          accentBar: { color: C.accent, width: 4 },
        });
        icon(ctx, 'steam', 240, 890, 64, a(C.accent, 0.8), gt);
      });
    });
    f.obj(
      'ruleHead',
      { x: 320, y: 872, abs: true, text: 'правило Steam', label: 'Правило: шапка' },
      (o) => {
        ruleIn(() => {
          text(ctx, o.text, 320, 872, { size: 30, color: a(C.text, 0.5), tracking: 2 });
        });
      },
    );
    f.obj(
      'ruleMain',
      { x: 320, y: 926, abs: true, text: 'отзывы на подарки', label: 'Правило: строка 1' },
      (o) => {
        ruleIn(() => {
          text(ctx, o.text, 320, 926, { size: 42, color: C.accent });
        });
      },
    );
    f.obj(
      'ruleSub',
      { x: 320, y: 972, abs: true, text: 'в общий рейтинг не идут', label: 'Правило: строка 2' },
      (o) => {
        ruleIn(() => {
          text(ctx, o.text, 320, 972, { size: 32, color: a(C.text, 0.65) });
        });
      },
    );
  },
};
