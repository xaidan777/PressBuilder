/** Сцена 17. Прощание: тот же икосаэдр, что и в начале, и улетающие вверх тела. */

import { clamp01, hash11, seg } from '../../engine/anim.ts';
import { softLight } from '../../engine/draw.ts';
import { reveal } from '../../engine/text.ts';
import { a, C, W } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import { drawSolid, drawWire, MESH, type Mesh, type View } from '../../engine/wire3d.ts';
import { textBacking } from './common.ts';

const SPARKS: Mesh[] = [MESH.cube, MESH.octa, MESH.pyramid, MESH.icosa];
const COLORS = [C.h1, C.accent, C.pos];

export const scene17: SceneDef = {
  id: 's17',

  render(f: Frame) {
    const { ctx, gt } = f;
    const c = f.cue('bye');
    const p = seg(c.t, 0, 0.9);

    f.obj('icosa', { x: W / 2, y: 540, abs: true, label: 'Икосаэдр' }, () => {
      ctx.save();
      ctx.globalAlpha *= clamp01(p * 2);
      softLight(ctx, W / 2, 540, 760, C.h1, 0.12);
      ctx.restore();

      const view: View = { cx: W / 2, cy: 540, size: 640, pitch: 0.32, yaw: gt * 0.55, dist: 4.2 };
      drawWire(ctx, MESH.icosa, view, { rx: gt * 0.21 }, {
        color: a(C.h1, 0.4),
        width: 3,
        p,
        depthFade: 0.85,
        dots: 6,
      });
    });

    // маленькие тела всплывают снизу вверх
    for (let i = 0; i < 14; i++) {
      const k = (gt * (0.1 + hash11(i * 4.1) * 0.08) + hash11(i * 5.9)) % 1;
      ctx.save();
      ctx.globalAlpha *= p * Math.sin(k * Math.PI) * 0.75;
      drawSolid(
        ctx,
        SPARKS[i % SPARKS.length],
        {
          cx: 140 + hash11(i * 3.3) * (W - 280),
          cy: 1120 - k * 1100,
          size: 46 + hash11(i * 8.1) * 56,
          pitch: 0.4,
          yaw: gt * (0.8 + hash11(i) * 1.2) + i,
          dist: 4.5,
        },
        { rx: gt * 0.6 + i },
        { color: COLORS[i % COLORS.length] },
      );
      ctx.restore();
    }

    // тёмная подложка — часть текста: переезжает вместе с ним
    f.obj('bye', { x: W / 2, y: 520, abs: true, text: 'всем спасибо\nи до скорых встреч!', label: 'Прощание' }, (o) => {
      textBacking(ctx, W / 2, 550, 860, 0.72 * seg(c.t, 0, 0.4));

      reveal(
        ctx,
        o.text,
        W / 2,
        520,
        {
          size: 150,
          color: C.h1,
          align: 'center',
          tracking: 1,
          lineHeight: 1.08,
          glowColor: a(C.h1, 0.35),
          glowBlur: 40,
        },
        seg(c.t, 0, 1.0),
        { stagger: 0.18, rise: 36 },
      );
    });
  },
};
