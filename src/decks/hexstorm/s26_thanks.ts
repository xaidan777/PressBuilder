/** Сцена 26. Ноль маркетинга, весь трафик — от зрителей. Благодарность. */

import { clamp01, easeOutQuart, hash11, seg } from '../../engine/anim.ts';
import { arrow, hexPath, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

const SOURCES = [
  { icon: 'youtube', label: 'YouTube', color: C.accent },
  { icon: 'telegram', label: 'Telegram', color: C.h1 },
  { icon: 'steam', label: 'Steam', color: C.pos },
];

export const scene26: SceneDef = {
  id: 's26',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cG = f.cue('good');
    const cN = f.cue('nomarket');
    const cY = f.cue('you');
    const cT = f.cue('thanks');
    const cF = f.cue('final');

    const gp = seg(cG.t, 0, 0.8);
    const np = seg(cN.t, 0, 0.9);
    const yp = seg(cY.t, 0, 0.9);
    const tp = seg(cT.t, 0, 1.0);
    const fp = seg(cF.t, 0, 1.0);

    // на финальной реплике верхний блок уходит полностью — экран остаётся под «спасибо»
    const dim = 1 - clamp01(fp * 2.4);

    ctx.save();
    ctx.globalAlpha *= dim;

    f.obj('title', { x: 150, y: 280, abs: true, text: cG.show, label: 'Заголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        280,
        { size: 84, color: C.pos, tracking: 0.6 },
        gp,
        { stagger: 0.2, rise: 26 },
      );
    });

    // ноль маркетинга
    f.obj('zero', { x: 150, y: 600, abs: true, text: '0', label: 'Ноль' }, (o) => {
      if (np <= 0) return;
      const e = easeOutQuart(np);
      ctx.save();
      ctx.globalAlpha *= e;
      softLight(ctx, 330, 520, 300, C.accent, 0.12);
      text(ctx, o.text, 150, 600, {
        size: 220,
        color: C.accent,
        glowColor: a(C.accent, 0.35),
        glowBlur: 34,
      });
      ctx.restore();
    });
    f.obj(
      'zeroLabel',
      { x: 150, y: 668, abs: true, text: 'внешнего маркетинга', label: 'Подпись нуля' },
      (o) => {
        if (np <= 0) return;
        const e = easeOutQuart(np);
        ctx.save();
        ctx.globalAlpha *= e;
        text(ctx, o.text, 150, 668, {
          size: 46,
          color: a(C.text, 0.7),
          tracking: 1.2,
        });
        ctx.restore();
      },
    );

    // источники трафика → проект
    const cx = 1480;
    const cy = 520;
    SOURCES.forEach((s, i) => {
      const p = clamp01(Math.max(yp, tp) * 1.8 - i * 0.2);
      const e = easeOutQuart(p);
      const sx = 1010;
      const sy = 320 + i * 200;
      f.obj(
        `source:${i}`,
        { x: sx, y: sy, abs: true, text: s.label, label: `Источник: ${s.label}` },
        (o) => {
          if (yp <= 0 || p <= 0) return;
          ctx.save();
          ctx.globalAlpha *= e;
          hexPath(ctx, sx, sy, 62, Math.PI / 6);
          ctx.fillStyle = C.panel;
          ctx.fill();
          ctx.strokeStyle = a(s.color, 0.6);
          ctx.lineWidth = 2.4;
          ctx.stroke();
          icon(ctx, s.icon, sx, sy, 56, s.color, gt);
          text(ctx, o.text, sx, sy + 96, {
            size: 28,
            color: a(s.color, 0.85),
            align: 'center',
            tracking: 1.6,
            caps: 'normal',
          });
          ctx.restore();
        },
      );

      // бегущий импульс к проекту
      f.obj(
        `link:${i}`,
        {
          x: (sx + 80 + cx - 130) / 2,
          y: (sy + cy + (sy - cy) * 0.12) / 2,
          abs: true,
          label: `Стрелка: ${s.label}`,
        },
        () => {
          if (yp <= 0 || p <= 0) return;
          arrow(ctx, sx + 80, sy, cx - 130, cy + (sy - cy) * 0.12, clamp01(p * 1.4 - 0.3), {
            color: a(s.color, 0.55),
            width: 2.5,
            head: 14,
            dash: [8, 10],
          });
          const k = (gt * 0.5 + i / 3) % 1;
          ctx.save();
          ctx.globalAlpha *= e * (1 - Math.abs(k - 0.5) * 1.4);
          ctx.fillStyle = s.color;
          ctx.beginPath();
          ctx.arc(
            sx + 80 + (cx - 210 - sx) * k,
            sy + (cy + (sy - cy) * 0.12 - sy) * k,
            6,
            0,
            Math.PI * 2,
          );
          ctx.fill();
          ctx.restore();
        },
      );
    });

    f.obj('project', { x: cx, y: cy, abs: true, text: 'HEXSTORM', label: 'Проект' }, (o) => {
      if (yp <= 0) return;
      const e = easeOutQuart(clamp01(yp * 1.5));
      ctx.save();
      ctx.globalAlpha *= e;
      softLight(ctx, cx, cy, 260, C.h1, 0.16);
      hexPath(ctx, cx, cy, 128, Math.PI / 6);
      ctx.fillStyle = C.panel;
      ctx.fill();
      ctx.strokeStyle = a(C.h1, 0.7);
      ctx.lineWidth = 3;
      ctx.stroke();
      icon(ctx, 'arcadia', cx, cy - 20, 130, C.h1, gt);
      text(ctx, o.text, cx, cy + 76, {
        size: 34,
        color: C.h1,
        align: 'center',
        tracking: 1.6,
      });
      ctx.restore();
    });

    f.obj(
      'traffic',
      { x: 1280, y: 940, abs: true, text: 'весь внешний трафик — это вы', label: 'Весь трафик' },
      (o) => {
        if (tp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(tp);
        // подпись под диаграммой источников, а не поверх неё
        text(ctx, o.text, 1280, 940, {
          size: 46,
          color: C.text,
          align: 'center',
          tracking: 1,
        });
        ctx.restore();
      },
    );
    ctx.restore();

    // финал
    const fe = easeOutQuart(fp);
    if (fp > 0) {
      ctx.save();
      ctx.globalAlpha *= fe;
      softLight(ctx, 960, 540, 780, C.accent, 0.14);
      ctx.restore();
    }
    f.obj(
      'thanks',
      { x: 960, y: 520, abs: true, text: 'спасибо, что верите', label: 'Спасибо' },
      (o) => {
        if (fp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= fe;
        text(ctx, o.text, 960, 520, {
          size: 150,
          color: C.accent,
          align: 'center',
          tracking: 1,
          glowColor: a(C.accent, 0.4),
          glowBlur: 44,
        });
        ctx.restore();
      },
    );
    f.obj(
      'thanksSub',
      { x: 960, y: 640, abs: true, text: 'и поддерживаете проект', label: 'Спасибо: строка 2' },
      (o) => {
        if (fp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= fe;
        text(ctx, o.text, 960, 640, {
          size: 76,
          color: C.text,
          align: 'center',
          tracking: 1.4,
        });
        ctx.restore();
      },
    );

    // сердечки
    if (fp > 0) {
      for (let i = 0; i < 14; i++) {
        const k = (gt * 0.22 + hash11(i * 3.7)) % 1;
        const p = clamp01(fp * 2 - hash11(i * 5.3) * 0.6);
        if (p <= 0) continue;
        ctx.save();
        ctx.globalAlpha *= p * (1 - k) * 0.5;
        const hx = 260 + hash11(i * 9.1) * 1400 + Math.sin(gt + i) * 26;
        icon(ctx, 'heart', hx, 1060 - k * 560, 22 + hash11(i * 2.2) * 22, C.accent, gt);
        ctx.restore();
      }
    }
  },
};
