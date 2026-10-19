/** Сцена 2. Внезапные 9 000 долларов за час: таблица Steam + вертикальный спайк. */

import { clamp01, easeOutExpo, easeOutQuart, fmtNum, pulse, seg, shake } from '../../engine/anim.ts';
import { lineChart } from '../../engine/charts.ts';
import { shockRing } from '../../engine/draw.ts';
import { icon } from '../../engine/icons.ts';
import { reveal, text } from '../../engine/text.ts';
import { a, C } from '../../engine/theme.ts';
import { statsTable, type TableRow } from '../../engine/ui.ts';
import type { CueTime, Frame, SceneDef } from '../../engine/types.ts';

/** Тот самый час. Те же цифры разбираются в сцене 29–30. */
const HOUR_REVENUE = 9500;
const HOUR_UNITS = 1200;
const PREV_REVENUE = 207;
const PREV_UNITS = 27;

/** Ровный ряд «обычных» часов и один взрывной. */
const HOURS = [
  120, 96, 141, 88, 74, 132, 109, 155, 98, 121, 87, 143, 116, 92, 138, 104, 129, 83, 147, 111, 95,
  126, 118, HOUR_REVENUE,
];

const spikeStart = (c: CueTime) => c.start + 0.12;

export const scene02: SceneDef = {
  id: 's02',

  energy(t, cue) {
    return pulse(t, spikeStart(cue('spike')), 1.4) * 0.9;
  },

  render(f: Frame) {
    const { ctx } = f;
    const cOpen = f.cue('open');
    const cSpike = f.cue('spike');
    const cHour = f.cue('hour');

    const sp = seg(f.t, spikeStart(cSpike), 0.85);
    const val = HOUR_REVENUE * easeOutExpo(sp);
    const units = HOUR_UNITS * easeOutExpo(sp);
    const pct = sp > 0.35 ? `+${fmtNum(((val - PREV_REVENUE) / PREV_REVENUE) * 100)}%` : '—';
    const pctUnits =
      sp > 0.35 ? `+${fmtNum(((units - PREV_UNITS) / PREV_UNITS) * 100)}%` : '—';

    const [shx, shy] = shake(f.t, spikeStart(cSpike), 0.75, 13);
    ctx.save();
    ctx.translate(shx, shy);

    const hourCell = (v: string) => ({ text: sp > 0.02 ? v : '—', color: sp > 0.5 ? C.accent : C.text });
    const rows: TableRow[] = [
      {
        cells: [
          { text: 'Выручка всего', link: true },
          '$207',
          hourCell(`$${fmtNum(val)}`),
          { text: pct, color: C.pos },
          '$165',
        ],
        highlight: seg(f.t, spikeStart(cSpike), 0.5) * (1 - seg(f.t, cHour.end - 0.4, 0.6)),
      },
      {
        cells: [
          { text: 'Выручка Steam', link: true },
          '$207',
          hourCell(`$${fmtNum(val)}`),
          { text: pct, color: C.pos },
          '$165',
        ],
        indent: 1,
      },
      {
        cells: [{ text: 'Внутриигровые продажи', link: true }, '$0', '$0', '—', '$0'],
        indent: 1,
      },
      {
        cells: [
          { text: 'Продано копий', link: true },
          '27',
          hourCell(fmtNum(units)),
          { text: pctUnits, color: C.pos },
          '21',
        ],
      },
      {
        cells: [
          { text: 'Копий в Steam', link: true },
          '27',
          hourCell(fmtNum(units)),
          { text: pctUnits, color: C.pos },
          '21',
        ],
        indent: 1,
      },
    ];

    f.obj('table', { x: 960, y: 395, abs: true, label: 'Таблица Steam' }, () => {
      statsTable(ctx, {
        x: 150,
        y: 140,
        w: 1620,
        fontSize: 46,
        p: seg(cOpen.t, 0.05, 0.9),
        title: 'HEXSTORM',
        titleAccent: 'WORLD',
        cols: [
          { title: '', flex: 2.4, align: 'left' },
          { title: 'Вчера', flex: 1.05 },
          { title: 'Последний\nчас', flex: 1.15 },
          { title: 'Изменение', flex: 1.15 },
          { title: 'Позавчера', flex: 1.1, muted: true },
        ],
        rows,
      });
    });

    // график: сначала рисуется ровная полка, последний (взрывной) час — на реплике
    const flat = seg(cOpen.t, 0.5, 1.0);
    const chartP = flat < 1 ? flat * 0.958 : 0.958 + sp * 0.042;
    f.obj('chart', { x: 580, y: 845, abs: true, label: 'График по часам' }, () => {
      lineChart(ctx, {
        x: 150,
        y: 730,
        w: 860,
        h: 230,
        data: HOURS,
        p: chartP,
        color: sp > 0.4 ? C.accent : C.h1,
        max: HOUR_REVENUE * 1.1,
        grid: 4,
        lineWidth: 4,
        head: true,
      });
    });
    f.obj(
      'chart-label',
      { x: 150, y: 1030, abs: true, text: 'выручка по часам, последние сутки', label: 'Подпись графика' },
      (o) => {
        text(ctx, o.text, 150, 1030, {
          size: 46,
          color: a(C.text, 0.42),
          tracking: 1.2,
        });
      },
    );

    // крупная цифра справа
    {
      const e = easeOutQuart(clamp01(sp * 1.4));
      ctx.save();
      ctx.globalAlpha *= e;
      const cx = 1420;
      const cy = 830;
      f.obj('rings', { x: cx, y: cy, abs: true, label: 'Ударная волна' }, () => {
        if (sp <= 0) return;
        shockRing(ctx, cx, cy, seg(f.t, spikeStart(cSpike), 1.1), 520, C.accent, 4);
        shockRing(ctx, cx, cy, seg(f.t, spikeStart(cSpike) + 0.18, 1.1), 460, C.accent, 3);
      });

      f.obj(
        'sum-label',
        { x: cx, y: 730, abs: true, text: 'за последний час', label: 'Подпись суммы' },
        (o) => {
          if (sp <= 0) return;
          text(ctx, o.text, cx, 730, {
            size: 46,
            color: a(C.text, 0.55),
            align: 'center',
            tracking: 2,
          });
        },
      );
      f.obj('sum', { x: cx, y: 890, abs: true, label: 'Сумма за час' }, () => {
        if (sp <= 0) return;
        text(ctx, `$${fmtNum(val)}`, cx, 890, {
          size: 168,
          color: C.accent,
          align: 'center',
          tracking: -1,
          glowColor: a(C.accent, 0.55),
          glowBlur: 46,
        });
      });
      ctx.restore();
    }

    // «всего один час»
    const hp = seg(cHour.t, 0, 0.7);
    f.obj('hour', { x: 1370, y: 1010, abs: true, text: '60 минут', label: 'Часы с подписью' }, (o) => {
      if (hp <= 0) return;
      ctx.save();
      ctx.globalAlpha *= easeOutQuart(hp);
      icon(ctx, 'clock', 1240, 1010, 54, C.h1, f.gt);
      reveal(
        ctx,
        o.text,
        1300,
        1028,
        { size: 62, color: C.h1, tracking: 1.2 },
        hp,
        { stagger: 0.2, rise: 18 },
      );
      ctx.restore();
    });

    ctx.restore();
  },
};
