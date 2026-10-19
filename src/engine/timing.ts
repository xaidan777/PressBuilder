/**
 * Модель таймингов.
 *
 * Длительность каждой реплики считается из её текста, а не задаётся вручную:
 * берём скорость дикторской речи в знаках/сек и добавляем паузу, зависящую
 * от знака препинания в конце фразы. Поэтому при дописывании сценария
 * тайминги пересчитываются сами — руками ничего править не нужно.
 */

export const TIMING = {
  /** Знаков в секунду. Спокойная русская закадровая читка ≈ 14–15. */
  cps: 14.4,
  /** Минимальная длительность реплики. */
  minCue: 0.85,
  /** Паузы после реплики по финальному знаку. */
  pause: {
    none: 0.18,
    comma: 0.26,
    dash: 0.3,
    period: 0.46,
    question: 0.58,
    exclaim: 0.6,
    colon: 0.5,
  },
  /** Пауза перед первой репликой сцены (на въезд графики). */
  lead: 0.75,
  /** Пауза после последней реплики сцены. */
  tail: 0.8,
  /** Кроссфейд/затемнение на стыке сцен. */
  fade: 0.42,
} as const;

function pauseFor(text: string): number {
  const last = text.trim().slice(-1);
  const p = TIMING.pause;
  switch (last) {
    case '?':
      return p.question;
    case '!':
      return p.exclaim;
    case '.':
    case '…':
      return p.period;
    case ':':
      return p.colon;
    case ',':
      return p.comma;
    case '—':
    case '-':
      return p.dash;
    default:
      return p.none;
  }
}

/**
 * Длительность реплики: чистая читка + пауза + ручной hold.
 * Внутренние запятые немного замедляют фразу — так честнее звучит.
 */
export function cueDuration(say: string, rate = 1, hold = 0): number {
  const chars = say.trim().length;
  const commas = (say.match(/[,—:;]/g) ?? []).length;
  const speech = Math.max(TIMING.minCue, chars / TIMING.cps) + commas * 0.12;
  return speech * rate + pauseFor(say) + hold;
}
