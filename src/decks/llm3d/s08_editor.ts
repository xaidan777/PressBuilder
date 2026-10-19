/**
 * Сцена 8. Редактор: курсор двигает ползунки инспектора — объект во вьюпорте
 * слушается. Затем сверху сыплются скиллы, и агент, собрав их, всё понимает.
 */

import { clamp01, easeInOutCubic, easeOutQuart, hash11, lerp, seg } from '../../engine/anim.ts';
import { rrPath } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { chip } from '../../engine/ui.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import { drawGrid, drawSolid, groundPath, MESH, project, type V3, type View } from '../../engine/wire3d.ts';
import {
  appear,
  bez,
  botHex,
  checkBadge,
  skillCard,
  viewport,
  windowFrame,
  type P2,
  type Rect,
} from './common.ts';

type Ctx = CanvasRenderingContext2D;

const WIN = { x: 150, y: 110, w: 1620, h: 640 };
const VIEW: Rect = { x: 170, y: 206, w: 1040, h: 526 };
const INSP: Rect = { x: 1232, y: 206, w: 518, h: 526 };
const TRACK = { x: INSP.x + 28, w: INSP.w - 56 };

type Keys = Array<[number, number]>;
/** Значение ползунка по ключам (прогресс реплики → положение 0..1). */
function along(p: number, keys: Keys): number {
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [p0, v0] = keys[i];
    const [p1, v1] = keys[i + 1];
    if (p <= p1) return lerp(v0, v1, easeInOutCubic((p - p0) / (p1 - p0)));
  }
  return keys[keys.length - 1][1];
}

/** Подписи полей — как в инспекторе Unity. */
const ROWS: Array<{ label: string; keys: Keys }> = [
  {
    label: 'position',
    keys: [
      [0.16, 0.5],
      [0.28, 0.88],
      [0.4, 0.3],
    ],
  },
  {
    label: 'rotation',
    keys: [
      [0.43, 0.15],
      [0.64, 0.85],
    ],
  },
  {
    label: 'scale',
    keys: [
      [0.67, 0.35],
      [0.79, 0.92],
      [0.92, 0.6],
    ],
  },
];
/** К какому ползунку тянется курсор: −1 — ещё во вьюпорте. */
const FOCUS: Keys = [
  [0.05, -1],
  [0.16, 0],
  [0.4, 0],
  [0.43, 1],
  [0.64, 1],
  [0.67, 2],
  [0.92, 2],
];
const rowTop = (i: number) => INSP.y + 96 + i * 142;
const knobOf = (i: number, v: number): P2 => [TRACK.x + TRACK.w * v, rowTop(i) + 100];

/** Скиллы ложатся по всему окну: сетка 7×2 с разбросом, а не случайная куча. */
const SKILLS = Array.from({ length: 14 }, (_, i) => ({
  x: 270 + ((i * 3) % 7) * 230 + (hash11(i * 3.7 + 1) - 0.5) * 120,
  y: 330 + (i % 2) * 250 + (hash11(i * 7.3 + 2) - 0.5) * 130,
  rot: (hash11(i * 5.1) - 0.5) * 0.9,
  size: 104 + hash11(i * 9.9) * 36,
}));
const AGENT: P2 = [1560, 900];

function inspector(ctx: Ctx, vals: number[], focus: number): void {
  ctx.fillStyle = a(C.bg, 0.55);
  rrPath(ctx, INSP.x, INSP.y, INSP.w, INSP.h, 12);
  ctx.fill();
  text(ctx, 'инспектор', INSP.x + 28, INSP.y + 64, { size: 54, color: C.h1, tracking: 1.4 });

  ROWS.forEach((r, i) => {
    const act = clamp01(1 - Math.abs(focus - i) * 2.5);
    const top = rowTop(i);
    if (act > 0.01) {
      ctx.fillStyle = a(C.h1, 0.1 * act);
      rrPath(ctx, INSP.x + 10, top + 4, INSP.w - 20, 132, 10);
      ctx.fill();
    }
    text(ctx, r.label, TRACK.x, top + 56, {
      size: 46,
      color: act > 0.5 ? C.text : a(C.text, 0.55),
      tracking: 1.2,
    });
    const [kx, ky] = knobOf(i, vals[i]);
    ctx.fillStyle = a(C.text, 0.12);
    rrPath(ctx, TRACK.x, ky - 5, TRACK.w, 10, 5);
    ctx.fill();
    ctx.fillStyle = a(C.h1, 0.5 + 0.5 * act);
    rrPath(ctx, TRACK.x, ky - 5, kx - TRACK.x, 10, 5);
    ctx.fill();
    ctx.save();
    ctx.shadowColor = a(C.h1, 0.8);
    ctx.shadowBlur = 18 * act;
    ctx.fillStyle = act > 0.5 ? C.h1 : C.text;
    ctx.beginPath();
    ctx.arc(kx, ky, 17 + 3 * act, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function world(ctx: Ctx, vals: number[], gt: number): void {
  const view: View = { cx: 690, cy: 590, size: 100, pitch: 0.5, yaw: 0.5, dist: 11 };
  drawGrid(ctx, view, { half: 6, halfZ: 5, step: 1, color: a(C.h1, 0.34), width: 1.6 });

  // пара статичных тел — чтобы было видно, что сцена «настоящая»
  drawSolid(ctx, MESH.pyramid, view, { pos: [-3.6, 0.6, -2.4], scale: 1.2, ry: 0.4 }, { color: '#8a9096' });
  drawSolid(ctx, MESH.cylinder, view, { pos: [3.4, 0.7, -2.8], scale: [1.1, 1.4, 1.1] }, { color: '#8a9096' });

  const s = 0.9 + vals[2] * 1.5;
  const pos: V3 = [(vals[0] - 0.5) * 7, s / 2, 0.6];
  const foot: Array<[number, number]> = [
    [pos[0] - s * 0.62, pos[2] - s * 0.62],
    [pos[0] + s * 0.62, pos[2] - s * 0.62],
    [pos[0] + s * 0.62, pos[2] + s * 0.62],
    [pos[0] - s * 0.62, pos[2] + s * 0.62],
  ];
  groundPath(ctx, view, foot);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
  ctx.fill();
  drawSolid(ctx, MESH.cube, view, { pos, scale: s, ry: vals[1] * 3.4 + gt * 0.25 }, { color: C.h1 });

  // оси объекта
  const axes: Array<[V3, string]> = [
    [[1, 0, 0], C.accent],
    [[0, 1, 0], C.pos],
    [[0, 0, 1], C.h1],
  ];
  const [ox, oy] = project(pos, view);
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (const [dir, color] of axes) {
    const k = s * 0.5 + 0.9;
    const [ax, ay] = project([pos[0] + dir[0] * k, pos[1] + dir[1] * k, pos[2] + dir[2] * k], view);
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ax, ay);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(ax, ay, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

export const scene08: SceneDef = {
  id: 's08',

  energy: (_t, cue) => 0.5 * seg(cue('agent').p, 0.5, 0.2),

  render(f: Frame) {
    const { ctx, gt } = f;
    const cE = f.cue('editor');
    const cS = f.cue('skills');
    const cA = f.cue('agent');

    const vals = ROWS.map((r) => along(cE.p, r.keys));
    const focus = along(cE.p, FOCUS);

    // ---- окно редактора; на реплике про агента отходит на второй план
    // вьюпорт, инспектор и курсор связаны между собой (курсор тянет ползунки) — окно целиком один объект
    f.obj(
      'window',
      { x: WIN.x + WIN.w / 2, y: WIN.y + WIN.h / 2, abs: true, text: cE.show, label: 'Окно редактора' },
      (o) => {
        ctx.save();
        ctx.globalAlpha *= 1 - 0.45 * seg(cA.t, 0, 0.5);
        appear(
          ctx,
          seg(cE.t, 0, 0.55),
          () => {
            windowFrame(ctx, WIN.x, WIN.y, WIN.w, WIN.h, { title: o.text, color: C.h1, icon: 'cube', t: gt });
            viewport(ctx, VIEW, () => world(ctx, vals, gt), { frame: false });
            inspector(ctx, vals, cE.done ? -9 : focus);

            // курсор тянется к активному ползунку
            if (cE.p > 0.04 && cE.p < 0.97) {
              const at = (i: number): P2 => (i < 0 ? [VIEW.x + VIEW.w * 0.62, VIEW.y + VIEW.h * 0.6] : knobOf(i, vals[i]));
              const lo = Math.floor(focus);
              const k = focus - lo;
              const [x0, y0] = at(lo);
              const [x1, y1] = at(Math.min(2, lo + 1));
              icon(ctx, 'cursor', lerp(x0, x1, k) + 2, lerp(y0, y1, k) + 4, 56, C.text);
            }
          },
          { from: 0.92, cx: WIN.x + WIN.w / 2, cy: WIN.y + WIN.h / 2, dy: 30 },
        );
        ctx.restore();
      },
    );

    // ---- скиллы сыплются сверху, а затем улетают к агенту
    SKILLS.forEach((sk, i) => {
      f.obj(`skill:${i}`, { x: sk.x, y: sk.y, abs: true, label: `Скилл ${i + 1}` }, () => {
        const fall = seg(cS.p, i * 0.045, 0.3);
        if (fall <= 0) return;
        const take = seg(cA.p, 0.1 + i * 0.03, 0.16);
        if (take >= 1) return;
        const e = easeOutQuart(fall);
        let x = sk.x;
        let y = sk.y - (1 - e) * 760;
        let size = sk.size;
        if (take > 0) {
          const k = easeInOutCubic(take);
          [x, y] = bez([sk.x, sk.y], [(sk.x + AGENT[0]) / 2, sk.y + 260], AGENT, k);
          size = sk.size * (1 - 0.7 * k);
        }
        skillCard(ctx, x, y, size, {
          rot: sk.rot + (1 - e) * 2.4 + take * 3,
          alpha: Math.min(1, fall * 4) * (1 - clamp01((take - 0.8) / 0.2)),
        });
      });
    });

    // ---- подписи
    const labelOut = seg(cA.t, 0, 0.35);
    f.obj('skills', { x: 150, y: 930, abs: true, text: cS.show, label: 'Подпись (скиллы)' }, (o) => {
      if (labelOut >= 1) return;
      ctx.save();
      ctx.globalAlpha *= 1 - labelOut;
      reveal(
        ctx,
        o.text,
        150,
        930,
        { size: 150, color: C.accent, tracking: 1, glowColor: a(C.accent, 0.3), glowBlur: 30 },
        seg(cS.t, 0.1, 0.5),
        { rise: 30 },
      );
      ctx.restore();
    });

    const absorbed = seg(cA.p, 0.12, 0.45);
    f.obj('agent', { x: AGENT[0], y: AGENT[1], abs: true, label: 'Агент' }, () => {
      botHex(ctx, AGENT[0], AGENT[1], {
        r: 96,
        color: absorbed > 0.95 ? C.pos : C.h1,
        p: seg(cA.t, 0, 0.45),
        t: gt,
        glow: absorbed,
      });
      checkBadge(ctx, AGENT[0] + 84, AGENT[1] - 72, 32, seg(cA.p, 0.58, 0.1));
    });

    f.obj('agentText', { x: 150, y: 880, abs: true, text: cA.show, label: 'Подпись (агент)' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        880,
        { size: 96, color: C.pos, tracking: 0.8 },
        seg(cA.p, 0.12, 0.2),
        { stagger: 0.2, rise: 26 },
      );
    });
    f.obj('where', { x: 150, y: 972, abs: true, text: 'где он работает', label: 'Плашка 1' }, (o) => {
      chip(ctx, o.text, 150, 972, { color: C.h1, size: 46, p: seg(cA.p, 0.56, 0.1) });
    });
    f.obj('what', { x: 570, y: 972, abs: true, text: 'что с этим сделать', label: 'Плашка 2' }, (o) => {
      chip(ctx, o.text, 570, 972, { color: C.h1, size: 46, p: seg(cA.p, 0.76, 0.1) });
    });
  },
};
