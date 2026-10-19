/** Левая панель — сценарий: слайды и их реплики. Текст правится прямо здесь. */

import { useEffect, useRef } from 'preact/hooks';
import type { SchedCue, SchedSlide } from '../engine/schedule.ts';
import {
  addCueAfter,
  addSlideAfter,
  deleteCue,
  deleteSlide,
  mergeCueWithNext,
  mergeSlideWithNext,
  moveCueAcross,
  moveSlide,
  patchCue,
  patchSlide,
  splitCue,
  splitSlideAt,
} from './actions.ts';
import { activeCue, curSlide, playing, scenes, schedule, seek, sel } from './store.ts';
import { Icon, MenuBtn } from './ui.tsx';
import { clock } from './util.ts';

/** Момент, когда реплика уже раскрылась на экране, — туда и ставим плейхед при выборе. */
const cueFocusTime = (sc: SchedSlide, c: SchedCue) => sc.start + c.start + c.dur * 0.85;

function CueRow({ sc, c, index, lastSlide }: { sc: SchedSlide; c: SchedCue; index: number; lastSlide: boolean }) {
  const slideId = sc.slide.id;
  const raw = sc.slide.cues[index];
  const s = sel.value;
  const selected = s.kind === 'cue' && s.slide === slideId && s.cue === c.id;
  const active = activeCue.value === `${slideId}/${c.id}`;
  const sayRef = useRef<HTMLTextAreaElement>(null);
  const first = index === 0;
  const last = index === sc.cues.length - 1;

  const pick = () => {
    sel.value = { kind: 'cue', slide: slideId, cue: c.id };
    if (!playing.peek()) seek(cueFocusTime(sc, c));
  };

  return (
    <div
      class={`cue ${selected ? 'is-selected' : ''} ${active ? 'is-active' : ''}`}
      data-cue={`${slideId}/${c.id}`}
      onPointerDown={(e) => {
        // клик по полю ввода обработает его focus
        if (!(e.target as HTMLElement).closest('textarea, input, .menu')) pick();
      }}
    >
      <button type="button" class="cue-time" title="Перейти к реплике" onClick={() => seek(sc.start + c.start)}>
        {clock(sc.start + c.start)}
      </button>
      <div class="cue-body">
        <textarea
          ref={sayRef}
          class="cue-say"
          rows={1}
          value={raw.say}
          placeholder="Текст озвучки"
          spellcheck={false}
          onFocus={pick}
          onInput={(e) => patchCue(slideId, c.id, { say: e.currentTarget.value }, { key: `say:${c.id}` })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              splitCue(slideId, c.id, e.currentTarget.selectionStart);
            }
          }}
        />
        <input
          class="cue-show"
          type="text"
          value={raw.show ?? ''}
          placeholder="на экране — как в озвучке"
          spellcheck={false}
          onFocus={pick}
          onInput={(e) => patchCue(slideId, c.id, { show: e.currentTarget.value }, { key: `show:${c.id}` })}
        />
      </div>
      <div class="cue-side">
        <span class={`cue-dur ${c.manual ? 'is-manual' : ''}`} title={c.manual ? 'Длительность задана вручную' : 'Длительность из текста'}>
          {c.dur.toFixed(1)}
        </span>
        <MenuBtn
          items={[
            {
              label: 'Разрезать по курсору',
              hint: 'Ctrl+Enter',
              onSelect: () => splitCue(slideId, c.id, sayRef.current?.selectionStart ?? 0),
            },
            { label: 'Объединить со следующей', disabled: last, onSelect: () => mergeCueWithNext(slideId, c.id) },
            { label: 'Добавить реплику ниже', icon: 'plus', onSelect: () => addCueAfter(slideId, c.id) },
            null,
            { label: 'Новый слайд с этой реплики', disabled: first, onSelect: () => splitSlideAt(slideId, c.id) },
            ...(first && sc.index > 0
              ? [{ label: 'В предыдущий слайд', onSelect: () => moveCueAcross(slideId, c.id, -1) }]
              : []),
            ...(last && !lastSlide
              ? [{ label: 'В следующий слайд', onSelect: () => moveCueAcross(slideId, c.id, 1) }]
              : []),
            null,
            { label: 'Удалить реплику', icon: 'trash', danger: true, onSelect: () => deleteCue(slideId, c.id) },
          ]}
        />
      </div>
    </div>
  );
}

function SlideCard({ sc, total }: { sc: SchedSlide; total: number }) {
  const slide = sc.slide;
  const s = sel.value;
  const selected = s.kind !== 'none' && s.slide === slide.id;
  const current = curSlide.value?.slide.id === slide.id;
  const coded = scenes.value.has(slide.id);

  return (
    <section class={`slide ${selected ? 'is-selected' : ''} ${current ? 'is-current' : ''}`} data-slide={slide.id}>
      <header
        class="slide-head"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('input, .menu')) return;
          sel.value = { kind: 'slide', slide: slide.id };
          if (!playing.peek()) seek(sc.start + Math.min(sc.dur * 0.5, sc.lead + 0.01));
        }}
      >
        <span class="slide-no">{sc.index + 1}</span>
        <input
          class="slide-label"
          type="text"
          value={slide.label}
          placeholder="Название слайда"
          spellcheck={false}
          onFocus={() => (sel.value = { kind: 'slide', slide: slide.id })}
          onInput={(e) => patchSlide(slide.id, { label: e.currentTarget.value }, { key: `label:${slide.id}` })}
        />
        <span class={`slide-state ${coded ? 'is-coded' : ''}`} title={coded ? 'У слайда есть своя сцена' : 'Пока заглушка — сцену сделает Claude'}>
          <Icon name={coded ? 'code' : 'text'} size={13} />
        </span>
        <span class="slide-dur">{sc.dur.toFixed(1)} с</span>
        <MenuBtn
          label="Действия со слайдом"
          items={[
            { label: 'Добавить слайд ниже', icon: 'plus', onSelect: () => addSlideAfter(slide.id) },
            { label: 'Добавить реплику', onSelect: () => addCueAfter(slide.id, null) },
            { label: 'Объединить со следующим', disabled: sc.index >= total - 1, onSelect: () => mergeSlideWithNext(slide.id) },
            null,
            { label: 'Выше', disabled: sc.index === 0, onSelect: () => moveSlide(slide.id, -1) },
            { label: 'Ниже', disabled: sc.index >= total - 1, onSelect: () => moveSlide(slide.id, 1) },
            null,
            { label: 'Удалить слайд', icon: 'trash', danger: true, disabled: total <= 1, onSelect: () => deleteSlide(slide.id) },
          ]}
        />
      </header>
      <div class="slide-cues">
        {sc.cues.map((c, i) => (
          <CueRow key={c.id} sc={sc} c={c} index={i} lastSlide={sc.index >= total - 1} />
        ))}
        {!sc.cues.length && (
          <button type="button" class="ghost-btn" onClick={() => addCueAfter(slide.id, null)}>
            <Icon name="plus" size={13} /> реплика
          </button>
        )}
      </div>
    </section>
  );
}

export function ScriptPanel() {
  const sch = schedule.value;
  const root = useRef<HTMLDivElement>(null);
  const current = curSlide.value?.slide.id;
  const s = sel.value;

  // при воспроизведении сценарий едет за плейхедом
  useEffect(() => {
    if (!playing.peek() || !current) return;
    root.current?.querySelector(`[data-slide="${current}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [current]);

  // выбрали реплику на таймлайне — показываем её в сценарии
  useEffect(() => {
    if (s.kind === 'none') return;
    const q = s.kind === 'cue' ? `[data-cue="${s.slide}/${s.cue}"]` : `[data-slide="${s.slide}"] .slide-head`;
    const el = root.current?.querySelector(q);
    if (el && !el.contains(document.activeElement)) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [s.kind, s.kind === 'none' ? '' : s.slide, s.kind === 'cue' ? s.cue : '']);

  if (!sch) return null;
  return (
    <aside class="panel script" ref={root}>
      <div class="panel-title">
        <span>Сценарий</span>
        <span class="panel-note">
          озвучка → <em>на экране</em>
        </span>
      </div>
      <div class="script-list">
        {sch.slides.map((sc) => (
          <SlideCard key={sc.slide.id} sc={sc} total={sch.slides.length} />
        ))}
        <button type="button" class="ghost-btn is-wide" onClick={() => addSlideAfter(null)}>
          <Icon name="plus" size={13} /> слайд
        </button>
      </div>
    </aside>
  );
}
