# PresBuilder

Редактор анимированных роликов из текста озвучки: Canvas 2D + TypeScript + Vite, интерфейс на Preact.
Кадр 1920×1080, тёмная палитра, шрифт Sofia Sans Extra Condensed. На выходе — MP4 в `out/`.

**Любая работа с роликами** («делай тему X», «сделай ролик из текста», правка сцен, вывод MP4) —
по скиллу `presbuilder`: `.agents/skills/presbuilder/SKILL.md` (Codex) или
`.claude/skills/presbuilder/SKILL.md` (Claude Code). Прочитай его до первой сцены.

## Кто что делает

- **Человек в редакторе** (`npm run dev` → http://localhost:5180): создаёт тему (заголовок, текст,
  число слайдов), правит текст реплик, тайминги, положение/масштаб/текст объектов, выводит MP4.
- **Агент в чате**: по просьбе «делай тему X» пишет код сцен для слайдов этой темы.

## Ролик

```
src/decks/<id>/deck.json      данные (пишет редактор, автосохранение)
  title, text, target (хронометраж, сек | null), lead/tail, format {height,fps,bitrate}
  slides[]: id ("s01"), label, lead?, tail?,
            cues[]: id, say (озвучка), show? (на экране), hold?, rate?, dur? (ручная длительность)
            objects?: { "<id объекта>": { x?, y?, scale?, text?, hidden? } }   ← правки из редактора
src/decks/<id>/sNN_имя.ts     сцена слайда (SceneDef), index.ts — список сцен, common.ts — общие блоки
```

В deck.json не менять `say`, `target`, `format`, `objects`. Чужие ролики не трогать.

## Команды

```
npm run dev                         редактор, http://localhost:5180 (сервер API и ffmpeg — плагин Vite)
node tools/new.mjs <id> <текст.txt> --title "…"   новая тема из текста
npx tsc --noEmit                    типы
node tools/check.mjs <id>           прогон всех сцен без браузера
node tools/timing.mjs <id>          раскладка реплик по времени
```

## Структура

```
server/plugin.ts      API редактора: /api/decks, /api/export, /api/config, /out
src/engine/           движок: тайминги, расписание, разбивка текста, рендер и объекты (timeline),
                      экспорт (WebCodecs → H.264), заглушка, текст, графика, виджеты, иконки, псевдо-3D
src/editor/           интерфейс редактора
src/decks/<id>/       ролики; atlas-converter, llm3d, hexstorm — примеры
tools/                new.mjs, check.mjs, timing.mjs, frame.html (кадры сеткой для проверки)
```
