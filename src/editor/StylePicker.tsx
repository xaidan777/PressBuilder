/**
 * Выбор пресета стиля: живой слайд-пример выбранного стиля и карточки всех четырёх
 * с миниатюрами. Пример рисует движок (`engine/sample.ts`) — ровно так будет выглядеть ролик.
 */

import { useEffect, useRef } from 'preact/hooks';
import { drawSample, SAMPLE_LOOP, SAMPLE_STILL, type SampleText } from '../engine/sample.ts';
import { PRESETS } from '../engine/styles.ts';
import { W } from '../engine/theme.ts';

interface Props {
  value: string;
  onChange(id: string): void;
  sample: SampleText;
}

export function StylePicker({ value, onChange, sample }: Props) {
  const cur = PRESETS.find((p) => p.id === value) ?? PRESETS[0];
  return (
    <div class="style-picker">
      <div class="style-preview">
        <StyleLive id={cur.id} sample={sample} />
        <div class="style-preview-cap">
          <b>{cur.name}</b>
          <span>{cur.note}</span>
        </div>
      </div>
      <div class="style-grid" role="radiogroup" aria-label="Стиль ролика">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={p.id === cur.id}
            aria-label={`${p.name} — ${p.note}`}
            class={`style-card ${p.id === cur.id ? 'is-on' : ''}`}
            onClick={() => onChange(p.id)}
          >
            <StyleThumb id={p.id} sample={sample} />
            <span class="style-card-name" style={{ fontFamily: p.fonts.display.stack }}>
              {p.name}
            </span>
            <span class="style-card-row">
              <span class="style-card-tag">{p.dark ? 'тёмный' : 'светлый'}</span>
              <span class="style-swatches" aria-hidden="true">
                {[p.colors.bg, p.colors.h1, p.colors.accent, p.colors.pos].map((c) => (
                  <i key={c} style={{ background: c }} />
                ))}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Большое превью: петля анимации примера. */
function StyleLive({ id, sample }: { id: string; sample: SampleText }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const props = useRef({ id, sample });
  props.current = { id, sample };

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d', { alpha: false });
    if (!cv || !ctx) return;
    let raf = 0;
    let shown = props.current.id;
    let t0 = performance.now();
    const loop = (now: number) => {
      // сменили стиль — анимация начинается заново
      if (props.current.id !== shown) {
        shown = props.current.id;
        t0 = now;
      }
      const t = ((now - t0) / 1000) % SAMPLE_LOOP;
      ctx.setTransform(cv.width / W, 0, 0, cv.width / W, 0, 0);
      drawSample(ctx, shown, t, props.current.sample);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} width={960} height={540} />;
}

/** Миниатюра: неподвижный кадр, когда всё уже появилось. */
function StyleThumb({ id, sample }: { id: string; sample: SampleText }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d', { alpha: false });
    if (!cv || !ctx) return;
    ctx.setTransform(cv.width / W, 0, 0, cv.width / W, 0, 0);
    drawSample(ctx, id, SAMPLE_STILL, sample);
  }, [id, sample.title, sample.line]);
  return <canvas ref={ref} width={384} height={216} />;
}
