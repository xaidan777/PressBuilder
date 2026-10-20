/**
 * Сцена 19. Анимация по кадрам.
 * Этап 1: ролик уходит в окно Claude Code; из него вытягивается лента кадров,
 *   ключевые позы подсвечиваются и поднимаются наверх со скелетом.
 * Этап 2: Blender — ключи-ромбы на таймлайне, огр анимируется; тестовый рендер
 *   сравнивается с референсом (галочка). Затем размытый текстовый запрос уступает
 *   конкретному образцу движения — огру с «луковой кожей» поз.
 * Этап 3: мокап-костюм с маркерами перечёркнут; у огра неверно повёрнута рука —
 *   курсор тянет кость и поправляет; полоса времени заметно сокращается.
 */

import { clamp01, easeInOutCubic, easeOutBack, easeOutQuart, lerp, seg } from '../../engine/anim.ts';
import { arrow, rrPath, shockRing, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import { drawGrid } from '../../engine/wire3d.ts';
import {
  checkBadge,
  CLAY,
  crossBadge,
  DARK,
  drawBones,
  drawModel,
  flow,
  ogrePose,
  OGRE_BONES,
  placePoint,
  strike,
  titles,
  toScreen,
  viewport,
  windowFrame,
  type Joint,
  type OgrePose,
  type P2,
  type Rect,
  type Root,
  walkCycle,
  circleGait,
  mageWalkCycle,
  gait,
  mage,
  MAGE_GAIT,
  seedancePhase,
} from './common.ts';
import {
  drawOgre,
  filmStrip,
  keyTimeline,
  layer,
  lerpRect,
  ogreThumb,
  ogreView,
  promptPanel,
  seedanceFrameAt,
  seedanceThumb,
  videoClip,
} from './kit_E.ts';

type Ctx = CanvasRenderingContext2D;

// ---------------------------------------------------------------- этап 1: Claude Code и кадры

const CW: Rect = { x: 150, y: 290, w: 1620, h: 720 };
const CLIP_START: Rect = { x: 560, y: 420, w: 800, h: 450 };
const CLIP: Rect = { x: 196, y: 400, w: 580, h: 326 };
const STRIP: Rect = { x: 196, y: 756, w: 1528, h: 240 };
const CELL = 230;
const GAP = 20;
/** Кадры ролика Seedance в ленте (≈ шестая часть цикла шага) и какие из них — ключевые позы. */
const PH = [0, 5, 10, 16, 21, 26];
const KEYS = [0, 2, 5];
const POSE_W = 290;
const POSE: Rect[] = KEYS.map((_, j) => ({ x: 830 + j * (POSE_W + 22), y: 400, w: POSE_W, h: 326 }));

// ---------------------------------------------------------------- этап 2: Blender, сравнение, образец

const BW: Rect = { x: 150, y: 290, w: 980, h: 720 };
const VP: Rect = { x: 164, y: 382, w: 952, h: 470 };
const TL: Rect = { x: 164, y: 866, w: 952, h: 128 };
const RENDER: Rect = { x: 1190, y: 330, w: 280, h: 380 };
const REF: Rect = { x: 1490, y: 330, w: 280, h: 380 };
/** Ключи на дорожках (корпус, руки, ноги): у каждой свой ритм, как у настоящей анимации. */
const KEYS_BLENDER: Array<[number, number]> = [
  [0, 0], [0, 0.25], [0, 0.5], [0, 0.75], [0, 1],
  [1, 0], [1, 0.18], [1, 0.42], [1, 0.68], [1, 0.9],
  [2, 0], [2, 0.12], [2, 0.37], [2, 0.5], [2, 0.62], [2, 0.87], [2, 1],
];
const FUZZY: Rect = { x: 150, y: 430, w: 520, h: 260 };

// ---------------------------------------------------------------- этап 3: мокап, ошибки, время

/** Неверная поза правой руки (вывернута назад и в сторону) и верная. */
const WRONG = { armR: -1.0, spreadR: 1.35 };
const TIME_BAR = { x: 1150, y: 590, w: 620, h: 64 };
const TL3: Rect = { x: 1240, y: 800, w: 520, h: 120 };

/** Точки-маркеры мокап-костюма: суставы и середины костей. */
function markers(joints: Record<Joint, [number, number, number]>): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = Object.values(joints);
  for (const [ja, jb] of OGRE_BONES) {
    const p = joints[ja];
    const q = joints[jb];
    out.push([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2]);
  }
  return out;
}

function iconBadge(ctx: Ctx, name: string, x: number, y: number, color: string): void {
  ctx.save();
  ctx.fillStyle = a(C.bg, 0.85);
  ctx.strokeStyle = a(color, 0.7);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  icon(ctx, name, x, y, 40, color);
}

export const scene19: SceneDef = {
  id: 's19',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cP = f.cue('pass');
    const cF = f.cue('frames');
    const cA = f.cue('anim');
    const cSa = f.cue('sample');
    const cMo = f.cue('mocap');
    const cE = f.cue('errors');
    const cMa = f.cue('manual');
    const cI = f.cue('indie');

    titles(f, [
      { c: cF, color: C.h1 },
      { c: cA, color: C.accent },
      { c: cSa, color: C.pos },
      { c: cMo, color: C.h1 },
      { c: cE, color: C.accent },
      { c: cI, color: C.pos },
    ]);

    // ---- переходы
    const in1 = easeOutQuart(seg(cP.t, -0.6, 0.9));
    const out1 = easeInOutCubic(seg(cA.t, -0.3, 0.8));
    const in2 = easeOutQuart(seg(cA.t, -0.1, 0.8));
    const k2b = easeInOutCubic(seg(cSa.t, -0.2, 0.9));
    const out2 = easeInOutCubic(seg(cMo.t, -0.3, 0.7));
    const in3 = easeOutQuart(seg(cMo.t, -0.1, 0.6));
    const kI = easeInOutCubic(seg(cI.t, 0, 1.0));

    // ================================================================ этап 1
    f.obj('claude', { x: CW.x + CW.w / 2, y: CW.y + CW.h / 2, abs: true, label: 'Окно Claude Code' }, () => {
      layer(ctx, in1 * (1 - out1), () => {
        windowFrame(ctx, CW.x, CW.y, CW.w, CW.h, { title: 'Claude Code', icon: 'robot', color: C.accent, glow: seg(cP.t, 0.8, 0.6) * (1 - seg(cP.t, 1.6, 1)), t: gt });
      }, 0, 0, lerp(0.97, 1, in1) * (1 - 0.06 * out1));
    });

    // ролик: крупно → в окно
    f.obj('clip', { x: CLIP.x + CLIP.w / 2, y: CLIP.y + CLIP.h / 2, abs: true, label: 'Ролик' }, () => {
      const go = easeInOutCubic(seg(cP.t, 0.2, 1.3));
      const r = lerpRect(CLIP_START, CLIP, go);
      layer(ctx, clamp01(seg(f.t, 0, 0.5)) * (1 - out1), () => {
        if (go < 1) softLight(ctx, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.7, C.accent, 0.12 * (1 - go));
        videoClip(ctx, r, f.t, { loop: 1, glow: 1 - go });
        shockRing(ctx, r.x + r.w / 2, r.y + r.h / 2, seg(cP.t, 1.3, 0.8), 420, C.accent, 4);
      }, 0, 0, 1 - 0.06 * out1);
    });

    // лента кадров
    const stripP = seg(cF.t, 0.2, 0.6);
    f.obj('strip', { x: STRIP.x + STRIP.w / 2, y: STRIP.y + STRIP.h / 2, abs: true, label: 'Лента кадров' }, () => {
      if (stripP <= 0) return;
      layer(ctx, stripP * (1 - out1), () => {
        filmStrip(ctx, STRIP, { cell: CELL, gap: GAP, color: C.accent }, (i, r) => {
          if (i < 0 || i >= PH.length) return;
          // кадр вылетает из ролика в своё окно ленты
          const fly = easeOutQuart(seg(cF.t, 0.5 + i * 0.32, 0.7));
          if (fly <= 0) return;
          const from: Rect = { x: CLIP.x + CLIP.w / 2 - r.w / 4, y: CLIP.y + CLIP.h / 2 - r.h / 4, w: r.w / 2, h: r.h / 2 };
          const key = KEYS.indexOf(i);
          const hl = key >= 0 ? easeOutBack(seg(cF.t, 3.4 + key * 0.8, 0.5)) : 0;
          const rr = lerpRect(from, r, fly);
          const lift = 10 * hl;
          // настоящий кадр ролика (вид сбоку)
          seedanceThumb(ctx, { ...rr, y: rr.y - lift }, PH[i], 'side', { color: hl > 0.5 ? C.accent : C.h1 });
          if (hl > 0) {
            ctx.save();
            ctx.globalAlpha *= clamp01(hl);
            ctx.shadowColor = a(C.accent, 0.8);
            ctx.shadowBlur = 24;
            ctx.strokeStyle = C.accent;
            ctx.lineWidth = 5;
            ctx.strokeRect(rr.x - 2, rr.y - lift - 2, rr.w + 4, rr.h + 4);
            ctx.restore();
          }
        });
      });
    });

    // ключевые позы со скелетом
    KEYS.forEach((ki, j) => {
      const r = POSE[j];
      f.obj(`pose:${j}`, { x: r.x + r.w / 2, y: r.y + r.h / 2, abs: true, label: `Ключевая поза ${j + 1}` }, () => {
        const p = seg(cF.t, 3.7 + j * 0.8, 0.6);
        if (p <= 0) return;
        layer(ctx, p * (1 - out1), () => {
          const cellX = STRIP.x + GAP + ki * (CELL + GAP) + CELL / 2;
          flow(ctx, [cellX, STRIP.y + 6], [lerp(cellX, r.x + r.w / 2, 0.5), STRIP.y - 10], [r.x + r.w / 2, r.y + r.h + 6], {
            t: gt + j * 0.2,
            color: C.accent,
            p: p * 1.2,
            n: 2,
            r: 6,
            lineAlpha: 0.3,
          });
          viewport(ctx, r, () => {
            const view = ogreView(r.x + r.w / 2, r.y + r.h - 34, 118, 0, 0.12, 9);
            // поза рига в той же фазе, что и кадр ролика (анимация снята по этому видео)
            const pose = walkCycle(seedancePhase(PH[ki])).pose;
            // тёмный силуэт и яркий скелет — поза «на просвет»
            drawOgre(ctx, view, pose, { ry: Math.PI / 2 }, { shadow: 0.3, tint: DARK });
            drawBones(ctx, mage(pose, { jointsOnly: true }).joints, view, { ry: Math.PI / 2 }, { p: seg(p, 0.2, 0.8), color: C.h1 });
          }, { color: C.accent });
        }, 0, 30 * (1 - easeOutQuart(p)));
      });
    });

    // ================================================================ этап 2
    const head = ((f.t * 0.3) % 1 + 1) % 1;
    const walkK = seg(cA.t, 1.6, 0.8);
    // анимация в Blender: огр идёт по кругу, путь из шага — стопы не скользят по сетке
    const cgA = circleGait((cA.t - 1.6) / mageWalkCycle(), { who: 'mage', fromIdle: true });
    const poseA = cgA.walking ? cgA.pose : ogrePose('idle', gt * 0.4);
    const SV = ogreView(VP.x + VP.w / 2, VP.y + VP.h - 44, 165, 0.6, 0.12, 9);

    f.obj('blender', { x: BW.x + BW.w / 2, y: BW.y + BW.h / 2, abs: true, label: 'Окно Blender' }, () => {
      layer(ctx, in2 * (1 - k2b), () => {
        windowFrame(ctx, BW.x, BW.y, BW.w, BW.h, { title: 'Blender', icon: 'cube', t: gt });
        viewport(ctx, VP, () => {
          drawGrid(ctx, SV, { half: 3, step: 0.5, color: a(C.text, 0.1), width: 1.2 });
          softLight(ctx, SV.cx, SV.cy - 220, 380, C.h1, 0.1);
          ctx.save();
          ctx.globalAlpha *= 0.85;
          const m = drawOgre(ctx, SV, poseA, cgA.root);
          ctx.restore();
          drawBones(ctx, m.joints, SV, cgA.root, { p: seg(cA.t, 0.1, 1.2), color: C.h1 });
        }, { frame: false });
        keyTimeline(ctx, TL.x, TL.y, TL.w, TL.h, { head: walkK > 0 ? head : 0, keys: KEYS_BLENDER, p: seg(cA.t, 0.4, 1.6), color: C.accent });
      }, -260 * k2b + 60 * (1 - in2));
    });

    const cmpRender = seg(cA.p, 0.48, 0.1);
    /** Кадр ролика Seedance в окне «референс» (идёт по кругу). */
    const refFrame = seedanceFrameAt(f.t);
    const cmpRef = seg(cA.p, 0.64, 0.1);
    f.obj('render', { x: RENDER.x + RENDER.w / 2, y: RENDER.y + RENDER.h / 2, abs: true, label: 'Тестовый рендер' }, () => {
      if (cmpRender <= 0) return;
      layer(ctx, cmpRender * (1 - k2b), () => {
        // рендер рига в той же фазе, что и кадр референса рядом
        ogreThumb(ctx, RENDER, walkCycle(seedancePhase(refFrame)).pose, { ry: Math.PI / 2, tint: CLAY, color: C.h1, fill: 0.86 });
        iconBadge(ctx, 'cube', RENDER.x + 44, RENDER.y + 44, C.h1);
      }, -260 * k2b, 40 * (1 - easeOutQuart(cmpRender)));
    });
    f.obj('ref', { x: REF.x + REF.w / 2, y: REF.y + REF.h / 2, abs: true, label: 'Референс' }, () => {
      if (cmpRef <= 0) return;
      layer(ctx, cmpRef * (1 - k2b), () => {
        seedanceThumb(ctx, REF, refFrame, 'side', { color: C.accent });
        iconBadge(ctx, 'play', REF.x + 44, REF.y + 44, C.accent);
      }, -260 * k2b, 40 * (1 - easeOutQuart(cmpRef)));
    });
    f.obj('match', { x: 1480, y: 800, abs: true, label: 'Совпадает' }, () => {
      const p = seg(cA.p, 0.8, 0.1);
      if (p <= 0) return;
      layer(ctx, 1 - k2b, () => {
        ctx.save();
        ctx.strokeStyle = a(C.pos, 0.6 * p);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(RENDER.x + RENDER.w / 2, RENDER.y + RENDER.h + 8);
        ctx.quadraticCurveTo(RENDER.x + RENDER.w / 2, 800, 1440, 800);
        ctx.moveTo(REF.x + REF.w / 2, REF.y + REF.h + 8);
        ctx.quadraticCurveTo(REF.x + REF.w / 2, 800, 1520, 800);
        ctx.stroke();
        ctx.restore();
        checkBadge(ctx, 1480, 800, 46, p);
      }, -260 * k2b);
    });

    // размытый запрос → образец движения
    f.obj('fuzzy', { x: FUZZY.x + FUZZY.w / 2, y: FUZZY.y + FUZZY.h / 2, abs: true, label: 'Размытый запрос' }, () => {
      const p = seg(cSa.t, 0.2, 0.7);
      if (p <= 0) return;
      const dim = seg(cSa.p, 0.4, 0.15);
      layer(ctx, p * (1 - out2) * (1 - 0.45 * dim), () => {
        promptPanel(ctx, FUZZY.x, FUZZY.y, FUZZY.w, FUZZY.h, { typed: 1, fuzzy: 1, color: C.text, rows: [0.9, 0.7, 0.86, 0.55], t: gt });
        crossBadge(ctx, FUZZY.x + FUZZY.w - 6, FUZZY.y + 6, 40, dim);
      }, -60 * (1 - easeOutQuart(p)));
    });

    const SO = ogreView(1260, 930, 190, -0.35, 0.12, 9);
    f.obj('onion', { x: 1280, y: 700, abs: true, label: 'Образец движения' }, () => {
      const p = seg(cSa.t, 0.6, 0.8);
      if (p <= 0) return;
      layer(ctx, p * (1 - out2), () => {
        arrow(ctx, FUZZY.x + FUZZY.w + 30, FUZZY.y + FUZZY.h / 2, FUZZY.x + FUZZY.w + 150, FUZZY.y + FUZZY.h / 2, seg(cSa.p, 0.45, 0.12), { color: C.pos, width: 5, head: 22 });
        softLight(ctx, 1280, 700, 560, C.pos, 0.08);
        // «луковая кожа»: позы шага по пути, полупрозрачные
        // позы и путь — из одного шага: огр проходит ровно через свои «призраки»
        const LOOP = 2.6; // циклов шага на проход
        const n = 5;
        for (let k = 0; k < n; k++) {
          const gp = seg(cSa.t, 0.9 + k * 0.25, 0.4);
          if (gp <= 0) continue;
          const ph = (k / (n - 1)) * LOOP * 0.94 + 0.05;
          const wc = walkCycle(ph, MAGE_GAIT.L);
          ctx.save();
          ctx.globalAlpha *= gp * (0.16 + 0.05 * k);
          const gp3 = gait(ph, { heading: Math.PI / 2, ...MAGE_GAIT }).root.pos!;
          drawOgre(ctx, SO, wc.pose, { pos: [-1.9 + gp3[0], 0, gp3[2]], ry: Math.PI / 2 }, { tint: C.h1, shadow: 0 });
          ctx.restore();
        }
        // сам огр идёт сквозь эти позы
        const ph = ((f.t / mageWalkCycle()) % LOOP + LOOP) % LOOP;
        const wc = walkCycle(ph, MAGE_GAIT.L);
        const gw = gait(ph, { heading: Math.PI / 2, ...MAGE_GAIT }).root.pos!;
        drawOgre(ctx, SO, wc.pose, { pos: [-1.9 + gw[0], 0, gw[2]], ry: Math.PI / 2 }, { alpha: Math.min(1, (LOOP - ph) * 3, ph * 3 + 0.2) });
        checkBadge(ctx, 1700, 470, 46, seg(cSa.p, 0.72, 0.1));
      });
    });

    // ================================================================ этап 3
    const P3 = lerp(960, 620, kI);
    const S3 = ogreView(P3, 940, lerp(225, 205, kI), 0.35, 0.12, 9);
    const skin = seg(cE.t, 0, 0.7);
    const fix = easeInOutCubic(seg(cMa.t, 1.1, 1.2));
    // шаг с неровным таймингом, пока не исправили
    const stutter = 0.12 * Math.sin(gt * 5.3) * (1 - fix);
    // на время ручной правки огр замирает: шаг идёт по «чистому» времени, без пауз
    let frozen = 0;
    for (let i = 0; i < 48; i++) {
      const tt = cMa.start + ((f.t - cMa.start) * (i + 0.5)) / 48;
      if (f.t <= cMa.start) break;
      frozen += (seg(tt - cMa.start, 0, 0.4) * (1 - seg(tt - cI.start, 0, 0.5)) * (f.t - cMa.start)) / 48;
    }
    const cg3 = circleGait((f.t - frozen) / mageWalkCycle() + stutter, { heading: 0.35, who: 'mage' });
    let pose3: OgrePose = cg3.pose;
    const wrong = cE.began ? 1 - fix : 0;
    // сбой захвата: правая рука уходит вверх-в сторону поверх шага
    pose3 = { ...pose3, glitchArmR: wrong };
    void WRONG;
    const root3: Root = cg3.root;
    const model3 = mage(pose3, { jointsOnly: true });
    const hand = toScreen(placePoint(model3.joints.handR, root3), S3);
    const shoulder = toScreen(placePoint(model3.joints.shoulderR, root3), S3);

    f.obj('ogre3', { x: P3, y: 700, abs: true, label: 'Огр' }, () => {
      layer(ctx, in3, () => {
        softLight(ctx, P3, 700, 520, C.h1, 0.08);
        // мокап-костюм: тёмный огр с маркерами
        if (skin < 1) {
          ctx.save();
          ctx.globalAlpha *= 1 - skin;
          drawOgre(ctx, S3, pose3, root3, { tint: DARK });
          for (const m of markers(model3.joints)) {
            const [mx, my] = toScreen(placePoint(m, root3), S3);
            ctx.save();
            ctx.shadowColor = a(C.h1, 0.9);
            ctx.shadowBlur = 14;
            ctx.fillStyle = C.text;
            ctx.beginPath();
            ctx.arc(mx, my, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          ctx.restore();
        }
        if (skin > 0) {
          ctx.save();
          ctx.globalAlpha *= skin;
          drawOgre(ctx, S3, pose3, root3);
          ctx.restore();
          // ошибка: рука подсвечена, после правки — зелёная
          const hl = skin * (1 - seg(cI.t, 0.5, 0.6));
          if (hl > 0) {
            const arm = mage(pose3, { only: ['upper_arm.R', 'forearm.R', 'hand.R'] }).parts;
            ctx.save();
            ctx.globalAlpha *= hl * (fix > 0.5 ? 0.45 : 0.35 + 0.2 * Math.sin(gt * 6));
            drawModel(ctx, arm, S3, root3, { tint: fix > 0.5 ? C.pos : C.accent });
            ctx.restore();
          }
        }
      });
    });

    f.obj('mocapX', { x: P3, y: 680, abs: true, label: 'Не мокап' }, () => {
      const p = seg(cMo.t, 0.6, 0.5);
      const out = seg(cE.t, -0.1, 0.5);
      if (p <= 0 || out >= 1) return;
      layer(ctx, 1 - out, () => {
        strike(ctx, P3 - 300, 440, P3 + 300, 930, p, C.accent, 12);
        crossBadge(ctx, P3 + 290, 460, 50, seg(cMo.t, 0.9, 0.5));
      });
    });

    f.obj('warn', { x: shoulder[0] - 90, y: shoulder[1] - 40, abs: true, label: 'Ошибка' }, () => {
      const p = seg(cE.t, 0.8, 0.5) * (1 - seg(cMa.t, 0.9, 0.4));
      if (p <= 0) return;
      const x = shoulder[0] - 110;
      const y = shoulder[1] - 50;
      ctx.save();
      ctx.globalAlpha *= p;
      shockRing(ctx, hand[0], hand[1], (gt * 0.8) % 1, 90, C.accent, 3);
      ctx.fillStyle = a(C.bg, 0.85);
      ctx.beginPath();
      ctx.arc(x, y, 40, 0, Math.PI * 2);
      ctx.fill();
      icon(ctx, 'warning', x, y - 2, 52, C.accent);
      ctx.restore();
    });

    // тайминг: таймлайн с «уехавшим» ключом, который на правке встаёт на место
    f.obj('timing', { x: TL3.x + TL3.w / 2, y: TL3.y + TL3.h / 2, abs: true, label: 'Таймлайн' }, () => {
      const p = seg(cE.t, 1.6, 0.6);
      if (p <= 0) return;
      const keys: Array<[number, number]> = [];
      for (let row = 0; row < 2; row++) for (let k = 0; k <= 4; k++) keys.push([row, k / 4]);
      keys[6] = [1, lerp(0.39, 0.25, fix)];
      layer(ctx, p * (1 - kI), () => {
        keyTimeline(ctx, TL3.x, TL3.y, TL3.w, TL3.h, {
          head: ((f.t * 0.35) % 1 + 1) % 1,
          keys,
          rows: 2,
          bad: fix < 0.5 ? [6] : [],
          color: C.h1,
        });
      }, 40 * (1 - easeOutQuart(p)));
    });

    // ручная правка: кости, курсор тянет кисть
    f.obj('cursor', { x: hand[0], y: hand[1], abs: true, label: 'Курсор' }, () => {
      const p = seg(cMa.t, 0, 0.4) * (1 - seg(cI.t, 0.2, 0.5));
      if (p <= 0) return;
      ctx.save();
      ctx.globalAlpha *= p;
      drawBones(ctx, model3.joints, S3, root3, {
        p: seg(cMa.t, 0, 0.6),
        color: C.h1,
        focus: ['handR', 'elbowR'],
        focusColor: fix > 0.5 ? C.pos : C.accent,
        t: gt,
      });
      const start: P2 = [P3 + 520, 560];
      const reach = easeInOutCubic(seg(cMa.t, 0.3, 0.7));
      const away = easeInOutCubic(seg(cMa.t, 2.5, 0.6));
      const cx = lerp(lerp(start[0], hand[0], reach), start[0], away);
      const cy = lerp(lerp(start[1], hand[1], reach), start[1] + 60, away);
      const press = seg(cMa.t, 1.0, 0.1) * (1 - seg(cMa.t, 2.35, 0.1));
      if (press > 0) {
        ctx.fillStyle = a(C.accent, 0.25 * press);
        ctx.beginPath();
        ctx.arc(hand[0], hand[1], 30, 0, Math.PI * 2);
        ctx.fill();
      }
      icon(ctx, 'cursor', cx, cy, 64 * (1 - 0.12 * press), C.text);
      ctx.restore();
      checkBadge(ctx, hand[0] - 70, hand[1] - 70, 40, seg(cMa.t, 2.4, 0.5) * (1 - seg(cI.t, 0.2, 0.5)));
    });

    // полоса времени: длинная → короткая
    f.obj('time', { x: TIME_BAR.x + TIME_BAR.w / 2, y: TIME_BAR.y + TIME_BAR.h / 2, abs: true, label: 'Время' }, () => {
      const p = seg(cI.p, 0.1, 0.12);
      if (p <= 0) return;
      const grow = easeOutQuart(seg(cI.p, 0.12, 0.15));
      const cut = easeInOutCubic(seg(cI.p, 0.6, 0.18));
      const B = TIME_BAR;
      const keep = 0.22;
      ctx.save();
      ctx.globalAlpha *= p;
      // часы: стрелки бегут, пока время не «срезано»
      const spin = gt * lerp(6, 0.6, cut);
      ctx.fillStyle = a(C.bg, 0.85);
      ctx.beginPath();
      ctx.arc(B.x - 70, B.y + B.h / 2, 52, 0, Math.PI * 2);
      ctx.fill();
      icon(ctx, 'clock', B.x - 70, B.y + B.h / 2, 84, cut > 0.5 ? C.pos : C.accent, spin);
      // подложка
      ctx.fillStyle = a(C.text, 0.1);
      rrPath(ctx, B.x, B.y, B.w, B.h, B.h / 2);
      ctx.fill();
      const full = B.w * grow;
      const kept = lerp(full, B.w * keep, cut);
      // срезанная часть отваливается вниз
      if (cut > 0 && cut < 1) {
        ctx.save();
        ctx.globalAlpha *= 1 - cut;
        ctx.translate(0, cut * 70);
        ctx.fillStyle = a(C.accent, 0.6);
        rrPath(ctx, B.x + B.w * keep + 8, B.y, B.w * (1 - keep) - 8, B.h, B.h / 2);
        ctx.fill();
        ctx.restore();
      }
      const col = cut > 0.5 ? C.pos : C.accent;
      ctx.save();
      ctx.shadowColor = a(col, 0.6);
      ctx.shadowBlur = 20;
      ctx.fillStyle = col;
      rrPath(ctx, B.x, B.y, Math.max(B.h, kept), B.h, B.h / 2);
      ctx.fill();
      ctx.restore();
      ctx.restore();
      checkBadge(ctx, B.x + B.w * keep + 70, B.y + B.h / 2, 40, seg(cI.p, 0.8, 0.1));
    });
  },
};
