/** Детерминированный рендер ролика по времени: расписание + код сцен. */

import { clamp01, seg } from './anim.ts';
import { placeholderScene } from './placeholder.ts';
import { buildSchedule, slideAt, type SchedCue, type SchedSlide, type Schedule } from './schedule.ts';
import { C, FONT, H, SAFE_BOTTOM, setStyle, W } from './theme.ts';
import { TIMING } from './timing.ts';
import type { CueTime, DeckData, Frame, ObjOpts, ObjState, SceneDef } from './types.ts';

type Ctx = CanvasRenderingContext2D;

/** Что редактор знает об объекте сцены в текущем кадре. */
export interface ObjInfo {
  id: string;
  label: string;
  /** Значения из кода сцены. */
  base: { x: number; y: number; text: string | null };
  /** Значения с учётом правок редактора. */
  cur: ObjState;
  hidden: boolean;
  /** Видимые границы в координатах кадра 1920×1080; `null` — в этом кадре объекта не видно. */
  bbox: { x: number; y: number; w: number; h: number } | null;
  /** Опорная точка в координатах кадра. */
  pivot: { x: number; y: number };
  /** Перевод сдвига в кадре в сдвиг в координатах сцены: [a, b, c, d]. */
  inv: [number, number, number, number];
  /** Попадает ли точка кадра в нарисованные пиксели объекта. */
  hit(px: number, py: number): boolean;
}

export interface ProbeResult {
  slideId: string;
  objects: ObjInfo[];
}

/** Порог альфы: мягкие свечения не раздувают рамку объекта. */
const ALPHA_MIN = 28;

interface Probe {
  ctx: Ctx;
  /** Масштаб зондирующего канваса относительно кадра. */
  k: number;
  /** Мерить только этот объект (остальные просто рисуются). */
  only?: string;
  out: ObjInfo[];
}

export class Timeline {
  readonly schedule: Schedule;
  /** id сцен с ошибкой в последнем кадре: слайд → сообщение. */
  readonly errors = new Map<string, string>();
  /** Реплики, которых сцена просила, а в данных их нет: «слайд/реплика». */
  readonly missingCues = new Set<string>();

  readonly deck: DeckData;
  private readonly scenes: Map<string, SceneDef>;

  constructor(deck: DeckData, scenes: Map<string, SceneDef>) {
    this.deck = deck;
    this.scenes = scenes;
    this.schedule = buildSchedule(deck);
  }

  get duration(): number {
    return this.schedule.duration;
  }

  sceneFor(slideId: string): SceneDef | null {
    return this.scenes.get(slideId) ?? null;
  }

  slideAt(gt: number): SchedSlide | null {
    return slideAt(this.schedule, gt);
  }

  /** Энергия момента (0..1) — фон подсвечивается на кульминациях. */
  energyAt(gt: number): number {
    const sc = this.slideAt(gt);
    const scene = sc && this.scenes.get(sc.slide.id);
    if (!sc || !scene?.energy) return 0;
    const t = gt - sc.start;
    const byId = new Map(sc.cues.map((c) => [c.id, toCueTime(c, t)]));
    try {
      return clamp01(scene.energy(t, (id) => byId.get(id) ?? emptyCue(id)));
    } catch {
      return 0;
    }
  }

  /**
   * Рендер контента слайда. Фон рисуется отдельно и живёт непрерывно,
   * поэтому здесь только затемнение контента на стыках.
   */
  render(ctx: Ctx, gt: number): void {
    this.renderSlide(ctx, gt, null);
  }

  /**
   * Зондирование объектов текущего кадра для редактора: каждый объект рисуется
   * в одиночку на маленьком канвасе, по альфе считаются рамка и маска попадания.
   */
  probe(gt: number, canvas: HTMLCanvasElement, only?: string): ProbeResult {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const sc = this.slideAt(gt);
    if (!ctx || !sc) return { slideId: '', objects: [] };
    const k = canvas.width / W;
    const probe: Probe = { ctx, k, only, out: [] };
    ctx.setTransform(k, 0, 0, k, 0, 0);
    this.renderSlide(ctx, gt, probe);
    return { slideId: sc.slide.id, objects: probe.out };
  }

  private renderSlide(ctx: Ctx, gt: number, probe: Probe | null): void {
    const sc = this.slideAt(gt);
    if (!sc) return;
    setStyle(this.deck.style);
    const slide = sc.slide;
    const scene = this.scenes.get(slide.id) ?? placeholderScene;
    const t = gt - sc.start;
    const cues = sc.cues.map((c) => toCueTime(c, t));
    const byId = new Map(cues.map((c) => [c.id, c]));
    /** Объект внутри объекта редактору не виден: рисуется как часть внешнего. */
    let depth = 0;

    const frame: Frame = {
      ctx,
      t,
      dur: sc.dur,
      gt,
      index: sc.index,
      cues,
      cue: (id: string) => {
        const c = byId.get(id);
        if (c) return c;
        this.missingCues.add(`${slide.id}/${id}`);
        return emptyCue(id);
      },
      obj: (id: string, o: ObjOpts, draw: (s: ObjState) => void) => {
        const ov = slide.objects?.[id];
        const state: ObjState = {
          x: ov?.x ?? o.x,
          y: ov?.y ?? o.y,
          scale: ov?.scale ?? 1,
          text: ov?.text ?? o.text ?? '',
        };
        const hidden = !!ov?.hidden;
        if (hidden && !probe) return;

        const zond = depth === 0 && (!probe?.only || probe.only === id) ? probe : null;
        const before = zond ? ctx.getTransform() : null;
        if (zond) clearAll(ctx);
        ctx.save();
        // abs: сдвиг и масштаб одним преобразованием — без правок из редактора это точный ноль,
        // и кадр остаётся бит-в-бит таким же, как без f.obj
        const tx = o.abs ? state.x - o.x * state.scale : state.x;
        const ty = o.abs ? state.y - o.y * state.scale : state.y;
        if (tx !== 0 || ty !== 0) ctx.translate(tx, ty);
        if (state.scale !== 1) ctx.scale(state.scale, state.scale);
        depth++;
        try {
          if (!hidden) draw(state);
        } finally {
          depth--;
          ctx.restore();
        }
        if (zond && before) zond.out.push(measure(zond, id, o, state, hidden, before));
      },
    };

    const f = TIMING.fade;
    const fadeIn = sc.index === 0 ? 1 : seg(t, 0, f);
    const fadeOut = 1 - seg(t, sc.dur - f, f);
    // зонд меряет объекты при полной непрозрачности, чтобы их было видно и на стыках
    const alpha = probe ? 1 : Math.min(fadeIn, fadeOut);

    ctx.save();
    ctx.globalAlpha = alpha;
    // Ужимаем контент к верху кадра: низ остаётся свободным под проигрыватель.
    const k = (H - SAFE_BOTTOM) / H;
    ctx.translate(W / 2, 0);
    ctx.scale(k, k);
    ctx.translate(-W / 2, 0);
    // Лёгкий вертикальный сдвиг на входе/выходе — контент «дышит» между сценами.
    if (!probe) ctx.translate(0, (1 - fadeIn) * 26 - (1 - fadeOut) * 26);
    try {
      scene.render(frame);
      this.errors.delete(slide.id);
    } catch (e) {
      this.errors.set(slide.id, e instanceof Error ? e.message : String(e));
      if (!probe) drawError(ctx, slide.id, this.errors.get(slide.id) ?? '');
    }
    ctx.restore();
  }
}

function clearAll(ctx: Ctx): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

/** Рамка и маска объекта по альфе того, что он только что нарисовал. */
function measure(
  probe: Probe,
  id: string,
  o: ObjOpts,
  state: ObjState,
  hidden: boolean,
  m: DOMMatrix,
): ObjInfo {
  const { ctx, k } = probe;
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  const data = ctx.getImageData(0, 0, cw, ch).data;
  const mask = new Uint8Array(cw * ch);
  let x0 = cw;
  let y0 = ch;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0, i = 3, j = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++, i += 4, j++) {
      if (data[i] < ALPHA_MIN) continue;
      mask[j] = 1;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  const bbox =
    x1 < 0 ? null : { x: x0 / k, y: y0 / k, w: (x1 - x0 + 1) / k, h: (y1 - y0 + 1) / k };

  // линейная часть преобразования сцены относительно кадра
  const a = m.a / k;
  const b = m.b / k;
  const c = m.c / k;
  const d = m.d / k;
  const det = a * d - b * c || 1;

  return {
    id,
    label: o.label ?? id,
    base: { x: o.x, y: o.y, text: o.text ?? null },
    cur: state,
    hidden,
    bbox,
    pivot: {
      x: (m.a * state.x + m.c * state.y + m.e) / k,
      y: (m.b * state.x + m.d * state.y + m.f) / k,
    },
    inv: [d / det, -b / det, -c / det, a / det],
    hit: (px, py) => {
      const ix = Math.floor(px * k);
      const iy = Math.floor(py * k);
      return ix >= 0 && iy >= 0 && ix < cw && iy < ch && mask[iy * cw + ix] === 1;
    },
  };
}

function drawError(ctx: Ctx, slideId: string, message: string): void {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(20, 22, 26, 0.82)';
  ctx.fillRect(150, 380, W - 300, 320);
  ctx.fillStyle = '#ff7b6b';
  ctx.font = `700 64px ${FONT.sans}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`Ошибка в сцене ${slideId}`, 200, 480);
  ctx.fillStyle = C.text;
  ctx.font = `400 34px ${FONT.mono}`;
  ctx.fillText(message.slice(0, 84), 200, 560);
  ctx.restore();
}

/** Реплика, которой нет в данных: никогда не начинается, сцена просто её не покажет. */
function emptyCue(id: string): CueTime {
  return {
    id,
    say: '',
    show: '',
    start: 1e9,
    end: 1e9,
    dur: 1,
    t: -1e9,
    p: 0,
    on: false,
    began: false,
    done: false,
  };
}

function toCueTime(c: SchedCue, sceneT: number): CueTime {
  const t = sceneT - c.start;
  return {
    id: c.id,
    say: c.say,
    show: c.show,
    start: c.start,
    end: c.start + c.dur,
    dur: c.dur,
    t,
    p: clamp01(t / c.dur),
    on: t >= 0 && t < c.dur,
    began: t >= 0,
    done: t >= c.dur,
  };
}
