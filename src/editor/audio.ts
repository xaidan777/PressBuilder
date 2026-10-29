/** Озвучка в редакторе: длительность и «пики» громкости файла — для волны на таймлайне. */

export interface AudioInfo {
  src: string;
  /** Длительность дорожки, сек. */
  duration: number;
  /** Пик громкости 0..1 на каждый отрезок 1/`rate` сек (нормирован по самому громкому месту). */
  peaks: Float32Array;
  rate: number;
}

/** Пиков на секунду: хватает и для общего вида, и для крупного масштаба таймлайна. */
const RATE = 100;

export async function loadPeaks(src: string): Promise<AudioInfo> {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`${res.status}`);
  return decodePeaks(src, await res.arrayBuffer());
}

/** То же для файла, который ещё не загружен на сервер (окно «Новая тема»). */
export async function filePeaks(file: File): Promise<AudioInfo> {
  return decodePeaks(file.name, await file.arrayBuffer());
}

async function decodePeaks(src: string, data: ArrayBuffer): Promise<AudioInfo> {
  // OfflineAudioContext декодирует файл без жеста пользователя и без вывода звука
  const buf = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(data);
  const n = Math.max(1, Math.ceil(buf.duration * RATE));
  const peaks = new Float32Array(n);
  const step = buf.sampleRate / RATE;
  for (let ch = 0; ch < Math.min(2, buf.numberOfChannels); ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) {
      const end = Math.min(data.length, Math.floor((i + 1) * step));
      let m = peaks[i];
      for (let j = Math.floor(i * step); j < end; j += 3) {
        const v = data[j] < 0 ? -data[j] : data[j];
        if (v > m) m = v;
      }
      peaks[i] = m;
    }
  }
  let max = 0;
  for (const v of peaks) if (v > max) max = v;
  if (max > 0) for (let i = 0; i < n; i++) peaks[i] /= max;
  return { src, duration: buf.duration, peaks, rate: RATE };
}

/**
 * Волна видимого куска дорожки: `t0` — с какой секунды дорожки начинается холст,
 * `pps` — пикселей на секунду таймлайна.
 */
export function drawWave(canvas: HTMLCanvasElement, info: AudioInfo, t0: number, pps: number, color: string): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = canvas.width / Math.max(1, canvas.clientWidth || canvas.width);
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = color;
  const mid = h / 2;
  for (let x = 0; x < w; x++) {
    const a = t0 + x / dpr / pps;
    const b = t0 + (x + 1) / dpr / pps;
    const i0 = Math.max(0, Math.floor(a * info.rate));
    const i1 = Math.min(info.peaks.length, Math.max(i0 + 1, Math.ceil(b * info.rate)));
    let m = 0;
    for (let i = i0; i < i1; i++) if (info.peaks[i] > m) m = info.peaks[i];
    const bh = Math.max(1, m * (h - 4));
    ctx.fillRect(x, mid - bh / 2, 1, bh);
  }
}
