# Готовые блоки движка (`src/engine/`)

Импорт из сцены: `import { … } from '../../engine/<файл>.ts';`. Здесь — что есть и для чего;
точные опции смотри в самом файле (у всех интерфейсов есть комментарии). `p` везде — прогресс 0..1.

## anim.ts — время и случайность

- `seg(t, start, dur)` — прогресс отрезка; основа любой анимации от реплики.
- `pulse(t, start, dur)` — импульс 0→1→0; `inOut(t, dur, inD?, outD?)` — появиться и исчезнуть.
- `clamp`, `clamp01`, `lerp`; плавности `easeOutCubic`, `easeOutQuart`, `easeOutBack`, `easeOutElastic`,
  `easeInOutCubic`, `easeOutExpo`, `bounceIn` и др.
- `hash11(x)`, `hash21(x, y)` — детерминированная «случайность»; `noise1(t, seed)` — плавный шум.
- `shake(t, start, dur, amp)` → `[dx, dy]` — затухающая тряска.
- `fmtNum(9000)` → «9 000», `fmtTime(75)` → «1:15».

## theme.ts — палитра и кадр

- `C.bg`, `C.panel`, `C.text`, `C.h1` (голубой, заголовки), `C.accent` (жёлтый), `C.pos` (зелёный, плюсы).
- `a(color, alpha)` — цвет с прозрачностью, `mix(a, b, k)` — смесь.
- `W = 1920`, `H = 1080`, `PAD = { x: 150, y: 110 }`, `SAFE_BOTTOM = 150`.

## text.ts — текст

Стиль `TextStyle`: `{ size, weight?, color?, align?, tracking?, lineHeight?, maxWidth?, upper?, caps?, glowColor?, glowBlur? }`.
Кегль меньше `MIN_TEXT = 46` движок поднимет сам.

- `reveal(ctx, str, x, y, st, p, { stagger?, rise?, slide?, from? })` — пословное появление. Главный способ вывести текст.
- `typewriter(ctx, str, x, y, st, p, gt?, caretColor?)` — печатная машинка с курсором.
- `text(ctx, str, x, y, st)` — строка (с `maxWidth` — перенос); `paragraph(…)` — многострочный блок, вернёт высоту.
- `kicker(ctx, str, x, y, p?, color?, size?)` — надзаголовок с линией слева.
- `measure`, `wrap`, `blockHeight` — размеры текста.

## draw.ts — примитивы

- `panel(ctx, x, y, w, h, { fill?, stroke?, radius?, glow?, accentBar? })` — плашка/карточка.
- `arrow(ctx, x1, y1, x2, y2, p?, { color?, width?, head?, dash? })` — стрелка, рисуется по прогрессу.
- `shockRing(ctx, cx, cy, p, maxR, color?, width?)` — расходящееся кольцо (акцент появления).
- `softLight(ctx, cx, cy, r, color, alpha?)` — мягкое пятно света; `glow(ctx, color, blur, fn)` — свечение.
- `wipeX` / `wipeY(ctx, x, y, w, h, p, fn)` — открыть содержимое шторкой.
- `divider(ctx, x, y, w, p?)` — растущая линия; `corners(ctx, x, y, w, h)` — рамка-«прицел».
- `rrPath`, `hexPath`, `polyline`, `smoothPath` — пути; `save(ctx, fn)`, `alphaGroup(ctx, alpha, fn)`.

## charts.ts — графики

- `lineChart(ctx, { x, y, w, h, data, p, color?, fill?, max?, grid?, head?, smooth?, labels? })`.
- `bars(ctx, { x, y, w, h, items: [{ label, value, color?, note? }], p, max?, valueFmt? })`.
- `donut(ctx, cx, cy, r, segs, p, thickness?)` — кольцевая диаграмма.
- `counter(ctx, value, x, y, st, p, { prefix?, suffix?, decimals? })` — число «набегает» от 0.

## ui.ts, widgets.ts — готовые виджеты

- `chip(ctx, label, x, y, { icon?, color?, … })` — пилюля с иконкой; вернёт ширину.
- `statTile(ctx, { x, y, w, h, value, label, icon?, color?, p? })` — плитка «число + подпись».
- `listRow(ctx, { x, y, w, h, index, label, icon?, p?, active? })` — строка списка.
- `statsTable(ctx, …)` — таблица; `avatarHex(ctx, cx, cy, r, initials, p?)`; `videoCard(ctx, …)`.
- `compareBar` (подпись — шкала — значение), `curve` (кривая без осей), `waterfall` (каскад),
  `track` (дорожка времени с метками), `ratingBadge`, `reviewCard`,
  `callout(ctx, title, body, x, y, w, p, color?)` — выноска с пояснением.

## icons.ts — 44 векторные иконки

`icon(ctx, name, x, y, size, color?, t?)` — рисует по центру `(x, y)`. Имена: folder, download, check,
bolt, play, crosshair, plug, cube, cursor, arcadia, person, windows, apple, steam, gift, wrench, heart,
youtube, telegram, zzz, refund, sliders, eye, money, clock, calendar, globe, robot, warning, chart, doc,
bug, star, chat, rocket, moon, users, code, fire, flag, hex, shield, thumb, question.

## wire3d.ts — псевдо-3D

- Камера `View { cx, cy, size, pitch?, yaw?, dist? }`, положение тела `Xform { pos?, scale?, rx?, ry?, rz? }`.
- Тела `MESH.cube`, `pyramid`, `octa`, `icosa`, `hexPrism`, `cylinder`.
- `drawSolid(ctx, mesh, view, xf, { color, … })` — тело с заливкой граней; `drawWire(…)` — каркас;
  `drawGrid(ctx, view, …)` — пол; `project(v, view)` — точка мира → экран.
- Свет делай мягким и малоконтрастным: грани не должны «искрить» мозаикой.

## SceneDef — что ещё умеет сцена

- `energy(t, cue)` → 0..1 — насколько «горячий» момент: фон движка отвечает свечением.
- `f.t` / `f.dur` — время и длина слайда, `f.gt` — время ролика (для бесконечных циклов вроде
  вращения), `f.cues` — все реплики слайда по порядку.
