/**
 * Сцена 15. «Трёхмерный референс».
 *  1. Картинка огра + трёхмерная голова огра → агент Claude Code.
 *  2. Два шага: (1) прототип огра из кубов-примитивов; (2) автор отдаёт голову
 *     реального огра, Claude Code достраивает тело по пунктирным направляющим
 *     (контур формы и линейка пропорций в «головах»): корпус, руки, ноги по очереди.
 *  3. Одна удачная машина из Tripo → агент → следующие машины того же стиля;
 *     общая рамка и галочка — единый стиль.
 */

import { clamp01, easeInOutCubic, easeOutQuart, lerp, seg } from '../../engine/anim.ts';
import { corners, panel, softLight } from '../../engine/draw.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import { chip } from '../../engine/ui.ts';
import { drawGrid } from '../../engine/wire3d.ts';
import {
  arcCar,
  checkBadge,
  drawModel,
  flow,
  groundShadow,
  IDLE,
  imageFrame,
  ogre,
  ogrePose,
  titles,
  toScreen,
  viewport,
  type P2,
  type Part,
  type Rect,
  type Soup,
  type View,
} from './common.ts';
import { agentHex, recolor, stepBadge } from './kit_D.ts';

type Ctx = CanvasRenderingContext2D;

// ---------------------------------------------------------------- раскладка

const IMG: Rect = { x: 150, y: 350, w: 440, h: 560 };
const M3: Rect = { x: 690, y: 350, w: 560, h: 560 };
const AGENT1: P2 = [1530, 590];

const P1: Rect = { x: 150, y: 300, w: 790, h: 730 };
const P2R: Rect = { x: 980, y: 300, w: 790, h: 730 };

const SAMPLE: Rect = { x: 460, y: 320, w: 1000, h: 640 };
const SLOT_W = 380;
const SLOT_H = 400;
const SLOT_Y = 570;
const SLOT_X = (i: number) => 150 + i * ((1620 - SLOT_W) / 3);
const AGENT3: P2 = [1450, 380];

/** Машины игры ArcRace: audi_tt — образец из Tripo, дальше машины, сделанные по нему. */
const CARS = [arcCar('audi_tt'), arcCar('muscle'), arcCar('sport'), arcCar('hatchback')];

// ---------------------------------------------------------------- огр по частям

/** Корпус огра без головы: голову «принёс» автор, её не перерисовываем. */
let TORSO: Soup | null = null;
function torsoSoup(body: Part): Soup {
  if (TORSO) return TORSO;
  const sp = body.soup!;
  const py = body.pos[1] / body.size[1];
  const idx: number[] = [];
  const col: number[] = [];
  const glow = new Set<number>();
  for (let t = 0; t < sp.idx.length / 3; t++) {
    const tri = [sp.idx[t * 3], sp.idx[t * 3 + 1], sp.idx[t * 3 + 2]];
    const head = tri.every((i) => sp.pos[i * 3 + 1] + py >= 0.74 && Math.abs(sp.pos[i * 3]) <= 0.21);
    if (head) continue;
    if (sp.glow.has(t)) glow.add(col.length);
    idx.push(...tri);
    col.push(sp.col[t]);
  }
  TORSO = { pos: sp.pos, idx, col, glow };
  return TORSO;
}

const BUILD = ['body', 'armL', 'armR', 'legL', 'legR'];

/** Голова + части тела, появившиеся к моменту `t` (новая деталь подсвечена). */
function ogreBuild(gt: number, t: number, start: number): Part[] {
  const pose = ogrePose('idle', gt * 0.4);
  const full = ogre(pose).parts;
  const out: Part[] = [...ogre(pose, { headOnly: true }).parts];
  BUILD.forEach((tag, k) => {
    const p = seg(t, start + k * 0.9, 0.5);
    if (p <= 0) return;
    let part = full.find((q) => q.tag === tag)!;
    if (tag === 'body') part = { ...part, soup: torsoSoup(ogre(IDLE).parts[0]) };
    const e = easeOutQuart(p);
    const side = tag.endsWith('L') ? 1 : tag.endsWith('R') ? -1 : 0;
    part = {
      ...part,
      pos: [part.pos[0] + side * (1 - e) * 1.2, part.pos[1] - (side ? 0 : (1 - e) * 0.8), part.pos[2]],
      alpha: Math.min(1, p * 3),
    };
    out.push(p < 0.9 ? recolor(part, C.accent) : part);
  });
  return out;
}

/** Пунктирные направляющие от головы: контур плеч/корпуса и линейка «в головах». */
function guides(ctx: Ctx, view: View, p: number, t: number): void {
  if (p <= 0) return;
  const s = (x: number, y: number): P2 => toScreen([x, y, 0.1], view);
  ctx.save();
  ctx.globalAlpha *= clamp01(p * 2);
  ctx.setLineDash([14, 12]);
  ctx.lineDashOffset = -t * 30;
  ctx.lineWidth = 3;
  ctx.strokeStyle = a(C.h1, 0.8);
  // линии верха головы и подбородка — через всю фигуру
  for (const y of [2.22, 1.62]) {
    const [x1, y1] = s(-1.35, y);
    const [x2, y2] = s(1.35, y);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(lerp(x1, x2, clamp01(p * 1.4)), lerp(y1, y2, clamp01(p * 1.4)));
    ctx.stroke();
  }
  // контур формы: от боков головы вниз к плечам и поясу
  const half: Array<[number, number]> = [
    [0.44, 1.7],
    [0.98, 1.5],
    [1.0, 0.86],
    [0.55, 0.62],
    [0.5, 0.0],
  ];
  for (const side of [1, -1]) {
    ctx.beginPath();
    const n = Math.max(2, Math.ceil(half.length * clamp01(p * 1.2)));
    half.slice(0, n).forEach(([x, y], i) => {
      const [px, py] = s(x * side, y);
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    });
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // линейка пропорций: рост в «головах»
  const H = 0.6;
  const [rx0, ry0] = s(-1.42, 2.22);
  const [, ry1] = s(-1.42, 0);
  ctx.strokeStyle = C.accent;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(rx0, ry0);
  ctx.lineTo(rx0, lerp(ry0, ry1, clamp01(p * 1.3)));
  ctx.stroke();
  for (let k = 0; k * H <= 2.22 + 1e-6; k++) {
    const y = 2.22 - k * H;
    const [, py] = s(-1.42, y);
    if (py > lerp(ry0, ry1, clamp01(p * 1.3)) + 1) break;
    ctx.fillStyle = k === 0 ? C.accent : a(C.accent, 0.35 + 0.65 * ((k % 2) as number));
    ctx.fillRect(rx0 - 16, py - 3, 32, 6);
    if (k < 4) {
      const [, pn] = s(-1.42, Math.max(0, y - H));
      ctx.fillStyle = a(C.accent, k % 2 ? 0.08 : 0.2);
      ctx.fillRect(rx0 - 12, py, 24, pn - py);
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- сцена

export const scene15: SceneDef = {
  id: 's15',

  render(f: Frame) {
    const { ctx, gt, t } = f;
    const cR = f.cue('ref3d');
    const cSt = f.cue('stages');
    const cPr = f.cue('primitives');
    const cH = f.cue('head');
    const cB = f.cue('body');
    const cSa = f.cue('sample');
    const cN = f.cue('next');
    const cSy = f.cue('style');

    titles(f, [{ c: cR }, { c: cSt }, { c: cH }, { c: cB }, { c: cSa }, { c: cSy }]);

    const out1 = easeInOutCubic(seg(cSt.t, 0, 0.8));
    const out2 = easeInOutCubic(seg(cSa.t, 0, 0.8));

    // ================= этап 1: картинка + 3D → агент
    const imgP = seg(cR.t, 0.1, 0.6);
    const m3P = seg(cR.p, 0.45, 0.14);
    f.obj('picture', { x: IMG.x + IMG.w / 2, y: IMG.y + IMG.h / 2, abs: true, label: 'Картинка огра' }, () => {
      if (imgP <= 0 || out1 >= 1) return;
      ctx.save();
      ctx.globalAlpha *= Math.min(1, imgP * 2.5) * (1 - out1);
      ctx.translate(-out1 * 200, (1 - easeOutQuart(imgP)) * 50);
      imageFrame(ctx, IMG, () => {
        const view: View = { cx: IMG.x + IMG.w / 2, cy: IMG.y + IMG.h - 70, size: 185, pitch: 0.1, yaw: 0.35, dist: 12 };
        drawModel(ctx, ogre(IDLE).parts, view, {}, { bands: 3, smooth: 1, ambient: 0.52 });
      });
      ctx.restore();
    });

    f.obj('ref3d', { x: M3.x + M3.w / 2, y: M3.y + M3.h / 2, abs: true, label: '3D-референс: голова' }, () => {
      if (m3P <= 0 || out1 >= 1) return;
      const e = easeOutQuart(m3P);
      ctx.save();
      ctx.globalAlpha *= Math.min(1, m3P * 2.5) * (1 - out1);
      ctx.translate(-out1 * 200, (1 - e) * 50);
      softLight(ctx, M3.x + M3.w / 2, M3.y + M3.h / 2, M3.w * 0.8, C.h1, 0.14 * m3P);
      viewport(ctx, M3, () => {
        const view: View = { cx: M3.x + M3.w / 2, cy: M3.y + M3.h / 2 + 10, size: 470, pitch: 0.15, yaw: Math.sin(gt * 0.5) * 0.7, dist: 14 };
        drawGrid(ctx, { ...view, size: 110, cy: M3.y + M3.h - 60, yaw: gt * 0.2 }, { half: 3, step: 0.5, color: a(C.text, 0.1) });
        drawModel(ctx, ogre(IDLE, { headOnly: true }).parts, view, { pos: [0, -1.92, -0.25] }, { smooth: 1, ambient: 0.52 });
      });
      ctx.restore();
    });

    f.obj('plus', { x: (IMG.x + IMG.w + M3.x) / 2, y: IMG.y + IMG.h / 2, abs: true, label: 'Плюс' }, () => {
      if (m3P <= 0 || out1 >= 1) return;
      const x = (IMG.x + IMG.w + M3.x) / 2;
      const y = IMG.y + IMG.h / 2;
      ctx.save();
      ctx.globalAlpha *= clamp01(m3P * 2) * (1 - out1);
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - 26, y);
      ctx.lineTo(x + 26, y);
      ctx.moveTo(x, y - 26);
      ctx.lineTo(x, y + 26);
      ctx.stroke();
      ctx.restore();
    });

    f.obj('agent1', { x: AGENT1[0], y: AGENT1[1], abs: true, text: 'Claude Code', label: 'Агент (этап 1)' }, (o) => {
      const p = seg(cR.t, 0.4, 0.6);
      if (p <= 0 || out1 >= 1) return;
      ctx.save();
      ctx.globalAlpha *= 1 - out1;
      ctx.translate(out1 * 200, 0);
      flow(ctx, [IMG.x + IMG.w / 2, IMG.y + IMG.h + 14], [980, 1090], [AGENT1[0] - 50, AGENT1[1] + 112], {
        t: gt,
        color: C.accent,
        p: seg(cR.t, 0.7, 0.8),
        n: 3,
        width: 4,
        lineAlpha: 0.5,
      });
      flow(ctx, [M3.x + M3.w + 14, M3.y + M3.h / 2], [1330, M3.y + M3.h / 2], [AGENT1[0] - 130, AGENT1[1]], {
        t: gt,
        color: C.h1,
        p: seg(cR.p, 0.55, 0.15),
        n: 3,
        width: 5,
        r: 8,
      });
      agentHex(ctx, AGENT1[0], AGENT1[1], { r: 118, p, t: gt, busy: m3P, label: o.text, labelSize: 64 });
      ctx.restore();
    });

    // ================= этап 2: два шага
    const panelIn = (k: number) => seg(cSt.t, 0.3 + k * 0.3, 0.6);
    const panelK = 1 - out2;
    const drawPanel = (r: Rect, n: string, p: number, active: number, color: string) => {
      const e = easeOutQuart(p);
      ctx.translate(-out2 * 260, (1 - e) * 60);
      panel(ctx, r.x, r.y, r.w, r.h, {
        fill: a(C.panel, 0.9),
        stroke: a(color, 0.3 + 0.4 * active),
        lineWidth: 2,
        radius: 18,
        glow: a(color, 0.08 + 0.12 * active),
        glowBlur: 50,
      });
      stepBadge(ctx, r.x + 64, r.y + 64, n, p, active, color);
    };

    f.obj('step1', { x: P1.x + P1.w / 2, y: P1.y + P1.h / 2, abs: true, label: 'Шаг 1: примитивы' }, () => {
      const p = panelIn(0);
      if (p <= 0 || panelK <= 0) return;
      ctx.save();
      ctx.globalAlpha *= Math.min(1, p * 2.5) * panelK;
      const act = cPr.began && !cH.began ? 1 : 0.3;
      drawPanel(P1, '1', p, act, C.h1);
      // огр из кубов: части выскакивают по одной
      const view: View = { cx: P1.x + P1.w / 2 + 20, cy: P1.y + P1.h - 80, size: 238, pitch: 0.12, yaw: 0.5 + Math.sin(gt * 0.4) * 0.35, dist: 10 };
      const parts = ogre(ogrePose('idle', gt * 0.4), { blocky: true }).parts;
      const shown: Part[] = [];
      parts.forEach((pt, i) => {
        const q = seg(cPr.t, 0.3 + i * 0.16, 0.35);
        if (q <= 0) return;
        const s = 0.4 + 0.6 * easeOutQuart(q);
        shown.push({ ...pt, size: [pt.size[0] * s, pt.size[1] * s, pt.size[2] * s], alpha: Math.min(1, q * 3) });
      });
      if (shown.length) {
        groundShadow(ctx, view, 0, 0, 1.0, 0.7, 0.4);
        drawModel(ctx, shown, view, {}, { edge: a(C.bg, 0.5), edgeWidth: 2 });
      }
      ctx.restore();
    });

    const buildStart = cB.start + 1.4;
    f.obj('step2', { x: P2R.x + P2R.w / 2, y: P2R.y + P2R.h / 2, abs: true, label: 'Шаг 2: голова → тело' }, () => {
      const p = panelIn(1);
      if (p <= 0 || panelK <= 0) return;
      ctx.save();
      ctx.globalAlpha *= Math.min(1, p * 2.5) * panelK;
      drawPanel(P2R, '2', p, cH.began ? 1 : 0.3, C.accent);
      const view: View = {
        cx: P2R.x + P2R.w / 2 - 30,
        cy: P2R.y + P2R.h - 80,
        size: 238,
        pitch: 0.1,
        yaw: 0.3 + Math.sin(gt * 0.35) * 0.18,
        dist: 10,
      };
      const hp = seg(cH.p, 0.35, 0.25);
      if (hp > 0) {
        // голова «прилетает» от автора справа сверху
        const e = easeOutQuart(hp);
        guides(ctx, view, seg(cB.t, 0.2, 1.2), gt);
        if (cB.t > 1.2) groundShadow(ctx, view, 0, 0, 1.0, 0.7, 0.4 * seg(cB.t, 1.2, 1));
        ctx.save();
        ctx.globalAlpha *= Math.min(1, hp * 3);
        drawModel(ctx, ogreBuild(gt, t, buildStart), view, { pos: [(1 - e) * 1.6, (1 - e) * 0.6, 0] }, { smooth: 1, ambient: 0.52 });
        ctx.restore();
      }
      ctx.restore();
    });

    // автор отдаёт голову; агент достраивает
    const whoAt: P2 = [P2R.x + P2R.w - 135, P2R.y + P2R.h - 180];
    f.obj('who2', { x: whoAt[0], y: whoAt[1], abs: true, text: 'Claude Code', label: 'Автор / агент' }, (o) => {
      if (panelK <= 0) return;
      const pa = seg(cH.t, 0, 0.6) * (1 - seg(cB.t, 0, 0.5));
      const pb = seg(cB.t, 0.3, 0.6);
      ctx.save();
      ctx.globalAlpha *= panelK;
      ctx.translate(-out2 * 260, 0);
      if (pa > 0) agentHex(ctx, whoAt[0], whoAt[1], { r: 56, p: pa, icon: 'person', color: C.accent, t: gt });
      if (pb > 0) {
        const building = t > buildStart - 0.2 && t < buildStart + BUILD.length * 0.9 + 0.3 ? 1 : 0.2;
        agentHex(ctx, whoAt[0], whoAt[1], { r: 56, p: pb, t: gt, busy: building, label: o.text, labelSize: 46 });
      }
      ctx.restore();
    });

    // ================= этап 3: образец из Tripo → следующие машины
    const toRow = easeInOutCubic(seg(cN.t, 0, 1.0));
    const unify = easeInOutCubic(seg(cSy.t, 0.2, 1.2));
    const carYaw = (i: number) => lerp(gt * 0.5 + i * 1.3, gt * 0.35 + 0.6, unify);
    const slotRect = (i: number): Rect => ({ x: SLOT_X(i), y: SLOT_Y, w: SLOT_W, h: SLOT_H });

    const sampleP = seg(cSa.t, 0.5, 0.7);
    const sRect: Rect = {
      x: lerp(SAMPLE.x, slotRect(0).x, toRow),
      y: lerp(SAMPLE.y, slotRect(0).y, toRow),
      w: lerp(SAMPLE.w, SLOT_W, toRow),
      h: lerp(SAMPLE.h, SLOT_H, toRow),
    };
    const carView = (r: Rect, scale: number): View => ({
      cx: r.x + r.w / 2,
      cy: r.y + r.h * 0.7,
      size: scale,
      pitch: 0.32,
      dist: 9,
    });

    f.obj('car:0', { x: SLOT_X(0) + SLOT_W / 2, y: SLOT_Y + SLOT_H / 2, abs: true, text: 'Tripo', label: 'Образец из Tripo' }, (o) => {
      if (sampleP <= 0) return;
      const e = easeOutQuart(sampleP);
      ctx.save();
      ctx.globalAlpha *= Math.min(1, sampleP * 2.5);
      ctx.translate(0, (1 - e) * 60);
      softLight(ctx, sRect.x + sRect.w / 2, sRect.y + sRect.h / 2, sRect.w * 0.7, C.h1, 0.12);
      viewport(ctx, sRect, () => {
        const v = carView(sRect, lerp(270, 132, toRow));
        drawGrid(ctx, v, { half: 3, step: 0.5, color: a(C.text, 0.09) });
        groundShadow(ctx, v, 0, 0, 1.5, 0.8, 0.45);
        drawModel(ctx, CARS[0], v, { ry: carYaw(0) }, { edge: a(C.bg, 0.4) });
      }, { color: C.h1 });
      chip(ctx, o.text, sRect.x + 24, sRect.y + 52, { size: lerp(56, 46, toRow), color: C.h1, icon: 'cube', p: seg(cSa.t, 1.0, 0.5) });
      ctx.restore();
    });

    // агент: образец → агент → новые машины
    f.obj('agent3', { x: AGENT3[0], y: AGENT3[1], abs: true, text: 'Claude Code', label: 'Агент (этап 3)' }, (o) => {
      const p = seg(cN.t, 0.5, 0.6);
      if (p <= 0) return;
      const busy = cN.on ? 1 : 0.2;
      flow(ctx, [SLOT_X(0) + SLOT_W / 2, SLOT_Y - 14], [SLOT_X(0) + 300, AGENT3[1] - 40], [AGENT3[0] - 90, AGENT3[1]], {
        t: gt,
        color: C.h1,
        p: seg(cN.t, 0.9, 0.6),
        n: 3,
        width: 4,
      });
      for (let i = 1; i < 4; i++) {
        const to: P2 = [SLOT_X(i) + SLOT_W / 2, SLOT_Y - 14];
        flow(ctx, [AGENT3[0], AGENT3[1] + 80], [lerp(AGENT3[0], to[0], 0.5), AGENT3[1] + 60], to, {
          t: gt,
          color: C.accent,
          p: seg(cN.t, 1.4 + i * 0.9, 0.5) * (1 - unify),
          n: 2,
          width: 4,
        });
      }
      agentHex(ctx, AGENT3[0], AGENT3[1], { r: 74, p, t: gt, busy, label: o.text, labelSize: 52 });
    });

    for (let i = 1; i < 4; i++) {
      const r = slotRect(i);
      f.obj(`car:${i}`, { x: r.x + r.w / 2, y: r.y + r.h / 2, abs: true, label: `Машина ${i + 1}` }, () => {
        const p = seg(cN.t, 1.6 + i * 0.9, 0.6);
        if (p <= 0) return;
        const e = easeOutQuart(p);
        ctx.save();
        ctx.globalAlpha *= Math.min(1, p * 2.5);
        ctx.translate(0, (1 - e) * -50);
        viewport(ctx, r, () => {
          const v = carView(r, 132);
          drawGrid(ctx, v, { half: 3, step: 0.5, color: a(C.text, 0.09) });
          groundShadow(ctx, v, 0, 0, 1.5, 0.8, 0.45);
          drawModel(ctx, CARS[i], v, { ry: carYaw(i) }, { edge: a(C.bg, 0.4) });
        }, { color: C.accent, corners: false });
        ctx.restore();
      });
    }

    // единый стиль: общая рамка и галочка
    f.obj('style', { x: 960, y: SLOT_Y + SLOT_H / 2, abs: true, label: 'Общая рамка' }, () => {
      if (unify <= 0) return;
      const x0 = SLOT_X(0) - 22;
      const x1 = SLOT_X(3) + SLOT_W + 22;
      const y0 = SLOT_Y - 22;
      const y1 = SLOT_Y + SLOT_H + 22;
      ctx.save();
      ctx.globalAlpha *= unify;
      softLight(ctx, 960, (y0 + y1) / 2, 900, C.pos, 0.1);
      ctx.strokeStyle = a(C.pos, 0.8);
      ctx.lineWidth = 3;
      ctx.setLineDash([18, 12]);
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
      ctx.setLineDash([]);
      corners(ctx, x0 - 10, y0 - 10, x1 - x0 + 20, y1 - y0 + 20, 40, C.pos, 4);
      ctx.restore();
      checkBadge(ctx, x1, y0, 50, seg(cSy.t, 0.9, 0.5));
    });
  },
};
