/** Сцена 6. Ноль языков программирования — весь код написан ИИ. */

import { clamp01, easeOutExpo, easeOutQuart, pulse, seg } from '../../engine/anim.ts';
import { panel, rrPath, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import { codeRain } from './common.ts';

const RAIN = { x: 1010, y: 150, w: 760, h: 790 };

export const scene06: SceneDef = {
  id: 's06',

  energy(t, cue) {
    return pulse(t, cue('ai').start, 1.2) * 0.7;
  },

  render(f: Frame) {
    const { ctx, gt } = f;
    const cDebut = f.cue('debut');
    const cAi = f.cue('ai');

    const dp = seg(cDebut.t, 0, 0.9);
    const ap = seg(cAi.t, 0, 0.8);

    // панель с «дождём» кода
    const rp = seg(cDebut.t, 0.15, 0.9);
    const rainX = RAIN.x + RAIN.w / 2;
    const rainY = RAIN.y + RAIN.h / 2;
    f.obj('rain', { x: rainX, y: rainY, abs: true, label: 'Панель с кодом' }, () => {
      if (rp <= 0) return;
      const e = easeOutQuart(rp);
      ctx.save();
      ctx.globalAlpha *= e;
      panel(ctx, RAIN.x, RAIN.y, RAIN.w, RAIN.h, {
        fill: a(C.panel, 0.85),
        stroke: a(C.h1, 0.24),
        radius: 14,
        lineWidth: 1.6,
      });
      codeRain(ctx, RAIN.x + 8, RAIN.y + 8, RAIN.w - 16, RAIN.h - 16, gt, 0.55 + ap * 0.45);

      // сканирующая полоса на фразе «весь код написан ИИ»
      if (ap > 0) {
        const sy = RAIN.y + ((gt * 220) % RAIN.h);
        ctx.save();
        rrPath(ctx, RAIN.x + 8, RAIN.y + 8, RAIN.w - 16, RAIN.h - 16, 12);
        ctx.clip();
        const g = ctx.createLinearGradient(0, sy - 110, 0, sy + 30);
        g.addColorStop(0, a(C.h1, 0));
        g.addColorStop(0.78, a(C.h1, 0.2 * ap));
        g.addColorStop(1, a(C.h1, 0));
        ctx.fillStyle = g;
        ctx.fillRect(RAIN.x, sy - 110, RAIN.w, 140);
        ctx.restore();
      }

      ctx.restore();
    });

    f.obj(
      'title',
      { x: 150, y: 330, abs: true, text: 'без знаний языков программирования', label: 'Заголовок' },
      (o) => {
        if (dp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= easeOutExpo(clamp01(dp * 1.6));
        softLight(ctx, 470, 400, 460, C.accent, 0.12);
        ctx.restore();

        reveal(
          ctx,
          o.text,
          150,
          330,
          {
            size: 104,
            color: C.accent,
            lineHeight: 1.04,
            maxWidth: 800,
            tracking: 0.5,
            glowColor: a(C.accent, 0.28),
            glowBlur: 30,
          },
          dp,
          { stagger: 0.16, rise: 28 },
        );
      },
    );

    // весь код написан ИИ
    f.obj('ai', { x: 540, y: 800, abs: true, text: cAi.show, label: 'Плашка «код написан ИИ»' }, (o) => {
      if (ap <= 0) return;
      const e = easeOutQuart(ap);
      ctx.save();
      ctx.globalAlpha *= e;
      ctx.translate(0, (1 - e) * 30);
      panel(ctx, 150, 690, 780, 220, {
        fill: C.panel,
        stroke: a(C.h1, 0.4),
        radius: 16,
        lineWidth: 2,
        glow: a(C.h1, 0.16),
        glowBlur: 60,
        accentBar: { color: C.h1, width: 5 },
      });
      icon(ctx, 'robot', 250, 800, 92, C.h1, gt);
      reveal(
        ctx,
        o.text,
        346,
        786,
        { size: 66, color: C.h1, maxWidth: 540, lineHeight: 1.06, tracking: 0.6 },
        clamp01(ap * 1.3),
        { stagger: 0.18, rise: 18 },
      );
      ctx.restore();
    });
  },
};
