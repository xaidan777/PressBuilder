import './editor/editor.css';

import { render } from 'preact';
import { App } from './editor/App.tsx';
import * as store from './editor/store.ts';
import { loadStyleFonts } from './engine/theme.ts';

/** Шрифты стилей обязательны до первой отрисовки, иначе метрики текста поедут. */
async function loadFonts(): Promise<void> {
  try {
    await loadStyleFonts();
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
