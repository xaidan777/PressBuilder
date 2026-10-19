/**
 * Сцена 12. Конвейер «промпт → Opus 5 → картинка» в двух попытках.
 * Короткий промпт даёт не то; к нему дописывается «высокоэффективный» —
 * в него стекаются знания и опыт — и вьюпорт с результатом раскрывается на весь кадр.
 */

import { clamp01, easeInOutCubic, easeOutBack, easeOutQuart, hash11, lerp, seg, shake } from '../../engine/anim.ts';
import { arrow, panel, rrPath, shockRing, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { measure, reveal, text, wrap, type TextStyle } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { chip } from '../../engine/ui.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import { drawGrid, drawSolid, MESH, type View } from '../../engine/wire3d.ts';
import { bez, botHex, viewport, type P2, type Rect } from './common.ts';
import { realScene } from './shading.ts';

type Ctx = CanvasRenderingContext2D;

/** Первый промпт — слова автора: «задача сделать реалистичную демосцену». */
const SHORT_PROMPT = 'сделай реалистичную\nдемосцену';
/**
 * Текст «высокоэффективного промпта». Пока пусто — дописанная часть рисуется
 * условными строками. Впишите сюда настоящий текст, и он будет печататься.
 */
const POWER_PROMPT: string = '';

const BOX: Rect = { x: 150, y: 310, w: 640, h: 420 };
const HEX: P2 = [960, 520];
const VIEW0: Rect = { x: 1130, y: 310, w: 640, h: 420 };
const VIEW1: Rect = { x: 330, y: 292, w: 1260, h: 708 };

const SOURCES = [
  { icon: 'doc', label: 'все свои знания', x: 215, at: 0.2 },
  { icon: 'chat', label: 'весь опыт общения с LLM', x: 740, at: 0.5 },
];
const SRC_Y = 930;

const MONO: TextStyle = { size: 46, family: 'mono', color: C.text, lineHeight: 1.3 };

/** Окно промпта: панель и её заголовок. */
function promptBox(ctx: Ctx, label: string, charge: number): void {
  panel(ctx, BOX.x, BOX.y, BOX.w, BOX.h, {
    fill: C.panel,
    stroke: a(C.accent, 0.36 + 0.5 * charge),
    lineWidth: 2 + 2 * charge,
    radius: 16,
    glow: a(C.accent, 0.1 + 0.4 * charge),
    glowBlur: 50 + 40 * charge,
    accentBar: { color: C.accent, width: 5 },
  });
  text(ctx, label, BOX.x + 36, BOX.y + 62, { size: 46, color: a(C.accent, 0.85), tracking: 3 });
}

/** Содержимое окна: печатается короткий промпт, затем дописанная часть и курсор. */
function promptText(ctx: Ctx, prompt: string, typed: number, extra: number, gt: number): void {
  const shown = prompt.slice(0, Math.round(prompt.length * clamp01(typed)));
  text(ctx, shown, BOX.x + 36, BOX.y + 140, MONO);
  const lines = shown.split('\n');
  let caret: P2 = [
    BOX.x + 36 + measure(ctx, lines[lines.length - 1], MONO),
    BOX.y + 140 + (lines.length - 1) * 46 * 1.3,
  ];

  // дописанная часть
  if (extra > 0) {
    const top = BOX.y + 140 + 2 * 46 * 1.3;
    if (POWER_PROMPT) {
      const st: TextStyle = { ...MONO, color: C.accent, maxWidth: BOX.w - 72 };
      const all = wrap(ctx, POWER_PROMPT, st).join('\n');
      text(ctx, all.slice(0, Math.round(all.length * extra)), BOX.x + 36, top, st);
    } else {
      const rows = [0.92, 0.78, 0.86, 0.5];
      const total = rows.reduce((s, w) => s + w, 0);
      let left = extra * total;
      rows.forEach((w, i) => {
        const k = clamp01(left / w);
        left -= w;
        if (k <= 0) return;
        const bw = (BOX.w - 72) * w * k;
        const by = top - 30 + i * 44;
        ctx.fillStyle = a(C.accent, 0.75);
        rrPath(ctx, BOX.x + 36, by, bw, 22, 11);
        ctx.fill();
        if (k < 1) caret = [BOX.x + 36 + bw + 4, by + 30];
      });
    }
  }
  if ((typed > 0 && typed < 1) || (extra > 0 && extra < 1) || Math.sin(gt * 7) > 0) {
    ctx.fillStyle = C.accent;
    ctx.fillRect(caret[0] + 4, caret[1] - 38, 4, 46);
  }
}

/** Первая попытка: вместо реализма — голые примитивы на сетке. */
function wrongResult(ctx: Ctx, r: Rect, gt: number): void {
  const view: View = { cx: r.x + r.w / 2, cy: r.y + r.h * 0.62, size: 74, pitch: 0.45, yaw: gt * 0.3, dist: 9 };
  drawGrid(ctx, view, { half: 4, step: 1, color: a(C.text, 0.14), width: 1.2 });
  drawSolid(ctx, MESH.cube, view, { pos: [-1.3, 0.6, 0.2], scale: 1.2 }, { color: '#9aa0a6' });
  drawSolid(ctx, MESH.pyramid, view, { pos: [1.4, 0.55, -0.6], scale: 1.1 }, { color: '#9aa0a6' });
}

export const scene12: SceneDef = {
  id: 's12',

  energy: (_t, cue) => Math.max(0.5 * cue('exp').p * (cue('result').began ? 0 : 1), seg(cue('result').p, 0.1, 0.2)),

  render(f: Frame) {
    const { ctx, gt } = f;
    const cS = f.cue('short');
    const cF = f.cue('fail');
    const cP = f.cue('prompt');
    const cE = f.cue('exp');
    const cR = f.cue('result');

    // ---- заголовок меняется вместе с этапом
    const heads = [
      { c: cS, until: cP, color: C.h1 },
      { c: cP, until: cR, color: C.accent },
      { c: cR, until: null, color: C.pos },
    ];
    heads.forEach((h, i) => {
      f.obj(`head:${i}`, { x: 150, y: 230, abs: true, text: h.c.show, label: `Заголовок ${i + 1}` }, (o) => {
        const out = h.until ? seg(h.until.t, -0.3, 0.3) : 0;
        if (!h.c.began || out >= 1) return;
        ctx.save();
        ctx.globalAlpha *= 1 - out;
        reveal(
          ctx,
          o.text,
          150,
          230,
          { size: 100, color: h.color, tracking: 0.6, glowColor: a(h.color, 0.25), glowBlur: 26 },
          seg(h.c.t, 0, 0.55),
          { stagger: 0.2, rise: 26 },
        );
        ctx.restore();
      });
    });

    // ---- раскрытие результата: конвейер гаснет, вьюпорт растёт
    const open = easeInOutCubic(seg(cR.p, 0.2, 0.3));
    const pipe = 1 - seg(cR.p, 0.16, 0.16);
    const [sx, sy] = shake(f.t, cF.start + cF.dur * 0.56, 0.5, 10);

    // общая прозрачность конвейера — снаружи, объекты внутри
    ctx.save();
    ctx.globalAlpha *= pipe;

    // источники «высокой эффективности» и их потоки в промпт
    const charge = clamp01(seg(cE.p, 0.25, 0.7));
    SOURCES.forEach((src, si) => {
      const p = seg(cE.p, src.at - 0.12, 0.12);
      const to: P2 = [BOX.x + BOX.w * (0.3 + si * 0.4), BOX.y + BOX.h];
      const from: P2 = [src.x, SRC_Y - 60];
      const mid: P2 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
      f.obj(`flow:${si}`, { x: mid[0], y: mid[1], abs: true, label: `Поток ${si + 1}` }, () => {
        if (pipe <= 0 || p <= 0) return;
        for (let i = 0; i < 5; i++) {
          const k = (gt * 0.8 + i / 5 + si * 0.13) % 1;
          const [px, py] = bez(from, [from[0], (from[1] + to[1]) / 2], to, k);
          ctx.save();
          ctx.globalAlpha *= p * Math.sin(k * Math.PI);
          icon(ctx, src.icon, px, py, 24 + hash11(i * 3.3 + si) * 10, C.accent, gt);
          ctx.restore();
        }
      });
      f.obj(`src:${si}`, { x: src.x, y: SRC_Y, abs: true, text: src.label, label: `Источник ${si + 1}` }, (o) => {
        if (pipe <= 0 || p <= 0) return;
        botHex(ctx, src.x, SRC_Y, { r: 58, color: C.accent, icon: src.icon, p, t: gt });
        ctx.save();
        ctx.globalAlpha *= easeOutQuart(p);
        text(ctx, o.text, src.x + 84, SRC_Y + 18, { size: 54, color: C.text, tracking: 0.8 });
        ctx.restore();
      });
    });

    // промпт
    const boxAt = { x: BOX.x + BOX.w / 2, y: BOX.y + BOX.h / 2 };
    const typedAt = { x: BOX.x + 36, y: BOX.y + 140 };
    ctx.save();
    ctx.globalAlpha *= easeOutQuart(seg(cS.t, 0, 0.5));
    f.obj('prompt', { ...boxAt, abs: true, text: 'промпт', label: 'Окно промпта' }, (o) => {
      if (pipe <= 0) return;
      promptBox(ctx, o.text, cP.began ? 0.25 + 0.75 * charge : 0);
    });
    f.obj('prompt-text', { ...typedAt, abs: true, text: SHORT_PROMPT, label: 'Текст промпта' }, (o) => {
      if (pipe <= 0) return;
      promptText(ctx, o.text, seg(cS.p, 0.12, 0.6), seg(cP.p, 0.1, 0.8), gt);
    });
    ctx.restore();
    f.obj('chip', { x: BOX.x, y: BOX.y + BOX.h + 70, abs: true, text: 'без деталей', label: 'Плашка' }, (o) => {
      if (pipe <= 0) return;
      chip(ctx, o.text, BOX.x, BOX.y + BOX.h + 70, {
        color: C.h1,
        size: 46,
        p: seg(cS.p, 0.66, 0.2) * (1 - seg(cP.t, 0, 0.3)),
      });
    });

    // стрелки конвейера: загораются, когда модель «думает»
    const busy = Math.max(
      cF.on ? 1 - seg(cF.p, 0.3, 0.1) : 0,
      cR.on ? 1 - seg(cR.p, 0.1, 0.06) : 0,
    );
    const arrowIn = seg(cS.p, 0.5, 0.3);
    const pulse = 0.45 + 0.55 * busy * (0.5 + 0.5 * Math.sin(gt * 12));
    f.obj('arrow:in', { x: 818, y: HEX[1], abs: true, label: 'Стрелка к модели' }, () => {
      if (pipe <= 0) return;
      arrow(ctx, BOX.x + BOX.w + 14, HEX[1], HEX[0] - 128, HEX[1], arrowIn, {
        color: a(C.accent, pulse),
        width: 6,
        head: 22,
      });
    });
    f.obj('arrow:out', { x: 1102, y: HEX[1], abs: true, label: 'Стрелка к результату' }, () => {
      if (pipe <= 0) return;
      arrow(ctx, HEX[0] + 128, HEX[1], VIEW0.x - 14, HEX[1], arrowIn, {
        color: a(C.accent, pulse),
        width: 6,
        head: 22,
      });
    });

    f.obj('model', { x: HEX[0], y: HEX[1], abs: true, text: 'Opus 5', label: 'Модель' }, (o) => {
      if (pipe <= 0) return;
      botHex(ctx, HEX[0], HEX[1], {
        r: 104,
        color: C.h1,
        p: seg(cS.p, 0.4, 0.25),
        t: gt * (1 + busy * 3),
        label: o.text,
        labelSize: 58,
        glow: busy,
      });
    });
    // недоумение после первой попытки
    const puzzled = seg(cF.p, 0.3, 0.12) * (1 - seg(cP.t, 0, 0.3));
    f.obj('question', { x: HEX[0] + 96, y: HEX[1] - 118, abs: true, label: 'Знак вопроса' }, () => {
      if (pipe <= 0 || puzzled <= 0) return;
      ctx.save();
      ctx.globalAlpha *= puzzled;
      icon(ctx, 'question', HEX[0] + 96, HEX[1] - 118 + Math.sin(gt * 4) * 6, 74, C.accent);
      ctx.restore();
    });
    ctx.restore();

    // ---- вьюпорт результата
    const vp = seg(cS.p, 0.6, 0.3);
    const r: Rect = {
      x: lerp(VIEW0.x, VIEW1.x, open) + sx,
      y: lerp(VIEW0.y, VIEW1.y, open) + sy,
      w: lerp(VIEW0.w, VIEW1.w, open),
      h: lerp(VIEW0.h, VIEW1.h, open),
    };
    const wrongIn = seg(cF.p, 0.26, 0.1);
    const good = seg(cR.p, 0.1, 0.08);
    // пока дописывается промпт, неудачная картинка уходит в тень
    const parked = cP.began && !cR.began ? 0.45 : 1;
    const viewAt = { x: VIEW0.x + VIEW0.w / 2, y: VIEW0.y + VIEW0.h / 2 };

    ctx.save();
    ctx.globalAlpha *= easeOutQuart(vp) * parked;
    f.obj('viewport', { ...viewAt, abs: true, label: 'Вьюпорт результата' }, () => {
      if (vp <= 0) return;
      if (good > 0) softLight(ctx, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.8, C.accent, 0.12 * good);
      viewport(
        ctx,
        r,
        () => {
          if (wrongIn > 0 && good < 1) {
            ctx.save();
            ctx.globalAlpha *= wrongIn;
            wrongResult(ctx, r, gt);
            ctx.restore();
          }
          if (good > 0) {
            ctx.save();
            ctx.globalAlpha *= good;
            realScene(ctx, r, gt);
            ctx.restore();
          }
        },
        { color: good > 0 ? C.pos : C.h1 },
      );
    });

    // штамп «неправильно понял»
    const stamp = seg(cF.p, 0.56, 0.1) * (1 - seg(cP.t, 0, 0.3));
    f.obj('stamp', { ...viewAt, abs: true, text: cF.show, label: 'Штамп' }, (o) => {
      if (vp <= 0 || stamp <= 0) return;
      const s = 1 + (1 - easeOutBack(clamp01(stamp), 1.2)) * 1.4;
      ctx.save();
      ctx.globalAlpha *= clamp01(stamp * 2) / parked;
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
      ctx.rotate(-0.1);
      ctx.scale(s, s);
      panel(ctx, -290, -62, 580, 124, {
        fill: a(C.bg, 0.88),
        stroke: C.accent,
        lineWidth: 5,
        radius: 14,
      });
      text(ctx, o.text, 0, 22, { size: 66, color: C.accent, align: 'center', tracking: 1.6 });
      ctx.restore();
    });
    ctx.restore();

    const attemptAt = { x: VIEW0.x + VIEW0.w / 2, y: VIEW0.y + VIEW0.h + 86 };
    f.obj('attempt', { ...attemptAt, abs: true, text: 'первая попытка', label: 'Подпись вьюпорта' }, (o) => {
      if (vp <= 0) return;
      text(ctx, o.text, VIEW0.x + VIEW0.w / 2, VIEW0.y + VIEW0.h + 86, {
        size: 50,
        color: a(C.text, 0.55 * seg(cF.p, 0.2, 0.12) * (1 - seg(cP.t, 0, 0.3))),
        align: 'center',
        tracking: 1.6,
      });
    });

    shockRing(ctx, 960, 640, seg(cR.p, 0.1, 0.3), 900, C.pos, 4);
  },
};
