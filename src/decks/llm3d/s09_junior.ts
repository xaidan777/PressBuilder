/** Сцена 9. Флагманы не нужны: их карточки перечёркнуты, а младшие модели спокойно крутят 3D. */

import { easeOutBack, seg } from '../../engine/anim.ts';
import { softLight } from '../../engine/draw.ts';
import { reveal } from '../../engine/text.ts';
import { a, C, W } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import { drawSolid, MESH, type Mesh } from '../../engine/wire3d.ts';
import { botHex, checkBadge, modelCard } from './common.ts';

const FLAGSHIPS = [
  { name: 'ASTRA', color: C.accent },
  { name: 'FABLE', color: C.h1 },
];
const CARD = { w: 600, h: 220, y: 270, gap: 80 };

const JUNIORS: Array<{ x: number; mesh: Mesh }> = [
  { x: 520, mesh: MESH.cube },
  { x: 960, mesh: MESH.icosa },
  { x: 1400, mesh: MESH.pyramid },
];

export const scene09: SceneDef = {
  id: 's09',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cN = f.cue('noneed');
    const cJ = f.cue('junior');

    f.obj('title', { x: W / 2, y: 200, abs: true, text: cN.show, label: 'Заголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        W / 2,
        200,
        { size: 100, color: C.h1, align: 'center', tracking: 0.6 },
        seg(cN.t, 0, 0.6),
        { stagger: 0.16, rise: 28 },
      );
    });

    FLAGSHIPS.forEach((m, i) => {
      const x = W / 2 - CARD.gap / 2 - CARD.w + i * (CARD.w + CARD.gap);
      f.obj(
        `flagship:${i}`,
        { x: x + CARD.w / 2, y: CARD.y + CARD.h / 2, abs: true, text: m.name, label: `Флагман ${i + 1}` },
        (o) => {
          // «ни Астра» — первая, «ни Fable» — вторая
          const strike = seg(cN.p, 0.5 + i * 0.22, 0.16);
          modelCard(ctx, {
            x,
            y: CARD.y,
            w: CARD.w,
            h: CARD.h,
            name: o.text,
            color: m.color,
            p: seg(cN.t, 0.1 + i * 0.12, 0.5),
            strike,
            dim: strike,
            t: gt,
          });
        },
      );
    });

    // младшие: гексы поменьше, у каждого над головой крутится своё тело
    JUNIORS.forEach((j, i) => {
      const y = 780;
      f.obj(`junior:${i}`, { x: j.x, y, abs: true, label: `Младшая модель ${i + 1}` }, () => {
        const p = seg(cJ.p, 0.06 + i * 0.12, 0.2);
        if (p <= 0) return;
        ctx.save();
        ctx.globalAlpha *= Math.min(1, p * 3);
        softLight(ctx, j.x, y - 80, 260, C.pos, 0.12);
        drawSolid(
          ctx,
          j.mesh,
          { cx: j.x, cy: y - 190 + Math.sin(gt * 2 + i) * 8, size: 120 * easeOutBack(p, 2), pitch: 0.45, yaw: gt * 1.1 + i * 2, dist: 4.5 },
          {},
          { color: C.pos },
        );
        ctx.restore();
        botHex(ctx, j.x, y, { r: 72, color: C.pos, p, t: gt + i });
        checkBadge(ctx, j.x + 64, y + 40, 26, seg(cJ.p, 0.42 + i * 0.1, 0.12));
      });
    });

    f.obj('caption', { x: W / 2, y: 975, abs: true, text: cJ.show, label: 'Подпись' }, (o) => {
      reveal(
        ctx,
        o.text,
        W / 2,
        975,
        { size: 70, color: C.pos, align: 'center', tracking: 0.8, glowColor: a(C.pos, 0.25), glowBlur: 26 },
        seg(cJ.p, 0.3, 0.3),
        { stagger: 0.14, rise: 22 },
      );
    });
  },
};
