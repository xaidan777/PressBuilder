/**
 * Расписание ролика: когда начинается каждый слайд и каждая реплика.
 * Чистая функция от данных колоды — без канваса, поэтому работает и в Node
 * (`npm run timing`).
 */

import { cueDuration, TIMING } from './timing.ts';
import type { Cue, DeckData, SlideData } from './types.ts';

export interface SchedCue {
  id: string;
  say: string;
  show: string;
  /** Начало относительно старта слайда, сек. */
  start: number;
  dur: number;
  /** Длительность задана вручную (`cue.dur`), а не выведена из текста. */
  manual: boolean;
}

export interface SchedSlide {
  slide: SlideData;
  index: number;
  /** Глобальное время старта слайда. */
  start: number;
  dur: number;
  lead: number;
  tail: number;
  cues: SchedCue[];
}

export interface Schedule {
  slides: SchedSlide[];
  duration: number;
  /** Длина без подгонки под хронометраж. */
  natural: number;
  /** Во сколько раз расписание сжато (<1) или растянуто (>1) под `target`. */
  scale: number;
}

/** Длительность реплики до подгонки: ручная или выведенная из текста. */
export function naturalCue(c: Cue): number {
  return c.dur && c.dur > 0 ? c.dur : cueDuration(c.say, c.rate ?? 1, c.hold ?? 0);
}

export const slideLead = (deck: DeckData, s: SlideData) => s.lead ?? deck.lead ?? TIMING.lead;
export const slideTail = (deck: DeckData, s: SlideData) => s.tail ?? deck.tail ?? TIMING.tail;

export function naturalDuration(deck: DeckData): number {
  return deck.slides.reduce(
    (sum, s) =>
      sum + slideLead(deck, s) + slideTail(deck, s) + s.cues.reduce((d, c) => d + naturalCue(c), 0),
    0,
  );
}

export function buildSchedule(deck: DeckData): Schedule {
  const natural = naturalDuration(deck);
  const scale = deck.target && natural > 0 ? deck.target / natural : 1;
  const slides: SchedSlide[] = [];
  let cursor = 0;
  deck.slides.forEach((slide, index) => {
    const lead = slideLead(deck, slide) * scale;
    const tail = slideTail(deck, slide) * scale;
    let local = lead;
    const cues: SchedCue[] = slide.cues.map((c) => {
      const dur = naturalCue(c) * scale;
      const item: SchedCue = {
        id: c.id,
        say: c.say,
        show: c.show?.trim() ? c.show : c.say,
        start: local,
        dur,
        manual: !!(c.dur && c.dur > 0),
      };
      local += dur;
      return item;
    });
    const dur = local + tail;
    slides.push({ slide, index, start: cursor, dur, lead, tail, cues });
    cursor += dur;
  });
  // при подгонке берём цель как есть: сумма с плавающей точкой даёт 149.9999…
  const duration = deck.target && cursor > 0 ? deck.target : cursor;
  return { slides, duration, natural, scale };
}

/** Слайд, активный в глобальный момент `gt`. */
export function slideAt(s: Schedule, gt: number): SchedSlide | null {
  const list = s.slides;
  for (let i = 0; i < list.length; i++) {
    if (gt < list[i].start + list[i].dur) return list[i];
  }
  return list[list.length - 1] ?? null;
}
