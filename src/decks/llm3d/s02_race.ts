/**
 * Сцена 2. Флагманские модели «мучают» промптами, а потом меряются,
 * у кого круче, больше и сочнее.
 */

import { clamp01, easeInOutCubic, easeOutCubic, lerp, noise1, seg } from '../../engine/anim.ts';
import { rrPath, shockRing } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text, typewriter } from '../../engine/text.ts';
import { a, C, W } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import { modelCard, type P2 } from './common.ts';

const MODELS = [
  { name: 'ASTRA', color: C.accent },
  { name: 'FABLE', color: C.h1 },
];
const METERS = ['круче', 'больше', 'сочнее'];

/** Пока модели «мучают», карточки стоят по центру; к гонке поднимаются, освобождая место шкалам. */
const CARD = { w: 640, h: 250, yMid: 430, yTop: 270, gap: 80 };
const cardX = (i: number) => W / 2 - CARD.gap / 2 - CARD.w + i * (CARD.w + CARD.gap);

/** Промпты прилетают по очереди то в одну, то в другую модель. */
const HIT = { first: 0.8, every: 0.4, fly: 0.34, ring: 0.5, jolt: 0.45 };

export const scene02: SceneDef = {
  id: 's02',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cM = f.cue('models');
    const cR = f.cue('race');

    f.obj('title', { x: W / 2, y: 196, abs: true, text: cM.show, label: 'Заголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        W / 2,
        196,
        { size: 100, color: C.h1, align: 'center', tracking: 0.8 },
        seg(cM.t, 0, 0.6),
        { stagger: 0.22, rise: 28 },
      );
    });

    const cardY = lerp(CARD.yMid, CARD.yTop, easeInOutCubic(seg(cR.t, -0.35, 0.7)));

    // удары промптов: считаем, какие уже случились, и куда пришлись
    const hits = Math.max(0, Math.floor((cM.dur - HIT.first) / HIT.every));
    const jolt: P2[] = [
      [0, 0],
      [0, 0],
    ];
    for (let i = 0; i < hits; i++) {
      const side = i % 2;
      const at = HIT.first + i * HIT.every;
      const dir = side === 0 ? -1 : 1;

      const k = (cM.t - at) / HIT.jolt;
      if (k >= 0 && k <= 1) {
        const amp = Math.pow(1 - k, 2) * 18;
        jolt[side][0] += -dir * amp * Math.cos(k * 19);
        jolt[side][1] += amp * 0.4 * Math.sin(k * 23);
      }
    }

    // промпты и кольца от ударов рисуются вместе со «своей» карточкой:
    // стороны не пересекаются, поэтому порядок между ними не важен
    const drawHits = (side: number) => {
      for (let i = side; i < hits; i += 2) {
        const at = HIT.first + i * HIT.every;
        const dir = side === 0 ? -1 : 1;
        const edgeX = side === 0 ? cardX(0) : cardX(1) + CARD.w;
        const y = cardY + CARD.h * (0.3 + 0.4 * ((i * 0.37) % 1));

        // полёт
        const fly = seg(cM.t, at - HIT.fly, HIT.fly);
        if (fly > 0 && fly < 1) {
          const fromX = edgeX + dir * 420;
          const x = fromX + (edgeX - fromX) * fly * fly;
          ctx.save();
          ctx.globalAlpha *= clamp01(fly * 4);
          icon(ctx, 'chat', x, y, 62, a(C.text, 0.85), gt);
          ctx.restore();
        }
        shockRing(ctx, edgeX, y, seg(cM.t, at, HIT.ring), 110, MODELS[side].color, 3);
      }
    };

    MODELS.forEach((m, i) => {
      // опорная точка — центр карточки на её итоговом месте (после подъёма к гонке)
      f.obj(
        `card:${i}`,
        { x: cardX(i) + CARD.w / 2, y: CARD.yTop + CARD.h / 2, abs: true, text: m.name, label: `Карточка ${i + 1}` },
        (o) => {
          drawHits(i);
          modelCard(ctx, {
            x: cardX(i),
            y: cardY,
            w: CARD.w,
            h: CARD.h,
            name: o.text,
            color: m.color,
            p: seg(cM.t, 0.15 + i * 0.2, 0.55),
            jolt: jolt[i],
            t: gt,
          });
        },
      );
    });

    // «круче, больше, сочнее»: встречные шкалы, которые всё время обгоняют друг друга
    const maxLen = 560;
    METERS.forEach((label, i) => {
      const y = 640 + i * 104;
      f.obj(`meter:${i}`, { x: W / 2, y, abs: true, text: label, label: `Шкала ${i + 1}` }, (o) => {
        const rp = seg(cR.p, 0.1 + i * 0.12, 0.1);
        if (rp <= 0) return;
        const grow = easeOutCubic(seg(cR.p, 0.1 + i * 0.12, 0.22));
        const len = [0, 1].map(
          (s) => maxLen * grow * (0.66 + 0.3 * noise1(gt * 2.4 + i * 1.7, s * 5 + i * 3 + 1)),
        );
        const lead = len[0] > len[1] ? 0 : 1;

        ctx.save();
        ctx.globalAlpha *= rp;
        text(ctx, o.text, W / 2, y + 19, {
          size: 62,
          color: C.text,
          align: 'center',
          tracking: 1,
        });
        [0, 1].forEach((s) => {
          const dir = s === 0 ? -1 : 1;
          const x0 = W / 2 + dir * 170;
          const color = MODELS[s].color;
          const bx = dir < 0 ? x0 - len[s] : x0;
          ctx.fillStyle = a(C.text, 0.07);
          rrPath(ctx, dir < 0 ? x0 - maxLen : x0, y - 20, maxLen, 40, 20);
          ctx.fill();
          ctx.save();
          ctx.globalAlpha *= s === lead ? 1 : 0.55;
          ctx.shadowColor = a(color, 0.6);
          ctx.shadowBlur = s === lead ? 26 : 8;
          ctx.fillStyle = color;
          rrPath(ctx, bx, y - 20, Math.max(40, len[s]), 40, 20);
          ctx.fill();
          ctx.restore();
        });
        ctx.restore();
      });
    });

    f.obj('caption', { x: W / 2, y: 985, abs: true, text: cR.show, label: 'Подпись' }, (o) => {
      if (cR.p <= 0.5) return;
      typewriter(
        ctx,
        o.text,
        W / 2,
        985,
        { size: 68, color: C.accent, align: 'center', tracking: 1.4 },
        seg(cR.p, 0.52, 0.3),
        gt,
        a(C.accent, 0.8),
      );
    });
  },
};
