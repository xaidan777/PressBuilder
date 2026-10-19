/**
 * Разбивка текста озвучки: текст → реплики → слайды.
 *
 * Реплика — это фраза на один вдох: предложение, а длинное предложение
 * режется по запятым перед союзами, тире, двоеточиям. Слайды набираются так,
 * чтобы быть примерно равными по времени и не рвать предложения.
 */

import { cueDuration, TIMING } from './timing.ts';
import type { Cue, SlideData } from './types.ts';

/** Длиннее — реплику стоит разрезать. */
const MAX_CUE = 95;
/** Короче обрубки не делаем. */
const MIN_PART = 28;
/** Сколько секунд в среднем держится один слайд. */
const SEC_PER_SLIDE = 10;

const ABBR = new Set([
  'т', 'е', 'д', 'п', 'г', 'гг', 'др', 'пр', 'см', 'стр', 'рис', 'тыс', 'млн', 'млрд', 'руб', 'долл',
  'напр', 'им', 'ул', 'vs', 'etc', 'mr', 'ms', 'dr',
]);

const CONJ =
  /^(а|но|и|или|либо|что|чтобы|чтоб|который|которая|которое|которые|которого|которой|которых|которым|которую|где|куда|когда|если|хотя|пока|ведь|зато|то|как|так как|потому|поэтому|причём|при этом|то есть|однако|затем|после чего|из которых)(?=[\s,])/iu;

export interface RawCue {
  say: string;
  /** Реплика открывает новый абзац исходного текста. */
  para: boolean;
  /** Реплика заканчивает предложение. */
  end: boolean;
}

function sentences(para: string): string[] {
  const out: string[] = [];
  const re = /([.!?…]+[»")\]]*)(\s+)(?=[«"(\[]?[A-ZА-ЯЁ\d])/gu;
  let from = 0;
  for (let m = re.exec(para); m; m = re.exec(para)) {
    const head = para.slice(from, m.index);
    if (m[1] === '.') {
      const word = /([\p{L}]+)$/u.exec(head)?.[1] ?? '';
      // «т. е.», «А. Чуев» — это не конец предложения
      if (word.length === 1 || ABBR.has(word.toLowerCase())) continue;
    }
    out.push(para.slice(from, m.index + m[1].length).trim());
    from = m.index + m[0].length;
  }
  const rest = para.slice(from).trim();
  if (rest) out.push(rest);
  return out;
}

/** Длинное предложение → фразы. Режем как можно ближе к середине. */
function clauses(s: string): string[] {
  if (s.length <= MAX_CUE) return [s];
  let best = -1;
  let bestScore = Infinity;
  const re = /(,|;|:|\s[—–])\s+/gu;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    const cut = m.index + m[0].length;
    if (cut < MIN_PART || s.length - cut < MIN_PART) continue;
    const strong = m[1] !== ',' || CONJ.test(s.slice(cut));
    // запятая без союза — скорее перечисление, его режем только в совсем длинных фразах
    if (!strong && s.length < 140) continue;
    const score = Math.abs(cut - s.length / 2) / s.length - (strong ? 0.2 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = cut;
    }
  }
  if (best < 0) return [s];
  return [...clauses(s.slice(0, best).trim()), ...clauses(s.slice(best).trim())];
}

export function splitToCues(text: string): RawCue[] {
  const out: RawCue[] = [];
  const paras = text
    .replace(/\r/g, '')
    .split(/\n\s*\n|\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  for (const para of paras) {
    let first = true;
    for (const sentence of sentences(para)) {
      const parts = clauses(sentence);
      parts.forEach((say, i) => {
        out.push({ say, para: first, end: i === parts.length - 1 });
        first = false;
      });
    }
  }
  return out;
}

/** Оценка длины ролика при обычном темпе речи. */
export function estimateDuration(cues: RawCue[], slides: number): number {
  if (!cues.length) return 0;
  return (
    cues.reduce((s, c) => s + cueDuration(c.say), 0) + Math.max(1, slides) * (TIMING.lead + TIMING.tail)
  );
}

/** Сколько слайдов предложить для такого текста. */
export function recommendSlides(cues: RawCue[]): number {
  if (!cues.length) return 1;
  const speech = cues.reduce((s, c) => s + cueDuration(c.say), 0);
  const byTime = Math.max(1, Math.round(speech / SEC_PER_SLIDE));
  // если автор сам разбил текст на абзацы разумной длины — верим ему
  const paras = cues.filter((c) => c.para).length;
  if (paras > 1 && paras >= byTime * 0.6 && paras <= byTime * 1.6) return Math.min(paras, cues.length);
  return Math.min(byTime, cues.length);
}

/** Границы слайдов: индексы реплик, с которых начинается каждый слайд. */
function partition(cues: RawCue[], n: number): number[] {
  const m = cues.length;
  n = Math.max(1, Math.min(n, m));
  const d = cues.map((c) => cueDuration(c.say));
  const pre = [0];
  d.forEach((x, i) => pre.push(pre[i] + x));
  const avg = pre[m] / n;

  // штраф за границу перед репликой j
  const edge = (j: number) => (!cues[j - 1].end ? 3 : cues[j].para ? -0.2 : 0);
  const cost = (i: number, j: number) => ((pre[j] - pre[i] - avg) / avg) ** 2;

  const best: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(Infinity));
  const from: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  best[0][0] = 0;
  for (let g = 1; g <= n; g++) {
    for (let j = g; j <= m - (n - g); j++) {
      for (let i = g - 1; i < j; i++) {
        if (best[g - 1][i] === Infinity) continue;
        const v = best[g - 1][i] + cost(i, j) + (i > 0 ? edge(i) : 0);
        if (v < best[g][j]) {
          best[g][j] = v;
          from[g][j] = i;
        }
      }
    }
  }
  const starts: number[] = [];
  for (let g = n, j = m; g >= 1; g--) {
    j = from[g][j];
    starts.unshift(j);
  }
  return starts;
}

/** Подпись слайда — первые слова его текста. */
export function autoLabel(say: string): string {
  const words = say.replace(/[«»"()]/g, '').split(/\s+/);
  let out = '';
  for (const w of words) {
    if (out && (out + ' ' + w).length > 26) break;
    out = out ? `${out} ${w}` : w;
  }
  return out.replace(/[\s,;:.!?—–-]+$/u, '');
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Текст → слайды с репликами. `n` — желаемое число слайдов. */
export function splitText(text: string, n: number): SlideData[] {
  const raw = splitToCues(text);
  if (!raw.length) return [];
  // слайдов столько же, сколько абзацев, — значит, автор уже сам всё разбил
  const paras = raw.flatMap((c, i) => (c.para ? [i] : []));
  const starts = paras.length === n ? paras : partition(raw, n);
  let cueNo = 0;
  return starts.map((start, si) => {
    const end = starts[si + 1] ?? raw.length;
    const cues: Cue[] = raw.slice(start, end).map((c) => ({ id: `c${pad2(++cueNo)}`, say: c.say }));
    return { id: `s${pad2(si + 1)}`, label: autoLabel(cues[0].say), cues };
  });
}
