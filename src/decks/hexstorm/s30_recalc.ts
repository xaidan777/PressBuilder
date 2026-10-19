/** Сцена 30. Разгадка: Steam пересчитал 1 200 копий по новой цене. */

import { clamp01, easeOutExpo, easeOutQuart, fmtNum, seg } from '../../engine/anim.ts';
import { arrow, panel, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { chip } from '../../engine/ui.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

const BEFORE = 11137;
const AFTER = 9500;

const STEPS = [
  { icon: 'chart', title: '1 200 копий', sub: 'куплены по старой цене', color: C.h1 },
  { icon: 'refund', title: 'все в рефанд', sub: 'одним движением', color: C.accent },
  { icon: 'money', title: 'покупка заново', sub: 'по новой цене, одним днём', color: C.pos },
];

export const scene30: SceneDef = {
  id: 's30',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cRec = f.cue('recalc');
    const cH = f.cue('how');
    const cW = f.cue('warned');
    const cL = f.cue('loss');
    const cF = f.cue('fair');

    f.obj('title', { x: 150, y: 292, abs: true, text: cRec.show, label: 'Заголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        292,
        { size: 96, color: C.accent, tracking: 0.6, maxWidth: 1400 },
        seg(cRec.t, 0, 0.8),
        { stagger: 0.2, rise: 26 },
      );
    });

    // схема перерасчёта
    const hp = seg(cH.t, -0.1, 1.1);
    const w = 470;
    const gap = 90;
    const x0 = 960 - (w * 3 + gap * 2) / 2;
    STEPS.forEach((s, i) => {
      const p = clamp01(hp * 1.8 - i * 0.24);
      const e = easeOutQuart(p);
      const x = x0 + i * (w + gap);
      const y = 430;
      const h = 230;
      f.obj(
        `step:${i}`,
        { x: x + w / 2, y: y + h / 2, abs: true, text: s.title, label: `Шаг ${i + 1}` },
        (o) => {
          if (p <= 0) return;
          ctx.save();
          ctx.globalAlpha *= e;
          ctx.translate(0, (1 - e) * 26);
          panel(ctx, x, y, w, h, {
            fill: C.panel,
            stroke: a(s.color, 0.32),
            radius: 14,
            lineWidth: 1.8,
            accentBar: { color: s.color, width: 4 },
          });
          icon(ctx, s.icon, x + 78, y + h / 2, 62, s.color, gt);
          text(ctx, o.text, x + 140, y + 106, { size: 46, color: s.color, maxWidth: w - 170 });
          ctx.restore();
        },
      );
      f.obj(
        `step:${i}:sub`,
        { x: x + 140, y: y + 154, abs: true, text: s.sub, label: `Шаг ${i + 1}: подпись` },
        (o) => {
          if (p <= 0) return;
          ctx.save();
          ctx.globalAlpha *= e;
          ctx.translate(0, (1 - e) * 26);
          text(ctx, o.text, x + 140, y + 154, {
            size: 28,
            color: a(C.text, 0.55),
            maxWidth: w - 170,
            tracking: 1.2,
          });
          ctx.restore();
        },
      );

      if (i < STEPS.length - 1) {
        f.obj(`arrow:${i}`, { x: x + w + gap / 2, y: 545, abs: true, label: `Стрелка ${i + 1}` }, () => {
          if (p <= 0) return;
          arrow(ctx, x + w + 14, 545, x + w + gap - 14, 545, clamp01(hp * 1.8 - i * 0.24 - 0.16), {
            color: a(C.text, 0.4),
            width: 3,
            head: 14,
          });
        });
      }
    });

    // предупреждение поддержки
    const wp = seg(cW.t, 0, 0.7);
    f.obj(
      'warned',
      { x: 150, y: 730, abs: true, text: 'поддержка предупреждала: потеряешь пару тысяч', label: 'Предупреждение' },
      (o) => {
        if (wp <= 0) return;
        chip(ctx, o.text, 150, 730, {
          color: C.h1,
          size: 28,
          icon: 'chat',
          p: wp,
        });
      },
    );

    // 11 137 → 9 500
    const lp = seg(cL.t, 0, 1.0);
    const le = easeOutQuart(clamp01(lp * 1.4));
    f.obj('loss', { x: 505, y: 920, abs: true, label: 'Сумма до и после' }, () => {
      if (lp <= 0) return;
      const cur = BEFORE - (BEFORE - AFTER) * easeOutExpo(clamp01(lp * 1.2));
      ctx.save();
      ctx.globalAlpha *= le;
      softLight(ctx, 620, 880, 320, C.accent, 0.1);
      text(ctx, `$${fmtNum(BEFORE)}`, 150, 930, { size: 84, color: a(C.text, 0.4) });
      // перечёркиваем старую сумму
      ctx.strokeStyle = a(C.accent, 0.8);
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(150, 902);
      ctx.lineTo(150 + 300 * clamp01(lp * 2), 902);
      ctx.stroke();

      arrow(ctx, 500, 902, 590, 902, clamp01(lp * 2 - 0.4), {
        color: C.accent,
        width: 4,
        head: 18,
      });
      text(ctx, `$${fmtNum(cur)}`, 630, 930, {
        size: 96,
        color: C.accent,
        glowColor: a(C.accent, 0.35),
        glowBlur: 30,
      });
      text(ctx, `−$${fmtNum(BEFORE - AFTER)}`, 630, 986, {
        size: 34,
        color: a(C.text, 0.55),
        tracking: 1.4,
      });
      ctx.restore();
    });
    // подпись стоит выше сумм и с ними не пересекается
    f.obj('loss:label', { x: 150, y: 830, abs: true, text: 'gross за неделю', label: 'Подпись суммы' }, (o) => {
      if (lp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= le;
      text(ctx, o.text, 150, 830, { size: 28, color: a(C.text, 0.5), tracking: 2.2 });
      ctx.restore();
    });

    // зато честная цена
    const fp = seg(cF.t, 0, 0.9);
    f.obj('fair', { x: 1250, y: 890, abs: true, text: 'зато цена стала честной', label: 'Честная цена' }, (o) => {
      if (fp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= easeOutQuart(fp);
      icon(ctx, 'shield', 1180, 900, 64, C.pos, gt);
      reveal(
        ctx,
        o.text,
        1250,
        890,
        { size: 54, color: C.pos, tracking: 0.8, maxWidth: 520 },
        fp,
        { stagger: 0.18, rise: 18 },
      );
      ctx.restore();
    });
    f.obj(
      'fair:sub',
      { x: 1250, y: 950, abs: true, text: 'и должна оправдать себя в дальней перспективе', label: 'Честная цена: подпись' },
      (o) => {
        if (fp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(fp);
        text(ctx, o.text, 1250, 950, {
          size: 30,
          color: a(C.text, 0.55),
          maxWidth: 520,
          tracking: 1,
        });
        ctx.restore();
      },
    );
  },
};
