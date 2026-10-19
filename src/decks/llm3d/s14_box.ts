/**
 * Сцена 14. Из коробки: из открытой коробки поднимаются два скромных ползунка,
 * а следом вылетают скиллы — LLM ловит их и подключает вокруг себя инструменты.
 */

import { clamp01, easeInOutCubic, easeOutBack, easeOutQuart, seg } from '../../engine/anim.ts';
import { hexPath, rrPath, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C, mix } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import { depthOf, project, type V3, type View } from '../../engine/wire3d.ts';
import { bez, botHex, flow, skillCard, type P2 } from './common.ts';

type Ctx = CanvasRenderingContext2D;

const HALF = { x: 0.62, y: 0.42, z: 0.62 };
const CARDBOARD = C.accent;
const DARK = '#15171b';

/** Четыре стенки: пары углов (x, z) и нормаль наружу. */
const WALLS: Array<{ a: [number, number]; b: [number, number]; n: [number, number] }> = [
  { a: [-1, -1], b: [1, -1], n: [0, -1] },
  { a: [1, -1], b: [1, 1], n: [1, 0] },
  { a: [1, 1], b: [-1, 1], n: [0, 1] },
  { a: [-1, 1], b: [-1, -1], n: [-1, 0] },
];

function quad(ctx: Ctx, view: View, pts: V3[], fill: string, stroke: string): void {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const [x, y] = project(p, view);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/**
 * Открытая коробка в два приёма. `back` — дно, дальние стенки и клапаны; затем сцена
 * рисует то, что вылезает изнутри, — и только потом `front`, ближние стенки: они его перекрывают.
 */
function openBox(ctx: Ctx, view: View, flaps: number, part: 'back' | 'front'): void {
  const edge = mix(CARDBOARD, DARK, 0.2);
  const walls = WALLS.map((w) => {
    const mid: V3 = [w.n[0] * HALF.x, 0, w.n[1] * HALF.z];
    return { ...w, front: depthOf(mid, view) > depthOf([0, 0, 0], view) };
  });
  const corner = (c: [number, number], y: number): V3 => [c[0] * HALF.x, y, c[1] * HALF.z];

  const wall = (w: (typeof walls)[number]) => {
    const tone = w.front ? (w.n[0] !== 0 ? 0.3 : 0.42) : 0.68;
    quad(
      ctx,
      view,
      [corner(w.a, -HALF.y), corner(w.b, -HALF.y), corner(w.b, HALF.y), corner(w.a, HALF.y)],
      mix(CARDBOARD, DARK, tone),
      edge,
    );
  };
  const flap = (w: (typeof walls)[number]) => {
    const out = 0.52 * flaps;
    const drop = HALF.y - 0.16 * flaps + 0.36 * (1 - flaps);
    const lift = (c: [number, number]): V3 => [
      c[0] * HALF.x + w.n[0] * out,
      drop,
      c[1] * HALF.z + w.n[1] * out,
    ];
    quad(
      ctx,
      view,
      [corner(w.a, HALF.y), corner(w.b, HALF.y), lift(w.b), lift(w.a)],
      mix(CARDBOARD, DARK, w.front ? 0.18 : 0.5),
      edge,
    );
  };

  if (part === 'front') {
    walls.filter((w) => w.front).forEach((w) => (wall(w), flap(w)));
    return;
  }
  quad(
    ctx,
    view,
    WALLS.map((w) => corner(w.a, -HALF.y)),
    mix(CARDBOARD, DARK, 0.8),
    edge,
  );
  walls.filter((w) => !w.front).forEach((w) => (wall(w), flap(w)));
}

const BOT: P2 = [1330, 540];
const RING = 270;
const TOOLS = ['wrench', 'eye', 'chart', 'sliders', 'globe', 'plug'];
const KNOBS = [
  { label: 'рендер', v: 0.28, y: 470 },
  { label: 'экспорт', v: 0.2, y: 580 },
];

export const scene14: SceneDef = {
  id: 's14',

  energy: (_t, cue) => 0.5 * seg(cue('tools').p, 0.5, 0.4),

  render(f: Frame) {
    const { ctx, gt } = f;
    const cM = f.cue('modest');
    const cT = f.cue('tools');

    f.obj('title', { x: 150, y: 210, abs: true, text: 'из коробки', label: 'Заголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        210,
        { size: 116, color: C.h1, tracking: 0.6 },
        seg(cM.t, 0, 0.6),
        { stagger: 0.26, rise: 30 },
      );
    });
    f.obj('subtitle', { x: 150, y: 300, abs: true, text: cM.show, label: 'Подзаголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        300,
        { size: 56, color: a(C.text, 0.75), tracking: 0.8, maxWidth: 760, lineHeight: 1.12 },
        seg(cM.p, 0.3, 0.4),
        { stagger: 0.1, rise: 18 },
      );
    });

    const view: View = {
      cx: 470,
      cy: 850,
      size: 330,
      pitch: 0.52,
      yaw: 0.72 + Math.sin(gt * 0.6) * 0.06,
      dist: 6,
    };
    const mouth = project([0, 0.1, 0], view);
    const boxIn = seg(cM.t, 0, 0.6);
    const flaps = easeOutBack(seg(cM.t, 0.35, 0.6), 1.4);

    // общее появление коробки и её содержимого — снаружи, объекты внутри
    ctx.save();
    ctx.globalAlpha *= clamp01(boxIn * 2);
    ctx.translate(0, (1 - easeOutBack(boxIn, 1.2)) * 80);

    f.obj('box', { x: view.cx, y: view.cy, abs: true, label: 'Коробка' }, () => {
      softLight(ctx, 470, 800, 420, C.accent, 0.1);
      openBox(ctx, view, flaps, 'back');
      // свет из коробки, когда из неё что-то выходит
      const glowUp = Math.max(seg(cM.p, 0.2, 0.2), seg(cT.p, 0, 0.1));
      softLight(ctx, mouth[0], mouth[1] - 40, 260, C.accent, 0.22 * glowUp);
    });

    // скромные настройки: два коротких ползунка
    KNOBS.forEach((k, i) => {
      f.obj(`knob:${i}`, { x: 250, y: k.y + 16, abs: true, text: k.label, label: `Ползунок ${i + 1}` }, (o) => {
        const p = easeOutQuart(seg(cM.p, 0.42 + i * 0.14, 0.24));
        if (p <= 0) return;
        const y = mouth[1] + (k.y - mouth[1]) * p;
        const dim = 1 - 0.55 * seg(cT.t, 0, 0.5);
        ctx.save();
        ctx.globalAlpha *= Math.min(1, p * 2) * dim;
        text(ctx, o.text, 250, y + 16, { size: 52, color: C.text, tracking: 1 });
        ctx.fillStyle = a(C.text, 0.14);
        rrPath(ctx, 470, y - 6, 220, 12, 6);
        ctx.fill();
        ctx.fillStyle = a(C.h1, 0.85);
        rrPath(ctx, 470, y - 6, 220 * k.v, 12, 6);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(470 + 220 * k.v, y, 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    });

    // скиллы вылетают из коробки и по дуге уходят к LLM
    f.obj('skills', { x: 900, y: 450, abs: true, label: 'Летящие скиллы' }, () => {
      for (let i = 0; i < 7; i++) {
        const p = seg(cT.p, 0.03 + i * 0.055, 0.3);
        if (p <= 0 || p >= 1) continue;
        const k = easeInOutCubic(p);
        const [x, y] = bez([mouth[0], mouth[1]], [760 + i * 30, 120 + i * 24], BOT, k);
        skillCard(ctx, x, y, 120 * (0.55 + 0.7 * Math.sin(k * Math.PI)), {
          rot: (i % 2 ? -1 : 1) * (0.3 + k * 1.6),
          alpha: Math.min(1, p * 5) * (1 - clamp01((p - 0.85) / 0.15)),
        });
      }
    });

    // ближние стенки — отдельным объектом поверх: они перекрывают то, что вылезает из коробки
    f.obj('box-front', { x: view.cx, y: view.cy, abs: true, label: 'Коробка: ближние стенки' }, () => {
      openBox(ctx, view, flaps, 'front');
    });
    ctx.restore();

    // ---- LLM и инструменты вокруг
    TOOLS.forEach((tool, i) => {
      const ang = -Math.PI / 2 + (Math.PI / 3) * i;
      const toolAt = { x: BOT[0] + Math.cos(ang) * RING, y: BOT[1] + Math.sin(ang) * RING };
      f.obj(`tool:${i}`, { ...toolAt, abs: true, label: `Инструмент ${i + 1}` }, () => {
        const p = seg(cT.p, 0.5 + i * 0.07, 0.12);
        if (p <= 0) return;
        const dist = RING * (1 + 0.5 * (1 - easeOutBack(p, 1.6)));
        const x = BOT[0] + Math.cos(ang) * dist;
        const y = BOT[1] + Math.sin(ang) * dist;
        flow(ctx, BOT, [(BOT[0] + x) / 2, (BOT[1] + y) / 2], [x, y], {
          t: gt + i * 0.21,
          color: C.pos,
          p: clamp01(p * 1.5),
          n: 2,
          speed: 0.9,
          width: 3.5,
          lineAlpha: 0.55,
        });
        ctx.save();
        ctx.globalAlpha *= Math.min(1, p * 3);
        hexPath(ctx, x, y, 60, Math.PI / 6);
        ctx.fillStyle = C.panel;
        ctx.fill();
        ctx.strokeStyle = a(C.pos, 0.8);
        ctx.lineWidth = 2.6;
        ctx.stroke();
        icon(ctx, tool, x, y, 56, C.pos, gt);
        ctx.restore();
      });
    });

    f.obj('llm', { x: BOT[0], y: BOT[1], abs: true, text: 'LLM', label: 'LLM' }, (o) => {
      botHex(ctx, BOT[0], BOT[1], {
        r: 104,
        color: C.h1,
        p: seg(cT.t, 0, 0.5),
        t: gt,
        label: o.text,
        labelSize: 52,
        glow: seg(cT.p, 0.2, 0.4),
      });
    });

    f.obj('caption', { x: BOT[0], y: 965, abs: true, text: cT.show, label: 'Подпись' }, (o) => {
      reveal(
        ctx,
        o.text,
        BOT[0],
        965,
        { size: 52, color: C.pos, align: 'center', tracking: 1 },
        seg(cT.p, 0.55, 0.3),
        { stagger: 0.12, rise: 18 },
      );
    });
  },
};
