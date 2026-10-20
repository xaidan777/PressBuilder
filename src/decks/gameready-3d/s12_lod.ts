/**
 * Сцена 12. LOD на реальном огре игры: LOD0 — исходная модель, LOD1/LOD2 —
 * упрощённые (decimate 0.045 / 0.075), каркас показывает треугольники.
 *   1. Огр делится на три версии.
 *   2. Версии расходятся в глубину перед камерой: ближе подробная, дальше грубая.
 *   3. Окно Claude Code: у каждой версии полоса треугольников с лимитом — все укладываются.
 *   4. Силуэт LOD0 обводит все версии — он совпадает; мелочи (шипы) уходят,
 *      а вдали их всё равно не видно.
 *   5. Поле из множества огров и деревьев вокруг танка игрока, кольца дальности LOD.
 */

import { clamp01, easeInOutCubic, easeOutQuart, hash11, lerp, seg } from '../../engine/anim.ts';
import { shockRing, softLight } from '../../engine/draw.ts';
import { text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import {
  appear,
  camSpace,
  checkBadge,
  decimate,
  drawModel,
  groundShadow,
  hero,
  ogrePose,
  prop,
  tankParts,
  titles,
  toScreen,
  triCount,
  viewport,
  type P2,
  type Part,
  type Rect,
  type Root,
  type V3,
  type View,
} from './common.ts';
import {
  budgetBar,
  cameraGlyph,
  claudeWindow,
  dashRing,
  grassFloor,
  groundRing,
  logLines,
  polyLine,
  silhouette,
  SPIKES,
} from './kit_C.ts';

const NAMES = ['LOD0', 'LOD1', 'LOD2'];
const CELLS = [0, 0.045, 0.075];
const COLORS = [C.h1, C.accent, C.pos];
/** Лимиты треугольников для каждой версии (полосы бюджета). */
const LIMITS = [2100, 1000, 520];
const BAR_MAX = 2200;

/** Опорная точка модели на экране: ступни (x, y) и масштаб. */
interface Spot {
  x: number;
  y: number;
  size: number;
  pitch: number;
  yaw: number;
}

const SOLO: Spot = { x: 960, y: 1000, size: 300, pitch: 0.12, yaw: -0.35 };
const ROW1: Spot[] = [480, 960, 1440].map((x) => ({ x, y: 960, size: 205, pitch: 0.12, yaw: -0.35 }));
const ROW3: Spot[] = [330, 700, 1070].map((x) => ({ x, y: 830, size: 165, pitch: 0.12, yaw: -0.35 }));
const ROW4: Spot[] = [480, 960, 1440].map((x) => ({ x, y: 960, size: 215, pitch: 0.12, yaw: -0.35 }));

/** Мир «глубины»: пол y = 0, модели по линии x = 0, камера — спереди-слева. */
const WORLD: View = { cx: 1120, cy: 600, size: 112, pitch: 0.28, yaw: -0.5, dist: 10 };
const DEPTH_Z = [5.2, -1, -9];
/** Границы зон LOD на полу (по z). */
const ZONES = [9, 2.2, -4.8, -18];
const GROUND_X = 7;

function depthSpot(i: number): Spot {
  const p: V3 = [0, 0, DEPTH_Z[i]];
  const [x, y] = toScreen(p, WORLD);
  const z = camSpace(p, WORLD)[2];
  const d = WORLD.dist ?? 10;
  return { x, y, size: WORLD.size * (d / (d - z)), pitch: WORLD.pitch!, yaw: WORLD.yaw! };
}
const DEPTH = [0, 1, 2].map(depthSpot);

const mixSpot = (p: Spot, q: Spot, k: number): Spot => ({
  x: lerp(p.x, q.x, k),
  y: lerp(p.y, q.y, k),
  size: lerp(p.size, q.size, k),
  pitch: lerp(p.pitch, q.pitch, k),
  yaw: lerp(p.yaw, q.yaw, k),
});

const CLAUDE: Rect = { x: 1300, y: 300, w: 470, h: 740 };

/** Поле этапа 5. */
const FIELD: Rect = { x: 150, y: 300, w: 1620, h: 740 };
const FIELD_VIEW: View = { cx: 960, cy: 690, size: 47, pitch: 0.95, yaw: 0.3, dist: Infinity };
const RINGS = [3.6, 7.2];

interface FieldObj {
  kind: string;
  pos: V3;
  ry: number;
  scale: number;
}

/** Объекты поля: сетка с разбросом, без центра (там танк игрока). */
const FIELD_OBJS: FieldObj[] = (() => {
  const out: FieldObj[] = [];
  const kinds = ['hero', 'hero', 'oak', 'pine', 'hero', 'rock', 'pine', 'bush'];
  for (let j = 0; j < 6; j++) {
    for (let i = 0; i < 9; i++) {
      const n = j * 9 + i;
      const x = -15 + i * 3.75 + (hash11(n * 1.7) - 0.5) * 2.2;
      const z = -9 + j * 3.4 + (hash11(n * 2.9) - 0.5) * 1.8;
      if (Math.hypot(x, z) < 2.2) continue;
      const kind = kinds[Math.floor(hash11(n * 4.3) * kinds.length)];
      out.push({ kind, pos: [x, 0, z], ry: Math.atan2(-x, -z), scale: kind === 'rock' ? 0.6 : kind === 'hero' ? 1 : 0.8 });
    }
  }
  return out;
})();

/** Версия модели по номеру LOD. */
const lodOf = (parts: Part[], i: number) => (CELLS[i] > 0 ? decimate(parts, CELLS[i]) : parts);

export const scene12: SceneDef = {
  id: 's12',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cL = f.cue('lod');
    const cV = f.cue('versions');
    const cD = f.cue('distance');
    const cB = f.cue('budget');
    const cK = f.cue('keep');
    const cS = f.cue('small');
    const cM = f.cue('many');

    titles(f, [{ c: cL }, { c: cD }, { c: cB }, { c: cK }, { c: cM, color: C.h1 }]);

    // ---------------------------------------------------------------- раскладка трёх версий по этапам
    const kV = easeInOutCubic(seg(cV.t, 0.1, 1.0));
    const kD = easeInOutCubic(seg(cD.t, 0, 1.4));
    const kB = easeInOutCubic(seg(cB.t, -0.1, 1.0));
    const kK = easeInOutCubic(seg(cK.t, -0.1, 1.0));
    const kS = easeInOutCubic(seg(cS.t, 0, 1.2));
    const out5 = easeInOutCubic(seg(cM.t, -0.2, 0.8));

    const spotOf = (i: number): Spot => {
      let s = mixSpot(SOLO, ROW1[i], kV);
      s = mixSpot(s, DEPTH[i], kD);
      s = mixSpot(s, ROW3[i], kB);
      s = mixSpot(s, ROW4[i], kK);
      // «мелочи не видны»: упрощённые версии уходят вдаль — уменьшаются
      if (i > 0) s = { ...s, size: s.size * lerp(1, i === 1 ? 0.62 : 0.4, kS), y: s.y - (i === 1 ? 60 : 110) * kS };
      return s;
    };

    // ---------------------------------------------------------------- пол с зонами (этап 2)
    const floorK = seg(cD.t, 0.2, 1.0) * (1 - seg(cB.t, -0.1, 0.6));
    f.obj('floor', { x: WORLD.cx, y: WORLD.cy, abs: true, label: 'Пол и зоны LOD' }, () => {
      if (floorK <= 0) return;
      ctx.save();
      ctx.globalAlpha *= floorK;
      for (let z = 0; z < 3; z++) {
        const quad: P2[] = [
          toScreen([-GROUND_X, 0, ZONES[z]], WORLD),
          toScreen([GROUND_X, 0, ZONES[z]], WORLD),
          toScreen([GROUND_X, 0, ZONES[z + 1]], WORLD),
          toScreen([-GROUND_X, 0, ZONES[z + 1]], WORLD),
        ];
        polyLine(ctx, quad, true);
        ctx.fillStyle = a(COLORS[z], 0.07);
        ctx.fill();
      }
      ctx.strokeStyle = a(C.h1, 0.14);
      ctx.lineWidth = 1.5;
      for (let x = -GROUND_X; x <= GROUND_X; x += 1) {
        polyLine(ctx, [toScreen([x, 0, ZONES[0]], WORLD), toScreen([x, 0, ZONES[3]], WORLD)]);
        ctx.stroke();
      }
      for (let z = ZONES[3]; z <= ZONES[0]; z += 1) {
        polyLine(ctx, [toScreen([-GROUND_X, 0, z], WORLD), toScreen([GROUND_X, 0, z], WORLD)]);
        ctx.stroke();
      }
      ctx.strokeStyle = a(C.accent, 0.7);
      ctx.lineWidth = 3;
      ctx.setLineDash([14, 12]);
      for (const z of [ZONES[1], ZONES[2]]) {
        polyLine(ctx, [toScreen([-GROUND_X, 0, z], WORLD), toScreen([GROUND_X, 0, z], WORLD)]);
        ctx.stroke();
      }
      ctx.restore();
    });

    // камера: смотрит вдоль линии моделей
    const camAt: P2 = [250, 900];
    f.obj('camera', { x: camAt[0], y: camAt[1], label: 'Камера' }, () => {
      const p = seg(cD.t, 0.4, 0.8) * (1 - seg(cB.t, -0.1, 0.5));
      if (p <= 0) return;
      const look = Math.atan2(DEPTH[2].y - camAt[1] - 150, DEPTH[2].x - camAt[0]);
      ctx.save();
      ctx.globalAlpha *= p;
      ctx.rotate(look);
      ctx.translate((1 - p) * -40, 0);
      softLight(ctx, 0, 0, 150, C.h1, 0.14);
      cameraGlyph(ctx, C.h1);
      ctx.strokeStyle = a(C.h1, 0.5);
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 12]);
      ctx.beginPath();
      ctx.moveTo(84, 0);
      ctx.lineTo(84 + 200 * p, 0);
      ctx.stroke();
      ctx.restore();
    });

    // ---------------------------------------------------------------- три версии
    const base = hero('elf', ogrePose('idle', gt * 0.4)).parts;
    const counts = [0, 1, 2].map((i) => triCount(lodOf(base, i)));
    const outline = seg(cK.t, 0.3, 0.8);
    for (let i = 2; i >= 0; i--) {
      const appearP = i === 0 ? seg(cL.t, 0.2, 0.8) : seg(cV.t, 0.1 + (i - 1) * 0.3, 0.7);
      const s = spotOf(i);
      const anchorY = s.y - 1.1 * s.size;
      f.obj(`lod:${i}`, { x: s.x, y: anchorY, abs: true, label: `Модель ${NAMES[i]}` }, () => {
        if (appearP <= 0 || out5 >= 1) return;
        ctx.save();
        ctx.globalAlpha *= clamp01(appearP * 2) * (1 - out5);
        softLight(ctx, s.x, anchorY, s.size * 2.2, COLORS[i], 0.08);
        const view: View = { cx: s.x, cy: s.y, size: s.size, pitch: s.pitch, yaw: s.yaw + Math.sin(gt * 0.4) * 0.25, dist: 9 };
        groundShadow(ctx, view, 0, 0, 1.0, 0.8, 0.4);
        const parts = lodOf(base, i);
        // силуэт LOD0 обводит каждую версию — он совпадает
        if (outline > 0) {
          ctx.save();
          ctx.globalAlpha *= outline;
          silhouette(ctx, base, view, {}, { stroke: C.accent, width: 5 });
          ctx.restore();
        }
        drawModel(ctx, parts, view, {}, { wire: a(C.bg, 0.5), wireWidth: i === 0 ? 1 : 1.4 });
        // мелочи: шипы наплечников
        const spikeK = seg(cK.t, 2.2, 0.6) * (1 - seg(cS.t, 0.6, 1.0) * (i > 0 ? 1 : 0));
        if (spikeK > 0) {
          for (const sp of SPIKES) {
            const [x, y] = toScreen(sp, view);
            ctx.save();
            ctx.globalAlpha *= spikeK;
            dashRing(ctx, x, y, Math.max(20, 0.32 * s.size), i === 0 ? C.h1 : C.accent, gt, 4);
            ctx.restore();
          }
        }
        ctx.restore();
      });

      // подпись: под моделью в ряду, справа от неё — в глубине
      const nameK = kD * (1 - kB);
      const lx = lerp(s.x, s.x + s.size * 1.1, nameK);
      const ly = lerp(s.y + 78, s.y - s.size * 1.0, nameK);
      f.obj(`name:${i}`, { x: lx, y: ly, text: NAMES[i], label: `Подпись ${NAMES[i]}` }, (o) => {
        const p = i === 0 ? seg(cV.t, 0.2, 0.6) : appearP;
        if (p <= 0 || out5 >= 1) return;
        ctx.save();
        ctx.globalAlpha *= clamp01(p * 2 - 0.4) * (1 - out5);
        text(ctx, o.text, 0, 0, {
          size: lerp(62, 54, kD * (1 - kB)),
          color: COLORS[i],
          align: nameK > 0.5 ? 'left' : 'center',
          caps: 'normal',
          tracking: 2,
        });
        ctx.restore();
      });

      // бюджет: полоса треугольников с лимитом
      const barP = seg(cB.t, 1.0 + i * 0.5, 0.6) * (1 - seg(cK.t, -0.2, 0.5));
      const shrink = easeInOutCubic(seg(cB.t, 2.6 + i * 0.9, 1.2));
      const n = Math.round(lerp(counts[0], counts[i], shrink));
      const bx = ROW3[i].x - 150;
      const by = ROW3[i].y + 110;
      f.obj(`bar:${i}`, { x: ROW3[i].x, y: by, abs: true, label: `Бюджет ${NAMES[i]}` }, () => {
        if (barP <= 0) return;
        ctx.save();
        ctx.globalAlpha *= barP;
        budgetBar(ctx, bx, by, 300, 30, n, BAR_MAX, { limit: LIMITS[i] });
        text(ctx, String(n), ROW3[i].x, by + 100, {
          size: 56,
          family: 'mono',
          align: 'center',
          color: n > LIMITS[i] ? C.accent : C.pos,
        });
        checkBadge(ctx, bx + 300 + 4, by - 70, 30, seg(cB.t, 3.9 + i * 0.9, 0.5));
        ctx.restore();
      });
    }

    // ---------------------------------------------------------------- Claude Code
    const clP = seg(cB.t, 0.2, 0.8) * (1 - seg(cK.t, -0.2, 0.6));
    f.obj('claude', { x: CLAUDE.x + CLAUDE.w / 2, y: CLAUDE.y + CLAUDE.h / 2, abs: true, label: 'Окно Claude Code' }, () => {
      if (clP <= 0) return;
      appear(
        ctx,
        clP,
        () => {
          const area = claudeWindow(ctx, CLAUDE, gt, { glow: cB.on ? 0.5 : 0 });
          logLines(ctx, { x: area.x + 10, y: area.y + 20, w: area.w - 20, h: area.h - 40 }, gt, { speed: cB.on ? 3 : 1, alpha: 0.85 });
        },
        { dx: 80 },
      );
    });
    // поток от агента к версиям
    f.obj('links', { x: CLAUDE.x - 60, y: 700, abs: true, label: 'Связи с версиями' }, () => {
      if (clP <= 0) return;
      ctx.save();
      ctx.globalAlpha *= clP;
      for (let i = 0; i < 3; i++) {
        const p = seg(cB.t, 1.0 + i * 0.5, 0.6);
        if (p <= 0) continue;
        const to: P2 = [ROW3[i].x + 150, ROW3[i].y + 125];
        const from: P2 = [CLAUDE.x, CLAUDE.y + 420 + i * 60];
        for (let k = 0; k < 4; k++) {
          const u = (gt * 0.6 + k / 4 + i * 0.17) % 1;
          if (u > p) continue;
          ctx.fillStyle = C.accent;
          ctx.beginPath();
          ctx.arc(lerp(from[0], to[0], u), lerp(from[1], to[1], u) - Math.sin(u * Math.PI) * 60, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    });

    // ---------------------------------------------------------------- поле: много объектов
    const in5 = seg(cM.t, 0, 0.9);
    f.obj('field', { x: FIELD.x + FIELD.w / 2, y: FIELD.y + FIELD.h / 2, abs: true, label: 'Поле объектов' }, () => {
      if (in5 <= 0) return;
      appear(
        ctx,
        in5,
        () => {
          viewport(ctx, FIELD, () => {
            const view = FIELD_VIEW;
            grassFloor(ctx, view, FIELD, { tile: 8, shade: 0.45 });
            // кольца дальности LOD вокруг игрока
            const ringP = seg(cM.t, 0.5, 1.0);
            [...RINGS].reverse().forEach((r, k) => {
              const i = RINGS.length - 1 - k;
              ctx.save();
              ctx.globalAlpha *= ringP;
              groundRing(ctx, view, 0, 0, r * easeOutQuart(ringP));
              ctx.fillStyle = a(C.bg, 0.25);
              ctx.fill();
              ctx.fillStyle = a(COLORS[i], 0.08);
              ctx.fill();
              ctx.restore();
            });
            RINGS.forEach((r, i) => {
              ctx.save();
              ctx.globalAlpha *= clamp01(ringP * 2 - i * 0.4);
              ctx.strokeStyle = COLORS[i];
              ctx.lineWidth = 4;
              ctx.setLineDash([16, 12]);
              groundRing(ctx, view, 0, 0, r * easeOutQuart(ringP));
              ctx.stroke();
              ctx.restore();
            });
            // объекты: дальние первыми; версия — по расстоянию до игрока
            const walk = hero('elf', ogrePose('walk', gt * 0.8)).parts;
            const walkW = hero('wizard', ogrePose('walk', gt * 0.8 + 0.5)).parts;
            const list = FIELD_OBJS.map((o, n) => ({ o, n, z: camSpace(o.pos, view)[2] })).sort((p, q) => p.z - q.z);
            for (const { o, n } of list) {
              const d = Math.hypot(o.pos[0], o.pos[2]);
              const lod = d < RINGS[0] ? 0 : d < RINGS[1] ? 1 : 2;
              const src = o.kind === 'hero' ? (n % 2 ? walkW : walk) : prop(o.kind);
              const root: Root = { pos: o.pos, ry: o.kind === 'hero' ? o.ry : hash11(n * 9.1) * 6.28, scale: o.scale };
              groundShadow(ctx, view, o.pos[0], o.pos[2], 0.8 * o.scale, 0.6 * o.scale, 0.35);
              drawModel(ctx, lodOf(src, lod), view, root);
            }
            // танк игрока в центре
            groundShadow(ctx, view, 0, 0, 1.3, 0.9, 0.45);
            drawModel(ctx, tankParts({ turret: gt * 0.6 }), view, { pos: [0, 0, 0], ry: Math.PI / 2 });
            const [tx, ty] = toScreen([0, 0, 0], view);
            shockRing(ctx, tx, ty, seg(cM.t, 0.3, 1.4), 520, C.h1, 4);
          });
        },
        { from: 1.06, cx: FIELD.x + FIELD.w / 2, cy: FIELD.y + FIELD.h / 2 },
      );
    });

    // подписи зон: справа от игрока, в каждой зоне своя версия
    [2.3, 5.4, 9.4].forEach((r, i) => {
      const [x, y] = toScreen([r * Math.cos(0.3), 0, -r * Math.sin(0.3)], FIELD_VIEW);
      f.obj(`ring:${i}`, { x, y, text: NAMES[i], label: `Зона ${NAMES[i]}` }, (o) => {
        const p = seg(cM.t, 0.9 + i * 0.25, 0.5);
        if (p <= 0) return;
        ctx.save();
        ctx.globalAlpha *= p;
        const st = { size: 50, color: COLORS[i], caps: 'normal' as const, tracking: 2, align: 'center' as const };
        const w = 130;
        ctx.fillStyle = a(C.bg, 0.85);
        ctx.strokeStyle = a(COLORS[i], 0.7);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(-w / 2, -42, w, 60, 30);
        ctx.fill();
        ctx.stroke();
        text(ctx, o.text, 0, 0, st);
        ctx.restore();
      });
    });
  },
};
