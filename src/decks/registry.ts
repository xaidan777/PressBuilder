/**
 * Код сцен роликов. Данные ролика (deck.json) редактор берёт с сервера,
 * а сцены — отсюда: `src/decks/<id>/index.ts` экспортирует `SCENES: SceneDef[]`,
 * сцена привязывается к слайду по `id`. Слайды без сцены рисует заглушка движка.
 */

import type { SceneDef } from '../engine/types.ts';

const loaders = import.meta.glob<{ SCENES: SceneDef[] }>('./*/index.ts');

export async function loadScenes(deckId: string): Promise<Map<string, SceneDef>> {
  const load = loaders[`./${deckId}/index.ts`];
  if (!load) return new Map();
  const mod = await load();
  return new Map((mod.SCENES ?? []).map((s) => [s.id, s]));
}

// Сцену поправили (или Claude дописал новую) — редактор подхватывает код без
// перезагрузки страницы и не теряет ни позицию, ни выделение.
if (import.meta.hot) {
  import.meta.hot.accept((next) => {
    if (next) window.dispatchEvent(new CustomEvent('pb:scenes', { detail: next.loadScenes }));
  });
}
