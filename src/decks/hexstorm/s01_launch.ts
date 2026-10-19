/** Сцена 1. Релиз в Steam: страница игры, отзывы, скромная выручка. */

import { clamp01, easeOutCubic, easeOutQuart, seg } from '../../engine/anim.ts';
import { lineChart } from '../../engine/charts.ts';
import { corners, hexPath, panel, rrPath, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text, typewriter } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';

import type { Frame, SceneDef } from '../../engine/types.ts';

type Ctx = CanvasRenderingContext2D;

const REVENUE = [88, 132, 108, 165, 149, 186, 207];
const DAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

function storeCard(f: Frame, x: number, y: number, w: number, h: number, p: number, gt: number): void {
  const { ctx } = f;
  const e = easeOutQuart(clamp01(p));
  ctx.save();
  ctx.globalAlpha *= e;
  ctx.translate((1 - e) * 60, 0);

  const ch = h - 28;
  const lx = x + 44;
  const ly = y + ch * 0.5;

  f.obj('store', { x: x + w / 2, y: y + h / 2, abs: true, label: 'Карточка магазина' }, () => {
    if (e <= 0) return;
    panel(ctx, x, y, w, h, {
      fill: C.panel,
      stroke: a(C.h1, 0.26),
      lineWidth: 1.8,
      radius: 16,
      glow: a(C.h1, 0.1),
      glowBlur: 60,
    });

    // «капсула» магазина занимает карточку целиком
    ctx.save();
    rrPath(ctx, x + 14, y + 14, w - 28, ch, 12);
    ctx.clip();
    const g = ctx.createLinearGradient(x, y, x + w, y + ch);
    g.addColorStop(0, a(C.h1, 0.22));
    g.addColorStop(0.6, a(C.bg, 0.9));
    g.addColorStop(1, a(C.accent, 0.14));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, ch);
    ctx.strokeStyle = a(C.h1, 0.16);
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 26; i++) {
      const hx = x + ((i * 97 + gt * 9) % (w + 200)) - 60;
      const hy = y + 30 + ((i * 53) % (ch - 40));
      hexPath(ctx, hx, hy, 26 + (i % 3) * 12);
      ctx.stroke();
    }
    softLight(ctx, x + w * 0.28, y + ch * 0.4, 260, C.h1, 0.28);
    ctx.restore();

    // логотип на капсуле
    icon(ctx, 'arcadia', lx + 40, ly, 116, C.h1, gt);
  });

  f.obj('store-name', { x: lx + 106, y: ly - 4, abs: true, text: 'HEXSTORM', label: 'Название игры' }, (o) => {
    if (e <= 0) return;
    text(ctx, o.text, lx + 106, ly - 4, { size: 52, color: C.h1, tracking: 1.4 });
  });
  f.obj(
    'store-sub',
    { x: lx + 108, y: ly + 40, abs: true, text: 'Tears of Arcadia', label: 'Подзаголовок игры' },
    (o) => {
      if (e <= 0) return;
      text(ctx, o.text, lx + 108, ly + 40, { size: 32, color: C.accent, tracking: 2.4 });
    },
  );

  ctx.restore();
}

function reviewsPanel(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  p: number,
  gt: number,
  label: string,
): void {
  const e = easeOutQuart(clamp01(p));
  if (e <= 0) return;
  ctx.save();
  ctx.globalAlpha *= e;
  ctx.translate((1 - e) * 60, 0);
  panel(ctx, x, y, w, h, { fill: C.panel, stroke: a(C.pos, 0.24), radius: 16, lineWidth: 1.6 });

  for (let i = 0; i < 5; i++) {
    const sp = clamp01(easeOutCubic(clamp01(p * 1.6 - i * 0.12)));
    ctx.save();
    ctx.globalAlpha *= sp;
    icon(ctx, 'star', x + 42 + i * 52, y + 78, 40 * (0.6 + sp * 0.4), C.accent);
    ctx.restore();
  }

  text(ctx, label, x + 30, y + 158, { size: 52, color: C.pos, tracking: 0.6 });

  // строки-«отзывы»
  for (let i = 0; i < 3; i++) {
    const rp = clamp01(p * 2 - 0.6 - i * 0.2);
    if (rp <= 0) continue;
    const ry = y + 218 + i * 30;
    ctx.save();
    ctx.globalAlpha *= rp * 0.6;
    icon(ctx, 'thumb', x + 42, ry + 2, 20, a(C.pos, 0.8));
    ctx.fillStyle = a(C.text, 0.22);
    const bw = (w - 150) * (0.55 + ((i * 37) % 40) / 100);
    rrPath(ctx, x + 70, ry - 6, bw * clamp01(rp * 1.4), 10, 5);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha *= 0.4 + 0.2 * Math.sin(gt * 2);
  corners(ctx, x - 8, y - 8, w + 16, h + 16, 22, a(C.pos, 0.5), 2);
  ctx.restore();
  ctx.restore();
}

export const scene01: SceneDef = {
  id: 's01',

  render(f: Frame) {
    const { ctx, gt } = f;
    const c1 = f.cue('imagine');
    const c2 = f.cue('reviews');
    const c3 = f.cue('money');

    f.obj('title', { x: 150, y: 292, abs: true, text: c1.show, label: 'Заголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        292,
        { size: 104, color: C.h1, lineHeight: 1.0, maxWidth: 760, tracking: 0.5 },
        seg(c1.t, 0, 0.9),
        { stagger: 0.2, rise: 30 },
      );
    });

    storeCard(f, 1010, 170, 760, 320, seg(c1.t, 0.25, 0.8), gt);
    f.obj(
      'reviews',
      { x: 1390, y: 710, abs: true, text: 'хорошие отзывы', label: 'Панель отзывов' },
      (o) => {
        reviewsPanel(ctx, 1010, 550, 760, 320, seg(c2.t, 0, 0.8), gt, o.text);
      },
    );

    // блок выручки
    const rp = seg(c3.t, 0, 1.1);
    f.obj(
      'rev-label',
      { x: 150, y: 570, abs: true, text: 'выручка в день', label: 'Подпись графика' },
      (o) => {
        if (rp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= easeOutCubic(clamp01(rp * 3));
        text(ctx, o.text, 150, 570, { size: 26, color: a(C.text, 0.5), tracking: 2.4 });
        ctx.restore();
      },
    );

    f.obj('chart', { x: 500, y: 740, abs: true, label: 'График выручки' }, () => {
      if (rp <= 0) return;
      lineChart(ctx, {
        x: 150,
        y: 620,
        w: 700,
        h: 240,
        data: REVENUE,
        p: rp,
        color: C.h1,
        labels: DAYS,
        smooth: true,
        max: 260,
      });
    });

    f.obj(
      'rev-note',
      { x: 150, y: 960, abs: true, text: 'среднее для маленького инди', label: 'Вывод под графиком' },
      (o) => {
        if (rp <= 0) return;
        const vp = clamp01((rp - 0.55) / 0.45);
        ctx.save();
        ctx.globalAlpha *= vp;
        text(ctx, o.text, 150, 960, {
          size: 38,
          color: a(C.text, 0.6),
          tracking: 1.4,
        });
        ctx.restore();
      },
    );

    // подпись фразы внизу справа: сначала про отзывы, потом про выручку
    const capSt = { size: 34, color: a(C.accent, 0.8), align: 'right', tracking: 1.6 } as const;
    f.obj('cap-reviews', { x: 1770, y: 962, abs: true, text: c2.show, label: 'Титр: отзывы' }, (o) => {
      if (c3.began) return;
      typewriter(ctx, c2.began ? o.text : '', 1770, 962, capSt, seg(c2.t, 0, 0.5), gt, a(C.accent, 0.7));
    });
    f.obj('cap-money', { x: 1770, y: 962, abs: true, text: c3.show, label: 'Титр: выручка' }, (o) => {
      if (!c3.began) return;
      typewriter(ctx, o.text, 1770, 962, capSt, seg(c3.t, 0, 0.6), gt, a(C.accent, 0.7));
    });
  },
};
