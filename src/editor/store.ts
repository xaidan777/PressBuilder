/**
 * Состояние редактора: открытый ролик, выделение, история правок, автосохранение.
 * Ролик меняется только через `update()` — так каждая правка попадает в историю
 * и на диск.
 */

import { computed, effect, signal } from '@preact/signals';
import { loadScenes } from '../decks/registry.ts';
import { Player } from '../engine/player.ts';
import { slideAt } from '../engine/schedule.ts';
import { Timeline, type ObjInfo } from '../engine/timeline.ts';
import { W } from '../engine/theme.ts';
import type { DeckData, SceneDef } from '../engine/types.ts';
import { api, CLIENT_ID, type DeckMeta } from './api.ts';
import { loadPeaks, type AudioInfo } from './audio.ts';

export type Selection =
  | { kind: 'none' }
  | { kind: 'slide'; slide: string }
  | { kind: 'cue'; slide: string; cue: string }
  | { kind: 'obj'; slide: string; obj: string; also?: string[] };

/** Все выделенные объекты: основной и добавленные через Shift. */
export const selectedIds = (s: Selection): string[] => (s.kind === 'obj' ? [s.obj, ...(s.also ?? [])] : []);

/** Shift+клик: добавить объект к выделению или убрать из него. */
export function toggleObject(slideId: string, objId: string): void {
  const s = sel.peek();
  const ids = s.kind === 'obj' && s.slide === slideId ? selectedIds(s) : [];
  const next = ids.includes(objId) ? ids.filter((id) => id !== objId) : [...ids, objId];
  sel.value = next.length ? { kind: 'obj', slide: slideId, obj: next[0], also: next.slice(1) } : { kind: 'none' };
}

// ------------------------------------------------------------------ сигналы

export const decks = signal<DeckMeta[]>([]);
export const deck = signal<DeckData | null>(null);
export const scenes = signal<Map<string, SceneDef>>(new Map());
export const loading = signal(true);
export const fatal = signal('');

export const sel = signal<Selection>({ kind: 'none' });
export const time = signal(0);
export const playing = signal(false);
export const saveState = signal<'saved' | 'dirty' | 'saving' | 'error'>('saved');
export const canUndo = signal(false);
export const canRedo = signal(false);
/** Всплывающее сообщение внизу экрана. */
export const toast = signal('');

/** Объекты текущего кадра (обновляются на паузе). */
export const objects = signal<ObjInfo[]>([]);
/** Идёт экспорт: редактор заблокирован, плеером управляет рендер. */
export const exporting = signal(false);

export const timeline = computed(() => (deck.value ? new Timeline(deck.value, scenes.value) : null));
export const schedule = computed(() => timeline.value?.schedule ?? null);
export const curSlide = computed(() => (schedule.value ? slideAt(schedule.value, time.value) : null));
/** «слайд/реплика», звучащая прямо сейчас. */
export const activeCue = computed(() => {
  const sc = curSlide.value;
  if (!sc) return '';
  const t = time.value - sc.start;
  const c = sc.cues.find((x) => t >= x.start && t < x.start + x.dur);
  return c ? `${sc.slide.id}/${c.id}` : '';
});
export const hasScenes = computed(() => scenes.value.size > 0);

// ------------------------------------------------------------------ озвучка

/** Счётчик загрузок файла озвучки: тот же `voice.mp3` после замены нужно перечитать. */
export const audioRev = signal(0);
/** Звук выключен в редакторе (на MP4 не влияет). */
export const muted = signal(false);
export const audioSrc = computed(() => {
  const d = deck.value;
  return d?.audio?.file ? `/src/decks/${d.id}/${encodeURIComponent(d.audio.file)}?r=${audioRev.value}` : null;
});
/** Длительность и волна текущей озвучки; null — нет дорожки или ещё читается. */
export const audioInfo = signal<AudioInfo | null>(null);
const audioKey = computed(() => {
  const a = deck.value?.audio;
  return `${audioSrc.value}|${a?.offset ?? 0}|${a?.volume ?? 1}|${muted.value}`;
});

let toastTimer = 0;
export function say(message: string): void {
  toast.value = message;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.value = ''), 3200);
}

// ------------------------------------------------------------------ плеер

export let player: Player | null = null;
let probeCanvas: HTMLCanvasElement | null = null;
let probeTimer = 0;
/** Во время перетаскивания рамку двигает сам редактор — зонд не нужен. */
export const gesture = { active: false };

export function attachPlayer(canvas: HTMLCanvasElement): Player {
  player?.stop();
  const p = new Player(canvas);
  p.setTimeline(timeline.peek());
  p.seek(time.peek());
  p.onTick = (t, _d, isPlaying) => {
    time.value = t;
    playing.value = isPlaying;
  };
  p.onDraw = () => requestProbe();
  p.start();
  player = p;
  applyAudio();
  // удобно из консоли: pres.seek(42)
  (window as unknown as { pres: Player }).pres = p;
  return p;
}

timeline.subscribe((tl) => player?.setTimeline(tl));

/** Передать плееру дорожку, сдвиг, громкость и «без звука». */
function applyAudio(): void {
  const a = deck.peek()?.audio;
  player?.setAudio(audioSrc.peek(), a?.offset ?? 0, a?.volume ?? 1);
  player?.setMuted(muted.peek());
}
audioKey.subscribe(() => applyAudio());

// волна читается один раз на файл
let peaksFor = '';
effect(() => {
  const src = audioSrc.value;
  if (src === peaksFor) return;
  peaksFor = src ?? '';
  audioInfo.value = null;
  if (!src) return;
  loadPeaks(src)
    .then((info) => {
      if (peaksFor === src) audioInfo.value = info;
    })
    .catch(() => {
      if (peaksFor === src) say('Файл озвучки не читается — проверь формат (mp3, wav, m4a…)');
    });
});

/** Пересчитать рамки объектов текущего кадра — с задержкой, чтобы не мешать перемотке. */
export function requestProbe(delay = 70): void {
  clearTimeout(probeTimer);
  probeTimer = window.setTimeout(() => {
    const tl = timeline.peek();
    if (!tl || !player || player.playing || gesture.active || exporting.peek()) return;
    if (!probeCanvas) {
      probeCanvas = document.createElement('canvas');
      probeCanvas.width = W / 4;
      probeCanvas.height = 270;
    }
    objects.value = tl.probe(player.time, probeCanvas).objects;
  }, delay);
}

/**
 * Выбрать объект из списка. Если в текущем кадре его не видно (ещё не появился
 * или уже ушёл) — плейхед переезжает в ближайший момент слайда, где он виден.
 */
export function selectObject(slideId: string, objId: string): void {
  sel.value = { kind: 'obj', slide: slideId, obj: objId };
  const tl = timeline.peek();
  const sc = schedule.peek()?.slides.find((s) => s.slide.id === slideId);
  if (!tl || !sc || !probeCanvas || player?.playing) return;
  const seen = (t: number) => !!tl.probe(t, probeCanvas!, objId).objects[0]?.bbox;
  const now = time.peek();
  if (now >= sc.start && now < sc.start + sc.dur && seen(now)) return;
  const n = 24;
  const times = Array.from({ length: n }, (_, i) => sc.start + (sc.dur * (i + 0.5)) / n);
  times.sort((a, b) => Math.abs(a - now) - Math.abs(b - now));
  const hit = times.find(seen);
  if (hit !== undefined) seek(hit);
}

export function seek(t: number): void {
  // плеера может ещё не быть (ролик открывается раньше, чем смонтирована сцена)
  time.value = Math.max(0, Math.min(schedule.peek()?.duration ?? 0, t));
  player?.seek(time.peek());
}

export function togglePlay(): void {
  player?.toggle();
}

// ------------------------------------------------------------------ история и сохранение

const HISTORY_LIMIT = 300;
let undoStack: DeckData[] = [];
let redoStack: DeckData[] = [];
let lastKey = '';
let lastAt = 0;
let saveTimer = 0;
let saving: Promise<void> = Promise.resolve();

function syncHistoryFlags(): void {
  canUndo.value = undoStack.length > 0;
  canRedo.value = redoStack.length > 0;
}

function resetHistory(): void {
  undoStack = [];
  redoStack = [];
  lastKey = '';
  syncHistoryFlags();
}

function scheduleSave(): void {
  saveState.value = 'dirty';
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => void flushSave(), 350);
}

export function flushSave(keepalive = false): Promise<void> {
  clearTimeout(saveTimer);
  const d = deck.peek();
  if (!d || saveState.peek() === 'saved') return saving;
  saveState.value = 'saving';
  saving = saving
    .then(() => api.saveDeck(d, keepalive))
    .then(() => {
      if (deck.peek() === d) saveState.value = 'saved';
    })
    .catch((e) => {
      saveState.value = 'error';
      say(`Не сохранилось: ${e instanceof Error ? e.message : e}`);
    });
  return saving;
}

window.addEventListener('pagehide', () => void flushSave(true));

export interface UpdateOpts {
  /** Одинаковый ключ подряд (набор текста в одном поле) — одна запись истории. */
  key?: string;
  /** Продолжение жеста, начатого `beginGesture()`. */
  merge?: boolean;
}

export function update(fn: (d: DeckData) => void, o: UpdateOpts = {}): void {
  const cur = deck.peek();
  if (!cur) return;
  const next = structuredClone(cur);
  fn(next);
  const now = performance.now();
  const coalesce = o.merge || (!!o.key && o.key === lastKey && now - lastAt < 1500);
  if (!coalesce) {
    undoStack.push(cur);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack = [];
  }
  lastKey = o.key ?? '';
  lastAt = now;
  deck.value = next;
  syncHistoryFlags();
  scheduleSave();
}

/** Начало перетаскивания: одна запись истории на весь жест. */
export function beginGesture(): void {
  const cur = deck.peek();
  if (!cur) return;
  undoStack.push(cur);
  redoStack = [];
  lastKey = '';
  gesture.active = true;
  syncHistoryFlags();
}

export function endGesture(): void {
  gesture.active = false;
  // жест ничего не изменил — пустая запись в истории не нужна
  if (undoStack[undoStack.length - 1] === deck.peek()) undoStack.pop();
  syncHistoryFlags();
  requestProbe(0);
}

function travel(from: DeckData[], to: DeckData[]): void {
  const cur = deck.peek();
  const prev = from.pop();
  if (!cur || !prev) return;
  to.push(cur);
  lastKey = '';
  deck.value = prev;
  // выделенной реплики или слайда после отката может уже не быть
  const s = sel.peek();
  const slide = s.kind === 'none' ? null : prev.slides.find((x) => x.id === s.slide);
  if (s.kind !== 'none' && (!slide || (s.kind === 'cue' && !slide.cues.some((c) => c.id === s.cue)))) {
    sel.value = { kind: 'none' };
  }
  syncHistoryFlags();
  scheduleSave();
}

export const undo = () => travel(undoStack, redoStack);
export const redo = () => travel(redoStack, undoStack);

// ------------------------------------------------------------------ загрузка

export async function refreshDecks(): Promise<void> {
  decks.value = await api.listDecks();
}

function setUrl(id: string | null): void {
  const url = new URL(location.href);
  if (id) url.searchParams.set('deck', id);
  else url.searchParams.delete('deck');
  history.replaceState(null, '', url);
}

export async function openDeck(id: string, at = 0): Promise<void> {
  await flushSave();
  loading.value = true;
  try {
    const [data, sc] = await Promise.all([api.getDeck(id), loadScenes(id)]);
    player?.pause();
    resetHistory();
    sel.value = { kind: 'none' };
    objects.value = [];
    scenes.value = sc;
    deck.value = data;
    saveState.value = 'saved';
    document.title = `${data.title} — PresBuilder`;
    setUrl(id);
    seek(at);
  } catch (e) {
    say(`Не открылся ролик «${id}»: ${e instanceof Error ? e.message : e}`);
    closeDeck();
  } finally {
    loading.value = false;
  }
}

export function closeDeck(): void {
  void flushSave();
  player?.pause();
  deck.value = null;
  scenes.value = new Map();
  sel.value = { kind: 'none' };
  document.title = 'PresBuilder';
  setUrl(null);
  void refreshDecks();
}

export async function boot(): Promise<void> {
  try {
    await refreshDecks();
    const params = new URLSearchParams(location.search);
    const id = params.get('deck');
    if (id && decks.value.some((d) => d.id === id)) {
      await openDeck(id, Number(sessionStorage.getItem(`pb:time:${id}`) ?? params.get('t') ?? 0) || 0);
    }
  } catch (e) {
    fatal.value = `Сервер редактора не отвечает: ${e instanceof Error ? e.message : e}. Запусти npm run dev.`;
  } finally {
    loading.value = false;
  }
}

// позиция переживает перезагрузку страницы (правка сцены → Vite обновил код)
time.subscribe((t) => {
  const d = deck.peek();
  if (d) sessionStorage.setItem(`pb:time:${d.id}`, t.toFixed(2));
});

// deck.json поменяли снаружи (ИИ-агент поправил реплики) — перечитываем
if (import.meta.hot) {
  import.meta.hot.on('pb:deck-changed', async ({ id, client }: { id: string; client?: string }) => {
    if (client === CLIENT_ID) return;
    void refreshDecks();
    const cur = deck.peek();
    if (!cur || cur.id !== id || exporting.peek()) return;
    try {
      const fresh = await api.getDeck(id);
      if (JSON.stringify(fresh) === JSON.stringify(deck.peek())) return;
      const prev = deck.peek();
      if (prev) undoStack.push(prev);
      redoStack = [];
      deck.value = fresh;
      saveState.value = 'saved';
      syncHistoryFlags();
      say('Ролик обновлён с диска');
    } catch {
      say(`Ролик «${id}» удалён с диска`);
      closeDeck();
    }
  });
}

// код сцен обновился без перезагрузки страницы
window.addEventListener('pb:scenes', (e) => {
  const d = deck.peek();
  const load = (e as CustomEvent<typeof loadScenes>).detail;
  if (!d) return;
  void load(d.id).then((sc) => {
    scenes.value = sc;
    void refreshDecks();
  });
});
