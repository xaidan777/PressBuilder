/**
 * Новая тема из текста — то же, что «Новая тема» в редакторе, только из консоли
 * (так тему заводит ИИ-агент, когда текст озвучки прислали ему в чат).
 * Текст режется на реплики и слайды движком (src/engine/split.ts) → src/decks/<id>/deck.json.
 *
 *   node tools/new.mjs <id> <файл с текстом> --title "Заголовок" [--slides 12] [--target 150] [--style paper]
 *
 *   --slides  число слайдов (по умолчанию — рекомендация по длине текста)
 *   --target  хронометраж, сек (по умолчанию — из текста)
 *   --style   пресет стиля: terevo, midnight, paper, lines (по умолчанию terevo)
 *
 * Нужен Node 23.6+ (исходники на TypeScript подключаются напрямую).
 */

import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { estimateDuration, recommendSlides, splitText, splitToCues } from '../src/engine/split.ts';
import { DEFAULT_STYLE, PRESETS } from '../src/engine/styles.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { title: { type: 'string' }, slides: { type: 'string' }, target: { type: 'string' }, style: { type: 'string' } },
});
const [id, textFile] = positionals;
const stop = (msg) => {
  console.log(msg);
  process.exit(1);
};

if (!id || !textFile) stop('Использование: node tools/new.mjs <id> <файл с текстом> --title "Заголовок" [--slides N] [--target сек] [--style terevo|midnight|paper|lines]');
if (!/^[a-z0-9][a-z0-9_-]{0,40}$/.test(id)) stop('id: латиница в нижнем регистре, цифры, дефис (например, my-video)');
const dir = `src/decks/${id}`;
if (fs.existsSync(dir)) stop(`Ролик «${id}» уже есть: ${dir}`);
const style = values.style ?? DEFAULT_STYLE;
if (!PRESETS.some((p) => p.id === style)) stop(`Нет стиля «${style}». Есть: ${PRESETS.map((p) => p.id).join(', ')}`);

const text = fs.readFileSync(textFile, 'utf8').replace(/\r\n?/g, '\n').trim();
const cues = splitToCues(text);
if (!cues.length) stop(`В файле ${textFile} нет текста`);

const slides = Math.max(1, Math.min(Number(values.slides) || recommendSlides(cues), cues.length));
const target = Number(values.target) > 0 ? Number(values.target) : null;
const deck = {
  id,
  title: values.title?.trim() || id,
  text,
  target,
  style,
  format: { height: 1080, fps: 60, bitrate: 24 },
  slides: splitText(text, slides),
};

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(`${dir}/deck.json`, `${JSON.stringify(deck, null, 2)}\n`);

const sec = Math.round(target ?? estimateDuration(cues, slides));
console.log(`${dir}/deck.json — «${deck.title}»: слайдов ${deck.slides.length}, реплик ${cues.length}, ` +
  `≈ ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
