/** Плеер: цикл отрисовки, воспроизведение и перемотка по времени. */

import { drawBackground } from './background.ts';
import { Timeline } from './timeline.ts';
import { H, W } from './theme.ts';

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

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D недоступен');
    this.ctx = ctx;
    this.setQuality(1);
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
        this.time += dt * this.rate;
        if (this.time >= this.duration) {
          this.time = this.duration;
          this.playing = false;
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
  }

  play(): void {
    if (this.time >= this.duration - 0.01) this.time = 0;
    this.playing = true;
  }

  pause(): void {
    this.playing = false;
  }

  toggle(): void {
    this.playing ? this.pause() : this.play();
  }

  seek(t: number): void {
    this.time = Math.max(0, Math.min(this.duration, t));
    this.dirty = true;
  }

  /** Детерминированный кадр: одно и то же время — одна и та же картинка. */
  draw(): void {
    const ctx = this.ctx;
    const sx = this.canvas.width / W;
    const sy = this.canvas.height / H;
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    ctx.globalAlpha = 1;
    drawBackground(ctx, this.time, this.tl?.energyAt(this.time) ?? 0);
    this.tl?.render(ctx, this.time);
  }
}
