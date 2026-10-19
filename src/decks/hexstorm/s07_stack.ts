/** Сцена 7. Это не один промпт: пример промпта, инструменты, документация, тесты. */

import { clamp01, easeOutBack, easeOutQuart, seg } from '../../engine/anim.ts';
import { panel, rrPath } from '../../engine/draw.ts';
import { reveal, text, wrap, type TextStyle } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

const PROMPTS = ['один промпт', 'не два', 'и не три'];

/** Пример промпта — печатается в рамке целиком. */
const PROMPT =
  'сделай , 3Д-экшон суть такова... Пользователь может играть лесными эльфами, ' +
  'охраной дворца и злодеем. И если пользователь играет эльфами то эльфы в лесу, ' +
  'домики деревяные набигают солдаты дворца и злодеи. Можно грабить корованы... ' +
  'И эльфу раз лесные то сделать так что там густой лес..';

const BOX = { x: 230, y: 300, w: 1460, h: 470 };

/** Панель промпта с посимвольной печатью и мигающим курсором. */
function promptBox(f: Frame, p: number, typed: number, gt: number): void {
  const { ctx } = f;
  const e = easeOutQuart(clamp01(p));
  ctx.save();
  ctx.globalAlpha *= e;
  ctx.translate(0, (1 - e) * 24);

  f.obj(
    'prompt-box',
    { x: BOX.x + BOX.w / 2, y: BOX.y + BOX.h / 2, abs: true, text: 'промпт', label: 'Рамка промпта' },
    (o) => {
      if (e <= 0) return;
      panel(ctx, BOX.x, BOX.y, BOX.w, BOX.h, {
        fill: C.panel,
        stroke: a(C.accent, 0.34),
        radius: 14,
        lineWidth: 1.8,
        accentBar: { color: C.accent, width: 4 },
      });
      text(ctx, o.text, BOX.x + 34, BOX.y + 52, {
        size: 26,
        color: a(C.accent, 0.85),
        tracking: 3,
      });
    },
  );

  f.obj(
    'prompt-text',
    { x: BOX.x + 38, y: BOX.y + 108, abs: true, text: PROMPT, label: 'Текст промпта' },
    (o) => {
      if (e <= 0) return;
      const st: TextStyle = {
        size: 38,
        family: 'mono',
        color: a(C.text, 0.9),
        maxWidth: BOX.w - 80,
        lineHeight: 1.38,
      };
      const lines = wrap(ctx, o.text, st);
      const step = st.size * 1.38;
      const n = Math.round(o.text.length * clamp01(typed));

      let consumed = 0;
      let caret: [number, number] | null = null;
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i];
        const y = BOX.y + 108 + i * step;
        if (consumed >= n) break;
        const visible = Math.min(ln.length, n - consumed);
        const shown = ln.slice(0, visible);
        const w = text(ctx, shown, BOX.x + 38, y, st);
        caret = [BOX.x + 38 + w + 6, y];
        consumed += ln.length + 1;
        if (visible < ln.length) break;
      }

      // курсор: мигает после окончания печати
      if (caret && (typed < 1 || Math.sin(gt * 6) > 0)) {
        ctx.fillStyle = C.accent;
        ctx.fillRect(caret[0], caret[1] - st.size * 0.82, 3, st.size * 0.92);
      }
    },
  );
  ctx.restore();
}

export const scene07: SceneDef = {
  id: 's07',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cP = f.cue('prompts');
    const cS = f.cue('stack');

    const p = seg(cP.t, 0, 1.0);

    f.obj('title', { x: 960, y: 210, abs: true, text: 'это не один промпт', label: 'Заголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        960,
        210,
        { size: 92, color: C.h1, align: 'center', tracking: 0.6 },
        seg(cP.t, 0, 0.6),
        { stagger: 0.2, rise: 26 },
      );
    });

    // три карточки «1 / 2 / 3», которые перечёркиваются и уступают место промпту
    const cardW = 320;
    const cardH = 230;
    const gap = 44;
    const totalW = cardW * 3 + gap * 2;
    const x0 = 960 - totalW / 2;
    const cardY = 300;
    const fade = 1 - clamp01((p - 0.5) / 0.2);

    PROMPTS.forEach((label, i) => {
      const cp = clamp01(p * 2.6 - i * 0.34);
      const x = x0 + i * (cardW + gap);
      f.obj(
        `card:${i}`,
        { x: x + cardW / 2, y: cardY + cardH / 2, abs: true, text: label, label: `Карточка ${i + 1}` },
        (o) => {
          if (fade <= 0.01 || cp <= 0) return;
          const e = easeOutBack(clamp01(cp));
          ctx.save();
          ctx.globalAlpha *= clamp01(cp) * fade;
          ctx.translate(x + cardW / 2, cardY + cardH / 2);
          ctx.scale(0.9 + e * 0.1, 0.9 + e * 0.1);
          ctx.translate(-cardW / 2, -cardH / 2);
          ctx.fillStyle = C.panel;
          rrPath(ctx, 0, 0, cardW, cardH, 14);
          ctx.fill();
          ctx.strokeStyle = a(C.accent, 0.32);
          ctx.lineWidth = 1.8;
          rrPath(ctx, 0, 0, cardW, cardH, 14);
          ctx.stroke();
          text(ctx, String(i + 1), cardW / 2, 128, {
            size: 110,
            color: a(C.accent, 0.9),
            align: 'center',
            family: 'mono',
          });
          text(ctx, o.text, cardW / 2, 186, {
            size: 34,
            color: a(C.text, 0.72),
            align: 'center',
            tracking: 1,
          });

          const strike = clamp01((p - 0.34 - i * 0.05) / 0.14);
          if (strike > 0) {
            ctx.strokeStyle = C.accent;
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(24, cardH - 30);
            ctx.lineTo(24 + (cardW - 48) * easeOutQuart(strike), 34);
            ctx.stroke();
          }
          ctx.restore();
        },
      );
    });

    // печатается настоящий промпт — с начала второй половины реплики и дальше
    const boxIn = clamp01((p - 0.56) / 0.18);
    // печать растянута на остаток реплики и начало следующей
    const typeFrom = cP.start + cP.dur * 0.6;
    const typeTo = cS.start + cS.dur * 0.55;
    promptBox(f, boxIn, clamp01((f.t - typeFrom) / (typeTo - typeFrom)), gt);
  },
};
