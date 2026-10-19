/** Сцена 1. Приветствие: каркас икосаэдра собирается и вращается за текстом. */

import { clamp01, seg } from '../../engine/anim.ts';
import { shockRing, softLight } from '../../engine/draw.ts';
import { reveal } from '../../engine/text.ts';
import { a, C, W } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import { drawWire, MESH, type View } from '../../engine/wire3d.ts';
import { textBacking } from './common.ts';

export const scene01: SceneDef = {
  id: 's01',

  render(f: Frame) {
    const { ctx, gt } = f;
    const c = f.cue('hi');

    // каркас начинает чертиться с первого кадра ролика, не дожидаясь реплики
    const build = seg(f.t, 0, 1.0);
    const view: View = { cx: W / 2, cy: 540, size: 640, pitch: 0.32, yaw: gt * 0.55, dist: 4.2 };

    f.obj('wire', { x: W / 2, y: 540, abs: true, label: 'Каркас' }, () => {
      ctx.save();
      ctx.globalAlpha *= clamp01(build * 3);
      softLight(ctx, W / 2, 540, 700, C.h1, 0.13);
      ctx.restore();

      drawWire(ctx, MESH.icosa, view, { rx: gt * 0.21 }, {
        color: a(C.h1, 0.55),
        width: 3,
        p: build,
        depthFade: 0.85,
        dots: 6,
      });
      // внутренний каркас вращается навстречу — даёт ощущение объёма
      drawWire(ctx, MESH.octa, { ...view, size: 300, yaw: -gt * 0.8 }, { rx: gt * 0.4 }, {
        color: a(C.accent, 0.5),
        width: 2.5,
        p: seg(f.t, 0.3, 0.9),
        depthFade: 0.8,
      });

      shockRing(ctx, W / 2, 540, seg(c.t, 0, 0.9), 620, C.h1, 3);
    });

    f.obj('title', { x: W / 2, y: 596, abs: true, text: c.show, label: 'Заголовок' }, (o) => {
      // подложка, чтобы каркас не спорил с текстом
      textBacking(ctx, W / 2, 550, 820, 0.7 * seg(c.t, 0, 0.4));

      reveal(
        ctx,
        o.text,
        W / 2,
        596,
        {
          size: 176,
          color: C.h1,
          align: 'center',
          tracking: 1,
          glowColor: a(C.h1, 0.35),
          glowBlur: 40,
        },
        seg(c.t, 0, 0.7),
        { stagger: 0.24, rise: 40 },
      );
    });
  },
};
