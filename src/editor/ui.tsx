/** Кирпичики интерфейса: иконки, меню, диалог, числовые поля. */

import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { capture, clock, parseClock } from './util.ts';

// ------------------------------------------------------------------ иконки

const ICONS = {
  play: <path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none" />,
  pause: <path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z" fill="currentColor" stroke="none" />,
  prev: <path d="M6 5v14M19 5.5v13L9 12z" />,
  next: <path d="M18 5v14M5 5.5v13L15 12z" />,
  undo: <path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />,
  redo: <path d="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  more: (
    <g fill="currentColor" stroke="none">
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
    </g>
  ),
  eye: (
    <g>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </g>
  ),
  eyeOff: <path d="M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6C3.6 8.5 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.2-1M9.9 9.9a3 3 0 0 0 4.2 4.2" />,
  reset: <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />,
  film: <path d="M4 4h16v16H4zM8 4v16M16 4v16M4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4" />,
  fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  code: <path d="m8 7-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  warn: <path d="M12 3 2 20h20zM12 10v4.5M12 17.4v.2" />,
  folder: <path d="M3 6.5h6l2 2.5h10v10.5H3z" />,
  copy: <path d="M9 9h11v11H9zM5 15H4V4h11v1" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  text: <path d="M5 6V4.5h14V6M12 4.5v15M9 19.5h6" />,
  back: <path d="M11 5l-7 7 7 7M4 12h16" />,
  pin: <path d="M9 3h6l-1 6 3 3v2H7v-2l3-3zM12 14v7" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  mic: <path d="M12 3.5a2.8 2.8 0 0 1 2.8 2.8v5a2.8 2.8 0 0 1-5.6 0v-5A2.8 2.8 0 0 1 12 3.5zM6.5 11a5.5 5.5 0 0 0 11 0M12 16.5V20.5M8.5 20.5h7" />,
  sound: <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />,
  mute: <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 9.5l5 5M21 9.5l-5 5" />,
  gear: (
    <g>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
    </g>
  ),
};

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      class="ico"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

interface IconBtnProps extends Omit<JSX.HTMLAttributes<HTMLButtonElement>, 'icon' | 'size'> {
  icon: IconName;
  label: string;
  size?: number;
  disabled?: boolean;
  active?: boolean;
}

export function IconBtn({ icon, label, size, active, class: cls, ...rest }: IconBtnProps) {
  return (
    <button
      type="button"
      class={`icon-btn ${active ? 'is-active' : ''} ${cls ?? ''}`}
      title={label}
      aria-label={label}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}

// ------------------------------------------------------------------ меню

export interface MenuItem {
  label: string;
  icon?: IconName;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect(): void;
}

/** Кнопка «⋯» с выпадающим списком действий. */
export function MenuBtn({ items, label = 'Действия' }: { items: (MenuItem | null)[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('keydown', close, true);
    return () => {
      window.removeEventListener('pointerdown', close, true);
      window.removeEventListener('keydown', close, true);
    };
  }, [open]);

  // список не должен вылезать за экран
  useLayoutEffect(() => {
    const el = pop.current;
    if (!open || !el) return;
    const r = el.getBoundingClientRect();
    if (r.bottom > innerHeight - 8) el.style.top = `${-r.height - 4}px`;
    if (r.right > innerWidth - 8) el.style.left = `${innerWidth - 8 - r.right}px`;
  }, [open]);

  return (
    <div class="menu" ref={root}>
      <IconBtn icon="more" label={label} active={open} onClick={() => setOpen(!open)} />
      {open && (
        <div class="menu-pop" ref={pop} role="menu">
          {items.map((it, i) =>
            it ? (
              <button
                key={i}
                type="button"
                role="menuitem"
                class={`menu-item ${it.danger ? 'is-danger' : ''}`}
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false);
                  it.onSelect();
                }}
              >
                {it.icon && <Icon name={it.icon} size={14} />}
                <span>{it.label}</span>
                {it.hint && <kbd>{it.hint}</kbd>}
              </button>
            ) : (
              <div key={i} class="menu-sep" />
            ),
          )}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ диалог

interface DialogProps {
  title: string;
  onClose(): void;
  children: ComponentChildren;
  footer?: ComponentChildren;
  wide?: boolean;
  /** Нельзя закрыть (идёт рендер). */
  locked?: boolean;
}

export function Dialog({ title, onClose, children, footer, wide, locked }: DialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !locked) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [locked, onClose]);

  return (
    <div class="dialog-back" onPointerDown={(e) => e.target === e.currentTarget && !locked && onClose()}>
      <div class={`dialog ${wide ? 'is-wide' : ''}`} role="dialog" aria-label={title}>
        <header class="dialog-head">
          <h2>{title}</h2>
          {!locked && <IconBtn icon="close" label="Закрыть" onClick={onClose} />}
        </header>
        <div class="dialog-body">{children}</div>
        {footer && <footer class="dialog-foot">{footer}</footer>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ поля

interface NumFieldProps {
  value: number | undefined;
  onChange(v: number | undefined): void;
  /** Что показать, когда значение не задано (значение по умолчанию). */
  placeholder?: string;
  step?: number;
  min?: number;
  max?: number;
  digits?: number;
  disabled?: boolean;
  suffix?: string;
  label?: string;
}

/**
 * Число: можно набрать, подкрутить стрелками/колесом (Shift — ×10) или протащить
 * мышью за подпись. Пустое поле = «как по умолчанию».
 */
export function NumField({ value, onChange, placeholder, step = 1, min, max, digits = 0, disabled, suffix, label }: NumFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const fix = (v: number) => {
    const k = 10 ** digits;
    let n = Math.round(v * k) / k;
    if (min !== undefined) n = Math.max(min, n);
    if (max !== undefined) n = Math.min(max, n);
    return n;
  };
  const shown = draft ?? (value === undefined ? '' : String(fix(value)));

  const commit = (s: string) => {
    setDraft(null);
    const t = s.trim().replace(',', '.');
    if (!t) return onChange(undefined);
    const n = Number(t);
    if (Number.isFinite(n)) onChange(fix(n));
  };

  const bump = (dir: number, big: boolean) => {
    const base = value ?? (Number(placeholder) || 0);
    onChange(fix(base + dir * step * (big ? 10 : 1)));
  };

  // протаскивание за подпись, как в видеоредакторах
  const drag = (e: PointerEvent) => {
    if (disabled) return;
    const el = e.currentTarget as HTMLElement;
    const x0 = e.clientX;
    const v0 = value ?? (Number(placeholder) || 0);
    capture(el, e);
    const move = (m: PointerEvent) => onChange(fix(v0 + Math.round((m.clientX - x0) / 4) * step * (m.shiftKey ? 10 : 1)));
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  };

  return (
    <label class={`num ${disabled ? 'is-disabled' : ''}`}>
      {label && (
        <span class="num-label" onPointerDown={drag} title="Потяни влево-вправо">
          {label}
        </span>
      )}
      <input
        type="text"
        inputMode="decimal"
        value={shown}
        placeholder={placeholder}
        disabled={disabled}
        onInput={(e) => setDraft(e.currentTarget.value)}
        onBlur={(e) => draft !== null && commit(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit(e.currentTarget.value);
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            setDraft(null);
            e.currentTarget.blur();
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            setDraft(null);
            bump(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey);
          }
        }}
      />
      {suffix && <span class="num-suffix">{suffix}</span>}
    </label>
  );
}

/** Поле времени «м:сс». */
export function ClockField({ value, onChange, disabled }: { value: number; onChange(v: number): void; disabled?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (s: string) => {
    setDraft(null);
    const v = parseClock(s);
    if (v !== null) onChange(v);
  };
  return (
    <input
      class="clock-field"
      type="text"
      disabled={disabled}
      value={draft ?? clock(value, Number.isInteger(value) ? 0 : 1)}
      onInput={(e) => setDraft(e.currentTarget.value)}
      onBlur={(e) => draft !== null && commit(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
    />
  );
}
