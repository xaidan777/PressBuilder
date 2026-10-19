/**
 * Единая палитра и типографика презентации.
 * Менять цвета только здесь — сцены обращаются к C.*
 */

export const C = {
  /** Фон канваса */
  bg: '#32353c',
  /** Альтернативный фон (таблицы, панели, карточки) */
  panel: '#2d3036',
  /** Основной текст */
  text: '#cfd2d3',
  /** Заголовки 1 */
  h1: '#51d3ff',
  /** Альтернативные заголовки / акценты */
  accent: '#ffcf75',
  /** Акцент для мелкого текста (дельты, метки) */
  pos: '#b5db41',
} as const;

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

/** Смешение двух hex-цветов. */
export function mix(hexA: string, hexB: string, k: number): string {
  const p = (h: string) => {
    const n = parseInt(h.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [r1, g1, b1] = p(hexA);
  const [r2, g2, b2] = p(hexB);
  const m = (x: number, y: number) => Math.round(x + (y - x) * k);
  return `rgb(${m(r1, r2)}, ${m(g1, g2)}, ${m(b1, b2)})`;
}

export const FONT = {
  /** Основной дисплейный шрифт презентации (узкий, только Bold). */
  sans: "'Sofia Sans Extra Condensed', 'Segoe UI', system-ui, sans-serif",
  /** Моноширинный — для табличных цифр и «логов». */
  mono: "'Cascadia Mono', Consolas, ui-monospace, monospace",
} as const;

/** Имя семейства для предзагрузки через document.fonts. */
export const DISPLAY_FAMILY = 'Sofia Sans Extra Condensed';

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
