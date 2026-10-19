/** Сцена 3. Четыре реакции на неожиданные деньги и обещание видео. */

import { clamp01, easeOutQuart, seg } from '../../engine/anim.ts';
import { divider, softLight } from '../../engine/draw.ts';
import { reveal } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import { faceCard } from './common.ts';

const CARDS = [
  { cue: 'a1', icon: 'question', color: C.h1 },
  { cue: 'a2', icon: 'star', color: C.accent },
  { cue: 'a3', icon: 'users', color: C.pos },
  { cue: 'a4', icon: 'warning', color: C.accent },
] as const;

export const scene03: SceneDef = {
  id: 's03',

  render(f: Frame) {
    const { ctx } = f;
    const q = f.cue('q');
    const promise = f.cue('promise');

    const qp = seg(q.t, 0, 0.7);
    f.obj('title', { x: 960, y: 258, abs: true, text: q.show, label: 'Вопрос' }, (o) => {
      reveal(
        ctx,
        o.text,
        960,
        258,
        { size: 108, color: C.h1, align: 'center', tracking: 0.6 },
        qp,
        { stagger: 0.22, rise: 30 },
      );
      divider(ctx, 660, 300, 600, clamp01(qp * 1.4), a(C.h1, 0.3), 2);
    });

    const w = 375;
    const gap = 40;
    const y = 420;
    const h = 390;

    CARDS.forEach((card, i) => {
      const c = f.cue(card.cue);
      const p = seg(c.t, 0, 0.5);
      // карточка гаснет, когда очередь уходит дальше, и совсем тускнеет на обещании
      const passed = clamp01((f.t - c.end) / 1.2) * 0.55;
      const dim = Math.max(passed, seg(promise.t, 0, 0.6) * 0.75);
      const x = 150 + i * (w + gap);

      f.obj(
        `card:${i}`,
        { x: x + w / 2, y: y + h / 2, abs: true, text: c.show, label: `Карточка реакции ${i + 1}` },
        (o) => {
          if (c.on) {
            ctx.save();
            ctx.globalAlpha *= 0.5 + 0.5 * Math.sin(f.gt * 3);
            softLight(ctx, x + w / 2, y + h / 2, 300, card.color, 0.16);
            ctx.restore();
          }

          faceCard(ctx, {
            x,
            y,
            w,
            h,
            label: o.text,
            icon: card.icon,
            color: card.color,
            p,
            dim,
            t: f.gt,
            index: `0${i + 1}`,
          });
        },
      );
    });

    // финальная строка
    const pp = seg(promise.t, 0, 0.8);
    f.obj('promise', { x: 960, y: 930, abs: true, text: promise.show, label: 'Финальная строка' }, (o) => {
      if (pp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= easeOutQuart(pp);
      reveal(
        ctx,
        o.text,
        960,
        930,
        { size: 72, color: C.accent, align: 'center', tracking: 0.8 },
        pp,
        { stagger: 0.18, rise: 22 },
      );
      divider(ctx, 700, 962, 520, clamp01(pp * 1.6), a(C.accent, 0.45), 2);
      ctx.restore();
    });
  },
};
