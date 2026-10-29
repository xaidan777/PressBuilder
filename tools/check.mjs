/**
 * Быстрая проверка сцен ролика без браузера: каждый слайд прогоняется по времени
 * на «пустом» канвасе. Ловит исключения в render(), реплики, которых нет в
 * deck.json, и показывает, какие объекты (f.obj) сцена отдаёт редактору.
 *
 *   node tools/check.mjs gameready-3d
 *
 * Нужен Node 23.6+ (исходники на TypeScript подключаются напрямую).
 */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { Timeline } from '../src/engine/timeline.ts';
import { setStyle } from '../src/engine/theme.ts';

const [, , deckId] = process.argv;
const dir = `src/decks/${deckId}`;
if (!deckId || !fs.existsSync(`${dir}/deck.json`)) {
  console.log('Использование: node tools/check.mjs <id ролика>');
  process.exit(1);
}

/** Канвас-пустышка: принимает любые вызовы, текст «меряет» по числу знаков. */
function fakeCanvas() {
  const canvas = { width: 16, height: 9 };
  const grad = { addColorStop() {} };
  const state = { font: '10px sans-serif' };
  const ctx = new Proxy(state, {
    get(t, k) {
      if (k === 'canvas') return canvas;
      if (k in t) return t[k];
      if (k === 'measureText')
        return (s) => ({ width: String(s).length * (parseFloat(/(\d+(?:\.\d+)?)px/.exec(t.font)?.[1] ?? '10') * 0.42) });
      if (k === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (k === 'getImageData') return (_x, _y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      if (/^create.*(Gradient|Pattern)$/.test(String(k))) return () => grad;
      if (k === 'getLineDash') return () => [];
      if (k === 'isPointInPath' || k === 'isPointInStroke') return () => false;
      return () => undefined;
    },
    set(t, k, v) {
      t[k] = v;
      return true;
    },
  });
  canvas.getContext = () => ctx;
  return canvas;
}

const deck = JSON.parse(fs.readFileSync(`${dir}/deck.json`, 'utf8'));
setStyle(deck.style);
const indexFile = path.resolve(dir, 'index.ts');
const scenes = new Map();
if (fs.existsSync(indexFile)) {
  const mod = await import(pathToFileURL(indexFile).href);
  for (const s of mod.SCENES ?? []) scenes.set(s.id, s);
}

const tl = new Timeline(deck, scenes);
const canvas = fakeCanvas();
let bad = 0;

for (const id of scenes.keys()) {
  if (!deck.slides.some((s) => s.id === id)) {
    console.log(`!  сцена «${id}» есть в коде, но такого слайда нет в deck.json`);
    bad++;
  }
}

for (const sc of tl.schedule.slides) {
  const ids = new Set();
  const errors = new Set();
  const steps = Math.max(8, Math.ceil(sc.dur * 5));
  for (let i = 0; i <= steps; i++) {
    const gt = sc.start + (sc.dur * i) / steps - (i === steps ? 1e-3 : 0);
    tl.render(canvas.getContext(), gt);
    for (const o of tl.probe(gt, canvas).objects) ids.add(o.id);
    const e = tl.errors.get(sc.slide.id);
    if (e) errors.add(e);
  }
  const missing = [...tl.missingCues].filter((k) => k.startsWith(`${sc.slide.id}/`)).map((k) => k.split('/')[1]);
  const mark = errors.size || missing.length ? '!' : scenes.has(sc.slide.id) ? '✓' : '·';
  console.log(`${mark}  ${sc.slide.id}  ${scenes.has(sc.slide.id) ? '' : '(заглушка) '}${sc.slide.label} — объектов: ${ids.size}`);
  if (ids.size && scenes.has(sc.slide.id)) console.log(`     ${[...ids].join(', ')}`);
  for (const e of errors) console.log(`     ОШИБКА: ${e}`);
  if (missing.length) console.log(`     нет реплик в deck.json: ${missing.join(', ')}`);
  if (errors.size || missing.length) bad++;
}

console.log(bad ? `\nПроблемных слайдов: ${bad}` : '\nВсё в порядке.');
process.exit(bad ? 1 : 0);
