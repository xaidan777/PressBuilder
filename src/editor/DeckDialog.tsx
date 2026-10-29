/**
 * Диалог «Новая тема» и он же — «Текст и разбивка» для открытого ролика:
 * заголовок, текст озвучки, число слайдов (с рекомендацией) и хронометраж.
 * Для новой темы здесь же выбирается стиль (с живым примером слайда), текст можно
 * взять из файла, а озвучку — приложить сразу: она ляжет в папку ролика.
 */

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { screenText } from '../engine/placeholder.ts';
import type { SampleText } from '../engine/sample.ts';
import { estimateDuration, recommendSlides, splitText, splitToCues } from '../engine/split.ts';
import { DEFAULT_STYLE } from '../engine/styles.ts';
import type { DeckData } from '../engine/types.ts';
import { api } from './api.ts';
import { drawWave, filePeaks, type AudioInfo } from './audio.ts';
import { deck, decks, hasScenes, openDeck, refreshDecks, say, update } from './store.ts';
import { StylePicker } from './StylePicker.tsx';
import { ClockField, Dialog, Icon, IconBtn } from './ui.tsx';
import { clock, fmtSize, nChars, nCues, round, slugify } from './util.ts';

type Timing = 'text' | 'audio' | 'fixed';

/** Те же форматы, что принимает сервер (server/plugin.ts). */
const AUDIO_RE = /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|webm)$/i;
const TEXT_RE = /\.(txt|md|markdown|text)$/i;

interface Voice {
  file: File;
  /** null — ещё читается. */
  info: AudioInfo | null;
}

export const SAMPLE_FALLBACK: SampleText = {
  title: 'Заголовок ролика',
  line: 'Так на экране будет выглядеть текст реплики',
};

export function DeckDialog({ mode, onClose }: { mode: 'new' | 'resplit'; onClose(): void }) {
  const cur = mode === 'resplit' ? deck.peek() : null;
  const isNew = mode === 'new';
  const [title, setTitle] = useState(cur?.title ?? '');
  const [id, setId] = useState<string | null>(cur?.id ?? null);
  const [text, setText] = useState(cur?.text ?? '');
  const [count, setCount] = useState<number | null>(cur ? cur.slides.length : null);
  const [timing, setTiming] = useState<Timing>(cur && cur.target !== null ? 'fixed' : 'text');
  const [target, setTarget] = useState(cur?.target ?? 0);
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const [voice, setVoice] = useState<Voice | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const cues = useMemo(() => splitToCues(text), [text]);
  const recommended = recommendSlides(cues);
  const n = Math.max(1, Math.min(count ?? recommended, Math.max(1, cues.length)));
  const natural = estimateDuration(cues, n);
  const voiceDur = voice?.info ? round(voice.info.duration, 1) : 0;
  const goal = timing === 'fixed' && target > 0 ? target : timing === 'audio' && voiceDur > 0 ? voiceDur : null;
  const total = goal ?? natural;
  const deckId = id ?? slugify(title);
  const idTaken = isNew && decks.value.some((d) => d.id === deckId);
  const idBad = !/^[a-z0-9][a-z0-9_-]{0,40}$/.test(deckId);
  const voiceBusy = !!voice && !voice.info;
  const ready = title.trim() && cues.length > 0 && !idTaken && !idBad && !busy && !voiceBusy;

  const sample: SampleText = {
    title: title.trim() || SAMPLE_FALLBACK.title,
    line: (cues[0] && screenText(cues[0].say)) || SAMPLE_FALLBACK.line,
  };

  // ---------------------------------------------------------------- файлы

  const addVoice = (file: File) => {
    if (!AUDIO_RE.test(file.name)) return setError('Озвучка: mp3, wav, m4a, aac, ogg, opus, flac или webm');
    setError('');
    setVoice({ file, info: null });
    setTiming('audio');
    filePeaks(file)
      .then((info) => setVoice((v) => (v?.file === file ? { file, info } : v)))
      .catch(() => {
        setVoice((v) => (v?.file === file ? null : v));
        setTiming((t) => (t === 'audio' ? 'text' : t));
        setError(`Файл «${file.name}» не читается как звук`);
      });
  };

  const addText = async (file: File) => {
    const body = (await file.text()).replace(/\r\n?/g, '\n').trim();
    if (!body) return setError(`В файле «${file.name}» нет текста`);
    setError('');
    setText(body);
    if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim());
  };

  const addFiles = (files: FileList | null | undefined) => {
    for (const f of Array.from(files ?? [])) {
      if (AUDIO_RE.test(f.name) || f.type.startsWith('audio/')) addVoice(f);
      else if (TEXT_RE.test(f.name) || f.type.startsWith('text/')) void addText(f);
      else setError(`«${f.name}»: нужен текст (.txt, .md) или звук (mp3, wav, m4a…)`);
    }
  };

  const dropProps = isNew
    ? {
        onDragOver: (e: DragEvent) => {
          if (!e.dataTransfer?.types.includes('Files')) return;
          e.preventDefault();
          setDrag(true);
        },
        onDragLeave: (e: DragEvent) => {
          if (!(e.currentTarget as Node).contains(e.relatedTarget as Node | null)) setDrag(false);
        },
        onDrop: (e: DragEvent) => {
          e.preventDefault();
          setDrag(false);
          addFiles(e.dataTransfer?.files);
        },
      }
    : {};

  // ---------------------------------------------------------------- создание

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setError('');
    try {
      const slides = splitText(text, n);
      if (isNew) {
        const data: DeckData = {
          id: deckId,
          title: title.trim(),
          text,
          target: goal,
          style,
          format: { height: 1080, fps: 60, bitrate: 24 },
          slides,
        };
        await api.createDeck(data);
        let note = '';
        if (voice) {
          try {
            const r = await api.uploadAudio(deckId, voice.file);
            data.audio = { file: r.file, offset: 0, volume: 1 };
            await api.saveDeck(data);
          } catch (e) {
            note = ` — но озвучка не загрузилась: ${e instanceof Error ? e.message : e}`;
          }
        }
        await refreshDecks();
        await openDeck(deckId);
        say(`Тема «${data.title}» создана${note}`);
      } else {
        update((d) => {
          d.title = title.trim();
          d.text = text;
          d.target = goal;
          d.slides = slides;
        });
        say('Текст разбит заново');
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // ---------------------------------------------------------------- вёрстка

  const titleRow = (
    <>
      <div class="form-row">
        <label class="field is-grow">
          <span>Заголовок</span>
          <input type="text" value={title} autofocus placeholder="О чём ролик" onInput={(e) => setTitle(e.currentTarget.value)} />
        </label>
        <label class="field" style={{ width: '200px' }}>
          <span>Папка (id)</span>
          <input
            type="text"
            class={idTaken || (idBad && deckId) ? 'is-bad' : ''}
            value={deckId}
            disabled={!isNew}
            spellcheck={false}
            onInput={(e) => setId(e.currentTarget.value.toLowerCase())}
          />
        </label>
      </div>
      {idTaken && <p class="form-error">Ролик с id «{deckId}» уже есть.</p>}
    </>
  );

  const textField = (
    <div class="field">
      <span>
        Текст озвучки
        <em>{text.trim() ? `${nChars(text.trim().length)} · ${nCues(cues.length)} · ≈ ${clock(natural)} обычным темпом` : 'абзацы помогают разбивке'}</em>
      </span>
      <div class="text-box">
        <textarea
          class={`big-text ${isNew ? 'is-short' : ''}`}
          value={text}
          placeholder={
            isNew
              ? 'Вставь сюда весь текст — или перетащи файл .txt / .md. Он сам разобьётся на реплики и слайды, время посчитается из длины фраз.'
              : 'Вставь сюда весь текст. Он сам разобьётся на реплики и слайды, время посчитается из длины фраз.'
          }
          spellcheck={false}
          onInput={(e) => setText(e.currentTarget.value)}
        />
        {isNew && <FilePick label="Из файла" icon="text" accept=".txt,.md,.markdown,text/plain,text/markdown" onPick={addFiles} />}
      </div>
    </div>
  );

  const slidesAndTiming = (
    <div class="form-row is-bottom is-wrap">
      <div class="field">
        <span>Слайдов</span>
        <div class="stepper">
          <button type="button" onClick={() => setCount(Math.max(1, n - 1))}>
            −
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={n}
            onInput={(e) => setCount(Number(e.currentTarget.value.replace(/\D/g, '')) || 1)}
          />
          <button type="button" onClick={() => setCount(n + 1)}>
            +
          </button>
        </div>
      </div>
      <div class="field-note">
        {cues.length > 0 && (
          <>
            ≈ {(total / n).toFixed(1)} с на слайд
            <br />
            {count !== null && count !== recommended ? (
              <button type="button" class="link" onClick={() => setCount(null)}>
                рекомендуется {recommended}
              </button>
            ) : (
              <span class="muted">рекомендованное число</span>
            )}
          </>
        )}
      </div>
      <span class="tl-spacer" />
      <div class="field">
        <span>Хронометраж</span>
        <div class="seg">
          <button type="button" class={timing === 'text' ? 'is-on' : ''} onClick={() => setTiming('text')}>
            из текста · {clock(natural)}
          </button>
          {voice && (
            <button type="button" class={timing === 'audio' ? 'is-on' : ''} disabled={!voice.info} onClick={() => setTiming('audio')}>
              по звуку{voice.info ? ` · ${clock(voiceDur)}` : ''}
            </button>
          )}
          <button
            type="button"
            class={timing === 'fixed' ? 'is-on' : ''}
            onClick={() => {
              setTiming('fixed');
              if (!target) setTarget(Math.round(voiceDur || natural));
            }}
          >
            задать
          </button>
          {timing === 'fixed' && <ClockField value={target} onChange={setTarget} />}
        </div>
      </div>
    </div>
  );

  return (
    <Dialog
      title={isNew ? 'Новая тема' : 'Текст и разбивка'}
      wide
      xwide={isNew}
      onClose={onClose}
      footer={
        <>
          {error && <span class="form-error">{error}</span>}
          <button type="button" class="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="button" class="btn is-primary" disabled={!ready} onClick={() => void submit()}>
            {busy ? 'Создаю…' : isNew ? 'Создать' : 'Разбить заново'}
          </button>
        </>
      }
    >
      {!isNew && (
        <p class={`notice ${hasScenes.value ? 'is-warn' : ''}`}>
          <Icon name="warn" size={14} />
          {hasScenes.value
            ? 'У ролика уже есть сцены. Новая разбивка заменит слайды и реплики — сцены перестанут совпадать с текстом, их придётся переделать.'
            : 'Новая разбивка заменит текущие слайды и реплики. Отменить можно через Ctrl+Z.'}
        </p>
      )}
      {isNew ? (
        <div class={`new-deck ${drag ? 'is-drag' : ''}`} {...dropProps}>
          <div class="new-deck-form">
            {titleRow}
            {textField}
            <VoiceField voice={voice} onPick={addFiles} onRemove={() => {
              setVoice(null);
              if (timing === 'audio') setTiming('text');
            }} />
            {slidesAndTiming}
          </div>
          <div class="new-deck-style">
            <div class="field">
              <span>
                Стиль
                <em>сменить можно и потом</em>
              </span>
              <StylePicker value={style} onChange={setStyle} sample={sample} />
            </div>
          </div>
          {drag && <div class="drop-hint">Отпусти файл: текст (.txt, .md) или озвучка (mp3, wav, m4a…)</div>}
        </div>
      ) : (
        <>
          {titleRow}
          {textField}
          {slidesAndTiming}
        </>
      )}
    </Dialog>
  );
}

/** Кнопка выбора файла: скрытый input + обычная кнопка. */
function FilePick({ label, icon, accept, onPick }: { label: string; icon: 'text' | 'mic'; accept: string; onPick(f: FileList | null): void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" class="btn file-pick" onClick={() => input.current?.click()}>
        <Icon name={icon} size={14} /> {label}
      </button>
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => {
          onPick(e.currentTarget.files);
          e.currentTarget.value = '';
        }}
      />
    </>
  );
}

/** Озвучка новой темы: файл, длительность и волна; без файла — место, куда его бросить. */
function VoiceField({ voice, onPick, onRemove }: { voice: Voice | null; onPick(f: FileList | null): void; onRemove(): void }) {
  const wave = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = wave.current;
    const info = voice?.info;
    if (!cv || !info) return;
    const css = getComputedStyle(cv);
    drawWave(cv, info, 0, (cv.clientWidth || 300) / info.duration, css.color);
  }, [voice?.info]);

  return (
    <div class="field">
      <span>
        Озвучка
        <em>необязательно · попадёт в MP4, реплики можно подогнать под паузы голоса</em>
      </span>
      {voice ? (
        <div class="voice-row">
          <Icon name="mic" size={16} />
          <div class="voice-main">
            <div class="voice-name">
              <b>{voice.file.name}</b>
              <span>
                {fmtSize(voice.file.size)}
                {voice.info ? ` · ${clock(voice.info.duration, 1)}` : ' · читаю…'}
              </span>
            </div>
            <canvas ref={wave} class="voice-wave" width={720} height={56} />
          </div>
          <IconBtn icon="close" label="Убрать озвучку" onClick={onRemove} />
        </div>
      ) : (
        <label class="voice-drop">
          <Icon name="mic" size={16} />
          <span>
            <b>Добавить звук</b> — mp3, wav, m4a, ogg… или перетащи файл сюда
          </span>
          <input
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus,.flac,.webm"
            hidden
            onChange={(e) => {
              onPick(e.currentTarget.files);
              e.currentTarget.value = '';
            }}
          />
        </label>
      )}
    </div>
  );
}
