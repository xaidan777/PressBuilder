/**
 * Сцена 12. Перенос релиза.
 * Жёлтая линия времени доходит до синего спрайта релиза, тот перепрыгивает
 * вправо на новую дату, и линия его догоняет.
 */

import { clamp01, easeOutQuart, hash11, pulse, seg } from '../../engine/anim.ts';
import { panel, rrPath } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { track } from '../../engine/widgets.ts';
import type { CueTime, Frame, SceneDef } from '../../engine/types.ts';

/** Даты на дорожке. Менять здесь. */
const PLAN = { k: 0.44, label: '27 июня', sub: 'план' };
const REAL = { k: 0.86, label: '3 августа', sub: 'релиз', color: C.h1 };

/** Момент, когда жёлтая линия поравнялась с планом и спрайт отпрыгивает. */
const jumpAt = (c: CueTime) => c.start + c.dur * 0.82;

/** Реплики в обсуждениях не цитируются — рисуем абстрактные сообщения. */
const WORRY_COUNT = 4;

export const scene12: SceneDef = {
  id: 's12',

  energy(t, cue) {
    return pulse(t, jumpAt(cue('delay')), 0.9) * 0.6;
  },

  render(f: Frame) {
    const { ctx, gt } = f;
    const cD = f.cue('delay');
    const cW = f.cue('worry');
    const cO = f.cue('out');

    f.obj('title', { x: 150, y: 272, abs: true, text: cD.show, label: 'Заголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        272,
        { size: 84, color: C.h1, tracking: 0.6, maxWidth: 1300 },
        seg(cD.t, 0, 0.8),
        { stagger: 0.2, rise: 26 },
      );
    });

    // Линия времени едет без остановок: сначала до плана, потом дальше к релизу.
    // В момент, когда она равняется со спрайтом, тот отпрыгивает вправо.
    const tStart = cD.start + 0.1;
    const tJump = jumpAt(cD);
    const tArrive = cO.start + 0.4;
    const progress =
      f.t < tJump
        ? PLAN.k * clamp01((f.t - tStart) / (tJump - tStart))
        : PLAN.k + (REAL.k - PLAN.k) * clamp01((f.t - tJump) / (tArrive - tJump));

    const jump = seg(f.t, tJump, 0.7);
    const catchUp = clamp01((f.t - tJump) / (tArrive - tJump));
    const spriteK = PLAN.k + (REAL.k - PLAN.k) * easeOutQuart(jump);

    f.obj('track', { x: 960, y: 640, abs: true, label: 'Таймлайн дат' }, () => {
      track(ctx, {
        x: 210,
        y: 640,
        w: 1500,
        marks: [PLAN, REAL],
        progress,
        sprite: spriteK,
        jump: pulse(f.t, tJump, 0.7),
        p: seg(cD.t, 0, 0.6),
        t: gt,
      });
    });

    // ярлык переноса
    const mx = 210 + 1500 * ((PLAN.k + REAL.k) / 2);
    f.obj('shift', { x: mx, y: 468, abs: true, text: 'перенос', label: 'Ярлык переноса' }, (o) => {
      if (jump <= 0.05) return;
      const e = easeOutQuart(clamp01(jump * 1.6));
      ctx.save();
      ctx.globalAlpha *= e * (1 - clamp01(catchUp * 1.4 - 0.4));
      text(ctx, o.text, mx, 468, {
        size: 34,
        color: C.accent,
        align: 'center',
        tracking: 2.6,
      });
      ctx.strokeStyle = a(C.accent, 0.5);
      ctx.setLineDash([8, 10]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(210 + 1500 * PLAN.k, 500);
      ctx.lineTo(210 + 1500 * (PLAN.k + (REAL.k - PLAN.k) * e), 500);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    });

    // беспокойство в обсуждениях
    const wp = seg(cW.t, 0, 1.0);
    Array.from({ length: WORRY_COUNT }, (_, i) => i).forEach((i) => {
      const bx = 260 + i * 380 + (hash11(i * 3.1) - 0.5) * 40;
      // опорная точка — центр сообщения без покачивания
      const anchorY = 776 + (i % 2) * 74 + 33;
      f.obj(
        `worry:${i}`,
        { x: bx + 150, y: anchorY, abs: true, label: `Сообщение ${i + 1}` },
        () => {
          if (wp <= 0) return;
          const p = clamp01(wp * 1.9 - i * 0.22);
          if (p <= 0) return;
          const e = easeOutQuart(p);
          const by = 776 + (i % 2) * 74 - Math.sin(gt * 1.2 + i) * 5;
          ctx.save();
          ctx.globalAlpha *= e * (1 - clamp01(seg(cO.t, 0.2, 0.8)) * 0.75);
          ctx.translate(0, (1 - e) * 22);
          const w = 300;
          panel(ctx, bx, by, w, 66, {
            fill: C.panel,
            stroke: a(C.text, 0.16),
            radius: 14,
            lineWidth: 1.4,
          });
          ctx.fillStyle = C.panel;
          ctx.beginPath();
          ctx.moveTo(bx + 34, by + 66);
          ctx.lineTo(bx + 50, by + 88);
          ctx.lineTo(bx + 66, by + 66);
          ctx.closePath();
          ctx.fill();
          icon(ctx, 'chat', bx + 34, by + 33, 26, a(C.text, 0.4));
          // строки сообщения — абстрактные, без выдуманных цитат
          ctx.fillStyle = a(C.text, 0.22);
          rrPath(ctx, bx + 62, by + 20, 150 + hash11(i * 6.7) * 60, 9, 4);
          ctx.fill();
          ctx.fillStyle = a(C.text, 0.14);
          rrPath(ctx, bx + 62, by + 40, 110 + hash11(i * 2.9) * 70, 9, 4);
          ctx.fill();
          ctx.restore();
        },
      );
    });

    // финальная плашка даты
    const op = seg(cO.t, 0.35, 0.7);
    f.obj(
      'date',
      { x: 960, y: 1010, abs: true, text: '3 августа — релиз', label: 'Плашка даты релиза' },
      (o) => {
        if (op <= 0) return;
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(op);
        const bw = 470;
        const bx = 960 - bw / 2;
        panel(ctx, bx, 962, bw, 96, {
          fill: C.panel,
          stroke: a(C.h1, 0.4),
          radius: 14,
          lineWidth: 2,
          glow: a(C.h1, 0.14),
          glowBlur: 40,
        });
        ctx.fillStyle = C.h1;
        rrPath(ctx, bx, 962, 5, 96, 2);
        ctx.fill();
        icon(ctx, 'rocket', bx + 62, 1010, 44, C.h1, gt);
        text(ctx, o.text, bx + 100, 1024, { size: 44, color: C.h1, tracking: 0.8 });
        ctx.restore();
      },
    );
  },
};
