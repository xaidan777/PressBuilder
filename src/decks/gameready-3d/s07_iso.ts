/**
 * Сцена 7. Изометрия и органика.
 * Этап 1: машина, танк игры, домик — жёсткая геометрия; одна картинка в изометрии →
 *         генератор → чистая 3D-модель танка, галочка.
 * Этап 2: огр игры в трёх кадрах (спереди, сбоку, сзади) в одной позе; направляющие
 *         через макушку, плечи и колени совпадают — галочка.
 * Этап 3: переключатель «один ракурс ↔ мультивью»: на мультивью форма портится.
 */

import { clamp01, easeInOutCubic, easeOutQuart, lerp, noise1, seg } from '../../engine/anim.ts';
import { arrow, corners, panel, softLight } from '../../engine/draw.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import { drawGrid } from '../../engine/wire3d.ts';
import {
  appear,
  blobSurf,
  arcCar,
  checkBadge,
  drawModel,
  drawSurf,
  groundShadow,
  houseParts,
  imageFrame,
  OGRE,
  hero,
  ogrePose,
  titles,
  toScreen,
  type P2,
  type Part,
  type Rect,
  type View,
} from './common.ts';
import { BASE_TANK, genHex, multiViewIcon, oneViewIcon } from './kit_b.ts';

type Ctx = CanvasRenderingContext2D;

const CAR = arcCar('audi_tt');
const HOUSE = houseParts();

/** Ряд «жёстких» объектов: центр, «пол», масштаб, модель. */
const HARD: Array<{ cx: number; size: number; parts: Part[]; label: string }> = [
  { cx: 440, size: 185, parts: CAR, label: 'Машина' },
  { cx: 960, size: 138, parts: BASE_TANK, label: 'Танк' },
  { cx: 1480, size: 205, parts: HOUSE, label: 'Домик' },
];
const HARD_FOOT = 820;

const ISO_IMG: Rect = { x: 150, y: 340, w: 640, h: 620 };
const GEN: P2 = [975, 650];
const OUT = { cx: 1450, foot: 820 };

const OGRE_FR: Rect[] = [0, 1, 2].map((i) => ({ x: 150 + i * 560, y: 330, w: 500, h: 680 }));
const OGRE_YAW = [0, Math.PI / 2, Math.PI];

const SW = { cx: 960, cy: 395 };
const BLOB = { cx: 960, cy: 765 };

/** Изометрический вид: без перспективы, 35° сверху, 45° сбоку. */
const isoView = (cx: number, cy: number, size: number): View => ({ cx, cy, size, pitch: 0.6155, yaw: Math.PI / 4, dist: Infinity });

/** Переключатель: пилюля с бегунком; `k` — 0 (один ракурс) … 1 (мультивью). */
function toggle(ctx: Ctx, cx: number, cy: number, k: number): void {
  const w = 300;
  const h = 120;
  const col = k > 0.5 ? C.accent : C.pos;
  panel(ctx, cx - w / 2, cy - h / 2, w, h, {
    fill: C.panel,
    stroke: a(col, 0.7),
    lineWidth: 3,
    radius: h / 2,
    glow: a(col, 0.3),
    glowBlur: 40,
  });
  const kx = lerp(cx - w / 2 + h / 2, cx + w / 2 - h / 2, k);
  ctx.save();
  ctx.shadowColor = a(col, 0.8);
  ctx.shadowBlur = 20;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(kx, cy, h / 2 - 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const hiL = 1 - k;
  const hiR = k;
  oneViewIcon(ctx, cx - w / 2 - 150, cy, 170, a(C.pos, 0.35 + 0.65 * hiL));
  multiViewIcon(ctx, cx + w / 2 + 150, cy, 170, a(C.accent, 0.35 + 0.65 * hiR));
}

export const scene07: SceneDef = {
  id: 's07',

  energy: (_t, cue) => Math.max(0.5 * seg(cue('iso').p, 0.85, 0.1) * (1 - seg(cue('ogres').t, 0, 0.6)), 0.5 * seg(cue('consistent').p, 0.6, 0.15) * (1 - seg(cue('rule').t, 0, 0.6))),

  render(f: Frame) {
    const { ctx, gt } = f;
    const cH = f.cue('hard');
    const cI = f.cue('iso');
    const cO = f.cue('ogres');
    const cC = f.cue('consistent');
    const cR = f.cue('rule');
    const cT = f.cue('trick');

    titles(f, [{ c: cH }, { c: cI }, { c: cO }, { c: cR }]);

    // ================= этап 1: жёсткая геометрия
    const rowOut = easeInOutCubic(seg(cI.p, 0.4, 0.12));
    const stage1 = 1 - easeOutQuart(seg(cO.t, 0, 0.6));
    HARD.forEach((m, i) => {
      f.obj(`hard:${i}`, { x: m.cx, y: HARD_FOOT - 140, abs: true, label: m.label }, () => {
        const p = i === 0 ? seg(cH.t, 0.1, 0.7) : i === 1 ? seg(cH.p, 0.5, 0.3) : seg(cI.t, 0.1, 0.7);
        if (p <= 0 || rowOut >= 1) return;
        // танк уезжает в картинку, машина и домик — в стороны
        const dx = i === 0 ? -260 * rowOut : i === 2 ? 260 * rowOut : 0;
        ctx.save();
        ctx.globalAlpha *= 1 - rowOut;
        ctx.translate(dx, 0);
        appear(
          ctx,
          p,
          () => {
            const view: View = { cx: m.cx, cy: HARD_FOOT, size: m.size, pitch: 0.38, yaw: -0.65 + Math.sin(gt * 0.5 + i) * 0.25, dist: 9 };
            groundShadow(ctx, view, 0, 0, i === 1 ? 1.1 : 1.3, i === 1 ? 1.6 : 0.9, 0.45);
            drawModel(ctx, m.parts, view, {}, { edge: a(C.bg, 0.45) });
            corners(ctx, m.cx - 240, HARD_FOOT - 390, 480, 470, 38, a(C.h1, 0.6 * easeOutQuart(p)), 3);
          },
          { dy: 50 },
        );
        ctx.restore();
      });
    });

    // ---- одна картинка в изометрии → генератор → 3D
    const isoP = seg(cI.p, 0.46, 0.12);
    const genP = seg(cI.p, 0.58, 0.1);
    const outP = seg(cI.p, 0.68, 0.14);
    const okP = seg(cI.p, 0.86, 0.1);
    f.obj('isoimg', { x: ISO_IMG.x + ISO_IMG.w / 2, y: ISO_IMG.y + ISO_IMG.h / 2, abs: true, label: 'Картинка в изометрии' }, () => {
      if (isoP <= 0 || stage1 <= 0) return;
      ctx.save();
      ctx.globalAlpha *= stage1;
      ctx.translate(-120 * (1 - stage1), 0);
      appear(
        ctx,
        isoP,
        () => {
          imageFrame(ctx, ISO_IMG, () => {
            const view = isoView(ISO_IMG.x + ISO_IMG.w / 2, ISO_IMG.y + ISO_IMG.h * 0.64, 152);
            softLight(ctx, view.cx, view.cy - 60, 420, C.accent, 0.12);
            drawGrid(ctx, view, { half: 2.6, step: 0.65, color: a(C.text, 0.16), width: 1.5 });
            drawModel(ctx, BASE_TANK, view, {}, { bands: 3 });
          });
        },
        { from: 0.85, cx: ISO_IMG.x + ISO_IMG.w / 2, cy: ISO_IMG.y + ISO_IMG.h / 2 },
      );
      ctx.restore();
    });

    f.obj('isoflow', { x: GEN[0], y: GEN[1], abs: true, label: 'Генератор' }, () => {
      if (genP <= 0 || stage1 <= 0) return;
      ctx.save();
      ctx.globalAlpha *= stage1;
      arrow(ctx, ISO_IMG.x + ISO_IMG.w + 18, GEN[1], GEN[0] - 96, GEN[1], genP, { color: C.accent, width: 5, head: 20 });
      genHex(ctx, GEN[0], GEN[1], 82, { p: genP, busy: seg(cI.p, 0.6, 0.05) * (1 - seg(cI.p, 0.74, 0.08)), t: gt });
      arrow(ctx, GEN[0] + 96, GEN[1], GEN[0] + 190, GEN[1], outP, { color: C.pos, width: 5, head: 20 });
      ctx.restore();
    });

    f.obj('iso3d', { x: OUT.cx, y: OUT.foot - 150, abs: true, label: '3D-модель танка' }, () => {
      if (outP <= 0 || stage1 <= 0) return;
      ctx.save();
      ctx.globalAlpha *= stage1;
      appear(
        ctx,
        outP,
        () => {
          const view: View = { cx: OUT.cx, cy: OUT.foot, size: 168, pitch: 0.36, yaw: -0.9 + gt * 0.45, dist: 9 };
          softLight(ctx, OUT.cx, OUT.foot - 140, 440, C.pos, 0.14);
          groundShadow(ctx, view, 0, 0.1, 1.2, 1.7, 0.45);
          drawModel(ctx, BASE_TANK, view, {}, {});
          checkBadge(ctx, OUT.cx + 260, OUT.foot - 360, 50, okP);
        },
        { from: 0.6, cx: OUT.cx, cy: OUT.foot - 120, back: true },
      );
      ctx.restore();
    });

    // ================= этап 2: огры в трёх ракурсах
    const stage2 = 1 - easeOutQuart(seg(cR.t, 0, 0.6));
    const pose = ogrePose('idle', gt * 0.35);
    const og = hero('elf', pose);
    const ogView = (r: Rect, yaw: number): View => ({ cx: r.x + r.w / 2, cy: r.y + r.h - 60, size: 232, pitch: 0, yaw, dist: Infinity });
    OGRE_FR.forEach((r, i) => {
      f.obj(`ogre:${i}`, { x: r.x + r.w / 2, y: r.y + r.h / 2, abs: true, label: `Огр, ракурс ${i + 1}` }, () => {
        const p = seg(cO.t, 0.4 + i * 0.35, 0.7);
        if (p <= 0 || stage2 <= 0) return;
        ctx.save();
        ctx.globalAlpha *= stage2;
        ctx.translate(0, -80 * (1 - stage2));
        appear(
          ctx,
          p,
          () => {
            imageFrame(ctx, r, () => {
              const view = ogView(r, OGRE_YAW[i]);
              softLight(ctx, view.cx, r.y + r.h * 0.45, r.w * 0.8, C.accent, 0.1);
              groundShadow(ctx, view, 0, 0, 0.8, 0.6, 0.4);
              drawModel(ctx, og.parts, view, {}, { bands: 3 });
            });
          },
          { dx: 80 },
        );
        ctx.restore();
      });
    });

    // направляющие: макушка, плечи, колени — на одной высоте во всех кадрах
    const guideP = seg(cC.t, 0.2, 1.2);
    f.obj('guides', { x: 960, y: 560, abs: true, label: 'Направляющие' }, () => {
      if (guideP <= 0 || stage2 <= 0) return;
      const view = ogView(OGRE_FR[0], 0);
      const hy = toScreen([0, 2.2, 0], view)[1];
      const ys = [hy, toScreen(og.joints.shoulderL, view)[1], toScreen(og.joints.kneeL, view)[1]];
      ctx.save();
      ctx.globalAlpha *= stage2;
      ys.forEach((y, k) => {
        const pk = easeOutQuart(clamp01(guideP * 1.6 - k * 0.25));
        if (pk <= 0) return;
        ctx.save();
        ctx.strokeStyle = C.pos;
        ctx.lineWidth = 3.5;
        ctx.setLineDash([18, 12]);
        ctx.shadowColor = a(C.pos, 0.7);
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(130, y);
        ctx.lineTo(130 + (1660 * pk), y);
        ctx.stroke();
        ctx.restore();
      });
      checkBadge(ctx, OGRE_FR[2].x + OGRE_FR[2].w - 10, OGRE_FR[2].y + 10, 52, seg(cC.p, 0.6, 0.15));
      ctx.restore();
    });

    // ================= этап 3: один ракурс ↔ мультивью
    const s3 = seg(cR.t, 0.2, 0.6);
    // на «правиле» бегунок ходит туда-сюда; на «приёме»: мультивью портит форму → один ракурс
    const wob = seg(cR.t, 0.4, 0.6) * (1 - seg(cT.t, 0, 0.3));
    const flip = easeInOutCubic(seg(cT.p, 0.55, 0.1));
    const k = cT.began ? 1 - flip : 0.5 + 0.5 * Math.sin((cR.t - 0.4) * 2.6) * wob;
    const kk = clamp01(k);
    const spoil = cT.began ? seg(cT.p, 0.05, 0.4) * (1 - flip) : kk * 0.4;

    f.obj('switch', { x: SW.cx, y: SW.cy, abs: true, label: 'Переключатель ракурсов' }, () => {
      if (s3 <= 0) return;
      appear(ctx, s3, () => toggle(ctx, SW.cx, SW.cy, kk), { dy: 40 });
    });

    f.obj('blob', { x: BLOB.cx, y: BLOB.cy, abs: true, label: 'Форма' }, () => {
      if (s3 <= 0) return;
      appear(
        ctx,
        s3,
        () => {
          const amp = 0.08 + 0.34 * spoil;
          const seed = 1.3 + spoil * (0.6 + 0.25 * noise1(gt * 3, 2));
          const surf = blobSurf(30, 18, amp, [1, 0.92, 0.9], seed);
          const jit = spoil * 7;
          const view: View = {
            cx: BLOB.cx + noise1(gt * 9, 1) * jit,
            cy: BLOB.cy + noise1(gt * 8, 4) * jit,
            size: 270,
            pitch: 0.25,
            yaw: gt * 0.4,
            dist: 6,
          };
          softLight(ctx, BLOB.cx, BLOB.cy, 420, spoil > 0.3 ? C.accent : C.pos, 0.12);
          drawSurf(ctx, surf, view, {}, { fill: OGRE, wire: a(C.bg, 0.45), width: 1.4 });
          const ok = cT.began ? seg(cT.p, 0.72, 0.12) : 0;
          checkBadge(ctx, BLOB.cx + 320, BLOB.cy - 210, 52, ok);
        },
        { from: 0.5, cx: BLOB.cx, cy: BLOB.cy, back: true },
      );
    });
  },
};
