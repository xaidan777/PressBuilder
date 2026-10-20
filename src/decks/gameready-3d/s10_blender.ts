/**
 * Сцена 10. Blender MCP.
 *   1. Огр игры перелетает в окно Blender; справа выезжает окно Claude Code
 *      с плашкой «Opus 5.5» — на «продвинула возможности» плашка вспыхивает.
 *   2. Окна расходятся, между ними плашка Blender MCP (вилка), по линиям бегут
 *      точки; по очереди загораются четыре возможности агента: смотреть сцену,
 *      менять геометрию, исполнять скрипты, получать картинку результата.
 *   3. Blender на весь кадр: в огре дыры, вокруг лишние вершины, у руки
 *      вывернуты нормали — агент чинит по очереди, у каждой проблемы галочка;
 *      в конце сетку готовят к анимации — скелет.
 */

import { clamp01, easeInOutCubic, easeOutQuart, hash11, lerp, seg } from '../../engine/anim.ts';
import { arrow, shockRing, softLight } from '../../engine/draw.ts';
import { text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import {
  appear,
  bez,
  checkBadge,
  drawBones,
  drawModel,
  flow,
  groundShadow,
  hero,
  ogrePose,
  titles,
  toScreen,
  type P2,
  type Part,
  type Rect,
  type V3,
  type View,
} from './common.ts';
import {
  blenderWindow,
  claudeWindow,
  drawRim,
  hexIcon,
  highlight,
  lerpRect,
  logLines,
  pictureIcon,
  plate,
  punchHoles,
  sayAt,
  soupWorld,
} from './kit_C.ts';

type Ctx = CanvasRenderingContext2D;

/** Окна по этапам: Blender слева, Claude Code справа. */
const BL = [
  { x: 150, y: 300, w: 900, h: 740 },
  { x: 150, y: 300, w: 660, h: 740 },
  { x: 150, y: 290, w: 1100, h: 750 },
];
const CL = [
  { x: 1130, y: 300, w: 640, h: 740 },
  { x: 1250, y: 300, w: 520, h: 740 },
  { x: 1390, y: 290, w: 380, h: 750 },
];

/** Возможности агента через MCP: иконка и фраза озвучки, на которой она загорается. */
const CAN = [
  { icon: 'eye', at: 'изучать сцену' },
  { icon: 'cube', at: 'операции над геометрией' },
  { icon: 'code', at: 'исполнять скрипты' },
  { icon: 'picture', at: 'получать изображения' },
];

/** Дыры в корпусе (координаты модели) и их радиус. */
const HOLES: V3[] = [[0.12, 1.3, 0.6]];
const HOLE_R = 0.3;

/** Лишние вершины вокруг модели (координаты модели). */
const STRAY: V3[] = Array.from({ length: 16 }, (_, i) => {
  const ang = hash11(i * 3.7) * Math.PI * 2;
  const r = 1.05 + hash11(i * 5.1) * 0.35;
  return [Math.cos(ang) * r, 0.25 + hash11(i * 7.3) * 2.1, Math.sin(ang) * r * 0.6 + 0.2];
});

/** Нормали руки: центр треугольника и направление наружу (координаты модели). */
function armNormals(part: Part): Array<{ c: V3; n: V3 }> {
  const sp = part.soup;
  if (!sp) return [];
  const w = soupWorld(part);
  const ctr: V3 = [0, 0, 0];
  for (const v of w) {
    ctr[0] += v[0] / w.length;
    ctr[1] += v[1] / w.length;
    ctr[2] += v[2] / w.length;
  }
  const out: Array<{ c: V3; n: V3 }> = [];
  const tris = sp.idx.length / 3;
  for (let t = 0; t < tris; t += 5) {
    const A = w[sp.idx[t * 3]];
    const B = w[sp.idx[t * 3 + 1]];
    const Cc = w[sp.idx[t * 3 + 2]];
    const c: V3 = [(A[0] + B[0] + Cc[0]) / 3, (A[1] + B[1] + Cc[1]) / 3, (A[2] + B[2] + Cc[2]) / 3];
    const u: V3 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
    const v: V3 = [Cc[0] - A[0], Cc[1] - A[1], Cc[2] - A[2]];
    let n: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(n[0], n[1], n[2]);
    if (l < 1e-6) continue;
    n = [n[0] / l, n[1] / l, n[2] / l];
    // наружу от центра руки, и только смотрящие к зрителю
    if (n[0] * (c[0] - ctr[0]) + n[1] * (c[1] - ctr[1]) + n[2] * (c[2] - ctr[2]) < 0) n = [-n[0], -n[1], -n[2]];
    // внешняя сторона руки (она на +X) и к зрителю
    if (n[2] < 0.2 || n[0] < -0.05) continue;
    out.push({ c, n });
  }
  return out;
}

/** Стрелка нормали: от точки поверхности наружу (`k` > 0) или внутрь. */
function normalArrow(ctx: Ctx, view: View, c: V3, n: V3, len: number, inward: boolean, color: string): void {
  const tip: V3 = [c[0] + n[0] * len, c[1] + n[1] * len, c[2] + n[2] * len];
  const [x1, y1] = toScreen(inward ? tip : c, view);
  const [x2, y2] = toScreen(inward ? c : tip, view);
  arrow(ctx, x1, y1, x2, y2, 1, { color, width: 5, head: 16 });
}

export const scene10: SceneDef = {
  id: 's10',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cBl = f.cue('blender');
    const cCl = f.cue('claude');
    const cO = f.cue('opus');
    const cM = f.cue('mcp');
    const cCan = f.cue('can');
    const cC = f.cue('cleanup');
    const cLi = f.cue('list');

    titles(f, [{ c: cBl }, { c: cCl }, { c: cM }, { c: cC }]);

    // раскладка окон по этапам
    const k2 = easeInOutCubic(seg(cM.t, -0.2, 0.9));
    const k3 = easeInOutCubic(seg(cC.t, -0.2, 0.9));
    const bl: Rect = lerpRect(lerpRect(BL[0], BL[1], k2), BL[2], k3);
    const cl: Rect = lerpRect(lerpRect(CL[0], CL[1], k2), CL[2], k3);

    // моменты возможностей и починок
    const canAt = CAN.map((c) => sayAt(cCan, c.at));
    const canK = canAt.map((t) => seg(cCan.t, t, 0.4) * (1 - k3));
    const fixAt = {
      holes: sayAt(cLi, 'отверстия'),
      verts: sayAt(cLi, 'лишние вершины'),
      normals: sayAt(cLi, 'исправить нормали'),
      topo: sayAt(cLi, 'проверить топологию'),
      anim: sayAt(cLi, 'подготовить сетку'),
    };
    const fixed = {
      holes: seg(cLi.t, fixAt.holes + 0.3, 0.6),
      verts: seg(cLi.t, fixAt.verts + 0.3, 0.8),
      normals: seg(cLi.t, fixAt.normals + 0.2, 0.6),
      topo: seg(cLi.t, fixAt.topo, 1.2),
      anim: seg(cLi.t, fixAt.anim, 1.0),
    };
    const broken = seg(cC.t, 0.6, 0.9);

    // ---------------------------------------------------------------- окно Blender
    const blView = (r: Rect): View => {
      const vh = r.h - 78 - 28;
      return {
        cx: r.x + r.w / 2,
        cy: r.y + 78 + 14 + vh - 70 * (1 - k3) - 64 * k3,
        size: lerp(lerp(205, 190, k2), 248, k3),
        pitch: 0.14,
        yaw: lerp(-0.45 + Math.sin(gt * 0.35) * 0.35, -0.32 + Math.sin(gt * 0.3) * 0.12, k3),
        dist: 9,
      };
    };
    const view = blView(bl);

    f.obj('blender', { x: bl.x + bl.w / 2, y: bl.y + bl.h / 2, abs: true, label: 'Окно Blender' }, () => {
      appear(
        ctx,
        seg(cBl.t, -0.4, 0.6),
        () => {
          blenderWindow(
            ctx,
            bl,
            gt,
            (vp) => {
              softLight(ctx, vp.x + vp.w / 2, vp.y + vp.h * 0.45, vp.w * 0.6, C.h1, 0.1);
              // «изучать сцену»: по вьюпорту проходит полоса взгляда
              const look = canK[0] * (1 - seg(cCan.t, canAt[1], 0.3));
              if (look > 0) {
                const sx = vp.x + vp.w * ((cCan.t - canAt[0]) * 0.45 % 1);
                const g = ctx.createLinearGradient(sx - 120, 0, sx, 0);
                g.addColorStop(0, a(C.h1, 0));
                g.addColorStop(1, a(C.h1, 0.28 * look));
                ctx.fillStyle = g;
                ctx.fillRect(sx - 120, vp.y, 120, vp.h);
                ctx.fillStyle = a(C.h1, 0.7 * look);
                ctx.fillRect(sx, vp.y, 3, vp.h);
              }
            },
            { grid: { ...view, cy: view.cy }, glow: canK[1] * 0.6 },
          );
        },
        { dy: 40 },
      );
    });

    // ---------------------------------------------------------------- огр
    const fly = seg(cBl.t, 0.2, 1.4);
    f.obj('ogre', { x: view.cx, y: view.cy - 240, abs: true, label: 'Персонаж' }, () => {
      if (fly <= 0) return;
      const e = easeInOutCubic(fly);
      // перелёт: из-за левого края по дуге во вьюпорт
      const from: P2 = [-120, 520];
      const ctrl: P2 = [view.cx - 260, 160];
      const [px, py] = bez(from, ctrl, [view.cx, view.cy], e);
      const fv: View = { ...view, cx: px, cy: py, size: lerp(70, view.size, e), yaw: view.yaw! + (1 - e) * 4 };
      const model = hero('wizard', ogrePose('idle', gt * 0.4));
      let parts = model.parts;

      // проблемы сетки и их починка
      const holesOpen = broken * (1 - fixed.holes);
      const holes = holesOpen > 0.5 ? punchHoles(parts, 'body', HOLES, HOLE_R) : null;
      if (holes) parts = holes.parts;
      const flip = broken * (1 - fixed.normals);
      parts = highlight(parts, ['armL'], C.accent, flip * 0.75);

      ctx.save();
      ctx.globalAlpha *= Math.min(1, fly * 4);
      if (fly >= 1) groundShadow(ctx, fv, 0, 0, 1.0, 0.8, 0.4);
      const wireOn = Math.max(canK[1] * (1 - seg(cCan.t, canAt[2], 0.4)), broken * 0.7, fixed.topo > 0 && fixed.topo < 1 ? 1 : 0);
      const wireCol = fixed.topo > 0 && fixed.topo < 1 ? a(C.pos, 0.7) : canK[1] > 0 && !cC.began ? a(C.h1, 0.75) : a(C.bg, 0.45);
      drawModel(ctx, parts, fv, {}, wireOn > 0.3 ? { wire: wireCol, wireWidth: 1.4 } : {});

      // края дыр
      if (holes) drawRim(ctx, holes.rim, fv, {}, C.accent, 5);

      // нормали руки: внутрь → наружу
      if (broken > 0 && fixed.normals < 1) {
        const arm = parts.find((p) => p.tag === 'armL');
        if (arm) {
          ctx.save();
          ctx.globalAlpha *= broken * (1 - seg(fixed.normals, 0.6, 0.4));
          const inward = fixed.normals < 0.4;
          for (const { c, n } of armNormals(arm)) {
            normalArrow(ctx, fv, c, n, 0.45, inward, inward ? C.accent : C.pos);
          }
          ctx.restore();
        }
      }

      // лишние вершины: точки вокруг, исчезают по очереди
      if (broken > 0) {
        STRAY.forEach((v, i) => {
          const gone = clamp01(fixed.verts * 1.6 - (i / STRAY.length) * 0.6);
          const s = broken * (1 - gone);
          if (s <= 0) return;
          const [x, y] = toScreen(v, fv);
          ctx.save();
          ctx.fillStyle = C.accent;
          ctx.shadowColor = a(C.accent, 0.8);
          ctx.shadowBlur = 12;
          const r = 8 * s;
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
          ctx.restore();
        });
      }

      // готова к анимации: скелет
      if (fixed.anim > 0) {
        drawBones(ctx, model.joints, fv, {}, { p: fixed.anim, color: C.h1 });
      }
      ctx.restore();

      // галочки у починенных мест
      const mark = (v: V3, p: number, dx = 0, dy = 0) => {
        if (p <= 0) return;
        const [x, y] = toScreen(v, fv);
        checkBadge(ctx, x + dx, y + dy, 34, p);
      };
      mark(HOLES[0], seg(cLi.t, fixAt.holes + 0.7, 0.5), 70, -10);
      mark([-1.25, 1.9, 0.2], seg(cLi.t, fixAt.verts + 0.9, 0.5));
      mark([1.15, 1.2, 0.4], seg(cLi.t, fixAt.normals + 0.7, 0.5), 30, 0);
    });

    // ---------------------------------------------------------------- окно Claude Code
    const clIn = seg(cCl.t, 0, 0.7);
    const opusGlow = seg(cO.t, 0.3, 0.5) * (1 - seg(cM.t, 0, 0.6));
    f.obj('claude', { x: cl.x + cl.w / 2, y: cl.y + cl.h / 2, abs: true, label: 'Окно Claude Code' }, () => {
      appear(
        ctx,
        clIn,
        () => {
          const area = claudeWindow(ctx, cl, gt, { glow: opusGlow + canK[2] * 0.6 });
          const busy = Math.max(opusGlow, canK[2] * (1 - seg(cCan.t, canAt[3], 0.4)), cLi.on ? 1 : 0);
          logLines(
            ctx,
            { x: area.x + 10, y: area.y + 130, w: area.w - 20, h: area.h - 150 },
            gt,
            { speed: 1.2 + 3 * busy, color: canK[2] > 0 && !cC.began ? C.h1 : C.accent, alpha: 0.85 },
          );
        },
        { dx: 80 },
      );
      // сетка готова к анимации — итоговая галочка
      checkBadge(ctx, cl.x + cl.w / 2, cl.y + cl.h - 110, 48, seg(cLi.t, fixAt.anim + 0.9, 0.5));
    });
    f.obj('opus', { x: cl.x + cl.w / 2, y: cl.y + 78 + 70, text: 'Opus 5.5', label: 'Плашка Opus 5.5' }, (o) => {
      const p = seg(cCl.t, sayAt(cCl, 'Opus', 0.6), 0.6);
      if (p <= 0) return;
      ctx.save();
      ctx.globalAlpha *= clamp01(p * 2) * clIn;
      ctx.scale(lerp(0.8, 1, easeOutQuart(p)), lerp(0.8, 1, easeOutQuart(p)));
      plate(ctx, o.text, 0, 0, { color: C.accent, size: lerp(64, 50, k3), glow: opusGlow * (0.7 + 0.3 * Math.sin(gt * 5)) });
      shockRing(ctx, 0, 0, seg(cO.t, 0.3, 1.0), 260, C.accent, 4);
      ctx.restore();
    });

    // ---------------------------------------------------------------- Blender MCP
    const gapX = bl.x + bl.w + (cl.x - bl.x - bl.w) / 2;
    const hubY = lerp(470, 560, k3);
    const hubR = lerp(84, 54, k3);
    const mcpIn = seg(cM.t, 0.5, 0.7);
    f.obj('mcp', { x: gapX, y: hubY, abs: true, label: 'Blender MCP' }, () => {
      if (mcpIn <= 0) return;
      const linkP = seg(cM.t, 0.9, 0.9);
      const yL = hubY + 10;
      flow(ctx, [bl.x + bl.w, yL + 60], [bl.x + bl.w + 40, yL], [gapX - hubR, hubY], {
        t: gt,
        color: C.h1,
        p: linkP,
        n: 3,
        speed: 0.8,
        r: 7,
        width: 4,
      });
      flow(ctx, [cl.x, yL + 60], [cl.x - 40, yL], [gapX + hubR, hubY], {
        t: -gt,
        color: C.accent,
        p: linkP,
        n: 3,
        speed: 0.8,
        r: 7,
        width: 4,
      });
      appear(
        ctx,
        mcpIn,
        () => {
          softLight(ctx, gapX, hubY, hubR * 2.4, C.h1, 0.16);
          hexIcon(ctx, 'plug', gapX, hubY, hubR, C.h1, gt, 0.5 + 0.3 * Math.sin(gt * 3));
        },
        { from: 0.6, back: true, cx: gapX, cy: hubY },
      );
    });
    f.obj('mcp-label', { x: gapX, y: hubY + hubR + 72, text: 'Blender MCP', label: 'Подпись Blender MCP' }, (o) => {
      const p = mcpIn * (1 - k3);
      if (p <= 0) return;
      ctx.save();
      ctx.globalAlpha *= p;
      text(ctx, o.text, 0, 0, { size: 54, color: C.h1, align: 'center', caps: 'normal', tracking: 1 });
      ctx.restore();
    });

    // возможности агента: 2×2 под плашкой
    CAN.forEach((it, i) => {
      const x = gapX + (i % 2 ? 1 : -1) * 92;
      const y = 770 + Math.floor(i / 2) * 170;
      f.obj(`can:${i}`, { x, y, abs: true, label: `Возможность ${i + 1}` }, () => {
        const show = seg(cCan.t, -0.2, 0.6) * (1 - k3);
        if (show <= 0) return;
        const on = canK[i];
        ctx.save();
        ctx.globalAlpha *= show * (0.45 + 0.55 * on);
        if (on > 0) shockRing(ctx, x, y, seg(cCan.t, canAt[i], 0.8), 140, C.accent, 4);
        hexIcon(ctx, it.icon, x, y, 66, on > 0 ? C.accent : C.text, gt, on);
        ctx.restore();
      });
    });

    // «получать изображения»: кадр из Blender летит в Claude Code
    f.obj('shot', { x: gapX, y: 640, abs: true, label: 'Картинка результата' }, () => {
      const p = seg(cCan.t, canAt[3] + 0.2, 1.6);
      if (p <= 0 || p >= 1 || k3 > 0) return;
      const e = easeInOutCubic(p);
      const [x, y] = bez([bl.x + bl.w - 140, bl.y + 260], [gapX, 300], [cl.x + 140, cl.y + 300], e);
      const s = lerp(1, 0.7, e);
      ctx.save();
      ctx.globalAlpha *= Math.min(1, p * 6, (1 - p) * 6);
      ctx.translate(x, y);
      ctx.scale(s, s);
      ctx.fillStyle = a(C.bg, 0.95);
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-80, -60, 160, 120, 10);
      ctx.fill();
      ctx.stroke();
      pictureIcon(ctx, 0, 0, 96, C.accent);
      ctx.restore();
    });
  },
};
