/**
 * Сцена 13. «Не только полигоны»: весы-шкала производительности. На платформу
 * встаёт огр с видимыми треугольниками — стрелка уходит вправо; затем падают
 * гири: материал, текстура травы, стопка вызовов отрисовки — стрелка ползёт в жёлтое.
 * На «болту» весы уезжают, вместо них — маленький болт в трёх LOD, перечёркнутый.
 */

import { clamp01, easeInOutCubic, easeOutQuart, lerp, seg } from '../../engine/anim.ts';
import { panel, rrPath, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { text } from '../../engine/text.ts';
import { a, C, mix } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import { MESH } from '../../engine/wire3d.ts';
import {
  CLAY,
  crossBadge,
  drawModel,
  grassTexture,
  groundShadow,
  M,
  hero,
  ogrePose,
  SCREEN_BG,
  strike,
  titles,
  type Part,
  type View,
} from './common.ts';
import { GROUND } from './kit_D.ts';

type Ctx = CanvasRenderingContext2D;

/** Весы: корпус со шкалой, платформа сверху. */
const CX = 960;
const PLATE_Y = 660;
const PLATE = { x0: 370, x1: 1560 };
const BODY = { x: 600, y: 712, w: 720, h: 318 };
const DIAL = { x: CX, y: 1012, r: 262 };

/** Что встаёт на платформу: x центра, момент приземления (реплика, доля), вес. */
const OGRE_X = 560;
const WEIGHTS = [
  { id: 'w:mat', label: 'Материал', x: 830, at: 0.03, w: 0.17 },
  { id: 'w:tex', label: 'Текстура', x: 1085, at: 0.17, w: 0.17 },
  { id: 'w:calls', label: 'Вызовы отрисовки', x: 1370, at: 0.4, w: 0.2 },
];
const DROP = 0.55;
const OGRE_W = 0.36;

/** Падение с отскоком: смещение вверх, px (0 — стоит). */
function fall(t: number, h: number): number {
  if (t <= 0) return h;
  if (t < DROP) {
    const k = t / DROP;
    return h * (1 - k * k);
  }
  const k = clamp01((t - DROP) / 0.5);
  return h * 0.06 * Math.abs(Math.sin(k * Math.PI * 1.6)) * (1 - k);
}

/** Затухающая пружина после удара (0 до удара, 1 в покое). */
const spring = (x: number) => (x <= 0 ? 0 : 1 - Math.exp(-5 * x) * Math.cos(11 * x));
/** Вздрагивание платформы после удара. */
const jolt = (x: number) => (x <= 0 ? 0 : Math.exp(-7 * x) * Math.sin(16 * x));

// ---------------------------------------------------------------- болт и его LOD

function boltParts(lod: number): Part[] {
  const shaft = lod === 0 ? MESH.cylinder : lod === 1 ? MESH.hexPrism : MESH.cube;
  const head = lod === 2 ? MESH.cube : MESH.hexPrism;
  const parts: Part[] = [
    { mesh: shaft, pos: [0, -0.1, 0], size: lod === 2 ? [0.36, 1.7, 0.36] : [0.42, 1.7, 0.42], color: CLAY },
    { mesh: head, pos: [0, 0.9, 0], size: lod === 2 ? [0.74, 0.32, 0.74] : [0.86, 0.34, 0.86], color: CLAY },
  ];
  if (lod === 0) {
    // резьба и фаска — то, что вдали всё равно не видно
    for (let i = 0; i < 9; i++) {
      parts.push({ mesh: MESH.cylinder, pos: [0, -0.86 + i * 0.13, 0], size: [0.5, 0.05, 0.5], color: CLAY });
    }
    parts.push({ mesh: MESH.cylinder, pos: [0, 1.1, 0], size: [0.7, 0.06, 0.7], color: CLAY });
    parts.push({ mesh: MESH.cylinder, pos: [0, 0.7, 0], size: [0.96, 0.06, 0.96], rot: M.id(), color: CLAY });
  }
  return parts;
}
const BOLTS = [0, 1, 2].map(boltParts);
const LOD_W = 440;
const LOD_H = 640;
const LOD_Y = 320;
const LOD_X = (i: number) => CX - (LOD_W * 3 + 60 * 2) / 2 + i * (LOD_W + 60);

// ---------------------------------------------------------------- гири

function materialBall(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.save();
  ctx.shadowColor = a(C.h1, 0.35);
  ctx.shadowBlur = 30;
  const g = ctx.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.05, x, y, r);
  g.addColorStop(0, C.text);
  g.addColorStop(0.25, C.h1);
  g.addColorStop(1, mix(C.h1, C.bg, 0.78));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // отражение «окна» — признак материала, а не просто круга
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = a(C.text, 0.1);
  ctx.beginPath();
  ctx.ellipse(x + r * 0.15, y + r * 0.7, r * 0.7, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = a(C.text, 0.9);
  ctx.beginPath();
  ctx.ellipse(x - r * 0.4, y - r * 0.45, r * 0.16, r * 0.1, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

function grassTile(ctx: Ctx, x: number, y: number, s: number): void {
  const img = grassTexture();
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = GROUND;
  rrPath(ctx, x - s / 2, y - s, s, s, 8);
  ctx.fill();
  ctx.restore();
  ctx.save();
  rrPath(ctx, x - s / 2, y - s, s, s, 8);
  ctx.clip();
  if (img) ctx.drawImage(img, 0, 0, 512, 512, x - s / 2, y - s, s, s);
  ctx.restore();
  ctx.strokeStyle = a(C.text, 0.75);
  ctx.lineWidth = 3;
  rrPath(ctx, x - s / 2, y - s, s, s, 8);
  ctx.stroke();
}

/** Стопка кадров: каждый — отдельный вызов отрисовки со своей фигуркой. */
function callStack(ctx: Ctx, x: number, y: number, t: number): void {
  const w = 200;
  const h = 146;
  const n = 4;
  const shapes = [C.accent, C.pos, C.h1, C.text];
  for (let i = n - 1; i >= 0; i--) {
    const bx = x - w / 2 + i * 20 - 30;
    const by = y - h - i * 32;
    panel(ctx, bx, by, w, h, { fill: SCREEN_BG, stroke: a(C.h1, 0.75), lineWidth: 2.5, radius: 10 });
    if (i === 0) {
      // верхний кадр: треугольник, мигающий как «вызов»
      const k = 0.6 + 0.4 * Math.sin(t * 5);
      ctx.fillStyle = a(shapes[0], k);
      ctx.beginPath();
      ctx.moveTo(bx + w / 2, by + 28);
      ctx.lineTo(bx + w / 2 + 48, by + h - 28);
      ctx.lineTo(bx + w / 2 - 48, by + h - 28);
      ctx.closePath();
      ctx.fill();
    }
  }
}

export const scene13: SceneDef = {
  id: 's13',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cP = f.cue('perf');
    const cM = f.cue('materials');
    const cB = f.cue('bolt');

    titles(f, [{ c: cP }, { c: cM }, { c: cB }]);

    // ---- этап 1: весы
    const out = easeInOutCubic(seg(cB.t, 0, 0.55));
    const show = seg(cP.t, 0, 0.7);
    const ogreLand = cP.start + 1.0 + DROP;
    const lands = WEIGHTS.map((w) => cM.start + cM.dur * w.at + DROP);
    const localT = f.t;
    const load =
      OGRE_W * spring(localT - ogreLand) + WEIGHTS.reduce((s, w, i) => s + w.w * spring(localT - lands[i]), 0);
    const dip =
      18 * jolt(localT - ogreLand) + lands.reduce((s, at) => s + 14 * jolt(localT - at), 0) + 22 * clamp01(load);

    ctx.save();
    ctx.globalAlpha *= 1 - out;
    ctx.translate(0, out * 140);

    f.obj('scale', { x: CX, y: BODY.y + BODY.h / 2, abs: true, label: 'Весы' }, () => {
      if (show <= 0 || out >= 1) return;
      ctx.save();
      ctx.globalAlpha *= easeOutQuart(show);
      ctx.translate(0, (1 - easeOutQuart(show)) * 60);
      softLight(ctx, CX, 760, 820, lerp(0, 1, load) > 0.6 ? C.accent : C.h1, 0.08 + 0.08 * load);
      // стойка и платформа
      ctx.fillStyle = mix(C.panel, C.text, 0.12);
      ctx.fillRect(CX - 34, PLATE_Y + dip, 68, BODY.y - PLATE_Y - dip + 4);
      panel(ctx, PLATE.x0, PLATE_Y + dip, PLATE.x1 - PLATE.x0, 22, {
        fill: mix(C.panel, C.text, 0.22),
        stroke: a(C.text, 0.4),
        lineWidth: 2,
        radius: 8,
      });
      // корпус и шкала
      panel(ctx, BODY.x, BODY.y, BODY.w, BODY.h, {
        fill: C.panel,
        stroke: a(C.h1, 0.4),
        lineWidth: 2,
        radius: 26,
        glow: a(C.h1, 0.12),
        glowBlur: 50,
      });
      ctx.save();
      rrPath(ctx, BODY.x, BODY.y, BODY.w, BODY.h, 26);
      ctx.clip();
      const A0 = Math.PI + 0.22;
      const A1 = Math.PI * 2 - 0.22;
      const N = 26;
      for (let i = 0; i <= N; i++) {
        const k = i / N;
        const ang = lerp(A0, A1, k);
        const big = i % 5 === 0;
        const r0 = DIAL.r - (big ? 46 : 30);
        ctx.strokeStyle = mix(C.pos, C.accent, k);
        ctx.lineWidth = big ? 7 : 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(DIAL.x + Math.cos(ang) * r0, DIAL.y + Math.sin(ang) * r0);
        ctx.lineTo(DIAL.x + Math.cos(ang) * (DIAL.r - 8), DIAL.y + Math.sin(ang) * (DIAL.r - 8));
        ctx.stroke();
      }
      // стрелка
      const ang = lerp(A0, A1, clamp01(0.03 + load));
      ctx.save();
      ctx.shadowColor = a(C.text, 0.5);
      ctx.shadowBlur = 12;
      ctx.strokeStyle = C.text;
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(DIAL.x, DIAL.y);
      ctx.lineTo(DIAL.x + Math.cos(ang) * (DIAL.r - 36), DIAL.y + Math.sin(ang) * (DIAL.r - 36));
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = C.text;
      ctx.beginPath();
      ctx.arc(DIAL.x, DIAL.y, 22, 0, Math.PI * 2);
      ctx.fill();
      icon(ctx, 'bolt', DIAL.x, DIAL.y - 118, 84, a(mix(C.pos, C.accent, clamp01(load * 1.2)), 0.9));
      ctx.restore();
      ctx.restore();
    });

    // огр с треугольниками
    f.obj('ogre', { x: OGRE_X, y: PLATE_Y, abs: true, label: 'Модель (треугольники)' }, () => {
      const t = localT - (ogreLand - DROP);
      if (show <= 0 || t <= 0 || out >= 1) return;
      const up = fall(t, 520);
      const view: View = { cx: OGRE_X, cy: PLATE_Y + dip - up, size: 168, pitch: 0.12, dist: 10 };
      ctx.save();
      ctx.globalAlpha *= clamp01(t * 4);
      groundShadow(ctx, { ...view, cy: PLATE_Y + dip }, 0, 0, 0.8, 0.5, 0.45 * clamp01(1 - up / 300));
      const m = hero('wizard', ogrePose('idle', gt * 0.4));
      drawModel(ctx, m.parts, view, { ry: 0.5 + Math.sin(gt * 0.5) * 0.5 }, { wire: a(C.bg, 0.65), wireWidth: 1.3 });
      ctx.restore();
    });

    // гири
    WEIGHTS.forEach((w, i) => {
      f.obj(w.id, { x: w.x, y: PLATE_Y, abs: true, label: w.label }, () => {
        const t = localT - (lands[i] - DROP);
        if (t <= 0 || out >= 1) return;
        const y = PLATE_Y + dip - fall(t, 560);
        ctx.save();
        ctx.globalAlpha *= clamp01(t * 4);
        if (i === 0) materialBall(ctx, w.x, y - 102, 100);
        else if (i === 1) grassTile(ctx, w.x, y, 200);
        else callStack(ctx, w.x, y, gt);
        ctx.restore();
      });
    });
    ctx.restore();

    // ---- этап 2: болт в трёх LOD — перечёркнут
    BOLTS.forEach((parts, i) => {
      const p = seg(cB.t, 0.35 + i * 0.16, 0.5);
      const x = LOD_X(i);
      f.obj(`lod:${i}`, { x: x + LOD_W / 2, y: LOD_Y + LOD_H / 2, abs: true, text: `LOD${i}`, label: `Болт LOD${i}` }, (o) => {
        if (p <= 0) return;
        const e = easeOutQuart(p);
        ctx.save();
        ctx.globalAlpha *= Math.min(1, p * 2.5);
        ctx.translate(0, (1 - e) * 70);
        panel(ctx, x, LOD_Y, LOD_W, LOD_H, {
          fill: SCREEN_BG,
          stroke: a(C.h1, 0.45),
          lineWidth: 2,
          radius: 16,
          glow: a(C.h1, 0.1),
          glowBlur: 40,
        });
        const view: View = { cx: x + LOD_W / 2, cy: LOD_Y + 270, size: 150, pitch: 0.25, dist: 8 };
        softLight(ctx, view.cx, view.cy, 240, C.h1, 0.1);
        drawModel(ctx, parts, view, { rz: -0.75, ry: gt * 0.9 + i * 0.4 }, { edge: a(C.bg, 0.55), edgeWidth: 1.6 });
        text(ctx, o.text, x + LOD_W / 2, LOD_Y + LOD_H - 44, { size: 64, color: C.h1, align: 'center', tracking: 2, caps: 'normal' });
        ctx.restore();
      });
    });

    const cut = seg(cB.t, 1.35, 0.5);
    const x0 = LOD_X(0) - 40;
    const x1 = LOD_X(2) + LOD_W + 40;
    f.obj('strike', { x: CX, y: LOD_Y + LOD_H / 2, abs: true, label: 'Перечёркивание' }, () => {
      if (cut <= 0) return;
      strike(ctx, x0, LOD_Y + LOD_H * 0.72, x1, LOD_Y + LOD_H * 0.28, cut, C.accent, 12);
      crossBadge(ctx, x1 - 10, LOD_Y - 10, 52, seg(cB.t, 1.75, 0.4));
    });
  },
};
