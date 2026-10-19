/**
 * Сцена 6. От обратного: стрелка разворачивается, и вместо движка «для людей»
 * появляется среда, где вокруг LLM вырастают трёхмерные фантазии.
 */

import { clamp01, easeInOutCubic, easeOutBack, easeOutQuart, seg } from '../../engine/anim.ts';
import { softLight } from '../../engine/draw.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C, mix, W } from '../../engine/theme.ts';
import { chip } from '../../engine/ui.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import {
  depthOf,
  drawGrid,
  drawSolid,
  groundPath,
  MESH,
  project,
  type Mesh,
  type V3,
  type View,
} from '../../engine/wire3d.ts';
import { botHex, textBacking } from './common.ts';

type Ctx = CanvasRenderingContext2D;

const SHAPES: Array<{ mesh: Mesh; color: string }> = [
  { mesh: MESH.cube, color: C.h1 },
  { mesh: MESH.pyramid, color: C.accent },
  { mesh: MESH.icosa, color: C.pos },
  { mesh: MESH.cylinder, color: C.h1 },
  { mesh: MESH.octa, color: C.accent },
  { mesh: MESH.hexPrism, color: C.pos },
];
const RING = 3.5;

/** Толстая стрелка вправо с центром в (0, 0). */
function bigArrow(ctx: Ctx, len: number, h: number): void {
  const head = h * 1.15;
  ctx.beginPath();
  ctx.moveTo(-len / 2, -h * 0.28);
  ctx.lineTo(len / 2 - head, -h * 0.28);
  ctx.lineTo(len / 2 - head, -h * 0.72);
  ctx.lineTo(len / 2, 0);
  ctx.lineTo(len / 2 - head, h * 0.72);
  ctx.lineTo(len / 2 - head, h * 0.28);
  ctx.lineTo(-len / 2, h * 0.28);
  ctx.closePath();
}

export const scene06: SceneDef = {
  id: 's06',

  energy: (_t, cue) => 0.5 * seg(cue('env').p, 0.5, 0.3),

  render(f: Frame) {
    const { ctx, gt } = f;
    const cR = f.cue('reverse');
    const cE = f.cue('env');

    // ---- разворот стрелки
    const out = seg(cE.t, 0, 0.4);
    const flip = easeInOutCubic(seg(cR.t, cR.dur * 0.2, cR.dur * 0.5));
    // общий уход стрелки и текста вверх — снаружи объектов
    ctx.save();
    ctx.globalAlpha *= (1 - out) * clamp01(seg(cR.t, 0, 0.3));
    ctx.translate(0, -out * 120);

    f.obj('arrow', { x: W / 2, y: 420, abs: true, label: 'Стрелка' }, () => {
      if (out >= 1) return;
      ctx.save();
      ctx.translate(W / 2, 420);
      ctx.scale(Math.cos(Math.PI * flip) || 0.001, 1);
      bigArrow(ctx, 700, 150);
      ctx.fillStyle = mix('#7d8288', C.accent, flip);
      ctx.shadowColor = a(C.accent, 0.5 * flip);
      ctx.shadowBlur = 40;
      ctx.fill();
      ctx.restore();
    });

    f.obj('reverse', { x: W / 2, y: 730, abs: true, text: cR.show, label: 'Заголовок' }, (o) => {
      if (out >= 1) return;
      reveal(
        ctx,
        o.text,
        W / 2,
        730,
        { size: 176, color: C.accent, align: 'center', tracking: 1 },
        seg(cR.t, cR.dur * 0.25, 0.5),
        { stagger: 0.3, rise: 36 },
      );
    });
    ctx.restore();

    // ---- среда
    const env = seg(cE.t, 0.25, 0.6);

    // сетка, фигуры и робот отсортированы по глубине между собой — это один объект
    f.obj('world', { x: W / 2, y: 600, abs: true, label: 'Среда' }, () => {
      if (env <= 0) return;
      const view: View = { cx: W / 2, cy: 600, size: 106, pitch: 0.46, yaw: gt * 0.22, dist: 14 };

      ctx.save();
      ctx.globalAlpha *= easeOutQuart(env);
      softLight(ctx, W / 2, 600, 760, C.h1, 0.1);
      drawGrid(ctx, view, { half: 6, step: 1, color: a(C.h1, 0.2), width: 1.6 });
      ctx.restore();

      const items = SHAPES.map((s, i) => {
        const ang = (Math.PI * 2 * i) / SHAPES.length;
        const p = seg(cE.p, 0.36 + i * 0.07, 0.1);
        const bob = Math.sin(gt * 1.8 + i * 1.3) * 0.12;
        const pos: V3 = [Math.cos(ang) * RING, 0.75 + bob, Math.sin(ang) * RING];
        return { ...s, i, p, pos, z: depthOf(pos, view) };
      }).sort((p, q) => p.z - q.z);

      const drawItem = (it: (typeof items)[number]) => {
        if (it.p <= 0) return;
        const s = easeOutBack(it.p, 2.4);
        ctx.save();
        ctx.globalAlpha *= Math.min(1, it.p * 3);
        // тень на полу
        const ring: Array<[number, number]> = [];
        for (let k = 0; k < 14; k++) {
          const an = (Math.PI * 2 * k) / 14;
          ring.push([it.pos[0] + Math.cos(an) * 0.6 * s, it.pos[2] + Math.sin(an) * 0.6 * s]);
        }
        groundPath(ctx, view, ring);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fill();
        drawSolid(
          ctx,
          it.mesh,
          view,
          { pos: it.pos, scale: 1.25 * s, ry: gt * 0.9 + it.i, rx: it.i % 2 ? gt * 0.4 : 0 },
          { color: it.color },
        );
        ctx.restore();
      };

      items.filter((it) => it.z < 0).forEach(drawItem);

      const [bx, by] = project([0, 1.7, 0], view);
      botHex(ctx, bx, by, {
        r: 100,
        color: C.h1,
        p: seg(cE.p, 0.08, 0.12),
        t: gt,
        glow: 0.6 + 0.4 * seg(cE.p, 0.5, 0.3),
      });

      items.filter((it) => it.z >= 0).forEach(drawItem);
    });

    // ---- «среда, где LLM дёшево и быстро»
    f.obj('envTitle', { x: 850, y: 212, abs: true, text: 'среда, где LLM', label: 'Текст сверху' }, (o) => {
      if (env <= 0) return;
      ctx.save();
      ctx.globalAlpha *= easeOutQuart(seg(cE.p, 0.06, 0.12));
      text(ctx, o.text, 850, 212, {
        size: 92,
        color: C.h1,
        align: 'right',
        tracking: 0.8,
      });
      ctx.restore();
    });
    f.obj('cheap', { x: 890, y: 182, abs: true, text: 'дёшево', label: 'Плашка 1' }, (o) => {
      if (env <= 0) return;
      chip(ctx, o.text, 890, 182, { color: C.pos, size: 54, icon: 'money', p: seg(cE.p, 0.3, 0.08) });
    });
    f.obj('quick', { x: 1236, y: 182, abs: true, text: 'быстро', label: 'Плашка 2' }, (o) => {
      if (env <= 0) return;
      chip(ctx, o.text, 1236, 182, { color: C.accent, size: 54, icon: 'bolt', p: seg(cE.p, 0.38, 0.08) });
    });

    f.obj('fantasy', { x: W / 2, y: 1000, abs: true, text: cE.show, label: 'Подпись' }, (o) => {
      if (env <= 0) return;
      textBacking(ctx, W / 2, 975, 760, 0.6 * seg(cE.p, 0.62, 0.12));
      reveal(
        ctx,
        o.text,
        W / 2,
        1000,
        {
          size: 92,
          color: C.accent,
          align: 'center',
          tracking: 0.8,
          glowColor: a(C.accent, 0.3),
          glowBlur: 30,
        },
        seg(cE.p, 0.66, 0.2),
        { stagger: 0.18, rise: 24 },
      );
    });
  },
};
