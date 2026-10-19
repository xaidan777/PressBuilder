/** Мелкие помощники редактора: время, id, числа. */

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const round = (v: number, digits = 0) => {
  const k = 10 ** digits;
  return Math.round(v * k) / k;
};

/** 83.4 → «1:23.4»; `dec = 0` → «1:23». */
export function clock(sec: number, dec = 0): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  const whole = dec ? rest.toFixed(dec) : String(Math.floor(rest + 1e-6));
  return `${m}:${whole.padStart(dec ? 3 + dec : 2, '0')}`;
}

/** «2:30», «2:30.5», «150» → секунды; мусор → null. */
export function parseClock(str: string): number | null {
  const s = str.trim().replace(',', '.');
  if (!s) return null;
  const m = /^(\d+):(\d{1,2}(?:\.\d+)?)$/.exec(s);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k',
  л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c',
  ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/** Заголовок → id папки ролика: «3D-движок для LLM» → «3d-dvizhok-dlya-llm». */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .split('')
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
    .replace(/-+$/, '');
}

export function fmtSize(bytes: number): string {
  return bytes > 1 << 20 ? `${(bytes / (1 << 20)).toFixed(1)} МБ` : `${Math.ceil(bytes / 1024)} КБ`;
}

/** Захват указателя на время жеста. Синтетические события (тесты) захватить нельзя — не страшно. */
export function capture(el: Element, e: PointerEvent): void {
  try {
    el.setPointerCapture(e.pointerId);
  } catch {
    /* указатель уже отпущен */
  }
}

/** Событие пришло из поля ввода — глобальные хоткеи его не трогают. */
export function isTyping(e: Event): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable;
}

const plural = (n: number, one: string, few: string, many: string) => {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  return b === 1 ? one : many;
};

export const nSlides = (n: number) => `${n} ${plural(n, 'слайд', 'слайда', 'слайдов')}`;
export const nCues = (n: number) => `${n} ${plural(n, 'реплика', 'реплики', 'реплик')}`;
export const nChars = (n: number) => `${n.toLocaleString('ru-RU')} ${plural(n, 'знак', 'знака', 'знаков')}`;
