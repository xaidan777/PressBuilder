/**
 * Палитра и типографика презентации. Значения приходят из пресета стиля ролика
 * (`styles.ts`, поле `style` в deck.json): `setStyle()` подменяет их перед рисованием.
 * Поэтому сцены читают `C.*` и `FONT.*` прямо в render(), а не копируют в константы
 * модуля — иначе смена стиля не дойдёт до сцены.
 */

import { PRESETS, styleById, type Palette, type StylePreset } from './styles.ts';

export type { Palette, StylePreset } from './styles.ts';

/** Цвета текущего стиля: bg, panel, text, h1, accent, pos. */
export const C: Palette = { ...PRESETS[0].colors };

/** Цвет с альфой: rgba() из hex. */
export function a(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  );
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Смешение двух hex-цветов; результат — тоже hex (годится для `a()` и графиков). */
export function mix(hexA: string, hexB: string, k: number): string {
  const p = (h: string) => {
    const n = parseInt(h.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [r1, g1, b1] = p(hexA);
  const [r2, g2, b2] = p(hexB);
  const m = (x: number, y: number) =>
    Math.round(x + (y - x) * Math.max(0, Math.min(1, k)))
      .toString(16)
      .padStart(2, '0');
  return `#${m(r1, r2)}${m(g1, g2)}${m(b1, b2)}`;
}

export const FONT = {
  /** Основной текст. */
  sans: PRESETS[0].fonts.sans.stack,
  /** Заголовки и крупный текст (у Terevo — тот же узкий шрифт). */
  display: PRESETS[0].fonts.display.stack,
  /** Моноширинный — для табличных цифр и «логов». */
  mono: "'Cascadia Mono', Consolas, ui-monospace, monospace",
};

/** Типографика текущего стиля: начертания по умолчанию, капитель, трекинг крупного текста. */
export const TYPE = {
  weight: { sans: 700, display: 700, mono: 700 },
  caps: 'small' as 'small' | 'normal',
  tracking: 0.6,
};

let current: StylePreset = PRESETS[0];

export const currentStyle = (): StylePreset => current;

/** Включить пресет стиля (id из deck.json; пусто или неизвестно — Terevo). */
export function setStyle(id: string | null | undefined): StylePreset {
  const s = styleById(id);
  if (s === current) return s;
  current = s;
  Object.assign(C, s.colors);
  FONT.sans = s.fonts.sans.stack;
  FONT.display = s.fonts.display.stack;
  TYPE.weight.sans = s.fonts.sans.weight;
  TYPE.weight.display = s.fonts.display.weight;
  TYPE.caps = s.caps;
  TYPE.tracking = s.tracking;
  return s;
}

/** Нарисовать что-то в другом стиле и вернуть прежний (превью в окне выбора). */
export function withStyle<T>(id: string, fn: () => T): T {
  const prev = current.id;
  setStyle(id);
  try {
    return fn();
  } finally {
    setStyle(prev);
  }
}

let fontsReady: Promise<void> | null = null;

/**
 * Шрифты всех пресетов — до первой отрисовки, иначе метрики текста поедут.
 * Регистрируются в document.fonts, так что ими пользуется и интерфейс редактора.
 */
export function loadStyleFonts(): Promise<void> {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return Promise.resolve();
  fontsReady ??= (async () => {
    const seen = new Set<string>();
    const jobs: Promise<unknown>[] = [];
    for (const f of PRESETS.flatMap((p) => [p.fonts.display, p.fonts.sans])) {
      if (seen.has(f.url)) continue;
      seen.add(f.url);
      const face = new FontFace(f.family, `url("${f.url}") format("truetype")`, { weight: '100 900', display: 'block' });
      document.fonts.add(face);
      jobs.push(face.load().catch(() => undefined));
    }
    await Promise.all(jobs);
    await document.fonts.ready;
  })();
  return fontsReady;
}

/** Логический размер сцены. Всё рисуется в этих координатах. */
export const W = 1920;
export const H = 1080;

/** Безопасные поля кадра. */
export const PAD = { x: 150, y: 110 } as const;

/**
 * Нижняя полоса кадра, которую контент не занимает: там будет проигрыватель.
 * Сцены верстаются в полных 1920×1080, а движок ужимает их под эту зону.
 */
export const SAFE_BOTTOM = 150;
