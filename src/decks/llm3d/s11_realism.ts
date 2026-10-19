/**
 * Сцена 11. Движок задумывался под казуальную графику и тун-шейдинг —
 * а что, если попросить реализм? Шторка «до/после» проходит по вьюпорту.
 */

import { clamp01, easeInOutCubic, easeOutQuart, seg } from '../../engine/anim.ts';
import { corners, rrPath } from '../../engine/draw.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import { appear, type Rect } from './common.ts';
import { realScene, toonScene } from './shading.ts';

const VIEW: Rect = { x: 1010, y: 170, w: 760, h: 700 };

/** Слова звучат в конце первой реплики — строки появляются в такт. */
const ROWS = [
  { label: 'лёгких прототипов', at: 0.4 },
  { label: 'казуальной графики', at: 0.6 },
  { label: 'тун-шейдинга', at: 0.8 },
];

export const scene11: SceneDef = {
  id: 's11',

  energy: (_t, cue) => 0.6 * seg(cue('demo').p, 0.15, 0.4),

  render(f: Frame) {
    const { ctx, gt } = f;
    const cC = f.cue('casual');
    const cQ = f.cue('check');
    const cD = f.cue('demo');

    // ---- левая колонка
    const dimRows = 1 - 0.6 * seg(cQ.t, 0, 0.4);
    ctx.save();
    ctx.globalAlpha *= dimRows;
    f.obj('intro', { x: 150, y: 200, abs: true, text: cC.show, label: 'Вводная строка' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        200,
        { size: 62, color: a(C.text, 0.65), tracking: 1.2 },
        seg(cC.t, 0, 0.6),
        { stagger: 0.16, rise: 18 },
      );
    });
    ROWS.forEach((r, i) => {
      const y = 318 + i * 112;
      f.obj(`row:${i}`, { x: 190, y, abs: true, text: r.label, label: `Пункт ${i + 1}` }, (o) => {
        const p = easeOutQuart(seg(cC.p, r.at - 0.04, 0.1));
        if (p <= 0) return;
        ctx.save();
        ctx.globalAlpha *= p;
        ctx.translate((1 - p) * -40, 0);
        ctx.fillStyle = C.h1;
        rrPath(ctx, 150, y - 46, 10, 58, 5);
        ctx.fill();
        text(ctx, o.text, 190, y, { size: 88, color: C.text, tracking: 0.6 });
        ctx.restore();
      });
    });
    ctx.restore();

    f.obj('question', { x: 150, y: 730, abs: true, text: cQ.show, label: 'Вопрос' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        730,
        { size: 104, color: C.accent, tracking: 0.6 },
        seg(cQ.t, 0.05, 0.6),
        { stagger: 0.18, rise: 26 },
      );
    });
    f.obj('demo', { x: 150, y: 870, abs: true, text: cD.show, label: 'Задача' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        870,
        {
          size: 104,
          color: C.h1,
          tracking: 0.6,
          maxWidth: 800,
          lineHeight: 1.02,
          glowColor: a(C.h1, 0.35),
          glowBlur: 34,
        },
        seg(cD.p, 0.3, 0.3),
        { stagger: 0.3, rise: 26 },
      );
    });

    // ---- вьюпорт: тун-картинка, по которой проходит шторка реализма
    const wipe = easeInOutCubic(seg(cD.p, 0.12, 0.5));
    f.obj('viewport', { x: VIEW.x + VIEW.w / 2, y: VIEW.y + VIEW.h / 2, abs: true, label: 'Вьюпорт' }, () => {
      appear(
        ctx,
        seg(cC.t, 0.1, 0.6),
        () => {
          ctx.save();
          rrPath(ctx, VIEW.x, VIEW.y, VIEW.w, VIEW.h, 14);
          ctx.clip();
          toonScene(ctx, VIEW, gt);
          if (wipe > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(VIEW.x, VIEW.y, VIEW.w * wipe, VIEW.h);
            ctx.clip();
            realScene(ctx, VIEW, gt);
            ctx.restore();
            if (wipe < 1) {
              const lx = VIEW.x + VIEW.w * wipe;
              ctx.save();
              ctx.shadowColor = C.h1;
              ctx.shadowBlur = 30;
              ctx.fillStyle = C.h1;
              ctx.fillRect(lx - 3, VIEW.y, 6, VIEW.h);
              ctx.restore();
            }
          }
          // «проверить, на что он способен»: бегущая линия сканера
          const scan = cQ.on ? cQ.p : 0;
          if (scan > 0) {
            const sy = VIEW.y + VIEW.h * ((scan * 1.6) % 1);
            const g = ctx.createLinearGradient(0, sy - 90, 0, sy);
            g.addColorStop(0, a(C.accent, 0));
            g.addColorStop(1, a(C.accent, 0.28));
            ctx.fillStyle = g;
            ctx.fillRect(VIEW.x, sy - 90, VIEW.w, 90);
            ctx.fillStyle = a(C.accent, 0.9);
            ctx.fillRect(VIEW.x, sy - 2, VIEW.w, 4);
          }
          ctx.restore();

          const frame = wipe > 0.5 ? C.h1 : cQ.on ? C.accent : C.text;
          ctx.strokeStyle = a(frame, 0.5);
          ctx.lineWidth = 2;
          rrPath(ctx, VIEW.x, VIEW.y, VIEW.w, VIEW.h, 14);
          ctx.stroke();
          const breathe = cQ.on ? 6 + 6 * Math.sin(gt * 8) : 0;
          corners(
            ctx,
            VIEW.x - 12 - breathe,
            VIEW.y - 12 - breathe,
            VIEW.w + 24 + breathe * 2,
            VIEW.h + 24 + breathe * 2,
            30,
            a(frame, 0.75),
            3,
          );
        },
        { dx: 60 },
      );
    });

    // подпись стиля под вьюпортом: до середины шторки — тун, после — реализм
    const styles = [
      { id: 'style:toon', str: 'тун-шейдинг', label: 'Подпись: тун', on: wipe <= 0.5 },
      { id: 'style:real', str: 'реализм', label: 'Подпись: реализм', on: wipe > 0.5 },
    ];
    const styleAt = { x: VIEW.x + VIEW.w / 2, y: VIEW.y + VIEW.h + 74 };
    styles.forEach((sl) => {
      f.obj(sl.id, { ...styleAt, abs: true, text: sl.str, label: sl.label }, (o) => {
        if (!sl.on) return;
        ctx.save();
        ctx.globalAlpha *= clamp01(seg(cC.p, 0.8, 0.1)) * (wipe > 0 && wipe < 1 ? 0.4 : 1);
        text(ctx, o.text, VIEW.x + VIEW.w / 2, VIEW.y + VIEW.h + 74, {
          size: 52,
          color: wipe > 0.5 ? C.h1 : a(C.text, 0.6),
          align: 'center',
          tracking: 2,
        });
        ctx.restore();
      });
    });
  },
};
