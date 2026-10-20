/**
 * Сцена 8. Quad Mesh.
 * Tripo P2.0 → крупная квадовая сетка строится по строкам; квады подсвечиваются,
 * один квад «вынимается» крупно (4 вершины). Движок: по сетке пробегают диагонали,
 * крупный квад режется на два треугольника. Редактирование: снова квады,
 * edge loop скользит по сетке, рядом сгибается конечность с лупами на сгибе.
 */

import { clamp01, easeInOutCubic, easeOutQuart, lerp, seg } from '../../engine/anim.ts';
import { arrow, softLight } from '../../engine/draw.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import {
  appear,
  blobSurf,
  CLAY,
  drawSurf,
  limbSurf,
  OGRE,
  titles,
  toolCard,
  toScreen,
  type P2,
  type Surf,
  type V3,
  type View,
} from './common.ts';

type Ctx = CanvasRenderingContext2D;

const NU = 28;
const NV = 18;
const HEAD = blobSurf(NU, NV, 0.12, [1, 1.06, 1], 2);

const CARD = { x: 150, y: 360, w: 540, h: 170 };
const M1 = { cx: 1130, cy: 712, size: 315 };
const M2 = { cx: 740, cy: 712, size: 325 };
const BIG = { cx: 1470, cy: 660, s: 230 };
const LIMB = { cx: 1450, cy: 690 };

/** Квад, который «вынимаем» крупно. */
const PICK = { j: 8, i: 9 };
const YAW0 = 0.42;

/** Edge slide: строка `row` смещается к соседней на долю `k` (−1..1). */
function slide(s: Surf, row: number, k: number): Surf {
  const to = k >= 0 ? row + 1 : row - 1;
  const kk = Math.abs(k);
  const pts = s.pts.map((r, j) =>
    j === row
      ? r.map((v, i) => {
          const w = s.pts[to][i];
          return [lerp(v[0], w[0], kk), lerp(v[1], w[1], kk), lerp(v[2], w[2], kk)] as V3;
        })
      : r,
  );
  return { pts, closedU: s.closedU };
}

/** Крупный квад: 4 вершины, при `tri` > 0 — диагональ и раздвинутые треугольники. */
function bigQuad(ctx: Ctx, cx: number, cy: number, s: number, p: number, tri: number, gt: number): void {
  if (p <= 0) return;
  const e = easeOutQuart(p);
  const q: P2[] = [
    [-0.5, -0.42],
    [0.46, -0.5],
    [0.52, 0.44],
    [-0.46, 0.5],
  ];
  const gap = 0.07 * easeOutQuart(tri);
  ctx.save();
  ctx.globalAlpha *= e;
  ctx.translate(cx, cy);
  ctx.scale(s * (0.6 + 0.4 * e), s * (0.6 + 0.4 * e));
  softLight(ctx, 0, 0, 0.9, C.accent, 0.12);
  const poly = (pts: P2[], dx: number, dy: number, fill: string, stroke: string) => {
    ctx.beginPath();
    pts.forEach(([x, y], k) => (k ? ctx.lineTo(x + dx, y + dy) : ctx.moveTo(x + dx, y + dy)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 6 / s;
    ctx.stroke();
  };
  if (tri <= 0) {
    poly(q, 0, 0, a(C.accent, 0.22), C.accent);
  } else {
    // диагональ q0–q2 делит квад на два треугольника
    poly([q[0], q[1], q[2]], gap, -gap, a(C.h1, 0.2), C.h1);
    poly([q[0], q[2], q[3]], -gap, gap, a(C.h1, 0.2), C.h1);
    ctx.save();
    ctx.globalAlpha *= 1 - clamp01(tri * 2);
    poly(q, 0, 0, 'rgba(0,0,0,0)', C.accent);
    ctx.restore();
  }
  // вершины
  const pulse = 1 + 0.12 * Math.sin(gt * 5);
  q.forEach(([x, y], k) => {
    const off = tri > 0 ? (k === 1 ? [gap, -gap] : k === 3 ? [-gap, gap] : [0, 0]) : [0, 0];
    ctx.beginPath();
    ctx.arc(x + off[0], y + off[1], (14 / s) * pulse, 0, Math.PI * 2);
    ctx.fillStyle = tri > 0.5 ? C.h1 : C.accent;
    ctx.fill();
  });
  ctx.restore();
}

export const scene08: SceneDef = {
  id: 's08',

  energy: (_t, cue) => 0.5 * seg(cue('tris').p, 0.1, 0.15) * (1 - seg(cue('tris').p, 0.7, 0.3)),

  render(f: Frame) {
    const { ctx, gt } = f;
    const cQ = f.cue('quad');
    const cQs = f.cue('quads');
    const cT = f.cue('tris');
    const cE = f.cue('edit');

    titles(f, [{ c: cQ }, { c: cQs }, { c: cT }, { c: cE }]);

    // ---- положение сетки: справа от карточки → левее, освобождая место справа
    const move = easeInOutCubic(seg(cQs.t, 0, 0.8));
    const mcx = lerp(M1.cx, M2.cx, move);
    const msize = lerp(M1.size, M2.size, move);
    const yaw = YAW0 + Math.sin(gt * 0.35) * 0.28;
    const view: View = { cx: mcx, cy: M1.cy, size: msize, pitch: 0.22, yaw, dist: 6 };

    f.obj('tripo', { x: CARD.x + CARD.w / 2, y: CARD.y + CARD.h / 2, abs: true, text: 'Tripo P2.0', label: 'Tripo P2.0' }, (o) => {
      const p = seg(cQ.t, 0.2, 0.6);
      const out = seg(cQs.t, 0, 0.5);
      if (p <= 0 || out >= 1) return;
      ctx.save();
      ctx.globalAlpha *= 1 - out;
      ctx.translate(-80 * easeOutQuart(out), 0);
      toolCard(ctx, CARD.x, CARD.y, CARD.w, CARD.h, { name: o.text, icon: 'cube', color: C.h1, p, active: seg(cQ.p, 0.3, 0.2), t: gt });
      arrow(ctx, CARD.x + CARD.w + 20, CARD.y + CARD.h / 2, M1.cx - M1.size - 20, CARD.y + CARD.h / 2 + 90, seg(cQ.p, 0.25, 0.15), {
        color: C.h1,
        width: 5,
        head: 20,
      });
      ctx.restore();
    });

    // ---- сама сетка
    const build = seg(cQ.p, 0.25, 0.6);
    const trisP = seg(cT.p, 0.05, 0.55);
    const trisOut = seg(cE.t, 0, 0.6);
    const editK = seg(cE.t, 0.2, 0.6);
    const loopRow = 6;
    const slideK = editK * 0.8 * Math.sin((cE.t - 0.2) * 2.2);

    f.obj('mesh', { x: M2.cx, y: M1.cy, abs: true, label: 'Квадовая сетка' }, () => {
      if (build <= 0) return;
      softLight(ctx, mcx, M1.cy, msize * 1.6, C.h1, 0.1);
      // подсветка квадов: волна по сетке на «четырёхугольниках»
      const marks = new Map<string, string>();
      if (cQs.began && !cT.began) {
        const k = seg(cQs.p, 0, 0.9);
        for (let n = 0; n < 9; n++) {
          const j = 3 + ((n * 5) % 12);
          const i = (PICK.i - 4 + ((n * 7) % 9) + NU) % NU;
          if (k * 9 > n) marks.set(`${j}:${i}`, C.accent);
        }
      }
      if (cQs.began && trisP < 0.5) marks.set(`${PICK.j}:${PICK.i}`, C.accent);
      const surf = editK > 0 ? slide(HEAD, loopRow, slideK) : HEAD;
      drawSurf(ctx, surf, view, {}, {
        fill: CLAY,
        wire: a(C.bg, 0.6),
        width: 1.8,
        p: build,
        marks,
        loops: editK > 0 ? [loopRow] : [],
        loopColor: C.accent,
        loopWidth: 5,
      });
      // диагонали пробегают по сетке слева направо
      const triVis = trisP * (1 - trisOut);
      if (triVis > 0) {
        const x0 = mcx - msize * 1.25;
        const x1 = mcx + msize * 1.25;
        const sx = lerp(x0, x1, easeInOutCubic(trisP));
        ctx.save();
        ctx.globalAlpha *= 1 - trisOut;
        ctx.beginPath();
        ctx.rect(x0 - 50, M1.cy - msize * 1.5, sx - x0 + 50, msize * 3);
        ctx.clip();
        drawSurf(ctx, HEAD, view, {}, { fill: null, wire: 'rgba(0,0,0,0)', tris: true, triColor: a(C.h1, 0.95), width: 2.2 });
        ctx.restore();
        if (trisP < 1) {
          ctx.save();
          ctx.globalAlpha *= 1 - trisOut;
          const g = ctx.createLinearGradient(sx - 60, 0, sx, 0);
          g.addColorStop(0, a(C.h1, 0));
          g.addColorStop(1, a(C.h1, 0.35));
          ctx.fillStyle = g;
          ctx.fillRect(sx - 60, M1.cy - msize * 1.25, 60, msize * 2.5);
          ctx.fillStyle = C.h1;
          ctx.fillRect(sx - 2, M1.cy - msize * 1.25, 4, msize * 2.5);
          ctx.restore();
        }
      }
    });

    // ---- крупный квад: 4 вершины → два треугольника
    const bigP = seg(cQs.t, 0.4, 0.6) * (1 - seg(cE.t, 0, 0.5));
    f.obj('bigquad', { x: BIG.cx, y: BIG.cy, abs: true, label: 'Крупный квад' }, () => {
      if (bigP <= 0) return;
      // пунктир от квада на сетке к крупному
      const r = HEAD.pts;
      const j = PICK.j;
      const i = PICK.i;
      const c: V3 = [
        (r[j][i][0] + r[j][i + 1][0] + r[j + 1][i][0] + r[j + 1][i + 1][0]) / 4,
        (r[j][i][1] + r[j][i + 1][1] + r[j + 1][i][1] + r[j + 1][i + 1][1]) / 4,
        (r[j][i][2] + r[j][i + 1][2] + r[j + 1][i][2] + r[j + 1][i + 1][2]) / 4,
      ];
      const [px, py] = toScreen(c, view);
      ctx.save();
      ctx.globalAlpha *= easeOutQuart(bigP) * 0.8;
      ctx.setLineDash([12, 10]);
      ctx.strokeStyle = a(C.accent, 0.7);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(BIG.cx - BIG.s * 0.55, BIG.cy);
      ctx.stroke();
      ctx.restore();
      bigQuad(ctx, BIG.cx, BIG.cy, BIG.s * 1.5, bigP, seg(cT.p, 0.1, 0.3), gt);
    });

    // ---- сгиб конечности с лупами
    const limbP = seg(cE.t, 0.3, 0.7);
    f.obj('limb', { x: LIMB.cx, y: LIMB.cy, abs: true, label: 'Сгиб конечности' }, () => {
      if (limbP <= 0) return;
      appear(
        ctx,
        limbP,
        () => {
          const bend = 1.3 * (0.5 - 0.5 * Math.cos((cE.t - 0.3) * 2.4));
          const lv: View = { cx: LIMB.cx - 60, cy: LIMB.cy - 10, size: 235, pitch: 0.12, yaw: -1.25, dist: 7 };
          softLight(ctx, LIMB.cx, LIMB.cy, 440, C.pos, 0.12);
          drawSurf(ctx, limbSurf(14, 16, bend, 0.42, 0.1), lv, {}, {
            fill: OGRE,
            wire: a(C.bg, 0.5),
            width: 1.6,
            loops: [7, 8, 9],
            loopColor: C.pos,
            loopWidth: 4.5,
          });
        },
        { dx: 60 },
      );
    });
  },
};
