/**
 * Сцена 4. Темы выпуска.
 * Не список, а серия полнокадровых шотов: каждый пункт занимает весь кадр,
 * въезжает, живёт со своей крупной анимацией и уезжает.
 */

import { clamp01, easeOutCubic, easeOutExpo, easeOutQuart, hash11, noise1, seg } from '../../engine/anim.ts';
import { hexPath, polyline, rrPath, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C, H, W } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

type Ctx = CanvasRenderingContext2D;
/** t — глобальное время (для «живого» движения), p — прогресс пункта 0..1. */
type Motif = (ctx: Ctx, t: number, p: number) => void;

// ---------------------------------------------------------------- мотивы

/** 1. Деньги за неделю: растущие столбцы и взлетающие доллары. */
const money: Motif = (ctx, t, p) => {
  const e = easeOutExpo(clamp01(p * 1.6));
  const base = 980;
  for (let i = 0; i < 7; i++) {
    const bp = clamp01(p * 3 - i * 0.16);
    if (bp <= 0) continue;
    const hgt = (140 + i * 92) * easeOutExpo(bp);
    const x = 210 + i * 240;
    const g = ctx.createLinearGradient(0, base - hgt, 0, base);
    g.addColorStop(0, a(C.accent, 0.55));
    g.addColorStop(1, a(C.accent, 0.04));
    ctx.fillStyle = g;
    rrPath(ctx, x, base - hgt, 168, hgt, [14, 14, 0, 0]);
    ctx.fill();
  }
  for (let i = 0; i < 22; i++) {
    const k = (t * 0.24 + hash11(i * 3.7)) % 1;
    ctx.save();
    ctx.globalAlpha *= e * (1 - k) * 0.5;
    const x = 160 + hash11(i * 8.1) * (W - 320) + noise1(t * 0.4, i) * 24;
    icon(ctx, 'money', x, H - k * 1000, 34 + hash11(i * 2.3) * 40, C.accent, t);
    ctx.restore();
  }
};

/** 2. Steam-календарь: сетка во весь кадр, по ней бежит волна подсветки. */
const calendar: Motif = (ctx, t, p) => {
  const cols = 10;
  const rows = 5;
  const cw = 176;
  const chh = 132;
  const gx = (W - cols * cw) / 2;
  const gy = 300;
  for (let i = 0; i < cols * rows; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const ip = clamp01(p * 2.4 - (col + row) * 0.045);
    if (ip <= 0) continue;
    const wave = Math.sin(col * 0.5 + row * 0.4 - t * 2.2);
    const hot = i === 34;
    const x = gx + col * cw;
    const y = gy + row * chh;
    ctx.save();
    ctx.globalAlpha *= easeOutQuart(ip);
    ctx.fillStyle = a(hot ? C.h1 : C.text, hot ? 0.2 : 0.03 + Math.max(0, wave) * 0.07);
    rrPath(ctx, x + 8, y + 8, cw - 16, chh - 16, 12);
    ctx.fill();
    ctx.strokeStyle = a(hot ? C.h1 : C.text, hot ? 0.9 : 0.1);
    ctx.lineWidth = hot ? 3 : 1.4;
    rrPath(ctx, x + 8, y + 8, cw - 16, chh - 16, 12);
    ctx.stroke();
    if (hot) {
      softLight(ctx, x + cw / 2, y + chh / 2, 220, C.h1, 0.3);
      icon(ctx, 'arcadia', x + cw / 2, y + chh / 2, 74, C.h1, t);
    }
    ctx.restore();
  }
};

/** 3. Подводные камни: под спокойной водой поднимаются тёмные глыбы. */
const rocks: Motif = (ctx, t, p) => {
  const e = easeOutCubic(clamp01(p * 1.4));
  const waterY = 560;
  const wave = (x: number) =>
    waterY + Math.sin(x * 0.005 + t * 1.4) * 8 + Math.sin(x * 0.012 - t * 0.8) * 4;

  ctx.save();
  ctx.globalAlpha *= e;

  // толща воды
  const g = ctx.createLinearGradient(0, waterY, 0, H);
  g.addColorStop(0, a(C.h1, 0.14));
  g.addColorStop(1, a(C.h1, 0.03));
  ctx.fillStyle = g;
  ctx.fillRect(0, waterY, W, H - waterY);

  // глыбы — только под водой, вершины подходят к самой поверхности
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, waterY, W, H - waterY);
  ctx.clip();
  for (let i = 0; i < 5; i++) {
    const rp = clamp01(p * 2.2 - i * 0.14);
    if (rp <= 0) continue;
    const rise = easeOutQuart(rp);
    const cx = 230 + i * 380 + noise1(t * 0.18, i) * 10;
    const wdt = 190 + hash11(i * 2.7) * 130;
    // чем ближе к поверхности, тем опаснее; один камень почти достаёт до воды
    const depth = (i === 2 ? 28 : 90 + hash11(i * 5.1) * 150) + (1 - rise) * 320;
    const top = waterY + depth;
    ctx.beginPath();
    ctx.moveTo(cx - wdt, H + 40);
    ctx.lineTo(cx - wdt * 0.62, top + 150);
    ctx.lineTo(cx - wdt * 0.2, top + 26);
    ctx.lineTo(cx + wdt * 0.06, top);
    ctx.lineTo(cx + wdt * 0.44, top + 96);
    ctx.lineTo(cx + wdt * 0.78, top + 60);
    ctx.lineTo(cx + wdt, H + 40);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.fill();
    ctx.strokeStyle = a(C.accent, i === 2 ? 0.6 : 0.3);
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }
  ctx.restore();

  // поверхность
  const pts: Array<[number, number]> = [];
  for (let x = 0; x <= W; x += 30) pts.push([x, wave(x)]);
  ctx.strokeStyle = a(C.h1, 0.7);
  ctx.lineWidth = 3;
  polyline(ctx, pts);
  ctx.stroke();

  // над водой всё спокойно
  const bx = 300 + ((t * 34) % (W + 400)) - 200;
  ctx.save();
  ctx.translate(bx, wave(bx) - 34);
  ctx.rotate(Math.sin(t * 1.2) * 0.06);
  icon(ctx, 'arcadia', 0, 0, 74, a(C.h1, 0.85), t);
  ctx.restore();
  ctx.restore();
};

/** 4. AI-хейтеры: налетающий рой минусов и падающая шкала рейтинга. */
const haters: Motif = (ctx, t, p) => {
  for (let i = 0; i < 26; i++) {
    const delay = hash11(i * 4.3) * 0.5;
    const ip = clamp01((p * 1.9 - delay) / 0.5);
    if (ip <= 0) continue;
    const e = easeOutQuart(ip);
    const ty = 200 + hash11(i * 7.9) * 640;
    // разлетаются по всему кадру, а не сбиваются в кучу у левого края
    const target = 140 + hash11(i * 1.9) * (W - 280);
    const x = W + 160 + (target - (W + 160)) * e;
    ctx.save();
    ctx.globalAlpha *= Math.min(1, ip * 2) * 0.85;
    ctx.translate(x, ty + noise1(t * 0.6, i) * 14);
    ctx.rotate(Math.PI + Math.sin(t * 2 + i) * 0.12);
    icon(ctx, 'thumb', 0, 0, 40 + hash11(i * 3.1) * 34, C.accent, t);
    ctx.restore();
  }
  // шкала рейтинга обваливается
  const bp = clamp01(p * 1.6 - 0.45);
  if (bp > 0) {
    const bx = 240;
    const bw = W - 480;
    ctx.save();
    ctx.globalAlpha *= bp;
    ctx.fillStyle = a(C.text, 0.08);
    rrPath(ctx, bx, 900, bw, 18, 9);
    ctx.fill();
    const k = 1 - 0.62 * easeOutExpo(bp);
    ctx.fillStyle = C.accent;
    rrPath(ctx, bx, 900, bw * k, 18, 9);
    ctx.fill();
    ctx.restore();
  }
};

/** 5. Бюджет на маркетинг: монеты пролетают мимо кошелька. */
const budget: Motif = (ctx, t, p) => {
  const e = easeOutQuart(clamp01(p * 1.5));
  ctx.save();
  ctx.globalAlpha *= e;
  softLight(ctx, W * 0.72, 560, 420, C.accent, 0.1);
  // кошелёк-контур
  const wx = W * 0.72;
  const wy = 560;
  hexPath(ctx, wx, wy, 190, Math.PI / 6);
  ctx.strokeStyle = a(C.accent, 0.5);
  ctx.lineWidth = 3;
  ctx.stroke();
  hexPath(ctx, wx, wy, 190 + 22 + Math.sin(t * 1.6) * 5, Math.PI / 6);
  ctx.strokeStyle = a(C.accent, 0.16);
  ctx.lineWidth = 1.6;
  ctx.stroke();
  icon(ctx, 'money', wx, wy, 150, a(C.accent, 0.8), t);
  ctx.restore();

  // падающие монеты
  for (let i = 0; i < 18; i++) {
    const k = (t * 0.36 + hash11(i * 6.1)) % 1;
    ctx.save();
    ctx.globalAlpha *= e * Math.sin(k * Math.PI) * 0.6;
    const cx = 180 + hash11(i * 2.9) * (W - 360);
    const cy = -80 + k * (H + 160);
    const r = 26 + hash11(i * 8.7) * 22;
    ctx.strokeStyle = a(C.accent, 0.75);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.62, r, Math.sin(t * 2 + i) * 0.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // стопка монет растёт слева
  const stack = Math.floor(clamp01(p * 1.6) * 8);
  for (let i = 0; i < stack; i++) {
    const cy = 900 - i * 54;
    const cx = 400 + Math.sin(i * 1.7) * 12;
    ctx.save();
    ctx.globalAlpha *= e;
    ctx.fillStyle = a(C.accent, 0.12);
    ctx.beginPath();
    ctx.ellipse(cx, cy, 112, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = a(C.accent, 0.6);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
};

/** 6. Самая сложная неделя: семь дней падают, поверх — рваная кривая. */
const week: Motif = (ctx, t, p) => {
  const base = 940;
  const stress = [0.22, 0.4, 0.34, 0.62, 0.78, 0.58, 0.96];
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 7; i++) {
    const ip = clamp01(p * 2.6 - i * 0.14);
    if (ip <= 0) continue;
    const e = easeOutExpo(ip);
    const x = 190 + i * 226;
    const hgt = 520 * stress[i] * e;
    const last = i === 6;
    ctx.save();
    ctx.globalAlpha *= Math.min(1, ip * 2);
    const g = ctx.createLinearGradient(0, base - hgt, 0, base);
    g.addColorStop(0, a(last ? C.accent : C.h1, 0.5));
    g.addColorStop(1, a(last ? C.accent : C.h1, 0.04));
    ctx.fillStyle = g;
    rrPath(ctx, x, base - hgt, 160, hgt, [12, 12, 0, 0]);
    ctx.fill();
    text(ctx, String(i + 1), x + 80, base + 54, {
      size: 40,
      family: 'mono',
      color: a(last ? C.accent : C.text, 0.5),
      align: 'center',
    });
    ctx.restore();
    pts.push([x + 80, base - hgt - 26 + Math.sin(t * 3 + i) * 4]);
  }
  if (pts.length > 1) {
    ctx.save();
    ctx.globalAlpha *= clamp01(p * 2 - 0.3);
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.shadowColor = a(C.accent, 0.5);
    ctx.shadowBlur = 18;
    polyline(ctx, pts);
    ctx.stroke();
    ctx.restore();
  }
};

// ---------------------------------------------------------------- сцена

const ITEMS: Array<{ cue: string; motif: Motif; color: string }> = [
  { cue: 'p1', motif: money, color: C.accent },
  { cue: 'p2', motif: calendar, color: C.h1 },
  { cue: 'p3', motif: rocks, color: C.h1 },
  { cue: 'p4', motif: haters, color: C.accent },
  { cue: 'p5', motif: budget, color: C.accent },
  { cue: 'p6', motif: week, color: C.h1 },
];

export const scene04: SceneDef = {
  id: 's04',

  render(f: Frame) {
    const { ctx, gt } = f;
    const intro = f.cue('intro');
    const first = f.cue('p1');

    // заставка «кроме того вы узнаете» — уезжает вверх с приходом первого пункта
    const introIn = seg(intro.t, 0, 0.8);
    const introOut = seg(first.t, -0.45, 0.45);
    f.obj('intro', { x: W / 2, y: 520, abs: true, text: intro.show, label: 'Заставка' }, (o) => {
      if (introOut >= 1) return;
      ctx.save();
      ctx.globalAlpha *= 1 - introOut;
      ctx.translate(0, -introOut * 220);
      softLight(ctx, W / 2, 460, 700, C.h1, 0.1);
      reveal(
        ctx,
        o.text,
        W / 2,
        520,
        { size: 150, color: C.h1, align: 'center', tracking: 0.8 },
        introIn,
        { stagger: 0.24, rise: 40 },
      );
      ctx.restore();
    });

    ITEMS.forEach((it, i) => {
      const c = f.cue(it.cue);
      const inP = seg(c.t, -0.2, 0.5);
      const outP = seg(c.t, c.dur - 0.35, 0.4);
      const vis = Math.min(inP, 1 - outP);
      // пункт вне своего времени не рисуется, но его объекты остаются в списке редактора
      const off = vis <= 0.001;

      const p = clamp01(c.t / Math.max(0.6, c.dur - 0.3));
      const slideIn = (1 - easeOutQuart(inP)) * 260;
      const slideOut = easeOutQuart(outP) * -300;

      ctx.save();
      ctx.globalAlpha *= vis;

      // мотив во весь кадр — с лёгким параллаксом
      ctx.save();
      ctx.translate((slideIn + slideOut) * 0.35, 0);
      f.obj(`motif:${i}`, { x: W / 2, y: H / 2, abs: true, label: `Пункт ${i + 1}: мотив` }, () => {
        if (off) return;
        it.motif(ctx, gt, p);
      });
      ctx.restore();

      // гигантский номер за текстом
      ctx.save();
      ctx.globalAlpha *= 0.07;
      ctx.translate((slideIn + slideOut) * 0.15, 0);
      f.obj(`num:${i}`, { x: W - 120, y: 400, abs: true, label: `Пункт ${i + 1}: номер` }, () => {
        if (off) return;
        text(ctx, `0${i + 1}`, W - 120, 400, {
          size: 460,
          family: 'mono',
          color: it.color,
          align: 'right',
        });
      });
      ctx.restore();

      // сама фраза
      ctx.save();
      ctx.translate(slideIn + slideOut, 0);
      const st = {
        size: 128,
        color: C.text,
        maxWidth: 1560,
        lineHeight: 1.02,
        tracking: 0.4,
      } as const;
      // подложка под текст, чтобы мотив его не съедал
      if (!off) {
        const grad = ctx.createLinearGradient(0, 120, 0, 430);
        grad.addColorStop(0, a(C.bg, 0));
        grad.addColorStop(0.35, a(C.bg, 0.78));
        grad.addColorStop(1, a(C.bg, 0));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 120, W, 310);
      }
      f.obj(
        `phrase:${i}`,
        { x: 150, y: 300, abs: true, text: c.show, label: `Пункт ${i + 1}: фраза` },
        (o) => {
          if (off) return;
          reveal(ctx, o.text, 150, 300, st, clamp01(inP * 1.4), { stagger: 0.13, rise: 34 });

          // акцентная черта
          ctx.fillStyle = it.color;
          rrPath(ctx, 150, 128, 340 * easeOutQuart(inP), 8, 4);
          ctx.fill();
        },
      );
      ctx.restore();

      ctx.restore();
    });
  },
};
