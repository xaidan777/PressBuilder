/** Запросы редактора к дев-серверу (`server/plugin.ts`). */

import type { DeckData } from '../engine/types.ts';

export interface DeckMeta {
  id: string;
  title: string;
  slides: number;
  target: number | null;
  /** У ролика уже есть код сцен (src/decks/<id>/index.ts). */
  hasScenes: boolean;
  mtime: number;
}

export interface ServerConfig {
  ffmpeg: string;
  ffmpegOk: boolean;
}

/** Метка вкладки: сервер не присылает ей эхо её же сохранений. */
export const CLIENT_ID = Math.random().toString(36).slice(2);

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error((await res.text()) || `${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

const body = (data: unknown): RequestInit => ({
  headers: { 'Content-Type': 'application/json', 'X-PB-Client': CLIENT_ID },
  body: JSON.stringify(data),
});

export const api = {
  listDecks: () => call<DeckMeta[]>('/api/decks'),
  getDeck: (id: string) => call<DeckData>(`/api/decks/${id}`),
  createDeck: (deck: DeckData) => call<{ ok: true }>('/api/decks', { method: 'POST', ...body(deck) }),
  saveDeck: (deck: DeckData, keepalive = false) =>
    call<{ ok: true }>(`/api/decks/${deck.id}`, { method: 'PUT', keepalive, ...body(deck) }),
  deleteDeck: (id: string) => call<{ ok: true }>(`/api/decks/${id}`, { method: 'DELETE' }),
  getConfig: () => call<ServerConfig>('/api/config'),
  setConfig: (cfg: { ffmpeg: string }) => call<ServerConfig>('/api/config', { method: 'PUT', ...body(cfg) }),
  /** Озвучка ролика: файл уходит в src/decks/<id>/voice.<ext>, в ответе — имя файла. */
  uploadAudio: (id: string, file: File) =>
    call<{ file: string; size: number }>(`/api/decks/${id}/audio?name=${encodeURIComponent(file.name)}`, {
      method: 'PUT',
      body: file,
    }),
  reveal: (file: string) => call<{ ok: true }>(`/api/reveal?file=${encodeURIComponent(file)}`, { method: 'POST' }),
};
