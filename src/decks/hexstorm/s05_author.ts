/** Сцена 5. Кто говорит: автор и его игра. */

import { clamp01, easeOutQuart, seg } from '../../engine/anim.ts';
import { panel, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { avatarHex } from '../../engine/ui.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

export const scene05: SceneDef = {
  id: 's05',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cName = f.cue('name');
    const cGame = f.cue('game');

    const np = seg(cName.t, 0, 0.8);

    f.obj('avatar', { x: 380, y: 470, abs: true, text: 'АЧ', label: 'Аватар' }, (o) => {
      ctx.save();
      ctx.globalAlpha *= clamp01(np * 2);
      softLight(ctx, 380, 470, 340, C.h1, 0.14);
      ctx.restore();

      avatarHex(ctx, 380, 470, 168, o.text, seg(cName.t, 0, 0.7), gt);
    });

    f.obj('name', { x: 630, y: 480, abs: true, text: cName.show, label: 'Имя' }, (o) => {
      reveal(
        ctx,
        o.text,
        630,
        480,
        { size: 128, color: C.h1, tracking: 0.4 },
        np,
        { stagger: 0.24, rise: 34 },
      );
    });
    f.obj('role', { x: 634, y: 546, abs: true, text: 'создатель игры', label: 'Подпись под именем' }, (o) => {
      ctx.save();
      ctx.globalAlpha *= easeOutQuart(seg(cName.t, 0.35, 0.6));
      text(ctx, o.text, 634, 546, {
        size: 36,
        color: a(C.text, 0.6),
        tracking: 2.2,
      });
      ctx.restore();
    });

    // карточка игры
    const gp = seg(cGame.t, 0, 0.8);
    {
      const e = easeOutQuart(gp);
      ctx.save();
      ctx.globalAlpha *= e;
      ctx.translate(0, (1 - e) * 40);
      const x = 150;
      const y = 700;
      const w = 1620;
      const h = 250;
      // логотип и название прижаты к правому краю плашки
      const cy = y + h / 2;
      f.obj('game', { x: x + w / 2, y: cy, abs: true, label: 'Карточка игры' }, () => {
        if (gp <= 0) return;
        panel(ctx, x, y, w, h, {
          fill: C.panel,
          stroke: a(C.accent, 0.3),
          radius: 16,
          lineWidth: 1.8,
          glow: a(C.accent, 0.1),
          glowBlur: 50,
        });

        icon(ctx, 'arcadia', x + w - 620, cy, 190, C.h1, gt);
      });

      f.obj(
        'game-name',
        { x: x + w - 500, y: cy - 6, abs: true, text: 'HEXSTORM', label: 'Название игры' },
        (o) => {
          if (gp <= 0) return;
          text(ctx, o.text, x + w - 500, cy - 6, { size: 92, color: C.h1, tracking: 1.6 });
        },
      );
      f.obj(
        'game-sub',
        { x: x + w - 494, y: cy + 58, abs: true, text: 'Tears of Arcadia', label: 'Подзаголовок игры' },
        (o) => {
          if (gp <= 0) return;
          text(ctx, o.text, x + w - 494, cy + 58, {
            size: 46,
            color: C.accent,
            tracking: 3,
          });
        },
      );

      ctx.restore();
    }
  },
};
