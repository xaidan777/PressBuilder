/**
 * Сцена 3. План ролика: цепочка из четырёх узлов со стрелками.
 *   process — рамки узлов и стрелки прочерчиваются пустыми;
 *   path    — узлы заполняются по мере названия: генерация (плотная модель) → оптимизированный
 *             огр с сеткой → огр со скелетом → огр идёт;
 *   tips    — цепочка отступает, по кадру рассыпаются звёзды и молнии.
 */

import { clamp01, easeInOutCubic, easeOutBack, hash11, seg } from '../../engine/anim.ts';
import { arrow, rrPath, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import {
  drawBones,
  drawModel,
  groundShadow,
  IDLE,
  hero,
  ogrePose,
  SCREEN_BG,
  titles,
  type Rect,
  type View,
} from './common.ts';
import { grassGround, scanReveal, stage, subdivide } from './kit_A.ts';
import { sayFrac } from './kit_C.ts';

type Ctx = CanvasRenderingContext2D;

const NODE_W = 340;
const NODE_H = 540;
const NODE_Y = 330;
const GAP = (1620 - NODE_W * 4) / 3;
const nodeRect = (i: number): Rect => ({ x: 150 + i * (NODE_W + GAP), y: NODE_Y, w: NODE_W, h: NODE_H });
const COLORS = [C.accent, C.h1, C.h1, C.pos];

function nodeView(r: Rect, yaw: number): View {
  return { cx: r.x + r.w / 2, cy: r.y + r.h * 0.86, size: (r.h * 0.66) / 2.2, pitch: 0.14, yaw, dist: 9 };
}

/** Содержимое узла i. */
function nodeContent(ctx: Ctx, i: number, r: Rect, p: number, gt: number): void {
  const yaw = 0.5 + Math.sin(gt * 0.5 + i) * 0.45;
  const view = nodeView(r, yaw);
  softLight(ctx, r.x + r.w / 2, r.y + r.h * 0.5, r.w * 0.6, COLORS[i], 0.12);
  if (i === 0) {
    // генерация: плотная модель проявляется сканером
    groundShadow(ctx, view, 0, 0, 1.0, 0.8, 0.4);
    scanReveal(ctx, r, p, () => drawModel(ctx, subdivide(hero('wizard', IDLE).parts, 2), view, {}, { wire: a(C.bg, 0.4), wireWidth: 0.5 }), C.accent);
    return;
  }
  if (i === 1) {
    // оптимизированная модель: видны настоящие треугольники
    groundShadow(ctx, view, 0, 0, 1.0, 0.8, 0.4);
    ctx.save();
    ctx.globalAlpha *= clamp01(p * 2);
    drawModel(ctx, hero('wizard', IDLE).parts, view, {}, { wire: a(C.h1, 0.75), wireWidth: 1.4 });
    ctx.restore();
    return;
  }
  if (i === 2) {
    // риг: модель полупрозрачная, сквозь неё скелет
    const m = hero('wizard', ogrePose('idle', gt * 0.4));
    groundShadow(ctx, view, 0, 0, 1.0, 0.8, 0.4);
    ctx.save();
    ctx.globalAlpha *= 0.38 * clamp01(p * 2);
    drawModel(ctx, m.parts, view, {}, {});
    ctx.restore();
    drawBones(ctx, m.joints, view, {}, { p: seg(p, 0.1, 0.9), color: C.h1, focus: ['elbowL', 'elbowR', 'kneeL', 'kneeR'], t: gt });
    return;
  }
  // анимация: огр шагает, земля бежит под ним
  const walkView = nodeView(r, 0.75);
  const fwd = gt * 1.1;
  ctx.save();
  ctx.globalAlpha *= clamp01(p * 2);
  grassGround(ctx, walkView, 1.6, { tile: 2.4, scroll: [0, -fwd] });
  groundShadow(ctx, walkView, 0, 0, 0.9, 0.7, 0.45);
  drawModel(ctx, hero('wizard', ogrePose('walk', gt * 0.85)).parts, walkView, {}, {});
  ctx.restore();
}

/** Россыпь «советов»: звёзды и молнии. */
/** Звёзды и молнии советов — полосой под цепочкой и справа от заголовка, не поверх моделей. */
const TIPS = Array.from({ length: 10 }, (_, k) => {
  const bottom = k < 6;
  const x = bottom ? 300 + k * 270 + (hash11(k * 3.7) - 0.5) * 80 : 1330 + (k - 6) * 120;
  const y = bottom ? 960 + (hash11(k * 9.1) - 0.5) * 50 : 200 + ((k - 6) % 2) * 70;
  return {
    x,
    y,
    icon: k % 2 ? 'bolt' : 'star',
    size: bottom ? 76 + hash11(k * 1.9) * 30 : 60,
    at: (k / 10) * 0.6,
    color: [C.accent, C.pos, C.h1][k % 3],
  };
});

export const scene03: SceneDef = {
  id: 's03',

  energy: (_t, cue) => 0.6 * seg(cue('tips').p, 0.05, 0.3),

  render(f: Frame) {
    const { ctx, gt } = f;
    const cPr = f.cue('process');
    const cPa = f.cue('path');
    const cT = f.cue('tips');

    titles(f, [{ c: cPr }, { c: cPa }, { c: cT, color: C.pos }]);

    // цепочка отступает и приглушается, когда сыплются советы
    const back = easeInOutCubic(seg(cT.t, 0, 0.8));
    const chain = (fn: () => void) => {
      ctx.save();
      ctx.globalAlpha *= 1 - 0.55 * back;
      const s = 1 - 0.08 * back;
      ctx.translate(960, 600);
      ctx.scale(s, s);
      ctx.translate(-960, -600);
      fn();
      ctx.restore();
    };

    const AT = ['генерации', 'оптимизированной', 'ригом', 'анимацией'].map((w, i) => sayFrac(cPa, w, [0.02, 0.3, 0.58, 0.8][i]));
    for (let i = 0; i < 4; i++) {
      const r = nodeRect(i);
      const frameP = seg(cPr.t, 0.3 + i * 0.35, 0.6);
      const fillP = seg(cPa.p, AT[i], 0.22);
      f.obj(`node:${i}`, { x: r.x + r.w / 2, y: r.y + r.h / 2, abs: true, label: `Узел ${i + 1}` }, () => {
        chain(() =>
          stage(
            ctx,
            frameP,
            0,
            () => {
              ctx.save();
              rrPath(ctx, r.x, r.y, r.w, r.h, 14);
              ctx.clip();
              ctx.fillStyle = SCREEN_BG;
              ctx.fillRect(r.x, r.y, r.w, r.h);
              if (fillP > 0) nodeContent(ctx, i, r, fillP, gt);
              ctx.restore();
              const lit = clamp01(fillP * 3);
              ctx.strokeStyle = a(COLORS[i], 0.3 + 0.35 * lit);
              ctx.lineWidth = 2 + lit;
              if (lit <= 0) ctx.setLineDash([12, 10]);
              rrPath(ctx, r.x, r.y, r.w, r.h, 14);
              ctx.stroke();
              ctx.setLineDash([]);
            },
            { dy: 40, from: 0.92, cx: r.x + r.w / 2, cy: r.y + r.h / 2 },
          ),
        );
      });
      if (i < 3) {
        const x1 = r.x + r.w + 14;
        const x2 = r.x + r.w + GAP - 14;
        const y = r.y + r.h / 2;
        f.obj(`arrow:${i}`, { x: (x1 + x2) / 2, y, abs: true, label: `Стрелка ${i + 1}` }, () => {
          chain(() => {
            const lit = seg(cPa.p, AT[i + 1] - 0.06, 0.1);
            arrow(ctx, x1, y, x2, y, seg(cPr.t, 0.55 + i * 0.35, 0.4), {
              color: lit > 0 ? COLORS[i + 1] : a(C.text, 0.35),
              width: 5,
              head: 22,
            });
          });
        });
      }
    }

    // советы
    f.obj('tips', { x: 960, y: 640, abs: true, label: 'Звёзды и молнии' }, () => {
      if (!cT.began) return;
      for (const [k, tp] of TIPS.entries()) {
        const p = seg(cT.p, 0.04 + tp.at, 0.12);
        if (p <= 0) continue;
        const s = easeOutBack(p, 2.2);
        const bob = Math.sin(gt * 1.6 + k) * 8;
        const tw = 0.75 + 0.25 * Math.sin(gt * 3 + k * 1.3);
        ctx.save();
        ctx.globalAlpha *= Math.min(1, p * 3);
        softLight(ctx, tp.x, tp.y + bob, tp.size * 1.3, tp.color, 0.16 * tw);
        ctx.translate(tp.x, tp.y + bob);
        ctx.rotate(Math.sin(gt * 0.8 + k) * 0.15);
        ctx.scale(s, s);
        icon(ctx, tp.icon, 0, 0, tp.size, tp.color, gt);
        ctx.restore();
      }
    });
  },
};
