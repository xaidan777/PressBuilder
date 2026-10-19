/** Правая панель — свойства выделенного: объект, реплика, слайд. */

import { naturalCue, slideLead, slideTail } from '../engine/schedule.ts';
import type { ObjInfo } from '../engine/timeline.ts';
import { TIMING } from '../engine/timing.ts';
import { patchCue, patchObj, patchSlide, resetObj } from './actions.ts';
import { curSlide, deck, objects, playing, scenes, schedule, sel, selectedIds, selectObject, toggleObject } from './store.ts';
import { Icon, IconBtn, NumField } from './ui.tsx';
import { round } from './util.ts';

function ObjectProps({ slideId, o }: { slideId: string; o: ObjInfo }) {
  const ov = deck.value?.slides.find((s) => s.id === slideId)?.objects?.[o.id];
  const key = `obj:${o.id}`;
  // значения берём из ролика, а не из зонда: во время перетаскивания зонд молчит
  const cur = { x: ov?.x ?? o.base.x, y: ov?.y ?? o.base.y, scale: ov?.scale ?? 1, text: ov?.text ?? o.base.text ?? '' };
  return (
    <section class="insp-sec">
      <h3>
        <span>Объект</span>
        <em>{o.label}</em>
        {ov && <IconBtn icon="reset" label="Вернуть как в коде сцены" onClick={() => resetObj(slideId, o.id)} />}
      </h3>
      <div class="row-3">
        <NumField label="X" value={round(cur.x)} onChange={(v) => patchObj(slideId, o.id, { x: v }, { key })} />
        <NumField label="Y" value={round(cur.y)} onChange={(v) => patchObj(slideId, o.id, { y: v }, { key })} />
        <NumField
          label="Масштаб"
          value={round(cur.scale * 100, 1)}
          step={1}
          min={5}
          max={2000}
          digits={1}
          suffix="%"
          onChange={(v) => patchObj(slideId, o.id, { scale: v === undefined || v === 100 ? undefined : v / 100 }, { key })}
        />
      </div>
      {o.base.text !== null && (
        <label class="field">
          <span>
            Текст
            {ov?.text !== undefined && (
              <button type="button" class="link" onClick={() => patchObj(slideId, o.id, { text: undefined })}>
                вернуть исходный
              </button>
            )}
          </span>
          <textarea
            rows={2}
            value={cur.text}
            spellcheck={false}
            onInput={(e) => {
              const v = e.currentTarget.value;
              patchObj(slideId, o.id, { text: v === o.base.text ? undefined : v }, { key: `${key}:text` });
            }}
          />
        </label>
      )}
      <label class="check">
        <input
          type="checkbox"
          checked={o.hidden}
          onChange={(e) => patchObj(slideId, o.id, { hidden: e.currentTarget.checked })}
        />
        скрыть объект
      </label>
    </section>
  );
}

function CueProps({ slideId, cueId }: { slideId: string; cueId: string }) {
  const d = deck.value;
  const sch = schedule.value;
  const cue = d?.slides.find((s) => s.id === slideId)?.cues.find((c) => c.id === cueId);
  const sc = sch?.slides.find((s) => s.slide.id === slideId)?.cues.find((c) => c.id === cueId);
  if (!cue || !sc || !sch) return null;
  const manual = !!cue.dur;
  const k = sch.scale;
  const key = `cue:${cueId}`;
  return (
    <section class="insp-sec">
      <h3>
        <span>Реплика</span>
        <em>{cueId}</em>
      </h3>
      <label class="field">
        <span>Озвучка</span>
        <textarea
          rows={3}
          value={cue.say}
          spellcheck={false}
          onInput={(e) => patchCue(slideId, cueId, { say: e.currentTarget.value }, { key: `say:${cueId}` })}
        />
      </label>
      <label class="field">
        <span>На экране</span>
        <textarea
          rows={2}
          class="is-show"
          value={cue.show ?? ''}
          placeholder="как в озвучке"
          spellcheck={false}
          onInput={(e) => patchCue(slideId, cueId, { show: e.currentTarget.value }, { key: `show:${cueId}` })}
        />
      </label>
      <div class="row-2">
        <NumField
          label="Длительность"
          value={round(sc.dur, 2)}
          step={0.1}
          min={0.2}
          digits={2}
          suffix="с"
          onChange={(v) => patchCue(slideId, cueId, { dur: v === undefined ? undefined : v / k }, { key })}
        />
        <button
          type="button"
          class={`toggle ${manual ? '' : 'is-on'}`}
          title="Считать длительность из текста"
          onClick={() => patchCue(slideId, cueId, { dur: manual ? undefined : naturalCue(cue) })}
        >
          <Icon name={manual ? 'pin' : 'check'} size={13} /> {manual ? 'вручную' : 'из текста'}
        </button>
      </div>
      <div class="row-2">
        <NumField
          label="Пауза после"
          value={cue.hold}
          placeholder="0"
          step={0.1}
          min={0}
          digits={2}
          suffix="с"
          disabled={manual}
          onChange={(v) => patchCue(slideId, cueId, { hold: v }, { key })}
        />
        <NumField
          label="Темп"
          value={cue.rate}
          placeholder="1"
          step={0.05}
          min={0.3}
          max={3}
          digits={2}
          suffix="×"
          disabled={manual}
          onChange={(v) => patchCue(slideId, cueId, { rate: v }, { key })}
        />
      </div>
    </section>
  );
}

function SlideProps({ slideId }: { slideId: string }) {
  const d = deck.value;
  const slide = d?.slides.find((s) => s.id === slideId);
  if (!d || !slide) return null;
  const coded = scenes.value.has(slideId);
  const isCurrent = curSlide.value?.slide.id === slideId;
  const list = isCurrent ? objects.value : [];
  const s = sel.value;
  const key = `slide:${slideId}`;
  return (
    <section class="insp-sec">
      <h3>
        <span>Слайд</span>
        <em>
          {slideId} · {coded ? 'своя сцена' : 'заглушка'}
        </em>
      </h3>
      <div class="row-2">
        <NumField
          label="Пауза до"
          value={slide.lead}
          placeholder={String(d.lead ?? TIMING.lead)}
          step={0.05}
          min={0}
          digits={2}
          suffix="с"
          onChange={(v) => patchSlide(slideId, { lead: v }, { key })}
        />
        <NumField
          label="Пауза после"
          value={slide.tail}
          placeholder={String(d.tail ?? TIMING.tail)}
          step={0.05}
          min={0}
          digits={2}
          suffix="с"
          onChange={(v) => patchSlide(slideId, { tail: v }, { key })}
        />
      </div>
      <div class="obj-list">
        <div class="obj-list-title">Объекты {playing.value ? '' : `· ${list.length}`}</div>
        {!isCurrent && <p class="muted">Поставь плейхед на этот слайд, чтобы увидеть его объекты.</p>}
        {isCurrent && !list.length && !playing.value && (
          <p class="muted">У сцены нет объектов, которые можно двигать (она рисует без f.obj).</p>
        )}
        {list.map((o) => {
          const changed = !!slide.objects?.[o.id];
          const on = s.kind === 'obj' && s.slide === slideId && selectedIds(s).includes(o.id);
          return (
            <div
              key={o.id}
              class={`obj-row ${on ? 'is-selected' : ''} ${o.bbox ? '' : 'is-dim'}`}
              onClick={(e) => (e.shiftKey ? toggleObject(slideId, o.id) : selectObject(slideId, o.id))}
            >
              <span class="obj-name" title={o.id}>
                {o.label}
              </span>
              {changed && <i class="dot" title="Изменён в редакторе" />}
              <IconBtn
                icon={o.hidden ? 'eyeOff' : 'eye'}
                label={o.hidden ? 'Показать' : 'Скрыть'}
                size={14}
                onClick={(e) => {
                  e.stopPropagation();
                  patchObj(slideId, o.id, { hidden: !o.hidden });
                }}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function Inspector() {
  const s = sel.value;
  const d = deck.value;
  if (!d) return null;
  const slideId = s.kind !== 'none' ? s.slide : curSlide.value?.slide.id;
  const obj = s.kind === 'obj' ? objects.value.find((o) => o.id === s.obj) : undefined;
  const slide = d.slides.find((x) => x.id === slideId);
  return (
    <aside class="panel inspector">
      <div class="panel-title">
        <span>Свойства</span>
      </div>
      <div class="insp-body">
        {s.kind === 'obj' && obj && !s.also?.length && <ObjectProps slideId={s.slide} o={obj} />}
        {s.kind === 'obj' && !!s.also?.length && (
          <section class="insp-sec">
            <h3>
              <span>Выделено объектов: {selectedIds(s).length}</span>
            </h3>
            <p class="muted">Двигаются вместе — мышью или стрелками. Масштаб и текст правятся у одного объекта.</p>
          </section>
        )}
        {s.kind === 'obj' && !obj && !playing.value && (
          <section class="insp-sec">
            <p class="muted">Объект «{s.obj}» есть на другом слайде — поставь плейхед туда.</p>
          </section>
        )}
        {s.kind === 'cue' && <CueProps slideId={s.slide} cueId={s.cue} />}
        {slide && <SlideProps slideId={slide.id} />}
        {slide && s.kind !== 'cue' && s.kind !== 'obj' && (
          <p class="muted insp-tip">
            Паузы слайда: до первой реплики ({slideLead(d, slide)} с) и после последней ({slideTail(d, slide)} с) — на въезд
            и выезд графики.
          </p>
        )}
      </div>
    </aside>
  );
}
