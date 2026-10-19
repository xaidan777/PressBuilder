/**
 * Диалог «Новая тема» и он же — «Текст и разбивка» для открытого ролика:
 * заголовок, текст озвучки, число слайдов (с рекомендацией) и хронометраж.
 */

import { useMemo, useState } from 'preact/hooks';
import { estimateDuration, recommendSlides, splitText, splitToCues } from '../engine/split.ts';
import type { DeckData } from '../engine/types.ts';
import { api } from './api.ts';
import { deck, decks, hasScenes, openDeck, refreshDecks, say, update } from './store.ts';
import { ClockField, Dialog, Icon } from './ui.tsx';
import { clock, nChars, nCues, slugify } from './util.ts';

export function DeckDialog({ mode, onClose }: { mode: 'new' | 'resplit'; onClose(): void }) {
  const cur = mode === 'resplit' ? deck.peek() : null;
  const [title, setTitle] = useState(cur?.title ?? '');
  const [id, setId] = useState<string | null>(cur?.id ?? null);
  const [text, setText] = useState(cur?.text ?? '');
  const [count, setCount] = useState<number | null>(cur ? cur.slides.length : null);
  const [fixed, setFixed] = useState(cur ? cur.target !== null : false);
  const [target, setTarget] = useState(cur?.target ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const cues = useMemo(() => splitToCues(text), [text]);
  const recommended = recommendSlides(cues);
  const n = Math.max(1, Math.min(count ?? recommended, Math.max(1, cues.length)));
  const natural = estimateDuration(cues, n);
  const total = fixed && target > 0 ? target : natural;
  const deckId = id ?? slugify(title);
  const idTaken = mode === 'new' && decks.value.some((d) => d.id === deckId);
  const idBad = !/^[a-z0-9][a-z0-9_-]{0,40}$/.test(deckId);
  const ready = title.trim() && cues.length > 0 && !idTaken && !idBad && !busy;

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setError('');
    try {
      const slides = splitText(text, n);
      if (mode === 'new') {
        const data: DeckData = {
          id: deckId,
          title: title.trim(),
          text,
          target: fixed && target > 0 ? target : null,
          format: { height: 1080, fps: 60, bitrate: 24 },
          slides,
        };
        await api.createDeck(data);
        await refreshDecks();
        await openDeck(deckId);
        say(`Тема «${data.title}» создана`);
      } else {
        update((d) => {
          d.title = title.trim();
          d.text = text;
          d.target = fixed && target > 0 ? target : null;
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

  return (
    <Dialog
      title={mode === 'new' ? 'Новая тема' : 'Текст и разбивка'}
      wide
      onClose={onClose}
      footer={
        <>
          {error && <span class="form-error">{error}</span>}
          <button type="button" class="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="button" class="btn is-primary" disabled={!ready} onClick={() => void submit()}>
            {mode === 'new' ? 'Создать' : 'Разбить заново'}
          </button>
        </>
      }
    >
      {mode === 'resplit' && (
        <p class={`notice ${hasScenes.value ? 'is-warn' : ''}`}>
          <Icon name="warn" size={14} />
          {hasScenes.value
            ? 'У ролика уже есть сцены. Новая разбивка заменит слайды и реплики — сцены перестанут совпадать с текстом, их придётся переделать.'
            : 'Новая разбивка заменит текущие слайды и реплики. Отменить можно через Ctrl+Z.'}
        </p>
      )}
      <div class="form-row">
        <label class="field is-grow">
          <span>Заголовок</span>
          <input type="text" value={title} autofocus placeholder="О чём ролик" onInput={(e) => setTitle(e.currentTarget.value)} />
        </label>
        <label class="field" style={{ width: '220px' }}>
          <span>Папка (id)</span>
          <input
            type="text"
            class={idTaken || (idBad && deckId) ? 'is-bad' : ''}
            value={deckId}
            disabled={mode === 'resplit'}
            spellcheck={false}
            onInput={(e) => setId(e.currentTarget.value.toLowerCase())}
          />
        </label>
      </div>
      {idTaken && <p class="form-error">Ролик с id «{deckId}» уже есть.</p>}

      <label class="field">
        <span>
          Текст озвучки
          <em>{text.trim() ? `${nChars(text.trim().length)} · ${nCues(cues.length)} · ≈ ${clock(natural)} обычным темпом` : 'абзацы помогают разбивке'}</em>
        </span>
        <textarea
          class="big-text"
          value={text}
          placeholder="Вставь сюда весь текст. Он сам разобьётся на реплики и слайды, время посчитается из длины фраз."
          spellcheck={false}
          onInput={(e) => setText(e.currentTarget.value)}
        />
      </label>

      <div class="form-row is-bottom">
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
            <button type="button" class={fixed ? '' : 'is-on'} onClick={() => setFixed(false)}>
              из текста · {clock(natural)}
            </button>
            <button
              type="button"
              class={fixed ? 'is-on' : ''}
              onClick={() => {
                setFixed(true);
                if (!target) setTarget(Math.round(natural));
              }}
            >
              задать
            </button>
            {fixed && <ClockField value={target} onChange={setTarget} />}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
