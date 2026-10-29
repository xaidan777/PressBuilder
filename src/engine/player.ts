/**
 * Плеер: цикл отрисовки, воспроизведение и перемотка по времени.
 * Если у ролика есть озвучка, пока она звучит, часы плеера идут по ней —
 * картинка не убегает от голоса; до начала и после конца дорожки — по таймеру.
 */

import { onAsset } from './assets.ts';
import { drawBackground } from './background.ts';
import { Timeline } from './timeline.ts';
import { H, setStyle, W } from './theme.ts';

export class Player {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private tl: Timeline | null = null;

  time = 0;
  playing = false;
  /** Скорость воспроизведения (для отладки). */
  rate = 1;

  onTick: ((time: number, duration: number, playing: boolean) => void) | null = null;
  /** Вызывается после каждой реальной перерисовки кадра. */
  onDraw: (() => void) | null = null;

  private last = 0;
  private raf = 0;
  private dirty = true;

  private audio: HTMLAudioElement | null = null;
  private audioSrc = '';
  private audioOffset = 0;
  private muted = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D недоступен');
    this.ctx = ctx;
    this.setQuality(1);
    // догрузилась картинка сцены — кадр на паузе нужно перерисовать
    onAsset(() => this.invalidate());
  }

  get timeline(): Timeline | null {
    return this.tl;
  }

  get duration(): number {
    return this.tl?.duration ?? 0;
  }

  /** Новое расписание (правка текста, хронометража, объектов) — время сохраняется. */
  setTimeline(tl: Timeline | null): void {
    this.tl = tl;
    this.time = Math.max(0, Math.min(this.duration, this.time));
    this.dirty = true;
  }

  /** Множитель разрешения. 1 = ровно 1920×1080. */
  setQuality(q: number): void {
    // H.264 требует чётных размеров
    this.canvas.width = Math.round((W * q) / 2) * 2;
    this.canvas.height = Math.round((H * q) / 2) * 2;
    this.dirty = true;
  }

  invalidate(): void {
    this.dirty = true;
  }

  start(): void {
    cancelAnimationFrame(this.raf);
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      if (this.playing) {
        const el = this.audio;
        // озвучка звучит — время берём у неё, иначе считаем сами
        if (el && !el.paused && !el.seeking && el.readyState >= 3) this.time = el.currentTime + this.audioOffset;
        else this.time += dt * this.rate;
        this.syncAudio(false);
        if (this.time >= this.duration) {
          this.time = this.duration;
          this.playing = false;
          this.audio?.pause();
        }
        this.dirty = true;
      }
      // на паузе кадр не меняется — не перерисовываем зря
      if (this.dirty) {
        this.dirty = false;
        this.draw();
        this.onDraw?.();
      }
      this.onTick?.(this.time, this.duration, this.playing);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.audio?.pause();
  }

  play(): void {
    if (this.time >= this.duration - 0.01) this.time = 0;
    this.playing = true;
    this.syncAudio(true);
  }

  pause(): void {
    this.playing = false;
    this.syncAudio(true);
  }

  /**
   * Озвучка: файл, с какой секунды ролика звучит её начало, громкость.
   * `null` — без звука. Повторный вызов с тем же файлом только меняет сдвиг и громкость.
   */
  setAudio(src: string | null, offset = 0, volume = 1): void {
    if (!src) {
      this.audio?.pause();
      this.audio = null;
      this.audioSrc = '';
      return;
    }
    if (src !== this.audioSrc || !this.audio) {
      this.audio?.pause();
      this.audio = new Audio(src);
      this.audio.preload = 'auto';
      this.audioSrc = src;
    }
    this.audioOffset = offset;
    this.audio.volume = Math.max(0, Math.min(1, volume));
    this.audio.muted = this.muted;
    this.syncAudio(true);
  }

  /** Выключить звук в редакторе (в MP4 озвучка всё равно попадёт). */
  setMuted(m: boolean): void {
    this.muted = m;
    if (this.audio) this.audio.muted = m;
  }

  /** Держит дорожку в такт: запускает, когда плейхед вошёл в неё, гасит на паузе и за её концом. */
  private syncAudio(hard: boolean): void {
    const el = this.audio;
    if (!el) return;
    const at = this.time - this.audioOffset;
    const inside = at >= 0 && (!Number.isFinite(el.duration) || at < el.duration - 0.02);
    if (!this.playing || !inside) {
      if (!el.paused) el.pause();
      return;
    }
    el.playbackRate = this.rate;
    if (el.paused) {
      el.currentTime = at;
      void el.play().catch(() => {
        /* браузер не дал играть без жеста пользователя — картинка идёт без звука */
      });
    } else if (hard || Math.abs(el.currentTime - at) > 0.3) {
      el.currentTime = at;
    }
  }

  toggle(): void {
    this.playing ? this.pause() : this.play();
  }

  seek(t: number): void {
    this.time = Math.max(0, Math.min(this.duration, t));
    this.dirty = true;
    if (this.playing) this.syncAudio(true);
  }

  /** Детерминированный кадр: одно и то же время — одна и та же картинка. */
  draw(): void {
    const ctx = this.ctx;
    const sx = this.canvas.width / W;
    const sy = this.canvas.height / H;
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    ctx.globalAlpha = 1;
    // стиль ролика — до фона: фон у каждого стиля свой
    if (this.tl) setStyle(this.tl.deck.style);
    drawBackground(ctx, this.time, this.tl?.energyAt(this.time) ?? 0);
    this.tl?.render(ctx, this.time);
  }
}
