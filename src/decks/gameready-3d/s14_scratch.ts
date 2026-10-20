/**
 * Сцена 14. «Модели с нуля».
 *  1. Конвейер «картинка → Tripo → Blender»: генератор перечёркнут, стрелка идёт в обход.
 *     Карточка Blender раскрывается в окно, картинка уходит вправо как референс, агент
 *     Opus 5.5 собирает палатку игры деталь за деталью.
 *  2. Камера отъезжает: вокруг палатки — прототип DULO из реальных моделей на траве;
 *     скан показывает их треугольники. На «траве» модели гаснут, трава светится.
 *  3. Минус: сложный танк, круговые стрелки итераций, растущая шкала токенов.
 *     Затем ряд low-poly моделей игры с галочками.
 */

import { clamp01, easeInOutCubic, easeOutQuart, lerp, seg } from '../../engine/anim.ts';
import { arrow, hexPath, panel, rrPath, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import { drawGrid } from '../../engine/wire3d.ts';
import {
  camSpace,
  checkBadge,
  crossBadge,
  DARK,
  decimate,
  drawModel,
  flow,
  grassTexture,
  groundShadow,
  imageFrame,
  prop,
  strike,
  tankParts,
  titles,
  toolCard,
  toScreen,
  viewport,
  windowFrame,
  type P2,
  type Part,
  type Rect,
  type View,
} from './common.ts';
import { agentHex, bounds, drawWorld, grassGround, pieces, recolor, type WorldItem } from './kit_D.ts';

type Ctx = CanvasRenderingContext2D;

const lerpRect = (p: Rect, q: Rect, k: number): Rect => ({
  x: lerp(p.x, q.x, k),
  y: lerp(p.y, q.y, k),
  w: lerp(p.w, q.w, k),
  h: lerp(p.h, q.h, k),
});

// ---------------------------------------------------------------- раскладка

/** Этап 1: конвейер. */
const ROW_Y = 650;
const REF0: Rect = { x: 150, y: 440, w: 470, h: 420 };
const TRIPO: Rect = { x: 730, y: 540, w: 490, h: 220 };
const BLEND0: Rect = { x: 1330, y: 540, w: 440, h: 220 };
/** Этап 1б: окно Blender, референс справа, агент под ним. */
const WIN: Rect = { x: 150, y: 290, w: 1110, h: 750 };
const REF1: Rect = { x: 1340, y: 300, w: 430, h: 330 };
const AGENT: P2 = [1555, 790];
/** Этап 2: игровой вьюпорт на весь кадр. */
const GAME: Rect = { x: 150, y: 290, w: 1620, h: 750 };

const TENT = prop('tent');
const TENT_PIECES = pieces(TENT);

/** Прототип: модели игры вокруг палатки (x, z, поворот). */
const WORLD: Array<[string, number, number, number]> = [
  ['campfire', 3.2, 2.0, 0],
  ['log', 4.3, 3.4, 0.5],
  ['crates', -3.6, 1.0, 0.3],
  ['barrel', -2.5, 2.6, 0],
  ['oak', -6.6, -3.6, 0.2],
  ['pine', 6.0, -4.0, 0],
  ['pine', 9.0, -1.2, 1],
  ['oak', -10.0, 0.4, 2],
  ['pine', -2.8, -6.8, 0.5],
  ['deadtree', 10.0, -5.4, 0],
  ['rock', 6.2, 4.0, 0.7],
  ['bush', -5.8, 3.6, 0],
  ['bush', 1.6, -4.6, 1],
  ['stump', -1.2, -4.2, 0],
  ['mushrooms', -0.6, 3.6, 0],
  ['goblin', 7.6, 2.0, -1.2],
  ['alien', -7.6, 2.6, 1.0],
];
const WORLD_PARTS = WORLD.map(([name]) => prop(name));
const TANK = tankParts();
const TANK_POS: [number, number] = [-5.4, 3.4];

/** Этап 3: итерации. */
const TANK_AT: P2 = [800, 740];
const BAR: Rect = { x: 1470, y: 360, w: 130, h: 620 };
const SEGS = 16;
const ITER = 7;
const LOWPOLY = ['pine', 'rock', 'tent', 'campfire', 'crates', 'goblin'];
const LP_PARTS = LOWPOLY.map((n) => prop(n));

// ---------------------------------------------------------------- рисование

/** «Картинка-референс» палатки: плоская заливка без рёбер, тёплый фон. */
function tentPicture(ctx: Ctx, r: Rect, gt: number): void {
  imageFrame(ctx, r, () => {
    const view: View = { cx: r.x + r.w / 2, cy: r.y + r.h * 0.74, size: r.w / 6.4, pitch: 0.3, yaw: 0.55, dist: 14 };
    ctx.fillStyle = a(C.pos, 0.28);
    ctx.beginPath();
    ctx.ellipse(view.cx, view.cy + 4, r.w * 0.44, r.h * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    drawModel(ctx, TENT, view, { ry: Math.sin(gt * 0.2) * 0.04 }, { bands: 3, edge: null });
  });
}

/** Палатка, собранная наполовину: деталь «в руках» агента подсвечена. */
function tentBuild(start: number, t: number): Part[] {
  const out: Part[] = [];
  TENT_PIECES.forEach((pc, k) => {
    const p = seg(t, start + k * 0.27, 0.4);
    if (p <= 0) return;
    const e = easeOutQuart(p);
    const part: Part = { ...pc.part, pos: [pc.part.pos[0], pc.part.pos[1] + (1 - e) * 1.4, pc.part.pos[2]], alpha: Math.min(1, p * 3) };
    out.push(p < 0.85 ? recolor(part, C.accent) : part);
  });
  return out;
}

/** Круговые стрелки на «полу» вокруг модели (две дуги со стрелками). */
function ringArrows(ctx: Ctx, view: View, r: number, rot: number, front: boolean, alpha: number): void {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = C.h1;
  ctx.fillStyle = C.h1;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  for (let s = 0; s < 2; s++) {
    const a0 = rot + s * Math.PI;
    const span = Math.PI * 0.72;
    const N = 30;
    let prev: { p: P2; f: boolean } | null = null;
    for (let i = 0; i <= N; i++) {
      const ang = a0 + (span * i) / N;
      const w: [number, number, number] = [Math.cos(ang) * r, 0.05, Math.sin(ang) * r];
      const p = toScreen(w, view);
      const isFront = camSpace(w, view)[2] > 0;
      if (prev && prev.f === front && isFront === front) {
        ctx.beginPath();
        ctx.moveTo(prev.p[0], prev.p[1]);
        ctx.lineTo(p[0], p[1]);
        ctx.stroke();
      }
      prev = { p, f: isFront };
    }
    // наконечник
    const tipA = a0 + span;
    const tipW: [number, number, number] = [Math.cos(tipA) * r, 0.05, Math.sin(tipA) * r];
    if ((camSpace(tipW, view)[2] > 0) === front) {
      const tip = toScreen(tipW, view);
      const back = toScreen([Math.cos(tipA - 0.12) * r, 0.05, Math.sin(tipA - 0.12) * r], view);
      const ang = Math.atan2(tip[1] - back[1], tip[0] - back[0]);
      ctx.beginPath();
      ctx.moveTo(tip[0] + Math.cos(ang) * 22, tip[1] + Math.sin(ang) * 22);
      ctx.lineTo(tip[0] + Math.cos(ang + 2.3) * 26, tip[1] + Math.sin(ang + 2.3) * 26);
      ctx.lineTo(tip[0] + Math.cos(ang - 2.3) * 26, tip[1] + Math.sin(ang - 2.3) * 26);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Жетон токена: гекс в гексе. */
function tokenGlyph(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  hexPath(ctx, x, y, r, Math.PI / 6);
  ctx.fillStyle = a(color, 0.2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.14);
  ctx.stroke();
  hexPath(ctx, x, y, r * 0.5, Math.PI / 6);
  ctx.fillStyle = color;
  ctx.fill();
}

export const scene14: SceneDef = {
  id: 's14',

  render(f: Frame) {
    const { ctx, gt, t } = f;
    const cN = f.cue('nogen');
    const cS = f.cue('scratch');
    const cP = f.cue('proto');
    const cG = f.cue('grass');
    const cMin = f.cue('minus');
    const cT = f.cue('tokens');
    const cL = f.cue('lowpoly');

    titles(f, [{ c: cN }, { c: cS }, { c: cP }, { c: cG }, { c: cMin, text: cT.show }, { c: cL }]);

    // ---------------- переходы между этапами
    const toWin = easeInOutCubic(seg(cS.t, 0, 1.0));
    const toGame = easeInOutCubic(seg(cP.t, 0, 1.4));
    const toIter = easeInOutCubic(seg(cMin.t, 0, 0.8));
    const toRow = easeInOutCubic(seg(cL.t, 0, 0.6));

    // ================= этап 1: конвейер
    const cut = seg(cN.p, 0.42, 0.12);
    const bypass = seg(cN.p, 0.58, 0.22);

    // стрелки конвейера и обход
    f.obj('pipe', { x: 960, y: ROW_Y, abs: true, label: 'Стрелки конвейера' }, () => {
      const k = 1 - toWin;
      if (k <= 0) return;
      ctx.save();
      ctx.globalAlpha *= k;
      const pin = seg(cN.t, 0.5, 0.6);
      const dim = 1 - 0.75 * cut;
      arrow(ctx, REF0.x + REF0.w + 16, ROW_Y, TRIPO.x - 16, ROW_Y, pin, { color: a(C.h1, 0.8 * dim), width: 6, head: 22 });
      arrow(ctx, TRIPO.x + TRIPO.w + 16, ROW_Y, BLEND0.x - 16, ROW_Y, seg(cN.t, 0.8, 0.6), { color: a(C.h1, 0.8 * dim), width: 6, head: 22 });
      flow(ctx, [REF0.x + REF0.w / 2, REF0.y - 16], [960, 250], [BLEND0.x + BLEND0.w / 2, BLEND0.y - 16], {
        t: gt,
        color: C.pos,
        p: bypass,
        n: 4,
        speed: 0.45,
        r: 9,
        width: 6,
        lineAlpha: 0.7,
      });
      ctx.restore();
    });

    f.obj('tripo', { x: TRIPO.x + TRIPO.w / 2, y: TRIPO.y + TRIPO.h / 2, abs: true, text: 'Tripo', label: 'Карточка Tripo' }, (o) => {
      const p = seg(cN.t, 0.2, 0.6);
      const k = 1 - toWin;
      if (p <= 0 || k <= 0) return;
      ctx.save();
      ctx.globalAlpha *= k;
      ctx.translate(0, toWin * 160);
      toolCard(ctx, TRIPO.x, TRIPO.y, TRIPO.w, TRIPO.h, { name: o.text, icon: 'cube', color: C.h1, p, dim: cut * 0.7, t: gt });
      strike(ctx, TRIPO.x - 20, TRIPO.y + TRIPO.h + 10, TRIPO.x + TRIPO.w + 20, TRIPO.y - 10, cut, C.accent, 12);
      crossBadge(ctx, TRIPO.x + TRIPO.w, TRIPO.y, 46, seg(cN.p, 0.5, 0.1));
      ctx.restore();
    });

    // ================= этап 1б/2: окно Blender → игровой вьюпорт
    const winRect = lerpRect(BLEND0, WIN, toWin);
    f.obj('blender', { x: WIN.x + WIN.w / 2, y: WIN.y + WIN.h / 2, abs: true, text: 'Blender', label: 'Окно Blender' }, (o) => {
      const p = seg(cN.t, 0.35, 0.6);
      const k = 1 - toGame;
      if (p <= 0 || k <= 0) return;
      ctx.save();
      ctx.globalAlpha *= k;
      if (toWin < 0.5) {
        ctx.save();
        ctx.globalAlpha *= 1 - toWin * 2;
        toolCard(ctx, BLEND0.x, BLEND0.y, BLEND0.w, BLEND0.h, { name: o.text, icon: 'cube', color: C.h1, p, active: bypass, t: gt });
        ctx.restore();
      }
      if (toWin > 0) {
        ctx.save();
        ctx.globalAlpha *= clamp01(toWin * 2);
        windowFrame(ctx, winRect.x, winRect.y, winRect.w, winRect.h, { title: o.text, icon: 'cube', t: gt, glow: 0.3 });
        ctx.restore();
      }
      ctx.restore();
    });

    // мир: палатка в Blender → прототип игры
    const inner: Rect = { x: winRect.x + 14, y: winRect.y + 78 + 14, w: winRect.w - 28, h: winRect.h - 78 - 28 };
    const R = lerpRect(inner, GAME, toGame);
    const buildStart = cS.start + 1.6;
    const scan = seg(cP.t, 1.8, 3.0);
    const dimModels = easeInOutCubic(seg(cG.t, 0, 0.6));
    f.obj('world', { x: GAME.x + GAME.w / 2, y: GAME.y + GAME.h / 2, abs: true, label: 'Вьюпорт: палатка и прототип' }, () => {
      if (toWin <= 0.05 || toIter >= 1) return;
      ctx.save();
      ctx.globalAlpha *= clamp01((toWin - 0.05) * 3) * (1 - toIter);
      ctx.translate(0, -60 * toIter);
      viewport(
        ctx,
        R,
        () => {
          const ph = t - cP.start;
          const view: View = {
            cx: R.x + R.w / 2,
            cy: R.y + R.h * lerp(0.74, 0.6, toGame),
            size: lerp(150, 64, toGame),
            pitch: lerp(0.3, 0.5, toGame),
            yaw: lerp(0.55 + Math.sin(gt * 0.25) * 0.25, 0.3 + Math.max(0, ph) * 0.045, toGame),
            dist: lerp(11, 30, toGame),
          };
          softLight(ctx, view.cx, view.cy - 120, R.w * 0.6, C.h1, 0.1 * (1 - toGame));
          if (toGame < 1) {
            ctx.save();
            ctx.globalAlpha *= 1 - toGame;
            drawGrid(ctx, view, { half: 6, step: 1, color: a(C.text, 0.13), width: 1.4 });
            ctx.restore();
          }
          if (toGame > 0) {
            ctx.save();
            ctx.globalAlpha *= toGame;
            grassGround(ctx, view, {
              x0: -30,
              x1: 30,
              z0: -30,
              z1: 16,
              tile: 4,
              n: 15,
              bright: 1 + dimModels * (0.35 + 0.25 * Math.sin(gt * 5)),
            });
            ctx.restore();
          }

          const wireAt = (pos: [number, number, number]) => {
            const sx = toScreen(pos, view)[0];
            const k = scan > 0 && sx < lerp(R.x - 200, R.x + R.w + 200, scan) ? 1 : 0;
            return k * (1 - dimModels);
          };
          const raw: WorldItem[] = [];
          const tentW = wireAt([0, 0, 0]);
          raw.push({
            parts: tentBuild(buildStart, t),
            root: { pos: [0, 0, 0] },
            o: tentW > 0 ? { wire: a(C.bg, 0.6) } : {},
          });
          WORLD.forEach(([, x, z, ry], i) => {
            const p = seg(cP.t, 0.5 + i * 0.07, 0.6);
            if (p <= 0) return;
            const w = wireAt([x, 0, z]);
            raw.push({
              parts: WORLD_PARTS[i],
              root: { pos: [x, (1 - easeOutQuart(p)) * 3, z], ry },
              o: w > 0 ? { wire: a(C.bg, 0.6) } : {},
              alpha: Math.min(1, p * 3),
            });
          });
          const tp = seg(cP.t, 0.5 + WORLD.length * 0.07, 0.6);
          if (tp > 0) {
            const w = wireAt([TANK_POS[0], 0, TANK_POS[1]]);
            raw.push({
              parts: TANK,
              root: { pos: [TANK_POS[0], (1 - easeOutQuart(tp)) * 3, TANK_POS[1]], ry: -0.6 },
              o: w > 0 ? { wire: a(C.bg, 0.6) } : {},
              alpha: Math.min(1, tp * 3),
            });
          }
          // на «траве» геометрия агента уходит в тёмные силуэты — светится только трава
          const items: WorldItem[] = [];
          for (const it of raw) {
            if (dimModels < 1) items.push(it);
            if (dimModels > 0) items.push({ ...it, o: { tint: DARK, edge: null }, alpha: (it.alpha ?? 1) * dimModels * 0.85 });
          }
          // тени под всем, что стоит
          if (toGame > 0) {
            for (const it of items) {
              const pos = it.root.pos ?? [0, 0, 0];
              groundShadow(ctx, view, pos[0], pos[2], 1.1, 0.8, 0.3 * toGame * (it.alpha ?? 1));
            }
          }
          drawWorld(ctx, view, items);

          // линия скана
          if (scan > 0 && scan < 1) {
            const sx = lerp(R.x - 200, R.x + R.w + 200, scan);
            const g = ctx.createLinearGradient(sx - 90, 0, sx, 0);
            g.addColorStop(0, a(C.h1, 0));
            g.addColorStop(1, a(C.h1, 0.28));
            ctx.fillStyle = g;
            ctx.fillRect(sx - 90, R.y, 90, R.h);
            ctx.fillStyle = C.h1;
            ctx.fillRect(sx - 2, R.y, 4, R.h);
          }
          // виньетка по краям вьюпорта
          const vg = ctx.createRadialGradient(R.x + R.w / 2, R.y + R.h / 2, R.h * 0.4, R.x + R.w / 2, R.y + R.h / 2, R.w * 0.62);
          vg.addColorStop(0, a(C.bg, 0));
          vg.addColorStop(1, a(C.bg, 0.55 * toGame));
          ctx.fillStyle = vg;
          ctx.fillRect(R.x, R.y, R.w, R.h);
        },
        { color: dimModels > 0 ? C.pos : C.h1, corners: toGame > 0.5 },
      );
      ctx.restore();
    });

    // метки на прототипе: агент → (на «траве») картинка травы от человека
    const badge: P2 = [GAME.x + GAME.w - 120, GAME.y + 120];
    f.obj('maker', { x: badge[0], y: badge[1], abs: true, label: 'Агент / автор' }, () => {
      const kOut = 1 - toIter;
      if (kOut <= 0) return;
      ctx.save();
      ctx.globalAlpha *= kOut;
      const ap = seg(cP.t, 1.6, 0.6) * (1 - dimModels);
      agentHex(ctx, badge[0], badge[1], { r: 66, p: ap, t: gt, busy: scan > 0 && scan < 1 ? 1 : 0 });
      const gp = seg(cG.t, 0.2, 0.6);
      if (gp > 0) {
        const e = easeOutQuart(gp);
        ctx.save();
        ctx.globalAlpha *= Math.min(1, gp * 2.5);
        const s = 190;
        const x = badge[0] - s / 2 - 30;
        const y = badge[1] - 70 + (1 - e) * 40;
        ctx.save();
        ctx.shadowColor = a(C.pos, 0.6);
        ctx.shadowBlur = 40;
        ctx.fillStyle = C.panel;
        rrPath(ctx, x, y, s, s, 12);
        ctx.fill();
        ctx.restore();
        const img = grassTexture();
        ctx.save();
        rrPath(ctx, x, y, s, s, 12);
        ctx.clip();
        if (img) ctx.drawImage(img, 0, 0, 512, 512, x, y, s, s);
        ctx.restore();
        ctx.strokeStyle = C.pos;
        ctx.lineWidth = 4;
        rrPath(ctx, x, y, s, s, 12);
        ctx.stroke();
        // автор — человек, а не агент
        ctx.fillStyle = C.panel;
        ctx.beginPath();
        ctx.arc(x + s, y + s, 48, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = C.pos;
        ctx.lineWidth = 3;
        ctx.stroke();
        icon(ctx, 'person', x + s, y + s, 56, C.pos);
        ctx.restore();
      }
      ctx.restore();
    });

    // референс: слева в конвейере → справа от окна Blender
    const refRect = lerpRect(REF0, REF1, toWin);
    f.obj('ref', { x: REF1.x + REF1.w / 2, y: REF1.y + REF1.h / 2, abs: true, label: 'Картинка-референс' }, () => {
      const p = seg(cN.t, 0, 0.6);
      const k = 1 - toGame;
      if (p <= 0 || k <= 0) return;
      ctx.save();
      ctx.globalAlpha *= k * Math.min(1, p * 2.4);
      ctx.translate(toGame * 200, (1 - easeOutQuart(p)) * 40);
      tentPicture(ctx, refRect, gt);
      ctx.restore();
    });

    // агент Opus 5.5: референс → агент → окно
    f.obj('agent', { x: AGENT[0], y: AGENT[1], abs: true, text: 'Opus 5.5', label: 'Агент' }, (o) => {
      const p = seg(cS.t, 0.7, 0.6);
      const k = 1 - toGame;
      if (p <= 0 || k <= 0) return;
      ctx.save();
      ctx.globalAlpha *= k;
      ctx.translate(toGame * 200, 0);
      const building = t > buildStart && t < buildStart + TENT_PIECES.length * 0.27 + 0.4 ? 1 : 0.2;
      flow(ctx, [REF1.x + REF1.w / 2, REF1.y + REF1.h + 8], [AGENT[0], AGENT[1] - 120], [AGENT[0], AGENT[1] - 104], {
        t: gt,
        color: C.accent,
        p: seg(cS.t, 1.0, 0.5),
        n: 2,
        width: 4,
      });
      flow(ctx, [AGENT[0] - 100, AGENT[1]], [1330, AGENT[1] - 20], [WIN.x + WIN.w + 10, AGENT[1] - 60], {
        t: gt,
        color: C.h1,
        p: seg(cS.t, 1.2, 0.5),
        n: 3,
        speed: 0.9,
        width: 4,
      });
      agentHex(ctx, AGENT[0], AGENT[1], { r: 92, p, t: gt, busy: building, label: o.text });
      ctx.restore();
    });

    // ================= этап 3: итерации и токены
    const iterIn = easeOutQuart(seg(cMin.t, 0.4, 0.9));
    const iterK = 1 - toRow;
    const iters = Array.from({ length: ITER }, (_, i) => cT.start + 0.35 + i * 0.74);
    const done = iters.filter((x) => t >= x).length;
    const since = done > 0 ? t - iters[done - 1] : 99;
    const tView: View = { cx: TANK_AT[0], cy: TANK_AT[1], size: 215, pitch: 0.42, yaw: 0.55 + gt * 0.12, dist: 10 };
    f.obj('iterate', { x: TANK_AT[0], y: TANK_AT[1] - 120, abs: true, label: 'Модель и итерации' }, () => {
      if (iterIn <= 0 || iterK <= 0) return;
      ctx.save();
      ctx.globalAlpha *= iterIn * iterK;
      ctx.translate(-toRow * 200, (1 - iterIn) * 60);
      softLight(ctx, TANK_AT[0], TANK_AT[1] - 100, 560, done > 0 && since < 0.3 ? C.accent : C.h1, 0.14);
      const rot = gt * (cT.began ? 2.4 : 0.8);
      ringArrows(ctx, tView, 2.5, rot, false, 1);
      groundShadow(ctx, tView, 0, 0, 1.7, 1.0, 0.4);
      // каждая итерация переделывает модель: от грубой к подробной
      const cells = [0.16, 0.13, 0.11, 0.09, 0.07, 0.05, 0.035, 0];
      const parts = decimate(TANK, cells[Math.min(cells.length - 1, done)]);
      const flash = done > 0 ? clamp01(1 - since / 0.35) : 0;
      drawModel(ctx, parts, tView, { ry: -0.4, pos: [0.2, 0, 0] }, { wire: a(flash > 0 ? C.accent : C.bg, flash > 0 ? 0.9 : 0.45) });
      ringArrows(ctx, tView, 2.5, rot, true, 1);
      ctx.restore();
    });

    // шкала токенов
    f.obj('tokens', { x: BAR.x + BAR.w / 2, y: BAR.y + BAR.h / 2, abs: true, label: 'Шкала токенов' }, () => {
      if (iterIn <= 0 || iterK <= 0) return;
      ctx.save();
      ctx.globalAlpha *= iterIn * iterK;
      ctx.translate(toRow * 200, (1 - iterIn) * 60);
      const level = clamp01((done * 2.1 + seg(cT.t, 0, cT.dur) * 1.5) / SEGS) * (cT.began ? 1 : 0);
      panel(ctx, BAR.x - 16, BAR.y - 16, BAR.w + 32, BAR.h + 32, {
        fill: C.panel,
        stroke: a(C.accent, 0.4),
        lineWidth: 2,
        radius: 16,
        glow: a(C.accent, 0.1 + 0.2 * level),
        glowBlur: 50,
      });
      const sh = BAR.h / SEGS;
      for (let i = 0; i < SEGS; i++) {
        const y = BAR.y + BAR.h - (i + 1) * sh;
        const k = clamp01(level * SEGS - i);
        ctx.fillStyle = k > 0 ? a(C.accent, 0.3 + 0.7 * k) : a(C.text, 0.07);
        rrPath(ctx, BAR.x, y + 4, BAR.w, sh - 8, 6);
        ctx.fill();
      }
      tokenGlyph(ctx, BAR.x + BAR.w / 2, BAR.y - 90, 46, C.accent);
      // жетоны летят от модели в шкалу
      if (cT.on) {
        const top = BAR.y + BAR.h * (1 - level);
        for (let i = 0; i < 5; i++) {
          const k = (gt * 0.9 + i / 5) % 1;
          const from: P2 = [TANK_AT[0] + 330, TANK_AT[1] - 220];
          const to: P2 = [BAR.x - 30, top];
          const x = lerp(from[0], to[0], k);
          const y = lerp(from[1], to[1], k) - Math.sin(k * Math.PI) * 120;
          ctx.save();
          ctx.globalAlpha *= Math.sin(k * Math.PI);
          tokenGlyph(ctx, x, y, 20, C.accent);
          ctx.restore();
        }
      }
      ctx.restore();
    });

    // ================= ряд low-poly моделей с галочками
    const SLOT = (GAME.w + 40) / LOWPOLY.length;
    LOWPOLY.forEach((name, i) => {
      const cx = GAME.x - 20 + SLOT * (i + 0.5);
      const base = 800;
      f.obj(`lp:${i}`, { x: cx, y: base, abs: true, label: `Low-poly: ${name}` }, () => {
        const p = seg(cL.t, 0.35 + i * 0.12, 0.6);
        if (p <= 0) return;
        const e = easeOutQuart(p);
        ctx.save();
        ctx.globalAlpha *= Math.min(1, p * 2.5);
        ctx.translate(0, (1 - e) * 80);
        ctx.fillStyle = a(C.h1, 0.08);
        ctx.strokeStyle = a(C.h1, 0.35);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, base + 6, SLOT * 0.4, 34, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        const b = bounds(LP_PARTS[i]);
        const size = Math.min(380 / Math.max(b.h, 0.5), 250 / Math.max(b.w, b.d, 0.5));
        const view: View = { cx, cy: base, size, pitch: 0.28, dist: 12 };
        drawModel(ctx, LP_PARTS[i], view, { ry: gt * 0.5 + i * 0.9 }, { wire: a(C.bg, 0.35), wireWidth: 1 });
        checkBadge(ctx, cx, base + 96, 40, seg(cL.t, 1.4 + i * 0.16, 0.4));
        ctx.restore();
      });
    });
  },
};
