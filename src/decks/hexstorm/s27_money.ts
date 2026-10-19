/** Сцена 27. Куда делись деньги первой недели: gross → нетто → на карту. */

import { clamp01, fmtNum, seg } from '../../engine/anim.ts';
import { reveal } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { waterfall } from '../../engine/widgets.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

const GROSS = 11137;
const NET = 8649;
const CARD = 6053;

export const scene27: SceneDef = {
  id: 's27',

  render(f: Frame) {
    const { ctx } = f;
    const cG = f.cue('gross');
    const cC = f.cue('card');

    f.obj('title', { x: 150, y: 300, abs: true, text: cG.show, label: 'Заголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        300,
        { size: 112, color: C.accent, tracking: 0.6, glowColor: a(C.accent, 0.3), glowBlur: 32 },
        seg(cG.t, 0, 0.8),
        { stagger: 0.22, rise: 28 },
      );
    });

    // каскад вычетов: одна непрерывная шкала от первой реплики до последней
    const t0 = cG.start + 0.2;
    const t1 = cC.start + cC.dur * 0.65;
    const p = clamp01((f.t - t0) / (t1 - t0));

    f.obj('waterfall', { x: 960, y: 630, abs: true, label: 'Каскад вычетов' }, () => {
      waterfall(ctx, {
        x: 230,
        y: 430,
        w: 1460,
        h: 400,
        p,
        steps: [
          { label: 'gross за неделю', value: GROSS, color: C.h1 },
          { label: 'после рефандов\nи налогов', value: NET, color: C.h1 },
          { label: 'на карту', value: CARD, color: C.pos },
        ],
        losses: ['рефанды, налоги\nи прочее', 'комиссия Steam\n30%'],
        fmt: (v) => `$${fmtNum(v)}`,
      });
    });

  },
};
