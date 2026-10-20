/**
 * Подгонка таймингов под озвучку: реплики ролика ставятся на паузы в голосе.
 *
 * ffmpeg находит паузы (silencedetect), а границы между репликами выбираются среди
 * них так, чтобы длина каждой реплики в голосе была пропорциональна её тексту и
 * границы падали на настоящие паузы (после точки — длиннее, после запятой — короче).
 * Результат — ручные длительности реплик (`dur`), паузы слайдов = 0, а звук начинается
 * на `audio.offset` секунде ролика (до него — въезд первого слайда).
 *
 *   node tools/align.mjs <id>                  показать раскладку
 *   node tools/align.mjs <id> --write          записать в deck.json
 *   node tools/align.mjs <id> --noise -30 --min 0.06   чувствительнее к коротким паузам
 *
 * Файл озвучки — `audio.file` из deck.json (кнопка «Добавить звук» в редакторе) или `--file путь`.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    write: { type: 'boolean' },
    file: { type: 'string' },
    noise: { type: 'string' },
    min: { type: 'string' },
    offset: { type: 'string' },
    tail: { type: 'string' },
  },
});
const [id] = positionals;
const stop = (msg) => {
  console.log(msg);
  process.exit(1);
};
if (!id || !fs.existsSync(`src/decks/${id}/deck.json`)) stop('Использование: node tools/align.mjs <id ролика> [--write]');

const deckFile = `src/decks/${id}/deck.json`;
const deck = JSON.parse(fs.readFileSync(deckFile, 'utf8'));
const audioFile = values.file ?? (deck.audio?.file ? path.join('src/decks', id, deck.audio.file) : '');
if (!audioFile || !fs.existsSync(audioFile)) stop('Нет озвучки: добавь её в редакторе («Добавить звук») или укажи --file');

let cfg = {};
try {
  cfg = JSON.parse(fs.readFileSync('presbuilder.config.json', 'utf8'));
} catch {
  /* нет конфига — ffmpeg из PATH */
}
const ffmpeg = cfg.ffmpeg || process.env.FFMPEG || 'ffmpeg';

// ---------------------------------------------------------------- паузы в голосе
const noise = Number(values.noise ?? -32);
const minSil = Number(values.min ?? 0.07);
const run = spawnSync(ffmpeg, ['-hide_banner', '-i', audioFile, '-af', `silencedetect=noise=${noise}dB:d=${minSil}`, '-f', 'null', '-'], {
  encoding: 'utf8',
});
if (run.error) stop(`ffmpeg не запустился (${ffmpeg}): ${run.error.message}`);
const log = run.stderr;
const dm = /Duration: (\d+):(\d+):([\d.]+)/.exec(log);
const duration = dm ? Number(dm[1]) * 3600 + Number(dm[2]) * 60 + Number(dm[3]) : 0;
const sil = [];
for (const m of log.matchAll(/silence_(start|end): ([\d.]+)/g)) {
  if (m[1] === 'start') sil.push({ start: Number(m[2]), end: duration });
  else if (sil.length) sil[sil.length - 1].end = Number(m[2]);
}
const speechStart = sil[0] && sil[0].start < 0.02 ? sil[0].end : 0;
const last = sil[sil.length - 1];
const speechEnd = last && last.end > duration - 0.02 ? last.start : duration;
const cand = sil.filter((s) => s.start > speechStart + 0.1 && s.end < speechEnd - 0.1);

// ---------------------------------------------------------------- реплики и их «вес»
const cues = deck.slides.flatMap((s) => s.cues.map((c) => ({ slide: s, cue: c })));
const n = cues.length;
if (n < 2) stop('В ролике меньше двух реплик — подгонять нечего');
if (cand.length < n - 1) stop(`Пауз в голосе (${cand.length}) меньше, чем границ реплик (${n - 1}). Попробуй --noise -28 --min 0.05`);
/** Сколько «звучит» текст: буквы, цифры читаются словами — дольше. */
const weight = (s) => (s.match(/\p{L}/gu) ?? []).length + (s.match(/\d/g) ?? []).length * 3 + 1;
const w = cues.map((c) => weight(c.cue.say));
const W = w.reduce((a, b) => a + b, 0);
const span = speechEnd - speechStart;
/** Насколько сильная пауза нужна после реплики: точка — длинная, запятая — короткая. */
const stopness = (s) => (/[.!?…:»"]$/.test(s.trim()) ? 1 : /[,;—–-]$/.test(s.trim()) ? 0.5 : 0.15);

// DP: граница k (после реплики k) стоит на паузе j; реплика тянется от прошлой границы до этой
const m = cand.length;
const INF = 1e18;
const best = Array.from({ length: n }, () => new Float64Array(m).fill(INF));
const from = Array.from({ length: n }, () => new Int32Array(m).fill(-1));
const cost = (i, a, b) => {
  const s0 = a < 0 ? speechStart : cand[a].end;
  const s1 = b >= m ? speechEnd : cand[b].start;
  if (s1 <= s0) return INF;
  const want = (w[i] / W) * span;
  const len = Math.log((s1 - s0) / want) ** 2;
  const pause = b >= m ? 0 : -stopness(cues[i].cue.say) * Math.min(0.6, cand[b].end - cand[b].start) * 2;
  return len + pause;
};
for (let j = 0; j < m; j++) best[0][j] = cost(0, -1, j);
for (let k = 1; k < n - 1; k++) {
  for (let j = k; j < m; j++) {
    for (let p = k - 1; p < j; p++) {
      if (best[k - 1][p] >= INF) continue;
      const v = best[k - 1][p] + cost(k, p, j);
      if (v < best[k][j]) {
        best[k][j] = v;
        from[k][j] = p;
      }
    }
  }
}
let bestJ = -1;
let bestV = INF;
for (let j = n - 2; j < m; j++) {
  const v = best[n - 2][j] + cost(n - 1, j, m);
  if (v < bestV) {
    bestV = v;
    bestJ = j;
  }
}
const cuts = new Array(n - 1);
for (let k = n - 2, j = bestJ; k >= 0; k--) {
  cuts[k] = j;
  j = from[k][j];
}

// ---------------------------------------------------------------- длительности
const offset = Number(values.offset ?? deck.audio?.offset ?? 0.6);
const tail = Number(values.tail ?? deck.slides[deck.slides.length - 1].tail ?? 1.5);
// реплика начинается с началом своей речи; первая — с начала файла (его ведёт сдвиг звука)
const starts = [0, ...cuts.map((j) => cand[j].end)];
const ends = [...starts.slice(1), Math.min(duration, speechEnd + 0.3)];
const clock = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
console.log(`\n${deck.title} — озвучка ${path.basename(audioFile)}, ${duration.toFixed(1)} с, пауз ${cand.length}, реплик ${n}\n`);
cues.forEach((c, i) => {
  const pauseAfter = i < n - 1 ? cand[cuts[i]].end - cand[cuts[i]].start : 0;
  const say = c.cue.say.length > 64 ? `${c.cue.say.slice(0, 63)}…` : c.cue.say;
  console.log(`${clock(starts[i])}  ${(ends[i] - starts[i]).toFixed(2).padStart(5)} с  ${c.slide.id}/${c.cue.id.padEnd(9)} ${say}${pauseAfter ? `  ‖ ${pauseAfter.toFixed(2)}` : ''}`);
});

if (!values.write) {
  console.log('\nЗаписать в deck.json: добавь --write');
  process.exit(0);
}
cues.forEach((c, i) => {
  c.cue.dur = Math.round((ends[i] - starts[i]) * 100) / 100;
});
deck.target = null;
deck.lead = 0;
deck.tail = 0;
deck.slides.forEach((s, i) => {
  delete s.lead;
  delete s.tail;
  if (i === 0) s.lead = offset;
  if (i === deck.slides.length - 1) s.tail = tail;
});
if (!values.file) deck.audio = { ...deck.audio, offset };
fs.writeFileSync(deckFile, `${JSON.stringify(deck, null, 2)}\n`);
console.log(`\nЗаписано: ${deckFile} — звук с ${offset} с, реплики стоят на паузах голоса.`);
