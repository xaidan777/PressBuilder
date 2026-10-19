/** Сцена 8. 1000 часов: 125 рабочих дней и на что они ушли. */

import { clamp01, easeOutQuart, seg } from '../../engine/anim.ts';
import { counter, donut } from '../../engine/charts.ts';
import { rrPath, softLight } from '../../engine/draw.ts';
import { text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

/** 1000 часов при восьмичасовом дне. */
const WORK_DAYS = 125;
const COLS = 25;

/** На что ушли часы. Сумма — 1000. */
const SPLIT = [
  { value: 400, label: 'веб-версия', color: C.h1 },
  { value: 300, label: 'расширенный билд', color: C.pos },
  { value: 100, label: 'создание инструментов', color: a(C.text, 0.55) },
  { value: 200, label: 'тесты, обновления, билд для Steam', color: C.accent },
];

export const scene08: SceneDef = {
  id: 's08',

  render(f: Frame) {
    const { ctx } = f;
    const cHours = f.cue('hours');
    const cLog = f.cue('log');
    const cSplit = f.cue('split');

    const hp = seg(cHours.t, 0, 0.9);
    const lp = seg(cLog.t, 0, 1.1);
    const sp = seg(cSplit.t, 0, 1.0);

    // 1000 часов (число считает счётчик, текст объекта — подпись после числа)
    f.obj('hours', { x: 150, y: 400, abs: true, text: 'часов', label: 'Счётчик часов' }, (o) => {
      if (hp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= clamp01(hp * 2);
      softLight(ctx, 430, 320, 340, C.accent, 0.13);
      ctx.restore();
      counter(
        ctx,
        1000,
        150,
        400,
        {
          size: 240,
          color: C.accent,
          tracking: -2,
          glowColor: a(C.accent, 0.4),
          glowBlur: 40,
        },
        hp,
        { suffix: o.text, affixStyle: { color: a(C.text, 0.65) } },
      );
    });

    // 125 рабочих дней сеткой
    {
      const cell = 26;
      const gap = 5;
      const gx = 150;
      const gy = 590;

      f.obj('days', { x: 150, y: 550, abs: true, text: 'рабочих дней', label: 'Счётчик дней' }, (o) => {
        if (lp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= clamp01(lp * 3);
        counter(
          ctx,
          WORK_DAYS,
          150,
          550,
          { size: 96, color: C.h1 },
          clamp01(lp * 1.4),
          { suffix: o.text, affixStyle: { color: a(C.text, 0.6) } },
        );
        ctx.restore();
      });

      const gridW = COLS * (cell + gap) - gap;
      const gridH = Math.ceil(WORK_DAYS / COLS) * (cell + gap) - gap;
      f.obj('grid', { x: gx + gridW / 2, y: gy + gridH / 2, abs: true, label: 'Сетка дней' }, () => {
        if (lp <= 0) return;
        for (let i = 0; i < WORK_DAYS; i++) {
          const ip = clamp01(lp * 2.2 - (i / WORK_DAYS) * 1.1);
          if (ip <= 0) continue;
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          const e = easeOutQuart(ip);
          ctx.save();
          ctx.globalAlpha *= e;
          ctx.fillStyle = a(i % 5 === 4 ? C.accent : C.h1, 0.55);
          const s = cell * (0.7 + e * 0.3);
          rrPath(ctx, gx + col * (cell + gap) + (cell - s) / 2, gy + row * (cell + gap) + (cell - s) / 2, s, s, 4);
          ctx.fill();
          ctx.restore();
        }
      });
    }

    // на что ушли часы
    {
      const cx = 1400;
      const cy = 400;
      f.obj('donut', { x: cx, y: cy, abs: true, label: 'Диаграмма часов' }, () => {
        if (sp <= 0) return;
        donut(
          ctx,
          cx,
          cy,
          180,
          SPLIT.map((s) => ({ value: s.value, color: s.color })),
          sp,
          44,
        );
      });

      const inner = clamp01((sp - 0.3) / 0.4);
      ctx.save();
      ctx.globalAlpha *= inner;
      f.obj('total', { x: cx, y: cy + 12, abs: true, text: '1000', label: 'Число в диаграмме' }, (o) => {
        if (sp <= 0) return;
        text(ctx, o.text, cx, cy + 12, { size: 88, color: C.text, align: 'center' });
      });
      f.obj(
        'total-label',
        { x: cx, y: cy + 54, abs: true, text: 'часов всего', label: 'Подпись в диаграмме' },
        (o) => {
          if (sp <= 0) return;
          text(ctx, o.text, cx, cy + 54, {
            size: 26,
            color: a(C.text, 0.5),
            align: 'center',
            tracking: 2,
          });
        },
      );
      ctx.restore();

      SPLIT.forEach((it, i) => {
        const p = clamp01(sp * 1.6 - 0.45 - i * 0.14);
        const ly = 680 + i * 86;
        f.obj(`row:${i}`, { x: 1030, y: ly, abs: true, text: it.label, label: `Строка легенды ${i + 1}` }, (o) => {
          if (sp <= 0 || p <= 0) return;
          const e = easeOutQuart(p);
          ctx.save();
          ctx.globalAlpha *= e;
          ctx.translate((1 - e) * 30, 0);
          ctx.fillStyle = it.color;
          rrPath(ctx, 1030, ly - 26, 8, 44, 4);
          ctx.fill();
          text(ctx, `${it.value} ч`, 1066, ly + 10, { size: 50, color: it.color });
          text(ctx, o.text, 1216, ly + 8, {
            size: 32,
            color: a(C.text, 0.75),
            maxWidth: 560,
            tracking: 0.6,
          });
          ctx.restore();
        });
      });
    }
  },
};
