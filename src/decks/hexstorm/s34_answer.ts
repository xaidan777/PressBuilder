/** Сцена 34. Проект окупился не деньгами — он ответил на главный вопрос. */

import { clamp01, easeOutQuart, hash11, seg } from '../../engine/anim.ts';
import { hexPath, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

export const scene34: SceneDef = {
  id: 's34',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cP = f.cue('paid');
    const cQ = f.cue('question');
    const cA = f.cue('alone');

    const pp = seg(cP.t, 0, 0.9);
    const qp = seg(cQ.t, 0, 0.9);
    const ap = seg(cA.t, 0, 1.0);

    // верхний блок уходит полностью, когда появляется «один против команды»
    const fade = 1 - clamp01(ap * 1.8);

    ctx.save();
    ctx.globalAlpha *= fade;
    f.obj('title', { x: 960, y: 330, abs: true, text: 'HEXSTORM уже окупился', label: 'Заголовок' }, (o) => {
      ctx.save();
      ctx.globalAlpha *= clamp01(pp * 2);
      softLight(ctx, 960, 360, 620, C.h1, 0.09);
      ctx.restore();

      reveal(
        ctx,
        o.text,
        960,
        330,
        { size: 96, color: C.h1, align: 'center', tracking: 0.8 },
        pp,
        { stagger: 0.22, rise: 28 },
      );
    });
    f.obj('notmoney', { x: 960, y: 424, abs: true, text: 'не деньгами', label: 'Подзаголовок' }, (o) => {
      ctx.save();
      ctx.globalAlpha *= clamp01(pp * 1.6 - 0.5);
      text(ctx, o.text, 960, 424, {
        size: 62,
        color: C.accent,
        align: 'center',
        tracking: 2,
      });
      ctx.restore();
    });

    f.obj(
      'answered',
      { x: 960, y: 560, abs: true, text: 'он ответил на вопрос, ради которого всё начиналось', label: 'Подпись' },
      (o) => {
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(qp);
        text(ctx, o.text, 960, 560, {
          size: 44,
          color: a(C.text, 0.65),
          align: 'center',
          tracking: 1.2,
        });
        ctx.restore();
      },
    );
    ctx.restore();

    // один против команды
    const e = easeOutQuart(clamp01(ap * 1.5));
    const lx = 620;
    const ly = 540;
    const tx = 1330;

    // одиночка
    f.obj('solo', { x: lx, y: ly, abs: true, text: 'один человек', label: 'Одиночка' }, (o) => {
      if (ap <= 0) return;
      ctx.save();
      ctx.globalAlpha *= e;
      softLight(ctx, lx, ly, 260, C.h1, 0.14);
      hexPath(ctx, lx, ly, 96, Math.PI / 6);
      ctx.fillStyle = C.panel;
      ctx.fill();
      ctx.strokeStyle = a(C.h1, 0.7);
      ctx.lineWidth = 3;
      ctx.stroke();
      icon(ctx, 'person', lx, ly, 84, C.h1, gt);
      text(ctx, o.text, lx, ly + 214, {
        size: 36,
        color: C.h1,
        align: 'center',
        tracking: 1.4,
      });
      ctx.restore();
    });

    f.obj('instead', { x: 960, y: ly + 14, abs: true, text: 'вместо', label: '«Вместо»' }, (o) => {
      if (ap <= 0) return;
      ctx.save();
      ctx.globalAlpha *= e;
      text(ctx, o.text, 960, ly + 14, {
        size: 44,
        color: a(C.text, 0.45),
        align: 'center',
        tracking: 2,
      });
      ctx.restore();
    });

    // команда
    f.obj('team', { x: tx, y: ly, abs: true, text: 'целой команды', label: 'Команда' }, (o) => {
      if (ap <= 0) return;
      ctx.save();
      ctx.globalAlpha *= e;
      for (let i = 0; i < 9; i++) {
        const p = clamp01(ap * 2 - 0.4 - i * 0.05);
        if (p <= 0) continue;
        const col = i % 3;
        const row = Math.floor(i / 3);
        const hx = tx - 110 + col * 110;
        const hy = ly - 100 + row * 100 + (col % 2 ? 12 : 0);
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(p) * 0.85;
        hexPath(ctx, hx, hy, 46 * (0.9 + hash11(i) * 0.1), Math.PI / 6);
        ctx.fillStyle = a(C.accent, 0.1);
        ctx.fill();
        ctx.strokeStyle = a(C.accent, 0.5);
        ctx.lineWidth = 2;
        ctx.stroke();
        icon(ctx, 'person', hx, hy, 40, a(C.accent, 0.8), gt);
        ctx.restore();
      }
      text(ctx, o.text, tx, ly + 214, {
        size: 36,
        color: C.accent,
        align: 'center',
        tracking: 1.4,
      });
      ctx.restore();
    });

    f.obj(
      'question',
      {
        x: 960,
        y: 900,
        abs: true,
        text: 'может ли сегодня один человек сделать то,\nдля чего раньше нужна была целая команда?',
        label: 'Главный вопрос',
      },
      (o) => {
        if (ap <= 0) return;
        ctx.save();
        ctx.globalAlpha *= clamp01(ap * 1.6 - 0.5);
        reveal(
          ctx,
          o.text,
          960,
          900,
          {
            size: 54,
            color: C.text,
            align: 'center',
            tracking: 0.8,
            lineHeight: 1.18,
            maxWidth: 1500,
          },
          clamp01(ap * 1.6 - 0.5),
          { stagger: 0.1, rise: 18 },
        );
        ctx.restore();
      },
    );
  },
};
