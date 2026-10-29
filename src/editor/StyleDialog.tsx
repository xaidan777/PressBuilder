/** Смена стиля открытого ролика: тот же выбор пресета, что и при создании темы. */

import { useState } from 'preact/hooks';
import { screenText } from '../engine/placeholder.ts';
import { styleById } from '../engine/styles.ts';
import { SAMPLE_FALLBACK } from './DeckDialog.tsx';
import { deck, hasScenes, say, update } from './store.ts';
import { StylePicker } from './StylePicker.tsx';
import { Dialog, Icon } from './ui.tsx';

export function StyleDialog({ onClose }: { onClose(): void }) {
  const d = deck.peek();
  const was = styleById(d?.style).id;
  const [style, setStyle] = useState(was);
  const first = d?.slides[0]?.cues[0];
  const sample = {
    title: d?.title.trim() || SAMPLE_FALLBACK.title,
    line: (first && screenText(first.show ?? first.say)) || SAMPLE_FALLBACK.line,
  };

  const apply = () => {
    if (style !== was) {
      update((x) => void (x.style = style));
      say(`Стиль ролика — «${styleById(style).name}»`);
    }
    onClose();
  };

  return (
    <Dialog
      title="Стиль ролика"
      wide
      onClose={onClose}
      footer={
        <>
          <button type="button" class="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="button" class="btn is-primary" onClick={apply}>
            Применить
          </button>
        </>
      }
    >
      {hasScenes.value && (
        <p class="notice is-warn">
          <Icon name="warn" size={14} />
          Сцены ролика верстались под «{styleById(was).name}». Цвета и шрифты сменятся сами, но длинные строки
          в другом шрифте могут лечь иначе — пройди слайды глазами. Отменить можно через Ctrl+Z.
        </p>
      )}
      <StylePicker value={style} onChange={setStyle} sample={sample} />
    </Dialog>
  );
}
