/**
 * Сцена 5. Референсы заранее.
 * Этап 1: два входа генератора — промпт и картинка — дают 3D-модель (гоблин игры);
 *         картинка-референс: один ракурс или четыре.
 * Этап 2: в мыслях — танк игры с эволюцией; промпт «фантастический танк» даёт
 *         какой-то другой танк из кубов — перечёркнут.
 * Этап 3: мысль становится концептом (Nano Banana / GPT Image) → Tripo → 3D-танк как на концепте.
 */

import { clamp01, easeInOutCubic, easeOutQuart, lerp, seg } from '../../engine/anim.ts';
import { arrow, panel, rrPath, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import {
  appear,
  checkBadge,
  crossBadge,
  drawModel,
  flow,
  groundShadow,
  promptBox,
  drawConcept,
  hero,
  imageFrame,
  titles,
  toolCard,
  viewport,
  type P2,
  type Rect,
  type View,
} from './common.ts';
import { ALIEN_TANK, EVO_TANK, genHex, lerpRect, modelShot, thoughtCloud } from './kit_b.ts';
import { sayFrac } from './kit_C.ts';

type Ctx = CanvasRenderingContext2D;

/** Волшебник из assets: концепт (webp) и его модель из Tripo. */
const WIZ = hero('wizard').parts;

// ---- этап 1
const PROMPT1: Rect = { x: 150, y: 380, w: 560, h: 160 };
const IMG1: Rect = { x: 150, y: 600, w: 560, h: 390 };
const GEN1: P2 = [985, 690];
const OUT1 = { cx: 1470, foot: 930 };
// ракурсы
const IMGV: Rect = { x: 150, y: 330, w: 760, h: 660 };
const SMALL: Rect[] = [0, 1, 2, 3].map((i) => ({
  x: 1010 + (i % 2) * 390,
  y: 330 + Math.floor(i / 2) * 330,
  w: 360,
  h: 300,
}));
const SMALL_YAW = [-0.55, Math.PI / 2, Math.PI, -Math.PI / 2];

// ---- этап 2
const PROMPT2 = { x: 150, y: 330, w: 660 };
const GEN2: P2 = [1010, 393];
const RESULT: Rect = { x: 1010, y: 520, w: 760, h: 470 };
const CLOUD = { cx: 545, cy: 740, w: 760, h: 450 };
const PERSON: P2 = [190, 990];

// ---- этап 3 (полоса, которая потом сдвигается влево на PAN)
const PAN = 530;
const CARDS: Rect[] = [
  { x: 150, y: 495, w: 420, h: 130 },
  { x: 150, y: 655, w: 420, h: 130 },
];
const IMG3: Rect = { x: 680, y: 380, w: 520, h: 520 };
const TRIPO: Rect = { x: 1290, y: 575, w: 330, h: 130 };
const TANK3 = { cx: 2000, foot: 830 };

/** Поле промпта этапа 1: вместо слов — строки-полоски (просто «текст»). */
function promptBars(ctx: Ctx, r: Rect, typed: number, hot: number): void {
  panel(ctx, r.x, r.y, r.w, r.h, {
    fill: a(C.bg, 0.92),
    stroke: a(C.h1, 0.45 + 0.4 * hot),
    lineWidth: 2 + hot,
    radius: 14,
    glow: hot > 0 ? a(C.h1, 0.3 * hot) : undefined,
    glowBlur: 40,
    accentBar: { color: C.h1, width: 5 },
  });
  icon(ctx, 'chat', r.x + 70, r.y + r.h / 2, 60, C.h1);
  const rows = [0.92, 0.6];
  const total = rows.reduce((s, w) => s + w, 0);
  let left = clamp01(typed) * total;
  rows.forEach((w, i) => {
    const k = clamp01(left / w);
    left -= w;
    if (k <= 0) return;
    ctx.fillStyle = a(C.text, 0.7);
    rrPath(ctx, r.x + 136, r.y + r.h / 2 - 34 + i * 48, (r.w - 180) * w * k, 22, 11);
    ctx.fill();
  });
}

/** Пустое гнездо под вход (пунктир). */
function slot(ctx: Ctx, r: Rect, p: number, ic: string): void {
  if (p <= 0) return;
  ctx.save();
  ctx.globalAlpha *= p;
  ctx.setLineDash([16, 12]);
  ctx.strokeStyle = a(C.text, 0.35);
  ctx.lineWidth = 2.5;
  rrPath(ctx, r.x, r.y, r.w, r.h, 14);
  ctx.stroke();
  ctx.setLineDash([]);
  icon(ctx, ic, r.x + r.w / 2, r.y + r.h / 2, 64, a(C.text, 0.3));
  ctx.restore();
}

/** Знак «не равно». */
function notEqual(ctx: Ctx, cx: number, cy: number, s: number, p: number): void {
  if (p <= 0) return;
  const e = easeOutQuart(clamp01(p));
  ctx.save();
  ctx.globalAlpha *= e;
  ctx.translate(cx, cy);
  ctx.scale(0.6 + 0.4 * e, 0.6 + 0.4 * e);
  ctx.strokeStyle = C.accent;
  ctx.lineCap = 'round';
  ctx.lineWidth = s * 0.12;
  ctx.shadowColor = a(C.accent, 0.6);
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.moveTo(-s * 0.4, -s * 0.16);
  ctx.lineTo(s * 0.4, -s * 0.16);
  ctx.moveTo(-s * 0.4, s * 0.16);
  ctx.lineTo(s * 0.4, s * 0.16);
  ctx.moveTo(s * 0.2, -s * 0.45);
  ctx.lineTo(-s * 0.2, s * 0.45);
  ctx.stroke();
  ctx.restore();
}

export const scene05: SceneDef = {
  id: 's05',

  energy: (_t, cue) => Math.max(0.6 * seg(cue('notthat').t, 0.6, 0.6) * (1 - seg(cue('concept').t, 0, 1)), 0.7 * seg(cue('concept').p, 0.88, 0.1)),

  render(f: Frame) {
    const { ctx, gt } = f;
    const c2 = f.cue('two');
    const cTI = f.cue('textimg');
    const cV = f.cue('views');
    const cR = f.cue('refs');
    const cT = f.cue('tank');
    const cN = f.cue('notthat');
    const cC = f.cue('concept');

    titles(f, [{ c: c2 }, { c: cV }, { c: cR }, { c: cC }]);

    // ================= этап 1: два входа → генератор → модель; затем ракурсы
    const out1 = easeOutQuart(seg(cR.t, 0, 0.6));
    const s1 = 1 - out1;
    const toViews = easeInOutCubic(seg(cV.t, 0, 0.9));
    const pipe1 = s1 * (1 - easeOutQuart(seg(cV.t, 0, 0.5)));
    const promptIn = seg(cTI.p, 0, 0.25);
    const typed = seg(cTI.p, 0.05, 0.35);
    const imgIn = seg(cTI.p, 0.42, 0.25);
    const busy1 = Math.max(seg(cTI.p, 0.15, 0.1), 0) * (1 - seg(cTI.p, 0.9, 0.1));

    ctx.save();
    ctx.translate(-120 * out1, 0);
    ctx.globalAlpha *= s1;

    f.obj('slots', { x: PROMPT1.x + PROMPT1.w / 2, y: 685, abs: true, label: 'Гнёзда входов' }, () => {
      if (pipe1 <= 0) return;
      ctx.save();
      ctx.globalAlpha *= pipe1;
      slot(ctx, PROMPT1, seg(c2.p, 0.25, 0.2) * (1 - promptIn), 'chat');
      slot(ctx, IMG1, seg(c2.p, 0.35, 0.2) * (1 - imgIn), 'eye');
      ctx.restore();
    });

    f.obj('prompt1', { x: PROMPT1.x + PROMPT1.w / 2, y: PROMPT1.y + PROMPT1.h / 2, abs: true, label: 'Поле промпта' }, () => {
      if (pipe1 <= 0 || promptIn <= 0) return;
      ctx.save();
      ctx.globalAlpha *= pipe1;
      appear(ctx, promptIn, () => promptBars(ctx, PROMPT1, typed, busy1 * (1 - seg(cTI.p, 0.4, 0.1))), { dx: -40 });
      ctx.restore();
    });

    f.obj('flows1', { x: 820, y: 685, abs: true, label: 'Стрелки к генератору' }, () => {
      if (pipe1 <= 0) return;
      ctx.save();
      ctx.globalAlpha *= pipe1;
      flow(ctx, [PROMPT1.x + PROMPT1.w + 14, PROMPT1.y + PROMPT1.h / 2], [880, PROMPT1.y + PROMPT1.h / 2], [GEN1[0] - 106, GEN1[1] - 30], {
        t: gt,
        color: C.h1,
        p: seg(cTI.p, 0.2, 0.15),
        width: 4,
      });
      flow(ctx, [IMG1.x + IMG1.w + 14, IMG1.y + IMG1.h / 2], [880, IMG1.y + IMG1.h / 2], [GEN1[0] - 106, GEN1[1] + 30], {
        t: gt + 0.3,
        color: C.accent,
        p: seg(cTI.p, 0.6, 0.15),
        width: 4,
      });
      flow(ctx, [GEN1[0] + 110, GEN1[1]], [GEN1[0] + 160, GEN1[1]], [GEN1[0] + 210, GEN1[1]], {
        t: gt,
        color: C.pos,
        p: seg(c2.p, 0.55, 0.15),
        width: 4,
        n: 2,
      });
      ctx.restore();
    });

    f.obj('gen1', { x: GEN1[0], y: GEN1[1], abs: true, label: 'Генератор' }, () => {
      if (pipe1 <= 0) return;
      ctx.save();
      ctx.globalAlpha *= pipe1;
      genHex(ctx, GEN1[0], GEN1[1], 100, { p: seg(c2.t, 0.2, 0.6), busy: Math.max(busy1, seg(c2.p, 0.5, 0.1) * (1 - seg(c2.p, 0.8, 0.15))), t: gt });
      ctx.restore();
    });

    f.obj('model1', { x: OUT1.cx, y: OUT1.foot - 250, abs: true, label: '3D-модель' }, () => {
      const p = seg(c2.p, 0.62, 0.3);
      if (pipe1 <= 0 || p <= 0) return;
      ctx.save();
      ctx.globalAlpha *= pipe1;
      appear(
        ctx,
        p,
        () => {
          const view: View = { cx: OUT1.cx, cy: OUT1.foot, size: 225, pitch: 0.22, yaw: -0.5 + gt * 0.5, dist: 8 };
          softLight(ctx, OUT1.cx, OUT1.foot - 260, 420, C.pos, 0.12);
          groundShadow(ctx, view, 0, 0, 0.6, 0.45, 0.45);
          drawModel(ctx, WIZ, view, {}, { wire: a(C.bg, 0.35), wireWidth: 0.8 });
        },
        { from: 0.6, cx: OUT1.cx, cy: OUT1.foot - 200, back: true },
      );
      ctx.restore();
    });

    // картинка-референс: сначала вход генератора, потом крупно «один ракурс»
    const imgR = lerpRect(IMG1, IMGV, toViews);
    const oneHot = seg(cV.p, 0.15, 0.15) * (1 - seg(cV.p, 0.5, 0.15));
    f.obj('image1', { x: IMG1.x + IMG1.w / 2, y: IMG1.y + IMG1.h / 2, abs: true, label: 'Картинка-референс' }, () => {
      if (imgIn <= 0) return;
      appear(
        ctx,
        imgIn,
        () => {
          if (oneHot > 0) softLight(ctx, imgR.x + imgR.w / 2, imgR.y + imgR.h / 2, imgR.w * 0.8, C.accent, 0.16 * oneHot);
          // настоящий концепт волшебника — то, что получает генератор
          imageFrame(ctx, imgR, () => drawConcept(ctx, 'wizard', imgR, 1.25));
        },
        { from: 0.85, cx: IMG1.x + IMG1.w / 2, cy: IMG1.y + IMG1.h / 2 },
      );
    });

    // четыре ракурса
    const fourHot = seg(cV.p, 0.55, 0.15);
    SMALL.forEach((r, i) => {
      f.obj(`view:${i}`, { x: r.x + r.w / 2, y: r.y + r.h / 2, abs: true, label: `Ракурс ${i + 1}` }, () => {
        const p = seg(cV.p, 0.45 + i * 0.07, 0.2);
        if (p <= 0) return;
        appear(
          ctx,
          p,
          () => {
            if (fourHot > 0) softLight(ctx, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.75, C.accent, 0.12 * fourHot);
            modelShot(ctx, r, WIZ, { size: 100, yaw: SMALL_YAW[i], pitch: 0.12, foot: r.y + r.h * 0.9, shadow: [0.5, 0.4] });
          },
          { from: 0.7, cx: r.x + r.w / 2, cy: r.y + r.h / 2, back: true },
        );
      });
    });
    ctx.restore();

    // ================= этап 2: задумал одно — получил другое
    const in2 = seg(cR.t, 0.2, 0.7);
    const out2 = easeOutQuart(seg(cC.t, 0, 0.7));
    const s2 = clamp01(in2 * 2) * (1 - out2);
    const cloudP = seg(cR.t, 0.4, 0.9);
    const promptP = seg(cT.t, 0, 0.5);
    const typed2 = seg(cT.p, 0.08, 0.32);
    const sendP = seg(cT.p, 0.42, 0.08);
    const busy2 = seg(cT.p, 0.46, 0.06) * (1 - seg(cT.p, 0.7, 0.06));
    const resP = seg(cT.p, 0.5, 0.1);
    const tankP = seg(cT.p, 0.68, 0.14);
    const wrong = seg(cN.t, 0.5, 0.5);

    // на «референсах» мысль в центре кадра, на «танке» отъезжает влево, освобождая место
    const mv = easeInOutCubic(seg(cT.t, 0, 0.9));
    const odx = 400 * (1 - mv);
    const ody = -100 * (1 - mv);

    f.obj('person', { x: PERSON[0], y: PERSON[1], abs: true, label: 'Автор' }, () => {
      if (s2 <= 0 || cloudP <= 0) return;
      ctx.save();
      ctx.translate(odx, ody);
      ctx.globalAlpha *= s2 * easeOutQuart(cloudP);
      icon(ctx, 'person', PERSON[0], PERSON[1], 88, C.h1);
      ctx.restore();
    });

    // облако мысли: задуманный танк. На «концепте» облако превращается в картинку.
    const toImg = easeInOutCubic(seg(cC.t, 0.1, 1.0));
    f.obj('cloud', { x: CLOUD.cx, y: CLOUD.cy, abs: true, label: 'Задуманный танк' }, () => {
      if (cloudP <= 0 || toImg >= 1) return;
      ctx.save();
      ctx.translate(odx, ody);
      ctx.globalAlpha *= clamp01(in2 * 2) * (1 - toImg);
      thoughtCloud(ctx, CLOUD.cx, CLOUD.cy, CLOUD.w, CLOUD.h, {
        p: cloudP,
        tail: [PERSON[0] + 30, PERSON[1] - 50],
        glow: wrong,
        color: wrong > 0 ? C.pos : C.h1,
      });
      const k = easeOutQuart(seg(cR.t, 0.8, 0.8));
      if (k > 0) {
        ctx.globalAlpha *= k;
        const view: View = { cx: CLOUD.cx + 10, cy: CLOUD.cy + 135, size: 130, pitch: 0.32, yaw: -0.75 + Math.sin(gt * 0.5) * 0.12, dist: 9 };
        groundShadow(ctx, view, 0, 0.1, 1.2, 1.6, 0.35);
        drawModel(ctx, EVO_TANK, view, {}, { bands: 3 });
      }
      ctx.restore();
    });

    f.obj('prompt2', { x: PROMPT2.x, y: PROMPT2.y + 64, abs: true, text: cT.show, label: 'Промпт' }, (o) => {
      if (s2 <= 0 || promptP <= 0) return;
      ctx.save();
      ctx.globalAlpha *= s2;
      appear(ctx, promptP, () => promptBox(ctx, o.text, PROMPT2.x, PROMPT2.y, PROMPT2.w, { p: typed2, gt, color: C.h1 }), { dx: -40 });
      ctx.restore();
    });

    f.obj('arrow2', { x: (PROMPT2.x + PROMPT2.w + GEN2[0]) / 2, y: GEN2[1], abs: true, label: 'Стрелка к генератору' }, () => {
      if (s2 <= 0) return;
      ctx.save();
      ctx.globalAlpha *= s2;
      arrow(ctx, PROMPT2.x + PROMPT2.w + 16, GEN2[1], GEN2[0] - 92, GEN2[1], sendP, { color: C.h1, width: 5, head: 20 });
      flow(ctx, [GEN2[0], GEN2[1] + 86], [GEN2[0] + 30, RESULT.y - 30], [RESULT.x + 200, RESULT.y - 8], {
        t: gt,
        color: C.h1,
        p: seg(cT.p, 0.5, 0.12),
        width: 4,
      });
      ctx.restore();
    });

    f.obj('gen2', { x: GEN2[0], y: GEN2[1], abs: true, label: 'Генератор (текст)' }, () => {
      if (s2 <= 0) return;
      ctx.save();
      ctx.globalAlpha *= s2;
      genHex(ctx, GEN2[0], GEN2[1], 80, { p: seg(cT.t, 0.3, 0.5), busy: busy2, t: gt });
      ctx.restore();
    });

    f.obj('result', { x: RESULT.x + RESULT.w / 2, y: RESULT.y + RESULT.h / 2, abs: true, label: 'Полученный танк' }, () => {
      if (s2 <= 0 || resP <= 0) return;
      ctx.save();
      ctx.globalAlpha *= s2;
      appear(
        ctx,
        resP,
        () => {
          viewport(
            ctx,
            RESULT,
            () => {
              if (tankP <= 0) return;
              const e = easeOutQuart(tankP);
              const view: View = {
                cx: RESULT.x + RESULT.w / 2,
                cy: RESULT.y + RESULT.h * 0.74,
                size: 124,
                pitch: 0.34,
                yaw: -0.75 + gt * 0.35,
                dist: 9,
              };
              ctx.save();
              ctx.globalAlpha *= e * (1 - 0.35 * wrong);
              groundShadow(ctx, view, 0, 0, 1.4, 1.9, 0.4);
              drawModel(ctx, ALIEN_TANK, view, { pos: [0, (1 - e) * 1.2, 0] }, { edge: 'rgba(30,32,36,0.5)' });
              ctx.restore();
            },
            { color: wrong > 0 ? C.accent : C.h1 },
          );
          crossBadge(ctx, RESULT.x + RESULT.w - 20, RESULT.y + 20, 50, wrong);
        },
        { dy: 40 },
      );
      ctx.restore();
    });

    f.obj('noteq', { x: 962, y: 770, abs: true, label: 'Знак «не равно»' }, () => {
      if (s2 <= 0) return;
      ctx.save();
      ctx.globalAlpha *= s2;
      notEqual(ctx, 962, 770, 96, seg(cN.t, 0.2, 0.5));
      ctx.restore();
    });

    // ================= этап 3: концепт → Tripo → 3D
    const pan = easeInOutCubic(seg(cC.p, sayFrac(cC, 'а затем', 0.58), 0.2));
    const dx = -PAN * pan;
    const s3 = seg(cC.t, 0, 0.5);

    CARDS.forEach((r, i) => {
      const name = i === 0 ? 'Nano Banana' : 'GPT Image';
      f.obj(`card:${i}`, { x: r.x + r.w / 2, y: r.y + r.h / 2, abs: true, text: name, label: `Генератор картинок ${i + 1}` }, (o) => {
        const p = seg(cC.p, sayFrac(cC, name, 0.3 + i * 0.12), 0.12);
        if (s3 <= 0 || p <= 0) return;
        ctx.save();
        ctx.translate(dx, 0);
        ctx.globalAlpha *= 1 - pan;
        toolCard(ctx, r.x, r.y, r.w, r.h, { name: o.text, icon: 'star', color: C.accent, p, active: 0.5, t: gt });
        ctx.restore();
      });
    });

    f.obj('cardflow', { x: 625, y: 640, abs: true, label: 'Стрелки к концепту' }, () => {
      if (s3 <= 0) return;
      ctx.save();
      ctx.translate(dx, 0);
      ctx.globalAlpha *= 1 - pan;
      CARDS.forEach((r, i) => {
        flow(ctx, [r.x + r.w + 12, r.y + r.h / 2], [635, r.y + r.h / 2], [IMG3.x - 14, IMG3.y + IMG3.h / 2], {
          t: gt + i * 0.4,
          color: C.accent,
          p: seg(cC.p, 0.36 + i * 0.12, 0.1),
          width: 4,
        });
      });
      ctx.restore();
    });

    // концепт: вырастает из облака мысли
    f.obj('concept', { x: IMG3.x + IMG3.w / 2, y: IMG3.y + IMG3.h / 2, abs: true, label: 'Концепт' }, () => {
      if (toImg <= 0) return;
      const from: Rect = { x: CLOUD.cx - 290, y: CLOUD.cy - 205, w: 580, h: 410 };
      const r = lerpRect(from, { ...IMG3, x: IMG3.x + dx }, toImg);
      ctx.save();
      ctx.globalAlpha *= clamp01(toImg * 1.6);
      modelShot(ctx, r, EVO_TANK, {
        size: lerp(130, 132, toImg),
        yaw: -0.75 + Math.sin(gt * 0.5) * 0.12 * (1 - toImg),
        pitch: 0.32,
        foot: r.y + r.h * lerp(0.83, 0.72, toImg),
        cx: r.x + r.w / 2 + 6,
        shadow: [1.2, 1.6],
      });
      ctx.restore();
    });

    f.obj('arrows3', { x: 1150, y: 640, abs: true, label: 'Стрелки к Tripo и к 3D' }, () => {
      if (s3 <= 0) return;
      ctx.save();
      ctx.translate(dx, 0);
      const y = TRIPO.y + TRIPO.h / 2;
      arrow(ctx, IMG3.x + IMG3.w + 20, y, TRIPO.x - 16, y, seg(cC.p, 0.68, 0.08), { color: C.h1, width: 5, head: 20 });
      arrow(ctx, TRIPO.x + TRIPO.w + 18, y, TRIPO.x + TRIPO.w + 100, y, seg(cC.p, 0.8, 0.06), { color: C.pos, width: 5, head: 20 });
      ctx.restore();
    });

    f.obj('tripo', { x: TRIPO.x - PAN + TRIPO.w / 2, y: TRIPO.y + TRIPO.h / 2, abs: true, text: 'Tripo', label: 'Tripo' }, (o) => {
      const p = seg(cC.p, 0.66, 0.1);
      if (p <= 0) return;
      ctx.save();
      ctx.translate(dx, 0);
      toolCard(ctx, TRIPO.x, TRIPO.y, TRIPO.w, TRIPO.h, { name: o.text, icon: 'cube', color: C.h1, p, active: seg(cC.p, 0.74, 0.1), t: gt });
      ctx.restore();
    });

    f.obj('tank3', { x: TANK3.cx - PAN, y: TANK3.foot - 200, abs: true, label: '3D-танк' }, () => {
      const p = seg(cC.p, 0.8, 0.14);
      if (p <= 0) return;
      const cx = TANK3.cx + dx;
      appear(
        ctx,
        p,
        () => {
          const view: View = { cx, cy: TANK3.foot, size: 165, pitch: 0.3, yaw: -0.75 + seg(cC.t, cC.dur * 0.8, 6) * 1.2, dist: 9 };
          softLight(ctx, cx, TANK3.foot - 160, 480, C.pos, 0.14);
          groundShadow(ctx, view, 0, 0.1, 1.3, 1.7, 0.45);
          drawModel(ctx, EVO_TANK, view, {}, {});
        },
        { from: 0.7, cx, cy: TANK3.foot - 150, back: true },
      );
      checkBadge(ctx, cx + 270, TANK3.foot - 350, 50, seg(cC.p, 0.92, 0.1));
    });
  },
};
