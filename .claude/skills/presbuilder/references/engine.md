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

- `C.bg`, `C.panel`, `C.text`, `C.h1` (заголовки), `C.accent` (второй акцент), `C.pos` (мелкий акцент: дельты,
  метки). Значения задаёт стиль ролика (`styles.ts`), поэтому `C.*` читать внутри `render()`, не в константах модуля.
- `currentStyle()` — пресет ролика: `id`, `dark`, `radius` (скругление плашек), `cardLines` (1 — тонкая рамка,
  2 — двойная скруглённая), `caps`, `tracking`. `FONT.sans` / `FONT.display` / `FONT.mono` — стеки шрифтов.
- `a(color, alpha)` — цвет с прозрачностью, `mix(a, b, k)` — смесь (hex — годится и в `a()`).
- `W = 1920`, `H = 1080`, `PAD = { x: 150, y: 110 }`, `SAFE_BOTTOM = 150`.

## text.ts — текст

Стиль `TextStyle`: `{ size, weight?, family?, color?, align?, tracking?, lineHeight?, maxWidth?, upper?, caps?, glowColor?, glowBlur? }`.
`family: 'display'` — шрифт заголовков стиля, по умолчанию `sans`; `weight` и `caps` по умолчанию — из стиля.
Кегль меньше `MIN_TEXT = 46` движок поднимет сам.

- `reveal(ctx, str, x, y, st, p, { stagger?, rise?, slide?, from?, mask? })` — пословное появление. Главный способ
  вывести текст. `mask: true` — слова выезжают из-под маски своей строки (плотная подача заголовков).
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
- `rrPath`, `hexPath`, `diamondPath`, `polyline`, `smoothPath` — пути; `save(ctx, fn)`, `alphaGroup(ctx, alpha, fn)`.
- `leader(ctx, x1, y1, x2, y2, p)` — выноска: линия от подписи к объекту с кружком на конце.

## kit.ts — строительные блоки сцен

- `appear(ctx, p, fn, { dx?, dy?, from?, cx?, cy?, back? })` — появление группы; `stage(ctx, pin, pout, fn, …)` —
  вход и уход части сцены, сменяющей другую.
- `along(t, [[k, x, y], …])` — положение по ключевым кадрам (курсор, камера); `lerpRect(a, b, k)` — «наезд
  камеры» на область; `bez(p0, p1, p2, k)` — точка кривой.
- `flow(ctx, p0, p1, p2, p, t, { color?, width?, dots?, speed?, dash? })` — линия по кривой с бегущими точками.
- `windowFrame(ctx, x, y, w, h, { title?, bar?, glow? })` → рамка содержимого — окно приложения;
  `brackets(ctx, rect)` — уголки видоискателя; `selection(ctx, rect, gt)` — выделение с «муравьями».
- `cursor(ctx, x, y, press?)` — курсор мыши, `press` 0..1 — клик с кольцом.
- `codeTyping(ctx, lines, x, y, typed, { gt?, lineH?, numbers? })` — печать кода с подсветкой;
  строки — `tok("fn:reveal§txt:(ctx, §str:'x'§txt:);")` (типы kw, fn, str, num, com, txt).
- `terminal(ctx, [{ cmd?, out?, ok? }], x, y, p)` — строки терминала с галочками; `badge(ctx, cx, cy, r, ok, p)`.
- `strike(…)` — зачёркивание; `stamp(ctx, text, cx, cy, p, { color?, size?, rot? })` — штамп-вердикт.
- `burst(ctx, cx, cy, tSince, { n?, r?, colors?, seed? })` — салют; `drift(ctx, rect, gt, …)` — плывущие частицы.
- `scan(ctx, rect, p, fn)` — развёртка: содержимое проявляется за светящейся линией.
- `waveform(ctx, x, y, w, h, p, { gaps?, seed?, color? })` — звуковая дорожка-«волна» с паузами.
- `slider(ctx, x, y, w, v)`, `toggle(ctx, x, y, on)` — элементы управления.

## assets.ts — картинки

- `const ART = picture(new URL('./art.webp', import.meta.url).href)` — на уровне модуля сцены или `common.ts`;
  `ART.get()` → картинка или `null` (ещё грузится; в Node всегда `null` — рисуй с проверкой).
- Экспорт ждёт загрузки всех объявленных картинок, плеер перерисовывает кадр, когда картинка пришла.
- `cover(ctx, im, x, y, w, h, { u?, v?, zoom? })` — заполнить область с обрезкой (наезд — растущий `zoom`);
  `standing(ctx, im, cx, bottom, h)` — персонаж «на полу»; `atlasFrame(…)` — кадр из атласа-видео.

## rig.ts — скелет и персонажи

- `ik2(root, target, l1, l2, bend)` — обратная кинематика двух костей; `fk(root, [[len, angle], …])` — прямая.
- `bone(ctx, head, tail, color?)` — кость «как в Blender».
- `walkPose(x, ground, h, dist, dir?)` → поза шага (фаза — из пройденного пути, стопа не скользит);
  `figure(ctx, pose, { color?, skin?, bones? })` — силуэт и/или кости.

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

## icons.ts — 45 векторных иконок

`icon(ctx, name, x, y, size, color?, t?)` — рисует по центру `(x, y)`. Имена: folder, download, check,
bolt, play, crosshair, plug, cube, cursor, arcadia, person, windows, apple, steam, gift, wrench, heart,
youtube, telegram, zzz, refund, sliders, eye, money, clock, calendar, globe, robot, warning, chart, doc,
bug, star, chat, rocket, moon, users, code, fire, flag, hex, shield, thumb, question, mic.

## wire3d.ts — псевдо-3D

- Камера `View { cx, cy, size, pitch?, yaw?, dist? }`, положение тела `Xform { pos?, scale?, rx?, ry?, rz? }`.
- Тела `MESH.cube`, `pyramid`, `octa`, `icosa`, `hexPrism`, `cylinder`.
- `drawSolid(ctx, mesh, view, xf, { color, … })` — тело с заливкой граней; `drawWire(…)` — каркас;
  `drawGrid(ctx, view, …)` — пол; `project(v, view)` — точка мира → экран.
- `extrude(контур, толщина)` — выдавить плоский контур (хоть вогнутый) в тело; камеру двигают интерполяцией
  `pitch`/`yaw`/`size`/`dist`. `ball(ctx, cx, cy, r, color, 'toon' | 'real')` — шар с затенением.
- Свет делай мягким и малоконтрастным: грани не должны «искрить» мозаикой.

## player.ts — озвучка

Плеер сам играет `audio` ролика синхронно с картинкой (пока голос звучит, часы идут по нему), экспорт
вшивает его в MP4. Сценам про звук думать не нужно.

## SceneDef — что ещё умеет сцена

- `energy(t, cue)` → 0..1 — насколько «горячий» момент: фон движка отвечает свечением.
- `f.t` / `f.dur` — время и длина слайда, `f.gt` — время ролика (для бесконечных циклов вроде
  вращения), `f.cues` — все реплики слайда по порядку.
