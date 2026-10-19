/** Сцена 35. Стена между «я не умею» и «я могу попробовать» — и вывод. */

import { clamp01, easeOutQuart, hash21, seg } from '../../engine/anim.ts';
import { divider, hexPath, rrPath, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { chip } from '../../engine/ui.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

type Ctx = CanvasRenderingContext2D;

const HARD = ['тысячи решений', 'сотни ошибок', 'работа и упорство', 'очень мало сна'];

const ROWS = 5;
const COLS = 4;
const BW = 150;
const BH = 52;
const GAP = 8;

/** Половина кирпичной стены; `dir` = −1 (левая) или 1 (правая). */
function wallHalf(ctx: Ctx, cx: number, cy: number, dir: number, open: number): void {
  const shift = dir * open * 300;
  ctx.save();
  ctx.translate(shift, 0);
  for (let r = 0; r < ROWS; r++) {
    const offset = r % 2 ? BW / 2 : 0;
    for (let c = 0; c < COLS; c++) {
      const bx =
        dir < 0
          ? cx - (c + 1) * (BW + GAP) + offset
          : cx + c * (BW + GAP) + GAP - offset;
      const by = cy - (ROWS * (BH + GAP)) / 2 + r * (BH + GAP);
      const tone = 0.06 + hash21(r, c * dir) * 0.06;
      ctx.fillStyle = a(C.text, tone);
      rrPath(ctx, bx, by, BW, BH, 5);
      ctx.fill();
      ctx.strokeStyle = a(C.text, 0.12);
      ctx.lineWidth = 1.2;
      rrPath(ctx, bx, by, BW, BH, 5);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export const scene35: SceneDef = {
  id: 's35',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cW = f.cue('wall');
    const cR = f.cue('rest');
    const cS = f.cue('skill');
    const cL = f.cue('limit');

    const wp = seg(cW.t, 0, 1.1);
    const rp = seg(cR.t, 0, 1.0);
    const sp = seg(cS.t, 0, 0.9);
    const lp = seg(cL.t, 0, 1.0);

    // верхний блок уходит, когда начинается вывод, но оставляет призрак стены
    // (fade не опускается ниже 0.14, так что блок рисуется всегда)
    const fade = 1 - clamp01(sp * 1.6) * 0.86;

    ctx.save();
    ctx.globalAlpha *= fade;

    const cx = 960;
    const cy = 470;
    const open = easeOutQuart(clamp01(wp * 1.5 - 0.25));

    f.obj('wall', { x: cx, y: cy, abs: true, label: 'Стена' }, () => {
      ctx.save();
      ctx.globalAlpha *= clamp01(wp * 3);
      wallHalf(ctx, cx - 30, cy, -1, open);
      wallHalf(ctx, cx + 30, cy, 1, open);
      ctx.restore();
    });

    // ИИ раздвигает стену
    f.obj('ai', { x: cx, y: cy, abs: true, text: 'ИИ', label: 'ИИ' }, (o) => {
      ctx.save();
      ctx.globalAlpha *= clamp01(wp * 2 - 0.3);
      softLight(ctx, cx, cy, 300 * (0.4 + open), C.h1, 0.2);
      hexPath(ctx, cx, cy, 92, Math.PI / 6);
      ctx.fillStyle = C.panel;
      ctx.fill();
      ctx.strokeStyle = a(C.h1, 0.75);
      ctx.lineWidth = 3;
      ctx.stroke();
      icon(ctx, 'robot', cx, cy, 82, C.h1, gt);
      text(ctx, o.text, cx, cy + 132, {
        size: 34,
        color: C.h1,
        align: 'center',
        tracking: 3,
      });
      ctx.restore();
    });

    // надписи по сторонам
    f.obj('cant', { x: 300, y: cy + 14, abs: true, text: '«я не умею»', label: 'Слева от стены' }, (o) => {
      ctx.save();
      ctx.globalAlpha *= clamp01(wp * 1.8 - 0.5);
      text(ctx, o.text, 300, cy + 14, {
        size: 52,
        color: a(C.text, 0.6),
        align: 'center',
        tracking: 1,
        maxWidth: 460,
      });
      ctx.restore();
    });
    f.obj('can', { x: 1640, y: cy + 14, abs: true, text: '«я могу попробовать»', label: 'Справа от стены' }, (o) => {
      ctx.save();
      ctx.globalAlpha *= clamp01(wp * 1.8 - 0.5);
      text(ctx, o.text, 1640, cy + 14, {
        size: 52,
        color: C.pos,
        align: 'center',
        tracking: 1,
        maxWidth: 500,
      });
      ctx.restore();
    });

    f.obj(
      'moves',
      { x: 960, y: 760, abs: true, text: 'ИИ не сделает игру за вас — он раздвигает стену', label: 'Подпись под стеной' },
      (o) => {
        ctx.save();
        ctx.globalAlpha *= clamp01(wp * 1.5 - 0.6);
        text(ctx, o.text, 960, 760, {
          size: 44,
          color: a(C.text, 0.7),
          align: 'center',
          tracking: 1,
        });
        ctx.restore();
      },
    );

    // а дальше всё по-старому
    f.obj('rest', { x: 960, y: 860, abs: true, text: 'а дальше — всё по-старому', label: 'Дальше по-старому' }, (o) => {
      if (rp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= easeOutQuart(rp);
      text(ctx, o.text, 960, 860, {
        size: 36,
        color: a(C.text, 0.5),
        align: 'center',
        tracking: 2.4,
      });
      ctx.restore();
    });
    HARD.forEach((h, i) => {
      const p = clamp01(rp * 1.9 - i * 0.18);
      f.obj(`hard:${i}`, { x: 340 + i * 420, y: 950, abs: true, text: h, label: `Трудность ${i + 1}` }, (o) => {
        if (p <= 0) return;
        chip(ctx, o.text, 340 + i * 420, 950, {
          color: i === 3 ? C.accent : C.h1,
          size: 28,
          align: 'center',
          p,
        });
      });
    });
    ctx.restore();

    // вывод
    if (sp > 0) {
      // свечение на весь кадр — не объект
      ctx.save();
      ctx.globalAlpha *= easeOutQuart(sp);
      softLight(ctx, 960, 520, 760, C.accent, 0.08);
      ctx.restore();
    }
    f.obj('skill:lead', { x: 960, y: 400, abs: true, text: 'сегодня отсутствие навыка', label: 'Вывод: начало' }, (o) => {
      if (sp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= easeOutQuart(sp);
      text(ctx, o.text, 960, 400, {
        size: 52,
        color: a(C.text, 0.6),
        align: 'center',
        tracking: 1.4,
      });
      ctx.restore();
    });
    f.obj('skill', { x: 960, y: 486, abs: true, text: 'уже не обязательно останавливает', label: 'Вывод' }, (o) => {
      if (sp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= easeOutQuart(sp);
      reveal(
        ctx,
        o.text,
        960,
        486,
        { size: 76, color: C.h1, align: 'center', tracking: 0.8 },
        clamp01(sp * 1.3),
        { stagger: 0.14, rise: 22 },
      );
      divider(ctx, 560, 528, 800, clamp01(sp * 1.6 - 0.4), a(C.h1, 0.35), 2);
      ctx.restore();
    });

    f.obj(
      'limit:lead',
      { x: 960, y: 660, abs: true, text: 'главное ограничение теперь не в том, что вы умеете,', label: 'Ограничение: начало' },
      (o) => {
        if (lp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(lp);
        text(ctx, o.text, 960, 660, {
          size: 52,
          color: a(C.text, 0.75),
          align: 'center',
          tracking: 0.8,
          maxWidth: 1560,
        });
        ctx.restore();
      },
    );
    f.obj(
      'limit',
      { x: 960, y: 790, abs: true, text: 'а в том, что вы готовы попробовать создать', label: 'Ограничение' },
      (o) => {
        if (lp <= 0) return;
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(lp);
        reveal(
          ctx,
          o.text,
          960,
          790,
          {
            size: 82,
            color: C.accent,
            align: 'center',
            tracking: 0.8,
            maxWidth: 1600,
            lineHeight: 1.12,
            glowColor: a(C.accent, 0.3),
            glowBlur: 30,
          },
          clamp01(lp * 1.3 - 0.15),
          { stagger: 0.12, rise: 24 },
        );
        ctx.restore();
      },
    );
  },
};
