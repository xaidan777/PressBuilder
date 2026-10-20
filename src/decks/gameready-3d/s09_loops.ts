/**
 * Сцена 9. Edge Loops.
 *   1. хай-поли → ретопология: плотная треугольная сетка превращается в чистые
 *      квады — и весь путь перечёркивается (автор его не рекомендует).
 *   2. Tripo P2.0 сразу даёт квады: сгибающаяся конечность с кольцами edge loops
 *      у сгиба; рядом огр игры со скелетом — на «сгибах» вспыхивают локти и колени, огр шагает.
 *   3. В окне Tripo P2.0 включается Quad Mesh; справа плотная квадовая сетка
 *      с предупреждением, затем гаечный ключ — техническая обработка впереди.
 */

import { clamp01, easeInOutCubic, easeOutQuart, fmtNum, lerp, seg } from '../../engine/anim.ts';
import { arrow, shockRing, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import {
  appear,
  CLAY,
  checkBadge,
  crossBadge,
  drawBones,
  drawModel,
  groundShadow,
  IDLE,
  mage,
  ogrePose,
  strike,
  titles,
  toScreen,
  viewport,
  type Rect,
  type View,
} from './common.ts';
import { hexIcon, inset, lerpRect, plate, toggle, tripoWindow } from './kit_C.ts';
import { FACES } from './faces.ts';
import { drawFace, drawLoops, faceView, focusRings, hiLoupe } from './kit_face.ts';

/** Хай-поли: очень плотная сетка, рисуется треугольниками. */
/** Маг из assets: сетка из Tripo — треугольниками (как хай-поли) и квадами (как после ретопологии). */
const MAGE_REST = mage(IDLE, { rest: true }).parts;
const MJ = mage(IDLE, { jointsOnly: true }).joints;
const dist3 = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
const THIGH = dist3(MJ.hipL, MJ.kneeL);
const SHIN = dist3(MJ.kneeL, MJ.footL);

/** Присед с подъёмом рук: локти и колени гнутся, стопы стоят на месте (без шага и скольжения). */
function flexPose(k: number) {
  const a0 = 0.55 * k;
  return {
    ...IDLE,
    legL: a0,
    legR: a0,
    kneeL: 2 * a0,
    kneeR: 2 * a0,
    bob: -(THIGH + SHIN) * (1 - Math.cos(a0)),
    lean: 0.3 * a0,
    armL: 0.25 + 0.6 * k,
    armR: 0.25 + 0.6 * k,
    elbowL: 0.3 + 1.7 * k,
    elbowR: 0.3 + 1.7 * k,
  };
}
/** После ретопологии: чистые квады той же формы. */
/** Квады — но всё такая же плотная сетка. */

const L1: Rect = { x: 150, y: 320, w: 690, h: 640 };
const R1: Rect = { x: 1080, y: 320, w: 690, h: 640 };
const HI_SOLO: Rect = { x: 510, y: 300, w: 900, h: 720 };

/** Окно Tripo P2.0 (этапы 2–3). */
const WIN: Rect = { x: 150, y: 300, w: 860, h: 740 };
const ROW_Y = WIN.y + WIN.h - 72;
const TOGGLE_X = WIN.x + WIN.w - 120;

/** Правая половина этапов 2–3. */
const RIGHT = { x: 1420, y: 660 };


export const scene09: SceneDef = {
  id: 's09',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cH = f.cue('highpoly');
    const cR = f.cue('retopo');
    const cL = f.cue('loops');
    const cB = f.cue('bends');
    const cM = f.cue('mode');
    const cN = f.cue('notopt');
    const cP = f.cue('process');

    titles(f, [{ c: cH }, { c: cR }, { c: cL }, { c: cN }, { c: cP, color: C.h1 }]);

    // ---------------------------------------------------------------- этап 1: хай-поли → ретопология
    const out1 = easeInOutCubic(seg(cL.t, -0.3, 0.8));
    const crossed = seg(cR.t, 3.0, 0.6);
    const dim1 = 0.35 * crossed;

    const stage1 = (fn: () => void) => {
      if (out1 >= 1) return;
      ctx.save();
      ctx.globalAlpha *= (1 - out1) * (1 - dim1);
      ctx.translate(0, -90 * out1);
      fn();
      ctx.restore();
    };

    // пока звучит «хай-поли» — сетка крупно по центру, на «ретопологии» отъезжает влево
    const toLeft = easeInOutCubic(seg(cR.t, -0.1, 0.8));
    const hiR: Rect = lerpRect(HI_SOLO, L1, toLeft);
    f.obj('hi', { x: hiR.x + hiR.w / 2, y: hiR.y + hiR.h / 2, abs: true, label: 'Хай-поли' }, () =>
      stage1(() => {
        const p = seg(cH.t, 0, 0.8);
        appear(
          ctx,
          p,
          () => {
            viewport(ctx, hiR, () => {
              const cx = hiR.x + hiR.w / 2;
              const cy = hiR.y + hiR.h / 2 + 10;
              softLight(ctx, cx, cy, 420, C.h1, 0.12);
              void cy;
              drawFace(ctx, 'hi', hiR, { p: seg(cH.t, 0.1, 1.4) });
              // число граней хай-поли — как в окне Tripo
              const np = seg(cH.t, 0.9, 0.6);
              if (np > 0) {
                ctx.save();
                ctx.globalAlpha *= np;
                text(ctx, fmtNum(FACES.hi.faces), hiR.x + hiR.w - 28, hiR.y + hiR.h - 30, { size: 58, family: 'mono', align: 'right', color: C.accent });
                ctx.restore();
              }
            });
            // лупа — снаружи рамки, справа: глаза и рот остаются открытыми
            hiLoupe(ctx, faceView(hiR), hiR, seg(cH.t, 1.4, 0.7) * (1 - toLeft), gt);
          },
          { from: 0.9, cx: hiR.x + hiR.w / 2, cy: hiR.y + hiR.h / 2 },
        );
      }),
    );

    // стрелка «ретопология в Tripo»
    const arrowP = seg(cR.t, 0.1, 0.8);
    f.obj('arrow', { x: 960, y: 640, abs: true, label: 'Стрелка' }, () =>
      stage1(() => {
        arrow(ctx, L1.x + L1.w + 24, 640, R1.x - 24, 640, arrowP, { color: C.accent, width: 7, head: 26 });
      }),
    );
    f.obj('tool', { x: 960, y: 560, text: 'Tripo', label: 'Плашка Tripo' }, (o) =>
      stage1(() => {
        const p = seg(cR.t, 0.5, 0.5);
        if (p <= 0) return;
        ctx.save();
        ctx.globalAlpha *= clamp01(p * 2);
        plate(ctx, o.text, 0, 0, { color: C.h1, size: 50, icon: 'hex', t: gt });
        ctx.restore();
      }),
    );

    f.obj('lo', { x: R1.x + R1.w / 2, y: R1.y + R1.h / 2, abs: true, label: 'Ретопология' }, () =>
      stage1(() => {
        const p = seg(cR.t, 0.6, 0.8);
        appear(
          ctx,
          p,
          () => {
            viewport(ctx, R1, () => {
              const cx = R1.x + R1.w / 2;
              const cy = R1.y + R1.h / 2 + 10;
              softLight(ctx, cx, cy, 380, C.h1, 0.12);
              void cy;
              const view = drawFace(ctx, 'retopo', R1, { p: seg(cR.t, 0.8, 1.0), yaw: Math.sin(gt * 0.5) * 0.18 });
              // фокус: вокруг рта и глаз колец нет — сетка идёт сквозь них
              focusRings(ctx, 'retopo', view, seg(cR.t, 1.6, 1.0), a(C.accent, 0.9), gt);
              drawLoops(ctx, 'retopo', view, seg(cR.t, 2.1, 1.0), '#ff6a4d');
              const np = seg(cR.t, 1.2, 0.6);
              if (np > 0) {
                ctx.save();
                ctx.globalAlpha *= np;
                text(ctx, fmtNum(FACES.retopo.faces), R1.x + R1.w - 28, R1.y + R1.h - 30, { size: 58, family: 'mono', align: 'right', color: C.text });
                ctx.restore();
              }
            });
          },
          { dx: -60 },
        );
      }),
    );

    // весь путь перечёркнут
    f.obj('strike', { x: 960, y: 640, abs: true, label: 'Зачёркивание' }, () => {
      if (out1 >= 1 || crossed <= 0) return;
      ctx.save();
      ctx.globalAlpha *= 1 - out1;
      ctx.translate(0, -90 * out1);
      strike(ctx, 190, 930, 1730, 350, crossed, C.accent, 12);
      crossBadge(ctx, 960, 760, 62, seg(crossed, 0.5, 0.5));
      ctx.restore();
    });

    // ---------------------------------------------------------------- этапы 2–3: окно Tripo P2.0
    const in2 = seg(cL.t, 0, 0.8);
    const toMode = easeInOutCubic(seg(cM.t, -0.2, 0.7));
    const on = seg(cM.t, 1.6, 0.35);
    const warn = seg(cN.t, 0, 0.6);
    const fix = seg(cP.t, 0, 0.6);

    f.obj('window', { x: WIN.x + WIN.w / 2, y: WIN.y + WIN.h / 2, abs: true, label: 'Окно Tripo P2.0' }, () => {
      appear(
        ctx,
        in2,
        () => {
          const area = tripoWindow(ctx, WIN, gt, { glow: on * (1 - warn) });
          // на «этом режиме» снизу освобождается строка переключателя
          const full = inset(area, 14);
          const vp: Rect = { ...full, h: full.h - 130 * toMode };
          viewport(
            ctx,
            vp,
            () => {
              softLight(ctx, vp.x + vp.w / 2, vp.y + vp.h / 2, 380, C.h1, 0.1);
              const view = drawFace(ctx, 'p2', vp, { p: seg(cL.t, 0.2, 1.0), yaw: Math.sin(gt * 0.5) * 0.18 });
              drawLoops(ctx, 'p2', view, seg(cL.t, 1.6, 2.4), C.pos);
              checkBadge(ctx, vp.x + vp.w - 46, vp.y + 46, 36, seg(cL.t, 4.2, 0.5));
            },
            { frame: false },
          );
        },
        { dy: 60 },
      );
    });

    // строка «Quad Mesh» с переключателем
    f.obj('quad', { x: WIN.x + 50, y: ROW_Y + 22, text: 'Quad Mesh', label: 'Quad Mesh' }, (o) => {
      if (toMode <= 0) return;
      ctx.save();
      ctx.globalAlpha *= toMode;
      text(ctx, o.text, 0, 0, { size: 66, color: on > 0.5 ? C.pos : C.text, caps: 'normal', tracking: 1 });
      ctx.restore();
    });
    f.obj('toggle', { x: TOGGLE_X, y: ROW_Y, abs: true, label: 'Переключатель' }, () => {
      if (toMode <= 0) return;
      ctx.save();
      ctx.globalAlpha *= toMode;
      toggle(ctx, TOGGLE_X, ROW_Y, 64, on, C.pos);
      shockRing(ctx, TOGGLE_X, ROW_Y, seg(cM.t, 1.6, 0.8), 170, C.pos, 4);
      ctx.restore();
    });
    // курсор подъезжает и щёлкает
    f.obj('cursor', { x: TOGGLE_X, y: ROW_Y, abs: true, label: 'Курсор' }, () => {
      const p = seg(cM.t, 0.5, 2.6);
      if (p <= 0 || p >= 1) return;
      const mv = easeInOutCubic(seg(cM.t, 0.6, 0.9));
      const x = lerp(TOGGLE_X - 300, TOGGLE_X + 14, mv);
      const y = lerp(ROW_Y - 260, ROW_Y + 16, mv);
      const press = seg(cM.t, 1.5, 0.1) - seg(cM.t, 1.65, 0.15);
      ctx.save();
      ctx.globalAlpha *= Math.min(1, p * 8, (1 - p) * 6);
      icon(ctx, 'cursor', x, y, 70 * (1 - 0.15 * press), C.text);
      ctx.restore();
    });

    // ---------------------------------------------------------------- справа: огр со скелетом → плотная сетка
    const ogreOut = seg(cM.t, 0.4, 0.8);
    f.obj('ogre', { x: RIGHT.x, y: RIGHT.y, abs: true, label: 'Персонаж со скелетом' }, () => {
      const p = seg(cL.t, 0.6, 0.9);
      if (p <= 0 || ogreOut >= 1) return;
      ctx.save();
      ctx.globalAlpha *= 1 - ogreOut;
      ctx.translate(60 * ogreOut, 0);
      appear(
        ctx,
        p,
        () => {
          const flex = easeInOutCubic(seg(cB.t, 0, 0.6)) * (0.5 - 0.5 * Math.cos(gt * 1.8));
          const pose = flex > 0 ? flexPose(flex) : ogrePose('idle', gt * 0.4);
          const model = mage(pose);
          const view: View = { cx: RIGHT.x, cy: 1000, size: 255, pitch: 0.12, yaw: -0.55, dist: 9 };
          softLight(ctx, RIGHT.x, 640, 420, cB.began ? C.accent : C.h1, 0.1);
          groundShadow(ctx, view, 0, 0, 1.0, 0.8, 0.45);
          ctx.save();
          ctx.globalAlpha *= 1 - 0.35 * seg(cL.t, 2.4, 0.6);
          drawModel(ctx, model.parts, view, {}, { wire: a(C.bg, 0.35), wireWidth: 1 });
          ctx.restore();
          drawBones(ctx, model.joints, view, {}, {
            p: seg(cL.t, 2.2, 1.6),
            color: C.h1,
            focus: cB.began ? ['elbowL', 'elbowR', 'kneeL', 'kneeR'] : [],
            focusColor: C.accent,
            t: gt,
          });
          // вспышки на сгибах
          if (cB.began) {
            for (const [k, j] of (['elbowL', 'elbowR', 'kneeL', 'kneeR'] as const).entries()) {
              const [x, y] = toScreen(model.joints[j], view);
              shockRing(ctx, x, y, seg(cB.t, 0.15 + k * 0.18, 0.9), 90, C.accent, 4);
            }
          }
        },
        { dx: 60 },
      );
      ctx.restore();
    });

    f.obj('dense', { x: RIGHT.x, y: RIGHT.y, abs: true, label: 'Плотная квадовая сетка' }, () => {
      const p = seg(cM.t, 1.9, 0.9);
      if (p <= 0) return;
      appear(
        ctx,
        p,
        () => {
          const view: View = { cx: RIGHT.x, cy: RIGHT.y + 330, size: 290, pitch: 0.12, yaw: gt * 0.3 + 0.6, dist: 9 };
          softLight(ctx, RIGHT.x, RIGHT.y, 440, warn > 0 && fix <= 0 ? C.accent : C.h1, 0.12 + 0.06 * warn);
          const wireCol = fix > 0 ? a(C.h1, 0.55) : warn > 0 ? a(C.accent, 0.35 + 0.15 * warn) : a(C.bg, 0.55);
          drawModel(ctx, MAGE_REST, view, {}, { tint: CLAY, wire: wireCol, wireWidth: 0.9 });
          // техническая обработка: по модели проходит полоса сканирования
          if (fix > 0) {
            const top = RIGHT.y - 320;
            const sy = top + 640 * ((cP.t * 0.5) % 1);
            const g = ctx.createLinearGradient(0, sy - 70, 0, sy + 4);
            g.addColorStop(0, a(C.h1, 0));
            g.addColorStop(1, a(C.h1, 0.35 * fix));
            ctx.fillStyle = g;
            ctx.fillRect(RIGHT.x - 330, sy - 70, 660, 74);
            ctx.fillStyle = a(C.h1, 0.85 * fix);
            ctx.fillRect(RIGHT.x - 330, sy, 660, 4);
          }
        },
        { from: 0.85, cx: RIGHT.x, cy: RIGHT.y },
      );
    });

    // квадраты — ещё не оптимизация
    f.obj('warn', { x: RIGHT.x + 250, y: RIGHT.y - 250, abs: true, label: 'Предупреждение' }, () => {
      const p = warn * (1 - seg(cP.t, 0, 0.4));
      if (p <= 0) return;
      const x = RIGHT.x + 250;
      const y = RIGHT.y - 250;
      ctx.save();
      ctx.globalAlpha *= clamp01(p * 2);
      softLight(ctx, x, y, 150, C.accent, 0.2 + 0.08 * Math.sin(gt * 4));
      hexIcon(ctx, 'warning', x, y, 74 * (0.7 + 0.3 * easeOutQuart(p)), C.accent, gt, 0.6 + 0.4 * Math.sin(gt * 4));
      ctx.restore();
    });

    // техническая обработка впереди
    f.obj('wrench', { x: RIGHT.x + 250, y: RIGHT.y - 250, abs: true, label: 'Гаечный ключ' }, () => {
      if (fix <= 0) return;
      const x = RIGHT.x + 250;
      const y = RIGHT.y - 250;
      ctx.save();
      ctx.globalAlpha *= clamp01(fix * 2);
      softLight(ctx, x, y, 170, C.h1, 0.22);
      shockRing(ctx, x, y, seg(cP.t, 0.1, 0.9), 220, C.h1, 4);
      ctx.translate(x, y);
      ctx.rotate(Math.sin(gt * 3) * 0.2 * fix);
      hexIcon(ctx, 'wrench', 0, 0, 84 * (0.7 + 0.3 * easeOutQuart(fix)), C.h1, gt, 0.8);
      ctx.restore();
    });
  },
};
