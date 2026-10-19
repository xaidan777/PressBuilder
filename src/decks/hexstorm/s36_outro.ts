/** Сцена 36. Аутро: спасибо за время, лайк, поддержка и Аркадия. */

import { clamp01, easeOutQuart, hash11, seg } from '../../engine/anim.ts';
import { hexPath, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

const ACTIONS = [
  { icon: 'thumb', label: 'поставьте лайк', color: C.pos },
  { icon: 'heart', label: 'поддержите HEXSTORM', color: C.accent },
];

export const scene36: SceneDef = {
  id: 's36',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cB = f.cue('bye');
    const cL = f.cue('like');
    const cA = f.cue('arcadia');

    const bp = seg(cB.t, 0, 0.9);
    const lp = seg(cL.t, 0, 1.0);
    const ap = seg(cA.t, 0, 1.0);

    // на последней реплике верх уходит полностью — финальный кадр остаётся чистым
    const fade = 1 - clamp01(ap * 2.4);

    ctx.save();
    ctx.globalAlpha *= fade;

    f.obj('title', { x: 960, y: 330, abs: true, text: cB.show, label: 'Заголовок' }, (o) => {
      ctx.save();
      ctx.globalAlpha *= clamp01(bp * 2);
      softLight(ctx, 960, 340, 640, C.h1, 0.1);
      ctx.restore();

      reveal(
        ctx,
        o.text,
        960,
        330,
        { size: 104, color: C.h1, align: 'center', tracking: 0.8 },
        bp,
        { stagger: 0.22, rise: 30 },
      );
    });

    // призывы
    ACTIONS.forEach((a2, i) => {
      const p = clamp01(lp * 1.7 - i * 0.24);
      const x = 620 + i * 680;
      const y = 590;
      f.obj(`action:${i}`, { x, y, abs: true, text: a2.label, label: `Призыв ${i + 1}` }, (o) => {
        if (p <= 0) return;
        const e = easeOutQuart(p);
        ctx.save();
        ctx.globalAlpha *= e;
        ctx.translate(0, (1 - e) * 26);
        hexPath(ctx, x, y, 78, Math.PI / 6);
        ctx.fillStyle = C.panel;
        ctx.fill();
        ctx.strokeStyle = a(a2.color, 0.6);
        ctx.lineWidth = 2.6;
        ctx.stroke();
        icon(ctx, a2.icon, x, y, 66, a2.color, gt);
        text(ctx, o.text, x, y + 132, {
          size: 40,
          color: a2.color,
          align: 'center',
          tracking: 1.2,
          maxWidth: 560,
        });
        ctx.restore();
      });
    });
    ctx.restore();

    // финальный кадр
    const e = easeOutQuart(ap);
    if (ap > 0) {
      // свечение на весь кадр — не объект
      ctx.save();
      ctx.globalAlpha *= e;
      softLight(ctx, 960, 500, 820, C.accent, 0.13);
      ctx.restore();
    }

    f.obj('logo', { x: 960, y: 400, abs: true, text: 'HEXSTORM', label: 'Эмблема и название' }, (o) => {
      if (ap <= 0) return;
      ctx.save();
      ctx.globalAlpha *= e;

      ctx.save();
      ctx.shadowColor = a(C.h1, 0.55);
      ctx.shadowBlur = 40;
      icon(ctx, 'arcadia', 960, 400, 300, C.h1, gt);
      ctx.restore();

      text(ctx, o.text, 960, 640, {
        size: 76,
        color: C.h1,
        align: 'center',
        tracking: 2.4,
      });
      ctx.restore();
    });
    f.obj('logo:sub', { x: 960, y: 696, abs: true, text: 'Tears of Arcadia', label: 'Подзаголовок названия' }, (o) => {
      if (ap <= 0) return;
      ctx.save();
      ctx.globalAlpha *= e;
      text(ctx, o.text, 960, 696, {
        size: 40,
        color: C.accent,
        align: 'center',
        tracking: 3.4,
      });
      ctx.restore();
    });

    f.obj('bye', { x: 960, y: 830, abs: true, text: 'увидимся на борту Аркадии', label: 'Прощание' }, (o) => {
      if (ap <= 0) return;
      ctx.save();
      ctx.globalAlpha *= e;
      reveal(
        ctx,
        o.text,
        960,
        830,
        {
          size: 96,
          color: C.accent,
          align: 'center',
          tracking: 0.8,
          glowColor: a(C.accent, 0.35),
          glowBlur: 36,
        },
        clamp01(ap * 1.4 - 0.2),
        { stagger: 0.16, rise: 26 },
      );
      ctx.restore();
    });

    // улетающие искры — декор на весь кадр, не объект
    if (ap > 0) {
      for (let i = 0; i < 16; i++) {
        const k = (gt * 0.2 + hash11(i * 5.9)) % 1;
        ctx.save();
        ctx.globalAlpha *= ap * (1 - k) * 0.45;
        icon(
          ctx,
          i % 4 === 0 ? 'arcadia' : 'star',
          200 + hash11(i * 3.3) * 1520,
          1060 - k * 640,
          16 + hash11(i * 8.1) * 20,
          i % 3 === 0 ? C.h1 : C.accent,
          gt,
        );
        ctx.restore();
      }
    }
  },
};
