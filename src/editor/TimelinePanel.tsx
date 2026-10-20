/**
 * Таймлайн: линейка, дорожка слайдов, дорожка реплик, дорожка звука и плейхед.
 * Границу между соседними репликами можно тянуть — время перекатывается
 * от одной к другой, общий хронометраж не меняется. Озвучка добавляется
 * кнопкой «Добавить звук» или перетаскиванием файла на таймлайн; её волну
 * можно двигать по времени.
 */

import { effect } from '@preact/signals';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { naturalCue, type SchedSlide } from '../engine/schedule.ts';
import { screenText } from '../engine/placeholder.ts';
import { attachAudio, fitToAudio, removeAudio, rollCues, setAudioOffset } from './actions.ts';
import { drawWave } from './audio.ts';
import {
  audioInfo,
  beginGesture,
  curSlide,
  deck,
  endGesture,
  muted,
  playing,
  player,
  schedule,
  seek,
  sel,
  time,
  togglePlay,
} from './store.ts';
import { Icon, IconBtn, MenuBtn } from './ui.tsx';
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
  const [scrollLeft, setScrollLeft] = useState(0);
  const [dropping, setDropping] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const wave = useRef<HTMLCanvasElement>(null);

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

  // волна озвучки: рисуем только видимый кусок — при сильном зуме дорожка длиннее любого холста
  const audio = deck.value?.audio;
  const info = audioInfo.value;
  const offset = audio?.offset ?? 0;
  const clipX = PAD + offset * pps;
  const clipW = (info?.duration ?? 0) * pps;
  const visX0 = Math.max(clipX, scrollLeft);
  const visX1 = Math.min(clipX + clipW, scrollLeft + viewW);
  useLayoutEffect(() => {
    const c = wave.current;
    if (!c || !info || visX1 <= visX0) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.ceil((visX1 - visX0) * dpr);
    c.height = Math.ceil(30 * dpr);
    drawWave(c, info, (visX0 - clipX) / pps, pps, '#51d3ff');
  }, [info, pps, visX0, visX1, clipX]);

  if (!sch) return <footer class="timeline" />;

  const pickAudio = () => fileInput.current?.click();
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDropping(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) void attachAudio(file);
  };

  /** Тянуть дорожку — сдвиг озвучки; просто клик — перемотка. */
  const startAudioDrag = (e: PointerEvent) => {
    if (e.button !== 0 || !audio) return;
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    capture(el, e);
    const x0 = e.clientX;
    const off0 = offset;
    let moved = false;
    const move = (m: PointerEvent) => {
      if (!moved && Math.abs(m.clientX - x0) < 3) return;
      if (!moved) beginGesture();
      moved = true;
      const v = off0 + (m.clientX - x0) / ppsRef.current;
      setAudioOffset(v, { merge: true });
      setTip({ x: PAD + Math.max(0, v) * ppsRef.current, text: `звук с ${v < 0 ? '−' : ''}${clock(Math.abs(v), 2)}` });
    };
    const up = (u: PointerEvent) => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      setTip(null);
      if (moved) endGesture();
      else seek(timeAt(u.clientX));
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

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
        {audio ? (
          <>
            <span class="tl-audio-file" title={`Озвучка: src/decks/${deck.value?.id}/${audio.file}`}>
              <Icon name="mic" size={14} /> {audio.file}
              {info ? ` · ${clock(info.duration, 1)}` : ' · читаю…'}
            </span>
            <IconBtn
              icon={muted.value ? 'mute' : 'sound'}
              label={muted.value ? 'Включить звук в редакторе' : 'Выключить звук в редакторе (в MP4 он останется)'}
              active={muted.value}
              onClick={() => (muted.value = !muted.value)}
            />
            <MenuBtn
              label="Озвучка"
              items={[
                { label: 'Заменить файл…', icon: 'mic', onSelect: pickAudio },
                { label: 'Хронометраж ролика — по длине звука', icon: 'fit', disabled: !info, onSelect: fitToAudio },
                { label: 'Звук — с начала ролика', icon: 'reset', disabled: offset === 0, onSelect: () => setAudioOffset(0) },
                null,
                { label: 'Убрать звук из ролика', icon: 'trash', danger: true, onSelect: removeAudio },
              ]}
            />
          </>
        ) : (
          <button type="button" class="btn tl-audio-add" title="Озвучка: mp3, wav, m4a… — или перетащи файл на таймлайн" onClick={pickAudio}>
            <Icon name="mic" size={14} /> Добавить звук
          </button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus,.flac,.webm"
          hidden
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (file) void attachAudio(file);
          }}
        />
        <span class="tl-spacer" />
        <span class="tl-hint">Ctrl + колесо — масштаб · границы реплик и звук можно тянуть</span>
        <IconBtn icon="fit" label="Вписать весь ролик" active={zoom === null} onClick={() => setZoom(null)} />
      </div>

      <div
        class={`tl-scroll ${dropping ? 'is-dropping' : ''}`}
        ref={scroller}
        onWheel={onWheel}
        onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
        onDragOver={(e) => {
          if (!e.dataTransfer?.types.includes('Files')) return;
          e.preventDefault();
          setDropping(true);
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={onDrop}
      >
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

          <div class="tl-track is-audio">
            {audio ? (
              <div
                class="tl-audio"
                style={{ left: `${clipX}px`, width: `${Math.max(clipW, 40)}px` }}
                title="Озвучка: тянуть — сдвинуть по времени, клик — перемотать"
                onPointerDown={startAudioDrag}
              >
                {info && visX1 > visX0 && <canvas ref={wave} style={{ left: `${visX0 - clipX}px`, width: `${visX1 - visX0}px` }} />}
                {!info && <span>{audio.file} · читаю…</span>}
              </div>
            ) : (
              <button type="button" class="tl-audio-empty" style={{ left: `${scrollLeft + PAD}px` }} onClick={pickAudio}>
                <Icon name="plus" size={13} /> Добавить звук — или перетащи файл сюда
              </button>
            )}
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
