/**
 * Сцена 6. Ракурсы расходятся.
 * Машина — настоящая модель игры ArcRace (audi_tt), четыре строгих ракурса: спереди, слева, справа, сзади.
 * Этап 1: машина с четырёх сторон в кадрах → генератор → 3D-машина; «не всегда» — она дрожит, warning.
 * Этап 2: кадры встают в ряд; 3D-модель не строится (крест); маркеры показывают, что
 *         слева длиннее колёсная база, спереди выше фары, справа другая крыша.
 * Этап 3: глаз разницы не видит; генератор сводит четыре варианта в одну дрожащую кашу.
 */

import { easeInOutCubic, easeOutQuart, noise1, seg } from '../../engine/anim.ts';
import { softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import {
  appear,
  arcCar,
  arcCarInfo,
  crossBadge,
  drawModel,
  flow,
  groundShadow,
  imageFrame,
  titles,
  toScreen,
  type ArcCarOpts,
  type P2,
  type Rect,
  type V3,
  type View,
} from './common.ts';
import { genHex, lerpRect } from './kit_b.ts';

type Ctx = CanvasRenderingContext2D;

const CAR = 'audi_tt';

type Kind = 'ref' | 'base' | 'lights' | 'roof';
/** Четыре строгих ракурса; в каждом «нарисованная» машина чуть другая. */
const SHOTS: Array<{ yaw: number; kind: Kind; car: ArcCarOpts }> = [
  { yaw: -Math.PI / 2, kind: 'lights', car: { lights: 0.13 } }, // спереди
  { yaw: Math.PI, kind: 'base', car: { wheelbase: 0.6 } }, // слева
  { yaw: 0, kind: 'roof', car: { roof: 0.9 } }, // справа
  { yaw: Math.PI / 2, kind: 'ref', car: {} }, // сзади
];
const CARS = SHOTS.map((s) => arcCar(CAR, s.car));
const INFO = SHOTS.map((s) => arcCarInfo(CAR, s.car));
const REF = arcCar(CAR);
const REF_INFO = arcCarInfo(CAR);
/** Когда в реплике drift зажигается и гаснет маркер расхождения (доля реплики). */
const MARK: Record<Kind, [number, number]> = { ref: [2, 2], base: [0.06, 0.32], lights: [0.38, 0.6], roof: [0.66, 1.2] };

const GRID: Rect[] = [0, 1, 2, 3].map((i) => ({ x: 150 + (i % 2) * 402, y: 335 + Math.floor(i / 2) * 307, w: 380, h: 285 }));
const ROW: Rect[] = [0, 1, 2, 3].map((i) => ({ x: 150 + i * 410, y: 330, w: 390, h: 340 }));
/** Крупный план кадра с расхождением. */
const ZOOM: Rect = { x: 500, y: 716, w: 920, h: 318 };
const GEN: P2 = [1105, 631];
const OUT = { cx: 1505, foot: 810 };
const HOLO = { cx: 960, foot: 1005 };
const MUSH = { cx: 960, foot: 905 };
/** На «одной геометрии» кадры расходятся по бокам от каши. */
const SIDE: Rect[] = [0, 1, 2, 3].map((i) => ({ x: i % 2 === 0 ? 150 : 1470, y: i < 2 ? 380 : 700, w: 300, h: 262 }));

/** Строгий ортографический ракурс: бок — по ширине кадра, перёд и зад — крупнее. */
const frameView = (r: Rect, yaw: number): View => {
  const side = Math.abs(Math.cos(yaw)) > 0.5;
  return {
    cx: r.x + r.w / 2,
    cy: r.y + r.h * 0.74,
    size: side ? r.w * 0.36 : r.w * 0.6,
    pitch: 0,
    yaw,
    dist: Infinity,
  };
};

/** Кольцо-маркер. */
function ring(ctx: Ctx, x: number, y: number, r: number, p: number, gt: number): void {
  if (p <= 0) return;
  ctx.save();
  ctx.globalAlpha *= easeOutQuart(p);
  ctx.strokeStyle = C.accent;
  ctx.lineWidth = 4;
  ctx.shadowColor = a(C.accent, 0.8);
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(x, y, r * (1.5 - 0.5 * easeOutQuart(p)) * (1 + 0.05 * Math.sin(gt * 6)), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Пунктирный многоугольник/линия. */
function dashed(ctx: Ctx, pts: P2[], close: boolean, color: string, width = 3): void {
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (close) ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/** Маркеры расхождений в кадре i: эталон пунктиром, «нарисованное» — в кольцах. */
function markers(ctx: Ctx, i: number, view: View, p: number, gt: number): void {
  if (p <= 0) return;
  const kind = SHOTS[i].kind;
  const info = INFO[i];
  const s = view.size;
  ctx.save();
  ctx.globalAlpha *= Math.min(1, p * 2);
  if (kind === 'base') {
    // колёсная база: где колёса должны быть (пунктир) и где нарисованы; размерная линия
    const near = [0, 2]; // FL, BL — левый борт к камере
    for (const w of near) {
      const [px, py] = toScreen(REF_INFO.wheels[w], view);
      ctx.save();
      ctx.setLineDash([8, 7]);
      ctx.strokeStyle = a(C.text, 0.75);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(px, py, REF_INFO.wheelR * s * 1.05, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    const A = toScreen(info.wheels[0], view);
    const B = toScreen(info.wheels[2], view);
    const y = A[1] + info.wheelR * s + 26;
    const k = easeOutQuart(p);
    const mx = (A[0] + B[0]) / 2;
    const half = ((B[0] - A[0]) / 2) * k;
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(mx - half, y);
    ctx.lineTo(mx + half, y);
    for (const ex of [mx - half, mx + half]) {
      ctx.moveTo(ex, y - 14);
      ctx.lineTo(ex, y + 14);
    }
    ctx.stroke();
    for (const w of near) {
      const [px, py] = toScreen(info.wheels[w], view);
      ring(ctx, px, py, info.wheelR * s * 1.15, p, gt);
    }
  } else if (kind === 'lights') {
    // фары: эталонная высота пунктиром, нарисованные — в кольцах
    const L = toScreen(REF_INFO.lights[0], view);
    const R = toScreen(REF_INFO.lights[1], view);
    const pad = Math.abs(R[0] - L[0]) * 0.35;
    const lo = Math.min(L[0], R[0]);
    const hi = Math.max(L[0], R[0]);
    dashed(ctx, [[lo - pad, L[1]], [hi + pad, R[1]]], false, a(C.text, 0.8));
    for (const l of info.lights) {
      const [px, py] = toScreen(l, view);
      ring(ctx, px, py, 0.17 * s, p, gt);
    }
  } else if (kind === 'roof') {
    // крыша: эталонная кромка пунктиром, нарисованная — ярко
    dashed(ctx, REF_INFO.roof.map((v) => toScreen(v, view)), false, a(C.text, 0.8), 3.5);
    const pts = info.roof.map((v) => toScreen(v, view));
    ctx.save();
    ctx.globalAlpha *= easeOutQuart(p);
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.shadowColor = a(C.accent, 0.8);
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1] - 4);
    ctx.lineTo(pts[1][0], pts[1][1] - 4);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

export const scene06: SceneDef = {
  id: 's06',

  energy: (_t, cue) =>
    Math.max(0.5 * seg(cue('notalways').t, 0.2, 0.4) * (1 - seg(cue('notmodel').t, 0, 0.6)), 0.6 * seg(cue('merge').p, 0.3, 0.2)),

  render(f: Frame) {
    const { ctx, gt } = f;
    const cNu = f.cue('nuance');
    const cF = f.cue('four');
    const cNa = f.cue('notalways');
    const cNm = f.cue('notmodel');
    const cS = f.cue('similar');
    const cD = f.cue('drift');
    const cE = f.cue('eye');
    const cM = f.cue('merge');

    titles(f, [{ c: cNu }, { c: cNa }, { c: cNm }, { c: cM }]);

    // ---- этап 1: кадры → генератор → модель
    const out1 = easeOutQuart(seg(cNm.t, 0, 0.6));
    const s1 = 1 - out1;
    const busy = seg(cF.p, 0.42, 0.08) * (1 - seg(cF.p, 0.72, 0.08));
    const glitch = seg(cNa.t, 0.1, 0.4);

    f.obj('flows', { x: 975, y: 631, abs: true, label: 'Стрелки к генератору' }, () => {
      if (s1 <= 0) return;
      ctx.save();
      ctx.globalAlpha *= s1;
      GRID.forEach((r, i) => {
        if (i % 2 === 0) return;
        flow(ctx, [r.x + r.w + 12, r.y + r.h / 2], [975, r.y + r.h / 2], [GEN[0] - 98, GEN[1] + (i < 2 ? -24 : 24)], {
          t: gt + i * 0.3,
          color: C.h1,
          p: seg(cF.p, 0.36, 0.1),
          width: 4,
          n: 4,
        });
      });
      flow(ctx, [GEN[0] + 100, GEN[1]], [GEN[0] + 140, GEN[1]], [GEN[0] + 185, GEN[1]], {
        t: gt,
        color: glitch > 0 ? C.accent : C.pos,
        p: seg(cF.p, 0.66, 0.08),
        width: 4,
        n: 2,
      });
      ctx.restore();
    });

    f.obj('gen', { x: GEN[0], y: GEN[1], abs: true, label: 'Генератор' }, () => {
      if (s1 <= 0) return;
      ctx.save();
      ctx.globalAlpha *= s1;
      genHex(ctx, GEN[0], GEN[1], 92, { p: seg(cF.p, 0.3, 0.1), busy, t: gt });
      ctx.restore();
    });

    f.obj('result', { x: OUT.cx, y: OUT.foot - 160, abs: true, label: '3D-машина' }, () => {
      const p = seg(cF.p, 0.7, 0.14);
      if (s1 <= 0 || p <= 0) return;
      ctx.save();
      ctx.globalAlpha *= s1;
      appear(
        ctx,
        p,
        () => {
          const view: View = { cx: OUT.cx, cy: OUT.foot, size: 175, pitch: 0.3, yaw: -0.6 + Math.sin(gt * 0.6) * 0.25, dist: 9 };
          softLight(ctx, OUT.cx, OUT.foot - 120, 420, glitch > 0 ? C.accent : C.pos, 0.13);
          groundShadow(ctx, view, 0, 0, 1.5, 0.9, 0.45);
          if (glitch <= 0) {
            drawModel(ctx, REF, view, {}, {});
          } else {
            // «не всегда»: модель дрожит между вариантами
            CARS.forEach((car, i) => {
              ctx.save();
              ctx.globalAlpha *= i === 0 ? 1 : 0.35 * glitch;
              drawModel(ctx, car, view, { pos: [noise1(gt * 9, i) * 0.06 * glitch, 0, 0], ry: noise1(gt * 7, i + 3) * 0.05 * glitch }, {});
              ctx.restore();
            });
          }
        },
        { from: 0.6, cx: OUT.cx, cy: OUT.foot - 100, back: true },
      );
      const w = seg(cNa.t, 0.3, 0.4);
      if (w > 0) {
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(w);
        icon(ctx, 'warning', OUT.cx + 40, OUT.foot - 330 + Math.sin(gt * 5) * 5, 130 * (0.6 + 0.4 * easeOutQuart(w)), C.accent);
        ctx.restore();
      }
      ctx.restore();
    });

    // ---- кадры: сетка → ряд → в кашу
    const toRow = easeInOutCubic(seg(cNm.t, 0.1, 1.0));
    const fly = easeInOutCubic(seg(cM.t, 0, 0.9));
    const similarHot = (i: number) => {
      const k = seg(cS.p, 0.08 + i * 0.2, 0.18);
      return Math.sin(k * Math.PI);
    };
    const markP = SHOTS.map((sh) => (sh.kind === 'ref' ? 0 : seg(cD.p, MARK[sh.kind][0], 0.12)));
    const markOut = 1 - seg(cE.t, 0.1, 0.6);
    const markEnd = SHOTS.map((sh) => MARK[sh.kind][1]);

    SHOTS.forEach((shot, i) => {
      const r0 = ROW[i];
      f.obj(`frame:${i}`, { x: r0.x + r0.w / 2, y: r0.y + r0.h / 2, abs: true, label: `Ракурс ${i + 1}` }, () => {
        const p = i === 0 ? seg(cNu.t, 0.3, 0.6) : seg(cF.p, 0.08 + i * 0.07, 0.14);
        if (p <= 0) return;
        let r = lerpRect(GRID[i], ROW[i], toRow);
        if (fly > 0) r = lerpRect(r, SIDE[i], fly);
        const hot = similarHot(i);
        const odd = markP[i] * markOut;
        const lift = markP[i] * (1 - seg(cD.p, markEnd[i], 0.08)) * markOut;
        r = { ...r, y: r.y - 24 * easeOutQuart(lift) };
        ctx.save();
        appear(
          ctx,
          p,
          () => {
            if (hot > 0) softLight(ctx, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.8, C.h1, 0.2 * hot);
            if (lift > 0) softLight(ctx, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.85, C.accent, 0.2 * lift);
            imageFrame(
              ctx,
              r,
              () => {
                const view = frameView(r, shot.yaw);
                drawModel(ctx, CARS[i], view, {}, { bands: 3 });
                markers(ctx, i, view, odd, gt);
              },
              { color: odd > 0.3 ? C.accent : hot > 0.3 ? C.h1 : C.accent },
            );
          },
          { from: 0.8, cx: r.x + r.w / 2, cy: r.y + r.h / 2, back: true },
        );
        ctx.restore();
      });
    });

    // ---- крупный план: кадр с текущим расхождением
    const act = SHOTS.map((_, i) => markP[i] * (1 - seg(cD.p, markEnd[i], 0.08)));
    const zoomP = seg(cD.p, 0.04, 0.1) * (1 - seg(cE.t, 0, 0.5));
    f.obj('zoom', { x: ZOOM.x + ZOOM.w / 2, y: ZOOM.y + ZOOM.h / 2, abs: true, label: 'Крупный план' }, () => {
      if (zoomP <= 0) return;
      // «лучи» от кадра в ряду к крупному плану
      act.forEach((k, i) => {
        if (k <= 0) return;
        const r = ROW[i];
        ctx.save();
        ctx.globalAlpha *= k * zoomP;
        const g = ctx.createLinearGradient(0, r.y + r.h, 0, ZOOM.y);
        g.addColorStop(0, a(C.accent, 0.22));
        g.addColorStop(1, a(C.accent, 0.04));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(r.x + 10, r.y + r.h - 24);
        ctx.lineTo(r.x + r.w - 10, r.y + r.h - 24);
        ctx.lineTo(ZOOM.x + ZOOM.w - 20, ZOOM.y);
        ctx.lineTo(ZOOM.x + 20, ZOOM.y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });
      appear(
        ctx,
        zoomP,
        () => {
          imageFrame(
            ctx,
            ZOOM,
            () => {
              act.forEach((k, i) => {
                if (k <= 0) return;
                ctx.save();
                ctx.globalAlpha *= k;
                const view = frameView({ x: ZOOM.x + ZOOM.w * 0.2, y: ZOOM.y + 10, w: ZOOM.w * 0.6, h: ZOOM.h - 20 }, SHOTS[i].yaw);
                drawModel(ctx, CARS[i], view, {}, { bands: 3 });
                markers(ctx, i, view, Math.min(1, k * 1.5), gt);
                ctx.restore();
              });
            },
            { color: C.accent },
          );
        },
        { dy: 40 },
      );
    });

    // ---- 3D-модель, которую 2D-генератор НЕ строит
    const holoP = seg(cNm.t, 0.5, 0.8);
    const holoOut = seg(cD.t, 0, 0.4);
    f.obj('holo', { x: HOLO.cx, y: HOLO.foot - 120, abs: true, label: 'Трёхмерная модель (нет)' }, () => {
      if (holoP <= 0 || holoOut >= 1) return;
      ctx.save();
      ctx.globalAlpha *= easeOutQuart(holoP) * (1 - holoOut);
      const view: View = { cx: HOLO.cx, cy: HOLO.foot, size: 165, pitch: 0.32, yaw: -0.6 + gt * 0.4, dist: 9 };
      drawModel(ctx, REF, view, {}, { tint: '#2b2f36', wire: a(C.h1, 0.75), wireWidth: 1.4 });
      crossBadge(ctx, HOLO.cx + 300, HOLO.foot - 200, 46, seg(cNm.p, 0.55, 0.15));
      ctx.restore();
    });

    // ---- глаз: «одинаковые»
    const eyeP = seg(cE.t, 0.2, 0.6) * (1 - seg(cM.t, 0, 0.4));
    f.obj('eye', { x: 960, y: 870, abs: true, label: 'Глаз' }, () => {
      if (eyeP <= 0) return;
      ctx.save();
      ctx.globalAlpha *= easeOutQuart(eyeP);
      const blink = 1 - 0.85 * Math.max(0, Math.sin(cE.t * 2.2) ** 40);
      softLight(ctx, 960, 870, 280, C.h1, 0.16);
      ctx.translate(960, 870);
      ctx.scale(1, blink);
      icon(ctx, 'eye', 0, 0, 240 * (0.7 + 0.3 * easeOutQuart(eyeP)), C.h1, gt);
      ctx.restore();
    });

    // ---- потоки из кадров в кашу
    f.obj('mergeflows', { x: MUSH.cx, y: 640, abs: true, label: 'Потоки в геометрию' }, () => {
      const p = seg(cM.p, 0.16, 0.14);
      if (p <= 0) return;
      SIDE.forEach((r, i) => {
        const left = i % 2 === 0;
        const from: P2 = [left ? r.x + r.w + 14 : r.x - 14, r.y + r.h / 2];
        const to: P2 = [MUSH.cx + (left ? -150 : 150), MUSH.foot - 170 + (i < 2 ? -40 : 40)];
        flow(ctx, from, [(from[0] + to[0]) / 2, from[1]], to, { t: gt + i * 0.25, color: C.accent, p, width: 4, n: 3 });
      });
    });

    // ---- каша: четыре варианта в одной геометрии
    const mushP = seg(cM.p, 0.22, 0.2);
    f.obj('mush', { x: MUSH.cx, y: MUSH.foot - 180, abs: true, label: 'Одна геометрия' }, () => {
      if (mushP <= 0) return;
      appear(
        ctx,
        mushP,
        () => {
          const view: View = { cx: MUSH.cx, cy: MUSH.foot, size: 250, pitch: 0.3, yaw: -0.6 + Math.sin(gt * 0.35) * 0.3, dist: 9 };
          softLight(ctx, MUSH.cx, MUSH.foot - 150, 600, C.accent, 0.12);
          groundShadow(ctx, view, 0, 0, 1.5, 0.9, 0.45);
          const amp = 0.5 + 0.5 * seg(cM.p, 0.5, 0.3);
          CARS.forEach((car, i) => {
            ctx.save();
            ctx.globalAlpha *= i === 0 ? 0.55 : 0.42;
            // каждая деталь дрожит сама по себе — форма не сходится
            const shaky = car.map((pt, j) => ({
              ...pt,
              pos: [
                pt.pos[0] + noise1(gt * 7 + j * 1.7, i * 5 + j) * 0.05 * amp,
                pt.pos[1] + noise1(gt * 6 + j * 2.3, i * 3 + j + 11) * 0.03 * amp,
                pt.pos[2] + noise1(gt * 6.5 + j * 1.1, i * 7 + j + 23) * 0.04 * amp,
              ] as V3,
            }));
            drawModel(
              ctx,
              shaky,
              view,
              {
                pos: [noise1(gt * 6, i) * 0.08 * amp, noise1(gt * 5, i + 7) * 0.03 * amp, noise1(gt * 6.5, i + 13) * 0.07 * amp],
                ry: noise1(gt * 5.5, i + 21) * 0.06 * amp,
              },
              { edge: a(C.bg, 0.4) },
            );
            ctx.restore();
          });
          // кромки крыши разных ракурсов дрожат поверх — форма не сходится
          ctx.save();
          ctx.globalAlpha *= 0.6 * amp;
          INFO.forEach((info, k) => {
            const v = { ...view, cx: view.cx + noise1(gt * 8, k) * 6 };
            const pts = info.roof.map((p3) => toScreen(p3, v));
            ctx.strokeStyle = C.accent;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(pts[0][0], pts[0][1]);
            ctx.lineTo(pts[1][0], pts[1][1]);
            ctx.stroke();
          });
          ctx.restore();
        },
        { from: 0.3, cx: MUSH.cx, cy: MUSH.foot - 150 },
      );
    });
  },
};
