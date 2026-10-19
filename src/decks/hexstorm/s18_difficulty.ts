/** Сцена 18. Проблема была в сложности: автобаланс хорош, база настроена под себя. */

import { clamp01, easeOutQuart, seg } from '../../engine/anim.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { chip } from '../../engine/ui.ts';
import { curve } from '../../engine/widgets.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

/**
 * Обе кривые совпадают на старте: автобаланс строит ровное возрастание.
 * Расхождение начинается в лейте — там моя базовая настройка уводит
 * сложность заметно выше, чем нужно обычному игроку.
 */
/** Обе линии — прямые от общего нуля: одна пологая, вторая круто вверх. */
const GOOD = [0.14, 0.1975, 0.255, 0.3125, 0.37, 0.4275, 0.485, 0.5425, 0.6];
const MINE = [0.14, 0.246, 0.353, 0.459, 0.565, 0.671, 0.778, 0.884, 0.99];

const CHART = { x: 260, y: 430, w: 1020, h: 400 };

const px = (i: number) => CHART.x + (CHART.w * i) / (GOOD.length - 1);
const py = (v: number) => CHART.y + CHART.h * (1 - v);

export const scene18: SceneDef = {
  id: 's18',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cH = f.cue('hard');
    const cB = f.cue('balance');
    const cM = f.cue('me');
    const cS = f.cue('sc2');

    f.obj('title', { x: 150, y: 282, abs: true, text: cH.show, label: 'Заголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        282,
        { size: 88, color: C.accent, tracking: 0.6 },
        seg(cH.t, 0, 0.8),
        { stagger: 0.2, rise: 26 },
      );
    });

    const bp = seg(cB.t, 0, 1.0);
    const mp = seg(cM.t, 0, 0.9);
    const sp = seg(cS.t, 0, 1.0);

    // график целиком: оси, обе кривые и клин между ними.
    // Подписи кривых стоят правее графика и с ним не пересекаются — они отдельными объектами ниже.
    f.obj(
      'chart',
      { x: CHART.x + CHART.w / 2, y: CHART.y + CHART.h / 2, abs: true, label: 'График сложности' },
      () => {
        // оси
        if (bp > 0) {
          ctx.save();
          ctx.globalAlpha *= clamp01(bp * 3);
          ctx.strokeStyle = a(C.text, 0.14);
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(CHART.x, CHART.y);
          ctx.lineTo(CHART.x, CHART.y + CHART.h);
          ctx.lineTo(CHART.x + CHART.w, CHART.y + CHART.h);
          ctx.stroke();
          text(ctx, 'сложность', CHART.x - 20, CHART.y - 12, {
            size: 24,
            color: a(C.text, 0.4),
            tracking: 2,
          });
          text(ctx, 'прогресс игрока', CHART.x + CHART.w, CHART.y + CHART.h + 40, {
            size: 24,
            color: a(C.text, 0.4),
            align: 'right',
            tracking: 2,
          });
          ctx.restore();
        }

        // ровная кривая автобаланса
        curve(ctx, { ...CHART, data: GOOD, p: bp, color: C.pos, fill: true, smooth: false });

        // моя базовая: до середины совпадает, дальше уходит вверх
        if (mp > 0) {
          // заливка клина между линиями — накопленный перебор сложности
          const gapP = clamp01(mp * 1.5 - 0.35);
          if (gapP > 0) {
            ctx.save();
            ctx.globalAlpha *= gapP * 0.9;
            ctx.beginPath();
            MINE.forEach((v, i) => (i ? ctx.lineTo(px(i), py(v)) : ctx.moveTo(px(i), py(v))));
            for (let i = GOOD.length - 1; i >= 0; i--) ctx.lineTo(px(i), py(GOOD[i]));
            ctx.closePath();
            ctx.fillStyle = a(C.accent, 0.16);
            ctx.fill();
            ctx.restore();
          }

          curve(ctx, {
            ...CHART,
            data: MINE,
            p: mp,
            color: C.accent,
            dashed: true,
            lineWidth: 5,
            smooth: false,
          });
        }
      },
    );

    // подписи у конца кривых, справа от графика — линия не перечёркивает текст
    const lx = CHART.x + CHART.w + 40;
    const goodE = clamp01((bp - 0.5) / 0.4);
    f.obj(
      'good',
      { x: lx, y: py(GOOD[8]) + 6, abs: true, text: 'автобаланс', label: 'Подпись «автобаланс»' },
      (o) => {
        if (bp <= 0.5) return;
        ctx.save();
        ctx.globalAlpha *= goodE;
        text(ctx, o.text, lx, py(GOOD[8]) + 6, {
          size: 56,
          color: C.pos,
          tracking: 0.8,
        });
        ctx.restore();
      },
    );
    f.obj(
      'goodNote',
      {
        x: lx,
        y: py(GOOD[8]) + 62,
        abs: true,
        text: 'ровное возрастание',
        label: 'Пояснение к автобалансу',
      },
      (o) => {
        if (bp <= 0.5) return;
        ctx.save();
        ctx.globalAlpha *= goodE;
        text(ctx, o.text, lx, py(GOOD[8]) + 62, {
          size: 46,
          color: a(C.text, 0.5),
          tracking: 0.8,
          maxWidth: 480,
        });
        ctx.restore();
      },
    );

    f.obj(
      'mine',
      {
        x: lx,
        y: py(MINE[8]) + 6,
        abs: true,
        text: 'моя настройка',
        label: 'Подпись «моя настройка»',
      },
      (o) => {
        if (mp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(mp);
        text(ctx, o.text, lx, py(MINE[8]) + 6, {
          size: 56,
          color: C.accent,
          tracking: 0.8,
        });
        ctx.restore();
      },
    );
    f.obj(
      'mineNote',
      {
        x: lx,
        y: py(MINE[8]) + 62,
        abs: true,
        text: 'уходит в хардкор',
        label: 'Пояснение к моей настройке',
      },
      (o) => {
        if (mp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(mp);
        text(ctx, o.text, lx, py(MINE[8]) + 62, {
          size: 46,
          color: a(C.text, 0.5),
          tracking: 0.8,
          maxWidth: 480,
        });
        ctx.restore();
      },
    );

    // «косяк во мне»
    f.obj('me', { x: 150, y: 990, abs: true, text: cM.show, label: 'Вывод' }, (o) => {
      if (mp <= 0.4) return;
      ctx.save();
      ctx.globalAlpha *= clamp01((mp - 0.4) / 0.5);
      text(ctx, o.text, 150, 990, { size: 62, color: C.text, tracking: 0.8 });
      ctx.restore();
    });

    f.obj('sc2', { x: 862, y: 972, abs: true, text: cS.show, label: 'Чип с часами' }, (o) => {
      if (sp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= easeOutQuart(sp);
      icon(ctx, 'clock', 810, 972, 52, C.h1, gt);
      chip(ctx, o.text, 862, 972, { color: C.h1, p: sp });
      ctx.restore();
    });
    f.obj(
      'sc2Note',
      {
        x: 1400,
        y: 990,
        abs: true,
        text: 'и не на самом низком уровне',
        label: 'Пояснение к чипу',
      },
      (o) => {
        if (sp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(sp);
        text(ctx, o.text, 1400, 990, {
          size: 46,
          color: a(C.text, 0.5),
          tracking: 0.8,
        });
        ctx.restore();
      },
    );
  },
};
