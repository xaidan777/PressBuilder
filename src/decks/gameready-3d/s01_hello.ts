/**
 * Сцена 1. Вступление.
 *   hi      — приветствие на фоне вращающейся квадовой сетки;
 *   name    — сетка уходит в гекс-аватар, рядом имя и значки канала;
 *   real    — живой кадр игры DULO: танк среди деревьев, огр и гоблин, облёт камеры;
 *   before  — плитки «код» и 2D-арт, карточка HEXSTORM: Tears of Arcadia;
 *   today   — всё уходит, плоский квадрат выдавливается в куб и становится магом, слева — «3D модели».
 */

import { clamp01, easeInOutCubic, easeOutBack, hash11, lerp, seg } from '../../engine/anim.ts';
import { hexPath, panel, rrPath, shockRing, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { measure, text } from '../../engine/text.ts';
import { a, C, W } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import { MESH } from '../../engine/wire3d.ts';
import {
  drawModel,
  crystal,
  flow,
  groundShadow,
  headline,
  imageFrame,
  mage,
  ogrePose,
  prop,
  tankParts,
  textBacking,
  titles,
  viewport,
  type Part,
  type Rect,
  type View,
} from './common.ts';
import { grassGround, pixelSprite, place, stage } from './kit_A.ts';

type Ctx = CanvasRenderingContext2D;


/** Аватар: центр гекса с сеткой. */
const AV = { x: 450, y: 560, r: 210 };
/** Кадр игры. */
const GAME: Rect = { x: 150, y: 300, w: 1620, h: 730 };
/** Плитки «раньше» и карточка игры. */
const T_CODE: Rect = { x: 150, y: 300, w: 560, h: 345 };
const T_ART: Rect = { x: 150, y: 685, w: 560, h: 345 };
const CARD: Rect = { x: 830, y: 300, w: 940, h: 730 };

// ---------------------------------------------------------------- сцена игры DULO

const TANK_K = 2.2 / 1.5; // tankParts — в масштабе 1.5, модели prop — 2.2: возвращаем игровые пропорции
const TANK_POS: [number, number, number] = [-0.4, 0, 0.6];
const GOB_POS: [number, number, number] = [-3.6, 0, 2.4];
const faceTo = (from: [number, number, number], to: [number, number, number]) => Math.atan2(to[0] - from[0], to[2] - from[2]);

/** Неподвижное окружение: деревья, камни, кусты — собирается один раз. */
const WORLD: Part[] = [
  ...place(prop('oak'), { pos: [-2.6, 0, -3.4], ry: 0.4 }),
  ...place(prop('oak'), { pos: [4.6, 0, -2.9], ry: 2.1, scale: 0.9 }),
  ...place(prop('pine'), { pos: [-6.2, 0, -1.2], ry: 1.0, scale: 1.05 }),
  ...place(prop('pine'), { pos: [1.2, 0, -5.4], ry: 0.2, scale: 1.15 }),
  ...place(prop('pine'), { pos: [7.0, 0, 0.2], ry: 2.6, scale: 0.85 }),
  ...place(prop('rock'), { pos: [1.6, 0, 3.9], ry: 0.7, scale: 0.8 }),
  ...place(prop('bush'), { pos: [-1.9, 0, 3.6], ry: 1.3 }),
  ...place(prop('bush'), { pos: [5.6, 0, 3.0], ry: 0.3, scale: 0.8 }),
  ...place(prop('stump'), { pos: [-4.6, 0, -0.2], ry: 0.5, scale: 0.9 }),
  ...place(prop('mushrooms'), { pos: [-2.0, 0, -2.3], ry: 0.4, scale: 1.4 }),
  ...place(prop('grass'), { pos: [0.6, 0, 3.2], ry: 0.2, scale: 1.2 }),
  ...place(prop('grass'), { pos: [-3.0, 0, 0.9], ry: 1.2, scale: 1.2 }),
  ...place(prop('grass'), { pos: [2.6, 0, -1.2], ry: 2.2, scale: 1.2 }),
  ...place(prop('log'), { pos: [-5.0, 0, 3.6], ry: 0.9, scale: 0.8 }),
];
const GOBLIN: Part[] = place(prop('goblin'), { pos: GOB_POS, ry: faceTo(GOB_POS, TANK_POS) });

function gameScene(ctx: Ctx, r: Rect, t: number, gt: number): void {
  const view: View = {
    cx: r.x + r.w / 2,
    cy: r.y + r.h * 0.66,
    size: 84,
    pitch: 0.36,
    yaw: -0.5 + t * 0.065,
    dist: 20,
  };
  softLight(ctx, r.x + r.w / 2, r.y + r.h * 0.2, r.w * 0.55, C.h1, 0.1);
  grassGround(ctx, view, 9.5, { tile: 4.5 });

  // танк водит башней за гоблином
  const tankYaw = 0.3;
  const toGob = Math.atan2(-(GOB_POS[2] - TANK_POS[2]), GOB_POS[0] - TANK_POS[0]);
  const turret = toGob - tankYaw + Math.sin(gt * 0.9) * 0.22;
  const tank = place(tankParts({ turret, barrel: 0.06 }), { pos: TANK_POS, ry: tankYaw, scale: TANK_K });

  groundShadow(ctx, view, TANK_POS[0], TANK_POS[2], 2.0, 1.4, 0.45);
  groundShadow(ctx, view, GOB_POS[0], GOB_POS[2], 0.6, 0.5, 0.4);
  drawModel(ctx, [...WORLD, ...GOBLIN, ...tank], view, {}, { edge: null });
}

// ---------------------------------------------------------------- плитки «раньше»

/** Код: строки-токены печатаются по очереди. */
const CODE_ROWS: Array<Array<[number, string]>> = [
  [[0.26, C.h1], [0.48, C.text]],
  [[0.16, C.accent], [0.4, C.text], [0.22, C.pos]],
  [[0.14, C.text], [0.3, C.h1], [0.36, C.text]],
  [[0.14, C.text], [0.24, C.accent], [0.3, C.pos]],
  [[0.14, C.text], [0.5, C.text]],
  [[0.18, C.accent]],
];
const INDENT = [0, 0, 1, 1, 1, 0];

function codeTile(ctx: Ctx, r: Rect, p: number, gt: number): void {
  panel(ctx, r.x, r.y, r.w, r.h, {
    fill: C.panel,
    stroke: a(C.h1, 0.4),
    lineWidth: 2,
    radius: 18,
    glow: a(C.h1, 0.12),
    glowBlur: 50,
    accentBar: { color: C.h1, width: 6 },
  });
  // иконка в гексе
  const hx = r.x + 92;
  const hy = r.y + r.h / 2;
  hexPath(ctx, hx, hy, 58, Math.PI / 6);
  ctx.strokeStyle = a(C.h1, 0.6);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  icon(ctx, 'code', hx, hy, 64, C.h1, gt);

  const x0 = r.x + 190;
  const wMax = r.w - 230;
  const typed = clamp01(p) * CODE_ROWS.length;
  let caret: [number, number] | null = null;
  CODE_ROWS.forEach((row, j) => {
    const k = clamp01(typed - j);
    if (k <= 0) return;
    const y = r.y + 50 + j * 46;
    let x = x0 + INDENT[j] * 40;
    const total = row.reduce((s, [w]) => s + w, 0);
    let left = k * total;
    for (const [w, col] of row) {
      const ww = Math.min(w, left);
      left -= w;
      if (ww <= 0) break;
      ctx.fillStyle = a(col, 0.85);
      rrPath(ctx, x, y, wMax * ww, 24, 12);
      ctx.fill();
      x += wMax * w + 16;
      if (k < 1) caret = [x0 + INDENT[j] * 40 + wMax * (k * total) + 10, y];
    }
  });
  const c = caret as [number, number] | null;
  if (c || Math.sin(gt * 7) > 0) {
    const last = CODE_ROWS.length - 1;
    const [cx, cy] = c ?? [x0 + wMax * 0.18 + 20, r.y + 50 + last * 46];
    ctx.fillStyle = C.h1;
    ctx.fillRect(cx, cy - 6, 5, 32);
  }
}

/** 2D-арт: плоская картинка — холмы, солнце и пиксельный монстрик. */
function artTile(ctx: Ctx, r: Rect, gt: number): void {
  imageFrame(
    ctx,
    r,
    () => {
      ctx.fillStyle = a(C.accent, 0.85);
      ctx.beginPath();
      ctx.arc(r.x + r.w - 120, r.y + 96, 46, 0, Math.PI * 2);
      ctx.fill();
      const hill = (base: number, amp: number, ph: number, col: string) => {
        ctx.beginPath();
        ctx.moveTo(r.x, r.y + r.h);
        for (let i = 0; i <= 24; i++) {
          const x = r.x + (r.w * i) / 24;
          ctx.lineTo(x, r.y + base + Math.sin(i * 0.5 + ph) * amp);
        }
        ctx.lineTo(r.x + r.w, r.y + r.h);
        ctx.closePath();
        ctx.fillStyle = col;
        ctx.fill();
      };
      hill(r.h * 0.6, 26, 0.4, a(C.h1, 0.3));
      hill(r.h * 0.78, 18, 2.2, a(C.pos, 0.45));
      // спрайт «дышит» — кадры анимации, а не 3D
      const frame = Math.floor(gt * 6) % 4;
      const squash = [0, 0.5, 1, 0.5][frame];
      pixelSprite(ctx, r.x + r.w * 0.38, r.y + r.h * 0.66, 13, squash, C.pos);
    },
    { color: C.pos },
  );
}

/** Карточка игры: плоское гекс-поле, логотип и название. */
function hexBoard(ctx: Ctx, r: Rect, gt: number, p: number): void {
  const R = 46;
  const dx = R * Math.sqrt(3);
  const dy = R * 1.5;
  const cols = Math.floor(r.w / dx) + 1;
  const rows = Math.floor(r.h / dy) + 1;
  ctx.save();
  rrPath(ctx, r.x, r.y, r.w, r.h, 12);
  ctx.clip();
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = r.x + 30 + i * dx + (j % 2 ? dx / 2 : 0);
      const y = r.y + 34 + j * dy;
      const h = hash11(i * 13.7 + j * 5.1);
      const appear = clamp01(p * 2.2 - h * 1.2);
      if (appear <= 0) continue;
      // «шторм» прокатывается волной по полю
      const wave = Math.max(0, Math.sin((i - j * 0.5) * 0.7 - gt * 2.4));
      const col = h > 0.86 ? C.accent : h > 0.7 ? C.pos : C.h1;
      hexPath(ctx, x, y, (R - 5) * easeOutBack(appear), Math.PI / 6);
      ctx.fillStyle = a(col, 0.08 + 0.22 * wave * (h > 0.7 ? 1.4 : 0.6));
      ctx.fill();
      ctx.strokeStyle = a(col, 0.32 + 0.4 * wave);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- сцена

export const scene01: SceneDef = {
  id: 's01',

  energy: (_t, cue) => Math.max(0.6 * seg(cue('hi').t, 0, 0.6) * (1 - seg(cue('name').t, 0, 1)), 0.7 * seg(cue('today').t, 0.9, 0.3)),

  render(f: Frame) {
    const { ctx, gt } = f;
    const cH = f.cue('hi');
    const cN = f.cue('name');
    const cR = f.cue('real');
    const cB = f.cue('before');
    const cT = f.cue('today');

    // ---- этап 1–2: сетка-голова → гекс-аватар, имя
    const toAv = easeInOutCubic(seg(cN.t, -0.15, 0.9));
    const avOut = seg(cR.t, -0.1, 0.6);
    const build = seg(f.t, 0, 1.4);

    f.obj('avatar', { x: W / 2, y: 520, abs: true, label: 'Сетка-аватар' }, () => {
      stage(ctx, 1, avOut, () => {
        const cx = lerp(W / 2, AV.x, toAv);
        const cy = lerp(520, AV.y, toAv);
        ctx.save();
        ctx.globalAlpha *= clamp01(build * 3);
        softLight(ctx, cx, cy, lerp(720, 340, toAv), C.h1, lerp(0.12, 0.16, toAv));
        ctx.restore();
        // гекс-рамка аватара
        if (toAv > 0) {
          ctx.save();
          ctx.globalAlpha *= toAv;
          hexPath(ctx, AV.x, AV.y, AV.r * (0.85 + 0.15 * toAv), Math.PI / 6);
          ctx.fillStyle = a(C.panel, 0.9);
          ctx.fill();
          ctx.strokeStyle = a(C.h1, 0.6);
          ctx.lineWidth = 3;
          ctx.stroke();
          hexPath(ctx, AV.x, AV.y, AV.r + 22 + Math.sin(gt * 1.4) * 4, Math.PI / 6);
          ctx.strokeStyle = a(C.h1, 0.18);
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }
        const view: View = { cx, cy, size: lerp(330, 150, toAv), pitch: 0.12, yaw: 0, dist: 4.2 };
        // кристалл — логотип канала; за приветствием он полупрозрачный, в аватаре — целиком
        crystal(ctx, view, { p: build, t: gt, solid: lerp(0.8, 1, toAv) });
        shockRing(ctx, W / 2, 520, seg(cH.t, 0, 0.9), 640, C.h1, 3);
      }, { outDx: -160 });
    });

    // приветствие
    const hiOut = seg(cN.t, -0.2, 0.45);
    f.obj('backing', { x: W / 2, y: 540, abs: true, label: 'Подложка' }, () => {
      textBacking(ctx, W / 2, 540, 860, 0.72 * seg(cH.t, 0, 0.4) * (1 - hiOut));
    });
    ctx.save();
    ctx.globalAlpha *= 1 - hiOut;
    ctx.translate(0, -60 * easeInOutCubic(hiOut));
    headline(f, 'title', cH, {
      x: W / 2,
      y: 596,
      size: 176,
      align: 'center',
      glow: true,
      label: 'Приветствие',
      reveal: { stagger: 0.24, rise: 40 },
    });
    ctx.restore();

    // имя и значки канала
    ctx.save();
    ctx.globalAlpha *= 1 - easeInOutCubic(avOut);
    ctx.translate(-160 * easeInOutCubic(avOut), 0);
    headline(f, 'name', cN, { x: 740, y: 600, size: 168, color: C.h1, glow: true, label: 'Имя', at: 0.15, dur: 0.8 });
    // Telegram канала — плашка под именем
    f.obj('telegram', { x: 748, y: 740, text: 't.me/tearevo', label: 'Telegram' }, (o) => {
      const p = seg(cN.p, 0.4, 0.14);
      if (p <= 0) return;
      const e = easeOutBack(p, 1.6);
      const st = { size: 72, color: C.h1, caps: 'normal' as const, tracking: 1, baseline: 'middle' as const };
      const tw = measure(ctx, o.text, st);
      const h = 120;
      const w = tw + 200;
      ctx.save();
      ctx.globalAlpha *= Math.min(1, p * 2.5);
      ctx.translate(0, (1 - e) * 30);
      softLight(ctx, w / 2, 0, w * 0.7, C.h1, 0.12);
      panel(ctx, 0, -h / 2, w, h, {
        fill: a(C.h1, 0.08),
        stroke: a(C.h1, 0.55),
        lineWidth: 2.5,
        radius: h / 2,
        glow: a(C.h1, 0.18),
        glowBlur: 40,
      });
      icon(ctx, 'telegram', 78, 0, 74, C.h1, gt);
      text(ctx, o.text, 140, 4, st);
      ctx.restore();
    });
    ctx.restore();

    // ---- этап 3: живой кадр игры
    const gameIn = seg(cR.t, 0.05, 0.8);
    const gameOut = seg(cB.p, 0.07, 0.1);
    f.obj('game', { x: GAME.x + GAME.w / 2, y: GAME.y + GAME.h / 2, abs: true, label: 'Кадр игры' }, () => {
      stage(
        ctx,
        gameIn,
        gameOut,
        () => {
          viewport(ctx, GAME, () => gameScene(ctx, GAME, f.t, gt), { color: C.pos });
        },
        { cx: GAME.x + GAME.w / 2, cy: GAME.y + GAME.h / 2, from: 0.9, dy: 30, to: 0.9, outDx: 240 },
      );
    });

    // заголовки этапов 3–4 (уходят на «3D»)
    const outT = seg(cT.t, -0.2, 0.4);
    ctx.save();
    ctx.globalAlpha *= 1 - outT;
    titles(f, [{ c: cR, color: C.pos }, { c: cB }]);
    ctx.restore();

    // ---- этап 4: код, 2D-арт и HEXSTORM
    const bOut = seg(cT.t, -0.15, 0.5);
    const pCode = seg(cB.p, 0.15, 0.08);
    const pArt = seg(cB.p, 0.29, 0.08);
    const pCard = seg(cB.p, 0.44, 0.1);
    // пока карточки игры нет, плитки стоят по центру кадра, потом уступают ей место
    const tilesDx = 530 * (1 - easeInOutCubic(seg(cB.p, 0.41, 0.1)));
    f.obj('code', { x: T_CODE.x + T_CODE.w / 2, y: T_CODE.y + T_CODE.h / 2, abs: true, label: 'Плитка: код' }, () => {
      stage(ctx, pCode, bOut, () => codeTile(ctx, { ...T_CODE, x: T_CODE.x + tilesDx }, seg(cB.p, 0.17, 0.3), gt), {
        dy: 40,
        cx: 960,
        cy: 640,
        to: 0.6,
      });
    });
    f.obj('art', { x: T_ART.x + T_ART.w / 2, y: T_ART.y + T_ART.h / 2, abs: true, label: 'Плитка: 2D-арт' }, () => {
      stage(ctx, pArt, bOut, () => artTile(ctx, { ...T_ART, x: T_ART.x + tilesDx }, gt), { dy: 40, cx: 960, cy: 640, to: 0.6 });
    });
    f.obj('links', { x: 770, y: 660, abs: true, label: 'Связи' }, () => {
      const p = seg(cB.p, 0.6, 0.12);
      if (p <= 0) return;
      stage(ctx, 1, bOut, () => {
        flow(ctx, [T_CODE.x + T_CODE.w + 8, T_CODE.y + T_CODE.h / 2], [790, T_CODE.y + T_CODE.h / 2], [CARD.x - 8, CARD.y + 250], {
          t: gt,
          color: C.h1,
          p,
        });
        flow(ctx, [T_ART.x + T_ART.w + 8, T_ART.y + T_ART.h / 2], [790, T_ART.y + T_ART.h / 2], [CARD.x - 8, CARD.y + 480], {
          t: gt + 0.3,
          color: C.pos,
          p,
        });
      }, { cx: 960, cy: 640, to: 0.6 });
    });

    const cardStage = (fn: () => void) =>
      stage(ctx, pCard, bOut, fn, { dy: 50, from: 0.94, cx: 960, cy: 640, to: 0.6 });
    const BOARD: Rect = { x: CARD.x + 30, y: CARD.y + 30, w: CARD.w - 60, h: 400 };
    f.obj('card', { x: CARD.x + CARD.w / 2, y: CARD.y + CARD.h / 2, abs: true, label: 'Карточка игры' }, () => {
      cardStage(() => {
        softLight(ctx, CARD.x + CARD.w / 2, CARD.y + CARD.h / 2, 640, C.h1, 0.1);
        panel(ctx, CARD.x, CARD.y, CARD.w, CARD.h, {
          fill: C.panel,
          stroke: a(C.accent, 0.4),
          radius: 18,
          lineWidth: 2,
          glow: a(C.accent, 0.14),
          glowBlur: 56,
        });
        hexBoard(ctx, BOARD, gt, seg(cB.p, 0.46, 0.25));
        ctx.save();
        ctx.shadowColor = a(C.h1, 0.5);
        ctx.shadowBlur = 30;
        icon(ctx, 'arcadia', CARD.x + 150, CARD.y + 575, 200, C.h1, gt);
        ctx.restore();
      });
    });
    f.obj('game-title', { x: CARD.x + 290, y: CARD.y + 585, abs: true, text: 'HEXSTORM', label: 'Название игры' }, (o) => {
      cardStage(() => text(ctx, o.text, CARD.x + 290, CARD.y + 585, { size: 150, color: C.h1, tracking: 2 }));
    });
    f.obj('game-sub', { x: CARD.x + 296, y: CARD.y + 670, abs: true, text: 'Tears of Arcadia', label: 'Подзаголовок игры' }, (o) => {
      cardStage(() => text(ctx, o.text, CARD.x + 296, CARD.y + 670, { size: 68, color: C.accent, tracking: 3.4 }));
    });

    // ---- этап 5: плоский квадрат → куб → маг справа, «3D модели» слева
    const CX = 1420;
    const FEET = 950;
    f.obj('cube', { x: CX, y: 640, abs: true, label: 'Квадрат → персонаж' }, () => {
      const pin = seg(cT.t, 0.05, 0.3);
      if (pin <= 0) return;
      const ext = easeInOutCubic(seg(cT.t, 0.25, 0.7));
      const morph = seg(cT.t, 1.0, 0.35);
      const view: View = { cx: CX, cy: FEET, size: 240, pitch: lerp(0, 0.3, ext), yaw: lerp(0, 0.75, ext), dist: 9 };
      softLight(ctx, CX, 640, 560, C.h1, 0.16 * pin);
      if (morph < 1) {
        const side = 1.9;
        const cube: Part = {
          mesh: MESH.cube,
          pos: [0, 1.15, 0],
          size: [side, side, Math.max(0.01, side * ext)],
          color: C.h1,
        };
        ctx.save();
        ctx.globalAlpha *= Math.min(1, pin * 2) * (1 - morph);
        const s = 1 - 0.4 * morph;
        ctx.translate(CX, 620);
        ctx.scale(s, s);
        ctx.translate(-CX, -620);
        drawModel(ctx, [cube], view, {}, { edge: a(C.bg, 0.5), edgeWidth: 2.5 });
        ctx.restore();
      }
      if (morph > 0) {
        const k = easeOutBack(morph, 1.6);
        const ov: View = { cx: CX, cy: FEET, size: 275, pitch: 0.14, yaw: 0, dist: 9 };
        groundShadow(ctx, ov, 0, 0, 1.0, 0.8, 0.45 * morph);
        ctx.save();
        ctx.globalAlpha *= Math.min(1, morph * 2.5);
        // разворот к зрителю и дальше медленно поворачивается
        const ry = -1.1 + 0.9 * easeInOutCubic(seg(cT.t, 1.0, 1.4)) + Math.max(0, cT.t - 2.4) * 0.12;
        drawModel(ctx, mage(ogrePose('idle', gt * 0.5)).parts, ov, { ry, scale: Math.max(0.05, k) }, { edge: a(C.bg, 0.3) });
        ctx.restore();
        shockRing(ctx, CX, 660, seg(cT.t, 1.0, 0.8), 560, C.h1, 4);
      }
    });
    headline(f, '3d', cT, {
      x: 150,
      y: 720,
      size: 300,
      align: 'left',
      color: C.accent,
      glow: true,
      at: 0.2,
      dur: 0.6,
      label: 'Заголовок «3D»',
    });
  },
};
