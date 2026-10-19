/** Слайд 3. Четыре разнокалиберных спрайта проходят пакетную обработку: размер, сдвиг, фон, экспорт. */

import { easeInOutCubic, easeOutBack, lerp, pulse, seg } from '../../engine/anim.ts';
import { hexPath, rrPath, shockRing } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal } from '../../engine/text.ts';
import { a, C, mix } from '../../engine/theme.ts';
import type { SceneDef } from '../../engine/types.ts';
import { appear, checker, sprite } from './common.ts';

const CARD = 310;
const CARD_GAP = 36;
const GRID = { x: 1368, y: 628 };
/** Исходный разнобой: масштаб, сдвиг и фаза шага каждого спрайта. */
const MESS = [
  { s: 0.55, dx: -70, dy: 50, ph: 0.05 },
  { s: 1.3, dx: 60, dy: -40, ph: 0.3 },
  { s: 0.8, dx: -40, dy: -70, ph: 0.55 },
  { s: 1.1, dx: 80, dy: 60, ph: 0.8 },
];
const STEPS = ['fit', 'shift', 'bg', 'export'] as const;
const STEP_LABEL = ['Шаг: размер', 'Шаг: сдвиг', 'Шаг: фон', 'Шаг: экспорт'];

const cardCenter = (i: number) => ({
  x: GRID.x + ((i % 2) - 0.5) * (CARD + CARD_GAP),
  y: GRID.y + (Math.floor(i / 2) - 0.5) * (CARD + CARD_GAP),
});

/** Фон под спрайт — простая «локация» в палитре ролика. */
function backdrop(ctx: CanvasRenderingContext2D, half: number): void {
  const g = ctx.createLinearGradient(0, -half, 0, half);
  g.addColorStop(0, mix(C.h1, C.bg, 0.55));
  g.addColorStop(0.62, mix(C.accent, C.bg, 0.6));
  g.addColorStop(0.62, mix(C.pos, C.bg, 0.72));
  g.addColorStop(1, mix(C.pos, C.bg, 0.86));
  ctx.fillStyle = g;
  ctx.fillRect(-half, -half, half * 2, half * 2);
  ctx.fillStyle = a(C.accent, 0.75);
  ctx.beginPath();
  ctx.arc(-half * 0.52, -half * 0.5, half * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

export const scene03: SceneDef = {
  id: 's03',

  energy(_t, cue) {
    const c = cue('export');
    return pulse(c.t, 0.4, 1.6) * 0.7;
  },

  render(f) {
    const { ctx } = f;
    const cB = f.cue('batch');
    const cF = f.cue('fit');
    const cSh = f.cue('shift');
    const cBg = f.cue('bg');
    const cE = f.cue('export');
    const cues = [cF, cSh, cBg, cE];

    f.obj('title', { x: 150, y: 190, text: cB.show, label: 'Заголовок' }, (o) => {
      reveal(ctx, o.text, 0, 0, { size: 84, color: C.text, tracking: 0.8 }, seg(cB.t, 0, 0.8), {
        stagger: 0.18,
        rise: 24,
      });
    });

    // ---- шаги обработки: появляются, когда их называют
    STEPS.forEach((_id, i) => {
      const c = cues[i];
      f.obj(`step:${i}`, { x: 150, y: 400 + i * 140, text: c.show, label: STEP_LABEL[i] }, (o) => {
        const p = seg(c.t, 0, 0.45);
        if (p <= 0) return;
        const done = seg(c.t, c.dur, 0.3);
        const color = mix(C.accent, C.text, done);
        appear(
          ctx,
          p,
          () => {
            hexPath(ctx, 30, -26, 30, Math.PI / 6);
            ctx.fillStyle = a(C.pos, 0.9 * done);
            ctx.fill();
            ctx.strokeStyle = mix(C.accent, C.pos, done);
            ctx.lineWidth = 4;
            ctx.stroke();
            if (done > 0) {
              ctx.save();
              ctx.globalAlpha *= done;
              icon(ctx, 'check', 30, -26, 30, C.bg);
              ctx.restore();
            }
          },
          { from: 0.4, cx: 30, cy: -26, back: true },
        );
        reveal(ctx, o.text, 90, 0, { size: 84, color, tracking: 0.8 }, p, { stagger: 0.25, rise: 22 });
      });
    });

    // ---- карточки спрайтов
    MESS.forEach((m, i) => {
      const at = cardCenter(i);
      f.obj(`card:${i}`, { x: at.x, y: at.y, label: `Спрайт ${i + 1}` }, () => {
        const half = CARD / 2;
        appear(
          ctx,
          seg(cB.t, 0.6 + i * 0.4, 0.55),
          () => {
            const fit = easeInOutCubic(seg(cF.t, 0.1 + i * 0.08, Math.max(0.6, cF.dur * 0.55)));
            const mv = easeInOutCubic(seg(cSh.t, 0.05 + i * 0.07, Math.max(0.5, cSh.dur * 0.6)));
            const bg = seg(cBg.t, 0.05 + i * 0.1, 0.5);

            ctx.save();
            rrPath(ctx, -half, -half, CARD, CARD, 14);
            ctx.clip();
            checker(ctx, -half, -half, CARD, CARD, 22);
            if (bg > 0) {
              ctx.save();
              ctx.globalAlpha *= bg;
              backdrop(ctx, half);
              ctx.restore();
            }

            // направляющие: целевой размер и центр
            const gFit = seg(cF.t, 0, 0.25) * (1 - seg(cSh.t, 0, 0.35));
            if (gFit > 0) {
              ctx.save();
              ctx.globalAlpha *= gFit;
              ctx.strokeStyle = C.accent;
              ctx.lineWidth = 3;
              ctx.setLineDash([12, 10]);
              ctx.strokeRect(-105 + m.dx * (1 - mv), -105 + m.dy * (1 - mv), 210, 210);
              ctx.restore();
            }
            const gMove = seg(cSh.t, 0, 0.25) * (1 - seg(cBg.t, 0, 0.35));
            if (gMove > 0) {
              ctx.save();
              ctx.globalAlpha *= gMove;
              ctx.strokeStyle = C.h1;
              ctx.lineWidth = 2.5;
              ctx.beginPath();
              ctx.moveTo(-half, 0);
              ctx.lineTo(half, 0);
              ctx.moveTo(0, -half);
              ctx.lineTo(0, half);
              ctx.stroke();
              ctx.restore();
            }

            sprite(ctx, m.dx * (1 - mv), m.dy * (1 - mv) + 6, 210 * lerp(m.s, 1, fit), m.ph);
            ctx.restore();

            rrPath(ctx, -half, -half, CARD, CARD, 14);
            ctx.strokeStyle = a(C.text, 0.25);
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // отметка «экспортировано»
            const ok = seg(cE.t, 0.35 + i * 0.18, 0.4);
            if (ok > 0) {
              const s = easeOutBack(ok);
              ctx.save();
              ctx.translate(half - 34, -half + 34);
              ctx.scale(s, s);
              ctx.fillStyle = C.pos;
              ctx.beginPath();
              ctx.arc(0, 0, 24, 0, Math.PI * 2);
              ctx.fill();
              icon(ctx, 'check', 0, 0, 28, C.bg);
              ctx.restore();
            }
          },
          { from: 0.6, back: true },
        );
      });
    });

    // ---- папка экспорта в центре сетки: копии спрайтов слетаются в неё
    f.obj('folder', { x: GRID.x, y: GRID.y, label: 'Папка экспорта' }, () => {
      const p = seg(cE.t, 0, 0.45);
      if (p <= 0) return;
      MESS.forEach((m, i) => {
        const fly = seg(cE.t, 0.15 + i * 0.18, 0.5);
        if (fly <= 0 || fly >= 1) return;
        const e = easeInOutCubic(fly);
        const from = cardCenter(i);
        const size = lerp(110, 30, e);
        ctx.save();
        ctx.globalAlpha *= 1 - e * 0.5;
        ctx.translate(lerp(from.x - GRID.x, 0, e), lerp(from.y - GRID.y, 0, e));
        rrPath(ctx, -size / 2, -size / 2, size, size, 8);
        ctx.fillStyle = mix(C.pos, C.bg, 0.6);
        ctx.fill();
        sprite(ctx, 0, 2, size * 0.8, m.ph);
        ctx.restore();
      });
      shockRing(ctx, 0, 0, seg(cE.t, 0.95, 0.8), 170, C.pos, 4);
      appear(
        ctx,
        p,
        () => {
          hexPath(ctx, 0, 0, 84, Math.PI / 6);
          ctx.fillStyle = C.panel;
          ctx.fill();
          ctx.strokeStyle = C.pos;
          ctx.lineWidth = 5;
          ctx.stroke();
          icon(ctx, 'folder', 0, 0, 78, C.pos);
        },
        { from: 0.3, back: true },
      );
    });
  },
};
