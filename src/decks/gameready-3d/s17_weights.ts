/**
 * Сцена 17. Риг: в окне Blender на огре прорастает скелет и веса вершин.
 * На «локти, колени, плечи» суставы вспыхивают, огр сгибает руки и ноги;
 * на «некрасиво деформирует» справа сгиб руки с перетянутой сеткой.
 */

import { clamp01, lerp, seg } from '../../engine/anim.ts';
import { softLight } from '../../engine/draw.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import {
  appear,
  checkBadge,
  crossBadge,
  drawBones,
  drawModel,
  drawSurf,
  groundShadow,
  titles,
  limbSurf,
  OGRE,
  ogre,
  ogrePose,
  viewport,
  windowFrame,
  type Part,
  type View,
  circleGait,
} from './common.ts';

const WIN = { x: 150, y: 290, w: 980, h: 750 };
const SIDE = { x: 1200, y: 320, w: 570, h: 560 };

/** Веса вершин: цвет части по «близости» к выбранной кости (правая рука). */
const WEIGHT: Record<string, string> = {
  armR: '#ff5a3c',
};
const COLD = '#2a46c8';
/** Шкала весов, как в weight paint: от нуля (синий) до единицы (красный). */
const WEIGHT_RAMP = [COLD, '#51d3ff', '#b5db41', '#ffcf75', '#ff5a3c'];

export const scene17: SceneDef = {
  id: 's17',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cW = f.cue('weights');
    const cB = f.cue('bends');
    const cD = f.cue('deform');

    titles(f, [{ c: cW }, { c: cB }, { c: cD }]);

    // поза: стоит → на «сгибах» идёт по кругу (путь из шага, стопы не скользят)
    const cg = circleGait((cB.t - 0.2) * 0.55);
    const pose = cg.walking ? cg.pose : ogrePose('idle', gt * 0.4);
    const root17 = cg.root;
    const model = ogre(pose);
    const paint = seg(cW.p, 0.55, 0.25) * (1 - seg(cB.t, 0, 0.5));
    const parts: Part[] = model.parts.map((pt) => ({
      ...pt,
      color: paint > 0.5 ? (WEIGHT[pt.tag ?? ''] ?? COLD) : undefined,
    }));

    f.obj('blender', { x: WIN.x + WIN.w / 2, y: WIN.y + WIN.h / 2, abs: true, label: 'Окно Blender' }, () => {
      appear(
        ctx,
        seg(cW.t, -0.2, 0.6),
        () => {
          const area = windowFrame(ctx, WIN.x, WIN.y, WIN.w, WIN.h, { title: 'Blender', icon: 'cube', t: gt });
          viewport(
            ctx,
            { x: area.x + 14, y: area.y + 14, w: area.w - 28, h: area.h - 28 },
            () => {
              const view: View = { cx: WIN.x + WIN.w / 2, cy: WIN.y + WIN.h - 96, size: 196, pitch: 0.18, yaw: 0.5 + Math.sin(gt * 0.3) * 0.35, dist: 9 };
              softLight(ctx, view.cx, view.cy - 260, 420, C.h1, 0.12);
              groundShadow(ctx, view, root17.pos![0], root17.pos![2], 0.9, 0.7, 0.4);
              ctx.save();
              ctx.globalAlpha *= 1 - 0.3 * seg(cW.p, 0.1, 0.2) * (1 - paint);
              drawModel(ctx, parts, view, root17, { edge: a(C.bg, 0.35) });
              ctx.restore();
              drawBones(ctx, model.joints, view, root17, {
                p: seg(cW.p, 0.08, 0.5),
                color: C.h1,
                focus: cB.began ? ['elbowL', 'elbowR', 'kneeL', 'kneeR', 'shoulderL', 'shoulderR'] : [],
                t: gt,
              });
            },
            { frame: false },
          );
        },
        { dy: 40 },
      );
    });

    // справа крупный план руки: веса вершин → чистый сгиб → сгиб с перетянутой сеткой
    const sp = seg(cW.p, 0.5, 0.25);
    const bad = seg(cD.t, 0, 0.6);
    f.obj('arm', { x: SIDE.x + SIDE.w / 2, y: SIDE.y + SIDE.h / 2, abs: true, label: 'Сгиб руки' }, () => {
      appear(
        ctx,
        sp,
        () => {
          viewport(ctx, SIDE, () => {
            const swing = 0.5 + 0.5 * Math.sin(gt * 1.6);
            const bend = 1.25 * swing * Math.max(seg(cB.t, 0, 0.6), bad);
            const view: View = { cx: SIDE.x + SIDE.w / 2 - 30, cy: SIDE.y + SIDE.h / 2 - 20, size: 170, pitch: 0.15, yaw: -1.2, dist: 7 };
            // пока звучат веса — сетка раскрашена по влиянию кости локтя
            const marks = new Map<string, string>();
            if (!cB.began) {
              for (let j = 0; j < 16; j++) {
                const w = Math.max(0, 1 - Math.abs(j - 7.5) / 6);
                const col = WEIGHT_RAMP[Math.min(WEIGHT_RAMP.length - 1, Math.floor(w * WEIGHT_RAMP.length))];
                for (let i = 0; i < 14; i++) marks.set(`${j}:${i}`, col);
              }
            }
            // «плохой» риг: у сгиба сетка сжимается (отрицательное утолщение)
            drawSurf(ctx, limbSurf(14, 16, bend, 0.42, lerp(0.08, -0.6 * clamp01(bend), bad)), view, {}, {
              fill: OGRE,
              wire: a(C.bg, 0.5),
              marks,
              loops: cB.began ? [7, 8, 9] : [],
              loopColor: bad > 0.5 ? C.accent : C.pos,
            });
          });
          checkBadge(ctx, SIDE.x + SIDE.w - 40, SIDE.y + 40, 40, seg(cB.t, 0.8, 0.5) * (1 - bad));
          crossBadge(ctx, SIDE.x + SIDE.w - 40, SIDE.y + 40, 40, seg(cD.t, 0.6, 0.5));
        },
        { dx: 60 },
      );
    });
  },
};
