/** Сцена 28. Цена была высокой: совет ChatGPT, старт и снижение. */

import { clamp01, easeOutQuart, seg } from '../../engine/anim.ts';
import { panel, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { chip } from '../../engine/ui.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

interface TagOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  price: string;
  sub: string;
  note?: string;
  color: string;
  p: number;
  struck?: number;
  glow?: boolean;
}

/** Ценник: плашка с ценой — объект `id`, подписи под ценой — объекты `id:sub` и `id:note`. */
function priceTag(f: Frame, id: string, label: string, o: TagOpts): void {
  const { ctx } = f;
  const p = clamp01(o.p);
  const e = easeOutQuart(p);
  // общее для всех частей ценника появление: прозрачность и рост от центра плашки
  const enter = () => {
    ctx.globalAlpha *= e;
    ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
    ctx.scale(0.9 + e * 0.1, 0.9 + e * 0.1);
    ctx.translate(-o.w / 2, -o.h / 2);
  };

  f.obj(id, { x: o.x + o.w / 2, y: o.y + o.h / 2, abs: true, text: o.price, label }, (s) => {
    if (p <= 0) return;
    ctx.save();
    enter();

    if (o.glow) softLight(ctx, o.w / 2, o.h / 2, 260, o.color, 0.14);
    panel(ctx, 0, 0, o.w, o.h, {
      fill: C.panel,
      stroke: a(o.color, o.glow ? 0.55 : 0.28),
      radius: 16,
      lineWidth: o.glow ? 2.4 : 1.6,
    });

    text(ctx, s.text, o.w / 2, o.h * 0.55, {
      size: 96,
      color: o.color,
      align: 'center',
      glowColor: o.glow ? a(o.color, 0.35) : undefined,
      glowBlur: 30,
    });

    // зачёркивание идёт выше подписей и с ними не пересекается
    const st = clamp01(o.struck ?? 0);
    if (st > 0) {
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(46, o.h * 0.62);
      ctx.lineTo(46 + (o.w - 92) * easeOutQuart(st), o.h * 0.24);
      ctx.stroke();
    }
    ctx.restore();
  });

  f.obj(
    `${id}:sub`,
    { x: o.x + o.w / 2, y: o.y + o.h * 0.75, abs: true, text: o.sub, label: `${label}: подпись` },
    (s) => {
      if (p <= 0) return;
      ctx.save();
      enter();
      text(ctx, s.text, o.w / 2, o.h * 0.75, {
        size: 28,
        color: a(C.text, 0.55),
        align: 'center',
        tracking: 1.8,
        maxWidth: o.w - 40,
      });
      ctx.restore();
    },
  );

  if (o.note) {
    f.obj(
      `${id}:note`,
      { x: o.x + o.w / 2, y: o.y + o.h * 0.9, abs: true, text: o.note, label: `${label}: в рублях` },
      (s) => {
        if (p <= 0) return;
        ctx.save();
        enter();
        text(ctx, s.text, o.w / 2, o.h * 0.9, {
          size: 32,
          color: a(o.color, 0.85),
          align: 'center',
          tracking: 1.2,
        });
        ctx.restore();
      },
    );
  }
}

export const scene28: SceneDef = {
  id: 's28',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cC = f.cue('complaint');
    const cG = f.cue('gpt');
    const cCut = f.cue('cut');

    const cp = seg(cC.t, 0, 0.9);
    f.obj(
      'title',
      { x: 150, y: 292, abs: true, text: 'самая частая претензия — цена', label: 'Заголовок' },
      (o) => {
        reveal(
          ctx,
          o.text,
          150,
          292,
          { size: 88, color: C.accent, tracking: 0.6, maxWidth: 1400 },
          cp,
          { stagger: 0.18, rise: 26 },
        );
      },
    );

    const gp = seg(cG.t, 0, 0.9);
    const cutP = seg(cCut.t, 0, 1.0);

    const w = 440;
    const h = 270;
    const y = 440;
    const gap = 110;
    const x0 = 960 - (w * 3 + gap * 2) / 2;

    priceTag(f, 'tag:0', 'Ценник ChatGPT', {
      x: x0,
      y,
      w,
      h,
      price: '$14',
      sub: 'советовал ChatGPT',
      color: a(C.text, 0.6),
      p: gp,
      struck: clamp01(gp * 2 - 1),
    });
    priceTag(f, 'tag:1', 'Ценник на старте', {
      x: x0 + w + gap,
      y,
      w,
      h,
      price: '$10,99',
      sub: 'было на старте',
      note: '490 ₽',
      color: C.h1,
      p: Math.max(clamp01(gp * 1.6 - 0.4), cutP),
      struck: clamp01(cutP * 2 - 0.6),
    });
    priceTag(f, 'tag:2', 'Ценник новый', {
      x: x0 + (w + gap) * 2,
      y,
      w,
      h,
      price: '$8,99',
      sub: 'стало',
      note: '399 ₽',
      color: C.pos,
      p: clamp01(cutP * 1.7 - 0.4),
      glow: true,
    });

    // стрелки между ценниками
    const ax = 960 - w / 2 - gap / 2 + (w + gap);
    f.obj('arrow', { x: ax, y: y + h / 2, abs: true, label: 'Стрелка' }, () => {
      ctx.save();
      ctx.globalAlpha *= clamp01(cutP * 2 - 0.5);
      icon(ctx, 'refund', ax, y + h / 2, 44, a(C.accent, 0.7), gt);
      ctx.restore();
    });

    f.obj(
      'warn',
      { x: 960, y: 830, abs: true, text: 'во время скидки ценник менять нельзя', label: 'Предупреждение' },
      (o) => {
        if (cutP <= 0.2) return;
        chip(ctx, o.text, 960, 830, {
          color: C.accent,
          size: 28,
          icon: 'warning',
          align: 'center',
          p: clamp01((cutP - 0.2) / 0.5),
        });
      },
    );

    const fin = clamp01(cutP * 1.4 - 0.55);
    f.obj(
      'fin',
      { x: 960, y: 960, abs: true, text: 'снизил, как только появилась возможность', label: 'Подпись' },
      (o) => {
        if (fin <= 0) return;
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(fin);
        text(ctx, o.text, 960, 960, {
          size: 42,
          color: a(C.text, 0.75),
          align: 'center',
          tracking: 1.2,
        });
        ctx.restore();
      },
    );
  },
};
