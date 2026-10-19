/** Операции над роликом: реплики, слайды, объекты. Все идут через `update()` — в историю и на диск. */

import { autoLabel } from '../engine/split.ts';
import type { Cue, DeckData, ObjOverride, SlideData } from '../engine/types.ts';
import { sel, update, type UpdateOpts } from './store.ts';

const pad2 = (n: number) => String(n).padStart(2, '0');

function nextId(used: string[], prefix: string): string {
  let max = 0;
  for (const id of used) {
    const m = new RegExp(`^${prefix}(\\d+)$`).exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  let n = max + 1;
  while (used.includes(`${prefix}${pad2(n)}`)) n++;
  return `${prefix}${pad2(n)}`;
}

const newCueId = (d: DeckData) => nextId(d.slides.flatMap((s) => s.cues.map((c) => c.id)), 'c');
const newSlideId = (d: DeckData) => nextId(d.slides.map((s) => s.id), 's');

const slideOf = (d: DeckData, id: string) => d.slides.find((s) => s.id === id);
const cueOf = (s: SlideData | undefined, id: string) => s?.cues.find((c) => c.id === id);

/** Пустые и «как по умолчанию» поля в JSON не храним. */
function tidyCue(c: Cue): void {
  if (!c.show?.trim()) delete c.show;
  if (!c.hold) delete c.hold;
  if (!c.rate || c.rate === 1) delete c.rate;
  if (!c.dur || c.dur <= 0) delete c.dur;
}

// ------------------------------------------------------------------ реплики

export function patchCue(slideId: string, cueId: string, patch: Partial<Cue>, o?: UpdateOpts): void {
  update((d) => {
    const c = cueOf(slideOf(d, slideId), cueId);
    if (!c) return;
    Object.assign(c, patch);
    tidyCue(c);
  }, o);
}

/** Разрезать реплику по позиции курсора в тексте озвучки. */
export function splitCue(slideId: string, cueId: string, caret: number): void {
  update((d) => {
    const s = slideOf(d, slideId);
    const i = s?.cues.findIndex((c) => c.id === cueId) ?? -1;
    if (!s || i < 0) return;
    const c = s.cues[i];
    const head = c.say.slice(0, caret).trim();
    const rest = c.say.slice(caret).trim();
    if (!head || !rest) return;
    c.say = head;
    delete c.dur;
    const added: Cue = { id: newCueId(d), say: rest };
    s.cues.splice(i + 1, 0, added);
    sel.value = { kind: 'cue', slide: slideId, cue: added.id };
  });
}

export function mergeCueWithNext(slideId: string, cueId: string): void {
  update((d) => {
    const s = slideOf(d, slideId);
    const i = s?.cues.findIndex((c) => c.id === cueId) ?? -1;
    if (!s || i < 0 || i >= s.cues.length - 1) return;
    const [a, b] = [s.cues[i], s.cues[i + 1]];
    a.say = `${a.say.trim()} ${b.say.trim()}`;
    if (a.show || b.show) a.show = [a.show, b.show].filter(Boolean).join(' ');
    a.hold = b.hold;
    delete a.dur;
    tidyCue(a);
    s.cues.splice(i + 1, 1);
  });
}

export function addCueAfter(slideId: string, cueId: string | null): void {
  update((d) => {
    const s = slideOf(d, slideId);
    if (!s) return;
    const i = cueId ? s.cues.findIndex((c) => c.id === cueId) : s.cues.length - 1;
    const added: Cue = { id: newCueId(d), say: 'Новая реплика.' };
    s.cues.splice(i + 1, 0, added);
    sel.value = { kind: 'cue', slide: slideId, cue: added.id };
  });
}

export function deleteCue(slideId: string, cueId: string): void {
  update((d) => {
    const s = slideOf(d, slideId);
    if (!s) return;
    s.cues = s.cues.filter((c) => c.id !== cueId);
    sel.value = { kind: 'slide', slide: slideId };
  });
}

/** Первая реплика слайда уходит в конец предыдущего, последняя — в начало следующего. */
export function moveCueAcross(slideId: string, cueId: string, dir: -1 | 1): void {
  update((d) => {
    const si = d.slides.findIndex((s) => s.id === slideId);
    const s = d.slides[si];
    const target = d.slides[si + dir];
    if (!s || !target) return;
    const ci = s.cues.findIndex((c) => c.id === cueId);
    if (ci !== (dir < 0 ? 0 : s.cues.length - 1)) return;
    const [c] = s.cues.splice(ci, 1);
    if (dir < 0) target.cues.push(c);
    else target.cues.unshift(c);
    sel.value = { kind: 'cue', slide: target.id, cue: c.id };
  });
}

/** Перекатить время между двумя соседними репликами (общая длина не меняется). */
export function rollCues(
  a: { slide: string; cue: string; dur: number },
  b: { slide: string; cue: string; dur: number },
): void {
  update(
    (d) => {
      const ca = cueOf(slideOf(d, a.slide), a.cue);
      const cb = cueOf(slideOf(d, b.slide), b.cue);
      if (!ca || !cb) return;
      ca.dur = Math.round(a.dur * 1000) / 1000;
      cb.dur = Math.round(b.dur * 1000) / 1000;
    },
    { merge: true },
  );
}

// ------------------------------------------------------------------ слайды

export function patchSlide(slideId: string, patch: Partial<SlideData>, o?: UpdateOpts): void {
  update((d) => {
    const s = slideOf(d, slideId);
    if (!s) return;
    Object.assign(s, patch);
    if (s.lead === undefined || Number.isNaN(s.lead)) delete s.lead;
    if (s.tail === undefined || Number.isNaN(s.tail)) delete s.tail;
  }, o);
}

/** Новый слайд начинается с указанной реплики. */
export function splitSlideAt(slideId: string, cueId: string): void {
  update((d) => {
    const si = d.slides.findIndex((s) => s.id === slideId);
    const s = d.slides[si];
    const ci = s?.cues.findIndex((c) => c.id === cueId) ?? -1;
    if (!s || ci <= 0) return;
    const cues = s.cues.splice(ci);
    const added: SlideData = { id: newSlideId(d), label: autoLabel(cues[0].say), cues };
    d.slides.splice(si + 1, 0, added);
    sel.value = { kind: 'slide', slide: added.id };
  });
}

export function mergeSlideWithNext(slideId: string): void {
  update((d) => {
    const si = d.slides.findIndex((s) => s.id === slideId);
    const [s, next] = [d.slides[si], d.slides[si + 1]];
    if (!s || !next) return;
    s.cues.push(...next.cues);
    d.slides.splice(si + 1, 1);
  });
}

export function addSlideAfter(slideId: string | null): void {
  update((d) => {
    const si = slideId ? d.slides.findIndex((s) => s.id === slideId) : d.slides.length - 1;
    const added: SlideData = {
      id: newSlideId(d),
      label: 'Новый слайд',
      cues: [{ id: newCueId(d), say: 'Новая реплика.' }],
    };
    d.slides.splice(si + 1, 0, added);
    sel.value = { kind: 'slide', slide: added.id };
  });
}

export function deleteSlide(slideId: string): void {
  update((d) => {
    if (d.slides.length <= 1) return;
    d.slides = d.slides.filter((s) => s.id !== slideId);
    sel.value = { kind: 'none' };
  });
}

export function moveSlide(slideId: string, dir: -1 | 1): void {
  update((d) => {
    const si = d.slides.findIndex((s) => s.id === slideId);
    const to = si + dir;
    if (si < 0 || to < 0 || to >= d.slides.length) return;
    const [s] = d.slides.splice(si, 1);
    d.slides.splice(to, 0, s);
  });
}

// ------------------------------------------------------------------ объекты

export function patchObj(slideId: string, objId: string, patch: ObjOverride, o?: UpdateOpts): void {
  update((d) => {
    const s = slideOf(d, slideId);
    if (!s) return;
    const all = (s.objects ??= {});
    const next: ObjOverride = { ...all[objId], ...patch };
    for (const k of Object.keys(next) as (keyof ObjOverride)[]) {
      if (next[k] === undefined || next[k] === false) delete next[k];
    }
    if (Object.keys(next).length) all[objId] = next;
    else delete all[objId];
    if (!Object.keys(all).length) delete s.objects;
  }, o);
}

/** Вернуть объект к тому, как он задан в коде сцены. */
export function resetObj(slideId: string, objId: string): void {
  update((d) => {
    const s = slideOf(d, slideId);
    if (!s?.objects) return;
    delete s.objects[objId];
    if (!Object.keys(s.objects).length) delete s.objects;
  });
}
