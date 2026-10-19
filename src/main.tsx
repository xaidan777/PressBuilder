import './editor/editor.css';

import { render } from 'preact';
import { App } from './editor/App.tsx';
import * as store from './editor/store.ts';
import { DISPLAY_FAMILY } from './engine/theme.ts';

/** Шрифт обязателен до первой отрисовки, иначе метрики текста поедут. */
async function loadFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(`700 120px "${DISPLAY_FAMILY}"`),
      document.fonts.load(`small-caps 700 120px "${DISPLAY_FAMILY}"`),
    ]);
    await document.fonts.ready;
  } catch {
    /* шрифт не загрузился — рисуем системным */
  }
}

// для отладки из консоли: pb.deck.value, pb.objects.value, pb.seek(42); плеер — pres
(window as unknown as { pb: typeof store }).pb = store;

void loadFonts().then(async () => {
  await store.boot();
  render(<App />, document.getElementById('app')!);
});
