/**
 * Сцена 4. Не совсем движок: соты готовых решений слетаются в связку,
 * каждая получает отметку «проверено», и связка быстро выдаёт 3D-прототипы.
 */

import { clamp01, easeOutBack, easeOutQuart, seg } from '../../engine/anim.ts';
import { arrow, hexPath, softLight } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import type { Frame, SceneDef } from '../../engine/types.ts';
import { drawSolid, MESH, type Mesh } from '../../engine/wire3d.ts';
import { checkBadge } from './common.ts';

const HUB = { x: 500, y: 710, r: 100 };
/** Центральная сота и шесть вокруг: шаг между центрами — √3·r с небольшим зазором. */
const STEP = HUB.r * Math.sqrt(3) * 1.06;
const CELLS = ['cube', 'code', 'eye', 'sliders', 'wrench', 'shield', 'chart'].map((ic, i) => {
  if (i === 0) return { icon: ic, x: HUB.x, y: HUB.y, ang: 0 };
  const ang = (Math.PI / 3) * (i - 1) - Math.PI / 2 + Math.PI / 6;
  return { icon: ic, x: HUB.x + Math.cos(ang) * STEP, y: HUB.y + Math.sin(ang) * STEP, ang };
});

const PROTOS: Array<{ mesh: Mesh; color: string }> = [
  { mesh: MESH.cube, color: C.h1 },
  { mesh: MESH.pyramid, color: C.accent },
  { mesh: MESH.icosa, color: C.pos },
  { mesh: MESH.hexPrism, color: C.accent },
  { mesh: MESH.octa, color: C.h1 },
  { mesh: MESH.cylinder, color: C.pos },
];
const GRID = { x0: 1110, y0: 520, dx: 290, dy: 250 };

export const scene04: SceneDef = {
  id: 's04',

  energy: (_t, cue) => 0.5 * seg(cue('fast').p, 0.4, 0.2),

  render(f: Frame) {
    const { ctx, gt } = f;
    const cN = f.cue('not');
    const cS = f.cue('set');
    const cF = f.cue('fast');

    f.obj('title', { x: 150, y: 212, abs: true, text: cN.show, label: 'Заголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        212,
        { size: 108, color: C.h1, tracking: 0.6 },
        seg(cN.t, 0, 0.6),
        { stagger: 0.24, rise: 28 },
      );
    });
    f.obj('subtitle', { x: 150, y: 300, abs: true, text: cS.show, label: 'Подзаголовок' }, (o) => {
      reveal(
        ctx,
        o.text,
        150,
        300,
        { size: 60, color: C.text, tracking: 0.8, maxWidth: 820, lineHeight: 1.1 },
        seg(cS.t, 0, 0.8),
        { stagger: 0.12, rise: 18 },
      );
    });

    // соты вместе со связями — одна фигура: по отдельности они теряют смысл
    f.obj('hive', { x: HUB.x, y: HUB.y, abs: true, label: 'Соты' }, () => {
      // «связка»: линии между сотами загораются на третьей реплике
      const link = seg(cF.p, 0, 0.16);
      if (link > 0) {
        ctx.save();
        ctx.globalAlpha *= link;
        softLight(ctx, HUB.x, HUB.y, 430, C.h1, 0.13);
        ctx.strokeStyle = a(C.h1, 0.8);
        ctx.lineWidth = 5;
        ctx.shadowColor = a(C.h1, 0.8);
        ctx.shadowBlur = 18;
        ctx.lineCap = 'round';
        CELLS.slice(1).forEach((c, i) => {
          const next = CELLS[1 + ((i + 1) % 6)];
          const k = easeOutQuart(clamp01(link * 2 - i * 0.12));
          ctx.beginPath();
          ctx.moveTo(HUB.x, HUB.y);
          ctx.lineTo(HUB.x + (c.x - HUB.x) * k, HUB.y + (c.y - HUB.y) * k);
          ctx.moveTo(c.x, c.y);
          ctx.lineTo(c.x + (next.x - c.x) * k, c.y + (next.y - c.y) * k);
          ctx.stroke();
        });
        ctx.restore();
      }

      // соты слетаются по очереди
      CELLS.forEach((c, i) => {
        const p = seg(cS.p, 0.04 + i * 0.09, 0.3);
        if (p <= 0) return;
        const e = easeOutBack(p, 1.4);
        const away = (1 - e) * 560;
        const dirX = i === 0 ? 0 : Math.cos(c.ang);
        const dirY = i === 0 ? 1 : Math.sin(c.ang);
        const x = c.x + dirX * away;
        const y = c.y + dirY * away;
        const pulse = link > 0 ? 0.5 + 0.5 * Math.sin(gt * 5 - i * 0.9) : 0;
        ctx.save();
        ctx.globalAlpha *= Math.min(1, p * 3);
        hexPath(ctx, x, y, HUB.r, Math.PI / 6);
        ctx.fillStyle = C.panel;
        ctx.fill();
        ctx.strokeStyle = a(C.h1, 0.5 + 0.4 * pulse);
        ctx.lineWidth = 2.6;
        ctx.stroke();
        icon(ctx, c.icon, x, y, HUB.r * 0.86, a(C.h1, 0.9), gt);
        ctx.restore();
        // «протестированных»
        checkBadge(ctx, x + HUB.r * 0.56, y - HUB.r * 0.6, 24, seg(cS.p, 0.5 + i * 0.065, 0.12));
      });
    });

    // быстрые результаты: стрелка от связки и прототипы, выскакивающие один за другим
    const go = seg(cF.p, 0.36, 0.12);
    f.obj('arrow', { x: 880, y: 620, abs: true, label: 'Стрелка' }, () => {
      arrow(ctx, 800, 620, 960, 620, go, { color: C.accent, width: 6, head: 26 });
      if (go > 0) {
        ctx.save();
        ctx.globalAlpha *= go;
        icon(ctx, 'bolt', 880, 560, 64, C.accent, gt);
        ctx.restore();
      }
    });

    f.obj('fast', { x: 1010, y: 330, abs: true, text: cF.show, label: 'Текст справа' }, (o) => {
      reveal(
        ctx,
        o.text,
        1010,
        330,
        {
          size: 84,
          color: C.accent,
          tracking: 0.8,
          glowColor: a(C.accent, 0.3),
          glowBlur: 30,
        },
        seg(cF.p, 0.38, 0.2),
        { stagger: 0.2, rise: 24 },
      );
    });

    PROTOS.forEach((pr, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const cx = GRID.x0 + col * GRID.dx;
      const cy = GRID.y0 + row * GRID.dy;
      f.obj(`proto:${i}`, { x: cx, y: cy, abs: true, label: `Прототип ${i + 1}` }, () => {
        const p = seg(cF.p, 0.46 + i * 0.055, 0.1);
        if (p <= 0) return;
        const s = easeOutBack(p, 2.6);
        ctx.save();
        ctx.globalAlpha *= Math.min(1, p * 3);
        // росчерк скорости: прототип «влетает» слева
        const streak = 1 - clamp01(p * 1.6);
        if (streak > 0) {
          ctx.strokeStyle = a(pr.color, 0.6 * streak);
          ctx.lineWidth = 5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(cx - 60 - 240 * streak, cy);
          ctx.lineTo(cx - 60, cy);
          ctx.stroke();
        }
        drawSolid(
          ctx,
          pr.mesh,
          { cx, cy, size: 150 * s, pitch: 0.45, yaw: gt * 0.9 + i, dist: 4.5 },
          { rx: i % 2 ? gt * 0.3 : 0 },
          { color: pr.color },
        );
        ctx.restore();
      });
    });

    // оговорка автора — сноской
    f.obj('note', { x: 1010, y: 975, abs: true, text: '* по моим сугубо личным тестам', label: 'Сноска' }, (o) => {
      ctx.save();
      ctx.globalAlpha *= seg(cF.p, 0.14, 0.12) * 0.7;
      text(ctx, o.text, 1010, 975, {
        size: 46,
        color: C.text,
        tracking: 1,
      });
      ctx.restore();
    });
  },
};
