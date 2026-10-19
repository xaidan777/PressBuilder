/** Сцена 20. Катастрофа: 80% → 55%, POSITIVE → MIXED, продажи в пять раз вниз. */

import { clamp01, easeOutExpo, easeOutQuart, pulse, seg, shake } from '../../engine/anim.ts';
import { bars } from '../../engine/charts.ts';
import { arrow, shockRing, softLight } from '../../engine/draw.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { curve, ratingBadge } from '../../engine/widgets.ts';
import type { CueTime, Frame, SceneDef } from '../../engine/types.ts';

/** Абстрактная кривая рейтинга: ровное плато и обрыв. */
const RATING = [0.8, 0.81, 0.8, 0.82, 0.8, 0.79, 0.8, 0.56, 0.55, 0.55];

const boomAt = (c: CueTime) => c.start + 0.15;

export const scene20: SceneDef = {
  id: 's20',

  energy(t, cue) {
    return pulse(t, boomAt(cue('boom')), 1.6);
  },

  render(f: Frame) {
    const { ctx } = f;
    const cF = f.cue('fine');
    const cB = f.cue('boom');
    const cD = f.cue('drop');
    const cS = f.cue('sales');

    const fp = seg(cF.t, 0, 0.9);
    const bp = seg(f.t, boomAt(cB), 0.9);
    const dp = seg(cD.t, 0, 1.0);
    const sp = seg(cS.t, 0, 0.9);

    const [shx, shy] = shake(f.t, boomAt(cB), 1.0, 18);
    ctx.save();
    ctx.translate(shx, shy);

    // плашка рейтинга: проценты и метка меняются на реплике «упал до 55»
    const pct = 80 - 25 * easeOutExpo(clamp01(dp * 1.5));
    const bad = dp > 0.35;
    f.obj('rating', { x: 530, y: 400, abs: true, label: 'Плашка рейтинга' }, () => {
      ratingBadge(ctx, {
        x: 150,
        y: 250,
        w: 760,
        h: 300,
        percent: pct,
        label: bad ? 'смешанные' : 'положительные',
        color: bad ? C.accent : C.pos,
        p: fp,
        note: bad ? 'MIXED' : 'POSITIVE',
      });
    });

    // абстрактный график рейтинга
    f.obj(
      'chart',
      { x: 1390, y: 480, abs: true, text: 'рейтинг обзоров', label: 'График рейтинга' },
      (o) => {
        if (fp <= 0.3) return;
        const cp = Math.min(0.68, easeOutQuart(clamp01((fp - 0.3) / 0.7)) * 0.68) + dp * 0.32;
        ctx.save();
        ctx.globalAlpha *= clamp01((fp - 0.3) * 3);
        text(ctx, o.text, 1010, 300, { size: 28, color: a(C.text, 0.5), tracking: 2.2 });
        ctx.restore();
        curve(ctx, {
          x: 1010,
          y: 330,
          w: 760,
          h: 300,
          data: RATING,
          p: cp,
          color: bad ? C.accent : C.pos,
          fill: true,
          smooth: false,
        });
      },
    );

    f.obj(
      'delta',
      { x: 1770, y: 610, abs: true, text: '−25 пунктов', label: 'Подпись «−25 пунктов»' },
      (o) => {
        if (fp <= 0.3 || dp <= 0.3) return;
        ctx.save();
        ctx.globalAlpha *= clamp01((dp - 0.3) / 0.4);
        text(ctx, o.text, 1770, 610, {
          size: 34,
          color: C.accent,
          align: 'right',
          tracking: 1,
        });
        ctx.restore();
      },
    );

    // вспышка «катастрофа»
    if (bp > 0 && bp < 1) {
      const k = pulse(f.t, boomAt(cB), 1.4);
      ctx.save();
      ctx.globalAlpha *= k;
      softLight(ctx, 960, 540, 900, C.accent, 0.2);
      shockRing(ctx, 960, 540, seg(f.t, boomAt(cB), 1.2), 1100, C.accent, 5);
      shockRing(ctx, 960, 540, seg(f.t, boomAt(cB) + 0.2, 1.2), 900, C.accent, 3);
      ctx.restore();
    }
    f.obj(
      'boom',
      { x: 960, y: 600, abs: true, text: 'катастрофа', label: 'Надпись «катастрофа»' },
      (o) => {
        if (bp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= clamp01(bp * 3) * (1 - clamp01(seg(cD.t, 0, 0.5)));
        text(ctx, o.text, 960, 600, {
          size: 190,
          color: C.accent,
          align: 'center',
          tracking: 2,
          glowColor: a(C.accent, 0.5),
          glowBlur: 50,
        });
        ctx.restore();
      },
    );

    // продажи вниз в пять раз
    f.obj(
      'sales',
      { x: 410, y: 825, abs: true, text: 'продажи в сутки', label: 'График продаж' },
      (o) => {
        if (sp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= clamp01(sp * 3);
        text(ctx, o.text, 150, 660, { size: 28, color: a(C.text, 0.5), tracking: 2.2 });
        ctx.restore();

        bars(ctx, {
          x: 150,
          y: 700,
          w: 520,
          h: 250,
          items: [
            { label: 'до', value: 100, color: C.pos },
            { label: 'после', value: 20, color: C.accent },
          ],
          p: sp,
          max: 112,
          stagger: 0.18,
          valueFmt: (v) => (v === 100 ? '100%' : '20%'),
        });
      },
    );

    f.obj('fivex', { x: 790, y: 860, abs: true, text: 'в 5 раз', label: 'В 5 раз' }, (o) => {
      if (sp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= easeOutQuart(clamp01(sp * 1.5 - 0.5));
      arrow(ctx, 740, 760, 740, 930, clamp01(sp * 1.8 - 0.7), {
        color: C.accent,
        width: 5,
        head: 22,
      });
      text(ctx, o.text, 790, 860, { size: 76, color: C.accent });
      ctx.restore();
    });

    // подпись реплики внизу: сначала «упал до 55», затем её сменяет «продажи»
    f.obj(
      'captionDrop',
      { x: 1770, y: 1010, abs: true, text: cD.show, label: 'Подпись: рейтинг упал' },
      (o) => {
        if (sp > 0 || dp <= 0 || !o.text) return;
        ctx.save();
        ctx.globalAlpha *= 0.9;
        reveal(
          ctx,
          o.text,
          1770,
          1010,
          { size: 48, color: C.accent, align: 'right', tracking: 1 },
          clamp01(dp * 2),
          { stagger: 0.16, rise: 14 },
        );
        ctx.restore();
      },
    );
    f.obj(
      'captionSales',
      { x: 1770, y: 1010, abs: true, text: cS.show, label: 'Подпись: продажи' },
      (o) => {
        if (sp <= 0 || !o.text) return;
        ctx.save();
        ctx.globalAlpha *= 0.9;
        reveal(
          ctx,
          o.text,
          1770,
          1010,
          { size: 48, color: C.accent, align: 'right', tracking: 1 },
          clamp01(sp * 2),
          { stagger: 0.16, rise: 14 },
        );
        ctx.restore();
      },
    );

    ctx.restore();
  },
};
