/**
 * Раскладка ролика по времени: когда начинается каждый слайд и каждая реплика.
 * Удобно сверять с озвучкой на монтаже.
 *
 *   node tools/timing.mjs llm3d        # ролик из src/decks/llm3d
 *   node tools/timing.mjs llm3d 160    # примерить другой хронометраж, сек
 *
 * Нужен Node 23.6+ (исходники на TypeScript подключаются напрямую).
 */

import fs from 'node:fs';
import { buildSchedule } from '../src/engine/schedule.ts';
import { TIMING } from '../src/engine/timing.ts';

const [, , deckId, targetArg] = process.argv;
if (!deckId) {
  console.log(`Какой ролик? Есть: ${fs.readdirSync('src/decks').filter((d) => fs.existsSync(`src/decks/${d}/deck.json`)).join(', ')}`);
  process.exit(1);
}
const deck = JSON.parse(fs.readFileSync(`src/decks/${deckId}/deck.json`, 'utf8'));
if (Number(targetArg)) deck.target = Number(targetArg);
const s = buildSchedule(deck);

const clock = (t) => {
  const m = Math.floor(t / 60);
  return `${m}:${(t - m * 60).toFixed(1).padStart(4, '0')}`;
};

console.log(`\n${deck.title}  [${deck.id}]`);
console.log(
  `хронометраж ${clock(s.duration)} · из текста вышло бы ${clock(s.natural)} · ` +
    `сжатие ×${s.scale.toFixed(3)} · темп речи ≈ ${(TIMING.cps / s.scale).toFixed(1)} зн/с\n`,
);

for (const sc of s.slides) {
  console.log(`${clock(sc.start).padStart(7)}  ── ${sc.slide.id} · ${sc.slide.label} (${sc.dur.toFixed(1)} с)`);
  for (const c of sc.cues) {
    const say = c.say.length > 78 ? `${c.say.slice(0, 77)}…` : c.say;
    console.log(`${clock(sc.start + c.start).padStart(7)}     ${c.dur.toFixed(1).padStart(4)} с  ${say}`);
  }
}
console.log('');
