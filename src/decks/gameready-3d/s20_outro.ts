/**
 * Сцена 20. Итог.
 * Этап 1: пайплайн — Tripo (исходная геометрия) → Claude Code (LOD, риг, анимация)
 *   ← видеогенератор (характер движения) → готовый идущий огр. Узлы зажигаются по репликам.
 * Этап 2: две стороны под контролем — красивый огр и игра с толпой огров;
 *   у каждой спидометр, обе стрелки уходят в зелёную зону.
 * Этап 3: лайк, YouTube, Telegram; прощание на фоне вращающейся квадовой сетки (как в начале).
 */

import { clamp01, easeInOutCubic, easeOutBack, easeOutQuart, lerp, seg } from '../../engine/anim.ts';
import { hexPath, shockRing, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { a, C, W } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import { chip } from '../../engine/ui.ts';
import { drawGrid } from '../../engine/wire3d.ts';
import {
  checkBadge,
  DARK,
  drawBones,
  crystal,
  flow,
  grassTexture,
  headline,
  ogrePose,
  textBacking,
  titles,
  toolCard,
  toScreen,
  viewport,
  windowFrame,
  type OgrePose,
  type Rect,
  type Root,
  circleGait,
  mageWalkCycle,
  type View,
  gait,
  walkCycle,
  MAGE_GAIT,
} from './common.ts';
import { sayFrac } from './kit_C.ts';
import { drawOgre, gauge, layer, ogreView } from './kit_E.ts';

type Ctx = CanvasRenderingContext2D;

// ---------------------------------------------------------------- этап 1: пайплайн

const TRIPO: Rect = { x: 150, y: 320, w: 440, h: 140 };
const RAW: Rect = { x: 150, y: 486, w: 440, h: 280 };
const GEN: Rect = { x: 150, y: 800, w: 440, h: 140 };
const CWIN: Rect = { x: 690, y: 320, w: 560, h: 620 };
const CVP: Rect = { x: 704, y: 412, w: 532, h: 514 };
const OUT = { cx: 1555, ground: 880 };

/** «Характер движения»: тот же шаг, но с раскачкой корпуса и размашистыми руками. */
function character(p: OgrePose, k: number): OgrePose {
  return {
    ...p,
    lean: p.lean + 0.08 * k,
    twist: p.twist * (1 + 0.9 * k),
    armL: p.armL * (1 + 0.6 * k),
    armR: p.armR * (1 + 0.6 * k),
    head: p.head + 0.06 * k * Math.sin(p.twist * 8),
  };
}

/** Корень мага на круге (поворот на шаг, путь отцентрирован): phase ≤ 0 — стоит лицом к камере. */
function circleRoot(phase: number, dx = 0): { root: Root; pose: OgrePose | null } {
  const g = circleGait(phase, { turn: -0.8, heading: 0, who: 'mage', fromIdle: true });
  return { root: { pos: [dx + g.root.pos![0], 0, g.root.pos![2]], ry: g.root.ry }, pose: g.walking ? g.pose : null };
}

/** Круглая «полянка» с травой игры под огром. */
function grassDisc(ctx: Ctx, view: View, rx: number, alpha: number): void {
  const [cx, cy] = toScreen([0, 0, 0], view);
  const [ex] = toScreen([rx, 0, 0], view);
  const [, ey] = toScreen([0, 0, rx], view);
  const w = Math.abs(ex - cx);
  const h = Math.max(8, Math.abs(ey - cy));
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w, h, 0, 0, Math.PI * 2);
  ctx.clip();
  const img = grassTexture();
  if (img) {
    ctx.drawImage(img, cx - w, cy - w * 0.5, w * 2, w);
  } else {
    ctx.fillStyle = a(C.pos, 0.2);
    ctx.fillRect(cx - w, cy - h, w * 2, h * 2);
  }
  const g = ctx.createRadialGradient(cx, cy, w * 0.5, cx, cy, w);
  g.addColorStop(0, a(C.bg, 0));
  g.addColorStop(1, a(C.bg, 0.85));
  ctx.fillStyle = g;
  ctx.fillRect(cx - w, cy - w, w * 2, w * 2);
  ctx.restore();
}

// ---------------------------------------------------------------- этап 2: внешний вид и производительность

const LEFT: Rect = { x: 150, y: 300, w: 790, h: 700 };
const RIGHT: Rect = { x: 980, y: 300, w: 790, h: 700 };
const GAUGE_Y = 948;

// ---------------------------------------------------------------- этап 3: прощание

const SOCIAL = [
  { icon: 'thumb', color: C.pos, x: 600 },
  { icon: 'youtube', color: C.accent, x: 960 },
  { icon: 'telegram', color: C.h1, x: 1320 },
];
const SOCIAL_Y = 590;
/** Что лежит в Telegram: эксперименты, инструменты, находки — иконками. */
const FINDS = ['cube', 'wrench', 'star'];

export const scene20: SceneDef = {
  id: 's20',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cR = f.cue('result');
    const cT = f.cue('tripo');
    const cC = f.cue('claude');
    const cV = f.cue('video');
    const cLk = f.cue('look');
    const cPf = f.cue('perf');
    const cAl = f.cue('all');
    const cLi = f.cue('like');
    const cTg = f.cue('telegram');
    const cBy = f.cue('bye');

    // заголовок уходит перед финальной фразой
    ctx.save();
    ctx.globalAlpha *= 1 - seg(cBy.t, -0.4, 0.5);
    titles(f, [
      { c: cR, color: C.h1 },
      { c: cC, color: C.accent },
      { c: cLk, color: C.h1 },
      { c: cPf, color: C.pos },
      { c: cAl, color: C.h1 },
    ]);
    ctx.restore();

    // ---- переходы
    const out1 = easeInOutCubic(seg(cLk.t, -0.3, 0.8));
    const in2 = easeOutQuart(seg(cLk.t, -0.1, 0.8));
    const out2 = easeInOutCubic(seg(cAl.t, -0.2, 0.8));
    const bye = easeInOutCubic(seg(cBy.t, -0.5, 0.6));

    // узлы: появляются на «пайплайне», зажигаются на своих репликах
    const appearAt = (k: number) => seg(cR.t, 0.4 + k * 0.45, 0.6);
    const lit = (c: typeof cT) => seg(c.t, 0, 0.4);

    // ================================================================ этап 1
    const pipe = (fn: () => void) => layer(ctx, 1 - out1, fn, 0, 0, 1 - 0.05 * out1, 960, 640);

    f.obj('flows', { x: 960, y: 640, abs: true, label: 'Связи' }, () => {
      pipe(() => {
        const base = seg(cR.t, 1.6, 1.0);
        flow(ctx, [TRIPO.x + TRIPO.w + 8, TRIPO.y + TRIPO.h / 2], [CWIN.x - 30, TRIPO.y + TRIPO.h / 2], [CWIN.x - 6, CVP.y + 120], {
          t: gt,
          color: C.h1,
          p: base,
          n: cT.began ? 4 : 0,
          r: 8,
          lineAlpha: 0.25 + 0.3 * lit(cT),
        });
        flow(ctx, [GEN.x + GEN.w + 8, GEN.y + GEN.h / 2], [CWIN.x - 30, GEN.y + GEN.h / 2], [CWIN.x - 6, CVP.y + CVP.h - 140], {
          t: gt + 0.4,
          color: C.accent,
          p: base,
          n: cV.began ? 4 : 0,
          r: 8,
          lineAlpha: 0.25 + 0.3 * lit(cV),
        });
        flow(ctx, [CWIN.x + CWIN.w + 6, CWIN.y + CWIN.h / 2], [CWIN.x + CWIN.w + 60, OUT.ground - 200], [OUT.cx - 200, OUT.ground - 200], {
          t: gt,
          color: C.pos,
          p: base,
          n: cV.began ? 3 : 0,
          r: 8,
          lineAlpha: 0.25 + 0.3 * seg(cV.t, 1.2, 0.5),
        });
      });
    });

    f.obj('card:tripo', { x: TRIPO.x + TRIPO.w / 2, y: TRIPO.y + TRIPO.h / 2, abs: true, text: 'Tripo', label: 'Карточка Tripo' }, (o) => {
      pipe(() => {
        toolCard(ctx, TRIPO.x, TRIPO.y, TRIPO.w, TRIPO.h, { name: o.text, icon: 'cube', color: C.h1, p: appearAt(0), active: lit(cT), t: gt });
      });
    });

    // исходная геометрия: сетка треугольников реальной модели
    f.obj('raw', { x: RAW.x + RAW.w / 2, y: RAW.y + RAW.h / 2, abs: true, label: 'Исходная геометрия' }, () => {
      const p = seg(cT.t, 0.2, 0.6);
      if (p <= 0) return;
      pipe(() => {
        layer(ctx, p, () => {
          viewport(ctx, RAW, () => {
            const v = ogreView(RAW.x + RAW.w / 2, RAW.y + RAW.h - 26, 102, gt * 0.5, 0.14, 9);
            drawOgre(ctx, v, ogrePose('idle', 0), {}, { wire: a(C.bg, 0.6), shadow: 0.3 });
          }, { color: C.h1 });
        }, 0, 24 * (1 - easeOutQuart(p)));
      });
    });

    f.obj('card:gen', { x: GEN.x + GEN.w / 2, y: GEN.y + GEN.h / 2, abs: true, text: 'Seedance 2.5', label: 'Карточка видеогенератора' }, (o) => {
      pipe(() => {
        toolCard(ctx, GEN.x, GEN.y, GEN.w, GEN.h, { name: o.text, icon: 'play', color: C.accent, p: appearAt(2), active: lit(cV), t: gt });
      });
    });

    // Claude Code: LOD0/LOD1 → кости → анимация → характер движения
    const split = easeInOutCubic(seg(cC.t, 0.4, 0.7)) * (1 - easeInOutCubic(seg(cC.t, 2.5, 0.6)));
    const rig = seg(cC.t, 2.9, 1.0);
    const charK = easeInOutCubic(seg(cV.t, 0.3, 1.0));
    // огр в окне идёт по кругу: поворот вокруг опорной стопы, стопы не скользят
    const phC = (cC.t - 4.2) / mageWalkCycle();
    const cr = circleRoot(phC);
    const poseC = cr.pose ? character(cr.pose, charK) : ogrePose('idle', gt * 0.4);
    const walkRoot = (dx: number): Root => circleRoot(phC, dx).root;
    const wireK = 1 - seg(cC.t, 3.6, 1.0);

    f.obj('claude', { x: CWIN.x + CWIN.w / 2, y: CWIN.y + CWIN.h / 2, abs: true, label: 'Окно Claude Code' }, () => {
      pipe(() => {
        const p = appearAt(1);
        if (p <= 0) return;
        layer(ctx, p, () => {
          windowFrame(ctx, CWIN.x, CWIN.y, CWIN.w, CWIN.h, { title: 'Claude Code', icon: 'robot', color: C.accent, glow: lit(cC), t: gt });
          viewport(ctx, CVP, () => {
            const view = ogreView(CVP.x + CVP.w / 2, CVP.y + CVP.h - 60, lerp(150, 104, split), 0.5, 0.12, 9);
            drawGrid(ctx, view, { half: 2.5, step: 0.5, color: a(C.text, 0.1), width: 1.2 });
            const has = seg(cT.t, 1.0, 0.6);
            if (has <= 0) return;
            ctx.save();
            ctx.globalAlpha *= has;
            softLight(ctx, view.cx, view.cy - 200, 320, C.accent, 0.1 * lit(cC));
            const wire = wireK > 0.02 ? a(C.bg, 0.6 * wireK) : undefined;
            const dx = 1.05 * split;
            const m = drawOgre(ctx, view, poseC, walkRoot(-dx), { wire });
            if (split > 0.01) {
              ctx.save();
              ctx.globalAlpha *= split;
              drawOgre(ctx, view, poseC, walkRoot(dx), { wire, decim: 0.09 });
              ctx.restore();
            }
            drawBones(ctx, m.joints, view, walkRoot(-dx), { p: rig, color: C.h1 });
            ctx.restore();
            // подписи LOD под моделями
            if (split > 0.01) {
              const [l0] = toScreen([-dx, 0, 0], view);
              const [l1] = toScreen([dx, 0, 0], view);
              chip(ctx, 'LOD0', l0, CVP.y + CVP.h - 34, { color: C.h1, size: 46, p: split, align: 'center' });
              chip(ctx, 'LOD1', l1, CVP.y + CVP.h - 34, { color: C.accent, size: 46, p: split, align: 'center' });
            }
          }, { color: C.accent, corners: false });
        }, 0, 30 * (1 - easeOutQuart(p)));
      });
    });

    // готовый огр
    const outView = ogreView(OUT.cx, OUT.ground, 165, -0.45, 0.14, 9);
    f.obj('result', { x: OUT.cx, y: OUT.ground - 180, abs: true, label: 'Готовый огр' }, () => {
      pipe(() => {
        const p = Math.max(seg(cR.t, 2.0, 0.8) * 0.55, seg(cV.t, 1.0, 0.8));
        if (p <= 0) return;
        layer(ctx, p, () => {
          softLight(ctx, OUT.cx, OUT.ground - 200, 380, C.pos, 0.12 * seg(cV.t, 1.0, 0.8));
          grassDisc(ctx, outView, 1.6, seg(cV.t, 1.0, 0.8));
          const live = seg(cV.t, 1.0, 0.6);
          // оживший огр ходит по полянке по кругу, стопы не скользят
          const g = circleRoot((cV.t - 1.0) / mageWalkCycle());
          const pose = g.pose ? character(g.pose, 1) : ogrePose('idle', 0);
          const root = g.root;
          drawOgre(ctx, outView, pose, root, { tint: live < 0.5 ? DARK : undefined });
          checkBadge(ctx, OUT.cx + 170, OUT.ground - 420, 44, seg(cV.t, 2.4, 0.5));
        }, 0, 30 * (1 - easeOutQuart(p)));
      });
    });

    // ================================================================ этап 2
    const needle = (c: typeof cT) =>
      0.12 + 0.72 * easeOutBack(seg(c.t, 0.9, 1.6), 1.4) + 0.012 * Math.sin(gt * 3.1) * seg(c.t, 2.5, 0.5);

    const center = (W - LEFT.w) / 2 - LEFT.x;
    const toLeft = easeInOutCubic(seg(cPf.t, -0.4, 0.8));
    f.obj('look', { x: LEFT.x + LEFT.w / 2, y: LEFT.y + LEFT.h / 2, abs: true, label: 'Внешний вид' }, () => {
      layer(ctx, in2 * (1 - out2), () => {
        viewport(ctx, LEFT, () => {
          const v = ogreView(LEFT.x + LEFT.w / 2, 790, 200, -0.3 + Math.sin(gt * 0.35) * 0.5, 0.14, 9);
          softLight(ctx, v.cx - 80, 520, 460, C.accent, 0.16);
          grassDisc(ctx, v, 1.9, 0.9);
          drawOgre(ctx, v, ogrePose('idle', gt * 0.4));
        }, { color: C.accent });
        gauge(ctx, LEFT.x + LEFT.w / 2, GAUGE_Y, 118, { value: needle(cLk), p: seg(cLk.t, 0.5, 0.6), icon: 'eye', t: gt });
        checkBadge(ctx, LEFT.x + LEFT.w - 46, LEFT.y + 46, 40, seg(cLk.t, 2.6, 0.5));
      }, center * (1 - toLeft) - 40 * (1 - in2), 80 * out2);
    });

    f.obj('perf', { x: RIGHT.x + RIGHT.w / 2, y: RIGHT.y + RIGHT.h / 2, abs: true, label: 'Производительность' }, () => {
      const p = easeOutQuart(seg(cPf.t, -0.2, 0.7));
      if (p <= 0) return;
      layer(ctx, p * (1 - out2), () => {
        viewport(ctx, RIGHT, () => {
          const v: View = { cx: RIGHT.x + RIGHT.w / 2, cy: 660, size: 96, pitch: 0.45, yaw: -0.2, dist: 12 };
          const img = grassTexture();
          if (img) {
            ctx.save();
            ctx.globalAlpha *= 0.55;
            ctx.drawImage(img, RIGHT.x, RIGHT.y + 140, RIGHT.w, RIGHT.w * 0.62);
            ctx.restore();
          }
          // толпа огров ходит по полю поперёк кадра; дальние ряды — упрощённые LOD
          const crowd: Array<{ x: number; z: number; ph: number; dir: number }> = [];
          const lanes = [-2.6, -1.3, 0, 1.3];
          lanes.forEach((z, li) => {
            const dir = li % 2 ? -1 : 1;
            for (let k = 0; k < 2; k++) {
              const ph = gt * 0.9 + li * 0.37 + k * 0.5;
              // путь — из шага по опорной стопе (модель в масштабе 0.8), стопы не скользят по полю
              const d = gait(ph, { heading: 0, ...MAGE_GAIT }).root.pos![2] * 0.8;
              const x = ((((d * dir + k * 6 + li * 2.3) % 12) + 12) % 12) - 6;
              crowd.push({ x, z, ph, dir });
            }
          });
          crowd.sort((p1, p2) => p1.z - p2.z);
          for (const o of crowd) {
            drawOgre(ctx, v, walkCycle(o.ph, MAGE_GAIT.L).pose, { pos: [o.x, 0, o.z], scale: 0.8, ry: (o.dir * Math.PI) / 2 }, {
              lod: o.z < -1 ? 2 : 1,
              shadow: 0.35,
            });
          }
          const g = ctx.createLinearGradient(0, RIGHT.y, 0, RIGHT.y + RIGHT.h);
          g.addColorStop(0, a(C.bg, 1));
          g.addColorStop(0.3, a(C.bg, 0.15));
          g.addColorStop(0.75, a(C.bg, 0.1));
          g.addColorStop(1, a(C.bg, 0.75));
          ctx.fillStyle = g;
          ctx.fillRect(RIGHT.x, RIGHT.y, RIGHT.w, RIGHT.h);
        }, { color: C.pos });
        gauge(ctx, RIGHT.x + RIGHT.w / 2, GAUGE_Y, 118, { value: needle(cPf), p: seg(cPf.t, 0.4, 0.6), icon: 'bolt', t: gt });
        checkBadge(ctx, RIGHT.x + RIGHT.w - 46, RIGHT.y + 46, 40, seg(cPf.t, 2.6, 0.5));
      }, 60 * (1 - p), 80 * out2);
    });

    // ================================================================ этап 3
    // на «всё» огр выходит в центр и остаётся, пока не появятся иконки
    f.obj('ogreEnd', { x: 960, y: 700, abs: true, label: 'Огр' }, () => {
      const p = seg(cAl.t, 0.1, 0.7) * (1 - seg(cLi.t, 0.1, 0.6));
      if (p <= 0) return;
      layer(ctx, p, () => {
        const v = ogreView(960, 930, 205, Math.sin(gt * 0.4) * 0.4, 0.14, 9);
        softLight(ctx, 960, 680, 520, C.h1, 0.1);
        grassDisc(ctx, v, 1.8, 0.9);
        drawOgre(ctx, v, ogrePose('idle', gt * 0.4));
      }, 0, 40 * (1 - easeOutQuart(p)));
    });

    SOCIAL.forEach((s, i) => {
      f.obj(`social:${i}`, { x: s.x, y: SOCIAL_Y, label: ['Лайк', 'YouTube', 'Telegram'][i] }, () => {
        const at = [seg(cLi.t, 0.2, 0.6), seg(cLi.p, 0.3, 0.12), seg(cLi.p, 0.78, 0.12)][i];
        if (at <= 0) return;
        const tg = i === 2 ? easeInOutCubic(seg(cTg.t, 0, 0.8)) : 0;
        const dim = i < 2 ? 0.45 * seg(cTg.t, 0, 0.8) : 0;
        const e = easeOutBack(at, 2);
        ctx.save();
        ctx.globalAlpha *= clamp01(at * 2.5) * (1 - dim) * (1 - bye);
        const sc = e * (1 + 0.18 * tg);
        ctx.scale(sc, sc);
        softLight(ctx, 0, 0, 220, s.color, 0.14 + 0.12 * tg);
        hexPath(ctx, 0, 0, 120, Math.PI / 6);
        ctx.fillStyle = C.panel;
        ctx.fill();
        ctx.strokeStyle = a(s.color, 0.7);
        ctx.lineWidth = 3;
        ctx.stroke();
        hexPath(ctx, 0, 0, 138 + Math.sin(gt * 1.4 + i) * 4, Math.PI / 6);
        ctx.strokeStyle = a(s.color, 0.2);
        ctx.lineWidth = 2;
        ctx.stroke();
        icon(ctx, s.icon, 0, 0, 120, s.color, gt);
        ctx.restore();
        shockRing(ctx, 0, 0, seg(at, 0.2, 0.8), 240, s.color, 3);
      });
    });

    // находки вокруг Telegram
    const tgX = SOCIAL[2].x;
    FINDS.forEach((name, i) => {
      const ang = (i - 1) * 0.9 + Math.sin(gt * 0.8 + i) * 0.04;
      const R = 260;
      const x = tgX + Math.cos(ang) * R;
      const y = SOCIAL_Y + Math.sin(ang) * R;
      f.obj(`find:${i}`, { x, y, abs: true, label: `Находка ${i + 1}` }, () => {
        const p = seg(cTg.p, sayFrac(cTg, ['экспериментами', 'инструментами', 'находками'][i], 0.25 + i * 0.25), 0.12);
        if (p <= 0) return;
        ctx.save();
        ctx.globalAlpha *= clamp01(p * 2) * (1 - bye);
        const s = easeOutBack(p, 2);
        ctx.translate(x, y);
        ctx.scale(s, s);
        ctx.fillStyle = a(C.bg, 0.85);
        ctx.strokeStyle = a(C.h1, 0.5);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 58, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        icon(ctx, name, 0, 0, 66, C.h1, gt);
        ctx.restore();
      });
    });

    // прощание: сетка как в начале ролика и крупная фраза
    f.obj('mesh', { x: W / 2, y: 520, abs: true, label: 'Кристалл' }, () => {
      const build = seg(cBy.t, -0.5, 1.4);
      if (build <= 0) return;
      ctx.save();
      ctx.globalAlpha *= clamp01(build * 3);
      softLight(ctx, W / 2, 520, 720, C.h1, 0.12);
      ctx.restore();
      const view: View = { cx: W / 2, cy: 520, size: 330, pitch: 0.12, yaw: 0, dist: 4.2 };
      crystal(ctx, view, { p: build, t: gt, solid: 0.85 });
      shockRing(ctx, W / 2, 520, seg(cBy.t, 0, 0.9), 640, C.h1, 3);
    });
    f.obj('backing', { x: W / 2, y: 560, abs: true, label: 'Подложка' }, () => {
      textBacking(ctx, W / 2, 560, 900, 0.72 * seg(cBy.t, 0, 0.4));
    });
    headline(f, 'bye', cBy, {
      x: W / 2,
      y: 610,
      size: 156,
      align: 'center',
      glow: true,
      label: 'Прощание',
      reveal: { stagger: 0.2, rise: 40 },
    });
  },
};

