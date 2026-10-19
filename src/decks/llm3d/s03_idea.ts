/** Сцена 3. Запутанная линия распрямляется в стрелку — и приводит к 3D-движку. */

import { clamp01, easeInOutCubic, easeOutQuart, lerp, seg } from '../../engine/anim.ts';
import { shockRing, softLight } from '../../engine/draw.ts';
import { reveal } from '../../engine/text.ts';
import { a, C, mix } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import { drawSolid, drawWire, MESH, type View } from '../../engine/wire3d.ts';

type Ctx = CanvasRenderingContext2D;

const LINE = { x0: 150, x1: 1090, y: 440 };
const CUBE = { x: 1450, y: 560 };

/** Клубок: чем меньше `s`, тем сильнее петли. При s = 1 — прямая. */
function tangle(ctx: Ctx, draw: number, s: number): void {
  const n = 160;
  const mess = 1 - s;
  const last = Math.floor(n * clamp01(draw));
  ctx.beginPath();
  for (let i = 0; i <= last; i++) {
    const k = i / n;
    // петли затухают к концам, чтобы линия начиналась и кончалась в своих точках
    const env = Math.sin(k * Math.PI) * mess;
    const x = lerp(LINE.x0, LINE.x1, k) + Math.sin(k * 31) * 120 * env + Math.cos(k * 13) * 60 * env;
    const y = LINE.y + Math.sin(k * 23 + 1) * 96 * env + Math.cos(k * 41) * 44 * env;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.stroke();
}

export const scene03: SceneDef = {
  id: 's03',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cS = f.cue('simplify');
    const cE = f.cue('engine');

    f.obj('title', { x: 150, y: 250, abs: true, text: cS.show, label: 'Заголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        250,
        { size: 104, color: C.text, tracking: 0.6 },
        seg(cS.t, 0, 0.6),
        { stagger: 0.24, rise: 28 },
      );
    });

    // клубок вычерчивается, затем распрямляется в стрелку
    const draw = seg(cS.t, 0, cS.dur * 0.45);
    const straight = easeInOutCubic(seg(cS.t, cS.dur * 0.45, cS.dur * 0.5));
    f.obj('line', { x: (LINE.x0 + LINE.x1) / 2, y: LINE.y, abs: true, label: 'Линия-стрелка' }, () => {
      if (draw <= 0) return;
      ctx.save();
      ctx.strokeStyle = mix(C.accent, C.pos, straight);
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = a(straight > 0.5 ? C.pos : C.accent, 0.5);
      ctx.shadowBlur = 16;
      tangle(ctx, draw, straight);
      const head = clamp01((straight - 0.8) / 0.2);
      if (head > 0) {
        ctx.beginPath();
        ctx.moveTo(LINE.x1 - 34 * head, LINE.y - 24 * head);
        ctx.lineTo(LINE.x1 + 6, LINE.y);
        ctx.lineTo(LINE.x1 - 34 * head, LINE.y + 24 * head);
        ctx.stroke();
      }
      ctx.restore();
    });

    // куб: сначала каркас, потом грани
    const wire = seg(f.t, cS.start + cS.dur * 0.7, 0.8);
    const solid = easeOutQuart(seg(cE.t, 0.15, 0.7));
    const view: View = { cx: CUBE.x, cy: CUBE.y, size: 300, pitch: 0.5, yaw: gt * 0.7, dist: 4.5 };
    f.obj('cube', { x: CUBE.x, y: CUBE.y, abs: true, label: 'Куб' }, () => {
      if (wire <= 0) return;
      ctx.save();
      ctx.globalAlpha *= clamp01(wire * 3);
      softLight(ctx, CUBE.x, CUBE.y, 420, C.h1, 0.12 + 0.1 * solid);
      ctx.restore();
      shockRing(ctx, CUBE.x, CUBE.y, seg(cE.t, 0.15, 0.8), 380, C.h1, 3);
      if (solid > 0) {
        ctx.save();
        ctx.globalAlpha *= solid;
        drawSolid(ctx, MESH.cube, view, {}, { color: C.h1 });
        ctx.restore();
      }
      drawWire(ctx, MESH.cube, { ...view, size: 300 * (1 + 0.16 * solid) }, {}, {
        color: a(C.h1, 0.75 - 0.4 * solid),
        width: 3,
        p: wire,
        depthFade: 0.6,
        dots: 5,
      });
    });

    f.obj('engine', { x: 150, y: 780, abs: true, text: '3D-движок', label: 'Крупный текст' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        780,
        {
          size: 220,
          color: C.h1,
          tracking: 1,
          glowColor: a(C.h1, 0.35),
          glowBlur: 44,
        },
        seg(cE.t, 0, 0.6),
        { stagger: 0.3, rise: 44 },
      );
    });
    f.obj('sub', { x: 156, y: 900, abs: true, text: cE.show, label: 'Подзаголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        156,
        900,
        { size: 84, color: C.accent, tracking: 1.2 },
        seg(cE.p, 0.4, 0.3),
        { stagger: 0.2, rise: 24 },
      );
    });
  },
};
