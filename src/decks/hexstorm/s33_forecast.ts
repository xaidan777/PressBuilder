/** Сцена 33. Прогноз на первый год и его цена в часах. */

import { clamp01, easeOutQuart, fmtNum, seg } from '../../engine/anim.ts';
import { counter } from '../../engine/charts.ts';
import { panel, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

export const scene33: SceneDef = {
  id: 's33',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cF = f.cue('forecast');
    const cS = f.cue('senior');

    const fp = seg(cF.t, 0, 1.0);
    const sp = seg(cS.t, 0, 1.0);

    f.obj('title', { x: 150, y: 280, abs: true, text: 'если продолжить в том же духе', label: 'Заголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        280,
        { size: 72, color: a(C.text, 0.8), tracking: 0.6, maxWidth: 1400 },
        seg(cF.t, 0, 0.7),
        { stagger: 0.18, rise: 24 },
      );
    });

    // левая плита — прогноз
    const fe = easeOutQuart(clamp01(fp * 1.3));
    f.obj('forecast', { x: 540, y: 620, abs: true, text: 'прогноз за первый год', label: 'Плита прогноза' }, (o) => {
      if (fp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= fe;
      ctx.translate(0, (1 - fe) * 28);
      softLight(ctx, 520, 620, 380, C.accent, 0.13);
      panel(ctx, 190, 420, 700, 400, {
        fill: C.panel,
        stroke: a(C.accent, 0.34),
        radius: 18,
        lineWidth: 2,
        accentBar: { color: C.accent, width: 5 },
      });
      text(ctx, o.text, 240, 500, {
        size: 30,
        color: a(C.text, 0.55),
        tracking: 2.2,
      });
      // иконка в углу плиты с числом и подписью не пересекается
      icon(ctx, 'chart', 800, 750, 54, a(C.accent, 0.5), gt);
      ctx.restore();
    });
    f.obj('forecast:value', { x: 240, y: 640, abs: true, label: 'Прогноз: сумма' }, () => {
      if (fp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= fe;
      ctx.translate(0, (1 - fe) * 28);
      counter(
        ctx,
        25000,
        240,
        640,
        {
          size: 132,
          color: C.accent,
          glowColor: a(C.accent, 0.35),
          glowBlur: 32,
        },
        fp,
        { prefix: 'от $', affixStyle: { color: a(C.text, 0.5) } },
      );
      ctx.restore();
    });
    f.obj(
      'forecast:sub',
      { x: 240, y: 710, abs: true, text: 'и выше — при той же динамике', label: 'Прогноз: подпись' },
      (o) => {
        if (fp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= fe;
        ctx.translate(0, (1 - fe) * 28);
        text(ctx, o.text, 240, 710, {
          size: 30,
          color: a(C.text, 0.5),
          tracking: 1.2,
          maxWidth: 600,
        });
        ctx.restore();
      },
    );

    // знак равенства и правая плита — часы
    const se = easeOutQuart(clamp01(sp * 1.4));
    f.obj('approx', { x: 960, y: 650, abs: true, text: '≈', label: 'Знак ≈' }, (o) => {
      if (sp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= se;
      text(ctx, o.text, 960, 650, { size: 110, color: a(C.text, 0.45), align: 'center' });
      ctx.restore();
    });

    f.obj('hours', { x: 1380, y: 620, abs: true, text: 'сопоставимо с', label: 'Плита часов' }, (o) => {
      if (sp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= se;
      ctx.translate((1 - se) * 34, 0);
      panel(ctx, 1030, 420, 700, 400, {
        fill: C.panel,
        stroke: a(C.h1, 0.32),
        radius: 18,
        lineWidth: 2,
        accentBar: { color: C.h1, width: 5 },
      });
      text(ctx, o.text, 1080, 500, {
        size: 30,
        color: a(C.text, 0.55),
        tracking: 2.2,
      });
      // иконка в углу плиты с числом и подписью не пересекается
      icon(ctx, 'clock', 1640, 750, 54, a(C.h1, 0.5), gt);
      ctx.restore();
    });
    f.obj('hours:value', { x: 1080, y: 630, abs: true, label: 'Часы: число' }, () => {
      if (sp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= se;
      ctx.translate((1 - se) * 34, 0);
      text(ctx, `${fmtNum(1000)} часов`, 1080, 630, { size: 118, color: C.h1 });
      ctx.restore();
    });
    f.obj(
      'hours:sub',
      { x: 1080, y: 700, abs: true, text: 'зарплаты senior-специалиста', label: 'Часы: подпись' },
      (o) => {
        if (sp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= se;
        ctx.translate((1 - se) * 34, 0);
        text(ctx, o.text, 1080, 700, {
          size: 36,
          color: a(C.text, 0.7),
          maxWidth: 600,
          tracking: 0.8,
        });
        ctx.restore();
      },
    );

    f.obj(
      'note',
      { x: 960, y: 920, abs: true, text: 'ровно столько часов и было потрачено на проект', label: 'Вывод' },
      (o) => {
        if (sp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= clamp01(sp * 1.5 - 0.5);
        text(ctx, o.text, 960, 920, {
          size: 38,
          color: a(C.text, 0.6),
          align: 'center',
          tracking: 1.2,
        });
        ctx.restore();
      },
    );
  },
};
