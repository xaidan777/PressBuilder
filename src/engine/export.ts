/**
 * Покадровый экспорт презентации в поток H.264.
 *
 * Кадры считаются детерминированно (время = номер кадра / fps), кодируются
 * через WebCodecs и отправляются приёмнику в дев-сервере (`server/plugin.ts`),
 * который складывает их в элементарный поток и собирает MP4 через ffmpeg.
 *
 * Это не запись в реальном времени: просадки производительности не влияют
 * на результат, каждый кадр рисуется столько, сколько нужно.
 */

import { assetsReady } from './assets.ts';
import type { Player } from './player.ts';

export interface ExportOpts {
  /** Имя выходного файла без расширения (обычно id колоды). */
  name?: string;
  fps?: number;
  /** Битрейт видео, бит/с. */
  bitrate?: number;
  /** Адрес приёмника чанков. */
  endpoint?: string;
  /** Прогресс 0..1 и номер кадра. */
  onProgress?: (p: number, frame: number, total: number) => void;
  /** Отмена рендера. */
  signal?: AbortSignal;
  /** Кусок ролика: начало и конец, сек (по умолчанию — весь ролик). */
  from?: number;
  to?: number;
  /** Озвучка: путь «<id>/<файл>» внутри src/decks, сдвиг и громкость (см. DeckAudio). */
  audio?: { path: string; offset: number; volume: number };
}

export interface ExportResult {
  /** Путь к готовому файлу относительно проекта. */
  file: string;
  size: number;
}

/**
 * Уступка потока через MessageChannel.
 * `setTimeout(0)` в фоновой вкладке душится браузером до сотен миллисекунд —
 * на 44 тысячах кадров это часы вместо минут.
 */
const channel = new MessageChannel();
channel.port1.start();
function yieldToEncoder(): Promise<void> {
  return new Promise((resolve) => {
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(0);
  });
}

/** Кодеки от лучшего к запасному: High 5.2 → High 5.1 → Main → Baseline. */
const CODECS = ['avc1.640034', 'avc1.640033', 'avc1.4d0034', 'avc1.42E034'];

async function pickCodec(width: number, height: number, bitrate: number, framerate: number) {
  for (const codec of CODECS) {
    const cfg: VideoEncoderConfig = {
      codec,
      width,
      height,
      bitrate,
      framerate,
      avc: { format: 'annexb' },
      latencyMode: 'quality',
    };
    try {
      const { supported } = await VideoEncoder.isConfigSupported(cfg);
      if (supported) return cfg;
    } catch {
      /* пробуем следующий */
    }
  }
  throw new Error('WebCodecs: подходящий профиль H.264 не найден');
}

async function post(url: string, body?: Blob): Promise<Response> {
  const res = await fetch(url, { method: 'POST', body });
  if (!res.ok) throw new Error((await res.text()) || `${url}: ${res.status}`);
  return res;
}

export async function exportVideo(player: Player, o: ExportOpts = {}): Promise<ExportResult> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('В этом браузере нет WebCodecs — экспорт недоступен');
  }
  const fps = o.fps ?? 60;
  const bitrate = o.bitrate ?? 24_000_000;
  const endpoint = o.endpoint ?? '/api/export';
  const { canvas } = player;
  const from = Math.max(0, o.from ?? 0);
  const to = Math.min(player.duration, o.to ?? player.duration);
  const total = Math.ceil((to - from) * fps);

  // Кадры не должны крутиться сами: экспорт управляет временем вручную.
  player.pause();
  player.stop();
  // картинки сцен и шрифты — до первого кадра, иначе начало ролика уйдёт без них
  await Promise.all([assetsReady(), document.fonts.ready]);

  const name = encodeURIComponent(o.name ?? 'presentation');
  const voice = o.audio
    ? `&audio=${encodeURIComponent(o.audio.path)}&offset=${o.audio.offset}&volume=${o.audio.volume}&from=${from}&dur=${to - from}`
    : '';
  await post(`${endpoint}/start?fps=${fps}&w=${canvas.width}&h=${canvas.height}&name=${name}${voice}`);

  const cfg = await pickCodec(canvas.width, canvas.height, bitrate, fps);

  // Чанки копим в буфер и отправляем пачками — так меньше накладных расходов.
  let pending: Uint8Array[] = [];
  let pendingBytes = 0;
  let inFlight: Promise<unknown> = Promise.resolve();

  const flushPending = () => {
    if (!pendingBytes) return;
    const blob = new Blob(pending as BlobPart[]);
    pending = [];
    pendingBytes = 0;
    inFlight = inFlight.then(() => post(`${endpoint}/chunk`, blob));
  };

  let failed: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk) => {
      const buf = new Uint8Array(chunk.byteLength);
      chunk.copyTo(buf);
      pending.push(buf);
      pendingBytes += buf.byteLength;
      if (pendingBytes > 4 << 20) flushPending();
    },
    error: (e) => {
      failed = e;
    },
  });
  encoder.configure(cfg);

  const frameDur = Math.round(1_000_000 / fps);
  for (let i = 0; i < total; i++) {
    if (failed) throw failed;
    if (o.signal?.aborted) {
      encoder.close();
      await inFlight.catch(() => undefined);
      await post(`${endpoint}/cancel`).catch(() => undefined);
      throw new DOMException('Рендер отменён', 'AbortError');
    }
    player.seek(from + i / fps);
    player.draw();
    const frame = new VideoFrame(canvas, {
      timestamp: Math.round((i * 1_000_000) / fps),
      duration: frameDur,
    });
    // ключевой кадр раз в две секунды — удобно для перемотки в монтажке
    encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();

    while (encoder.encodeQueueSize > 12) await yieldToEncoder();
    if (i % 30 === 0) {
      await yieldToEncoder();
      if (i % (fps * 2) === 0) o.onProgress?.(i / total, i, total);
    }
  }

  await encoder.flush();
  encoder.close();
  flushPending();
  await inFlight;
  o.onProgress?.(1, total, total);
  // приёмник отвечает, когда ffmpeg уже собрал MP4
  const res = await post(`${endpoint}/finish`);
  return (await res.json()) as ExportResult;
}
