/**
 * Сцена 18. Видеореференс.
 * Этап 1: огр упирается в стену, за которой «Opus 5.5»; стена рушится, но по одному
 *   текстовому промпту огр двигается рывками — лента кадров-референсов выравнивает шаг.
 * Этап 2: в окне Blender огр снимается с двух ракурсов, снимки уходят в видеогенератор
 *   (Seedance 2.5, рядом Grok), из шума проявляется ролик.
 * Этап 3: ролик крупно — огр идёт по кругу, цикл; в промпт по очереди ложатся
 *   Looped Animation, Fixed Camera, Fixed Lens, Game Animation — и камера замирает.
 */

import { clamp01, easeInOutCubic, easeOutBack, easeOutQuart, hash11, lerp, seg } from '../../engine/anim.ts';
import { corners, shockRing, softLight } from '../../engine/draw.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import { chip } from '../../engine/ui.ts';
import { drawGrid, MESH } from '../../engine/wire3d.ts';
import {
  checkBadge,
  promptBox,
  CLAY,
  crossBadge,
  DARK,
  drawModel,
  flow,
  IDLE,
  M,
  mixPose,
  ogrePose,
  titles,
  toolCard,
  toScreen,
  viewport,
  windowFrame,
  type OgrePose,
  type P2,
  type Part,
  type Rect,
  type V3,
  circleGait,
  gait,
  MAGE_GAIT,
  mageJoints,
  mageWalkCycle,
  seedancePhase,
  walkCycle,
  walkRamp,
} from './common.ts';
import { sayFrac } from './kit_C.ts';
import { drawOgre, filmStrip, layer, lerpRect, ogreThumb, ogreView, promptPanel, seedanceShot, videoClip } from './kit_E.ts';

// ---------------------------------------------------------------- этап 1: стена, промпт, референсы

const S1 = ogreView(480, 940, 220, -0.5, 0.12, 9);
const WALL_X = 1.55;
const PROMPT1: Rect = { x: 1090, y: 420, w: 680, h: 200 };
const STRIP: Rect = { x: 1090, y: 700, w: 680, h: 290 };
const OPUS_AT: P2 = [1300, 560];

interface Brick {
  pos: V3;
  size: V3;
  color: string;
}

/** Стена из «кирпичей»-кубов: ряды со сдвигом, серая глина с тёмными вкраплениями. */
const BRICKS: Brick[] = [];
for (let j = 0; j < 8; j++) {
  const off = j % 2 ? 0.28 : 0;
  for (let k = 0; k < 6; k++) {
    const z = -2.9 + off + (k + 0.5) * 0.56;
    const i = BRICKS.length;
    BRICKS.push({
      pos: [WALL_X, 0.17 + j * 0.34, z],
      size: [0.34, 0.31, 0.53],
      color: hash11(i * 4.7 + 1) > 0.78 ? DARK : CLAY,
    });
  }
}

/** Кирпичи в момент времени: дрожь от ударов, затем разлёт после пролома. */
function wallParts(t: number, broken: number, shake: number): Part[] {
  const step = Math.floor(t * 30);
  return BRICKS.map((b, i) => {
    if (broken > 0) {
      const tau = broken;
      const v: V3 = [0.7 + hash11(i * 3.1) * 2.4, 0.8 + hash11(i * 5.7) * 2.6, (hash11(i * 9.3) - 0.5) * 2.6];
      const lift = b.pos[1] / 2.7;
      return {
        mesh: MESH.cube,
        pos: [b.pos[0] + v[0] * tau * (0.6 + lift), b.pos[1] + v[1] * tau - 4.9 * tau * tau, b.pos[2] + v[2] * tau],
        size: b.size,
        rot: M.chain(M.rx(tau * (hash11(i * 1.3) - 0.5) * 10), M.rz(tau * (hash11(i * 2.2) - 0.5) * 10)),
        color: b.color,
        alpha: 1 - seg(tau, 0.45, 0.5),
      };
    }
    const jx = shake * (hash11(i * 7.7 + step) - 0.5) * 0.06;
    const jy = shake * (hash11(i * 3.9 + step * 1.3) - 0.5) * 0.04;
    return { mesh: MESH.cube, pos: [b.pos[0] + jx, b.pos[1] + jy, b.pos[2]], size: b.size, color: b.color };
  });
}

/** «Анимация по текстовому промпту»: поза меняется рывками, руки уходят куда попало. */
function jerkyPose(t: number): OgrePose {
  const step = Math.floor(t * 6);
  const p = ogrePose('walk', (step / 6) * 0.85);
  const h = (k: number) => hash11(step * k + k * 3.1) - 0.5;
  return {
    ...p,
    armR: p.armR + h(1.7) * 1.8,
    armL: p.armL + h(2.3) * 1.2,
    spreadR: p.spreadR + Math.max(0, h(3.1)) * 2.2,
    spreadL: p.spreadL + Math.max(0, h(4.3)) * 1.4,
    twist: p.twist + h(0.9) * 0.6,
    lean: p.lean + h(5.3) * 0.4,
    legL: p.legL * 1.7 + h(6.1) * 0.5,
    legR: p.legR * 0.3,
    bob: p.bob + h(7.9) * 0.08,
  };
}

// ---------------------------------------------------------------- маг на этапе 1

const GAIT_X = { heading: Math.PI / 2, ...MAGE_GAIT };
const CONTACT = WALL_X - 0.5;
/** Фаза шага у стены: левая стопа встала впереди, носок правой ещё на полу (обе стопы на полу). */
const APPROACH = 1.25;
/** Фаз шага в секунду — естественный темп записи. */
const RATE = 1 / mageWalkCycle();
/** Поворот за шаг на круге, рад. */
const TURN = -0.8;
/** Начало ровной ходьбы — сек от начала реплики «референсы». */
const WALK_AT = 2.6;
/** Приставной шаг после остановки, сек; ввод в ходьбу — доля цикла. */
const CLOSE = 0.5;
const QB = 0.25;
/** Фаза старта ходьбы: правая стопа стоит под корпусом, левая только что оторвалась. */
const Q0 = 0.95;
/** Круг: курс подобран так, чтобы на старте маг смотрел туда же, куда стоял. */
let CIRC: { heading: number; turn: number; who: 'mage' } | null = null;
const circ = () => (CIRC ??= { heading: Math.PI / 2 - (circleGait(Q0, { heading: 0, turn: TURN, who: 'mage' }).root.ry ?? 0), turn: TURN, who: 'mage' });

type XZ = [number, number];
/** Щиколотка ноги в мире (x, z) при корне root и курсе ry. */
function ankleAt(pose: OgrePose, leg: 'footL' | 'footR', root: XZ, ry: number): XZ {
  const j = mageJoints(pose)[leg];
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  return [root[0] + j[0] * c + j[2] * s, root[1] - j[0] * s + j[2] * c];
}
/** Корень, при котором щиколотка ноги стоит в точке F. */
function rootAt(pose: OgrePose, leg: 'footL' | 'footR', F: XZ, ry: number): XZ {
  const j = mageJoints(pose)[leg];
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  return [F[0] - (j[0] * c + j[2] * s), F[1] - (-j[0] * s + j[2] * c)];
}
/** Стойка после остановки, правая нога на подъёме посередине приставного шага. */
const stepPose = (k: number): OgrePose => ({ ...IDLE, kneeR: IDLE.kneeR + 1.1 * Math.sin(Math.PI * k), legR: 0.3 * Math.sin(Math.PI * k) });

let M18: { start: number; end: XZ; endPose: OgrePose; FL: XZ; stop: XZ; off: XZ; FR: XZ } | null = null;
function m18() {
  if (!M18) {
    const g = gait(APPROACH, GAIT_X);
    const start = CONTACT - g.root.pos![0];
    const end: XZ = [CONTACT, g.root.pos![2]];
    const FL = ankleAt(g.pose, 'footL', end, Math.PI / 2);
    const stop = rootAt(IDLE, 'footL', FL, Math.PI / 2);
    const FR = ankleAt(IDLE, 'footR', stop, Math.PI / 2);
    // ходьба: после ввода корень — из круга со сдвигом, чтобы стык был без скачка
    const sb = circleGait(Q0 + walkRamp(QB), circ());
    const rb = rootAt(sb.pose, 'footR', FR, sb.root.ry!);
    M18 = { start, end, endPose: g.pose, FL, stop, FR, off: [rb[0] - sb.root.pos![0], rb[1] - sb.root.pos![2]] };
  }
  return M18;
}

/**
 * Маг на этапе 1 — чистая функция времени слайда. Ходьба — мокап (mage_walk.ts) с путём корпуса
 * из записи. Подход к стене → удар на месте (передняя стопа стоит) → растворяется (цикл); стена
 * рухнула в момент касания — приставной шаг: левая стопа стоит, правая встаёт рядом; рывки «по
 * промпту» на месте; успокаивается в стойку; ходьба по кругу с места — первой идёт левая нога,
 * правая стоит, пока не оторвётся по шагу.
 */
export function mageAt(
  t: number,
  gt: number,
  k: { tb: number; tText: number; tRefs: number },
): { pose: OgrePose; root: { pos: V3; ry: number }; fade: number; hitK: number; jitter: number } {
  const c = m18();
  let pose: OgrePose;
  let r: XZ;
  let ry = Math.PI / 2;
  let fade = 1;
  let hitK = 0;
  if (t < k.tb) {
    const T = (2 * APPROACH) / RATE;
    const u = ((((t - k.tb) / T + 0.5) % 1) + 1) % 1;
    if (u < 0.5) {
      const g = gait((u / 0.5) * APPROACH, GAIT_X);
      r = [c.start + g.root.pos![0], g.root.pos![2]];
      pose = g.pose;
      fade = seg(u, 0, 0.06);
    } else {
      const kk = (u - 0.5) / 0.5;
      // удар: отдача на месте (передняя стопа стоит), затем растворяется и цикл заново
      // ноги стоят как пришли (клип), отдачу играют корпус, руки и голова
      pose = { ...mixPose(c.endPose, ogrePose('hit', Math.min(0.5, kk * 0.9)), easeOutQuart(seg(kk, 0, 0.25))), walkLegW: 1 };
      r = rootAt(pose, 'footL', c.FL, ry);
      hitK = 1 - seg(kk, 0, 0.5);
      fade = 1 - seg(kk, 0.55, 0.4);
    }
  } else {
    // приставной шаг: левая стоит, правая поднимается и встаёт рядом
    // нога переносится за первые 80% шага, последние 20% — опускается на месте
    const kc = seg(t - k.tb, 0, CLOSE);
    pose = mixPose(c.endPose, stepPose(kc), easeInOutCubic(Math.min(1, kc / 0.8)));
    r = rootAt(pose, 'footL', c.FL, ry);
  }
  // рывки по текстовому промпту — на месте; к концу референсов успокаивается в стойку
  const jerk = k.tText >= 0 ? seg(k.tText, 0.4, 0.4) * (1 - easeInOutCubic(seg(k.tRefs, 1.8, 0.7))) : 0;
  if (jerk > 0) pose = mixPose(pose, jerkyPose(gt), jerk);
  const jitter = jerk > 0 ? (hash11(Math.floor(gt * 6) * 2.9) - 0.5) * 0.12 * jerk : 0;
  // ровная ходьба по кругу: правая стопа стоит, пока поза входит в шаг; дальше — путь круга
  // разгон с места: фаза набирает скорость; поза входит в шаг по времени (нога сперва поднимается на месте)
  const qr = (k.tRefs - WALK_AT) * RATE;
  const q = walkRamp(qr);
  if (qr > 0) {
    const sg = circleGait(Q0 + q, circ());
    ry = sg.root.ry ?? ry;
    if (qr < QB) {
      pose = mixPose(IDLE, sg.pose, easeInOutCubic(qr / QB));
      r = rootAt(pose, 'footR', c.FR, ry);
    } else {
      pose = sg.pose;
      r = [sg.root.pos![0] + c.off[0], sg.root.pos![2] + c.off[1]];
    }
  }
  return { pose, root: { pos: [r[0], 0, r[1]], ry }, fade, hitK, jitter };
}

// ---------------------------------------------------------------- этап 2: Blender → генератор

const BW: Rect = { x: 150, y: 290, w: 960, h: 720 };
const SHOT_T = [1.2, 3.9];
const SHOT_YAW = [0, -Math.PI / 2];
const SNAP_A: Rect[] = [
  { x: 1180, y: 400, w: 280, h: 400 },
  { x: 1490, y: 400, w: 280, h: 400 },
];
/** Оба снимка — на одной картинке для генератора: спереди и сбоку. */
const REF: Rect = { x: 110, y: 400, w: 400, h: 225 };
/** Место каждого снимка внутри общей картинки: снимок спереди — справа, сбоку — слева. */
const REF_HALF: Rect[] = [
  { x: REF.x + REF.w / 2, y: REF.y, w: REF.w / 2, h: REF.h },
  { x: REF.x, y: REF.y, w: REF.w / 2, h: REF.h },
];
const CARD: Rect = { x: 500, y: 420, w: 620, h: 180 };
const GROK: Rect = { x: 560, y: 690, w: 500, h: 140 };
const OUT_B: Rect = { x: 1230, y: 360, w: 540, h: 304 };

// ---------------------------------------------------------------- этап 3: ролик и промпт

const OUT_C: Rect = { x: 150, y: 250, w: 560, h: 315 };
/** Промпт генератора — во всю ширину под роликом. */
const PROMPT3: Rect = { x: 150, y: 600, w: 1620, h: 460 };
/** Фразы-ключи — справа от ролика, две колонки по две. */
const CHIP_POS: Array<[number, number]> = [
  [800, 330],
  [1290, 330],
  [800, 470],
  [1290, 470],
];
const PROMPT_TEXT =
  'Animate the full-body character from the reference image. The frame shows the same character twice, side by side: ' +
  'left - side view (profile), right - front view. Both figures perform the same synchronized walk cycle in place, ' +
  'like on a treadmill, without moving forward. Each figure stays in its own spot with the same scale and position, ' +
  'the two views never overlap or merge. Static locked-off camera, no zoom, no pan, no camera shake, no cuts, ' +
  'no perspective change. Full body always in frame, head to feet. Keep the background, lighting and character design ' +
  'exactly as in the reference.';
/** Фразы реплики keywords: каждая появляется, когда звучит в озвучке. */
const CHIP_WORDS = ['Looped', 'Fixed Camera', 'Fixed Lens', 'Game'];
const CHIP_AT0 = [0.3, 0.48, 0.63, 0.79];

export const scene18: SceneDef = {
  id: 's18',

  // фон вспыхивает, когда рушится стена
  energy: (t, cue) => {
    const b = cue('before');
    const tb = b.start + b.dur * 0.8;
    return t >= tb ? 0.8 * (1 - seg(t - tb, 0, 1.2)) : 0;
  },

  render(f: Frame) {
    const { ctx, gt } = f;
    const cB = f.cue('before');
    const cT = f.cue('text');
    const cR = f.cue('refs');
    const cS = f.cue('shots');
    const cSe = f.cue('send');
    const cD = f.cue('seedance');
    const cL = f.cue('loop');
    const cK = f.cue('keywords');
    const CHIP_AT = CHIP_WORDS.map((w, i) => sayFrac(cK, w, CHIP_AT0[i]));

    titles(f, [
      { c: cB, color: C.h1 },
      { c: cT, color: C.accent },
      { c: cR, color: C.pos },
      { c: cS, color: C.h1 },
      { c: cSe, color: C.accent },
      { c: cL, color: C.pos },
    ]);

    // ---- переходы между этапами
    const out1 = easeInOutCubic(seg(cS.t, -0.4, 0.8));
    const in2 = easeOutQuart(seg(cS.t, -0.1, 0.8));
    const k2 = easeInOutCubic(seg(cSe.t, -0.1, 0.9));
    const k3 = easeInOutCubic(seg(cL.t, -0.2, 1.1));

    // ================================================================ этап 1
    const tb = cB.start + cB.dur * 0.8; // пролом стены
    const broken = Math.max(0, f.t - tb);
    const turn = easeInOutCubic(seg(cT.t, 0, 0.9));
    const jerkK = seg(cT.t, 0.4, 0.4);
    const smoothK = easeInOutCubic(seg(cR.t, 2.2, 1.4));

    const m = mageAt(f.t, gt, { tb, tText: cT.began ? cT.t : -1, tRefs: cR.t });
    const pose = m.pose;
    const [px, , pz] = m.root.pos!;
    const ry = m.root.ry!;
    const fade = m.fade;
    const hitK = m.hitK;
    void turn;
    void jerkK;
    void smoothK;
    const jx = m.jitter;

    f.obj('opus', { x: OPUS_AT[0], y: OPUS_AT[1], abs: true, text: 'Opus 5.5', label: 'Opus 5.5' }, (o) => {
      const p = seg(cB.t, 0.3, 0.6);
      if (p <= 0) return;
      const move = easeInOutCubic(seg(cT.t, 0.1, 0.9));
      const x = lerp(OPUS_AT[0], PROMPT1.x, move);
      const y = lerp(OPUS_AT[1], PROMPT1.y - 56, move);
      layer(ctx, (1 - out1) * (1 - 0.35 * seg(cR.t, 0, 0.6)), () => {
        if (move < 0.5) softLight(ctx, x + 120, y, 260, C.accent, 0.18 * (1 - move * 2));
        chip(ctx, o.text, x, y, { color: C.accent, size: 54, icon: 'bolt', p });
        shockRing(ctx, x + 120, y, seg(f.t - tb, 0, 0.9), 320, C.accent, 4);
      }, -260 * out1);
    });

    f.obj('ogre', { x: 600, y: 700, abs: true, label: 'Огр' }, () => {
      layer(ctx, seg(cB.t, -0.6, 0.6) * (1 - out1), () => {
        softLight(ctx, 600, 700, 520, C.h1, 0.08);
        drawOgre(ctx, S1, pose, { pos: [px + jx, 0, pz], ry }, { alpha: fade });
        // удар о стену
        if (hitK > 0.6) {
          const [hx, hy] = toScreen([WALL_X - 0.2, 1.3, 0], S1);
          shockRing(ctx, hx, hy, 1 - hitK, 200, C.accent, 4);
        }
      }, -260 * out1);
    });

    f.obj('wall', { x: 900, y: 640, abs: true, label: 'Стена' }, () => {
      layer(ctx, seg(cB.t, -0.6, 0.6) * (1 - out1), () => {
        if (broken > 1.2) return;
        drawModel(ctx, wallParts(f.t, broken, hitK), S1, {}, { edge: a(C.bg, 0.35) });
      }, -260 * out1);
    });

    const [bx, by] = toScreen([px, 2.3, pz], S1);
    f.obj('badge', { x: bx + 250, y: by - 20, abs: true, label: 'Отметка' }, () => {
      layer(ctx, 1 - out1, () => {
        crossBadge(ctx, bx + 250, by - 20, 44, seg(cT.t, 2.2, 0.5) * (1 - seg(cR.t, 3.2, 0.3)));
        checkBadge(ctx, bx + 250, by - 20, 44, seg(cR.t, 3.5, 0.5));
      }, -260 * out1);
    });

    f.obj('prompt', { x: PROMPT1.x + PROMPT1.w / 2, y: PROMPT1.y + PROMPT1.h / 2, abs: true, label: 'Промпт' }, () => {
      const p = seg(cT.t, 0.2, 0.6);
      if (p <= 0) return;
      layer(ctx, p * (1 - out1) * (1 - 0.35 * seg(cR.t, 0, 0.6)), () => {
        promptPanel(ctx, PROMPT1.x, PROMPT1.y, PROMPT1.w, PROMPT1.h, { typed: seg(cT.t, 0.6, 1.8), color: C.h1, t: gt });
      }, -260 * out1 + 60 * (1 - easeOutQuart(p)));
    });

    f.obj('strip', { x: STRIP.x + STRIP.w / 2, y: STRIP.y + STRIP.h / 2, abs: true, label: 'Лента референсов' }, () => {
      const p = seg(cR.t, 0, 0.8);
      if (p <= 0) return;
      layer(ctx, p * (1 - out1), () => {
        filmStrip(ctx, STRIP, { cell: 200, gap: 18, scroll: f.t * 70, color: C.pos }, (i, r) => {
          ogreThumb(ctx, r, walkCycle(i * 0.25).pose, { ry: 0.9, color: C.pos, fill: 0.8 });
        });
        // референсы «втекают» в огра
        const fp = seg(cR.t, 0.8, 1.2) * (1 - seg(cR.t, 4.6, 0.6));
        const src: P2 = [STRIP.x - 10, STRIP.y + STRIP.h / 2];
        const dst: P2 = [toScreen([px, 1.3, pz], S1)[0] + 120, 760];
        flow(ctx, src, [(src[0] + dst[0]) / 2, src[1] + 60], dst, { t: gt, color: C.pos, p: fp, n: 4, r: 8, lineAlpha: 0.35 * fp });
      }, -260 * out1 + 120 * (1 - easeOutQuart(p)));
    });

    // ================================================================ этап 2
    const vp: Rect = { x: BW.x + 14, y: BW.y + 92, w: BW.w - 28, h: BW.h - 106 };
    const camYaw = lerp(0.7, 0, easeInOutCubic(seg(cS.t, 0, 0.9))) + SHOT_YAW[1] * easeInOutCubic(seg(cS.t, 2.2, 1.2));
    const S2 = ogreView(vp.x + vp.w / 2, vp.y + vp.h - 70, 205, camYaw, 0.12, 9);

    f.obj('blender', { x: BW.x + BW.w / 2, y: BW.y + BW.h / 2, abs: true, label: 'Окно Blender' }, () => {
      layer(ctx, in2 * (1 - k2), () => {
        windowFrame(ctx, BW.x, BW.y, BW.w, BW.h, { title: 'Blender', icon: 'cube', t: gt });
        viewport(ctx, vp, () => {
          drawGrid(ctx, S2, { half: 3, step: 0.5, color: a(C.text, 0.1), width: 1.2 });
          softLight(ctx, S2.cx, S2.cy - 240, 420, C.h1, 0.1);
          // серая модель во вьюпорте — как на скриншоте, который уходит в генератор
          // поза — как в первом кадре ролика Seedance (из него и сделаны скриншоты)
          drawOgre(ctx, S2, walkCycle(seedancePhase(0)).pose, {}, { tint: CLAY });
          // вспышки снимков
          SHOT_T.forEach((ts) => {
            const fl = cS.t >= ts ? 1 - seg(cS.t, ts, 0.55) : 0;
            if (fl <= 0) return;
            ctx.fillStyle = a(C.text, 0.75 * fl);
            ctx.fillRect(vp.x, vp.y, vp.w, vp.h);
          });
        }, { frame: false });
        // видоискатель
        const vf = seg(cS.t, 0.5, 0.4) * (1 - seg(cS.t, 4.6, 0.4));
        if (vf > 0) {
          ctx.save();
          ctx.globalAlpha *= vf;
          const pulse = 1 + 0.02 * Math.sin(gt * 4);
          const w = 470 * pulse;
          const h = 560 * pulse;
          corners(ctx, S2.cx - w / 2, S2.cy - h + 40, w, h, 50, C.accent, 4);
          ctx.restore();
        }
      }, -300 * k2 + 80 * (1 - in2));
    });

    // снимки: вылетают из вьюпорта направо, затем съезжаются в одну картинку (спереди + сбоку)
    const merge = easeInOutCubic(seg(cSe.t, 0.55, 0.35));
    SHOT_T.forEach((ts, i) => {
      const from: Rect = { x: S2.cx - 235, y: S2.cy - 520, w: 470, h: 560 };
      f.obj(`shot:${i}`, { x: SNAP_A[i].x + SNAP_A[i].w / 2, y: SNAP_A[i].y + SNAP_A[i].h / 2, abs: true, label: `Снимок ${i + 1}` }, () => {
        const fly = seg(cS.t, ts + 0.05, 0.9);
        if (fly <= 0 || merge >= 1) return;
        const r = lerpRect(lerpRect(from, SNAP_A[i], easeOutQuart(fly)), REF_HALF[i], k2);
        const tilt = ((1 - easeOutBack(fly)) * (i ? 0.18 : -0.18) + (i ? 0.03 : -0.03)) * (1 - k2);
        layer(ctx, clamp01(fly * 3) * (1 - merge) * (1 - k3), () => {
          // скриншот — первый кадр ролика Seedance: снимок спереди — правая панель, сбоку — левая
          seedanceShot(ctx, r, i ? 'side' : 'front', { color: C.h1, tilt });
        }, -200 * k3);
      });
    });
    f.obj('ref', { x: REF.x + REF.w / 2, y: REF.y + REF.h / 2, abs: true, label: 'Картинка для генератора' }, () => {
      if (merge <= 0) return;
      layer(ctx, merge * (1 - k3), () => seedanceShot(ctx, REF, 'all', { color: C.h1 }), -200 * k3);
    });

    // генератор: снимки → карточка → ролик
    f.obj('flow', { x: 800, y: 600, abs: true, label: 'Связи' }, () => {
      layer(ctx, 1 - k3, () => {
        const fp = seg(cSe.t, 0.5, 0.8);
        flow(ctx, [REF.x + REF.w + 6, REF.y + REF.h / 2], [(REF.x + REF.w + CARD.x) / 2, CARD.y + CARD.h / 2 - 30], [CARD.x - 6, CARD.y + CARD.h / 2], {
          t: gt,
          color: C.h1,
          p: fp,
          n: 3,
          r: 7,
        });
        flow(ctx, [CARD.x + CARD.w + 6, CARD.y + CARD.h / 2], [OUT_B.x - 40, OUT_B.y + OUT_B.h / 2], [OUT_B.x - 6, OUT_B.y + OUT_B.h / 2], {
          t: gt,
          color: C.accent,
          p: seg(cD.t, 0.2, 0.6),
          n: 3,
          r: 7,
        });
      }, -200 * k3);
    });

    f.obj('card:gen', { x: CARD.x + CARD.w / 2, y: CARD.y + CARD.h / 2, abs: true, text: 'Seedance 2.5', label: 'Карточка Seedance' }, (o) => {
      const p = seg(cSe.t, 0.2, 0.7);
      if (p <= 0) return;
      const n = Math.round(o.text.length * seg(cD.t, 0, 0.9));
      layer(ctx, 1 - k3, () => {
        toolCard(ctx, CARD.x, CARD.y, CARD.w, CARD.h, {
          name: o.text.slice(0, n),
          icon: 'play',
          color: C.accent,
          p,
          active: 0.4 + 0.6 * seg(cD.t, 0, 0.6),
          t: gt,
        });
      }, -200 * k3);
    });

    f.obj('card:grok', { x: GROK.x + GROK.w / 2, y: GROK.y + GROK.h / 2, abs: true, text: 'Grok', label: 'Карточка Grok' }, (o) => {
      const p = seg(cD.p, 0.74, 0.14);
      if (p <= 0) return;
      layer(ctx, 1 - k3, () => {
        toolCard(ctx, GROK.x, GROK.y, GROK.w, GROK.h, { name: o.text, icon: 'bolt', color: C.text, p, dim: 0.35, t: gt });
      }, -200 * k3);
    });

    // ================================================================ ролик (этапы 2–3)
    const outR = lerpRect(OUT_B, OUT_C, k3);
    f.obj('video', { x: OUT_C.x + OUT_C.w / 2, y: OUT_C.y + OUT_C.h / 2, abs: true, label: 'Ролик' }, () => {
      const p = seg(cD.t, 0.2, 0.6);
      if (p <= 0) return;
      layer(ctx, p, () => {
        if (k3 > 0) softLight(ctx, outR.x + outR.w / 2, outR.y + outR.h / 2, outR.w * 0.7, C.accent, 0.1 * k3);
        videoClip(ctx, outR, f.t, {
          gen: seg(cD.p, 0.2, 0.65),
          bar: seg(cD.p, 0.8, 0.2),
          loop: seg(cL.t, 0.8, 0.6),
          glow: seg(cK.p, CHIP_AT[0], 0.1) * (1 - seg(cK.p, CHIP_AT[0] + 0.12, 0.1)),
        });
        // «Looped Animation» — значок цикла вспыхивает
        const s = Math.max(48, outR.h * 0.13);
        shockRing(ctx, outR.x + outR.w - s * 0.9, outR.y + s * 0.9, seg(cK.p, CHIP_AT[0], 0.12), 140, C.accent, 4);
        checkBadge(ctx, outR.x + outR.w - 10, outR.y + outR.h - 10, 44, seg(cK.p, CHIP_AT[3] + 0.08, 0.08));
      });
    });

    f.obj('prompt3', { x: PROMPT3.x + PROMPT3.w / 2, y: PROMPT3.y + PROMPT3.h / 2, abs: true, text: PROMPT_TEXT, label: 'Промпт генератора' }, (o) => {
      const p = seg(cL.t, 0.3, 0.6);
      if (p <= 0) return;
      layer(ctx, p, () => {
        promptBox(ctx, o.text, PROMPT3.x, PROMPT3.y, PROMPT3.w, { p: seg(cL.t, 0.6, Math.max(3, cL.dur + cK.dur * 0.3)), size: 46, gt, color: C.accent });
      }, 80 * (1 - easeOutQuart(p)));
    });

    const words = cK.show.split(',').map((s) => s.trim());
    CHIP_AT.forEach((at, i) => {
      const [x, y] = CHIP_POS[i];
      f.obj(`chip:${i}`, { x, y, abs: true, text: words[i] ?? '', label: `Фраза ${i + 1}` }, (o) => {
        const p = seg(cK.p, at, 0.08);
        if (p <= 0) return;
        const hot = 1 - seg(cK.p, at + 0.08, 0.12);
        if (hot > 0) softLight(ctx, x + 180, y, 240, C.accent, 0.16 * hot * p);
        chip(ctx, o.text, x, y, { color: C.accent, size: 50, icon: 'check', p });
      });
    });
  },
};

