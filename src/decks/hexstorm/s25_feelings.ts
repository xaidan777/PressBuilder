/** Сцена 25. Тихая сцена: как это ощущалось и почему работа продолжилась. */

import { clamp01, easeOutQuart, seg } from '../../engine/anim.ts';
import { rrPath, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { chip } from '../../engine/ui.ts';
import { curve } from '../../engine/widgets.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

const MONTHS = 12;
const AFTER = [0.2, 0.22, 0.26, 0.33, 0.42, 0.52, 0.62, 0.72];

export const scene25: SceneDef = {
  id: 's25',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cR = f.cue('ready');
    const cS = f.cue('sad');
    const cG = f.cue('go');

    const rp = seg(cR.t, 0, 0.9);
    const sp = seg(cS.t, 0, 1.0);
    const gp = seg(cG.t, 0, 1.0);

    ctx.save();
    ctx.globalAlpha *= clamp01(rp * 2) * (1 - gp * 0.4);
    softLight(ctx, 960, 320, 620, C.h1, 0.07);
    ctx.restore();

    f.obj('title', { x: 960, y: 330, abs: true, text: cR.show, label: 'Заголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        960,
        330,
        { size: 92, color: a(C.text, 0.9), align: 'center', tracking: 1 },
        rp,
        { stagger: 0.24, rise: 26 },
      );
    });

    // месяцы труда
    const bw = 120;
    const gap = 16;
    const x0 = 960 - (MONTHS * bw + (MONTHS - 1) * gap) / 2;
    f.obj(
      'months',
      { x: 960, y: 560, abs: true, text: 'месяцы работы', label: 'Месяцы работы' },
      (o) => {
        for (let i = 0; i < MONTHS; i++) {
          const p = clamp01(rp * 2 - 0.6 - i * 0.05);
          if (p <= 0) continue;
          const e = easeOutQuart(p);
          const broken = clamp01(sp * 1.8 - i * 0.05);
          const x = x0 + i * (bw + gap);
          ctx.save();
          ctx.globalAlpha *= e * (1 - broken * 0.62);
          ctx.translate(x + bw / 2, 560);
          ctx.rotate(broken * (i % 2 ? 0.06 : -0.05));
          ctx.translate(-bw / 2, -60);
          ctx.fillStyle = a(broken > 0.5 ? C.text : C.h1, 0.12);
          rrPath(ctx, 0, 0, bw, 120, 10);
          ctx.fill();
          ctx.strokeStyle = a(broken > 0.5 ? C.text : C.h1, 0.35);
          ctx.lineWidth = 1.6;
          rrPath(ctx, 0, 0, bw, 120, 10);
          ctx.stroke();
          text(ctx, `${i + 1}`, bw / 2, 76, {
            size: 44,
            color: a(broken > 0.5 ? C.text : C.h1, 0.5),
            align: 'center',
            family: 'mono',
          });
          ctx.restore();
        }
        ctx.save();
        ctx.globalAlpha *= clamp01(rp * 2 - 0.8) * (1 - gp * 0.5);
        text(ctx, o.text, 960, 700, {
          size: 30,
          color: a(C.text, 0.42),
          align: 'center',
          tracking: 2.6,
        });
        ctx.restore();
      },
    );

    // «за 10 минут»
    f.obj(
      'broken',
      { x: 910, y: 796, abs: true, text: 'сломали за пару часов', label: 'Сломали за пару часов' },
      (o) => {
        if (sp <= 0.2) return;
        const e = easeOutQuart(clamp01((sp - 0.2) / 0.5));
        ctx.save();
        ctx.globalAlpha *= e * (1 - gp * 0.6);
        icon(ctx, 'clock', 860, 780, 48, C.accent, gt);
        text(ctx, o.text, 910, 796, { size: 48, color: C.accent, tracking: 0.8 });
        ctx.restore();
      },
    );

    // но работа продолжилась
    f.obj('curve', { x: 1460, y: 925, abs: true, label: 'График после' }, () => {
      if (gp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= easeOutQuart(gp);
      curve(ctx, {
        x: 1160,
        y: 850,
        w: 600,
        h: 150,
        data: AFTER,
        p: gp,
        color: C.pos,
        fill: true,
        lineWidth: 4,
      });
      ctx.restore();
    });
    f.obj('chip', { x: 160, y: 930, abs: true, text: cG.show, label: 'Плашка «хотфиксы»' }, (o) => {
      if (gp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= easeOutQuart(gp);
      chip(ctx, o.text, 160, 930, { color: C.pos, size: 32, icon: 'wrench', p: gp });
      ctx.restore();
    });
    f.obj(
      'note',
      {
        x: 160,
        y: 1020,
        abs: true,
        text: 'ничего изменить нельзя — можно только работать',
        label: 'Подпись внизу',
      },
      (o) => {
        if (gp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(gp);
        text(ctx, o.text, 160, 1020, {
          size: 32,
          color: a(C.text, 0.55),
          tracking: 1,
        });
        ctx.restore();
      },
    );
  },
};
