/** Слайд 1. Название программы, рядом собирается атлас; затем — окно с исходным кодом. */

import { pulse, seg } from '../../engine/anim.ts';
import { rrPath, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import type { SceneDef } from '../../engine/types.ts';
import { appear, appWindow, spriteCell } from './common.ts';

const COLS = 4;
const ROWS = 3;
const CELL = 140;
const GAP = 12;
const GRID_W = COLS * CELL + (COLS - 1) * GAP;
const GRID_H = ROWS * CELL + (ROWS - 1) * GAP;

/** Строки «кода»: отступ и цветные отрезки — без настоящего текста. */
const CODE: Array<{ indent: number; parts: Array<[number, string]> }> = [
  { indent: 0, parts: [[90, C.accent], [150, C.text]] },
  { indent: 36, parts: [[70, C.h1], [110, C.text], [60, C.pos]] },
  { indent: 36, parts: [[120, C.text], [80, C.h1]] },
  { indent: 72, parts: [[60, C.accent], [170, C.text]] },
  { indent: 36, parts: [[100, C.pos], [90, C.text]] },
  { indent: 0, parts: [[50, C.accent]] },
];

export const scene01: SceneDef = {
  id: 's01',

  energy(_t, cue) {
    const c = cue('meet');
    return pulse(c.t, c.dur * 0.35, 1.4) * 0.7;
  },

  render(f) {
    const { ctx, gt } = f;
    const cM = f.cue('meet');
    const cS = f.cue('source');

    f.obj('kicker', { x: 150, y: 330, text: 'встречайте обновленный', label: 'Надзаголовок' }, (o) => {
      reveal(ctx, o.text, 0, 0, { size: 72, color: C.accent, tracking: 2 }, seg(cM.t, 0, 0.7), {
        stagger: 0.3,
        rise: 20,
      });
    });

    f.obj('title', { x: 150, y: 520, text: cM.show, label: 'Название' }, (o) => {
      const p = seg(cM.t, cM.dur * 0.35, 0.9);
      if (p <= 0) return;
      ctx.save();
      ctx.globalAlpha *= p;
      softLight(ctx, 420, -60, 620, C.h1, 0.1);
      ctx.restore();
      reveal(
        ctx,
        o.text,
        0,
        0,
        { size: 190, color: C.h1, tracking: 1, glowColor: a(C.h1, 0.35), glowBlur: 44 },
        p,
        { stagger: 0.4, rise: 44 },
      );
    });

    // атлас собирается из кадров, персонаж в каждом шагает в своей фазе
    f.obj('atlas', { x: 1472, y: 400, label: 'Атлас' }, () => {
      for (let i = 0; i < COLS * ROWS; i++) {
        const x = -GRID_W / 2 + (i % COLS) * (CELL + GAP);
        const y = -GRID_H / 2 + Math.floor(i / COLS) * (CELL + GAP);
        appear(
          ctx,
          seg(f.t, 0.15 + i * 0.09, 0.5),
          () => spriteCell(ctx, x, y, CELL, i / (COLS * ROWS) + gt * 0.35, { keyX: Infinity }),
          { from: 0.5, cx: x + CELL / 2, cy: y + CELL / 2, back: true },
        );
      }
    });

    f.obj('source', { x: 150, y: 740, text: cS.show, label: 'Исходный код' }, (o) => {
      const p = seg(cS.t, 0, 0.6);
      if (p <= 0) return;
      appear(ctx, p, () => icon(ctx, 'code', 50, -40, 100, C.pos), { from: 0.4, cx: 50, cy: -40, back: true });
      reveal(ctx, o.text, 130, 0, { size: 120, color: C.pos, tracking: 1 }, p, { stagger: 0.3, rise: 30 });
    });

    f.obj('code', { x: 1472, y: 800, label: 'Окно с кодом' }, () => {
      const p = seg(cS.t, 0.1, 0.6);
      if (p <= 0) return;
      appear(
        ctx,
        p,
        () => {
          const box = appWindow(ctx, -GRID_W / 2, -130, GRID_W, 260, { bar: 46, glow: a(C.pos, 0.18) });
          const typed = seg(cS.t, 0.4, Math.max(1.2, cS.dur * 0.9)) * CODE.length;
          CODE.forEach((ln, i) => {
            const k = Math.min(1, Math.max(0, typed - i));
            if (k <= 0) return;
            const total = ln.parts.reduce((s, [w]) => s + w + 12, 0);
            let x = box.x + 28 + ln.indent;
            const y = box.y + 28 + i * 31;
            let left = total * k;
            for (const [w, color] of ln.parts) {
              const vis = Math.min(w, left);
              if (vis <= 0) break;
              ctx.fillStyle = a(color, 0.85);
              rrPath(ctx, x, y, vis, 12, 6);
              ctx.fill();
              x += w + 12;
              left -= w + 12;
            }
          });
        },
        { dy: 40 },
      );
    });
  },
};
