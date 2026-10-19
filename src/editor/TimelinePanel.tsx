/**
 * Таймлайн: линейка, дорожка слайдов, дорожка реплик и плейхед.
 * Границу между соседними репликами можно тянуть — время перекатывается
 * от одной к другой, общий хронометраж не меняется.
 */

import { effect } from '@preact/signals';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { naturalCue, type SchedSlide } from '../engine/schedule.ts';
import { screenText } from '../engine/placeholder.ts';
import { rollCues } from './actions.ts';
import { beginGesture, curSlide, deck, endGesture, playing, player, schedule, seek, sel, time, togglePlay } from './store.ts';
import { IconBtn } from './ui.tsx';
import { capture, clamp, clock } from './util.ts';

const PAD = 16;
const MIN_NATURAL = 0.3;
const STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];

interface Edge {
  /** Время границы, сек. */
  at: number;
  a: { slide: string; cue: string };
  b: { slide: string; cue: string };
  /** Граница между слайдами (а не внутри слайда). */
  between: boolean;
}

/** Все перетаскиваемые границы: между соседними репликами, в том числе через стык слайдов. */
function edgesOf(slides: SchedSlide[]): Edge[] {
  const flat = slides.flatMap((sc) => sc.cues.map((c) => ({ sc, c })));
  const out: Edge[] = [];
  for (let i = 0; i < flat.length - 1; i++) {
    const [l, r] = [flat[i], flat[i + 1]];
    const between = l.sc !== r.sc;
    out.push({
      at: between ? r.sc.start : l.sc.start + l.c.start + l.c.dur,
      a: { slide: l.sc.slide.id, cue: l.c.id },
      b: { slide: r.sc.slide.id, cue: r.c.id },
      between,
    });
  }
  return out;
}

export function TimelinePanel() {
  const sch = schedule.value;
  const scroller = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const [viewW, setViewW] = useState(800);
  /** Пикселей на секунду; null — вписать весь ролик в ширину. */
  const [zoom, setZoom] = useState<number | null>(null);
  const [tip, setTip] = useState<{ x: number; text: string } | null>(null);

  const duration = sch?.duration ?? 0;
  const fit = duration > 0 ? (viewW - PAD * 2) / duration : 1;
  const pps = Math.max(fit, zoom ?? fit);
  const ppsRef = useRef(pps);
  ppsRef.current = pps;

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // плейхед двигаем напрямую, без перерисовки всего таймлайна на каждом кадре
  useEffect(
    () =>
      effect(() => {
        const x = PAD + time.value * ppsRef.current;
        if (head.current) head.current.style.transform = `translateX(${x}px)`;
        const el = scroller.current;
        if (el && playing.peek() && (x < el.scrollLeft + 40 || x > el.scrollLeft + el.clientWidth - 40)) {
          el.scrollLeft = x - 80;
        }
      }),
    [],
  );
  useLayoutEffect(() => {
    if (head.current) head.current.style.transform = `translateX(${PAD + time.peek() * pps}px)`;
  }, [pps]);

  if (!sch) return <footer class="timeline" />;

  const timeAt = (clientX: number) => {
    const el = scroller.current!;
    return (clientX - el.getBoundingClientRect().left + el.scrollLeft - PAD) / ppsRef.current;
  };

  const scrub = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const el = e.currentTarget as HTMLElement;
    capture(el, e);
    seek(timeAt(e.clientX));
    const move = (m: PointerEvent) => seek(timeAt(m.clientX));
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  const onWheel = (e: WheelEvent) => {
    const el = scroller.current!;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      // масштаб вокруг курсора
      const t = timeAt(e.clientX);
      const next = clamp(pps * (e.deltaY < 0 ? 1.25 : 0.8), fit, 600);
      setZoom(next <= fit * 1.001 ? null : next);
      requestAnimationFrame(() => {
        el.scrollLeft = PAD + t * next - (e.clientX - el.getBoundingClientRect().left);
      });
    } else if (!e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }
  };

  const startRoll = (e: PointerEvent, edge: Edge) => {
    e.stopPropagation();
    const d = deck.peek();
    const ca = d?.slides.find((s) => s.id === edge.a.slide)?.cues.find((c) => c.id === edge.a.cue);
    const cb = d?.slides.find((s) => s.id === edge.b.slide)?.cues.find((c) => c.id === edge.b.cue);
    if (!ca || !cb) return;
    const [nA, nB] = [naturalCue(ca), naturalCue(cb)];
    const k = sch.scale;
    const x0 = e.clientX;
    const el = e.currentTarget as HTMLElement;
    capture(el, e);
    beginGesture();
    const move = (m: PointerEvent) => {
      const dn = clamp((m.clientX - x0) / ppsRef.current / k, -(nA - MIN_NATURAL), nB - MIN_NATURAL);
      rollCues({ ...edge.a, dur: nA + dn }, { ...edge.b, dur: nB - dn });
      setTip({ x: PAD + (edge.at + dn * k) * ppsRef.current, text: `${((nA + dn) * k).toFixed(1)} с ← → ${((nB - dn) * k).toFixed(1)} с` });
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      setTip(null);
      endGesture();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  const step = STEPS.find((s) => s * pps >= 64) ?? 600;
  const ticks: number[] = [];
  for (let t = 0; t <= duration + 1e-6; t += step) ticks.push(t);

  const s = sel.value;
  const cur = curSlide.value?.slide.id;
  const gotoSlide = (dir: -1 | 1) => {
    const i = curSlide.peek()?.index ?? 0;
    const here = sch.slides[i];
    // «назад» сначала возвращает к началу текущего слайда
    const target = dir < 0 && time.peek() - here.start > 0.6 ? here : sch.slides[clamp(i + dir, 0, sch.slides.length - 1)];
    seek(target.start + 0.001);
  };

  return (
    <footer class="timeline">
      <div class="tl-bar">
        <IconBtn icon="prev" label="К предыдущему слайду (PageUp)" onClick={() => gotoSlide(-1)} />
        <IconBtn
          icon={playing.value ? 'pause' : 'play'}
          label="Пуск / пауза (пробел)"
          class="is-primary"
          size={18}
          onClick={togglePlay}
        />
        <IconBtn icon="next" label="К следующему слайду (PageDown)" onClick={() => gotoSlide(1)} />
        <TimeReadout duration={duration} />
        <select
          class="rate"
          title="Скорость воспроизведения"
          onChange={(e) => player && (player.rate = Number(e.currentTarget.value))}
        >
          {[0.5, 1, 1.5, 2].map((r) => (
            <option key={r} value={r} selected={r === 1}>
              {r}×
            </option>
          ))}
        </select>
        <span class="tl-spacer" />
        <span class="tl-hint">Ctrl + колесо — масштаб · границы реплик можно тянуть</span>
        <IconBtn icon="fit" label="Вписать весь ролик" active={zoom === null} onClick={() => setZoom(null)} />
      </div>

      <div class="tl-scroll" ref={scroller} onWheel={onWheel}>
        <div class="tl-inner" style={{ width: `${duration * pps + PAD * 2}px` }}>
          <div class="tl-ruler" onPointerDown={scrub}>
            {ticks.map((t) => (
              <span key={t} class="tick" style={{ left: `${PAD + t * pps}px` }}>
                {clock(t, step < 1 ? 1 : 0)}
              </span>
            ))}
          </div>

          <div class="tl-track is-slides">
            {sch.slides.map((sc) => (
              <div
                key={sc.slide.id}
                class={`tl-slide ${sc.index % 2 ? 'is-odd' : ''} ${cur === sc.slide.id ? 'is-current' : ''} ${
                  s.kind !== 'none' && s.slide === sc.slide.id ? 'is-selected' : ''
                }`}
                style={{ left: `${PAD + sc.start * pps}px`, width: `${sc.dur * pps}px` }}
                title={`${sc.index + 1}. ${sc.slide.label} · ${sc.dur.toFixed(1)} с`}
                onPointerDown={(e) => {
                  sel.value = { kind: 'slide', slide: sc.slide.id };
                  scrub(e);
                }}
              >
                <b>{sc.index + 1}</b>
                <span>{sc.slide.label}</span>
              </div>
            ))}
          </div>

          <div class="tl-track is-cues">
            {sch.slides.map((sc) =>
              sc.cues.map((c) => (
                <div
                  key={`${sc.slide.id}/${c.id}`}
                  class={`tl-cue ${sc.index % 2 ? 'is-odd' : ''} ${c.manual ? 'is-manual' : ''} ${
                    s.kind === 'cue' && s.slide === sc.slide.id && s.cue === c.id ? 'is-selected' : ''
                  }`}
                  style={{ left: `${PAD + (sc.start + c.start) * pps}px`, width: `${c.dur * pps}px` }}
                  title={`${c.say}\n${c.dur.toFixed(1)} с${c.manual ? ' · вручную' : ''}`}
                  onPointerDown={(e) => {
                    sel.value = { kind: 'cue', slide: sc.slide.id, cue: c.id };
                    scrub(e);
                  }}
                >
                  <span>{screenText(c.show)}</span>
                </div>
              )),
            )}
            {edgesOf(sch.slides).map((edge) => (
              <i
                key={`${edge.a.cue}|${edge.b.cue}`}
                class={`tl-edge ${edge.between ? 'is-between' : ''}`}
                style={{ left: `${PAD + edge.at * pps}px` }}
                title="Тянуть: перекатить время между репликами"
                onPointerDown={(e) => startRoll(e, edge)}
              />
            ))}
          </div>

          {tip && (
            <div class="tl-tip" style={{ left: `${tip.x}px` }}>
              {tip.text}
            </div>
          )}
          <div class="tl-head" ref={head} onPointerDown={scrub}>
            <i />
          </div>
        </div>
      </div>
    </footer>
  );
}

/** Отдельный компонент: перерисовывается каждый кадр, остальной таймлайн — нет. */
function TimeReadout({ duration }: { duration: number }) {
  return (
    <span class="tl-time">
      <b>{clock(time.value, 1)}</b>
      <i>/</i>
      {clock(duration, Number.isInteger(duration) ? 0 : 1)}
    </span>
  );
}
