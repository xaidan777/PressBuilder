/**
 * Пресеты стиля ролика: палитра, шрифты, капитель и фон.
 * Ролик выбирает пресет полем `style` в deck.json (нет поля — Terevo), движок
 * подставляет его в `C` / `FONT` (`theme.ts`) перед рисованием.
 *
 * Палитры проверены валидатором из скилла dataviz: h1 / accent / pos различимы
 * при протанопии, дейтеранопии и обычным зрением и держат контраст к фону (весь
 * текст в кадре — от 46 px, это «крупный» текст по WCAG). «Полночь» и «Линии» —
 * приглушённые палитры: насыщенность у них ниже порога для графиков по задумке,
 * поэтому значения в графиках подписываются. Terevo — исторический
 * бренд канала, его цвета не трогаем: accent и pos при дальтонизме близки.
 */

export interface Palette {
  /** Фон канваса */
  bg: string;
  /** Альтернативный фон (таблицы, панели, карточки) */
  panel: string;
  /** Основной текст */
  text: string;
  /** Заголовки 1 */
  h1: string;
  /** Альтернативные заголовки / акценты */
  accent: string;
  /** Акцент для мелкого текста (дельты, метки) */
  pos: string;
}

export interface FontSpec {
  /** Имя семейства (так шрифт регистрируется в document.fonts). */
  family: string;
  /** Полная строка для ctx.font: семейство и запасные. */
  stack: string;
  /** Начертание по умолчанию. */
  weight: number;
  /** Файл в src/fonts. */
  url: string;
}

export type BackgroundKind = 'hex' | 'night' | 'paper' | 'lines';

export interface StylePreset {
  id: string;
  name: string;
  /** Одна строка для окна выбора стиля. */
  note: string;
  dark: boolean;
  colors: Palette;
  /** Два тона только для фона (размывы, свет) — в сценах не используются. */
  decor: [string, string];
  fonts: {
    /** Заголовки и крупный текст. */
    display: FontSpec;
    /** Основной текст. */
    sans: FontSpec;
  };
  /** Капитель по умолчанию: `small` — строчные рисуются уменьшёнными прописными. */
  caps: 'small' | 'normal';
  /** Трекинг крупного текста, px. */
  tracking: number;
  /** Скругление карточек и плашек, px: у интерьерных стилей углы острые. */
  radius: number;
  /** Обводка карточек: 1 — тонкая линия, 2 — двойная скруглённая рамка. */
  cardLines: 1 | 2;
  background: BackgroundKind;
}

/** `url` — статичный `new URL('../fonts/…', import.meta.url)`: так Vite берёт в сборку только нужный файл. */
const font = (family: string, fallback: string, weight: number, url: URL): FontSpec => ({
  family,
  stack: `'${family}', ${fallback}`,
  weight,
  url: url.href,
});

const SANS = "'Segoe UI', system-ui, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

const SOFIA = font('Sofia Sans Extra Condensed', SANS, 700, new URL('../fonts/SofiaSansExtraCondensed-Bold.ttf', import.meta.url));

export const PRESETS: StylePreset[] = [
  {
    id: 'terevo',
    name: 'Terevo',
    note: 'Бренд канала: графит, циан и янтарь, узкая капитель, сота',
    dark: true,
    colors: {
      bg: '#32353c',
      panel: '#2d3036',
      text: '#cfd2d3',
      h1: '#51d3ff',
      accent: '#ffcf75',
      pos: '#b5db41',
    },
    decor: ['#51d3ff', '#ffcf75'],
    fonts: { display: SOFIA, sans: SOFIA },
    caps: 'small',
    tracking: 0.6,
    radius: 10,
    cardLines: 1,
    background: 'hex',
  },
  {
    id: 'midnight',
    name: 'Полночь',
    note: 'Warm Blue Earth: тёмно-синяя стена, охра и ржавчина, жирная дидона',
    dark: true,
    colors: {
      bg: '#15233a',
      panel: '#1c2d48',
      text: '#ece4d6',
      h1: '#d6a64e',
      accent: '#8eabcc',
      pos: '#c4593b',
    },
    // карамель лампы и глубокий синий тени
    decor: ['#c9a16e', '#0b1424'],
    fonts: {
      display: font('Yeseva One', SERIF, 400, new URL('../fonts/YesevaOne-Regular.ttf', import.meta.url)),
      sans: font('Raleway', SANS, 500, new URL('../fonts/Raleway-Variable.ttf', import.meta.url)),
    },
    caps: 'normal',
    tracking: 0.3,
    radius: 0,
    cardLines: 1,
    background: 'night',
  },
  {
    id: 'paper',
    name: 'Бумага',
    note: 'Тёплая бумага, терракота и чернила, книжная антиква',
    dark: false,
    colors: {
      bg: '#f3ede2',
      panel: '#e8dfcf',
      text: '#2a2520',
      h1: '#b3412b',
      accent: '#2e5fb8',
      pos: '#13876e',
    },
    decor: ['#b3412b', '#2e5fb8'],
    fonts: {
      display: font('Playfair Display', SERIF, 700, new URL('../fonts/PlayfairDisplay-Variable.ttf', import.meta.url)),
      sans: font('Lora', SERIF, 500, new URL('../fonts/Lora-Variable.ttf', import.meta.url)),
    },
    caps: 'normal',
    tracking: 0,
    radius: 8,
    cardLines: 1,
    background: 'paper',
  },
  {
    id: 'lines',
    name: 'Линии',
    note: 'Белая дымка, полосы ржавого, бирюзового и мятного, тонкие линии',
    dark: false,
    colors: {
      bg: '#f2f1ed',
      panel: '#fbfbf9',
      text: '#2b343e',
      h1: '#232c36',
      accent: '#c4523a',
      pos: '#2c7c84',
    },
    // мятная полоса и графитовые кантики пучка полос
    decor: ['#a9cbbd', '#3f4a56'],
    fonts: {
      display: font('Unbounded', SANS, 700, new URL('../fonts/Unbounded-Variable.ttf', import.meta.url)),
      sans: font('Geologica', SANS, 500, new URL('../fonts/Geologica-Variable.ttf', import.meta.url)),
    },
    caps: 'normal',
    tracking: -0.5,
    radius: 16,
    cardLines: 2,
    background: 'lines',
  },
];

export const DEFAULT_STYLE = 'terevo';

/** Пресет по id; неизвестный или пустой id — Terevo. */
export function styleById(id: string | null | undefined): StylePreset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}
