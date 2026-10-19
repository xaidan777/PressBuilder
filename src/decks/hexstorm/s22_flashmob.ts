/** Сцена 22. Почему восемь человек решают всё, и откуда они взялись. */

import { clamp01, easeOutQuart, hash11, seg } from '../../engine/anim.ts';
import { hexPath, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';

const TOTAL = 20;
const BAD = 8;

export const scene22: SceneDef = {
  id: 's22',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cM = f.cue('math');
    const cMob = f.cue('mob');

    const mp = seg(cM.t, 0, 1.0);

    f.obj('title', { x: 150, y: 282, abs: true, text: cM.show, label: 'Заголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        282,
        { size: 88, color: C.accent, tracking: 0.6, maxWidth: 700 },
        seg(cM.t, 0, 0.8),
        { stagger: 0.2, rise: 26 },
      );
    });

    // сетка отзывов: 12 положительных, 8 перекрашиваются в минус
    const cell = 104;
    const gx = 180;
    const gy = 430;
    f.obj('grid', { x: 388, y: 586, abs: true, label: 'Сетка отзывов' }, () => {
      for (let i = 0; i < TOTAL; i++) {
        const col = i % 5;
        const row = Math.floor(i / 5);
        const p = clamp01(mp * 2.2 - i * 0.045);
        if (p <= 0) continue;
        const isBad = i >= TOTAL - BAD;
        const flip = isBad ? clamp01(mp * 1.7 - 0.75 - (i - (TOTAL - BAD)) * 0.06) : 0;
        const col2 = flip > 0.5 ? C.accent : C.pos;
        const cx = gx + col * cell;
        const cy = gy + row * cell;
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(p);
        ctx.translate(cx, cy);
        ctx.rotate(flip * Math.PI * 0.06);
        hexPath(ctx, 0, 0, 42, Math.PI / 6);
        ctx.fillStyle = a(col2, 0.14);
        ctx.fill();
        ctx.strokeStyle = a(col2, 0.6);
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.save();
        if (flip > 0.5) ctx.rotate(Math.PI);
        icon(ctx, 'thumb', 0, 0, 34, col2);
        ctx.restore();
        ctx.restore();
      }
    });

    f.obj('ratio', { x: 180, y: 900, abs: true, text: '8 из 20', label: 'Число 8 из 20' }, (o) => {
      ctx.save();
      ctx.globalAlpha *= clamp01(mp * 1.6 - 0.7);
      text(ctx, o.text, 180, 900, { size: 84, color: C.accent });
      ctx.restore();
    });
    f.obj(
      'ratioNote',
      {
        x: 180,
        y: 954,
        abs: true,
        text: 'этого хватает, чтобы обрушить оценку',
        label: 'Подпись под числом',
      },
      (o) => {
        ctx.save();
        ctx.globalAlpha *= clamp01(mp * 1.6 - 0.7);
        text(ctx, o.text, 180, 954, {
          size: 32,
          color: a(C.text, 0.55),
          tracking: 1.2,
          maxWidth: 700,
        });
        ctx.restore();
      },
    );

    // источник флешмоба
    const mob = seg(cMob.t, 0, 1.1);
    f.obj('mob', { x: 1330, y: 560, abs: true, text: 'тред', label: 'Схема флешмоба' }, (o) => {
      if (mob <= 0) return;
      const cx = 1330;
      const cy = 560;
      ctx.save();
      ctx.globalAlpha *= clamp01(mob * 2);
      softLight(ctx, cx, cy, 380, C.accent, 0.1);
      ctx.restore();

      // центральный узел — «тред на ресурсе»
      const e = easeOutQuart(clamp01(mob * 1.6));
      ctx.save();
      ctx.globalAlpha *= e;
      hexPath(ctx, cx, cy, 118, Math.PI / 6);
      ctx.fillStyle = C.panel;
      ctx.fill();
      ctx.strokeStyle = a(C.accent, 0.6);
      ctx.lineWidth = 3;
      ctx.stroke();
      icon(ctx, 'chat', cx, cy - 10, 76, C.accent, gt);
      text(ctx, o.text, cx, cy + 62, {
        size: 30,
        color: a(C.text, 0.6),
        align: 'center',
        tracking: 2,
      });
      ctx.restore();

      // разлетающиеся участники
      for (let i = 0; i < BAD; i++) {
        const p = clamp01(mob * 2 - 0.5 - i * 0.08);
        if (p <= 0) continue;
        const ang = (Math.PI * 2 * i) / BAD + gt * 0.12;
        const r = 210 + hash11(i * 4.7) * 40;
        const px = cx + Math.cos(ang) * r * easeOutQuart(p);
        const py = cy + Math.sin(ang) * r * easeOutQuart(p);
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(p) * 0.9;
        ctx.strokeStyle = a(C.accent, 0.25);
        ctx.setLineDash([6, 8]);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.setLineDash([]);
        hexPath(ctx, px, py, 34, Math.PI / 6);
        ctx.fillStyle = C.bg;
        ctx.fill();
        ctx.strokeStyle = a(C.accent, 0.7);
        ctx.lineWidth = 2;
        ctx.stroke();
        icon(ctx, 'person', px, py, 34, C.accent, gt);
        ctx.restore();
      }
    });
  },
};
