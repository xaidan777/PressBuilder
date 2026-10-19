/** Сцена 11. Урок первый: сроки проверки билда в Steam. */

import { clamp01, seg } from '../../engine/anim.ts';
import { icon } from '../../engine/icons.ts';
import { text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { chip } from '../../engine/ui.ts';
import { compareBar } from '../../engine/widgets.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import { header } from './common.ts';

export const scene11: SceneDef = {
  id: 's11',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cL = f.cue('lesson');
    const cD = f.cue('demo');
    const cF = f.cue('full');

    f.obj('title', { x: 150, y: 210, abs: true, text: cL.show, label: 'Заголовок' }, (o) => {
      header(ctx, o.text, 150, 210, seg(cL.t, 0, 0.9), {
        size: 86,
        maxWidth: 1400,
      });
    });

    const dp = seg(cD.t, 0, 0.9);
    const fp = seg(cF.t, 0, 0.9);

    // 3 дня против 3 недель — одна шкала на 21 день
    f.obj(
      'bar:demo',
      {
        x: 730,
        y: 567,
        abs: true,
        text: 'демо-версия · проверка Steam',
        label: 'Полоса «демо-версия»',
      },
      (o) => {
        compareBar(ctx, {
          x: 260,
          y: 540,
          w: 940,
          h: 54,
          label: o.text,
          value: 3 / 21,
          valueText: '3 дня',
          color: C.pos,
          p: dp,
          icon: 'thumb',
        });
      },
    );

    f.obj(
      'bar:full',
      {
        x: 730,
        y: 757,
        abs: true,
        text: 'полная версия · проверка и одобрение',
        label: 'Полоса «полная версия»',
      },
      (o) => {
        compareBar(ctx, {
          x: 260,
          y: 730,
          w: 940,
          h: 54,
          label: o.text,
          value: 1,
          valueText: '3 недели',
          color: C.accent,
          p: fp,
          icon: 'clock',
        });
      },
    );

    // шкала снизу
    f.obj('scale', { x: 730, y: 860, abs: true, label: 'Шкала дней' }, () => {
      ctx.save();
      ctx.globalAlpha *= clamp01(dp * 2);
      for (let i = 0; i <= 3; i++) {
        const x = 260 + (940 * i) / 3;
        ctx.strokeStyle = a(C.text, 0.14);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x, 830);
        ctx.lineTo(x, 856);
        ctx.stroke();
        text(ctx, `${i * 7} дней`, x, 890, {
          size: 22,
          color: a(C.text, 0.35),
          align: 'center',
          tracking: 1.4,
        });
      }
      ctx.restore();
    });

    // вывод
    const wp = clamp01(fp * 1.5 - 0.5);
    f.obj(
      'advice',
      { x: 246, y: 990, abs: true, text: 'закладывайте месяц запаса', label: 'Вывод' },
      (o) => {
        if (wp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= wp;
        icon(ctx, 'calendar', 190, 990, 52, C.h1, gt);
        chip(ctx, o.text, 246, 990, { color: C.h1, size: 28, p: wp });
        ctx.restore();
      },
    );
  },
};
