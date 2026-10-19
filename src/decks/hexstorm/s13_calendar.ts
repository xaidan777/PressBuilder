/** Сцена 13. Steam-календарь за 3 дня до релиза и рост вишлистов. */

import { clamp01, easeOutQuart, seg } from '../../engine/anim.ts';
import { counter } from '../../engine/charts.ts';
import { panel, rrPath, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { chip } from '../../engine/ui.ts';
import { curve } from '../../engine/widgets.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

const WISH_CURVE = [0.34, 0.35, 0.37, 0.38, 0.41, 0.44, 0.62, 0.84, 1.0];
/** Сетка «15–31 июля + 1–4 августа»; релиз — 3 августа. */
const RELEASE_CELL = 19;
const dayLabel = (i: number) => (i < 17 ? String(15 + i) : String(i - 16));

function calendar(f: Frame, x: number, y: number, p: number, gt: number): void {
  const { ctx } = f;
  const e = easeOutQuart(clamp01(p));
  const cell = 106;
  const gap = 10;
  const w = cell * 7 + gap * 6 + 60;
  const h = 120 + cell * 3 + gap * 2 + 84;

  f.obj(
    'calendar',
    { x: x + w / 2, y: y + h / 2, abs: true, text: 'личный календарь', label: 'Календарь' },
    (o) => {
      if (e <= 0) return;
      ctx.save();
      ctx.globalAlpha *= e;
      ctx.translate(0, (1 - e) * 26);
      panel(ctx, x, y, w, h, { fill: C.panel, stroke: a(C.h1, 0.24), radius: 16, lineWidth: 1.6 });
      text(ctx, o.text, x + 30, y + 66, {
        size: 46,
        color: a(C.text, 0.5),
        tracking: 1.4,
      });
      icon(ctx, 'calendar', x + w - 56, y + 56, 44, a(C.h1, 0.6), gt);

      const gx = x + 30;
      const gy = y + 120;
      for (let i = 0; i < 21; i++) {
        const col = i % 7;
        const row = Math.floor(i / 7);
        const cx = gx + col * (cell + gap);
        const cy = gy + row * (cell + gap);
        const isRelease = i === RELEASE_CELL;
        const isNotice = i >= RELEASE_CELL - 3 && i < RELEASE_CELL;
        const ap = clamp01(p * 2 - i / 30);

        ctx.save();
        ctx.globalAlpha *= ap;
        if (isRelease) {
          softLight(ctx, cx + cell / 2, cy + cell / 2, 120, C.h1, 0.3);
          ctx.fillStyle = a(C.h1, 0.18);
          ctx.strokeStyle = C.h1;
        } else if (isNotice) {
          ctx.fillStyle = a(C.accent, 0.12);
          ctx.strokeStyle = a(C.accent, 0.6 + 0.25 * Math.sin(gt * 3 + i));
        } else {
          ctx.fillStyle = a(C.text, 0.04);
          ctx.strokeStyle = a(C.text, 0.1);
        }
        rrPath(ctx, cx, cy, cell, cell, 10);
        ctx.fill();
        ctx.lineWidth = isRelease ? 2.6 : 1.4;
        rrPath(ctx, cx, cy, cell, cell, 10);
        ctx.stroke();

        text(ctx, dayLabel(i), cx + 14, cy + 48, {
          size: 46,
          family: 'mono',
          color: isRelease ? C.h1 : isNotice ? C.accent : a(C.text, 0.35),
        });
        if (isRelease) icon(ctx, 'arcadia', cx + cell / 2 + 6, cy + cell * 0.72, 46, C.h1, gt);
        if (isNotice) icon(ctx, 'star', cx + cell / 2 + 6, cy + cell * 0.74, 30, a(C.accent, 0.8));
        ctx.restore();
      }
      ctx.restore();
    },
  );

  f.obj(
    'calNote',
    {
      x: x + 30,
      y: y + h - 28,
      abs: true,
      text: 'steam сам напоминает о релизе за 3 дня',
      label: 'Подпись календаря',
    },
    (o) => {
      if (e <= 0) return;
      ctx.save();
      ctx.globalAlpha *= e;
      ctx.translate(0, (1 - e) * 26);
      text(ctx, o.text, x + 30, y + h - 28, {
        size: 46,
        color: a(C.pos, 0.85),
        tracking: 0.8,
      });
      ctx.restore();
    },
  );
}

export const scene13: SceneDef = {
  id: 's13',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cC = f.cue('calendar');
    const cW = f.cue('wishlists');
    const cH = f.cue('help');

    f.obj('title', { x: 150, y: 278, abs: true, text: cC.show, label: 'Заголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        278,
        { size: 74, color: C.h1, maxWidth: 820, lineHeight: 1.06 },
        seg(cC.t, 0, 0.9),
        { stagger: 0.16, rise: 22 },
      );
    });

    calendar(f, 150, 400, seg(cC.t, 0.3, 1.0), gt);

    const wp = seg(cW.t, 0, 1.1);
    f.obj(
      'wishCount',
      { x: 1020, y: 430, abs: true, text: 'вишлисты', label: 'Счётчик вишлистов' },
      (o) => {
        if (wp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= clamp01(wp * 3);
        text(ctx, o.text, 1020, 300, { size: 30, color: a(C.text, 0.5), tracking: 3 });
        ctx.restore();

        counter(
          ctx,
          4900,
          1020,
          430,
          { size: 168, color: C.accent, glowColor: a(C.accent, 0.4), glowBlur: 36 },
          wp,
          { prefix: '≈', affixStyle: { color: a(C.text, 0.5) } },
        );
      },
    );

    f.obj('wishWas', { x: 1020, y: 490, abs: true, text: 'было 2 500', label: 'Было' }, (o) => {
      if (wp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= clamp01(wp * 2);
      text(ctx, o.text, 1020, 490, { size: 34, color: a(C.text, 0.45), tracking: 1.4 });
      ctx.restore();
    });

    f.obj(
      'wishChart',
      { x: 1390, y: 685, abs: true, text: 'последние 3 дня', label: 'График вишлистов' },
      (o) => {
        if (wp <= 0) return;
        curve(ctx, {
          x: 1020,
          y: 560,
          w: 740,
          h: 250,
          data: WISH_CURVE,
          p: wp,
          color: C.accent,
          fill: true,
        });

        ctx.save();
        ctx.globalAlpha *= clamp01(wp * 2 - 1);
        text(ctx, o.text, 1760, 852, {
          size: 24,
          color: a(C.text, 0.4),
          align: 'right',
          tracking: 1.6,
        });
        ctx.restore();
      },
    );

    f.obj(
      'wishChip',
      { x: 1020, y: 910, abs: true, text: 'почти ×2 за 3 дня', label: 'Чип «почти ×2»' },
      (o) => {
        if (wp <= 0) return;
        chip(ctx, o.text, 1020, 910, {
          color: C.pos,
          size: 28,
          icon: 'chart',
          p: clamp01(wp * 1.6 - 0.6),
        });
      },
    );

    const hp = seg(cH.t, 0, 0.7);
    f.obj('help', { x: 1020, y: 1010, abs: true, text: cH.show, label: 'Вывод' }, (o) => {
      if (hp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= easeOutQuart(hp);
      reveal(
        ctx,
        o.text,
        1020,
        1010,
        { size: 46, color: C.h1, tracking: 1 },
        hp,
        { stagger: 0.18, rise: 16 },
      );
      ctx.restore();
    });
  },
};
