/** Слайд 2. Кадры из видео слетаются в спрайт-атлас, затем зелёный фон вырезается в альфу. */

import { easeInOutCubic, lerp, pulse, seg } from '../../engine/anim.ts';
import { arrow, corners, rrPath } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import type { CueTime, SceneDef } from '../../engine/types.ts';
import { appear, appWindow, GREEN, sprite, spriteCell } from './common.ts';

const VIDEO = { x: 490, y: 575, w: 680, h: 490 };
const ATLAS = { x: 1381, y: 575 };
const COLS = 4;
const ROWS = 3;
const N = COLS * ROWS;
const CELL = 184;
const GAP = 14;
const GRID_W = COLS * CELL + (COLS - 1) * GAP;
const GRID_H = ROWS * CELL + (ROWS - 1) * GAP;

/** Когда i-й кадр долетает до атласа (в секундах реплики). */
const landAt = (c: CueTime, i: number) => c.dur * (0.24 + (0.62 * i) / (N - 1));
/** Проход границы вырезания по атласу, 0..1. */
const sweep = (c: CueTime) => easeInOutCubic(seg(c.t, 0.3, Math.max(1.2, c.dur * 0.5)));

export const scene02: SceneDef = {
  id: 's02',

  energy(_t, cue) {
    const c = cue('alpha');
    return pulse(c.t, 0.3, Math.max(1.6, c.dur * 0.6)) * 0.6;
  },

  render(f) {
    const { ctx, gt } = f;
    const cA = f.cue('atlas');
    const cK = f.cue('alpha');

    f.obj('title', { x: 150, y: 190, text: cA.show, label: 'Заголовок' }, (o) => {
      ctx.globalAlpha *= 1 - seg(cK.t, 0, 0.4);
      reveal(ctx, o.text, 0, 0, { size: 84, color: C.text, tracking: 0.8 }, seg(cA.t, 0, 0.8), {
        stagger: 0.18,
        rise: 24,
      });
    });

    f.obj('title-alpha', { x: 150, y: 190, text: cK.show, label: 'Заголовок: фон' }, (o) => {
      reveal(ctx, o.text, 0, 0, { size: 84, color: C.h1, tracking: 0.8 }, seg(cK.t, 0.25, 0.7), {
        stagger: 0.22,
        rise: 24,
      });
    });

    // ---- видео: персонаж шагает на зелёном фоне, рамка вспыхивает на каждом снятом кадре
    f.obj('video', { x: VIDEO.x, y: VIDEO.y, label: 'Видео' }, () => {
      appear(
        ctx,
        seg(f.t, 0.1, 0.6),
        () => {
          const { w, h } = VIDEO;
          const box = appWindow(ctx, -w / 2, -h / 2, w, h, { bar: 50 });
          const foot = 56;
          ctx.save();
          ctx.beginPath();
          ctx.rect(box.x + 3, box.y, box.w - 6, box.h - foot);
          ctx.clip();
          ctx.fillStyle = GREEN;
          ctx.fillRect(box.x, box.y, box.w, box.h);
          sprite(ctx, 0, box.y + (box.h - foot) / 2 + 8, 290, gt * 0.9);
          ctx.restore();

          // вспышка рамки в момент, когда очередной кадр «снят» и улетает в атлас
          let flash = 0;
          for (let i = 0; i < N; i++) {
            const shot = landAt(cA, i) - 0.5;
            if (cA.t >= shot) flash = Math.max(flash, 1 - seg(cA.t, shot, 0.3));
          }
          if (flash > 0.01) {
            ctx.save();
            ctx.globalAlpha *= flash;
            corners(ctx, -175, box.y + 24, 350, box.h - foot - 48, 34, C.text, 4);
            ctx.restore();
          }

          // полоса воспроизведения
          const by = box.y + box.h - foot / 2;
          icon(ctx, 'play', box.x + 34, by, 26, C.h1);
          ctx.fillStyle = a(C.text, 0.18);
          rrPath(ctx, box.x + 64, by - 4, box.w - 92, 8, 4);
          ctx.fill();
          ctx.fillStyle = C.h1;
          rrPath(ctx, box.x + 64, by - 4, (box.w - 92) * Math.max(0.02, seg(cA.t, 0, cA.dur)), 8, 4);
          ctx.fill();
        },
        { dy: 30 },
      );
    });

    f.obj('cap-video', { x: VIDEO.x, y: 950, text: 'видео', label: 'Подпись: видео' }, (o) => {
      const p = seg(f.t, 0.4, 0.5);
      if (p <= 0) return;
      ctx.globalAlpha *= p;
      text(ctx, o.text, 0, 0, { size: 60, color: a(C.text, 0.85), align: 'center', tracking: 2 });
    });

    f.obj('arrow', { x: 911, y: VIDEO.y, label: 'Стрелка' }, () => {
      arrow(ctx, -62, 0, 62, 0, seg(cA.t, 0.3, 0.6), { color: C.accent, width: 6, head: 24 });
    });

    // ---- атлас: пустая сетка, кадры прилетают из видео; потом граница вырезает зелёный фон
    f.obj('atlas', { x: ATLAS.x, y: ATLAS.y, label: 'Спрайт-атлас' }, () => {
      const grid = seg(cA.t, 0.2, 0.6);
      if (grid <= 0) return;
      const sw = sweep(cK);
      const keyX = sw <= 0 ? undefined : lerp(-GRID_W / 2 - 20, GRID_W / 2 + 20, sw);
      const from = { x: VIDEO.x - ATLAS.x, y: 0 };

      const flying: Array<() => void> = [];
      for (let i = 0; i < N; i++) {
        const x = -GRID_W / 2 + (i % COLS) * (CELL + GAP);
        const y = -GRID_H / 2 + Math.floor(i / COLS) * (CELL + GAP);
        const p = seg(cA.t, landAt(cA, i) - 0.5, 0.5);

        // место под кадр
        ctx.save();
        ctx.globalAlpha *= grid * 0.9;
        rrPath(ctx, x, y, CELL, CELL, 10);
        ctx.strokeStyle = a(C.text, 0.14);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();

        if (p >= 1) {
          const pop = 1 + 0.08 * (1 - seg(cA.t, landAt(cA, i), 0.25));
          ctx.save();
          ctx.translate(x + CELL / 2, y + CELL / 2);
          ctx.scale(pop, pop);
          spriteCell(ctx, -CELL / 2, -CELL / 2, CELL, i / N, { keyX: keyX === undefined ? undefined : keyX - x - CELL / 2 });
          ctx.restore();
        } else if (p > 0) {
          // летящие кадры рисуем поверх уже севших
          flying.push(() => {
            const e = easeInOutCubic(p);
            const size = lerp(70, CELL, e);
            const cx = lerp(from.x, x + CELL / 2, e);
            const cy = lerp(from.y, y + CELL / 2, e) - Math.sin(e * Math.PI) * 60;
            ctx.save();
            ctx.globalAlpha *= Math.min(1, p * 4);
            spriteCell(ctx, cx - size / 2, cy - size / 2, size, i / N);
            ctx.restore();
          });
        }
      }
      flying.forEach((fn) => fn());

      if (keyX !== undefined && sw < 1) {
        ctx.save();
        ctx.strokeStyle = C.h1;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.shadowColor = a(C.h1, 0.8);
        ctx.shadowBlur = 26;
        ctx.beginPath();
        ctx.moveTo(keyX, -GRID_H / 2 - 22);
        ctx.lineTo(keyX, GRID_H / 2 + 22);
        ctx.stroke();
        ctx.restore();
      }
    });

    f.obj('cap-atlas', { x: ATLAS.x, y: 950, text: 'спрайт атлас', label: 'Подпись: атлас' }, (o) => {
      const p = seg(cA.t, cA.dur * 0.45, 0.5);
      if (p <= 0) return;
      ctx.globalAlpha *= p;
      text(ctx, o.text, 0, 0, { size: 60, color: a(C.text, 0.85), align: 'center', tracking: 2 });
    });

    f.obj('alpha', { x: 1752, y: 190, text: 'альфа', label: 'Альфа' }, (o) => {
      const p = seg(cK.t, 0.3 + Math.max(1.2, cK.dur * 0.5) * 0.8, 0.5);
      reveal(ctx, o.text, 0, 0, { size: 84, color: C.pos, align: 'right', tracking: 2 }, p, { rise: 24 });
    });
  },
};
