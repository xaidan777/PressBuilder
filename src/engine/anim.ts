/** Математика анимаций: нормализация времени, easing, детерминированный шум. */

export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v: number) => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Прогресс 0..1 отрезка [start, start+dur] в момент t. */
export function seg(t: number, start: number, dur: number): number {
  if (dur <= 0) return t >= start ? 1 : 0;
  return clamp01((t - start) / dur);
}

/** Треугольный импульс 0→1→0 на отрезке [start, start+dur]. */
export function pulse(t: number, start: number, dur: number): number {
  const p = seg(t, start, dur);
  return p < 0.5 ? p * 2 : (1 - p) * 2;
}

/** Появление и исчезновение: 0→1 за `inD`, 1→0 за `outD` перед концом `dur`. */
export function inOut(t: number, dur: number, inD = 0.4, outD = 0.4): number {
  return Math.min(seg(t, 0, inD), 1 - seg(t, dur - outD, outD));
}

// ---------- easing ----------

export const easeLinear = (t: number) => t;
export const easeInQuad = (t: number) => t * t;
export const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t: number) => t * t * t;
export const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
export const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeInOutQuint = (t: number) =>
  t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;

export function easeOutBack(t: number, s = 1.7): number {
  const c = s + 1;
  return 1 + c * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
}

export function easeOutElastic(t: number, amp = 1, period = 0.35): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return amp * Math.pow(2, -10 * t) * Math.sin(((t - period / 4) * (2 * Math.PI)) / period) + 1;
}

/** Затухающие колебания вокруг 1 — для «прыжка» цифр и иконок. */
export function bounceIn(p: number): number {
  return easeOutBack(clamp01(p), 2.2);
}

// ---------- детерминированный псевдослучай (одинаков на каждом прогоне) ----------

export function hash11(x: number): number {
  const s = Math.sin(x * 127.1) * 43758.5453123;
  return s - Math.floor(s);
}

export function hash21(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

/** Плавный 1D-шум по времени (сумма синусов, без состояния). */
export function noise1(t: number, seed = 0): number {
  return (
    0.5 * Math.sin(t * 1.0 + seed * 12.9) +
    0.3 * Math.sin(t * 2.3 + seed * 7.7) +
    0.2 * Math.sin(t * 4.1 + seed * 3.3)
  );
}

/** Затухающая тряска кадра. */
export function shake(t: number, start: number, dur: number, amp: number): [number, number] {
  const p = seg(t, start, dur);
  if (p <= 0 || p >= 1) return [0, 0];
  const k = amp * Math.pow(1 - p, 2.2);
  const lt = t - start;
  return [Math.sin(lt * 71) * k, Math.cos(lt * 53) * k * 0.7];
}

/** Число с разделителем разрядов: 9000 → «9 000». */
export function fmtNum(n: number, sep = ' '): string {
  const neg = n < 0;
  const s = Math.abs(Math.round(n)).toString();
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += sep;
    out += s[i];
  }
  return (neg ? '−' : '') + out;
}

/** Секунды → «m:ss». */
export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
