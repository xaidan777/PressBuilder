/** Сцена 29. Тот самый час: +9 500 и 1 200 копий. Возврат к сцене-завязке. */

import { clamp01, easeOutExpo, easeOutQuart, fmtNum, hash11, pulse, seg } from '../../engine/anim.ts';
import { shockRing, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { chip } from '../../engine/ui.ts';
import type { CueTime, Frame, SceneDef } from '../../engine/types.ts';

const REVENUE = 9500;
const UNITS = 1200;

const bangAt = (c: CueTime) => c.start + 0.2;

export const scene29: SceneDef = {
  id: 's29',

  energy(t, cue) {
    return pulse(t, bangAt(cue('wake')), 1.5) * 0.9;
  },

  render(f: Frame) {
    const { ctx, gt } = f;
    const cI = f.cue('incredible');
    const cW = f.cue('wake');
    const cG = f.cue('glitch');
    const cS = f.cue('stays');
    const cSm = f.cue('smile');

    const ip = seg(cI.t, 0, 0.8);
    const wp = seg(f.t, bangAt(cW), 1.0);

    f.obj('title', { x: 150, y: 292, abs: true, text: cI.show, label: 'Заголовок' }, (o) => {
      ctx.save();
      ctx.globalAlpha *= 1 - clamp01(wp * 1.6) * 0.55;
      reveal(
        ctx,
        o.text,
        150,
        292,
        { size: 84, color: C.h1, tracking: 0.6, maxWidth: 1400 },
        ip,
        { stagger: 0.2, rise: 26 },
      );
      ctx.restore();
    });

    // крупные цифры
    const e = easeOutQuart(clamp01(wp * 1.4));
    const val = REVENUE * easeOutExpo(clamp01(wp * 1.2));
    const units = UNITS * easeOutExpo(clamp01(wp * 1.2));
    f.obj('revenue', { x: 960, y: 600, abs: true, label: 'Сумма за час' }, () => {
      if (wp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= e;
      softLight(ctx, 960, 560, 620, C.accent, 0.14);
      shockRing(ctx, 960, 560, seg(f.t, bangAt(cW), 1.2), 720, C.accent, 5);
      shockRing(ctx, 960, 560, seg(f.t, bangAt(cW) + 0.2, 1.2), 620, C.accent, 3);

      text(ctx, `+$${fmtNum(val)}`, 960, 600, {
        size: 210,
        color: C.accent,
        align: 'center',
        tracking: -1,
        glowColor: a(C.accent, 0.5),
        glowBlur: 50,
      });
      ctx.restore();
    });
    f.obj('units', { x: 960, y: 680, abs: true, label: 'Копий за час' }, () => {
      if (wp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= e;
      text(ctx, `${fmtNum(units)} копий · за один час`, 960, 680, {
        size: 46,
        color: C.text,
        align: 'center',
        tracking: 1.6,
      });
      ctx.restore();
    });

    // сомнения
    const gp = seg(cG.t, 0, 0.7);
    f.obj(
      'glitch',
      { x: 150, y: 800, abs: true, text: 'наверное, сбой статистики первого часа', label: 'Сомнение' },
      (o) => {
        if (gp <= 0) return;
        chip(ctx, o.text, 150, 800, {
          color: C.h1,
          size: 28,
          icon: 'warning',
          p: gp,
        });
      },
    );

    const sp = seg(cS.t, 0, 0.7);
    f.obj(
      'stays',
      { x: 240, y: 906, abs: true, text: 'прошло несколько часов — цифра на месте', label: 'Цифра на месте' },
      (o) => {
        if (sp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(sp);
        icon(ctx, 'clock', 190, 890, 46, C.pos, gt);
        text(ctx, o.text, 240, 906, {
          size: 40,
          color: a(C.text, 0.8),
        });
        ctx.restore();
      },
    );

    // 40 минут счастья
    const smp = seg(cSm.t, 0, 0.9);
    f.obj(
      'hope',
      { x: 150, y: 990, abs: true, text: 'неужели новая цена вернула показы на главную?', label: 'Вопрос' },
      (o) => {
        if (smp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(smp);
        text(ctx, o.text, 150, 990, {
          size: 34,
          color: a(C.text, 0.55),
          tracking: 1,
        });
        ctx.restore();
      },
    );
    f.obj('smile', { x: 1370, y: 976, abs: true, text: '40 минут сияющей улыбки', label: 'Улыбка' }, (o) => {
      if (smp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= easeOutQuart(smp);
      chip(ctx, o.text, 1370, 976, {
        color: C.accent,
        size: 30,
        icon: 'star',
        p: clamp01(smp * 1.6 - 0.4),
      });
      ctx.restore();
    });

    // летящие звёзды — декор на весь кадр, не объект
    if (smp > 0) {
      for (let i = 0; i < 10; i++) {
        const k = (gt * 0.3 + hash11(i * 4.1)) % 1;
        ctx.save();
        ctx.globalAlpha *= smp * (1 - k) * 0.45;
        icon(ctx, 'star', 300 + hash11(i * 7.7) * 1320, 1000 - k * 420, 18 + hash11(i) * 16, C.accent);
        ctx.restore();
      }
    }
  },
};
