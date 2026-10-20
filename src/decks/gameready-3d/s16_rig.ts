/**
 * Сцена 16. «Риг».
 *  1. Огр стоит и пробует шагнуть. Два шага справа: (1) риг — сквозь модель проступает
 *     скелет, части окрашиваются по костям; (2) анимация — огр идёт, за ним след.
 *  2. Требования проекта: игровой экран (вид сверху, танк и огры на траве) уходит агенту;
 *     лупа показывает, что огр там — несколько десятков пикселей. Кисть со скелетом
 *     из костей на каждый палец — перечёркнута.
 *  3. Четыре карточки движений огра: ходьба, атака, урон, смерть — по мере перечисления.
 */

import { clamp01, easeInOutCubic, easeOutQuart, lerp, seg } from '../../engine/anim.ts';
import { panel, rrPath, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import { drawGrid } from '../../engine/wire3d.ts';
import {
  crossBadge,
  deathTilt,
  drawBones,
  drawModel,
  flow,
  groundShadow,
  IDLE,
  mixPose,
  OGRE,
  ogre,
  ogrePose,
  prop,
  SCREEN_BG,
  strike,
  tankParts,
  titles,
  toScreen,
  viewport,
  type Move,
  type P2,
  type Part,
  type Rect,
  type View,
  walkCycle,
  laneWalk,
  type Root,
  walkDist,
  gait,
} from './common.ts';
import { agentHex, drawWorld, grassGround, pixelBuffer, recolor, stepBadge, type WorldItem } from './kit_D.ts';

type Ctx = CanvasRenderingContext2D;

// ---------------------------------------------------------------- раскладка

const STEP1: Rect = { x: 1310, y: 330, w: 460, h: 300 };
const STEP2: Rect = { x: 1310, y: 680, w: 460, h: 300 };
const SCREEN: Rect = { x: 150, y: 300, w: 1100, h: 700 };
const AGENT: P2 = [1510, 600];
const LOUPE: P2 = [1510, 640];
const LOUPE_R = 255;
const CARD_W = 380;
const CARD_Y = 320;
const CARD_H = 680;
const CARD_X = (i: number) => 150 + i * (CARD_W + (1620 - CARD_W * 4) / 3);

/** Цвета костей при привязке геометрии. */
const BIND: Record<string, string> = { body: C.h1, armL: C.accent, armR: C.accent, legL: C.pos, legR: C.pos };

// ---------------------------------------------------------------- арена сверху

const BRUTE = prop('brute');
const GOBLIN = prop('goblin');
const PINE = prop('pine');
const OAK = prop('oak');
const ROCK = prop('rock');
const BUSH = prop('bush');

/** Огры и гоблины идут к танку: угол подхода, старт, скорость. */
const ENEMIES: Array<{ parts: Part[]; ang: number; r0: number; v: number; phase: number }> = [
  { parts: BRUTE, ang: 2.55, r0: 7.0, v: 0.18, phase: 0 },
  { parts: BRUTE, ang: 0.5, r0: 8.5, v: 0.22, phase: 0.3 },
  { parts: BRUTE, ang: -1.2, r0: 7.6, v: 0.2, phase: 0.6 },
  { parts: GOBLIN, ang: 1.5, r0: 6.4, v: 0.3, phase: 0.2 },
  { parts: GOBLIN, ang: -2.4, r0: 8.0, v: 0.28, phase: 0.7 },
  { parts: BRUTE, ang: 3.6, r0: 9.5, v: 0.24, phase: 0.45 },
];
const SCENERY: Array<[Part[], number, number, number]> = [
  [PINE, -12.5, -7.5, 0],
  [OAK, 12.0, -7.0, 1],
  [PINE, 13.5, 5.5, 2],
  [OAK, -13.0, 6.0, 0.5],
  [ROCK, -6.0, -6.5, 0.4],
  [ROCK, 7.5, 6.8, 1.4],
  [BUSH, 4.0, -7.2, 0],
  [BUSH, -8.5, 1.0, 1],
];

function arenaView(r: Rect): View {
  return { cx: r.x + r.w / 2, cy: r.y + r.h / 2 + 30, size: 34, pitch: 1.1, yaw: 0, dist: Infinity };
}

/** Фаза шага врага: темп из его скорости (за цикл шага огр проходит ≈ 1.2). */
const enemyPhase = (i: number, t: number) => ENEMIES[i].phase + (t * ENEMIES[i].v) / 1.2 * 2.5;

/** Враг идёт к танку: путь — из шага (без проскальзывания), у танка останавливается. */
function enemyWalk(i: number, t: number): { pos: [number, number, number]; walking: boolean; ph: number } {
  const e = ENEMIES[i];
  const ph = enemyPhase(i, t);
  const d = walkDist(ph) - walkDist(e.phase);
  const r = Math.max(3.2, e.r0 - d);
  return { pos: [Math.sin(e.ang) * r, 0, Math.cos(e.ang) * r], walking: r > 3.2, ph };
}

function enemyPos(i: number, t: number): [number, number, number] {
  return enemyWalk(i, t).pos;
}

function arenaItems(t: number, gt: number): WorldItem[] {
  const items: WorldItem[] = [];
  const target = enemyPos(0, t);
  items.push({
    parts: tankParts({ turret: Math.atan2(-target[2], target[0]) }),
    root: { pos: [0, 0, 0], ry: 0.4 },
  });
  ENEMIES.forEach((e, i) => {
    const w = enemyWalk(i, t);
    const pos = w.pos;
    const ry = Math.atan2(-pos[0], -pos[2]);
    const pose = w.walking ? walkCycle(w.ph).pose : ogrePose('idle', gt * 0.4 + e.phase);
    const parts = e.parts === BRUTE ? ogre(pose).parts : e.parts;
    items.push({ parts, root: { pos: [pos[0], 0, pos[2]], ry } });
  });
  for (const [parts, x, z, ry] of SCENERY) items.push({ parts, root: { pos: [x, 0, z], ry } });
  return items;
}

function drawArena(ctx: Ctx, view: View, items: WorldItem[]): void {
  grassGround(ctx, view, { x0: -24, x1: 24, z0: -16, z1: 16, tile: 4, n: 4 });
  for (const it of items) {
    const p = it.root.pos ?? [0, 0, 0];
    groundShadow(ctx, view, p[0], p[2], 1.0, 0.8, 0.35);
  }
  drawWorld(ctx, view, items);
}

// ---------------------------------------------------------------- кисть со скелетом

/** Кисть: запястье, пять пальцев по три кости (большой — две) и пястные кости. */
const WRIST: P2 = [0, 150];
const FINGERS: Array<{ base: P2; ang: number; len: number[] }> = [
  { base: [-78, 70], ang: -0.95, len: [70, 52, 40] },
  { base: [-62, -52], ang: -0.16, len: [64, 42, 32] },
  { base: [-18, -66], ang: -0.03, len: [70, 46, 34] },
  { base: [28, -58], ang: 0.1, len: [64, 42, 32] },
  { base: [68, -38], ang: 0.26, len: [50, 34, 26] },
];

function fingerJoints(): P2[][] {
  return FINGERS.map((fg) => {
    const pts: P2[] = [fg.base];
    let [x, y] = fg.base;
    fg.len.forEach((l, k) => {
      const ang = fg.ang + k * 0.06 * Math.sign(fg.ang || 1);
      x += Math.sin(ang) * l;
      y -= Math.cos(ang) * l;
      pts.push([x, y]);
    });
    return pts;
  });
}
const HAND = fingerJoints();

function bone(ctx: Ctx, p: P2, q: P2, k: number, color: string): void {
  const x2 = lerp(p[0], q[0], k);
  const y2 = lerp(p[1], q[1], k);
  const dx = x2 - p[0];
  const dy = y2 - p[1];
  const len = Math.hypot(dx, dy);
  if (len < 2) return;
  const nx = -dy / len;
  const ny = dx / len;
  const w = Math.min(14, len * 0.16);
  const mx = p[0] + dx * 0.18;
  const my = p[1] + dy * 0.18;
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  ctx.lineTo(mx + nx * w, my + ny * w);
  ctx.lineTo(x2, y2);
  ctx.lineTo(mx - nx * w, my - ny * w);
  ctx.closePath();
  ctx.fillStyle = a(color, 0.3);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
}

/** Кисть со скелетом; `x, y` — центр ладони, `bp` — появление костей. */
function handRig(ctx: Ctx, x: number, y: number, s: number, bp: number, gt: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(Math.sin(gt * 0.8) * 0.04);
  // кожа: пальцы — толстые скруглённые линии, ладонь — многоугольник
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.fillStyle = OGRE;
  ctx.strokeStyle = OGRE;
  ctx.beginPath();
  ctx.moveTo(-70, 150);
  ctx.lineTo(-105, 40);
  ctx.lineTo(-85, -75);
  ctx.lineTo(90, -60);
  ctx.lineTo(95, 60);
  ctx.lineTo(60, 150);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 34;
  ctx.stroke();
  HAND.forEach((pts, i) => {
    ctx.lineWidth = i === 0 ? 40 : i === 4 ? 30 : 34;
    ctx.beginPath();
    pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
  });

  // кости: пястные от запястья, затем фаланги — по очереди
  const all: Array<[P2, P2]> = [];
  HAND.forEach((pts) => all.push([WRIST, pts[0]]));
  HAND.forEach((pts) => pts.slice(1).forEach((q, k) => all.push([pts[k], q])));
  const each = 0.3;
  const stag = (1 - each) / (all.length - 1);
  all.forEach(([p, q], i) => {
    const k = easeOutQuart(clamp01((bp - i * stag) / each));
    if (k > 0) bone(ctx, p, q, k, C.h1);
  });
  if (bp > 0) {
    ctx.fillStyle = C.h1;
    const dots: P2[] = [WRIST, ...HAND.flat()];
    dots.forEach(([px, py]) => {
      ctx.beginPath();
      ctx.arc(px, py, 6 * Math.min(1, bp * 2), 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.restore();
}

// ---------------------------------------------------------------- сцена

export const scene16: SceneDef = {
  id: 's16',

  render(f: Frame) {
    const { ctx, gt, t } = f;
    const cMv = f.cue('move');
    const cSt = f.cue('stages');
    const cRd = f.cue('rigdef');
    const cRg = f.cue('rig');
    const cRq = f.cue('reqs');
    const cPx = f.cue('pixels');
    const cFg = f.cue('fingers');
    const cMs = f.cue('moves');

    titles(f, [{ c: cMv }, { c: cSt, text: cRd.show }, { c: cRq }, { c: cPx }, { c: cFg }, { c: cMs }]);

    const out1 = easeInOutCubic(seg(cRg.t, 0, 0.9));
    const out2 = easeInOutCubic(seg(cMs.t, 0, 0.7));

    // ================= этап 1: огр, риг, анимация
    const animAt = cRd.start + cRd.dur * 0.7;
    const xray = seg(cSt.t, 0.3, 0.6) * (1 - seg(t, animAt, 0.5));
    const bindK = seg(cRd.t, 0.3, 0.5) * (1 - seg(t, animAt - 0.4, 0.4));
    const walkT = Math.max(0, t - animAt);
    // огр идёт: путь — из шага, опорная стопа стоит на полу
    const WALK_RATE = 0.55;
    const ogreAt = (tt: number): [number, number] => {
      const g = gait(Math.max(0, tt - animAt) * WALK_RATE, { heading: Math.PI / 2 }).root.pos!;
      return [-1.0 + g[0], g[2]];
    };
    const poseAt = (tt: number) =>
      tt > animAt
        ? mixPose(ogrePose('idle', tt * 0.4), walkCycle((tt - animAt) * WALK_RATE).pose, seg(tt, animAt, 0.3))
        : ogrePose('idle', tt * 0.4);
    const view1: View = { cx: 780, cy: 975, size: 262, pitch: 0.16, yaw: -0.42, dist: 11 };

    f.obj('ogre', { x: 760, y: 700, abs: true, label: 'Огр: риг и анимация' }, () => {
      const p = seg(cMv.t, -0.2, 0.7);
      if (p <= 0 || out1 >= 1) return;
      ctx.save();
      ctx.globalAlpha *= Math.min(1, p * 2) * (1 - out1);
      ctx.translate(-out1 * 300, 0);
      softLight(ctx, 760, 650, 620, C.h1, 0.1);
      drawGrid(ctx, view1, { half: 4, step: 0.5, color: a(C.text, 0.09), width: 1.3 });
      const [x, z] = ogreAt(t);
      // след движения: прошлые позы
      if (walkT > 0) {
        for (let k = 3; k >= 1; k--) {
          const tt = t - k * 0.28;
          if (tt < animAt) continue;
          ctx.save();
          ctx.globalAlpha *= 0.32 - k * 0.08;
          const [tx, tz] = ogreAt(tt);
          drawModel(ctx, ogre(poseAt(tt)).parts, view1, { pos: [tx, 0, tz], ry: Math.PI / 2 }, { tint: C.h1, edge: null });
          ctx.restore();
        }
      }
      groundShadow(ctx, view1, x, z, 1.0, 0.75, 0.42);
      const m = ogre(poseAt(t));
      const root = { pos: [x, 0, z] as [number, number, number], ry: (Math.PI / 2) * easeInOutCubic(seg(t, animAt - 0.3, 0.5)) };
      const parts = bindK > 0.5 ? m.parts.map((pt) => recolor(pt, BIND[pt.tag ?? ''] ?? C.h1)) : m.parts;
      ctx.save();
      ctx.globalAlpha *= 1 - 0.55 * xray * (1 - bindK);
      drawModel(ctx, parts, view1, root, { wire: xray > 0.3 ? a(C.bg, 0.4) : undefined });
      ctx.restore();
      ctx.save();
      ctx.globalAlpha *= 1 - 0.5 * seg(t, animAt, 0.6);
      drawBones(ctx, m.joints, view1, root, {
        p: seg(cSt.t, 0.6, 2.2),
        color: C.h1,
        t: gt,
        focus: bindK > 0.5 ? ['shoulderL', 'shoulderR', 'hipL', 'hipR', 'neck'] : [],
      });
      ctx.restore();
      ctx.restore();
    });

    // два шага: риг → анимация
    const s1 = seg(cSt.t, 0.2, 0.6);
    const s2 = seg(cSt.t, 0.7, 0.6);
    const act1 = cSt.began && t < animAt ? 1 : 0.3;
    const act2 = t >= animAt ? 1 : 0.3;
    const stepCard = (r: Rect, n: string, p: number, act: number, draw: () => void) => {
      const e = easeOutQuart(p);
      ctx.save();
      ctx.globalAlpha *= Math.min(1, p * 2.5) * (1 - out1) * (0.55 + 0.45 * act);
      ctx.translate(out1 * 300 + (1 - e) * 60, 0);
      panel(ctx, r.x, r.y, r.w, r.h, {
        fill: C.panel,
        stroke: a(C.h1, 0.25 + 0.5 * act),
        lineWidth: 2 + act,
        radius: 18,
        glow: a(C.h1, 0.06 + 0.18 * act),
        glowBlur: 50,
      });
      stepBadge(ctx, r.x + 64, r.y + 64, n, p, act, C.h1);
      draw();
      ctx.restore();
    };
    f.obj('step:rig', { x: STEP1.x + STEP1.w / 2, y: STEP1.y + STEP1.h / 2, abs: true, label: 'Шаг 1: риг' }, () => {
      if (s1 <= 0 || out1 >= 1) return;
      stepCard(STEP1, '1', s1, act1, () => {
        const v: View = { cx: STEP1.x + STEP1.w / 2 + 50, cy: STEP1.y + STEP1.h - 34, size: 104, pitch: 0.1, yaw: 0.3, dist: 10 };
        drawBones(ctx, ogre(IDLE).joints, v, {}, { color: C.h1, width: 0.16 });
      });
    });
    f.obj('step:anim', { x: STEP2.x + STEP2.w / 2, y: STEP2.y + STEP2.h / 2, abs: true, label: 'Шаг 2: анимация' }, () => {
      if (s2 <= 0 || out1 >= 1) return;
      stepCard(STEP2, '2', s2, act2, () => {
        const v: View = { cx: STEP2.x + STEP2.w / 2 + 40, cy: STEP2.y + STEP2.h - 40, size: 92, pitch: 0.1, yaw: -0.7, dist: 10 };
        for (let k = 2; k >= 0; k--) {
          // огр идёт по карточке (путь из шага), за ним — след прошлых поз
          const lw = laneWalk(gt * 0.85 - k * 0.16, 3.2);
          ctx.save();
          ctx.globalAlpha *= (k === 0 ? 1 : 0.25 / k) * lw.alpha;
          drawModel(ctx, ogre(lw.pose).parts, v, { pos: [lw.x, 0, lw.z], ry: Math.PI / 2 }, k === 0 ? {} : { tint: C.h1, edge: null });
          ctx.restore();
        }
        icon(ctx, 'play', STEP2.x + STEP2.w - 56, STEP2.y + 60, 52, C.h1);
      });
    });

    // ================= этап 2: требования проекта → пиксели → пальцы
    const in2 = easeOutQuart(seg(cRg.t, 0.4, 0.9));
    const k2 = in2 * (1 - out2);
    const view2 = arenaView(SCREEN);
    const items = arenaItems(t, gt);
    const target = toScreen(enemyPos(0, t), view2);
    const loupeIn = seg(cPx.t, 1.0, 0.8) * (1 - seg(cFg.t, 0, 0.6));
    const handIn = seg(cFg.t, 0.3, 0.7);

    f.obj('game', { x: SCREEN.x + SCREEN.w / 2, y: SCREEN.y + SCREEN.h / 2, abs: true, label: 'Игровой экран сверху' }, () => {
      if (k2 <= 0) return;
      ctx.save();
      ctx.globalAlpha *= k2;
      ctx.translate(-out2 * 300 - (1 - in2) * 80, 0);
      viewport(ctx, SCREEN, () => drawArena(ctx, view2, items), { color: C.h1 });
      // огр под лупой
      if (loupeIn > 0) {
        ctx.save();
        ctx.globalAlpha *= clamp01(loupeIn * 2);
        ctx.strokeStyle = C.accent;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(target[0], target[1] - 18, 52, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    });

    // агент получает требования
    f.obj('agent', { x: AGENT[0], y: AGENT[1], abs: true, text: 'Claude Code', label: 'Агент' }, (o) => {
      const p = seg(cRg.t, 0.7, 0.6) * (1 - seg(cPx.t, 0.6, 0.5));
      if (p <= 0 || k2 <= 0) return;
      ctx.save();
      ctx.globalAlpha *= k2;
      flow(ctx, [SCREEN.x + SCREEN.w + 14, SCREEN.y + SCREEN.h / 2], [1330, AGENT[1] - 60], [AGENT[0] - 130, AGENT[1]], {
        t: gt,
        color: C.accent,
        p: seg(cRq.t, 0.2, 0.8),
        n: 4,
        speed: 0.7,
        width: 5,
        r: 8,
      });
      icon(ctx, 'doc', 1325, AGENT[1] - 88, 58, a(C.accent, seg(cRq.t, 0.4, 0.5)));
      agentHex(ctx, AGENT[0], AGENT[1], { r: 118, p, t: gt, busy: cRq.on ? 1 : 0, label: o.text, labelSize: 62 });
      ctx.restore();
    });

    // лупа: огр в игре — несколько десятков пикселей
    f.obj('loupe', { x: LOUPE[0], y: LOUPE[1], abs: true, label: 'Лупа: пиксели' }, () => {
      if (loupeIn <= 0 || k2 <= 0) return;
      const e = easeOutQuart(loupeIn);
      const r = LOUPE_R * (0.6 + 0.4 * e);
      ctx.save();
      ctx.globalAlpha *= Math.min(1, loupeIn * 2) * k2;
      ctx.translate(-out2 * 300, 0);
      // лучи от огра к лупе
      const tx = target[0];
      const ty = target[1] - 18;
      ctx.strokeStyle = a(C.accent, 0.55);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(tx + 37, ty - 37);
      ctx.lineTo(LOUPE[0] - r * 0.71, LOUPE[1] - r * 0.71);
      ctx.moveTo(tx + 37, ty + 37);
      ctx.lineTo(LOUPE[0] - r * 0.71, LOUPE[1] + r * 0.71);
      ctx.stroke();
      ctx.save();
      ctx.shadowColor = a(C.accent, 0.5);
      ctx.shadowBlur = 40;
      ctx.fillStyle = SCREEN_BG;
      ctx.beginPath();
      ctx.arc(LOUPE[0], LOUPE[1], r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // пиксельный рендер окрестности огра
      const N = 40;
      const REG = 112;
      const buf = pixelBuffer(N, N);
      ctx.save();
      ctx.beginPath();
      ctx.arc(LOUPE[0], LOUPE[1], r, 0, Math.PI * 2);
      ctx.clip();
      if (buf) {
        const k = N / REG;
        buf.setTransform(k, 0, 0, k, N / 2 - tx * k, N / 2 - ty * k);
        const near = items.filter((it) => {
          const pp = toScreen(it.root.pos ?? [0, 0, 0], view2);
          return Math.hypot(pp[0] - tx, pp[1] - ty) < REG * 1.6;
        });
        drawArena(buf, view2, near);
        const cell = (r * 2) / N;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(buf.canvas, LOUPE[0] - r, LOUPE[1] - r, r * 2, r * 2);
        ctx.imageSmoothingEnabled = true;
        // сетка пикселей
        ctx.strokeStyle = a(C.bg, 0.35);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 1; i < N; i++) {
          const gx = LOUPE[0] - r + i * cell;
          const gy = LOUPE[1] - r + i * cell;
          ctx.moveTo(gx, LOUPE[1] - r);
          ctx.lineTo(gx, LOUPE[1] + r);
          ctx.moveTo(LOUPE[0] - r, gy);
          ctx.lineTo(LOUPE[0] + r, gy);
        }
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(LOUPE[0], LOUPE[1], r, 0, Math.PI * 2);
      ctx.stroke();
      // ручка
      ctx.lineCap = 'round';
      ctx.lineWidth = 26;
      ctx.beginPath();
      ctx.moveTo(LOUPE[0] + r * 0.72, LOUPE[1] + r * 0.72);
      ctx.lineTo(LOUPE[0] + r * 0.72 + 70, LOUPE[1] + r * 0.72 + 70);
      ctx.stroke();
      ctx.restore();
    });

    // кисть со скелетом на каждый палец — не нужна
    const cut = seg(cFg.p, 0.66, 0.1);
    f.obj('hand', { x: LOUPE[0], y: LOUPE[1], abs: true, label: 'Кисть со скелетом' }, () => {
      if (handIn <= 0 || k2 <= 0) return;
      const e = easeOutQuart(handIn);
      ctx.save();
      ctx.globalAlpha *= Math.min(1, handIn * 2) * k2 * (1 - 0.35 * cut);
      ctx.translate(-out2 * 300, (1 - e) * 60);
      panel(ctx, LOUPE[0] - 250, LOUPE[1] - 330, 500, 640, {
        fill: C.panel,
        stroke: a(C.h1, 0.35),
        lineWidth: 2,
        radius: 20,
        glow: a(C.h1, 0.1),
        glowBlur: 50,
      });
      handRig(ctx, LOUPE[0] + 40, LOUPE[1] + 40, 1.22, seg(cFg.t, 0.7, 2.6), gt);
      ctx.restore();
    });
    f.obj('hand:cross', { x: LOUPE[0], y: LOUPE[1], abs: true, label: 'Перечёркивание кисти' }, () => {
      if (cut <= 0 || k2 <= 0) return;
      ctx.save();
      ctx.globalAlpha *= k2;
      ctx.translate(-out2 * 300, 0);
      strike(ctx, LOUPE[0] - 230, LOUPE[1] + 280, LOUPE[0] + 230, LOUPE[1] - 300, cut, C.accent, 14);
      crossBadge(ctx, LOUPE[0] + 240, LOUPE[1] - 320, 56, seg(cFg.p, 0.72, 0.1));
      ctx.restore();
    });

    // ================= этап 3: четыре движения
    const MOVES: Array<{ move: Move; at: number }> = [
      { move: 'walk', at: 0.46 },
      { move: 'attack', at: 0.56 },
      { move: 'hit', at: 0.66 },
      { move: 'death', at: 0.84 },
    ];
    MOVES.forEach((mv, i) => {
      const x = CARD_X(i);
      f.obj(`move:${i}`, { x: x + CARD_W / 2, y: CARD_Y + CARD_H / 2, abs: true, label: `Движение: ${mv.move}` }, () => {
        const slot = seg(cMs.t, 0.5 + i * 0.12, 0.5);
        if (slot <= 0) return;
        const p = seg(cMs.p, mv.at - 0.02, 0.07);
        const e = easeOutQuart(slot);
        ctx.save();
        ctx.globalAlpha *= Math.min(1, slot * 2.5);
        ctx.translate(0, (1 - e) * 60);
        if (p <= 0) {
          // пустой слот, ждёт своё слово
          ctx.strokeStyle = a(C.h1, 0.3);
          ctx.lineWidth = 3;
          ctx.setLineDash([16, 12]);
          rrPath(ctx, x, CARD_Y, CARD_W, CARD_H, 18);
          ctx.stroke();
          ctx.setLineDash([]);
          // огр уже стоит в слоте тёмным силуэтом и ждёт своё движение
          const sv: View = { cx: x + CARD_W / 2, cy: CARD_Y + CARD_H - 160, size: 128, pitch: 0.14, yaw: 0.35, dist: 10 };
          drawModel(ctx, ogre(ogrePose('idle', gt * 0.4 + i)).parts, sv, {}, { tint: '#474d57', ambient: 0.55 });
          ctx.restore();
          return;
        }
        const pe = easeOutQuart(p);
        panel(ctx, x, CARD_Y, CARD_W, CARD_H, {
          fill: C.panel,
          stroke: a(C.h1, 0.3 + 0.5 * (1 - pe) + 0.2),
          lineWidth: 2.5,
          radius: 18,
          glow: a(C.h1, 0.08 + 0.3 * (1 - pe)),
          glowBlur: 50,
        });
        const lt = t - (cMs.start + cMs.dur * mv.at);
        const view: View = { cx: x + CARD_W / 2, cy: CARD_Y + CARD_H - 160, size: 128, pitch: 0.14, yaw: 0.35, dist: 10 };
        ctx.save();
        rrPath(ctx, x, CARD_Y, CARD_W, CARD_H, 18);
        ctx.clip();
        drawGrid(ctx, view, { half: 2, step: 0.5, color: a(C.text, 0.1) });
        let phase: number;
        let rx = 0;
        if (mv.move === 'death') {
          phase = clamp01((lt % 3.2) / 1.6);
          rx = deathTilt(phase);
        } else {
          phase = lt * (mv.move === 'walk' ? 0.95 : mv.move === 'attack' ? 0.6 : 0.75);
        }
        // ходьба — по карточке, путь из шага; остальные движения — на месте
        const lw = mv.move === 'walk' ? laneWalk(phase, 3.2) : null;
        groundShadow(ctx, view, lw ? lw.x : 0, lw ? lw.z : 0, 1.0, 0.75, 0.4 * (lw ? lw.alpha : 1));
        ctx.save();
        ctx.globalAlpha *= Math.min(1, p * 2) * (lw ? lw.alpha : 1);
        ctx.translate(0, (1 - pe) * 40);
        const mvRoot: Root = lw ? { pos: [lw.x, 0, lw.z], ry: Math.PI / 2 } : { rx };
        drawModel(ctx, ogre(lw ? lw.pose : ogrePose(mv.move, phase)).parts, view, mvRoot, {});
        ctx.restore();
        ctx.restore();
        // дорожка клипа: бегущий маркер, как в редакторе анимации
        const bx = x + 40;
        const bw = CARD_W - 80;
        const by = CARD_Y + CARD_H - 64;
        ctx.fillStyle = a(C.text, 0.12);
        rrPath(ctx, bx, by - 5, bw, 10, 5);
        ctx.fill();
        const k = mv.move === 'death' ? clamp01((lt % 3.2) / 1.6) : phase - Math.floor(phase);
        ctx.fillStyle = a(C.h1, 0.6);
        rrPath(ctx, bx, by - 5, bw * k, 10, 5);
        ctx.fill();
        ctx.fillStyle = C.h1;
        ctx.beginPath();
        ctx.arc(bx + bw * k, by, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    });
  },
};
