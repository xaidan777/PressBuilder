/**
 * Сцена 11. Постановка задачи.
 *   1. Промпт печатает «Сделай модель лучше» — и перечёркивается. Вместо него
 *      четыре карточки-вопроса: для какой игры (прицел), с какого расстояния
 *      (глаз и огр вдали), что двигается (огр с подсвеченными руками и ногами),
 *      какой бюджет (полоса треугольников с лимитом).
 *   2. Пример: top-down арена — огр идёт на танк игрока. Силуэт огра обводится,
 *      справа крупно: упрощённая версия держит тот же силуэт, треугольников меньше,
 *      затем скелет — руки, ноги, корпус.
 *   3. «Портфолио» (огр на постаменте под софтбоксами) гаснет, игровая сцена — в акценте.
 *   4. Проверяйте сами: грубая автоматическая оптимизация съела шипы наплечников —
 *      призрак исходного силуэта, пунктирные круги, предупреждение.
 */

import { clamp01, easeInOutCubic, easeOutQuart, lerp, seg } from '../../engine/anim.ts';
import { arrow, panel, rrPath, shockRing, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import { MESH } from '../../engine/wire3d.ts';
import {
  appear,
  camSpace,
  checkBadge,
  crossBadge,
  decimate,
  drawBones,
  drawModel,
  groundShadow,
  hero,
  ogrePose,
  prop,
  promptBox,
  strike,
  tankParts,
  titles,
  toScreen,
  triCount,
  viewport,
  type Part,
  type Rect,
  type Root,
  type View,
} from './common.ts';
import { budgetBar, dashRing, grassFloor, groundRing, hexIcon, highlight, sayAt, silhouette, SPIKES } from './kit_C.ts';

type Ctx = CanvasRenderingContext2D;

const PROMPT = { x: 150, y: 520, w: 1020 };
/** Модель, которую «просят улучшить». */
const SUBJ = { x: 1470, y: 990 };

/** Карточки-вопросы этапа 1. */
const CARD_W = 375;
const CARD_H = 560;
const CARD_Y = 360;
const cardX = (i: number) => 150 + i * (CARD_W + 40);
/** Карточки-вопросы рисуются в исходных координатах и ужимаются в сетку 2×2 справа. */
const QS = 0.55;
const QW = CARD_W * QS;
const QH = CARD_H * QS;
const QX = (i: number) => 1770 - 2 * QW - 26 + (i % 2) * (QW + 26);
const QY = (i: number) => 338 + Math.floor(i / 2) * (QH + 26);

/** Правильный промпт — обычный текст в поле ввода, как его пишут агенту. */
const GOOD_PROMPT =
  'Доработай модель для движка игры. Проверь геометрию на дыры. Убери лишние вертексы. Проверь симметрию и корректность edge loops и нормали.';
const GP = { x: 150, w: 1100 };

/** Этап 2: арена и крупный план. */
const AR: Rect = { x: 150, y: 300, w: 1000, h: 740 };
const ZOOM: Rect = { x: 1200, y: 300, w: 570, h: 740 };

/** Этап 3: портфолио против игры. */
const PF: Rect = { x: 150, y: 320, w: 790, h: 700 };
const GS: Rect = { x: 980, y: 320, w: 790, h: 700 };

/** Этап 4: исходная модель и автоматически упрощённая. */
const LEFT = { x: 600, y: 960 };
const RIGHT = { x: 1370, y: 960 };

const FULL = hero('elf').parts;
const FULL_TRIS = triCount(FULL);

interface Placed {
  parts: Part[];
  root: Root;
}

/** Модели сцены по глубине (дальние — первыми). */
function drawScene(ctx: Ctx, list: Placed[], view: View): void {
  const z = (p: Placed) => camSpace(p.root.pos ?? [0, 0, 0], view)[2];
  for (const it of [...list].sort((p, q) => z(p) - z(q))) {
    groundShadow(ctx, view, it.root.pos?.[0] ?? 0, it.root.pos?.[2] ?? 0, 0.9 * (it.root.scale ?? 1), 0.7 * (it.root.scale ?? 1), 0.4);
    drawModel(ctx, it.parts, view, it.root);
  }
}

export const scene11: SceneDef = {
  id: 's11',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cT = f.cue('task');
    const cB = f.cue('better');
    const cE = f.cue('explain');
    const cBu = f.cue('budget');
    const cEn = f.cue('enemy');
    const cK = f.cue('keep');
    const cG = f.cue('goal');
    const cCh = f.cue('check');
    const cL = f.cue('lost');

    titles(f, [{ c: cT }, { c: cEn }, { c: cK }, { c: cG, color: C.pos }, { c: cCh }]);

    // ---------------------------------------------------------------- этап 1: промпт
    const promptOut = easeInOutCubic(seg(cE.t, -0.1, 0.6));
    const typed = seg(cB.t, 0.3, 1.6);
    const struck = seg(cB.t, 2.3, 0.5);
    f.obj('prompt', { x: PROMPT.x, y: PROMPT.y, abs: true, text: 'Сделай модель лучше', label: 'Промпт' }, (o) => {
      if (promptOut >= 1) return;
      appear(
        ctx,
        seg(cT.t, 0.3, 0.6),
        () => {
          ctx.save();
          ctx.globalAlpha *= 1 - promptOut;
          ctx.translate(0, -80 * promptOut);
          const h = promptBox(ctx, o.text, PROMPT.x, PROMPT.y, PROMPT.w, { p: typed, size: 92, gt, color: C.h1 });
          if (struck > 0) {
            strike(ctx, PROMPT.x + 110, PROMPT.y + h / 2, PROMPT.x + PROMPT.w - 60, PROMPT.y + h / 2 - 6, struck, C.accent, 10);
            crossBadge(ctx, PROMPT.x + PROMPT.w, PROMPT.y, 54, seg(cB.t, 2.6, 0.5));
          }
          ctx.restore();
        },
        { dy: 40 },
      );
    });

    f.obj('subject', { x: SUBJ.x, y: SUBJ.y - 260, abs: true, label: 'Модель' }, () => {
      if (promptOut >= 1) return;
      appear(
        ctx,
        seg(cT.t, 0.6, 0.8),
        () => {
          ctx.save();
          ctx.globalAlpha *= 1 - promptOut;
          const view: View = { cx: SUBJ.x, cy: SUBJ.y, size: 225, pitch: 0.12, yaw: -0.5 + Math.sin(gt * 0.4) * 0.4, dist: 9 };
          softLight(ctx, SUBJ.x, SUBJ.y - 260, 420, C.h1, 0.12);
          groundShadow(ctx, view, 0, 0, 1.0, 0.8, 0.45);
          drawModel(ctx, FULL, view);
          ctx.restore();
        },
        { dx: 60 },
      );
    });

    // ---------------------------------------------------------------- этап 1: правильный промпт
    const goodIn = seg(cE.t, 0.15, 0.7);
    const goodOut = easeInOutCubic(seg(cEn.t, -0.2, 0.7));
    const typedGood = seg(cE.t, 0.6, cE.dur + cBu.dur - 2.8);
    f.obj('good-prompt', { x: GP.x, y: 470, abs: true, text: GOOD_PROMPT, label: 'Правильный промпт' }, (o) => {
      if (goodIn <= 0 || goodOut >= 1) return;
      const sent = typedGood >= 1 ? seg(cBu.t, cBu.dur - 2.0, 0.5) : 0;
      ctx.save();
      ctx.globalAlpha *= 1 - goodOut;
      ctx.translate(-80 * goodOut, 0);
      appear(
        ctx,
        goodIn,
        () => {
          // поле ввода: текст печатается сплошным абзацем, как его пишут агенту
          const y0 = 440;
          softLight(ctx, GP.x + GP.w / 2, y0 + 170, GP.w * 0.6, C.h1, 0.06 + 0.08 * sent);
          const h = promptBox(ctx, o.text, GP.x, y0, GP.w, { p: typedGood, size: 64, gt, color: C.h1 });
          // кнопка отправки: загорается, когда текст набран, и «нажимается»
          const bx = GP.x + GP.w - 56;
          const by = y0 + h - 56;
          const ready = seg(typedGood, 0.98, 0.02);
          const press = sent > 0 && sent < 1 ? 1 - 0.12 * Math.sin(sent * Math.PI) : 1;
          ctx.save();
          ctx.translate(bx, by);
          ctx.scale(press, press);
          ctx.beginPath();
          ctx.arc(0, 0, 34, 0, Math.PI * 2);
          ctx.fillStyle = ready > 0 ? a(C.h1, 0.2 + 0.6 * ready) : a(C.text, 0.1);
          ctx.fill();
          ctx.restore();
          icon(ctx, 'telegram', bx, by, 40, ready > 0.5 ? C.bg : a(C.text, 0.4));
          shockRing(ctx, bx, by, sent, 120, C.h1, 3);
        },
        { dy: 40 },
      );
      ctx.restore();
    });

    // ---------------------------------------------------------------- этап 1: четыре вопроса
    const cardsOut = easeInOutCubic(seg(cEn.t, -0.2, 0.7));
    const cardAt = [
      seg(cE.t, sayAt(cE, 'для какой игры'), 0.6),
      seg(cE.t, sayAt(cE, 'с какого расстояния'), 0.6),
      seg(cBu.t, sayAt(cBu, 'какие части'), 0.6),
      seg(cBu.t, sayAt(cBu, 'полигональный бюджет'), 0.6),
    ];
    const cardFrame = (i: number, fn: (cx: number, cy: number) => void) => {
      // рамки встают сразу, содержимое — когда звучит вопрос
      const shown = seg(cE.t, 0.1 + i * 0.18, 0.6);
      const p = cardAt[i];
      if (shown <= 0 || cardsOut >= 1) return;
      const x = cardX(i);
      const cx = x + CARD_W / 2;
      const cy = CARD_Y + CARD_H / 2;
      ctx.save();
      ctx.globalAlpha *= 1 - cardsOut;
      ctx.translate(0, -60 * cardsOut);
      // карточка рисуется в своих координатах и ужимается в клетку сетки 2×2
      ctx.translate(QX(i) - x * QS, QY(i) - CARD_Y * QS);
      ctx.scale(QS, QS);
      appear(
        ctx,
        shown,
        () => {
          // текущий вопрос подсвечен, отвеченные остаются спокойными
          const live = p * (i < 3 ? 1 - seg(cardAt[i + 1], 0, 1) * 0.6 : 1);
          panel(ctx, x, CARD_Y, CARD_W, CARD_H, {
            fill: C.panel,
            stroke: a(C.accent, 0.2 + 0.5 * live),
            lineWidth: 2 + live,
            radius: 18,
            glow: a(C.accent, 0.04 + 0.18 * live),
            glowBlur: 46,
          });
          if (p > 0) {
            ctx.save();
            ctx.globalAlpha *= clamp01(p * 1.6);
            fn(cx, cy);
            ctx.restore();
          }
          // знак вопроса: пока вопрос не прозвучал — крупно в центре, потом в углу
          const k = easeInOutCubic(clamp01(p * 1.4));
          ctx.save();
          ctx.globalAlpha *= lerp(0.45, 0.6 + 0.4 * live, k);
          icon(
            ctx,
            'question',
            lerp(cx, x + CARD_W - 50, k),
            lerp(cy, CARD_Y + 52, k),
            lerp(130, 56 + 6 * live * Math.sin(gt * 4 + i), k),
            C.accent,
          );
          ctx.restore();
        },
        { dy: 50, from: 0.92, cx, cy },
      );
      ctx.restore();
    };

    f.obj('q:game', { x: QX(0) + QW / 2, y: QY(0) + QH / 2, abs: true, label: 'Для какой игры' }, () =>
      cardFrame(0, (cx, cy) => {
        softLight(ctx, cx, cy, 200, C.h1, 0.14);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.sin(gt * 0.8) * 0.15);
        hexIcon(ctx, 'crosshair', 0, 0, 120, C.h1, gt, 0.5);
        ctx.restore();
      }),
    );

    f.obj('q:dist', { x: QX(1) + QW / 2, y: QY(1) + QH / 2, abs: true, label: 'С какого расстояния' }, () =>
      cardFrame(1, (cx) => {
        // глаз и огр, который то приближается, то удаляется
        icon(ctx, 'eye', cx, CARD_Y + 150, 120, C.h1, gt);
        const k = 0.5 + 0.5 * Math.sin(gt * 1.1);
        const view: View = { cx, cy: CARD_Y + CARD_H - 70, size: lerp(42, 120, k), pitch: 0.1, yaw: -0.4, dist: 9 };
        groundShadow(ctx, view, 0, 0, 0.9, 0.6, 0.4);
        drawModel(ctx, FULL, view);
        // стрелка дистанции
        ctx.save();
        ctx.strokeStyle = a(C.h1, 0.6);
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 10]);
        ctx.beginPath();
        ctx.moveTo(cx, CARD_Y + 220);
        ctx.lineTo(cx, view.cy - 2.2 * view.size - 20);
        ctx.stroke();
        ctx.restore();
      }),
    );

    f.obj('q:move', { x: QX(2) + QW / 2, y: QY(2) + QH / 2, abs: true, label: 'Что двигается' }, () =>
      cardFrame(2, (cx) => {
        const pulse = 0.55 + 0.45 * Math.sin(gt * 4);
        const model = hero('elf', ogrePose('walk', gt * 0.8));
        const parts = highlight(model.parts, ['armL', 'armR', 'legL', 'legR'], C.accent, 0.35 + 0.45 * pulse);
        const view: View = { cx, cy: CARD_Y + CARD_H - 60, size: 175, pitch: 0.12, yaw: -0.5, dist: 9 };
        softLight(ctx, cx, CARD_Y + CARD_H / 2, 220, C.accent, 0.12);
        groundShadow(ctx, view, 0, 0, 0.9, 0.7, 0.4);
        drawModel(ctx, parts, view);
      }),
    );

    f.obj('q:budget', { x: QX(3) + QW / 2, y: QY(3) + QH / 2, abs: true, label: 'Бюджет треугольников' }, () =>
      cardFrame(3, (cx, cy) => {
        // «треугольники»: каркас огра, под ним полоса с лимитом
        const view: View = { cx, cy: cy + 70, size: 130, pitch: 0.12, yaw: -0.5 + gt * 0.3, dist: 9 };
        drawModel(ctx, FULL, view, {}, { tint: '#5f6670', wire: a(C.h1, 0.7), wireWidth: 1.2 });
        const fill = seg(cBu.t, sayAt(cBu, 'полигональный бюджет') + 0.3, 1.2);
        budgetBar(ctx, cardX(3) + 40, CARD_Y + CARD_H - 90, CARD_W - 80, 34, lerp(0, 0.66, easeOutQuart(fill)), 1, {
          limit: 0.7,
          p: fill > 0 ? 1 : 0,
        });
      }),
    );

    // ---------------------------------------------------------------- этап 2: арена top-down
    const in2 = seg(cEn.t, 0, 0.8);
    const out2 = easeInOutCubic(seg(cG.t, -0.2, 0.7));
    const arView: View = { cx: AR.x + AR.w / 2, cy: AR.y + AR.h / 2 + 30, size: 122, pitch: 1.0, yaw: 0, dist: Infinity };
    // огр идёт к танку: путь — функция времени реплики
    const walkT = Math.max(0, cEn.t + 0.4);
    const ogX = lerp(-2.4, -0.9, clamp01(walkT / 14));
    const ogZ = lerp(-2.6, -0.4, clamp01(walkT / 14));
    const tankPos: [number, number, number] = [0.9, 0, 2.0];
    const face = Math.atan2(tankPos[0] - ogX, tankPos[2] - ogZ);
    const outline = seg(cK.t, 0.2, 0.6);

    f.obj('arena', { x: AR.x + AR.w / 2, y: AR.y + AR.h / 2, abs: true, label: 'Арена top-down' }, () => {
      if (in2 <= 0 || out2 >= 1) return;
      ctx.save();
      ctx.globalAlpha *= 1 - out2;
      ctx.translate(-120 * out2, 0);
      appear(
        ctx,
        in2,
        () => {
          viewport(ctx, AR, () => {
            grassFloor(ctx, arView, AR, { tile: 6, alpha: 1, shade: 0.42 });
            // окружение
            const deco: Placed[] = [
              { parts: prop('rock'), root: { pos: [3.6, 0, -2.0], scale: 0.55 } },
              { parts: prop('bush'), root: { pos: [-3.6, 0, 1.6], scale: 0.7 } },
              { parts: prop('pine'), root: { pos: [3.9, 0, 1.6], scale: 0.6 } },
              { parts: prop('stump'), root: { pos: [-3.3, 0, -2.5], scale: 0.8 } },
            ];
            // кольцо цели под огром
            ctx.save();
            ctx.strokeStyle = a(C.accent, 0.85);
            ctx.lineWidth = 4;
            groundRing(ctx, arView, ogX, ogZ, 1.0 + 0.06 * Math.sin(gt * 5));
            ctx.stroke();
            ctx.strokeStyle = a(C.h1, 0.7);
            groundRing(ctx, arView, tankPos[0], tankPos[2], 1.4);
            ctx.stroke();
            ctx.restore();
            // трассеры танка
            const [tx, ty] = toScreen([tankPos[0], 0.9, tankPos[2]], arView);
            const [ox, oy] = toScreen([ogX, 1.2, ogZ], arView);
            for (let i = 0; i < 3; i++) {
              const k = (gt * 1.3 + i / 3) % 1;
              ctx.save();
              ctx.globalAlpha *= Math.sin(k * Math.PI);
              ctx.fillStyle = C.accent;
              ctx.shadowColor = a(C.accent, 0.9);
              ctx.shadowBlur = 14;
              ctx.beginPath();
              ctx.arc(lerp(tx, ox, k), lerp(ty, oy, k), 7, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
            const ogreParts = hero('elf', ogrePose('walk', gt * 0.9)).parts;
            const ogRoot: Root = { pos: [ogX, 0, ogZ], ry: face };
            const turret = Math.atan2(ogZ - tankPos[2], ogX - tankPos[0]);
            const list: Placed[] = [
              ...deco,
              { parts: tankParts({ turret: -turret - Math.PI / 2 }), root: { pos: tankPos, ry: Math.PI / 2 } },
            ];
            drawScene(ctx, list, arView);
            groundShadow(ctx, arView, ogX, ogZ, 0.9, 0.7, 0.45);
            if (outline > 0) {
              ctx.save();
              ctx.globalAlpha *= outline;
              silhouette(ctx, ogreParts, arView, ogRoot, { stroke: C.accent, width: 5 });
              ctx.restore();
            }
            drawModel(ctx, ogreParts, arView, ogRoot);
          });
        },
        { dy: 50 },
      );
      ctx.restore();
    });

    // крупный план: силуэт держится, треугольников меньше, затем скелет
    const zoomIn = seg(cEn.t, 1.2, 0.7);
    const cut = seg(cK.t, sayAt(cK, 'сократи'), 1.2);
    const rig = seg(cK.t, sayAt(cK, 'подготовь'), 1.2);
    const LOW = decimate(FULL, 0.05);
    const LOW_TRIS = triCount(LOW);
    f.obj('zoom', { x: ZOOM.x + ZOOM.w / 2, y: ZOOM.y + ZOOM.h / 2, abs: true, label: 'Крупный план' }, () => {
      if (zoomIn <= 0 || out2 >= 1) return;
      ctx.save();
      ctx.globalAlpha *= 1 - out2;
      ctx.translate(-120 * out2, 0);
      appear(
        ctx,
        zoomIn,
        () => {
          viewport(
            ctx,
            ZOOM,
            () => {
              const view: View = { cx: ZOOM.x + ZOOM.w / 2, cy: ZOOM.y + ZOOM.h - 170, size: 205, pitch: 0.1, yaw: -0.35, dist: 9 };
              softLight(ctx, view.cx, ZOOM.y + ZOOM.h / 2 - 60, 360, C.accent, 0.12);
              const model = hero('elf');
              const parts = cut >= 0.5 ? decimate(model.parts, 0.05) : model.parts;
              // силуэт исходной модели остаётся каймой — упрощённая в него попадает
              if (outline > 0) {
                ctx.save();
                ctx.globalAlpha *= outline;
                silhouette(ctx, model.parts, view, {}, { stroke: C.accent, width: 6 });
                ctx.restore();
              }
              drawModel(ctx, parts, view, {}, { wire: a(C.bg, cut > 0 ? 0.55 : 0.3), wireWidth: 1.2 });
              if (rig > 0) {
                drawBones(ctx, model.joints, view, {}, {
                  p: rig,
                  color: C.h1,
                  focus: ['shoulderL', 'shoulderR', 'hipL', 'hipR', 'chest'],
                  t: gt,
                });
              }
              // число треугольников
              const n = Math.round(lerp(FULL_TRIS, LOW_TRIS, easeInOutCubic(cut)));
              budgetBar(ctx, ZOOM.x + 40, ZOOM.y + ZOOM.h - 70, ZOOM.w - 220, 30, n, FULL_TRIS * 1.05, {
                limit: FULL_TRIS * 0.7,
              });
              text(ctx, String(n), ZOOM.x + ZOOM.w - 40, ZOOM.y + ZOOM.h - 38, {
                size: 54,
                family: 'mono',
                align: 'right',
                color: n > FULL_TRIS * 0.7 ? C.accent : C.pos,
              });
            },
            { color: C.accent },
          );
        },
        { dx: 80 },
      );
      ctx.restore();
    });

    // ---------------------------------------------------------------- этап 3: портфолио против игры
    const in3 = seg(cG.t, 0.2, 0.8);
    const out3 = easeInOutCubic(seg(cCh.t, -0.2, 0.6));
    const verdict = seg(cG.t, sayAt(cG, 'а Game-Ready'), 0.8);

    f.obj('portfolio', { x: PF.x + PF.w / 2, y: PF.y + PF.h / 2, abs: true, label: 'Портфолио' }, () => {
      if (in3 <= 0 || out3 >= 1) return;
      ctx.save();
      ctx.globalAlpha *= 1 - out3;
      appear(
        ctx,
        in3,
        () => {
          const g = ctx.createLinearGradient(0, PF.y, 0, PF.y + PF.h);
          g.addColorStop(0, '#3a3f47');
          g.addColorStop(1, '#16181c');
          viewport(
            ctx,
            PF,
            () => {
              const view: View = { cx: PF.x + PF.w / 2, cy: PF.y + PF.h - 120, size: 190, pitch: 0.16, yaw: gt * 0.4, dist: 9 };
              // софтбоксы и их свет
              for (const sx of [-1, 1]) {
                const bx = PF.x + PF.w / 2 + sx * 270;
                const by = PF.y + 120;
                const cone = ctx.createLinearGradient(bx, by, PF.x + PF.w / 2, PF.y + PF.h - 200);
                cone.addColorStop(0, a(C.text, 0.16));
                cone.addColorStop(1, a(C.text, 0));
                ctx.fillStyle = cone;
                ctx.beginPath();
                ctx.moveTo(bx - 70, by + 30);
                ctx.lineTo(bx + 70, by + 30);
                ctx.lineTo(PF.x + PF.w / 2 + 140, PF.y + PF.h - 160);
                ctx.lineTo(PF.x + PF.w / 2 - 140, PF.y + PF.h - 160);
                ctx.closePath();
                ctx.fill();
                ctx.save();
                ctx.translate(bx, by);
                ctx.rotate(sx * -0.5);
                ctx.fillStyle = '#e9ecef';
                ctx.shadowColor = a(C.text, 0.8);
                ctx.shadowBlur = 40;
                rrPath(ctx, -80, -26, 160, 52, 8);
                ctx.fill();
                ctx.restore();
              }
              // постамент и огр на нём
              const pedestal: Part[] = [{ mesh: MESH.cylinder, pos: [0, 0.22, 0], size: [2.1, 0.44, 2.1], color: '#5b6068' }];
              drawModel(ctx, pedestal, { ...view, yaw: 0 }, {}, { edge: null });
              drawModel(ctx, FULL, view, { pos: [0, 0.44, 0] });
            },
            { bg: g, color: C.text },
          );
          // уступает игровой сцене: гаснет под тёмной вуалью
          if (verdict > 0) {
            ctx.fillStyle = a(C.bg, 0.6 * verdict);
            rrPath(ctx, PF.x, PF.y, PF.w, PF.h, 12);
            ctx.fill();
          }
        },
        { dx: -60 },
      );
      crossBadge(ctx, PF.x + PF.w - 50, PF.y + 50, 44, verdict);
      ctx.restore();
    });

    f.obj('game', { x: GS.x + GS.w / 2, y: GS.y + GS.h / 2, abs: true, label: 'Игровая сцена' }, () => {
      if (in3 <= 0 || out3 >= 1) return;
      ctx.save();
      ctx.globalAlpha *= 1 - out3;
      appear(
        ctx,
        seg(cG.t, 0.6, 0.8),
        () => {
          if (verdict > 0) softLight(ctx, GS.x + GS.w / 2, GS.y + GS.h / 2, GS.w * 0.75, C.pos, 0.14 * verdict);
          viewport(
            ctx,
            GS,
            () => {
              const view: View = { cx: GS.x + GS.w / 2, cy: GS.y + GS.h / 2 + 60, size: 92, pitch: 0.95, yaw: 0.35, dist: Infinity };
              grassFloor(ctx, view, GS, { tile: 6, shade: 0.4 });
              const t = Math.max(0, cG.t);
              const ox = lerp(-1.2, 0.2, clamp01(t / 7));
              const list: Placed[] = [
                { parts: prop('oak'), root: { pos: [-3.0, 0, -2.2] } },
                { parts: prop('pine'), root: { pos: [3.2, 0, -2.6] } },
                { parts: prop('rock'), root: { pos: [2.8, 0, 1.6] } },
                { parts: prop('bush'), root: { pos: [-3.2, 0, 1.8] } },
                { parts: tankParts({ turret: -0.6 }), root: { pos: [1.4, 0, 2.2], ry: Math.PI / 2 + 0.5 } },
                { parts: hero('elf', ogrePose('walk', gt * 0.9)).parts, root: { pos: [ox, 0, -0.6], ry: 0.5 } },
              ];
              drawScene(ctx, list, view);
            },
            { color: C.pos },
          );
        },
        { dx: 60 },
      );
      checkBadge(ctx, GS.x + GS.w - 50, GS.y + 50, 48, seg(verdict, 0.3, 0.7));
      ctx.restore();
    });

    // ---------------------------------------------------------------- этап 4: проверяйте сами
    const in4 = seg(cCh.t, 0, 0.7);
    const autoP = seg(cL.t, 0.2, 0.9);
    const coarse = cL.t > sayAt(cL, 'удалить важные') ? 0.09 : 0.085;
    const lostK = seg(cL.t, sayAt(cL, 'удалить важные') + 0.2, 0.8);
    const viewL: View = { cx: LEFT.x, cy: LEFT.y, size: 260, pitch: 0.12, yaw: -0.25, dist: 9 };
    const viewR: View = { ...viewL, cx: RIGHT.x };

    f.obj('orig', { x: LEFT.x, y: LEFT.y - 290, abs: true, label: 'Исходная модель' }, () => {
      if (in4 <= 0) return;
      appear(
        ctx,
        in4,
        () => {
          softLight(ctx, LEFT.x, LEFT.y - 290, 380, C.h1, 0.12);
          groundShadow(ctx, viewL, 0, 0, 1.0, 0.8, 0.45);
          drawModel(ctx, FULL, viewL, {}, { wire: a(C.bg, 0.3), wireWidth: 1 });
          // кольца на шипах: на них и смотрим
          for (const sp of SPIKES) {
            const [x, y] = toScreen(sp, viewL);
            ctx.save();
            ctx.globalAlpha *= seg(cL.t, sayAt(cL, 'удалить важные'), 0.6);
            dashRing(ctx, x, y, 78, C.h1, gt, 4);
            ctx.restore();
          }
        },
        { dy: 40 },
      );
    });

    // глаз «проверяйте сами»
    f.obj('eye', { x: 985, y: 470, abs: true, label: 'Проверка глазами' }, () => {
      const p = seg(cCh.t, 0.3, 0.6);
      if (p <= 0) return;
      ctx.save();
      ctx.globalAlpha *= clamp01(p * 2);
      softLight(ctx, 985, 470, 160, C.h1, 0.18);
      hexIcon(ctx, 'eye', 985, 470, 74 * (0.8 + 0.2 * easeOutQuart(p)), C.h1, gt, 0.5 + 0.3 * Math.sin(gt * 3));
      ctx.restore();
    });

    // автоматическая оптимизация
    f.obj('auto', { x: 985, y: 700, abs: true, label: 'Стрелка оптимизации' }, () => {
      if (autoP <= 0) return;
      arrow(ctx, 880, 700, 1090, 700, autoP, { color: C.accent, width: 7, head: 26 });
      ctx.save();
      ctx.globalAlpha *= clamp01(autoP * 2);
      icon(ctx, 'bolt', 985, 640, 64, C.accent, gt);
      ctx.restore();
    });

    f.obj('optimized', { x: RIGHT.x, y: RIGHT.y - 290, abs: true, label: 'После автооптимизации' }, () => {
      const p = seg(cL.t, 0.6, 0.8);
      if (p <= 0) return;
      appear(
        ctx,
        p,
        () => {
          softLight(ctx, RIGHT.x, RIGHT.y - 290, 380, C.accent, 0.12);
          groundShadow(ctx, viewR, 0, 0, 1.0, 0.8, 0.45);
          // призрак исходного силуэта: видно, что пропало
          ctx.save();
          ctx.globalAlpha *= 0.45 * lostK;
          silhouette(ctx, FULL, viewR, {}, { fill: C.accent });
          ctx.restore();
          drawModel(ctx, decimate(FULL, coarse), viewR, {}, { wire: a(C.bg, 0.45), wireWidth: 1.2 });
          for (const sp of SPIKES) {
            const [x, y] = toScreen(sp, viewR);
            ctx.save();
            ctx.globalAlpha *= lostK;
            dashRing(ctx, x, y, 78, C.accent, gt, 5);
            ctx.restore();
          }
        },
        { dx: -40 },
      );
    });

    f.obj('warn', { x: RIGHT.x + 330, y: RIGHT.y - 600, abs: true, label: 'Предупреждение' }, () => {
      if (lostK <= 0) return;
      const x = RIGHT.x + 330;
      const y = RIGHT.y - 600;
      ctx.save();
      ctx.globalAlpha *= clamp01(lostK * 2);
      softLight(ctx, x, y, 140, C.accent, 0.2 + 0.08 * Math.sin(gt * 4));
      shockRing(ctx, x, y, seg(lostK, 0, 1), 180, C.accent, 4);
      hexIcon(ctx, 'warning', x, y, 72, C.accent, gt, 0.6 + 0.4 * Math.sin(gt * 4));
      ctx.restore();
    });
  },
};
