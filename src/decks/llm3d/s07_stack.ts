/**
 * Сцена 7. Основа — Babylon 3D: гонка полос производительности с Three.js,
 * затем окно с кодом на JS, который на глазах раскручивает куб.
 */

import { clamp01, easeInOutCubic, easeOutBack, seg } from '../../engine/anim.ts';
import { rrPath, shockRing, softLight } from '../../engine/draw.ts';
import { kicker, reveal, text, type TextStyle } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import { drawSolid, drawWire, MESH, type View } from '../../engine/wire3d.ts';
import { appear, botHex, checkBadge, windowFrame } from './common.ts';

type Ctx = CanvasRenderingContext2D;

const BAR = { x: 520, w: 640, h: 56 };
/** Длины полос относительные: автор называет победителя, но не цифры. */
const RIVALS = [
  { name: 'Babylon 3D', y: 520, len: 1, color: C.h1 },
  { name: 'Three.js', y: 660, len: 0.6, color: '#8a9096' },
];

const WIN = { x: 150, y: 350, w: 1090, h: 500 };
const CUBE = { x: 1530, y: 590 };

type Tok = [string, 'kw' | 'str' | 'num' | 'txt'];
/** Настоящий Babylon.js: создаём куб и крутим его каждый кадр. */
const CODE: Tok[][] = [
  [
    ['const ', 'kw'],
    ['box = MeshBuilder.CreateBox(', 'txt'],
  ],
  [
    ["  'box'", 'str'],
    [', { size: ', 'txt'],
    ['2', 'num'],
    [' }, scene);', 'txt'],
  ],
  [],
  [['scene.registerBeforeRender(() => {', 'txt']],
  [
    ['  box.rotation.y += ', 'txt'],
    ['0.01', 'num'],
    [';', 'txt'],
  ],
  [['});', 'txt']],
];
const CODE_LEN = CODE.reduce((n, ln) => n + ln.reduce((m, [s]) => m + s.length, 0), 0);
const TOK_COLOR = { kw: C.accent, str: C.pos, num: C.accent, txt: C.text } as const;

/** Посимвольная печать кода с подсветкой. Возвращает позицию каретки. */
function typeCode(ctx: Ctx, x: number, y: number, typed: number): [number, number] {
  const st: TextStyle = { size: 46, family: 'mono', color: C.text };
  const step = 62;
  let left = Math.round(CODE_LEN * clamp01(typed));
  let caret: [number, number] = [x, y];
  for (let i = 0; i < CODE.length && left > 0; i++) {
    let cx = x;
    for (const [str, kind] of CODE[i]) {
      if (left <= 0) break;
      const shown = str.slice(0, left);
      left -= shown.length;
      cx += text(ctx, shown, cx, y + i * step, { ...st, color: TOK_COLOR[kind] });
    }
    caret = [cx, y + i * step];
  }
  return caret;
}

export const scene07: SceneDef = {
  id: 's07',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cB = f.cue('babylon');
    const cP = f.cue('perf');
    const cJ = f.cue('js');
    const cL = f.cue('llmjs');

    f.obj('kicker', { x: 150, y: 130, abs: true, text: 'за основу', label: 'Надзаголовок' }, (o) => {
      kicker(ctx, o.text, 150, 130, seg(cB.t, 0, 0.4), C.accent, 46);
    });
    f.obj('title', { x: 150, y: 280, abs: true, text: cB.show, label: 'Заголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        280,
        { size: 160, color: C.h1, tracking: 0.8, glowColor: a(C.h1, 0.3), glowBlur: 36 },
        seg(cB.t, 0.1, 0.6),
        { stagger: 0.3, rise: 36 },
      );
    });

    // ---- гонка производительности (уходит, когда речь заходит о коде)
    const barsOut = seg(cJ.t, 0, 0.35);
    const race = easeInOutCubic(seg(cP.p, 0.08, 0.62));
    const raceOn = cP.began && barsOut < 1;
    // общий уход блока вверх — снаружи объектов
    ctx.save();
    ctx.globalAlpha *= (1 - barsOut) * seg(cP.t, 0, 0.35);
    ctx.translate(0, -barsOut * 30);
    f.obj('perf', { x: 150, y: 450, abs: true, text: cP.show, label: 'Подпись гонки' }, (o) => {
      if (!raceOn) return;
      text(ctx, o.text, 150, 450, { size: 50, color: a(C.text, 0.55), tracking: 1.6 });
    });
    RIVALS.forEach((r, i) => {
      f.obj(`rival:${i}`, { x: 150, y: r.y + 48, abs: true, text: r.name, label: `Полоса ${i + 1}` }, (o) => {
        if (!raceOn) return;
        const len = BAR.w * Math.min(race, r.len);
        text(ctx, o.text, 150, r.y + 48, {
          size: 70,
          color: i === 0 ? C.text : a(C.text, 0.6),
          tracking: 0.6,
        });
        ctx.fillStyle = a(C.text, 0.07);
        rrPath(ctx, BAR.x, r.y, BAR.w, BAR.h, BAR.h / 2);
        ctx.fill();
        ctx.save();
        if (i === 0) {
          ctx.shadowColor = a(r.color, 0.7);
          ctx.shadowBlur = 12 + 22 * seg(cP.p, 0.55, 0.2);
        }
        ctx.fillStyle = r.color;
        rrPath(ctx, BAR.x, r.y, Math.max(BAR.h, len), BAR.h, BAR.h / 2);
        ctx.fill();
        ctx.restore();
      });
    });
    f.obj(
      'perfCheck',
      { x: BAR.x + BAR.w + 56, y: RIVALS[0].y + BAR.h / 2, abs: true, label: 'Отметка победителя' },
      () => {
        if (!raceOn) return;
        checkBadge(ctx, BAR.x + BAR.w + 56, RIVALS[0].y + BAR.h / 2, 30, seg(cP.p, 0.7, 0.14));
      },
    );
    ctx.restore();

    // ---- куб: живёт всю сцену, а после допечатанного кода раскручивается сильнее
    const typeFrom = cJ.start + 0.3;
    const typeTo = cL.start + cL.dur * 0.5;
    const typed = clamp01((f.t - typeFrom) / (typeTo - typeFrom));
    const boost = Math.max(0, f.t - typeTo);
    const view: View = {
      cx: CUBE.x,
      cy: CUBE.y,
      size: 250,
      pitch: 0.48,
      yaw: gt * 0.45 + boost * 2.4,
      dist: 4.5,
    };
    const cubeIn = seg(cB.t, 0.3, 0.7);
    f.obj('cube', { x: CUBE.x, y: CUBE.y, abs: true, label: 'Куб' }, () => {
      if (cubeIn <= 0) return;
      ctx.save();
      ctx.globalAlpha *= clamp01(cubeIn * 2);
      softLight(ctx, CUBE.x, CUBE.y, 400, C.h1, 0.12);
      drawSolid(ctx, MESH.cube, { ...view, size: 250 * easeOutBack(cubeIn, 1.4) }, {}, { color: C.h1 });
      drawWire(ctx, MESH.cube, { ...view, size: 300 }, {}, {
        color: a(C.h1, 0.3),
        width: 2,
        p: cubeIn,
        depthFade: 0.5,
      });
      ctx.restore();
      shockRing(ctx, CUBE.x, CUBE.y, seg(f.t, typeTo, 0.8), 360, C.pos, 3);
    });

    // ---- окно с кодом
    f.obj(
      'code',
      { x: WIN.x + WIN.w / 2, y: WIN.y + WIN.h / 2, abs: true, text: cJ.show, label: 'Окно с кодом' },
      (o) => {
        appear(
          ctx,
          seg(cJ.t, 0.1, 0.5),
          () => {
            const body = windowFrame(ctx, WIN.x, WIN.y, WIN.w, WIN.h, { title: o.text, color: C.accent });
            const [cx, cy] = typeCode(ctx, body.x + 40, body.y + 78, typed);
            if (typed < 1 || Math.sin(gt * 7) > 0) {
              ctx.fillStyle = C.accent;
              ctx.fillRect(cx + 4, cy - 38, 4, 46);
            }
          },
          { dy: 40 },
        );
      },
    );

    // фирменный жёлтый квадрат языка
    f.obj('js', { x: WIN.x + WIN.w - 94, y: WIN.y + 12, abs: true, text: 'JS', label: 'Значок JS' }, (o) => {
      appear(
        ctx,
        seg(cJ.t, 0.25, 0.45),
        () => {
          const s = 132;
          const x = WIN.x + WIN.w - s - 28;
          const y = WIN.y - 54;
          ctx.save();
          ctx.shadowColor = a(C.accent, 0.5);
          ctx.shadowBlur = 30;
          ctx.fillStyle = C.accent;
          rrPath(ctx, x, y, s, s, 14);
          ctx.fill();
          ctx.restore();
          text(ctx, o.text, x + s - 14, y + s - 16, {
            size: 84,
            color: C.bg,
            align: 'right',
            caps: 'normal',
          });
        },
        { from: 0.4, back: true, cx: WIN.x + WIN.w - 94, cy: WIN.y + 12 },
      );
    });

    // ---- любая LLM в нём как дома
    f.obj('llm', { x: CUBE.x, y: 905, abs: true, label: 'LLM' }, () => {
      botHex(ctx, CUBE.x, 905, { r: 70, color: C.pos, p: seg(cL.t, 0.1, 0.5), t: gt, glow: 0.7 });
      checkBadge(ctx, CUBE.x + 62, 905 - 52, 26, seg(cL.p, 0.45, 0.16));
    });
    f.obj('llmjs', { x: 150, y: 960, abs: true, text: cL.show, label: 'Подпись' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        960,
        { size: 76, color: C.pos, tracking: 0.8 },
        seg(cL.t, 0.1, 0.8),
        { stagger: 0.14, rise: 22 },
      );
    });
  },
};
