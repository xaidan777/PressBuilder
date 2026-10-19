/**
 * Сцена 10. Первое испытание: плоский прототип (вид строго сверху) живёт своей
 * жизнью, затем камера заваливается, тела вырастают из пола — 2D стало 3D.
 */

import { clamp01, easeInOutCubic, easeOutBack, lerp, seg } from '../../engine/anim.ts';
import { measure, reveal, text, type TextStyle } from '../../engine/text.ts';
import { a, C, mix } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import {
  depthOf,
  drawGrid,
  drawSolid,
  groundPath,
  MESH,
  type Mesh,
  type V3,
  type View,
} from '../../engine/wire3d.ts';
import { checkBadge } from './common.ts';

const BOARD = { hx: 6, hz: 4 };

interface Item {
  mesh: Mesh;
  x: number;
  z: number;
  /** Ширина, высота, глубина. */
  size: V3;
  color: string;
  ry?: number;
  /** Высота парения над полом (в 3D). */
  float?: number;
  round?: boolean;
}

const WALLS: Item[] = [
  { mesh: MESH.cube, x: -2.6, z: -2, size: [3, 1.3, 0.6], color: '#8a9096' },
  { mesh: MESH.cube, x: 3.1, z: 0.6, size: [0.6, 1.3, 3], color: '#8a9096' },
  { mesh: MESH.cube, x: -4.2, z: 2.3, size: [2, 1, 0.6], color: '#8a9096' },
  { mesh: MESH.cube, x: 0.6, z: -3.1, size: [0.6, 1.6, 1.4], color: '#8a9096' },
];
const COINS: Array<[number, number]> = [
  [-4.6, -0.4],
  [1.9, 2.9],
  [4.9, 2.7],
  [-1.2, -3.2],
  [5, -2.9],
];

function itemsAt(gt: number): Item[] {
  const items: Item[] = [...WALLS];
  // игрок ходит по кругу, враги патрулируют — и в 2D, и в 3D одинаково
  items.push({
    mesh: MESH.cube,
    x: -0.8 + 1.8 * Math.sin(gt * 0.9),
    z: 1.4 + 1.1 * Math.cos(gt * 0.9),
    size: [0.95, 0.95, 0.95],
    color: C.h1,
    ry: gt * 0.9,
  });
  items.push({
    mesh: MESH.cylinder,
    x: 4.7,
    z: -1.4 + 1.3 * Math.sin(gt * 1.2),
    size: [0.95, 1.15, 0.95],
    color: C.accent,
    round: true,
  });
  items.push({
    mesh: MESH.cylinder,
    x: 0.9 + 1.3 * Math.sin(gt * 0.8 + 1),
    z: -1.1,
    size: [0.95, 1.15, 0.95],
    color: C.accent,
    round: true,
  });
  COINS.forEach(([x, z], i) =>
    items.push({
      mesh: MESH.octa,
      x,
      z,
      size: [0.7, 0.7, 0.7],
      color: C.pos,
      ry: gt * 2 + i,
      float: 0.55 + 0.12 * Math.sin(gt * 3 + i),
    }),
  );
  return items;
}

/** Контур основания на полу — для тени. */
function footprint(it: Item, dx: number, dz: number): Array<[number, number]> {
  if (it.round || it.mesh === MESH.octa) {
    const r = it.size[0] * 0.5;
    return Array.from({ length: 14 }, (_, k): [number, number] => {
      const an = (Math.PI * 2 * k) / 14;
      return [it.x + dx + Math.cos(an) * r, it.z + dz + Math.sin(an) * r];
    });
  }
  const hw = it.size[0] / 2;
  const hd = it.size[2] / 2;
  return [
    [it.x + dx - hw, it.z + dz - hd],
    [it.x + dx + hw, it.z + dz - hd],
    [it.x + dx + hw, it.z + dz + hd],
    [it.x + dx - hw, it.z + dz + hd],
  ];
}

export const scene10: SceneDef = {
  id: 's10',

  energy: (_t, cue) => 0.6 * seg(cue('test').p, 0.6, 0.2),

  render(f: Frame) {
    const { ctx, gt } = f;
    const cT = f.cue('test');
    const cR = f.cue('result');

    f.obj('title', { x: 150, y: 210, abs: true, text: cT.show, label: 'Заголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        210,
        { size: 100, color: C.h1, tracking: 0.6 },
        seg(cT.t, 0, 0.6),
        { stagger: 0.22, rise: 28 },
      );
    });

    // ---- камера: строго сверху → три четверти с перспективой
    const tilt = easeInOutCubic(seg(cT.p, 0.56, 0.26));
    const ext = easeOutBack(seg(cT.p, 0.64, 0.24), 1.6);
    const orbit = Math.max(0, f.t - (cT.start + cT.dur * 0.82)) * 0.09;
    const view: View = {
      cx: lerp(1210, 1250, tilt),
      cy: lerp(610, 640, tilt),
      size: lerp(78, 84, tilt),
      pitch: lerp(Math.PI / 2, 0.64, tilt),
      yaw: lerp(0, -0.42, tilt) - orbit,
      dist: 1 / lerp(1 / 260, 1 / 15, tilt),
    };

    f.obj('board', { x: 1230, y: 625, abs: true, label: 'Прототип' }, () => {
      ctx.save();
      ctx.globalAlpha *= seg(cT.t, 0.1, 0.5);

      groundPath(ctx, view, [
        [-BOARD.hx, -BOARD.hz],
        [BOARD.hx, -BOARD.hz],
        [BOARD.hx, BOARD.hz],
        [-BOARD.hx, BOARD.hz],
      ]);
      ctx.fillStyle = '#2a2e35';
      ctx.fill();
      ctx.strokeStyle = a(C.h1, 0.55);
      ctx.lineWidth = 3;
      ctx.stroke();
      drawGrid(ctx, view, { half: BOARD.hx, halfZ: BOARD.hz, step: 1, color: a(C.text, 0.2), width: 1.4 });

      const items = itemsAt(gt);
      const h = (it: Item) => it.size[1] * Math.max(0.02, ext);

      // тени — «со всеми вытекающими»
      if (ext > 0.02) {
        ctx.fillStyle = `rgba(0, 0, 0, ${0.3 * clamp01(ext)})`;
        for (const it of items) {
          const reach = h(it) + (it.float ?? 0) * ext;
          groundPath(ctx, view, footprint(it, reach * 0.24, reach * 0.15));
          ctx.fill();
        }
      }

      items
        .map((it) => {
          const pos: V3 = [it.x, h(it) / 2 + (it.float ?? 0) * clamp01(ext), it.z];
          return { it, pos, depth: depthOf(pos, view) };
        })
        .sort((p, q) => p.depth - q.depth)
        .forEach(({ it, pos }) => {
          drawSolid(
            ctx,
            it.mesh,
            view,
            { pos, scale: [it.size[0], h(it), it.size[2]], ry: it.ry },
            { color: it.color, edge: tilt < 0.05 ? null : undefined },
          );
        });
      ctx.restore();
    });

    // ---- крупная метка: двойка переворачивается в тройку
    const flip = seg(cT.p, 0.6, 0.14);
    const three = flip >= 0.5;
    const st: TextStyle = {
      size: 330,
      color: mix(C.text, C.h1, tilt),
      tracking: 2,
      glowColor: a(C.h1, 0.4 * tilt),
      glowBlur: 50,
    };
    const lp = seg(cT.p, 0.2, 0.12);
    f.obj('mark', { x: 150, y: 700, abs: true, label: 'Метка 2D → 3D' }, () => {
      if (lp <= 0) return;
      const dw = Math.max(measure(ctx, '2', st), measure(ctx, '3', st));
      ctx.save();
      ctx.globalAlpha *= lp;
      ctx.save();
      ctx.translate(150, 700 - 115);
      ctx.scale(1, Math.max(0.001, three ? easeOutBack((flip - 0.5) * 2, 2) : 1 - flip * 2));
      text(ctx, three ? '3' : '2', 0, 115, st);
      ctx.restore();
      text(ctx, 'D', 150 + dw + 6, 700, { ...st, caps: 'normal' });
      ctx.restore();
    });

    // подпись под меткой меняется вместе с ней
    f.obj('caption-old', { x: 156, y: 790, abs: true, text: 'мой старый прототип', label: 'Подпись «до»' }, (o) => {
      if (lp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= lp * (1 - seg(cT.p, 0.56, 0.08));
      text(ctx, o.text, 156, 790, { size: 52, color: a(C.text, 0.6), tracking: 1.2 });
      ctx.restore();
    });
    f.obj('caption-new', { x: 156, y: 790, abs: true, text: 'со всеми вытекающими', label: 'Подпись «после»' }, (o) => {
      if (lp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= seg(cT.p, 0.74, 0.1);
      text(ctx, o.text, 156, 790, { size: 52, color: C.accent, tracking: 1.2 });
      ctx.restore();
    });

    f.obj('result', { x: 250, y: 906, abs: true, text: cR.show, label: 'Итог' }, (o) => {
      checkBadge(ctx, 190, 884, 36, seg(cR.t, 0.05, 0.4));
      reveal(
        ctx,
        o.text,
        250,
        906,
        { size: 70, color: C.pos, tracking: 0.8, maxWidth: 520, lineHeight: 1.1 },
        seg(cR.t, 0, 0.7),
        { stagger: 0.14, rise: 22 },
      );
    });
  },
};
