/** Сцена 15. Бесплатно и доступно для скачивания. */

import { clamp01, easeOutBack, hash11, seg } from '../../engine/anim.ts';
import { hexPath, shockRing, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C, H, W } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

export const scene15: SceneDef = {
  id: 's15',

  energy: (_t, cue) => 0.7 * seg(cue('free').p, 0.25, 0.2),

  render(f: Frame) {
    const { ctx, gt } = f;
    const c = f.cue('free');

    // «всё бесплатно» звучит в первой трети реплики
    const big = seg(c.p, 0.2, 0.18);
    const dl = seg(c.p, 0.55, 0.2);

    // фоновый дождь стрелок загрузки
    for (let i = 0; i < 18; i++) {
      const k = (gt * (0.16 + hash11(i * 2.7) * 0.14) + hash11(i * 6.1)) % 1;
      ctx.save();
      ctx.globalAlpha *= dl * Math.sin(k * Math.PI) * 0.22;
      icon(ctx, 'download', 120 + hash11(i * 3.9) * (W - 240), -60 + k * (H + 60), 40 + hash11(i * 8.3) * 50, C.h1, 0);
      ctx.restore();
    }

    f.obj('lead', { x: W / 2, y: 300, abs: true, text: 'как всегда, всё', label: 'Вводная строка' }, (o) => {
      ctx.save();
      ctx.globalAlpha *= seg(c.t, 0, 0.4);
      text(ctx, o.text, W / 2, 300, {
        size: 72,
        color: a(C.text, 0.7),
        align: 'center',
        tracking: 2,
      });
      ctx.restore();
    });

    f.obj('free', { x: W / 2, y: 500, abs: true, text: 'бесплатно', label: 'Бесплатно' }, (o) => {
      if (big <= 0) return;
      softLight(ctx, W / 2, 500, 760, C.pos, 0.14 * big);
      shockRing(ctx, W / 2, 500, seg(c.p, 0.2, 0.4), 700, C.pos, 4);
      const s = 0.7 + 0.3 * easeOutBack(big, 2.2);
      ctx.save();
      ctx.globalAlpha *= clamp01(big * 2.5);
      ctx.translate(W / 2, 500);
      ctx.scale(s, s);
      text(ctx, o.text, 0, 96, {
        size: 300,
        color: C.pos,
        align: 'center',
        tracking: 3,
        glowColor: a(C.pos, 0.45),
        glowBlur: 60,
      });
      ctx.restore();
    });

    f.obj('download', { x: 680, y: 878, abs: true, text: c.show, label: 'Скачивание' }, (o) => {
      if (dl <= 0) return;
      const e = easeOutBack(dl, 1.6);
      ctx.save();
      ctx.globalAlpha *= clamp01(dl * 2.5);
      ctx.translate(0, (1 - e) * 40);
      hexPath(ctx, 560, 850, 84, Math.PI / 6);
      ctx.fillStyle = C.panel;
      ctx.fill();
      ctx.strokeStyle = a(C.h1, 0.8);
      ctx.lineWidth = 3;
      ctx.stroke();
      icon(ctx, 'download', 560, 850, 84, C.h1, gt);
      ctx.restore();
      reveal(
        ctx,
        o.text,
        680,
        878,
        { size: 88, color: C.h1, tracking: 0.8 },
        dl,
        { stagger: 0.2, rise: 24 },
      );
    });
  },
};
