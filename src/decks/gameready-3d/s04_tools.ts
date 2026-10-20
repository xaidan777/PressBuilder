/**
 * Сцена 4. Генераторы 3D.
 *   start — три пустых слота под инструменты;
 *   tools — Tripo 3D, Hunyuan 3D, Hyper3D Rodin появляются по очереди, в каждом «генерируется» огр
 *           (у Tripo — игровой, у остальных — плотные сетки);
 *   tripo — Tripo подсвечен, остальные приглушены;
 *   rodin — у Rodin растёт стопка монет — дороже;
 *   p2    — Tripo разворачивается крупно: вращается огр, рядом значок подписки.
 */

import { clamp01, easeInOutCubic, easeOutBack, seg } from '../../engine/anim.ts';
import { hexPath, rrPath, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { a, C } from '../../engine/theme.ts';
import { chip } from '../../engine/ui.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import {
  checkBadge,
  drawModel,
  groundShadow,
  hero,
  ogrePose,
  SCREEN_BG,
  titles,
  toolCard,
  type Rect,
  type View,
} from './common.ts';
import { coinStack, grassGround, lerpRect, scanReveal, stage, subdivide } from './kit_A.ts';
import { sayFrac } from './kit_C.ts';

type Ctx = CanvasRenderingContext2D;

const COL_W = 520;
const COL_GAP = (1620 - COL_W * 3) / 2;
const PREV_Y = 300;
const PREV_H = 460;
const CARD_Y = 790;
const CARD_H = 180;
const colX = (i: number) => 150 + i * (COL_W + COL_GAP);
const prevRect = (i: number): Rect => ({ x: colX(i), y: PREV_Y, w: COL_W, h: PREV_H });
const cardRect = (i: number): Rect => ({ x: colX(i), y: CARD_Y, w: COL_W, h: CARD_H });

/** Этап p2: большой экран и карточка справа. */
const BIG: Rect = { x: 150, y: 300, w: 1080, h: 730 };
const BIG_CARD: Rect = { x: 1290, y: 300, w: 480, h: CARD_H };

const TOOLS = [
  { name: 'Tripo 3D', color: C.h1, icon: 'cube' },
  { name: 'Hunyuan 3D', color: C.pos, icon: 'hex' },
  { name: 'Hyper3D Rodin', color: C.accent, icon: 'cube' },
];

function previewView(r: Rect, yaw: number): View {
  return { cx: r.x + r.w / 2, cy: r.y + r.h * 0.9, size: (r.h * 0.6) / 2.2, pitch: 0.14, yaw, dist: 9 };
}

/** Результат генерации в окне инструмента i. */
function preview(ctx: Ctx, i: number, r: Rect, gen: number, gt: number, attack: number): void {
  ctx.save();
  rrPath(ctx, r.x, r.y, r.w, r.h, 14);
  ctx.clip();
  ctx.fillStyle = SCREEN_BG;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  softLight(ctx, r.x + r.w / 2, r.y + r.h * 0.45, r.w * 0.55, TOOLS[i].color, 0.1);
  const view = previewView(r, 0.35 + Math.sin(gt * 0.5 + i * 2) * 0.5);
  groundShadow(ctx, view, 0, 0, 1.0, 0.8, 0.4 * clamp01(gen * 3));
  if (i === 0) {
    const pose = attack > 0 ? ogrePose('attack', gt * 0.5) : ogrePose('idle', gt * 0.4);
    scanReveal(ctx, r, gen, () => drawModel(ctx, hero('wizard', pose).parts, view, {}, { wire: a(C.bg, 0.5), wireWidth: 1 }), TOOLS[i].color);
  } else {
    const parts = subdivide(hero('wizard', ogrePose('idle', gt * 0.4 + i)).parts, i);
    scanReveal(ctx, r, gen, () => drawModel(ctx, parts, view, {}, { wire: a(C.bg, 0.3), wireWidth: 0.5 }), TOOLS[i].color);
  }
  ctx.restore();
}

export const scene04: SceneDef = {
  id: 's04',

  energy: (_t, cue) => Math.max(0.4 * seg(cue('tripo').t, 0, 0.6) * (1 - seg(cue('rodin').t, 0, 0.6)), 0.6 * seg(cue('p2').t, 0.3, 0.8)),

  render(f: Frame) {
    const { ctx, gt } = f;
    const cS = f.cue('start');
    const cT = f.cue('tools');
    const cTr = f.cue('tripo');
    const cR = f.cue('rodin');
    const cP = f.cue('p2');

    titles(f, [{ c: cS }, { c: cR }, { c: cP, color: C.h1 }]);

    const AT = ['Tripo', 'Hunyuan', 'Hyper3D'].map((w, i) => sayFrac(cT, w, [0.52, 0.66, 0.8][i]));
    const big = easeInOutCubic(seg(cP.t, 0, 1.0));
    const othersOut = seg(cP.t, -0.2, 0.6);
    const tripoOn = seg(cTr.t, 0.1, 0.5);

    for (let i = 0; i < 3; i++) {
      const slotP = seg(cS.t, 0.1 + i * 0.25, 0.5);
      const fill = seg(cT.p, AT[i], 0.08);
      const gen = seg(cT.p, AT[i] + 0.02, 0.2);
      const active = i === 0 ? tripoOn : 0;
      // приглушение: при выборе Tripo — остальные; Rodin возвращается на «конкуренцию»
      const dim = i === 0 ? 0 : tripoOn * (i === 2 ? 1 - 0.75 * seg(cR.t, 0, 0.5) : 1);
      let pr = prevRect(i);
      let cr = cardRect(i);
      // карточка Tripo гаснет внизу и проявляется справа от большого экрана
      let cardA = 1;
      if (i === 0) {
        pr = lerpRect(pr, BIG, big);
        if (big > 0.5) cr = BIG_CARD;
        cardA = big < 0.5 ? clamp01(1 - big * 3) : clamp01((big - 0.6) * 2.5);
      }

      f.obj(`tool:${i}`, { x: pr.x + pr.w / 2, y: pr.y + pr.h / 2, abs: true, label: `Окно ${TOOLS[i].name}` }, () => {
        stage(
          ctx,
          slotP,
          i === 0 ? 0 : othersOut,
          () => {
            ctx.save();
            ctx.globalAlpha *= 1 - 0.6 * dim;
            if (fill <= 0) {
              // пустой слот
              ctx.strokeStyle = a(C.text, 0.3);
              ctx.lineWidth = 2;
              ctx.setLineDash([12, 10]);
              rrPath(ctx, pr.x, pr.y, pr.w, pr.h, 14);
              ctx.stroke();
              rrPath(ctx, cr.x, cr.y, cr.w, cr.h, 18);
              ctx.stroke();
              ctx.setLineDash([]);
              icon(ctx, 'cube', pr.x + pr.w / 2, pr.y + pr.h / 2, 90, a(C.text, 0.22 + 0.08 * Math.sin(gt * 3 + i)), gt);
            } else {
              if (active > 0) softLight(ctx, pr.x + pr.w / 2, pr.y + pr.h / 2, pr.w * 0.8, TOOLS[i].color, 0.16 * active);
              preview(ctx, i, pr, gen, gt, i === 0 ? tripoOn : 0);
              ctx.strokeStyle = a(TOOLS[i].color, 0.35 + 0.45 * active);
              ctx.lineWidth = 2 + 1.5 * active;
              rrPath(ctx, pr.x, pr.y, pr.w, pr.h, 14);
              ctx.stroke();
            }
            ctx.restore();
            if (i === 0) checkBadge(ctx, pr.x + pr.w - 8, pr.y + 8, 40, seg(cTr.p, 0.55, 0.12) * (1 - big));
          },
          { dy: 40 },
        );
      });

      // карточка: название инструмента (в p2 у Tripo — уезжает вправо)
      f.obj(`card:${i}`, { x: cr.x + cr.w / 2, y: cr.y + cr.h / 2, abs: true, text: TOOLS[i].name, label: `Карточка ${TOOLS[i].name}` }, (o) => {
        if (fill <= 0) return;
        stage(ctx, cardA, i === 0 ? 0 : othersOut, () => {
          toolCard(ctx, cr.x, cr.y, cr.w, cr.h, {
            name: o.text,
            color: TOOLS[i].color,
            icon: TOOLS[i].icon,
            p: fill,
            active,
            dim,
            t: gt,
          });
        });
      });
    }

    // дороже: стопка монет у Rodin
    const pr2 = prevRect(2);
    f.obj('coins', { x: pr2.x + pr2.w - 96, y: pr2.y + pr2.h - 120, abs: true, label: 'Монеты' }, () => {
      const p = seg(cR.p, 0.35, 0.45);
      if (p <= 0) return;
      stage(ctx, 1, othersOut, () => {
        const cx = pr2.x + pr2.w - 96;
        const bottom = pr2.y + pr2.h - 34;
        softLight(ctx, cx, bottom - 80, 180, C.accent, 0.2 * clamp01(p * 3));
        coinStack(ctx, cx, bottom, 72, p * 10, C.accent);
        const ip = seg(cR.p, 0.5, 0.15);
        if (ip > 0) {
          ctx.save();
          ctx.globalAlpha *= Math.min(1, ip * 3);
          const s = easeOutBack(ip, 2);
          ctx.translate(cx, bottom - 300);
          ctx.scale(s, s);
          softLight(ctx, 0, 0, 140, C.accent, 0.2);
          hexPath(ctx, 0, 0, 78, Math.PI / 6);
          ctx.fillStyle = C.panel;
          ctx.fill();
          ctx.strokeStyle = a(C.accent, 0.8);
          ctx.lineWidth = 3;
          ctx.stroke();
          icon(ctx, 'money', 0, 0, 92, C.accent, gt);
          ctx.restore();
        }
      });
    });

    // p2: огр крупно — поверх окна Tripo; значок подписки
    f.obj('p2-model', { x: BIG.x + BIG.w / 2, y: BIG.y + BIG.h / 2, abs: true, label: 'Модель Tripo P2.0' }, () => {
      const p = seg(cP.t, 0.5, 0.8);
      if (p <= 0) return;
      const pr = lerpRect(prevRect(0), BIG, big);
      ctx.save();
      rrPath(ctx, pr.x, pr.y, pr.w, pr.h, 14);
      ctx.clip();
      ctx.globalAlpha *= clamp01(p * 1.5);
      ctx.fillStyle = SCREEN_BG;
      ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
      const view: View = { cx: pr.x + pr.w / 2, cy: pr.y + pr.h * 0.86, size: (pr.h * 0.68) / 2.2, pitch: 0.18, yaw: 0.35 + Math.sin(cP.t * 0.7) * 0.9, dist: 9 };
      softLight(ctx, view.cx, pr.y + pr.h * 0.45, pr.w * 0.45, C.h1, 0.12);
      grassGround(ctx, view, 2.4, { tile: 2.6 });
      groundShadow(ctx, view, 0, 0, 1.0, 0.8, 0.45);
      drawModel(ctx, hero('wizard', ogrePose('idle', gt * 0.4)).parts, view, {}, { wire: a(C.h1, 0.55), wireWidth: 1.2 });
      ctx.restore();
      ctx.strokeStyle = a(C.h1, 0.8);
      ctx.lineWidth = 3.5;
      rrPath(ctx, pr.x, pr.y, pr.w, pr.h, 14);
      ctx.stroke();
    });
    const SUB = { x: BIG_CARD.x + BIG_CARD.w / 2, y: 660 };
    f.obj('sub', { x: SUB.x, y: SUB.y, abs: true, label: 'Значок подписки' }, () => {
      const p = seg(cP.p, 0.55, 0.15);
      if (p <= 0) return;
      ctx.save();
      ctx.globalAlpha *= Math.min(1, p * 3);
      softLight(ctx, SUB.x, SUB.y, 260, C.accent, 0.2);
      const s = easeOutBack(p, 1.8);
      ctx.translate(SUB.x, SUB.y);
      ctx.scale(s, s);
      hexPath(ctx, 0, 0, 130, Math.PI / 6);
      ctx.fillStyle = C.panel;
      ctx.fill();
      ctx.strokeStyle = a(C.accent, 0.8);
      ctx.lineWidth = 4;
      ctx.stroke();
      hexPath(ctx, 0, 0, 152 + Math.sin(gt * 1.6) * 5, Math.PI / 6);
      ctx.strokeStyle = a(C.accent, 0.22);
      ctx.lineWidth = 2;
      ctx.stroke();
      icon(ctx, 'star', 0, 0, 140, C.accent, gt);
      ctx.restore();
    });
    f.obj('sub-chip', { x: SUB.x, y: 900, abs: true, text: 'по подписке', label: 'Плашка подписки' }, (o) => {
      chip(ctx, o.text, SUB.x, 900, { color: C.accent, size: 58, align: 'center', p: seg(cP.p, 0.66, 0.12) });
    });
  },
};
