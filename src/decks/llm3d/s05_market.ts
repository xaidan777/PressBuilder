/**
 * Сцена 5. Большие движки созданы для людей: человеку — ровные зелёные связи,
 * ИИ — рваные пунктиры, сгорающие деньги и MCP-переходник посередине.
 */

import { clamp01, easeOutQuart, hash11, noise1, seg } from '../../engine/anim.ts';
import { panel } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { chip } from '../../engine/ui.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import { drawSolid, MESH } from '../../engine/wire3d.ts';
import { botHex, flow, type P2 } from './common.ts';

const ENGINES = [
  { name: 'Unreal', mesh: MESH.icosa, at: 0.58 },
  { name: 'Unity', mesh: MESH.cube, at: 0.73 },
  { name: 'Godot', mesh: MESH.octa, at: 0.87 },
];
const CARD = { x0: 150, y: 264, w: 460, h: 210, gap: 120 };
const cardX = (i: number) => CARD.x0 + i * (CARD.w + CARD.gap);
const cardPort = (i: number): P2 => [cardX(i) + CARD.w / 2, CARD.y + CARD.h + 8];

const HUMAN: P2 = [430, 800];
const BOT: P2 = [1490, 800];
const R = 104;
/** Узел, через который ИИ ходит в движки: сюда встанет MCP. */
const NODE: P2 = [1490, 610];

export const scene05: SceneDef = {
  id: 's05',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cM = f.cue('market');
    const cH = f.cue('human');
    const cA = f.cue('ai');

    f.obj('title', { x: 150, y: 200, abs: true, text: cM.show, label: 'Заголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        200,
        { size: 100, color: C.h1, tracking: 0.6 },
        seg(cM.t, 0, 0.6),
        { stagger: 0.2, rise: 28 },
      );
    });

    // связи рисуем под карточками и гексами
    const humanDim = 1 - 0.7 * seg(cA.p, 0.2, 0.15);
    // зелёные и рыжие линии пересекаются, поэтому все связи — один объект
    f.obj('links', { x: 960, y: 590, abs: true, label: 'Связи' }, () => {
      ENGINES.forEach((_, i) => {
        const to = cardPort(i);
        ctx.save();
        ctx.globalAlpha *= humanDim;
        flow(ctx, [HUMAN[0], HUMAN[1] - R], [to[0], (HUMAN[1] - R + to[1]) / 2 + 70], to, {
          t: gt + i * 0.3,
          color: C.pos,
          p: easeOutQuart(seg(cH.p, 0.12 + i * 0.1, 0.3)),
          n: 3,
          speed: 0.7,
          width: 4,
          lineAlpha: 0.55,
        });
        ctx.restore();

        // у ИИ линия дрожит, а точки по ней еле ползут
        const wob: P2 = [noise1(gt * 5, i) * 26, noise1(gt * 4, i + 9) * 18];
        flow(ctx, NODE, [to[0] + wob[0], (NODE[1] + to[1]) / 2 + 70 + wob[1]], to, {
          t: gt + i * 0.37,
          color: C.accent,
          p: easeOutQuart(seg(cA.p, 0.3 + i * 0.05, 0.2)),
          n: 2,
          speed: 0.16,
          width: 3,
          dash: [14, 14],
          lineAlpha: 0.6,
        });
      });
      flow(ctx, [BOT[0], BOT[1] - R], [BOT[0], (BOT[1] - R + NODE[1]) / 2], NODE, {
        t: gt,
        color: C.accent,
        p: seg(cA.p, 0.26, 0.08),
        n: 1,
        speed: 0.3,
        width: 3,
        dash: [14, 14],
        lineAlpha: 0.6,
      });
    });

    // карточки движков: сначала безымянные, имя проявляется, когда его называют
    ENGINES.forEach((en, i) => {
      const x = cardX(i);
      f.obj(
        `engine:${i}`,
        { x: x + CARD.w / 2, y: CARD.y + CARD.h / 2, abs: true, text: en.name, label: `Движок ${i + 1}` },
        (o) => {
          const p = seg(cM.p, 0.1 + i * 0.09, 0.2);
          if (p <= 0) return;
          const e = easeOutQuart(p);
          ctx.save();
          ctx.globalAlpha *= Math.min(1, p * 2.4);
          ctx.translate(0, (1 - e) * 36);
          panel(ctx, x, CARD.y, CARD.w, CARD.h, {
            fill: C.panel,
            stroke: a(C.text, 0.26),
            lineWidth: 1.8,
            radius: 16,
          });
          drawSolid(
            ctx,
            en.mesh,
            { cx: x + 100, cy: CARD.y + CARD.h / 2, size: 118, pitch: 0.45, yaw: gt * 0.6 + i * 2, dist: 4.5 },
            {},
            { color: '#9aa0a6' },
          );
          const np = seg(cM.p, en.at - 0.06, 0.1);
          if (np > 0) {
            ctx.globalAlpha *= np;
            text(ctx, o.text, x + 196, CARD.y + CARD.h / 2 + 30 + (1 - easeOutQuart(np)) * 14, {
              size: 92,
              color: C.text,
              tracking: 1,
            });
          }
          ctx.restore();
        },
      );
    });

    f.obj('human', { x: HUMAN[0], y: HUMAN[1], abs: true, text: cH.show, label: 'Человек' }, (o) => {
      botHex(ctx, HUMAN[0], HUMAN[1], {
        r: R,
        color: C.pos,
        icon: 'person',
        p: seg(cH.t, 0, 0.5),
        t: gt,
        label: o.text,
        glow: seg(cH.p, 0.3, 0.3),
        dim: 1 - humanDim,
      });
    });

    f.obj('bot', { x: BOT[0], y: BOT[1], abs: true, text: 'трудно и дорого', label: 'ИИ' }, (o) => {
      botHex(ctx, BOT[0], BOT[1], {
        r: R,
        color: C.accent,
        p: seg(cA.p, 0.16, 0.12),
        t: gt,
        label: o.text,
        labelColor: a(C.accent, seg(cA.p, 0.45, 0.1)),
      });
    });

    // деньги сгорают на каждом обращении
    const burn = seg(cA.p, 0.52, 0.1);
    f.obj('money', { x: NODE[0], y: 575, abs: true, label: 'Сгорающие деньги' }, () => {
      if (burn <= 0) return;
      for (let i = 0; i < 8; i++) {
        const k = (gt * 0.42 + i / 8) % 1;
        ctx.save();
        ctx.globalAlpha *= burn * Math.sin(k * Math.PI) * 0.85;
        icon(
          ctx,
          'money',
          NODE[0] - 300 + hash11(i * 3.1) * 600 + noise1(gt, i) * 10,
          NODE[1] + 60 - k * 190,
          38 + hash11(i * 5.3) * 20,
          C.accent,
          gt,
        );
        ctx.restore();
      }
    });
    f.obj('warning', { x: BOT[0] + R * 1.25, y: BOT[1] - R * 0.7, abs: true, label: 'Предупреждение' }, () => {
      if (burn <= 0) return;
      ctx.save();
      ctx.globalAlpha *= burn * (0.55 + 0.45 * Math.sin(gt * 9));
      icon(ctx, 'warning', BOT[0] + R * 1.25, BOT[1] - R * 0.7, 58, C.accent, gt);
      ctx.restore();
    });

    f.obj('mcp', { x: NODE[0], y: NODE[1], abs: true, text: 'даже используя MCP', label: 'Плашка MCP' }, (o) => {
      chip(ctx, o.text, NODE[0], NODE[1], {
        color: C.h1,
        bg: C.panel,
        size: 46,
        icon: 'plug',
        align: 'center',
        p: clamp01(seg(cA.p, 0.7, 0.1)),
      });
    });
  },
};
