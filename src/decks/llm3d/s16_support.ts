/** Сцена 16. Как поддержать: игра в Steam и скорое обновление. */

import { clamp01, easeOutQuart, seg } from '../../engine/anim.ts';
import { panel, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { chip } from '../../engine/ui.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import { appear } from './common.ts';

const CARD = { x: 150, y: 450, w: 1620, h: 310 };

export const scene16: SceneDef = {
  id: 's16',

  energy: (_t, cue) => 0.5 * seg(cue('game').p, 0, 0.5),

  render(f: Frame) {
    const { ctx, gt } = f;
    const cS = f.cue('support');
    const cG = f.cue('game');
    const cU = f.cue('update');

    // «если захотите поддержать меня»
    const hp = seg(cS.p, 0.12, 0.14);
    f.obj('title', { x: 300, y: 252, abs: true, text: 'поддержать меня', label: 'Заголовок' }, (o) => {
      if (hp > 0) {
        ctx.save();
        ctx.globalAlpha *= clamp01(hp * 2);
        icon(ctx, 'heart', 210, 210, 116, C.accent, gt);
        ctx.restore();
      }
      reveal(
        ctx,
        o.text,
        300,
        252,
        { size: 128, color: C.accent, tracking: 0.6 },
        seg(cS.p, 0.12, 0.2),
        { stagger: 0.24, rise: 28 },
      );
    });
    f.obj('steam', { x: 150, y: 368, abs: true, text: cS.show, label: 'Плашка Steam' }, (o) => {
      chip(ctx, o.text, 150, 368, {
        color: C.h1,
        size: 62,
        icon: 'steam',
        p: seg(cS.p, 0.6, 0.14),
      });
    });

    // карточка игры: панель с логотипом и две надписи — с одним и тем же появлением
    const cy = CARD.y + CARD.h / 2;
    const cardIn = (fn: () => void) =>
      appear(ctx, seg(cG.t, -0.1, 0.6), fn, { dy: 50, from: 0.94, cx: CARD.x + CARD.w / 2, cy: CARD.y + CARD.h / 2 });
    f.obj('card', { x: CARD.x + CARD.w / 2, y: cy, abs: true, label: 'Карточка игры' }, () => {
      cardIn(() => {
        softLight(ctx, CARD.x + CARD.w / 2, CARD.y + CARD.h / 2, 760, C.h1, 0.1);
        panel(ctx, CARD.x, CARD.y, CARD.w, CARD.h, {
          fill: C.panel,
          stroke: a(C.accent, 0.34),
          radius: 18,
          lineWidth: 2,
          glow: a(C.accent, 0.12),
          glowBlur: 56,
        });
        ctx.save();
        ctx.shadowColor = a(C.h1, 0.5);
        ctx.shadowBlur = 30;
        icon(ctx, 'arcadia', 520, cy, 250, C.h1, gt);
        ctx.restore();
      });
    });
    f.obj('game-title', { x: 670, y: cy + 4, abs: true, text: 'HEXSTORM', label: 'Название игры' }, (o) => {
      cardIn(() => {
        text(ctx, o.text, 670, cy + 4, { size: 150, color: C.h1, tracking: 2 });
      });
    });
    f.obj('game-sub', { x: 678, y: cy + 88, abs: true, text: 'Tears of Arcadia', label: 'Подзаголовок игры' }, (o) => {
      cardIn(() => {
        text(ctx, o.text, 678, cy + 88, { size: 68, color: C.accent, tracking: 3.4 });
      });
    });

    // обновление
    const up = seg(cU.p, 0.04, 0.16);
    f.obj('update', { x: 290, y: 890, abs: true, text: cU.show, label: 'Обновление' }, (o) => {
      if (up > 0) {
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(up);
        icon(ctx, 'rocket', 204, 858, 96, C.pos, gt);
        ctx.restore();
      }
      reveal(
        ctx,
        o.text,
        290,
        890,
        { size: 96, color: C.pos, tracking: 0.6 },
        seg(cU.p, 0.04, 0.24),
        { stagger: 0.16, rise: 24 },
      );
    });
    f.obj('chip:0', { x: 150, y: 990, abs: true, text: 'новые пушки', label: 'Плашка: пушки' }, (o) => {
      chip(ctx, o.text, 150, 990, { color: C.accent, size: 60, icon: 'crosshair', p: seg(cU.p, 0.56, 0.1) });
    });
    f.obj('chip:1', { x: 690, y: 990, abs: true, text: 'улучшенная графика', label: 'Плашка: графика' }, (o) => {
      chip(ctx, o.text, 690, 990, { color: C.h1, size: 60, icon: 'eye', p: seg(cU.p, 0.76, 0.1) });
    });
  },
};
