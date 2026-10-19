/**
 * Сцена 13. Как начать: папка залетает в окно агента, в ней два батника —
 * от каждого стрелка к тому, что он запускает.
 */

import { clamp01, easeInOutCubic, easeOutQuart, seg } from '../../engine/anim.ts';
import { arrow, panel, rrPath } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import { drawGrid, drawSolid, MESH, type View } from '../../engine/wire3d.ts';
import { appear, bez, SCREEN_BG, windowFrame, type Rect } from './common.ts';

type Ctx = CanvasRenderingContext2D;

const WIN = { x: 150, y: 270, w: 760, h: 700 };
const ROW = { x: WIN.x + 40, w: WIN.w - 80, h: 104 };
const rowY = (i: number) => WIN.y + 250 + i * 124;
const TILE = { x: 1040, w: 730, h: 320 };
const tileY = (i: number) => 270 + i * 380;

/** Мини-экран проекта: вращающееся тело на сетке. */
function projectScreen(ctx: Ctx, r: Rect, gt: number): void {
  const view: View = { cx: r.x + r.w / 2, cy: r.y + r.h * 0.6, size: 58, pitch: 0.45, yaw: gt * 0.5, dist: 8 };
  drawGrid(ctx, view, { half: 3, step: 1, color: a(C.h1, 0.2), width: 1.2 });
  drawSolid(ctx, MESH.icosa, view, { pos: [0, 0.9, 0], scale: 1.7, ry: gt }, { color: C.h1 });
}

/** Мини-экран редактора: вьюпорт слева, столбик полей инспектора справа. */
function editorScreen(ctx: Ctx, r: Rect, gt: number): void {
  const split = r.w * 0.62;
  const view: View = { cx: r.x + split / 2, cy: r.y + r.h * 0.62, size: 46, pitch: 0.5, yaw: 0.5, dist: 8 };
  drawGrid(ctx, view, { half: 3, step: 1, color: a(C.h1, 0.2), width: 1.2 });
  drawSolid(ctx, MESH.cube, view, { pos: [0, 0.6, 0], scale: 1.3, ry: gt * 0.4 }, { color: C.accent });
  ctx.fillStyle = C.panel;
  ctx.fillRect(r.x + split, r.y, r.w - split, r.h);
  for (let i = 0; i < 4; i++) {
    const y = r.y + 34 + i * 50;
    const v = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(gt * 1.3 + i * 1.9));
    const tw = r.w - split - 36;
    ctx.fillStyle = a(C.text, 0.14);
    rrPath(ctx, r.x + split + 18, y, tw, 8, 4);
    ctx.fill();
    ctx.fillStyle = C.h1;
    rrPath(ctx, r.x + split + 18, y, tw * v, 8, 4);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r.x + split + 18 + tw * v, y + 4, 10, 0, Math.PI * 2);
    ctx.fill();
  }
}

export const scene13: SceneDef = {
  id: 's13',

  render(f: Frame) {
    const { ctx, gt } = f;
    const cO = f.cue('open');
    const cR = f.cue('run');
    const cE = f.cue('editor');

    f.obj('title', { x: 150, y: 200, abs: true, text: cO.show, label: 'Заголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        200,
        { size: 96, color: C.h1, tracking: 0.6 },
        seg(cO.t, 0, 0.6),
        { stagger: 0.16, rise: 26 },
      );
    });

    // ---- окно агента
    const drop = easeInOutCubic(seg(cO.p, 0.3, 0.4));
    const landed = seg(cO.p, 0.7, 0.12);
    const winAt = { x: WIN.x + WIN.w / 2, y: WIN.y + WIN.h / 2 };
    f.obj('window', { ...winAt, abs: true, text: 'ваш агент', label: 'Окно агента' }, (o) => {
      appear(
        ctx,
        seg(cO.t, 0.05, 0.5),
        () => {
          const body = windowFrame(ctx, WIN.x, WIN.y, WIN.w, WIN.h, {
            title: o.text,
            color: C.h1,
            icon: 'robot',
            glow: landed,
            t: gt,
          });
          // пока папки нет — пунктирная зона «бросьте сюда»
          if (landed < 1) {
            ctx.save();
            ctx.globalAlpha *= (1 - landed) * 0.7;
            ctx.strokeStyle = a(C.h1, 0.5);
            ctx.lineWidth = 2.5;
            ctx.setLineDash([16, 14]);
            ctx.lineDashOffset = -gt * 30;
            rrPath(ctx, body.x + 40, body.y + 40, body.w - 80, body.h - 80, 18);
            ctx.stroke();
            ctx.restore();
          }
        },
        { dx: -60 },
      );
    });

    // папка летит по дуге в окно и встаёт в шапку списка
    const folderP = seg(cO.p, 0.18, 0.12);
    const folderAt = { x: WIN.x + 164, y: WIN.y + 178 };
    f.obj('folder', { ...folderAt, abs: true, text: 'папка с содержимым', label: 'Папка' }, (o) => {
      if (folderP > 0) {
        const [fx, fy] = bez([1380, 560], [1100, 180], [WIN.x + 96, WIN.y + 160], drop);
        const size = 210 - 120 * drop;
        ctx.save();
        ctx.globalAlpha *= clamp01(folderP * 2);
        ctx.shadowColor = a(C.accent, 0.6);
        ctx.shadowBlur = 30 * (1 - drop);
        icon(ctx, 'folder', fx, fy, size, C.accent, gt);
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha *= easeOutQuart(landed);
      text(ctx, o.text, WIN.x + 164, WIN.y + 178, { size: 50, color: C.accent, tracking: 1 });
      ctx.restore();
    });

    // ---- файлы
    const files = [
      { name: 'run.bat', cue: cR, color: C.pos, ico: 'play' },
      { name: 'editor.bat', cue: cE, color: C.accent, ico: 'sliders' },
    ];
    files.forEach((file, i) => {
      const y = rowY(i);
      const rowAt = { x: ROW.x + ROW.w / 2, y: y + ROW.h / 2 };
      f.obj(`file:${i}`, { ...rowAt, abs: true, text: file.name, label: `Файл ${i + 1}` }, (o) => {
        const p = easeOutQuart(seg(cO.p, 0.78 + i * 0.08, 0.14));
        if (p <= 0) return;
        const act = seg(file.cue.t, 0, 0.3);
        ctx.save();
        ctx.globalAlpha *= p;
        ctx.translate((1 - p) * -30, 0);
        panel(ctx, ROW.x, y, ROW.w, ROW.h, {
          fill: a(file.color, 0.05 + 0.07 * act),
          stroke: a(file.color, 0.25 + 0.6 * act),
          lineWidth: 2 + act,
          radius: 12,
        });
        icon(ctx, 'doc', ROW.x + 56, y + ROW.h / 2, 58, a(file.color, 0.6 + 0.4 * act), gt);
        text(ctx, o.text, ROW.x + 112, y + ROW.h / 2 + 19, {
          size: 60,
          family: 'mono',
          color: act > 0.5 ? C.text : a(C.text, 0.8),
        });
        ctx.restore();
      });
    });
    // остальное содержимое — условными строками
    f.obj('rest', { x: ROW.x + ROW.w / 2, y: rowY(2) + 67, abs: true, label: 'Остальные файлы' }, () => {
      for (let i = 0; i < 2; i++) {
        const p = easeOutQuart(seg(cO.p, 0.9 + i * 0.04, 0.1));
        if (p <= 0) continue;
        ctx.fillStyle = a(C.text, 0.12 * p);
        rrPath(ctx, ROW.x + 28, rowY(2) + 24 + i * 62, (ROW.w - 56) * (0.7 - i * 0.22), 24, 12);
        ctx.fill();
      }
    });

    // ---- что запускает каждый файл
    files.forEach((file, i) => {
      const p = seg(file.cue.t, 0.1, 0.5);
      const ty = tileY(i);
      const arrowAt = { x: (ROW.x + ROW.w + TILE.x) / 2, y: (rowY(i) + ROW.h / 2 + ty + TILE.h / 2) / 2 };
      f.obj(`arrow:${i}`, { ...arrowAt, abs: true, label: `Стрелка ${i + 1}` }, () => {
        if (p <= 0) return;
        arrow(ctx, ROW.x + ROW.w + 16, rowY(i) + ROW.h / 2, TILE.x - 18, ty + TILE.h / 2, seg(file.cue.t, 0, 0.4), {
          color: file.color,
          width: 5,
          head: 22,
        });
      });
      const tileAt = { x: TILE.x + TILE.w / 2, y: ty + TILE.h / 2 };
      f.obj(`tile:${i}`, { ...tileAt, abs: true, text: file.cue.show, label: `Плитка ${i + 1}` }, (o) => {
        appear(
          ctx,
          p,
          () => {
            panel(ctx, TILE.x, ty, TILE.w, TILE.h, {
              fill: C.panel,
              stroke: a(file.color, 0.4),
              lineWidth: 2,
              radius: 16,
              glow: a(file.color, 0.12),
              glowBlur: 44,
            });
            const scr: Rect = { x: TILE.x + 20, y: ty + 20, w: 340, h: TILE.h - 40 };
            ctx.save();
            rrPath(ctx, scr.x, scr.y, scr.w, scr.h, 10);
            ctx.clip();
            ctx.fillStyle = SCREEN_BG;
            ctx.fillRect(scr.x, scr.y, scr.w, scr.h);
            if (i === 0) projectScreen(ctx, scr, gt);
            else editorScreen(ctx, scr, gt);
            ctx.restore();
            icon(ctx, file.ico, TILE.x + 420, ty + 78, 60, file.color, gt);
            text(ctx, o.text, TILE.x + 388, ty + 178, {
              size: 56,
              color: C.text,
              tracking: 0.6,
              maxWidth: TILE.w - 410,
              lineHeight: 1.08,
            });
          },
          { dx: 50 },
        );
      });
    });
  },
};
