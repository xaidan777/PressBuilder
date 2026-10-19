/** Сцена 19. Ползунок сложности, поток патчей и трёхчасовой сон. */

import { clamp01, easeOutQuart, hash11, seg } from '../../engine/anim.ts';
import { panel, rrPath, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { chip } from '../../engine/ui.ts';
import { curve } from '../../engine/widgets.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

const REFUND_FALL = [1.0, 0.98, 0.94, 0.86, 0.6, 0.38, 0.26, 0.2, 0.18];

/** Ползунок сложности: ручка едет с «хардкора» к комфортной зоне. */
function difficultySlider(
  f: Frame,
  x: number,
  y: number,
  w: number,
  k: number,
  p: number,
  gt: number,
): void {
  const { ctx } = f;
  const e = easeOutQuart(clamp01(p));

  f.obj('slider', { x: x + w / 2, y: y + 11, abs: true, label: 'Ползунок сложности' }, () => {
    if (e <= 0) return;
    ctx.save();
    ctx.globalAlpha *= e;

    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, a(C.pos, 0.5));
    g.addColorStop(0.55, a(C.h1, 0.5));
    g.addColorStop(1, a(C.accent, 0.6));
    ctx.fillStyle = a(C.text, 0.08);
    rrPath(ctx, x, y, w, 22, 11);
    ctx.fill();
    ctx.fillStyle = g;
    rrPath(ctx, x, y, w, 22, 11);
    ctx.fill();

    for (let i = 0; i <= 8; i++) {
      ctx.fillStyle = a(C.bg, 0.5);
      ctx.fillRect(x + (w * i) / 8 - 1, y, 2, 22);
    }

    const kx = x + w * clamp01(k);
    softLight(ctx, kx, y + 11, 130, C.h1, 0.28);
    ctx.fillStyle = C.bg;
    ctx.beginPath();
    ctx.arc(kx, y + 11, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.h1;
    ctx.lineWidth = 4;
    ctx.stroke();
    icon(ctx, 'sliders', kx, y + 11, 26, C.h1, gt);
    ctx.restore();
  });

  f.obj(
    'sliderLow',
    { x, y: y + 74, abs: true, text: 'комфорт', label: 'Подпись «комфорт»' },
    (o) => {
      if (e <= 0) return;
      ctx.save();
      ctx.globalAlpha *= e;
      text(ctx, o.text, x, y + 74, { size: 28, color: a(C.pos, 0.8), tracking: 2 });
      ctx.restore();
    },
  );

  f.obj(
    'sliderHigh',
    { x: x + w, y: y + 74, abs: true, text: 'хардкор', label: 'Подпись «хардкор»' },
    (o) => {
      if (e <= 0) return;
      ctx.save();
      ctx.globalAlpha *= e;
      text(ctx, o.text, x + w, y + 74, {
        size: 28,
        color: a(C.accent, 0.8),
        align: 'right',
        tracking: 2,
      });
      ctx.restore();
    },
  );
}

export const scene19: SceneDef = {
  id: 's19',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cH = f.cue('hardcore');
    const cS = f.cue('slider');
    const cP = f.cue('patches');
    const cZ = f.cue('sleep');

    f.obj(
      'title',
      { x: 150, y: 282, abs: true, text: 'игра оказалась хардкорной', label: 'Заголовок' },
      (o) => {
        reveal(
          ctx,
          o.text,
          150,
          282,
          { size: 84, color: C.h1, tracking: 0.6, maxWidth: 1300 },
          seg(cH.t, 0, 0.8),
          { stagger: 0.2, rise: 26 },
        );
      },
    );

    const sp = seg(cS.t, 0, 1.0);
    // ручка стоит справа, пока не появился ползунок, затем едет влево
    const knob = 0.92 - 0.42 * easeOutQuart(clamp01((sp - 0.25) / 0.6));
    difficultySlider(f, 200, 470, 1000, knob, Math.max(seg(cH.t, 0.4, 0.8), sp), gt);

    f.obj(
      'chip',
      {
        x: 200,
        y: 610,
        abs: true,
        text: 'на третий день — ползунок сложности',
        label: 'Плашка про ползунок',
      },
      (o) => {
        if (sp <= 0.15) return;
        ctx.save();
        ctx.globalAlpha *= clamp01((sp - 0.15) / 0.4);
        chip(ctx, o.text, 200, 610, {
          color: C.pos,
          size: 28,
          icon: 'sliders',
          p: clamp01((sp - 0.15) / 0.4),
        });
        ctx.restore();
      },
    );

    // поток рефандов пошёл вниз
    f.obj(
      'refunds',
      { x: 1560, y: 545, abs: true, text: 'поток рефандов', label: 'График рефандов' },
      (o) => {
        if (sp <= 0.3) return;
        const rp = clamp01((sp - 0.3) / 0.7);
        ctx.save();
        ctx.globalAlpha *= clamp01(rp * 3);
        text(ctx, o.text, 1360, 420, { size: 28, color: a(C.text, 0.5), tracking: 2 });
        ctx.restore();
        curve(ctx, {
          x: 1360,
          y: 450,
          w: 400,
          h: 190,
          data: REFUND_FALL,
          p: rp,
          color: C.pos,
          fill: true,
        });
      },
    );

    // патчи
    const pp = seg(cP.t, 0, 1.1);
    f.obj(
      'patches',
      { x: 860, y: 852, abs: true, text: 'первые трое суток', label: 'Поток патчей' },
      (o) => {
        if (pp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= clamp01(pp * 3);
        text(ctx, o.text, 200, 730, { size: 28, color: a(C.text, 0.5), tracking: 2.2 });
        ctx.restore();

        for (let i = 0; i < 11; i++) {
          const ip = clamp01(pp * 2 - i * 0.12);
          if (ip <= 0) continue;
          const e = easeOutQuart(ip);
          const col = i % 6;
          const row = Math.floor(i / 6);
          const px = 200 + col * 224;
          const py = 762 + row * 100;
          ctx.save();
          ctx.globalAlpha *= e;
          ctx.translate((1 - e) * -24, 0);
          panel(ctx, px, py, 200, 80, {
            fill: C.panel,
            stroke: a(C.h1, 0.28),
            radius: 10,
            lineWidth: 1.4,
          });
          icon(ctx, 'wrench', px + 44, py + 40, 38, a(C.h1, 0.85), gt);
          text(ctx, `#${i + 1}`, px + 80, py + 56, {
            size: 46,
            family: 'mono',
            color: a(C.text, 0.75),
          });
          ctx.restore();
        }
      },
    );

    f.obj('count', { x: 1660, y: 830, abs: true, text: '10+', label: 'Число патчей' }, (o) => {
      if (pp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= clamp01(pp * 1.4 - 0.5);
      text(ctx, o.text, 1660, 830, { size: 130, color: C.accent, align: 'center' });
      ctx.restore();
    });

    f.obj(
      'countLabel',
      { x: 1660, y: 884, abs: true, text: 'патчей', label: 'Подпись числа патчей' },
      (o) => {
        if (pp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= clamp01(pp * 1.4 - 0.5);
        text(ctx, o.text, 1660, 884, {
          size: 34,
          color: a(C.text, 0.55),
          align: 'center',
          tracking: 2.4,
        });
        ctx.restore();
      },
    );

    // сон
    const zp = seg(cZ.t, 0, 0.8);
    f.obj(
      'sleep',
      { x: 1450, y: 996, abs: true, text: 'сон — 3 часа в сутки', label: 'Сон' },
      (o) => {
        if (zp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(zp);
        icon(ctx, 'zzz', 1400, 980, 54, a(C.text, 0.5), gt);
        text(ctx, o.text, 1450, 996, {
          size: 40,
          color: a(C.text, 0.65),
          tracking: 1,
        });
        ctx.restore();
      },
    );

    f.obj('day', { x: 750, y: 981, abs: true, text: 'сутки', label: 'Шкала суток' }, (o) => {
      if (zp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= easeOutQuart(zp);
      // тонкая полоска «сколько осталось от суток»
      ctx.fillStyle = a(C.text, 0.1);
      rrPath(ctx, 200, 976, 1100, 10, 5);
      ctx.fill();
      ctx.fillStyle = a(C.accent, 0.8);
      rrPath(ctx, 200, 976, 1100 * (3 / 24) * easeOutQuart(zp), 10, 5);
      ctx.fill();
      text(ctx, o.text, 200, 1012, { size: 24, color: a(C.text, 0.35), tracking: 2 });
      ctx.restore();
    });

    // лёгкая «жизнь» фона сцены
    if (pp > 0) {
      for (let i = 0; i < 6; i++) {
        const k = (gt * 0.2 + hash11(i * 7.3)) % 1;
        ctx.save();
        ctx.globalAlpha *= 0.08 * (1 - k);
        icon(ctx, 'wrench', 1560 + Math.sin(i) * 120, 980 - k * 260, 30, C.h1, gt);
        ctx.restore();
      }
    }
  },
};
