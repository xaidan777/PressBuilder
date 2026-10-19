/** Сцена 16. Рефанды 15% — страшная цифра и её причина. */

import { clamp01, easeOutExpo, easeOutQuart, seg } from '../../engine/anim.ts';
import { donut } from '../../engine/charts.ts';
import { arrow, panel, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { callout } from '../../engine/widgets.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

export const scene16: SceneDef = {
  id: 's16',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cR = f.cue('refunds');
    const cA = f.cue('above');
    const cReason = f.cue('reason');

    const rp = seg(cR.t, 0, 1.0);

    f.obj('title', { x: 150, y: 282, abs: true, text: cR.show, label: 'Заголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        282,
        { size: 88, color: C.accent, tracking: 0.6 },
        seg(cR.t, 0, 0.8),
        { stagger: 0.2, rise: 26 },
      );
    });

    // кольцо рефандов
    const cx = 530;
    const cy = 660;
    f.obj('donut', { x: cx, y: cy, abs: true, text: 'возвратов', label: 'Доля возвратов' }, (o) => {
      if (rp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= clamp01(rp * 2);
      softLight(ctx, cx, cy, 300, C.accent, 0.12);
      ctx.restore();

      donut(
        ctx,
        cx,
        cy,
        200,
        [
          { value: 15, color: C.accent },
          { value: 85, color: a(C.text, 0.07) },
        ],
        rp,
        46,
      );

      const inner = clamp01((rp - 0.3) / 0.4);
      ctx.save();
      ctx.globalAlpha *= inner;
      text(ctx, `${Math.round(15 * easeOutExpo(clamp01(rp * 1.3)))}%`, cx, cy + 20, {
        size: 118,
        color: C.accent,
        align: 'center',
      });
      text(ctx, o.text, cx, cy + 66, {
        size: 28,
        color: a(C.text, 0.5),
        align: 'center',
        tracking: 2.2,
      });
      ctx.restore();
    });

    // «выше среднего»
    const ap = seg(cA.t, 0, 0.8);
    f.obj('aboveArrow', { x: 780, y: 630, abs: true, label: 'Стрелка вверх' }, () => {
      if (ap <= 0) return;
      ctx.save();
      ctx.globalAlpha *= easeOutQuart(ap);
      arrow(ctx, 780, 700, 780, 560, clamp01(ap * 1.4), { color: C.accent, width: 4, head: 18 });
      ctx.restore();
    });
    f.obj(
      'aboveNote',
      { x: 830, y: 620, abs: true, text: 'не катастрофа,', label: 'Не катастрофа' },
      (o) => {
        if (ap <= 0) return;
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(ap);
        text(ctx, o.text, 830, 620, { size: 40, color: a(C.text, 0.7) });
        ctx.restore();
      },
    );
    f.obj(
      'above',
      { x: 830, y: 676, abs: true, text: 'но выше среднего', label: 'Выше среднего' },
      (o) => {
        if (ap <= 0) return;
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(ap);
        text(ctx, o.text, 830, 676, { size: 48, color: C.accent });
        ctx.restore();
      },
    );

    // пояснение термина
    f.obj(
      'term',
      { x: 1425, y: 390, abs: true, text: 'возврат денег за игру', label: 'Пояснение термина' },
      (o) => {
        callout(ctx, 'рефанд', o.text, 1080, 300, 690, seg(cR.t, 0.35, 0.9), C.h1);
      },
    );

    // главная претензия — не баги
    const pp = seg(cReason.t, 0, 0.9);
    const e = easeOutQuart(pp);
    f.obj(
      'reason',
      { x: 1425, y: 810, abs: true, text: 'претензия была', label: 'Карточка причины' },
      (o) => {
        if (pp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= e;
        ctx.translate(0, (1 - e) * 26);
        panel(ctx, 1080, 700, 690, 220, {
          fill: C.panel,
          stroke: a(C.pos, 0.3),
          radius: 14,
          lineWidth: 1.6,
          accentBar: { color: C.pos, width: 4 },
        });
        icon(ctx, 'bug', 1180, 790, 62, a(C.text, 0.35), gt);
        // перечёркиваем «баги»
        ctx.strokeStyle = C.pos;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(1146, 824);
        ctx.lineTo(1214 * clamp01(pp * 2 - 0.6) + 1146 * (1 - clamp01(pp * 2 - 0.6)), 756);
        ctx.stroke();
        text(ctx, o.text, 1260, 782, { size: 34, color: a(C.text, 0.6) });
        ctx.restore();
      },
    );
    f.obj(
      'reasonMain',
      { x: 1260, y: 836, abs: true, text: 'не в работоспособности', label: 'Причина' },
      (o) => {
        if (pp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= e;
        ctx.translate(0, (1 - e) * 26);
        text(ctx, o.text, 1260, 836, { size: 44, color: C.pos });
        ctx.restore();
      },
    );
  },
};
