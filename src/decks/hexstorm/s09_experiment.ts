/**
 * Сцена 9. Условие эксперимента — без слов.
 * Человек и робот сходятся, смотрят друг на друга, жмут руки,
 * затем поднимают головы: над ними загорается знак игры и пять звёзд.
 *
 * Фигуры — плоские силуэты: сплошная заливка, глаза и прорези вырезаны фоном.
 * Анимация построена на упреждении (замах перед действием) и
 * сжатии-растяжении с затухающими колебаниями.
 */

import { clamp01, easeOutBack, easeOutCubic, easeOutQuart, seg } from '../../engine/anim.ts';
import { rrPath, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

type Ctx = CanvasRenderingContext2D;
type P = [number, number];

/** Масштаб фигур: рисуются в единичных координатах и растягиваются под кадр. */
const S = 1.45;
const GROUND = 1075;
const HAND_Y = -178;
const PERSON_X = 960 - 150 * S;
const ROBOT_X = 960 + 150 * S;
const HAND = { x: 960, y: GROUND + HAND_Y * S };

/** Затухающие колебания после удара — основа сжатия-растяжения. */
function impulse(t: number, at: number, dur = 0.7): number {
  const k = (t - at) / dur;
  if (k < 0 || k > 1) return 0;
  return Math.exp(-4.5 * k) * Math.cos(k * Math.PI * 3.4);
}

/**
 * Кривая с упреждением: сначала небольшой замах в минус, потом бросок
 * в цель с перелётом. Используется для протянутой руки и подъёма головы.
 */
function anticipate(x: number, dip = 0.22): number {
  const p = clamp01(x);
  if (p < 0.28) return -dip * Math.sin((p / 0.28) * Math.PI);
  return easeOutBack((p - 0.28) / 0.72, 1.9);
}

/** Сужающийся к концу «клин» — из таких собраны руки и ноги. */
function wedge(ctx: Ctx, from: P, to: P, wa: number, wb: number): void {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  ctx.beginPath();
  ctx.moveTo(from[0] + nx * wa, from[1] + ny * wa);
  ctx.lineTo(to[0] + nx * wb, to[1] + ny * wb);
  ctx.lineTo(to[0] - nx * wb, to[1] - ny * wb);
  ctx.lineTo(from[0] - nx * wa, from[1] - ny * wa);
  ctx.closePath();
  ctx.fill();
}

function poly(ctx: Ctx, pts: P[]): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
}

/** Рука из двух клиньев с локтем и круглой ладонью. */
function arm(ctx: Ctx, shoulder: P, hand: P, bend: number, withHand = true): void {
  const elbow: P = [
    (shoulder[0] + hand[0]) / 2 + bend * 6,
    (shoulder[1] + hand[1]) / 2 + 16,
  ];
  wedge(ctx, shoulder, elbow, 15, 10);
  wedge(ctx, elbow, hand, 10, withHand ? 7 : 4);
  // ладонь рисуем только у протянутой руки, свободная просто сходит на нет
  if (withHand) {
    ctx.beginPath();
    ctx.arc(hand[0], hand[1], 12, 0, Math.PI * 2);
    ctx.fill();
  }
}

interface Pose {
  /** 0 — рука прижата, 1 — ладонь в точке рукопожатия. */
  reach: number;
  /** 0 — смотрит на партнёра, 1 — смотрит вверх. */
  up: number;
  /** Вертикальное смещение сомкнутых ладоней. */
  dy: number;
  /** Фаза шага для покачивания при подходе. */
  step: number;
  /** Сила удара для сжатия-растяжения. */
  hit: number;
}

function stage(ctx: Ctx, x: number, pose: Pose, draw: () => void): void {
  // сжатие по вертикали компенсируется растяжением по горизонтали
  const sy = 1 - 0.16 * pose.hit + Math.sin(pose.step) * 0.02;
  const sx = 1 + 0.13 * pose.hit;
  ctx.save();
  ctx.translate(x, GROUND);
  ctx.scale(S * sx, S * sy);
  draw();
  ctx.restore();
}

/** Человек: голова с вырезанным глазом и корпус-клин, сходящийся в точку. */
function person(ctx: Ctx, x: number, pose: Pose, color: string): void {
  stage(ctx, x, pose, () => {
    ctx.fillStyle = color;
    ctx.save();
    ctx.rotate(0.05 * (1 - pose.up) + Math.sin(pose.step) * 0.012);

    // корпус: от плеч сходится в остриё у земли
    poly(ctx, [
      [-1, -255],
      [31, -215],
      [14, -17],
      [0, 0],
      [-10, -12],
      [-29, -217],
    ]);

    // дальняя рука вдоль тела
    arm(ctx, [-29, -218], [-48, -80 + Math.sin(pose.step + Math.PI) * 10], -1, false);

    // ближняя рука: на ходу висит вдоль тела и качается, потом идёт на рукопожатие
    const rest: P = [40, -78 + Math.sin(pose.step) * 12];
    const target: P = [146, HAND_Y + pose.dy];
    const hand: P = [
      rest[0] + (target[0] - rest[0]) * pose.reach,
      rest[1] + (target[1] - rest[1]) * pose.reach,
    ];
    arm(ctx, [31, -215], hand, 1, pose.reach > 0.2);

    // голова поворачивается вверх вокруг шеи
    ctx.save();
    ctx.translate(0, -252);
    ctx.rotate(-0.44 * pose.up);
    ctx.beginPath();
    ctx.arc(0, -48, 44, 0, Math.PI * 2);
    ctx.fill();
    // глаз вырезан фоном и смотрит в сторону взгляда
    ctx.fillStyle = C.bg;
    ctx.beginPath();
    ctx.arc(18 - pose.up * 5, -52 - pose.up * 8, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  });
}

/** Робот: тот же плоский силуэт, прорези на морде вырезаны фоном. */
function robot(ctx: Ctx, x: number, pose: Pose, color: string, t: number): void {
  stage(ctx, x, pose, () => {
    ctx.fillStyle = color;
    ctx.save();
    ctx.rotate(-0.05 * (1 - pose.up) - Math.sin(pose.step) * 0.012);

    // ноги-клинья
    wedge(ctx, [-30, -120], [-34, -4], 20, 14);
    wedge(ctx, [30, -120], [34, -4], 20, 14);
    poly(ctx, [
      [-58, -4],
      [-20, -4],
      [-20, 10],
      [-58, 10],
    ]);
    poly(ctx, [
      [20, -4],
      [58, -4],
      [58, 10],
      [20, 10],
    ]);

    // корпус
    rrPath(ctx, -62, -250, 124, 136, 22);
    ctx.fill();
    ctx.fillStyle = C.bg;
    ctx.beginPath();
    ctx.arc(0, -194 + Math.sin(t * 2.4) * 3, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;

    // руки
    arm(ctx, [58, -224], [104, -96 + Math.sin(pose.step) * 10], 1, false);
    const rest: P = [-52, -96 + Math.sin(pose.step + Math.PI) * 12];
    const target: P = [-146, HAND_Y + pose.dy];
    const hand: P = [
      rest[0] + (target[0] - rest[0]) * pose.reach,
      rest[1] + (target[1] - rest[1]) * pose.reach,
    ];
    arm(ctx, [-58, -222], hand, -1, pose.reach > 0.2);

    // голова
    ctx.save();
    ctx.translate(0, -250);
    ctx.rotate(0.42 * pose.up);
    poly(ctx, [
      [-5, -96],
      [5, -96],
      [5, -136],
      [-5, -136],
    ]);
    ctx.beginPath();
    ctx.arc(0, -146, 12, 0, Math.PI * 2);
    ctx.fill();
    rrPath(ctx, -58, -98, 116, 98, 24);
    ctx.fill();

    // прорези морды вырезаны фоном и смещены в сторону взгляда
    const fx = -14 + pose.up * 7;
    const fy = -50 + pose.up * -8;
    ctx.fillStyle = C.bg;
    ctx.beginPath();
    ctx.arc(fx - 18, fy - 6, 11, 0, Math.PI * 2);
    ctx.arc(fx + 18, fy - 6, 11, 0, Math.PI * 2);
    ctx.fill();
    rrPath(ctx, fx - 20, fy + 20, 40, 9, 4);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  });
}

export const scene09: SceneDef = {
  id: 's09',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cWhy = f.cue('why');
    const cTest = f.cue('test');

    // подход к центру ещё на первой реплике
    const walkP = seg(cWhy.t, 0.3, cWhy.dur * 0.8 + cTest.dur * 0.18);
    const away = (1 - easeOutCubic(walkP)) * 430;
    const step = walkP < 1 ? walkP * 26 : 0;

    // рука с замахом: сначала чуть назад, потом вперёд с перелётом
    const shakeAt = cTest.start + cTest.dur * 0.22;
    const reachRaw = seg(f.t, shakeAt - 0.75, 0.75);
    // до замаха рука опущена (0), на замахе уходит чуть в минус, затем на цель
    const reach = Math.max(-0.14, Math.min(1, anticipate(reachRaw, 0.3)));

    // удар в момент смыкания ладоней + встряхивание
    const hit = impulse(f.t, shakeAt);
    const shakeP = seg(f.t, shakeAt, 0.5);
    const dy = shakeP > 0 ? Math.sin(gt * 9) * 10 * clamp01(1.8 - shakeP * 2.2) : 0;

    // голова: короткий кивок вниз, затем взгляд вверх с перелётом
    const up = clamp01(anticipate(seg(f.t, cTest.start + cTest.dur * 0.48, 0.7), 0.3));

    const pose: Pose = { reach, up, dy, step, hit };

    // пара — один объект (руки сходятся в общей точке); опорная точка — на земле между фигурами
    f.obj('duo', { x: 960, y: GROUND, abs: true, label: 'Человек и робот' }, () => {
      ctx.save();
      ctx.globalAlpha *= clamp01(seg(cWhy.t, 0.2, 0.5));
      if (shakeP > 0) {
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(shakeP);
        softLight(ctx, HAND.x, HAND.y, 190, C.pos, 0.26);
        ctx.restore();
      }
      person(ctx, PERSON_X - away, pose, C.h1);
      robot(ctx, ROBOT_X + away, pose, C.accent, gt);
      ctx.restore();
    });

    // знак игры над ними
    const lp = seg(f.t, cTest.start + cTest.dur * 0.58, 0.6);
    f.obj('logo', { x: 960, y: 440, abs: true, label: 'Знак игры' }, () => {
      if (lp <= 0) return;
      const e = easeOutQuart(lp);
      ctx.save();
      ctx.globalAlpha *= e;
      ctx.translate(0, (1 - e) * 40);
      softLight(ctx, 960, 440, 330, C.h1, 0.16);
      ctx.shadowColor = a(C.h1, 0.5);
      ctx.shadowBlur = 38;
      icon(ctx, 'arcadia', 960, 440, 200 * (0.9 + e * 0.1), C.h1, gt);
      ctx.restore();
    });

    // звёзды зажигаются одна за другой
    const stp = seg(f.t, cTest.start + cTest.dur * 0.68, 0.7);
    f.obj('stars', { x: 960, y: 250, abs: true, label: 'Пять звёзд' }, () => {
      if (stp <= 0) return;
      for (let i = 0; i < 5; i++) {
        const p = clamp01(stp * 2.6 - i * 0.22);
        if (p <= 0) continue;
        const flash = easeOutBack(clamp01(p * 2), 3);
        ctx.save();
        ctx.globalAlpha *= clamp01(p * 3);
        ctx.shadowColor = a(C.accent, 0.6);
        ctx.shadowBlur = 20 + (1 - clamp01(p * 2)) * 50;
        icon(ctx, 'star', 650 + i * 155, 250, 94 * flash, C.accent);
        ctx.restore();
      }
    });
  },
};
