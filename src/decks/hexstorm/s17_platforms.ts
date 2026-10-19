/** Сцена 17. ИИ-код выдержал: три операционные системы, пара рефандов по стабильности. */

import { clamp01, easeOutQuart, seg } from '../../engine/anim.ts';
import { hexPath, panel, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { chip } from '../../engine/ui.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

const OS = [
  { icon: 'windows', name: 'Windows', color: C.h1 },
  { icon: 'steam', name: 'SteamOS', color: C.pos },
  { icon: 'apple', name: 'macOS', color: C.accent },
];

export const scene17: SceneDef = {
  id: 's17',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cOk = f.cue('ok');
    const cFew = f.cue('few');
    const cOs = f.cue('os');

    const okp = seg(cOk.t, 0, 0.9);

    f.obj('title', { x: 150, y: 292, abs: true, text: cOk.show, label: 'Заголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        292,
        { size: 100, color: C.pos, tracking: 0.6, glowColor: a(C.pos, 0.28), glowBlur: 30 },
        okp,
        { stagger: 0.22, rise: 28 },
      );
    });

    f.obj('few', { x: 150, y: 400, abs: true, text: cFew.show, label: 'Чип про рефанды' }, (o) => {
      chip(ctx, o.text, 150, 400, {
        color: C.h1,
        size: 30,
        icon: 'refund',
        p: seg(cFew.t, 0, 0.7),
      });
    });

    const op = seg(cOs.t, -0.15, 1.0);
    const w = 460;
    const gap = 80;
    const x0 = 960 - (w * 3 + gap * 2) / 2;

    OS.forEach((os, i) => {
      const x = x0 + i * (w + gap);
      const y = 520;
      const h = 330;

      f.obj(
        `os:${i}`,
        { x: x + w / 2, y: y + h / 2, abs: true, text: os.name, label: `Карточка ${os.name}` },
        (o) => {
          const p = clamp01(op * 1.7 - i * 0.22);
          if (p <= 0) return;
          const e = easeOutQuart(p);

          ctx.save();
          ctx.globalAlpha *= e;
          ctx.translate(x + w / 2, y + h / 2);
          ctx.scale(0.88 + e * 0.12, 0.88 + e * 0.12);
          ctx.translate(-w / 2, -h / 2);

          softLight(ctx, w / 2, h * 0.4, 240, os.color, 0.1);
          panel(ctx, 0, 0, w, h, {
            fill: C.panel,
            stroke: a(os.color, 0.32),
            radius: 16,
            lineWidth: 1.8,
          });
          hexPath(ctx, w / 2, 128, 74, Math.PI / 6);
          ctx.strokeStyle = a(os.color, 0.4);
          ctx.lineWidth = 1.8;
          ctx.stroke();
          icon(ctx, os.icon, w / 2, 128, 84, os.color, gt);
          text(ctx, o.text, w / 2, 244, {
            size: 48,
            color: C.text,
            align: 'center',
            tracking: 1.2,
            caps: 'normal',
          });
          ctx.restore();
        },
      );
    });
  },
};
