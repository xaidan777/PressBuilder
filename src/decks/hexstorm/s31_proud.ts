/** Сцена 31. Итог: отличный результат для первого проекта. */

import { clamp01, easeOutQuart, hash11, seg } from '../../engine/anim.ts';
import { softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { chip } from '../../engine/ui.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

const RECAP = [
  { label: 'первая неделя', color: C.h1, icon: 'calendar' },
  { label: '$11 137 gross', color: C.accent, icon: 'money' },
  { label: '71% обзоров', color: C.pos, icon: 'thumb' },
];

export const scene31: SceneDef = {
  id: 's31',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cR = f.cue('result');
    const cP = f.cue('proud');

    const rp = seg(cR.t, 0, 0.9);
    const pp = seg(cP.t, 0, 0.9);

    f.obj('title', { x: 960, y: 440, abs: true, text: cR.show, label: 'Заголовок' }, (o) => {
      ctx.save();
      ctx.globalAlpha *= clamp01(rp * 2);
      softLight(ctx, 960, 440, 700, C.pos, 0.1);
      ctx.restore();

      reveal(
        ctx,
        o.text,
        960,
        440,
        { size: 100, color: C.pos, align: 'center', tracking: 0.8, maxWidth: 1500, lineHeight: 1.08 },
        rp,
        { stagger: 0.2, rise: 30 },
      );
    });

    RECAP.forEach((r, i) => {
      const p = clamp01(rp * 1.7 - 0.5 - i * 0.16);
      f.obj(`recap:${i}`, { x: 400 + i * 400, y: 610, abs: true, text: r.label, label: `Итог ${i + 1}` }, (o) => {
        if (p <= 0) return;
        chip(ctx, o.text, 400 + i * 400, 610, {
          color: r.color,
          size: 30,
          icon: r.icon,
          align: 'center',
          p,
        });
      });
    });

    f.obj('lead', { x: 960, y: 800, abs: true, text: 'я очень горд, что получилось', label: 'Подводка' }, (o) => {
      if (pp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= easeOutQuart(pp);
      text(ctx, o.text, 960, 800, {
        size: 46,
        color: a(C.text, 0.7),
        align: 'center',
        tracking: 1.4,
      });
      ctx.restore();
    });
    f.obj('proud', { x: 960, y: 900, abs: true, text: cP.show, label: 'Благодарность' }, (o) => {
      if (pp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= easeOutQuart(pp);
      reveal(
        ctx,
        o.text,
        960,
        900,
        { size: 72, color: C.accent, align: 'center', tracking: 0.8 },
        clamp01(pp * 1.4 - 0.2),
        { stagger: 0.18, rise: 22 },
      );
      ctx.restore();
    });

    // летящие сердечки и звёзды — декор на весь кадр, не объект
    if (pp > 0) {
      for (let i = 0; i < 12; i++) {
        const k = (gt * 0.24 + hash11(i * 6.1)) % 1;
        ctx.save();
        ctx.globalAlpha *= pp * (1 - k) * 0.4;
        icon(ctx, i % 3 === 0 ? 'heart' : 'star', 260 + hash11(i * 8.3) * 1400, 1010 - k * 500, 20 + hash11(i * 2.7) * 18, C.accent, gt);
        ctx.restore();
      }
    }
  },
};
