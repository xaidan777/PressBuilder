/**
 * Сцена: канвас ролика и слой поверх него, где объекты выделяются,
 * перетаскиваются и масштабируются за углы.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ObjInfo } from '../engine/timeline.ts';
import { H, SAFE_BOTTOM, W } from '../engine/theme.ts';
import { patchObj } from './actions.ts';
import {
  attachPlayer,
  beginGesture,
  curSlide,
  deck,
  endGesture,
  hasScenes,
  objects,
  player,
  playing,
  say,
  sel,
  selectedIds,
  timeline,
  toggleObject,
} from './store.ts';
import { Icon, IconBtn } from './ui.tsx';
import { capture, clamp, round } from './util.ts';

type Box = NonNullable<ObjInfo['bbox']>;
type Corner = 'nw' | 'ne' | 'sw' | 'se';

/** Центр рабочей зоны кадра: низ занят плеером, поэтому по вертикали это не 540. */
const CENTER = { x: W / 2, y: (H - SAFE_BOTTOM) / 2 };
const SNAP = 9;

const pct = (b: Box) => ({
  left: `${(b.x / W) * 100}%`,
  top: `${(b.y / H) * 100}%`,
  width: `${(b.w / W) * 100}%`,
  height: `${(b.h / H) * 100}%`,
});

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** Общая рамка группы — по ней группа прилипает к центру кадра. */
function unionBox(group: ObjInfo[]): Box | null {
  const boxes = group.flatMap((o) => (o.bbox ? [o.bbox] : []));
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return { x, y, w: Math.max(...boxes.map((b) => b.x + b.w)) - x, h: Math.max(...boxes.map((b) => b.y + b.h)) - y };
}

const inBox = (b: Box | null, x: number, y: number, pad = 0) =>
  !!b && x >= b.x - pad && y >= b.y - pad && x <= b.x + b.w + pad && y <= b.y + b.h + pad;

/** Самый верхний объект под точкой: сначала по пикселям, потом по рамке. */
function pickObject(list: ObjInfo[], x: number, y: number): ObjInfo | null {
  for (let i = list.length - 1; i >= 0; i--) if (list[i].hit(x, y)) return list[i];
  let best: ObjInfo | null = null;
  for (const o of list) {
    const b = o.bbox;
    if (!b || !inBox(b, x, y)) continue;
    if (!best?.bbox || b.w * b.h < best.bbox.w * best.bbox.h) best = o;
  }
  return best;
}

export function Stage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  /** Рамки выделенных объектов во время жеста (зонд в это время молчит): id → рамка. */
  const [live, setLive] = useState<Record<string, Box> | null>(null);
  /** Рамка выделения, которую тянут по пустому месту. */
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [guides, setGuides] = useState<{ x: boolean; y: boolean }>({ x: false, y: false });

  useEffect(() => {
    if (canvasRef.current) attachPlayer(canvasRef.current);
    return () => player?.stop();
  }, []);

  const list = objects.value;
  const s = sel.value;
  const slideId = curSlide.value?.slide.id ?? '';
  const ids = s.kind === 'obj' && s.slide === slideId ? selectedIds(s) : [];
  const chosen = list.filter((o) => ids.includes(o.id));
  /** Единственный выделенный объект: только у него есть ручки масштаба. */
  const selected = chosen.length === 1 ? chosen[0] : null;
  const isPlaying = playing.value;

  const toFrame = (e: PointerEvent) => {
    const r = layerRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  /** Общая обвязка жеста: захват указателя, одна запись истории, уборка в конце. */
  const track = (
    e: PointerEvent,
    onMove: (p: { x: number; y: number }, m: PointerEvent) => void,
    o: { edits?: boolean; onEnd?: () => void } = {},
  ) => {
    const el = layerRef.current!;
    const edits = o.edits ?? true;
    capture(el, e);
    if (edits) beginGesture();
    const move = (m: PointerEvent) => onMove(toFrame(m), m);
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      setLive(null);
      setMarquee(null);
      setGuides({ x: false, y: false });
      o.onEnd?.();
      if (edits) endGesture();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  /** Перенос одного или сразу нескольких выделенных объектов. */
  const startMove = (e: PointerEvent, group: ObjInfo[]) => {
    const p0 = toFrame(e);
    const all = unionBox(group);
    track(e, (p, m) => {
      let dx = p.x - p0.x;
      let dy = p.y - p0.y;
      if (m.shiftKey) Math.abs(dx) > Math.abs(dy) ? (dy = 0) : (dx = 0);
      const snapped = { x: false, y: false };
      if (all && !m.altKey) {
        const cx = all.x + all.w / 2 + dx;
        const cy = all.y + all.h / 2 + dy;
        if (Math.abs(cx - CENTER.x) < SNAP) (dx += CENTER.x - cx), (snapped.x = true);
        if (Math.abs(cy - CENTER.y) < SNAP) (dy += CENTER.y - cy), (snapped.y = true);
      }
      const boxes: Record<string, Box> = {};
      for (const o of group) {
        const [ia, ib, ic, id] = o.inv;
        const det = ia * id - ib * ic || 1;
        // прямая матрица сцена → кадр (обратная к inv)
        const [fa, fb, fc, fd] = [id / det, -ib / det, -ic / det, ia / det];
        // положение в координатах сцены — целыми пикселями
        const lx = Math.round(o.cur.x + ia * dx + ic * dy) - o.cur.x;
        const ly = Math.round(o.cur.y + ib * dx + id * dy) - o.cur.y;
        patchObj(slideId, o.id, { x: o.cur.x + lx, y: o.cur.y + ly }, { merge: true });
        if (o.bbox) boxes[o.id] = { ...o.bbox, x: o.bbox.x + fa * lx + fc * ly, y: o.bbox.y + fb * lx + fd * ly };
      }
      setLive(boxes);
      setGuides(snapped);
    });
  };

  /** Рамка по пустому месту: выделяет всё, что в неё попало (с Shift — добавляет к выделенному). */
  const startMarquee = (e: PointerEvent) => {
    const p0 = toFrame(e);
    const keep = e.shiftKey ? ids : [];
    let picked: string[] = keep;
    track(
      e,
      (p) => {
        const box = { x: Math.min(p0.x, p.x), y: Math.min(p0.y, p.y), w: Math.abs(p.x - p0.x), h: Math.abs(p.y - p0.y) };
        setMarquee(box);
        const inside = list.filter((o) => o.bbox && overlaps(o.bbox, box)).map((o) => o.id);
        picked = [...new Set([...keep, ...inside])];
      },
      {
        edits: false,
        onEnd: () => {
          sel.value = picked.length ? { kind: 'obj', slide: slideId, obj: picked[0], also: picked.slice(1) } : { kind: 'none' };
        },
      },
    );
  };

  const startScale = (e: PointerEvent, o: ObjInfo, corner: Corner) => {
    e.stopPropagation();
    const b = o.bbox;
    if (!b) return;
    // противоположный угол остаётся на месте — как в любом графическом редакторе
    const anchor = { x: corner.includes('w') ? b.x + b.w : b.x, y: corner.includes('n') ? b.y + b.h : b.y };
    const p0 = toFrame(e);
    const d0 = Math.hypot(p0.x - anchor.x, p0.y - anchor.y) || 1;
    const [ia, ib, ic, id] = o.inv;
    track(e, (p) => {
      const f = clamp(Math.hypot(p.x - anchor.x, p.y - anchor.y) / d0, 0.05, 20);
      const scale = clamp(round(o.cur.scale * f, 3), 0.05, 20);
      const k = scale / o.cur.scale;
      // масштаб идёт вокруг опорной точки, поэтому её саму сдвигаем так, чтобы якорь не уехал
      const mx = (1 - k) * (anchor.x - o.pivot.x);
      const my = (1 - k) * (anchor.y - o.pivot.y);
      patchObj(
        slideId,
        o.id,
        { scale, x: Math.round(o.cur.x + ia * mx + ic * my), y: Math.round(o.cur.y + ib * mx + id * my) },
        { merge: true },
      );
      setLive({ [o.id]: { x: anchor.x + (b.x - anchor.x) * k, y: anchor.y + (b.y - anchor.y) * k, w: b.w * k, h: b.h * k } });
    });
  };

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    if (isPlaying) return void player?.pause();
    const p = toFrame(e);
    (document.activeElement as HTMLElement | null)?.blur();
    // Кого хватаем: 1) выделенный — если попали в его пиксели; 2) любой другой — по пикселям;
    // 3) выделенный — за пустое место внутри его рамки; 4) другой — по рамке.
    const o =
      [...chosen].reverse().find((c) => c.hit(p.x, p.y)) ??
      [...list].reverse().find((c) => c.hit(p.x, p.y)) ??
      chosen.find((c) => inBox(c.bbox, p.x, p.y, 6)) ??
      pickObject(list, p.x, p.y);
    if (!o) return startMarquee(e);
    if (e.shiftKey) return toggleObject(slideId, o.id);
    if (chosen.includes(o)) return startMove(e, chosen);
    sel.value = { kind: 'obj', slide: slideId, obj: o.id };
    startMove(e, [o]);
  };

  const onMove = (e: PointerEvent) => {
    if (isPlaying || e.buttons) return;
    const p = toFrame(e);
    setHover(pickObject(list, p.x, p.y)?.id ?? null);
  };

  const hovered = hover && !ids.includes(hover) ? list.find((o) => o.id === hover) : null;
  const boxOf = (o: ObjInfo) => live?.[o.id] ?? o.bbox;
  const hiddenNow = chosen.filter((o) => !o.bbox);
  const err = timeline.value?.errors.get(slideId);
  // сцена просит реплики, которых в слайде уже нет (удалили или переименовали)
  const lost = [...(timeline.value?.missingCues ?? [])].filter((k) => k.startsWith(`${slideId}/`)).map((k) => k.split('/')[1]);

  return (
    <main class="stage-area">
      <div class="stage-fit">
        <div class="stage">
          <canvas ref={canvasRef} />
          <div
            ref={layerRef}
            class={`stage-layer ${isPlaying ? 'is-playing' : ''} ${hovered || chosen.length ? 'can-grab' : ''}`}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          >
            {!isPlaying && (
              <>
                {guides.x && <div class="guide is-v" style={{ left: `${(CENTER.x / W) * 100}%` }} />}
                {guides.y && <div class="guide is-h" style={{ top: `${(CENTER.y / H) * 100}%` }} />}
                {hovered?.bbox && <div class="obj-box is-hover" style={pct(hovered.bbox)} />}
                {chosen.map((o) => {
                  const box = boxOf(o);
                  if (!box) return null;
                  return (
                    <div key={o.id} class="obj-box is-selected" style={pct(box)}>
                      {selected && <span class="obj-tag">{o.label}</span>}
                      {selected &&
                        (['nw', 'ne', 'sw', 'se'] as Corner[]).map((c) => (
                          <i key={c} class={`handle is-${c}`} onPointerDown={(e) => startScale(e, o, c)} />
                        ))}
                    </div>
                  );
                })}
                {marquee && <div class="marquee" style={pct(marquee)} />}
                {selected && !live && (
                  <div
                    class="pivot"
                    style={{ left: `${(selected.pivot.x / W) * 100}%`, top: `${(selected.pivot.y / H) * 100}%` }}
                  />
                )}
              </>
            )}
          </div>
          {hiddenNow.length > 0 && !isPlaying && (
            <div class="stage-note">«{hiddenNow[0].label}» в этом кадре не видно — подвинь плейхед</div>
          )}
        </div>
      </div>
      <div class="stage-foot">
        {!hasScenes.value && deck.value ? (
          <PromptHint id={deck.value.id} />
        ) : err ? (
          <span class="stage-err">
            <Icon name="warn" size={14} /> Сцена {slideId}: {err}
          </span>
        ) : lost.length ? (
          <span class="stage-err">
            <Icon name="warn" size={14} /> Сцена {slideId} ждёт реплики, которых нет в слайде: {lost.join(', ')}
          </span>
        ) : (
          <span class="stage-tip">Клик — выделить, тянуть — двигать, угол рамки — масштаб. Shift+клик или рамка по пустому месту — несколько объектов. Стрелки — по пикселю.</span>
        )}
        <IconBtn
          icon="fit"
          label="На весь экран (F)"
          onClick={() => void canvasRef.current?.parentElement?.requestFullscreen()}
        />
      </div>
    </main>
  );
}

/** Подсказка для ролика без сцен: что сказать ИИ-агенту. */
function PromptHint({ id }: { id: string }) {
  const text = `делай тему ${id}`;
  return (
    <span class="prompt-hint">
      Сейчас слайды рисует заглушка. Сцены сделает Claude Code или Codex — скажи в чате:
      <button
        type="button"
        class="prompt-chip"
        title="Скопировать"
        onClick={() => void navigator.clipboard.writeText(text).then(() => say('Скопировано'))}
      >
        {text} <Icon name="copy" size={12} />
      </button>
    </span>
  );
}
