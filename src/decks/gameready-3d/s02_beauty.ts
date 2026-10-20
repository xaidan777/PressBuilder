/**
 * Сцена 2. Красиво ≠ играбельно.
 *   youtube          — сетка роликов: в каждом за секунды «проявляется» красивая генерация
 *                      (картинки автора beauty_b1…b6);
 *   notsame          — маг LOD0 (подробный) против мага LOD2 (упрощённый), между ними ≠;
 *   fixes, picture   — у подробного мага дыры, шипы-артефакты и грязные пятна, три значка
 *                      проблем; вспышка — и модель становится красивой картинкой;
 *   fps, weak        — «30-40» картинок в секунду, на YouTube смотрится; на слабом ноутбуке
 *                      график кадров рвётся и падает, модель дёргается;
 *   iron             — ноутбук раскаляется, приходят Game Ready ассеты (маг LOD1 и танк) — остывает.
 */

import { clamp01, easeInOutCubic, easeOutBack, easeOutQuart, lerp, noise1, hash11, seg } from '../../engine/anim.ts';
import { hexPath, rrPath, shockRing, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import type { CueTime, Frame, SceneDef } from '../../engine/types.ts';
import {
  checkBadge,
  crossBadge,
  drawModel,
  groundShadow,
  IDLE,
  M,
  MAGE_GAIT,
  mage,
  mageWalkCycle,
  ogrePose,
  SCREEN_BG,
  tankParts,
  titles,
  toScreen,
  type P2,
  type Part,
  type Rect,
  type V3,
  type View,
  walkCycle,
} from './common.ts';
import { picture } from './kit_E.ts';
import { defects, grassGround, laptop, lerpRect, notEqual, place, scanReveal, spotPoint, stage, type Spot } from './kit_A.ts';

type Ctx = CanvasRenderingContext2D;

// ---------------------------------------------------------------- раскладка

const GRID = { x: 150, y: 300, w: 516, h: 347, gap: 36 };
const cardRect = (i: number): Rect => ({
  x: GRID.x + (i % 3) * (GRID.w + GRID.gap),
  y: GRID.y + Math.floor(i / 3) * (GRID.h + GRID.gap),
  w: GRID.w,
  h: GRID.h,
});
/** Плотный огр по этапам: слева → крупно → картинка → экран → ноутбук. */
const R_LEFT: Rect = { x: 150, y: 300, w: 700, h: 730 };
const R_FIX: Rect = { x: 150, y: 300, w: 1000, h: 730 };
const R_PIC: Rect = { x: 510, y: 300, w: 900, h: 700 };
const R_SCR: Rect = { x: 900, y: 330, w: 870, h: 540 };
const R_HOT: Rect = { x: 640, y: 400, w: 800, h: 470 };
const R_OGRE: Rect = { x: 1070, y: 300, w: 700, h: 730 };

// ---------------------------------------------------------------- плотные модели

/** Ракурс, в котором огр показывает проблемы. */
const FIX_YAW = 0.42;
const SPOT_HOLE: Spot = [0.38, 0.36, 0.97, 0.075];
const SPOT_MARK: Spot = [0.6, 0.7, 0.95, 0.06];
const SPOT_SPIKE: Spot = [0.55, 0.98, 0.55, 0.3];
/** Маг «с багами» (LOD0) — в покое, кэшируется один раз. */
const BUGGY: Part[] = defects(mage(IDLE).parts, 'mage', {
  holes: [SPOT_HOLE, [0.44, 0.31, 0.97, 0.05]],
  marks: [SPOT_MARK],
  spikes: [SPOT_SPIKE, [0.22, 0.62, 0.5, 0.14], [0.8, 0.7, 0.2, 0.22], [0.2, 0.45, 0.95, 0.12]],
});
const BUGGY_BODY = BUGGY.find((p) => p.tag === 'mage')!;

/** Красивые генерации в карточках-роликах (картинки автора, 359×476). */
const GALLERY = [1, 2, 3, 4, 5, 6].map((i) => `beauty_b${i}.png`);
GALLERY.forEach((n) => picture(n));

/** Точка на поверхности части около `Spot`: среднее ближайших вершин передней стороны. */
function surfaceSpot(part: Part, sp: Spot): V3 {
  const soup = part.soup!;
  const c = spotPoint(soup, sp);
  let best: Array<[number, number]> = [];
  for (let i = 0; i < soup.pos.length / 3; i++) {
    const d = (soup.pos[i * 3] - c[0]) ** 2 + (soup.pos[i * 3 + 1] - c[1]) ** 2 + (soup.pos[i * 3 + 2] - c[2]) ** 2;
    best.push([d, i]);
  }
  best = best.sort((p, q) => p[0] - q[0]).slice(0, 12);
  const out: V3 = [0, 0, 0];
  for (const [, i] of best) for (let k = 0; k < 3; k++) out[k] += soup.pos[i * 3 + k] / best.length;
  return out;
}

/** Точка меша части → мир (для выносок к местам на модели). */
function partPoint(part: Part, v: V3): V3 {
  const q = M.apply(part.rot ?? M.id(), [v[0] * part.size[0], v[1] * part.size[1], v[2] * part.size[2]]);
  return [part.pos[0] + q[0], part.pos[1] + q[1], part.pos[2] + q[2]];
}

const SPOT_BOLT: Spot = [0.62, 0.06, 0.95, 0];
/** Места выносок на поверхности мага (считаются один раз, по сетке без шипов — шипы раздвигают габарит). */
const CLEAN_BODY = mage(IDLE).parts[0];
const SPOT_AT = new Map<Spot, V3>([SPOT_MARK, SPOT_HOLE, SPOT_BOLT].map((s) => [s, surfaceSpot(CLEAN_BODY, s)]));

/** Вид на огра внутри прямоугольника (ступни у низа, рост ≈ 78 % высоты). */
function heroView(r: Rect, hud: number, yaw: number): View {
  const h = r.h - hud;
  return { cx: r.x + r.w / 2, cy: r.y + h * 0.9, size: (h * 0.78) / 2.2, pitch: 0.12, yaw, dist: 9 };
}

// ---------------------------------------------------------------- график кадров

/** Частота кадров (условно, 0..60) в момент `ts` локального времени слайда. */
function fpsAt(ts: number, bad: number): number | null {
  const ok = 36 + 3.5 * noise1(ts * 2.3, 1);
  const low = 9 + 6 * noise1(ts * 4.1, 2) + (hash11(Math.floor(ts * 5) * 1.7) > 0.72 ? -8 : 0);
  if (bad > 0.5 && hash11(Math.floor(ts * 6) * 3.3) > 0.8) return null; // разрыв графика
  return Math.max(1, lerp(ok, low, bad));
}

/** Бегущий график кадров внизу экрана (HUD). `bad(ts)` — насколько плохо в момент ts. */
function fpsGraph(ctx: Ctx, r: Rect, t: number, bad: (ts: number) => number, good: number): void {
  const N = 70;
  const step = 0.07;
  ctx.save();
  ctx.fillStyle = a(C.bg, 0.72);
  rrPath(ctx, r.x, r.y, r.w, r.h, 10);
  ctx.fill();
  ctx.strokeStyle = a(C.text, 0.1);
  ctx.lineWidth = 1;
  for (let k = 1; k < 3; k++) {
    ctx.beginPath();
    ctx.moveTo(r.x + 10, r.y + (r.h * k) / 3);
    ctx.lineTo(r.x + r.w - 10, r.y + (r.h * k) / 3);
    ctx.stroke();
  }
  const lineY = (v: number) => r.y + r.h - 10 - ((r.h - 20) * Math.min(60, v)) / 60;
  const color = bad(t) > 0.5 && good < 0.5 ? C.accent : C.pos;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = a(color, 0.6);
  ctx.shadowBlur = 12;
  let open = false;
  ctx.beginPath();
  for (let k = 0; k < N; k++) {
    const ts = t - (N - 1 - k) * step;
    let v = fpsAt(ts, bad(ts));
    if (v !== null) v = lerp(v, 56 + 1.5 * noise1(ts * 2, 4), good);
    const x = r.x + 10 + ((r.w - 20) * k) / (N - 1);
    if (v === null) {
      open = false;
      continue;
    }
    if (open) ctx.lineTo(x, lineY(v));
    else ctx.moveTo(x, lineY(v));
    open = true;
  }
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- карточка ролика

/** Накладки карточки-ролика: значок YouTube и полоса прогресса. */
function videoOverlay(ctx: Ctx, r: Rect, gen: number, gt: number): void {
  ctx.save();
  ctx.fillStyle = a(C.bg, 0.6);
  rrPath(ctx, r.x + 14, r.y + 14, 92, 64, 12);
  ctx.fill();
  icon(ctx, 'youtube', r.x + 60, r.y + 46, 60, C.accent, gt);
  const bx = r.x + 18;
  const by = r.y + r.h - 22;
  const bw = r.w - 36;
  ctx.fillStyle = a(C.text, 0.18);
  rrPath(ctx, bx, by, bw, 8, 4);
  ctx.fill();
  const e = easeOutQuart(clamp01(gen));
  if (e > 0) {
    ctx.fillStyle = C.accent;
    rrPath(ctx, bx, by, bw * e, 8, 4);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx + bw * e, by + 4, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Карточка-ролик: «за секунды» проявляется красивая генерация. Картинка вертикальная —
 * по бокам та же картинка, растянутая и размытая, как вертикальное видео в плеере.
 */
function videoCard(ctx: Ctx, r: Rect, file: string, gen: number, gt: number): void {
  ctx.save();
  rrPath(ctx, r.x, r.y, r.w, r.h, 12);
  ctx.clip();
  ctx.fillStyle = SCREEN_BG;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const im = picture(file);
  if (im) {
    const iw = im.naturalWidth;
    const ih = im.naturalHeight;
    // лёгкий наезд, пока ролик «идёт»
    const zoom = 1 + 0.04 * easeOutQuart(clamp01(gen));
    scanReveal(ctx, r, gen, () => {
      const kb = Math.max(r.w / iw, r.h / ih) * 1.1;
      ctx.save();
      ctx.filter = 'blur(16px) brightness(0.6)';
      ctx.drawImage(im, r.x + (r.w - iw * kb) / 2, r.y + (r.h - ih * kb) / 2, iw * kb, ih * kb);
      ctx.restore();
      // без серой рамки галереи по краям; подпись автора — над полосой прогресса
      const e = 3;
      const k = ((r.h - 30) / (ih - e)) * zoom;
      ctx.drawImage(im, e, e, iw - 2 * e, ih - e, r.x + (r.w - (iw - 2 * e) * k) / 2, r.y + (r.h - 30 - (ih - e) * k) / 2, (iw - 2 * e) * k, (ih - e) * k);
    }, C.accent);
  }
  ctx.restore();
  ctx.strokeStyle = a(C.h1, 0.4);
  ctx.lineWidth = 2;
  rrPath(ctx, r.x, r.y, r.w, r.h, 12);
  ctx.stroke();
  videoOverlay(ctx, r, gen, gt);
}

// ---------------------------------------------------------------- сцена

export const scene02: SceneDef = {
  id: 's02',

  energy: (_t, cue) =>
    Math.max(
      0.5 * seg(cue('notsame').p, 0.35, 0.3) * (1 - seg(cue('fixes').t, 0, 0.6)),
      0.6 * seg(cue('iron').p, 0.1, 0.3) * (1 - seg(cue('iron').p, 0.5, 0.15)),
    ),

  render(f: Frame) {
    const { ctx, gt } = f;
    const cY = f.cue('youtube');
    const cN = f.cue('notsame');
    const cX = f.cue('fixes');
    const cP = f.cue('picture');
    const cF = f.cue('fps');
    const cW = f.cue('weak');
    const cI = f.cue('iron');

    // заголовок «Game Ready ассеты» — со второй половины реплики, когда его произносят
    const ironAt = cI.dur * 0.5;
    const cI2: CueTime = { ...cI, t: cI.t - ironAt, began: cI.t >= ironAt };
    titles(f, [{ c: cY }, { c: cN }, { c: cX }, { c: cP }, { c: cW }, { c: cI2, color: C.pos }]);

    // ---- где плотный огр на каждом этапе
    const kF = easeInOutCubic(seg(cX.t, -0.2, 0.9));
    const kP = easeInOutCubic(seg(cP.t, 0.15, 0.8));
    const kS = easeInOutCubic(seg(cF.t, -0.1, 0.9));
    const kH = easeInOutCubic(seg(cI.t, 0, 1.0));
    let R = lerpRect(R_LEFT, R_FIX, kF);
    R = lerpRect(R, R_PIC, kP);
    R = lerpRect(R, R_SCR, kS);
    R = lerpRect(R, R_HOT, kH);

    // ---- этап 1: сетка роликов
    const genP = (i: number) => seg(cY.t, 0.25 + i * 0.5, 1.7);
    const gridOut = seg(cN.t, -0.3, 0.6);
    for (let i = 0; i < 6; i++) {
      const r = cardRect(i);
      f.obj(`card:${i}`, { x: r.x + r.w / 2, y: r.y + r.h / 2, abs: true, label: `Ролик ${i + 1}` }, () => {
        stage(ctx, seg(cY.t, i * 0.12, 0.5), gridOut, () => videoCard(ctx, r, GALLERY[i], genP(i), gt + i * 1.7), {
          dy: 40,
          cx: r.x + r.w / 2,
          cy: r.y + r.h / 2,
          to: 0.9,
        });
      });
    }

    // ---- состояние плотного огра
    const fixOn = cX.t >= 0.35 && cP.t < 0.08;
    const picStyle = seg(cP.t, 0.15, 0.3);
    const lapStyle = seg(cW.t, -0.1, 0.6);
    const flash = seg(cP.t, 0, 0.5);
    const heat = seg(cW.t, 0.3, 1.5) * 0.35 + seg(cI.p, 0.05, 0.35) * 0.65;
    const relief = seg(cI.p, 0.52, 0.18);
    const hot = heat * (1 - relief);
    const badAt = (ts: number) => seg(ts, cW.start + 0.4, 0.9) * (1 - seg(ts, cI.start + cI.dur * 0.5, 0.6));
    const hudH = 130 * kS;
    // вращение: свободное → замерло на проблемах и картинке → снова крутится; на слабой машине — рывками
    const stutter = badAt(f.t) > 0.5;
    const spinT = stutter ? Math.floor(gt * 2.5) / 2.5 : gt;
    const still = seg(cX.t, -0.2, 0.8) * (1 - seg(cF.t, 0, 0.6));
    const fixSway = Math.sin(gt * 0.6) * 0.1 * (1 - picStyle);
    const yaw = lerp(0.3 + Math.sin(spinT * 0.6) * 0.7, FIX_YAW + fixSway, still);

    // плотная модель появляется на «Но красивая модель…», когда уходит сетка роликов
    const heroIn = easeOutQuart(seg(cN.t, -0.1, 0.5));
    f.obj('hero', { x: R_FIX.x + R_FIX.w / 2, y: R_FIX.y + R_FIX.h / 2, abs: true, label: 'Плотная модель' }, () => {
      if (heroIn <= 0) return;
      ctx.save();
      ctx.globalAlpha *= heroIn;
      // ноутбук вокруг экрана
      if (lapStyle > 0) {
        ctx.save();
        ctx.globalAlpha *= lapStyle;
        if (hot > 0.3) ctx.translate(Math.sin(gt * 47) * 3 * hot, Math.cos(gt * 39) * 2 * hot);
        laptop(ctx, R, { heat: hot, t: gt });
        ctx.restore();
      }
      // «картинка» чуть наклонена
      const tilt = -0.035 * picStyle * (1 - kS);
      ctx.translate(R.x + R.w / 2, R.y + R.h / 2);
      ctx.rotate(tilt);
      ctx.translate(-(R.x + R.w / 2), -(R.y + R.h / 2));

      // подложка: экран → фотобумага → экран ноутбука
      ctx.save();
      rrPath(ctx, R.x, R.y, R.w, R.h, 12);
      ctx.clip();
      ctx.fillStyle = SCREEN_BG;
      ctx.fillRect(R.x, R.y, R.w, R.h);
      const ph = picStyle * (1 - lapStyle);
      if (ph > 0) {
        const g = ctx.createLinearGradient(0, R.y, 0, R.y + R.h);
        g.addColorStop(0, a(C.accent, 0.2 * ph));
        g.addColorStop(1, a(C.bg, 0.6 * ph));
        ctx.fillStyle = g;
        ctx.fillRect(R.x, R.y, R.w, R.h);
        softLight(ctx, R.x + R.w / 2, R.y + R.h * 0.45, R.w * 0.45, C.accent, 0.22 * ph);
      }

      const view = heroView(R, hudH, yaw);
      const heroGone = seg(cI.p, 0.48, 0.12);
      if (heroGone < 1) {
        ctx.save();
        ctx.globalAlpha *= 1 - heroGone;
        const parts = fixOn ? BUGGY : mage(ogrePose('idle', gt * 0.4)).parts;
        const wireA = fixOn ? 0.4 : 0.22 * (1 - picStyle * (1 - lapStyle));
        groundShadow(ctx, view, 0, 0, 1.0, 0.8, 0.4);
        const draw = () => drawModel(ctx, parts, view, {}, { wire: wireA > 0.02 ? a(C.bg, wireA) : undefined, wireWidth: 0.5, ambient: ph > 0.5 ? 0.4 : 0.32 });
        scanReveal(ctx, R, seg(cN.t, 0, 1.2), draw, C.accent);
        ctx.restore();
      }
      // Game Ready ассеты на экране
      const arrive = seg(cI.p, 0.46, 0.14);
      if (arrive > 0) {
        const av: View = { ...heroView(R, hudH, 0.35 + Math.sin(gt * 0.4) * 0.3), size: ((R.h - hudH) * 0.62) / 2.2, pitch: 0.22 };
        const k = easeOutBack(arrive, 1.4);
        groundShadow(ctx, av, 0, 0, 2.8, 1.2, 0.4 * arrive);
        drawModel(
          ctx,
          [
            ...place(mage(walkCycle(f.t / mageWalkCycle(), MAGE_GAIT.L).pose, { lod: 1 }).parts, { pos: [-1.5, 0, 0.3], ry: 0.5 }),
            ...place(tankParts({ turret: Math.sin(gt * 0.6) * 0.4 }), { pos: [1.4, 0, 0], ry: -0.4, scale: 1.3 }),
          ],
          av,
          { scale: Math.max(0.05, k) },
          { wire: a(C.bg, 0.5), wireWidth: 1 },
        );
        shockRing(ctx, R.x + R.w / 2, R.y + R.h * 0.5, arrive * 1.2, R.w * 0.6, C.pos, 4);
      }
      // HUD кадров
      if (kS > 0) {
        ctx.save();
        ctx.globalAlpha *= kS;
        fpsGraph(ctx, { x: R.x + 18, y: R.y + R.h - hudH + 4, w: R.w - 36, h: hudH - 22 }, f.t, badAt, relief);
        ctx.restore();
      }
      // вспышка «снимка»
      if (flash > 0 && flash < 1) {
        ctx.fillStyle = a(C.text, 0.85 * (1 - easeOutQuart(flash)));
        ctx.fillRect(R.x, R.y, R.w, R.h);
      }
      ctx.restore();

      // рамка: экран / фото
      if (lapStyle < 1) {
        ctx.save();
        ctx.globalAlpha *= 1 - lapStyle;
        ctx.strokeStyle = a(ph > 0.5 ? C.accent : C.h1, 0.45 + 0.15 * ph);
        ctx.lineWidth = 2 + ph;
        rrPath(ctx, R.x, R.y, R.w, R.h, 12);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      // отметки «не играбельно» / «играбельно»
      crossBadge(ctx, R.x + R.w - 6, R.y + 6, 44, seg(cW.p, 0.45, 0.15) * (1 - seg(cI.p, 0.5, 0.06)));
      checkBadge(ctx, R.x + R.w - 6, R.y + 6, 44, seg(cI.p, 0.62, 0.12));
    });

    // ---- этап 1б: огр игры и знак ≠
    const ogreOut = seg(cX.t, -0.3, 0.6);
    f.obj('ogre', { x: R_OGRE.x + R_OGRE.w / 2, y: R_OGRE.y + R_OGRE.h / 2, abs: true, label: 'Игровая модель' }, () => {
      stage(
        ctx,
        seg(cN.t, 0.35, 0.7),
        ogreOut,
        () => {
          const r = R_OGRE;
          ctx.save();
          rrPath(ctx, r.x, r.y, r.w, r.h, 12);
          ctx.clip();
          ctx.fillStyle = SCREEN_BG;
          ctx.fillRect(r.x, r.y, r.w, r.h);
          const view = heroView(r, 0, 0.3 + Math.sin(gt * 0.6) * 0.7);
          softLight(ctx, view.cx, r.y + r.h * 0.45, 360, C.pos, 0.1);
          grassGround(ctx, view, 1.7, { tile: 2.2 });
          groundShadow(ctx, view, 0, 0, 1.0, 0.8, 0.45);
          drawModel(ctx, mage(ogrePose('idle', gt * 0.4), { lod: 2 }).parts, view, {}, { wire: a(C.bg, 0.55), wireWidth: 1.1 });
          ctx.restore();
          ctx.strokeStyle = a(C.pos, 0.5);
          ctx.lineWidth = 2;
          rrPath(ctx, r.x, r.y, r.w, r.h, 12);
          ctx.stroke();
        },
        { dx: 80, outDx: 240 },
      );
    });
    // подписи уровней детализации в углах экранов
    const lodLabel = (id: string, r: Rect, txt: string, color: string, out: number) => {
      f.obj(id, { x: r.x + 34, y: r.y + 74, text: txt, label: `Подпись ${txt}` }, (o) => {
        const p = seg(cN.t, 0.5, 0.4) * (1 - out);
        if (p <= 0) return;
        ctx.save();
        ctx.globalAlpha *= p;
        text(ctx, o.text, 0, 0, { size: 60, color, tracking: 1.5 });
        ctx.restore();
      });
    };
    lodLabel('lod0', R_LEFT, 'LOD0', C.h1, seg(cX.t, -0.3, 0.3));
    lodLabel('lod2', R_OGRE, 'LOD2', C.pos, ogreOut);

    f.obj('neq', { x: 960, y: 665, abs: true, label: 'Знак ≠' }, () => {
      stage(ctx, 1, ogreOut, () => {
        const p = seg(cN.p, 0.4, 0.3);
        if (p <= 0) return;
        softLight(ctx, 960, 665, 160, C.accent, 0.2 * p);
        notEqual(ctx, 960, 665, 130, p, C.accent);
      });
    });

    // ---- этап 2: три проблемы — значки и выноски к местам на огре
    const fixView = heroView(R_FIX, 0, FIX_YAW + Math.sin(gt * 0.6) * 0.1);
    const spot = (s: Spot): P2 => toScreen(partPoint(BUGGY_BODY, SPOT_AT.get(s)!), fixView);
    const ISSUES: Array<{ icon: string; at: number; y: number; target: P2 }> = [
      { icon: 'wrench', at: 0.2, y: 430, target: spot(SPOT_MARK) },
      { icon: 'bug', at: 0.42, y: 660, target: spot(SPOT_HOLE) },
      { icon: 'bolt', at: 0.62, y: 890, target: spot(SPOT_BOLT) },
    ];
    const issuesOut = seg(cP.t, 0, 0.4);
    ISSUES.forEach((it, i) => {
      const bx = 1430;
      f.obj(`issue:${i}`, { x: bx, y: it.y, abs: true, label: `Проблема ${i + 1}` }, () => {
        const p = seg(cX.p, it.at, 0.14);
        if (p <= 0 || issuesOut >= 1) return;
        ctx.save();
        ctx.globalAlpha *= Math.min(1, p * 2.5) * (1 - issuesOut);
        // выноска
        const lk = easeOutQuart(seg(cX.p, it.at + 0.04, 0.12));
        const [tx, ty] = it.target;
        ctx.strokeStyle = a(C.accent, 0.75);
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.moveTo(bx - 84, it.y);
        ctx.lineTo(lerp(bx - 84, tx, lk), lerp(it.y, ty, lk));
        ctx.stroke();
        ctx.setLineDash([]);
        if (lk > 0.95) {
          ctx.fillStyle = C.accent;
          ctx.beginPath();
          ctx.arc(tx, ty, 9 + Math.sin(gt * 6 + i) * 2, 0, Math.PI * 2);
          ctx.fill();
          shockRing(ctx, tx, ty, (gt * 0.8 + i * 0.3) % 1, 60, C.accent, 3);
        }
        // значок
        const s = easeOutBack(p, 2);
        ctx.translate(bx, it.y);
        ctx.scale(s, s);
        softLight(ctx, 0, 0, 150, C.accent, 0.14);
        hexPath(ctx, 0, 0, 84, Math.PI / 6);
        ctx.fillStyle = C.panel;
        ctx.fill();
        ctx.strokeStyle = a(C.accent, 0.7);
        ctx.lineWidth = 3;
        ctx.stroke();
        icon(ctx, it.icon, 0, 0, 92, C.accent, gt);
        ctx.restore();
      });
    });

    // ---- этап 3: «30-40» в секунду, хорошо на YouTube
    const leftOut = seg(cI.t, -0.1, 0.7);
    const leftDim = seg(cW.t, 0.2, 0.6) * 0.6;
    ctx.save();
    ctx.globalAlpha *= 1 - leftDim;
    f.obj('fps', { x: 150, y: 610, abs: true, text: cF.show, label: 'Кадры в секунду' }, (o) => {
      stage(ctx, 1, leftOut, () => {
        reveal(
          ctx,
          o.text,
          150,
          610,
          { size: 290, color: C.accent, tracking: 2, glowColor: a(C.accent, 0.35), glowBlur: 40 },
          seg(cF.p, 0.14, 0.1),
          { from: 0.6, rise: 40 },
        );
      }, { outDx: -200 });
    });
    f.obj('fps-unit', { x: 160, y: 700, abs: true, text: 'в секунду', label: 'Подпись «в секунду»' }, (o) => {
      stage(ctx, 1, leftOut, () => {
        reveal(ctx, o.text, 160, 700, { size: 70, color: a(C.text, 0.8), tracking: 2 }, seg(cF.p, 0.3, 0.1));
      }, { outDx: -200 });
    });
    f.obj('yt', { x: 240, y: 850, abs: true, label: 'YouTube' }, () => {
      stage(ctx, 1, leftOut, () => {
        const p = seg(cF.p, 0.66, 0.1);
        if (p <= 0) return;
        ctx.save();
        ctx.globalAlpha *= Math.min(1, p * 3);
        softLight(ctx, 240, 850, 160, C.accent, 0.14);
        icon(ctx, 'youtube', 240, 850, 150 * easeOutBack(p, 1.8), C.accent, gt);
        ctx.restore();
        checkBadge(ctx, 345, 800, 36, seg(cF.p, 0.8, 0.1));
      }, { outDx: -200 });
    });
    ctx.restore();
  },
};
