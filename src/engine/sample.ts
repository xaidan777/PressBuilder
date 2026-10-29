/**
 * Слайд-пример для окна выбора стиля: заголовок, реплика и маленький график.
 * На нём видны палитра, шрифты и фон пресета ещё до того, как у ролика появятся сцены.
 */

import { easeOutCubic, seg } from './anim.ts';
import { drawBackground } from './background.ts';
import { panel, rrPath } from './draw.ts';
import { reveal, text, wrap, type TextStyle } from './text.ts';
import { a, C, currentStyle, H, PAD, SAFE_BOTTOM, TYPE, W, withStyle } from './theme.ts';

type Ctx = CanvasRenderingContext2D;

export interface SampleText {
  title: string;
  line: string;
}

/** Длина петли анимации превью, сек. */
export const SAMPLE_LOOP = 6;
/** Момент, когда всё уже появилось, — для неподвижных миниатюр. */
export const SAMPLE_STILL = 3.2;

const COL_W = 960;
/** Рабочая зона по вертикали (в координатах сцены). */
const ZONE = [170, H - 90];
const BARS = [0.46, 0.72, 0.94];

/** Не больше `max` строк; лишнее — многоточием. */
function clampLines(ctx: Ctx, str: string, st: TextStyle, max: number): string {
  const lines = wrap(ctx, str, st);
  if (lines.length <= max) return str;
  return `${lines.slice(0, max).join(' ').replace(/[\s,.;:—–-]+$/u, '')}…`;
}

/** Кадр примера в стиле `styleId` в момент `t` петли. Холст — в координатах 1920×1080. */
export function drawSample(ctx: Ctx, styleId: string, t: number, s: SampleText): void {
  withStyle(styleId, () => {
    ctx.save();
    drawBackground(ctx, t + 2, 0);

    // как в ролике: контент ужат над зоной проигрывателя
    const k = (H - SAFE_BOTTOM) / H;
    ctx.translate(W / 2, 0);
    ctx.scale(k, k);
    ctx.translate(-W / 2, 0);
    // в конце петли кадр гаснет, чтобы повтор не дёргался
    ctx.globalAlpha = 1 - seg(t, SAMPLE_LOOP - 0.5, 0.45);

    const titleSt: TextStyle = {
      size: 108,
      family: 'display',
      color: C.h1,
      tracking: TYPE.tracking,
      maxWidth: COL_W,
      lineHeight: 1.08,
    };
    const lineSt: TextStyle = {
      size: 58,
      color: C.text,
      tracking: TYPE.tracking * 0.5,
      maxWidth: COL_W,
      lineHeight: 1.25,
    };
    const title = clampLines(ctx, s.title, titleSt, 2);
    const line = clampLines(ctx, s.line, lineSt, 3);
    const titleH = wrap(ctx, title, titleSt).length * 108 * 1.08;
    const lineH = wrap(ctx, line, lineSt).length * 58 * 1.25;
    // текст и карточка центруются по вертикали в рабочей зоне, как у черновых слайдов
    const mid = (ZONE[0] + ZONE[1]) / 2;
    const top = mid - (titleH + 54 + lineH) / 2 + 108 * 0.8;
    const lineY = top + titleH + 54;

    // направляющая слева — как у черновых слайдов
    const grow = easeOutCubic(seg(t, 0.1, 1.4));
    ctx.save();
    ctx.strokeStyle = a(C.h1, 0.55);
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(PAD.x - 44, top - 84);
    ctx.lineTo(PAD.x - 44, top - 84 + (lineY + lineH - top + 40) * grow);
    ctx.stroke();
    ctx.restore();

    reveal(ctx, title, PAD.x, top, titleSt, seg(t, 0.2, 0.9), { mask: true, stagger: 0.12 });
    reveal(ctx, line, PAD.x, lineY, lineSt, seg(t, 0.8, 0.9), { stagger: 0.08, rise: 20 });

    // карточка с графиком: три цвета палитры
    const px = 1270;
    const pw = 500;
    const ph = 560;
    const py = mid - ph / 2 - 20;
    const pin = easeOutCubic(seg(t, 0.9, 0.7));
    if (pin > 0) {
      ctx.save();
      ctx.globalAlpha *= pin;
      ctx.translate(0, (1 - pin) * 30);
      // скругление и обводка — из стиля: острые углы у интерьерных стилей, двойная рамка у «Линий»
      const { radius: r, cardLines } = currentStyle();
      if (cardLines === 2) {
        panel(ctx, px, py, pw, ph, { radius: r * 1.4, stroke: C.h1, lineWidth: 3 });
        panel(ctx, px + 9, py + 9, pw - 18, ph - 18, { radius: r, fill: 'none', stroke: a(C.h1, 0.7), lineWidth: 1.5 });
      } else {
        panel(ctx, px, py, pw, ph, { radius: r * 2.2, stroke: a(C.text, r ? 0.1 : 0.16), lineWidth: r ? 2 : 1.5 });
      }
      const base = py + ph - 120;
      const bw = 78;
      const gap = (pw - 80 - bw * 3) / 2;
      const colors = [C.h1, C.accent, C.pos];
      BARS.forEach((v, i) => {
        const g = easeOutCubic(seg(t, 1.2 + i * 0.18, 0.8));
        if (g <= 0) return;
        const bx = px + 40 + i * (bw + gap);
        const bh = (ph - 220) * v * g;
        ctx.fillStyle = colors[i];
        rrPath(ctx, bx, base - bh, bw, bh, r ? [10, 10, 2, 2] : 0);
        ctx.fill();
        ctx.save();
        ctx.globalAlpha *= seg(g, 0.6, 0.4);
        text(ctx, String(Math.round(v * 100)), bx + bw / 2, base - bh - 22, {
          size: 50,
          color: C.text,
          align: 'center',
          family: 'display',
        });
        ctx.restore();
      });
      ctx.strokeStyle = a(C.text, 0.3);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px + 30, base + 1);
      ctx.lineTo(px + pw - 30, base + 1);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  });
}
