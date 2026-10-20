/** Вывод ролика: разрешение, частота кадров, хронометраж, битрейт → out/<id>.mp4. */

import { useEffect, useRef, useState } from 'preact/hooks';
import { exportVideo, type ExportResult } from '../engine/export.ts';
import { api, type ServerConfig } from './api.ts';
import { deck, exporting, flushSave, player, requestProbe, schedule, update } from './store.ts';
import { ClockField, Dialog, Icon, NumField } from './ui.tsx';
import { clock, fmtSize } from './util.ts';

const RESOLUTIONS = [
  { h: 720, label: '1280 × 720', note: 'HD' },
  { h: 1080, label: '1920 × 1080', note: 'Full HD' },
  { h: 1440, label: '2560 × 1440', note: '2K' },
  { h: 2160, label: '3840 × 2160', note: '4K' },
];
const FPS = [24, 25, 30, 50, 60];

/** Битрейт с запасом под монтаж: графика с тонкими линиями не любит экономии. */
const autoBitrate = (h: number, fps: number) =>
  Math.round(({ 720: 12, 1080: 24, 1440: 40, 2160: 70 }[h] ?? 24) * (fps <= 30 ? 0.7 : 1));

type Phase =
  | { kind: 'idle' }
  | { kind: 'run'; p: number; frame: number; total: number; eta: number }
  | { kind: 'mux' }
  | { kind: 'done'; result: ExportResult; took: number }
  | { kind: 'error'; message: string };

export function ExportDialog({ onClose, autoStart, slides }: { onClose(): void; autoStart?: boolean; slides?: string[] }) {
  const d = deck.value;
  const sch = schedule.value;
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [cfg, setCfg] = useState<ServerConfig | null>(null);
  const [ffmpeg, setFfmpeg] = useState('');
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    void api.getConfig().then((c) => {
      setCfg(c);
      setFfmpeg(c.ffmpeg);
      if (autoStart && c.ffmpegOk) void run();
    });
  }, []);

  if (!d || !sch) return null;
  const { height, fps, bitrate } = d.format;
  const fixed = d.target !== null;
  const frames = Math.ceil(sch.duration * fps);
  const busy = phase.kind === 'run' || phase.kind === 'mux';

  const setFormat = (patch: Partial<typeof d.format>) =>
    update((x) => {
      const prevAuto = autoBitrate(x.format.height, x.format.fps);
      Object.assign(x.format, patch);
      // битрейт следует за форматом, пока его не трогали руками
      if (patch.bitrate === undefined && x.format.bitrate === prevAuto) {
        x.format.bitrate = autoBitrate(x.format.height, x.format.fps);
      }
    }, { key: 'format' });

  async function run(): Promise<void> {
    const p = player;
    const cur = deck.peek();
    if (!p || !cur) return;
    await flushSave();
    const f = cur.format;
    const back = p.time;
    const started = performance.now();
    abort.current = new AbortController();
    exporting.value = true;
    p.pause();
    p.setQuality(f.height / 1080);
    setPhase({ kind: 'run', p: 0, frame: 0, total: 0, eta: 0 });
    // кусок ролика по слайдам (?export=1&slides=s18,s19) — в отдельный файл <id>_s18-s19.mp4
    const sc = schedule.peek();
    const part = slides?.length && sc ? sc.slides.filter((s) => slides.includes(s.slide.id)) : [];
    const range = part.length
      ? { from: part[0].start, to: part[part.length - 1].start + part[part.length - 1].dur, name: `${cur.id}_${part[0].slide.id}-${part[part.length - 1].slide.id}` }
      : null;
    try {
      const result = await exportVideo(p, {
        name: range?.name ?? cur.id,
        from: range?.from,
        to: range?.to,
        fps: f.fps,
        bitrate: f.bitrate * 1_000_000,
        audio: cur.audio
          ? { path: `${cur.id}/${cur.audio.file}`, offset: cur.audio.offset ?? 0, volume: cur.audio.volume ?? 1 }
          : undefined,
        signal: abort.current.signal,
        onProgress: (k, frame, total) => {
          if (k >= 1) return setPhase({ kind: 'mux' });
          const spent = (performance.now() - started) / 1000;
          setPhase({ kind: 'run', p: k, frame, total, eta: k > 0.02 ? (spent / k) * (1 - k) : 0 });
        },
      });
      setPhase({ kind: 'done', result, took: (performance.now() - started) / 1000 });
    } catch (e) {
      const aborted = e instanceof DOMException && e.name === 'AbortError';
      setPhase(aborted ? { kind: 'idle' } : { kind: 'error', message: e instanceof Error ? e.message : String(e) });
    } finally {
      p.setQuality(1);
      p.seek(back);
      p.start();
      exporting.value = false;
      requestProbe();
    }
  }

  const saveFfmpeg = async () => {
    const c = await api.setConfig({ ffmpeg });
    setCfg(c);
  };

  return (
    <Dialog
      title="Вывод ролика"
      onClose={onClose}
      locked={busy}
      footer={
        busy ? (
          <button type="button" class="btn" onClick={() => abort.current?.abort()}>
            Остановить
          </button>
        ) : (
          <>
            <span class="muted is-grow">
              {frames.toLocaleString('ru-RU')} кадров{d.audio ? ` + звук ${d.audio.file}` : ''} → out/{d.id}.mp4
            </span>
            <button type="button" class="btn" onClick={onClose}>
              Закрыть
            </button>
            <button type="button" class="btn is-primary" disabled={!cfg?.ffmpegOk} onClick={() => void run()}>
              <Icon name="film" size={15} /> {phase.kind === 'done' ? 'Отрендерить снова' : 'Рендер'}
            </button>
          </>
        )
      }
    >
      <fieldset class="export-form" disabled={busy}>
        <div class="field">
          <span>Разрешение</span>
          <div class="cards">
            {RESOLUTIONS.map((r) => (
              <button key={r.h} type="button" class={`card ${height === r.h ? 'is-on' : ''}`} onClick={() => setFormat({ height: r.h })}>
                <b>{r.note}</b>
                <span>{r.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div class="field">
          <span>Частота кадров</span>
          <div class="seg">
            {FPS.map((v) => (
              <button key={v} type="button" class={fps === v ? 'is-on' : ''} onClick={() => setFormat({ fps: v })}>
                {v}
              </button>
            ))}
            <span class="seg-note">кадров/с</span>
          </div>
        </div>

        <div class="field">
          <span>Хронометраж</span>
          <div class="seg">
            <button type="button" class={fixed ? '' : 'is-on'} onClick={() => update((x) => void (x.target = null))}>
              из текста · {clock(sch.natural)}
            </button>
            <button
              type="button"
              class={fixed ? 'is-on' : ''}
              onClick={() => !fixed && update((x) => void (x.target = Math.round(sch.natural)))}
            >
              задать
            </button>
            {fixed && <ClockField value={d.target ?? 0} onChange={(v) => update((x) => void (x.target = v), { key: 'target' })} />}
          </div>
          {fixed && (
            <p class="muted">
              Расписание {sch.scale < 1 ? 'сжато' : 'растянуто'} ×{sch.scale.toFixed(2)} — темп речи ≈ {(14.4 / sch.scale).toFixed(1)} зн/с
              {sch.scale < 0.8 ? ' (быстровато для озвучки)' : ''}.
            </p>
          )}
        </div>

        <div class="field" style={{ width: '180px' }}>
          <NumField
            label="Битрейт"
            value={bitrate}
            min={2}
            max={200}
            suffix="Мбит/с"
            onChange={(v) => setFormat({ bitrate: v ?? autoBitrate(height, fps) })}
          />
        </div>
      </fieldset>

      {cfg && !cfg.ffmpegOk && (
        <div class="notice is-warn is-block">
          <Icon name="warn" size={14} />
          <div>
            Не найден ffmpeg — он собирает MP4. Укажи путь к ffmpeg.exe:
            <div class="form-row">
              <input type="text" class="is-grow" value={ffmpeg} spellcheck={false} onInput={(e) => setFfmpeg(e.currentTarget.value)} />
              <button type="button" class="btn" onClick={() => void saveFfmpeg()}>
                Проверить
              </button>
            </div>
          </div>
        </div>
      )}

      {phase.kind === 'run' && (
        <div class="progress">
          <div class="progress-bar">
            <i style={{ width: `${phase.p * 100}%` }} />
          </div>
          <span>
            {(phase.p * 100).toFixed(0)}% · кадр {phase.frame.toLocaleString('ru-RU')} из {phase.total.toLocaleString('ru-RU')}
            {phase.eta > 1 ? ` · осталось ≈ ${clock(phase.eta)}` : ''}
          </span>
          <p class="muted">Вкладку можно свернуть, но не закрывать.</p>
        </div>
      )}
      {phase.kind === 'mux' && (
        <div class="progress">
          <div class="progress-bar is-busy">
            <i style={{ width: '100%' }} />
          </div>
          <span>Сборка MP4…</span>
        </div>
      )}
      {phase.kind === 'done' && (
        <div class="notice is-ok is-block">
          <Icon name="check" size={16} />
          <div>
            <b>{phase.result.file}</b> · {fmtSize(phase.result.size)} · за {clock(phase.took)}
            <div class="form-row">
              <button type="button" class="btn" onClick={() => void api.reveal(phase.result.file)}>
                <Icon name="folder" size={14} /> Показать в папке
              </button>
              <a class="btn" href={`/${phase.result.file}?v=${Date.now()}`} target="_blank" rel="noreferrer">
                <Icon name="play" size={14} /> Открыть видео
              </a>
            </div>
          </div>
        </div>
      )}
      {phase.kind === 'error' && (
        <div class="notice is-warn is-block">
          <Icon name="warn" size={14} />
          <div>Рендер не удался: {phase.message}</div>
        </div>
      )}
    </Dialog>
  );
}
