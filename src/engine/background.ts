/**
 * Непрерывный фон презентации: он живёт независимо от сцен,
 * поэтому на стыках сцен кадр не «моргает». У каждого стиля ролика свой фон.
 */

import { hash11, hash21, noise1 } from './anim.ts';
import { hexPath } from './draw.ts';
import { a, C, currentStyle, H, mix, PAD, W } from './theme.ts';

type Ctx = CanvasRenderingContext2D;

export function drawBackground(ctx: Ctx, gt: number, energy = 0): void {
  ctx.save();
  switch (currentStyle().background) {
    case 'night':
      drawNight(ctx, gt, energy);
      break;
    case 'paper':
      drawPaper(ctx, gt, energy);
      break;
    case 'lines':
      drawLines(ctx, gt, energy);
      break;
    default:
      drawHex(ctx, gt, energy);
  }
  ctx.restore();
}

function drawVignette(ctx: Ctx, color = '#000000', alpha = 0.42): void {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, a(color, 0));
  g.addColorStop(1, a(color, alpha));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Мягкое пятно света на весь кадр. */
function glowAt(ctx: Ctx, x: number, y: number, r: number, color: string, alpha: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, a(color, alpha));
  g.addColorStop(1, a(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Тонкая рамка-паспарту по краю кадра. */
function hairlineFrame(ctx: Ctx, color: string, alpha: number, inset = 46): void {
  ctx.strokeStyle = a(color, alpha);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(inset + 0.5, inset + 0.5, W - inset * 2 - 1, H - inset * 2 - 1);
}

// ------------------------------------------------------------------ фактуры

/**
 * Фактуры считаются один раз (детерминированный шум) и кэшируются по стилю.
 * Вне браузера (tools/check.mjs) их нет — фон рисуется без них.
 */
const surfaces = new Map<string, HTMLCanvasElement | null>();

function surface(key: string, w: number, h: number, paint: (g: Ctx, w: number, h: number) => void): HTMLCanvasElement | null {
  const k = `${currentStyle().id}:${key}`;
  if (surfaces.has(k)) return surfaces.get(k) ?? null;
  let cv: HTMLCanvasElement | null = null;
  if (typeof document !== 'undefined') {
    cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const g = cv.getContext('2d');
    if (g) paint(g, w, h);
    else cv = null;
  }
  surfaces.set(k, cv);
  return cv;
}

const patterns = new Map<string, CanvasPattern | null>();

/** Повторяющийся узор из фактуры (зерно, волокна, переплетение нитей). */
function pattern(ctx: Ctx, key: string, size: number, paint: (img: ImageData, n: number) => void): CanvasPattern | null {
  const k = `${currentStyle().id}:${key}`;
  if (patterns.has(k)) return patterns.get(k) ?? null;
  const cv = surface(key, size, size, (g, n) => {
    const img = g.createImageData(n, n);
    paint(img, n);
    g.putImageData(img, 0, 0);
  });
  const p = cv ? ctx.createPattern(cv, 'repeat') : null;
  patterns.set(k, p);
  return p;
}

/** Сглаженный шум по сетке — основа для пятен штукатурки и льна. */
function vnoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const s = (t: number) => t * t * (3 - 2 * t);
  const u = s(x - xi);
  const v = s(y - yi);
  const h = (i: number, j: number) => hash21(i + seed * 17.3, j - seed * 9.1);
  const p = h(xi, yi);
  const q = h(xi + 1, yi);
  const r = h(xi, yi + 1);
  const t = h(xi + 1, yi + 1);
  return p + (q - p) * u + (r - p) * v + (p - q - r + t) * u * v;
}

/** Мелкое зерно: светлые и тёмные точки с заданной силой. */
function grain(img: ImageData, n: number, light: number, dark: number): void {
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const v = hash21(x * 1.13 + 3.1, y * 0.97 + 7.7);
      const i = (y * n + x) * 4;
      const up = v > 0.5;
      const k = (Math.abs(v - 0.5) * 2) ** 2;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = up ? 255 : 0;
      img.data[i + 3] = Math.round(k * (up ? light : dark));
    }
  }
}

/**
 * Пятна «штукатурки»: крупный шум в низком разрешении. Растянутый на кадр,
 * он мягкий и не повторяется — как известковая краска на стене.
 */
function limewash(light: string, dark: string, strength: number): HTMLCanvasElement | null {
  return surface('limewash', 240, 135, (g, w, h) => {
    const img = g.createImageData(w, h);
    const lc = parseInt(light.slice(1), 16);
    const dc = parseInt(dark.slice(1), 16);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const f =
          0.55 * vnoise(x / 26, y / 26, 1) + 0.3 * vnoise(x / 9, y / 9, 2) + 0.15 * vnoise(x / 3.5, y / 3.5, 3) - 0.5;
        const c = f > 0 ? lc : dc;
        const i = (y * w + x) * 4;
        img.data[i] = (c >> 16) & 255;
        img.data[i + 1] = (c >> 8) & 255;
        img.data[i + 2] = c & 255;
        img.data[i + 3] = Math.round(Math.min(1, Math.abs(f) * 2.4) * 255 * strength);
      }
    }
    g.putImageData(img, 0, 0);
  });
}

// ------------------------------------------------------------------ Terevo: сота

const HEX_R = 62;
const COLS = Math.ceil(W / (HEX_R * 1.5)) + 3;
const ROWS = Math.ceil(H / (HEX_R * Math.sqrt(3))) + 3;

const PARTICLES = Array.from({ length: 70 }, (_, i) => ({
  x: hash11(i * 1.7) * W,
  y: hash11(i * 3.3 + 11) * H,
  r: 1 + hash11(i * 5.1) * 2.6,
  spd: 6 + hash11(i * 7.7) * 16,
  drift: (hash11(i * 9.1) - 0.5) * 22,
  seed: i,
}));

function drawHex(ctx: Ctx, gt: number, energy: number): void {
  // база
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // два мягких источника света
  const lx = W * 0.22 + noise1(gt * 0.09, 1) * 60;
  const ly = H * 0.18 + noise1(gt * 0.11, 2) * 40;
  let g = ctx.createRadialGradient(lx, ly, 0, lx, ly, W * 0.62);
  g.addColorStop(0, a(C.h1, 0.075 + energy * 0.05));
  g.addColorStop(1, a(C.h1, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const ax = W * 0.84 + noise1(gt * 0.07, 5) * 50;
  const ay = H * 0.82 + noise1(gt * 0.08, 6) * 40;
  g = ctx.createRadialGradient(ax, ay, 0, ax, ay, W * 0.5);
  g.addColorStop(0, a(C.accent, 0.05 + energy * 0.04));
  g.addColorStop(1, a(C.accent, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  drawHexField(ctx, gt, energy);
  drawParticles(ctx, gt);
  drawVignette(ctx);
}

function drawHexField(ctx: Ctx, gt: number, energy: number): void {
  const dx = ((gt * 7) % (HEX_R * 1.5)) - HEX_R * 1.5;
  const dy = ((gt * -4) % (HEX_R * Math.sqrt(3))) + HEX_R * Math.sqrt(3);
  ctx.save();
  ctx.lineWidth = 1.2;
  for (let c = -2; c < COLS; c++) {
    const cx = c * HEX_R * 1.5 + dx;
    for (let r = -2; r < ROWS; r++) {
      const cy = r * HEX_R * Math.sqrt(3) + (c % 2 ? (HEX_R * Math.sqrt(3)) / 2 : 0) + dy;
      // волна подсветки, бегущая по полю
      const wave = Math.sin(cx * 0.004 + cy * 0.005 - gt * 0.9);
      const base = 0.035 + Math.max(0, wave) * (0.05 + energy * 0.16);
      const flick = hash21(c, r);
      const alpha = base * (0.5 + flick * 0.9);
      ctx.strokeStyle = a(flick > 0.94 ? C.h1 : C.text, alpha);
      hexPath(ctx, cx, cy, HEX_R * 0.92);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawParticles(ctx: Ctx, gt: number): void {
  ctx.save();
  for (const p of PARTICLES) {
    const y = (((p.y - gt * p.spd) % (H + 60)) + H + 60) % (H + 60);
    const x = p.x + noise1(gt * 0.25, p.seed) * p.drift;
    const tw = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(gt * 1.6 + p.seed));
    ctx.fillStyle = a(p.seed % 7 === 0 ? C.accent : C.h1, tw * 0.5);
    ctx.beginPath();
    ctx.arc(x, y - 30, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ Полночь: синяя стена вечером

/**
 * Матовая тёмно-синяя стена, тёплый свет лампы сверху справа и холодная тень
 * снизу слева; известковые пятна и зерно дают фактуру, тонкая рамка — паспарту.
 */
function drawNight(ctx: Ctx, gt: number, energy: number): void {
  const [lamp, shade] = currentStyle().decor;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, mix(C.bg, C.accent, 0.1));
  g.addColorStop(0.55, C.bg);
  g.addColorStop(1, mix(C.bg, shade, 0.6));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const wash = limewash(mix(C.bg, C.accent, 0.3), shade, 0.1);
  if (wash) {
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(wash, 0, 0, W, H);
  }

  // лампа дышит еле заметно; на кульминациях свет теплее
  const lx = W * 0.84 + noise1(gt * 0.05, 3) * 40;
  const ly = -H * 0.12 + noise1(gt * 0.06, 4) * 24;
  ctx.globalCompositeOperation = 'soft-light';
  glowAt(ctx, lx, ly, W * 0.7, lamp, 0.55 + energy * 0.2);
  ctx.globalCompositeOperation = 'screen';
  glowAt(ctx, lx - 60, ly + 30, W * 0.36, lamp, 0.1 + energy * 0.08);
  ctx.globalCompositeOperation = 'source-over';
  glowAt(ctx, W * 0.08, H * 1.05, W * 0.6, shade, 0.55);

  const fine = pattern(ctx, 'grain', 160, (img, n) => grain(img, n, 22, 46));
  if (fine) {
    ctx.fillStyle = fine;
    ctx.fillRect(0, 0, W, H);
  }
  drawVignette(ctx, shade, 0.55);
  hairlineFrame(ctx, C.text, 0.12);
}

// ------------------------------------------------------------------ Бумага: зерно и поля

function drawPaper(ctx: Ctx, gt: number, energy: number): void {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // свет из окна слева сверху и акварельные размывы цвета
  const [warm, ink] = currentStyle().decor;
  glowAt(ctx, W * 0.12, -H * 0.1, W * 0.75, '#ffffff', 0.55);
  glowAt(ctx, W * 0.86 + noise1(gt * 0.05, 7) * 80, H * 0.78 + noise1(gt * 0.06, 8) * 50, W * 0.36, warm, 0.07 + energy * 0.06);
  glowAt(ctx, W * 0.66 + noise1(gt * 0.04, 9) * 90, H * 0.08 + noise1(gt * 0.05, 10) * 40, W * 0.3, ink, 0.05 + energy * 0.04);

  // строки и двойное поле, как в рукописи
  ctx.save();
  ctx.strokeStyle = a(C.text, 0.045);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let y = 96; y < H; y += 74) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
  }
  ctx.stroke();
  ctx.strokeStyle = a(C.h1, 0.2);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (const x of [PAD.x - 78, PAD.x - 70]) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  ctx.stroke();
  ctx.restore();

  // зерно и редкие светлые волокна
  const paper = pattern(ctx, 'paper', 192, (img, n) => {
    grain(img, n, 34, 34);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (hash21(Math.floor(x / 7), y) <= 0.93) continue;
        const i = (y * n + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = Math.max(img.data[i + 3], 26);
      }
    }
  });
  if (paper) {
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, W, H);
  }
  drawVignette(ctx, mix(C.text, C.bg, 0.35), 0.16);
}

// ------------------------------------------------------------------ Линии: белая дымка, цветные полосы, тонкие линии

/** Полоса поперёк направления пучка: сдвиг от оси, ширина, цвет. */
type Band = [number, number, string];

/** Пучок полос идёт снизу слева вверх направо, по правому краю кадра. */
const STRIPES = { x: W * 0.9, y: H * 0.42, angle: -1.02 };

/** Далёкая гряда в дымке: высота профиля в точке `x`. */
function ridge(x: number, seed: number, amp: number): number {
  return (
    (0.5 * vnoise(x / 280, 0.5, seed) +
      0.28 * vnoise(x / 95, 1.5, seed) +
      0.14 * vnoise(x / 32, 2.5, seed) +
      0.08 * vnoise(x / 9, 3.5, seed)) *
    amp
  );
}

function drawRidges(ctx: Ctx, gt: number, slate: string): void {
  const layers = [
    { base: H * 0.72, amp: 230, tone: 0.11, speed: 0.6, seed: 3 },
    { base: H * 0.83, amp: 190, tone: 0.19, speed: 1.2, seed: 5 },
    { base: H * 0.95, amp: 140, tone: 0.28, speed: 2, seed: 8 },
  ];
  for (const l of layers) {
    // слои еле заметно плывут с разной скоростью — у кадра есть глубина
    const off = gt * l.speed;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, l.base - ridge(x + off, l.seed, l.amp));
    ctx.lineTo(W, H);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, l.base - l.amp, 0, H);
    g.addColorStop(0, mix(C.bg, slate, l.tone));
    g.addColorStop(1, a(mix(C.bg, slate, l.tone * 0.4), 0));
    ctx.fillStyle = g;
    ctx.fill();
  }
}

function drawStripes(ctx: Ctx, mint: string, slate: string): void {
  const bands: Band[] = [
    [-128, 10, slate],
    [-110, 42, C.pos],
    [-64, 118, C.accent],
    [62, 30, mint],
    [100, 5, slate],
  ];
  ctx.save();
  ctx.translate(STRIPES.x, STRIPES.y);
  ctx.rotate(STRIPES.angle);
  for (const [off, w, col] of bands) {
    ctx.fillStyle = col;
    ctx.fillRect(-1600, off, 3200, w);
  }
  ctx.restore();
}

/** Тонкие двойные линии со скруглёнными поворотами — по краям кадра. */
function drawFineLines(ctx: Ctx): void {
  ctx.save();
  ctx.strokeStyle = a(C.accent, 0.8);
  ctx.lineWidth = 2;
  for (const d of [0, 11]) {
    // слева: из-за края, поворот вниз вдоль кромки
    const r = 52 + d;
    ctx.beginPath();
    ctx.moveTo(-10, 210 - d);
    ctx.lineTo(62 + d - r, 210 - d);
    ctx.arcTo(62 + d, 210 - d, 62 + d, H, r);
    ctx.lineTo(62 + d, H + 10);
    // справа внизу: подъём от нижнего края и поворот к правому
    const x0 = W * 0.58 - d;
    const y0 = H * 0.88 - d;
    ctx.moveTo(x0, H + 10);
    ctx.arcTo(x0, y0, W, y0, 90 + d);
    ctx.lineTo(W + 10, y0);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLines(ctx: Ctx, gt: number, energy: number): void {
  const [mint, slate] = currentStyle().decor;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, mix(C.bg, '#ffffff', 0.7));
  g.addColorStop(0.55, C.bg);
  g.addColorStop(1, mix(C.bg, slate, 0.06));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // холодный свет сверху и тёплый отсвет полос справа
  glowAt(ctx, W * 0.45, -H * 0.2, W * 0.7, '#ffffff', 0.7);
  glowAt(ctx, W * 0.86, H * 0.4, W * 0.32, C.accent, 0.06 + energy * 0.06);

  drawRidges(ctx, gt, slate);
  drawStripes(ctx, mint, slate);

  // дымка: полосы и гряды выходят из тумана внизу
  const fog = ctx.createLinearGradient(0, H * 0.5, 0, H);
  fog.addColorStop(0, a(mix(C.bg, '#ffffff', 0.5), 0));
  fog.addColorStop(0.7, a(mix(C.bg, '#ffffff', 0.5), 0.7));
  fog.addColorStop(1, a(mix(C.bg, '#ffffff', 0.5), 0.92));
  ctx.fillStyle = fog;
  ctx.fillRect(0, 0, W, H);

  drawFineLines(ctx);

  // зерно печатного постера
  const print = pattern(ctx, 'print', 160, (img, n) => grain(img, n, 26, 30));
  if (print) {
    ctx.fillStyle = print;
    ctx.fillRect(0, 0, W, H);
  }
  drawVignette(ctx, slate, 0.07);
}
