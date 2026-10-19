/** Слайд 4. Все инструменты собираются в одном окне; установка не нужна. */

import { pulse, seg } from '../../engine/anim.ts';
import { hexPath, rrPath, shockRing } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C, mix } from '../../engine/theme.ts';
import type { SceneDef } from '../../engine/types.ts';
import { appear, appWindow, GREEN, sprite, spriteCell } from './common.ts';

type Ctx = CanvasRenderingContext2D;

const WIN = { x: 670, y: 535, w: 1040, h: 640 };
const PAD = 24;

/** Панель внутри окна. */
function pane(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  rrPath(ctx, x, y, w, h, 12);
  ctx.fillStyle = C.panel;
  ctx.fill();
  ctx.strokeStyle = a(C.text, 0.1);
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** Ползунок настройки — условный элемент интерфейса. */
function slider(ctx: Ctx, x: number, y: number, w: number, k: number, color: string): void {
  ctx.fillStyle = a(C.text, 0.18);
  rrPath(ctx, x, y - 3, w, 6, 3);
  ctx.fill();
  ctx.fillStyle = color;
  rrPath(ctx, x, y - 3, w * k, 6, 3);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + w * k, y, 9, 0, Math.PI * 2);
  ctx.fill();
}

export const scene04: SceneDef = {
  id: 's04',

  energy(_t, cue) {
    const c = cue('noinstall');
    return pulse(c.t, 0, 1.4) * 0.7;
  },

  render(f) {
    const { ctx, gt } = f;
    const cW = f.cue('window');
    const cN = f.cue('noinstall');

    f.obj('window', { x: WIN.x, y: WIN.y, text: 'Atlas Converter', label: 'Окно программы' }, (o) => {
      appear(
        ctx,
        seg(f.t, 0.05, 0.6),
        () => {
          const box = appWindow(ctx, -WIN.w / 2, -WIN.h / 2, WIN.w, WIN.h, { glow: a(C.h1, 0.22) });
          text(ctx, o.text, -WIN.w / 2 + 110, -WIN.h / 2 + 40, { size: 46, color: a(C.text, 0.85), tracking: 1.5 });

          const top = box.y + PAD;
          const h = box.h - PAD * 2;
          const left = box.x + PAD;
          const cols = [290, 390, 264];

          // 1. видео
          appear(
            ctx,
            seg(cW.t, 0.05, 0.5),
            () => {
              const w = cols[0];
              pane(ctx, left, top, w, h);
              ctx.save();
              rrPath(ctx, left + 16, top + 16, w - 32, w - 32, 8);
              ctx.clip();
              ctx.fillStyle = GREEN;
              ctx.fillRect(left, top, w, w);
              sprite(ctx, left + w / 2, top + w / 2 + 6, 190, gt * 0.9);
              ctx.restore();
              icon(ctx, 'play', left + 34, top + w + 22, 26, C.h1);
              slider(ctx, left + 62, top + w + 22, w - 90, (gt * 0.12) % 1, C.h1);
              slider(ctx, left + 22, top + w + 86, w - 44, 0.62, C.accent);
              slider(ctx, left + 22, top + w + 136, w - 44, 0.35, C.accent);
            },
            { dy: 26 },
          );

          // 2. атлас с уже вырезанным фоном
          appear(
            ctx,
            seg(cW.t, 0.3, 0.5),
            () => {
              const x = left + cols[0] + PAD;
              const w = cols[1];
              pane(ctx, x, top, w, h);
              const cell = 112;
              const gap = 10;
              const gx = x + (w - cell * 3 - gap * 2) / 2;
              for (let i = 0; i < 9; i++) {
                spriteCell(ctx, gx + (i % 3) * (cell + gap), top + 16 + Math.floor(i / 3) * (cell + gap), cell, i / 9, {
                  keyX: Infinity,
                  radius: 8,
                });
              }
              const sy = top + 16 + cell * 3 + gap * 2 + 40;
              slider(ctx, x + 24, sy, w - 48, 0.72, C.pos);
              slider(ctx, x + 24, sy + 50, w - 48, 0.4, C.pos);
              slider(ctx, x + 24, sy + 100, w - 48, 0.55, C.pos);
            },
            { dy: 26 },
          );

          // 3. пакет отдельных спрайтов
          appear(
            ctx,
            seg(cW.t, 0.55, 0.5),
            () => {
              const x = left + cols[0] + cols[1] + PAD * 2;
              const w = cols[2];
              pane(ctx, x, top, w, h);
              for (let i = 0; i < 4; i++) {
                const y = top + 18 + i * 128;
                ctx.save();
                rrPath(ctx, x + 18, y, 108, 108, 8);
                ctx.clip();
                ctx.fillStyle = mix([C.h1, C.accent, C.pos, C.h1][i], C.bg, 0.6);
                ctx.fillRect(x + 18, y, 108, 108);
                sprite(ctx, x + 72, y + 58, 84, 0.1 + i * 0.23);
                ctx.restore();
                ctx.fillStyle = a(C.text, 0.3);
                rrPath(ctx, x + 142, y + 28, 78, 10, 5);
                ctx.fill();
                rrPath(ctx, x + 142, y + 50, 52, 10, 5);
                ctx.fill();
                icon(ctx, 'check', x + 156, y + 86, 26, C.pos);
              }
            },
            { dy: 26 },
          );
        },
        { from: 0.92, dy: 30 },
      );
    });

    f.obj('one', { x: 1250, y: 380, text: cW.show, label: 'Всё в одном окне' }, (o) => {
      reveal(
        ctx,
        o.text,
        0,
        0,
        { size: 110, color: C.h1, maxWidth: 540, lineHeight: 1.05, tracking: 1, glowColor: a(C.h1, 0.3), glowBlur: 30 },
        seg(cW.t, 0, 0.8),
        { stagger: 0.3, rise: 30 },
      );
    });

    // значок установщика, перечёркнутый наискось
    f.obj('no-install', { x: 1330, y: 650, label: 'Значок «без установки»' }, () => {
      const p = seg(cN.t, 0, 0.5);
      if (p <= 0) return;
      shockRing(ctx, 0, 0, seg(cN.t, 0.2, 0.8), 190, C.accent, 4);
      appear(
        ctx,
        p,
        () => {
          hexPath(ctx, 0, 0, 78, Math.PI / 6);
          ctx.fillStyle = C.panel;
          ctx.fill();
          ctx.strokeStyle = a(C.accent, 0.9);
          ctx.lineWidth = 5;
          ctx.stroke();
          icon(ctx, 'download', 0, 0, 74, a(C.text, 0.75));
          const cut = seg(cN.t, 0.3, 0.35);
          if (cut > 0) {
            ctx.strokeStyle = C.accent;
            ctx.lineWidth = 10;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-62, -62);
            ctx.lineTo(-62 + 124 * cut, -62 + 124 * cut);
            ctx.stroke();
          }
        },
        { from: 0.3, back: true },
      );
    });

    f.obj('noinstall', { x: 1250, y: 830, text: cN.show, label: 'Без установки' }, (o) => {
      reveal(
        ctx,
        o.text,
        0,
        0,
        { size: 110, color: C.accent, maxWidth: 540, lineHeight: 1.05, tracking: 1 },
        seg(cN.t, 0.1, 0.7),
        { stagger: 0.3, rise: 30 },
      );
    });
  },
};
