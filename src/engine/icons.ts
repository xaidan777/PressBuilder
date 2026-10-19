/**
 * Векторные иконки, нарисованные кодом (без внешних ассетов).
 * Каждая рисуется в квадрате s×s с центром в (x, y).
 */

import { hexPath, rrPath } from './draw.ts';
import { C } from './theme.ts';

type Ctx = CanvasRenderingContext2D;
export type IconFn = (ctx: Ctx, x: number, y: number, s: number, color: string, t?: number) => void;

function begin(ctx: Ctx, x: number, y: number, s: number, color: string): number {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.6, s * 0.085);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  return s / 2;
}

const money: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.66);
  ctx.lineTo(0, r * 0.66);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r * 0.32, -r * 0.36);
  ctx.quadraticCurveTo(-r * 0.42, -r * 0.62, -r * 0.34, -r * 0.1);
  ctx.quadraticCurveTo(-r * 0.26, r * 0.12, r * 0.3, r * 0.14);
  ctx.quadraticCurveTo(r * 0.42, r * 0.42, -r * 0.32, r * 0.36);
  ctx.stroke();
  ctx.restore();
};

const clock: IconFn = (ctx, x, y, s, color, t = 0) => {
  const r = begin(ctx, x, y, s, color);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
  ctx.stroke();
  const a1 = -Math.PI / 2 + t * 0.9;
  const a2 = -Math.PI / 2 + t * 0.14;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(a1) * r * 0.6, Math.sin(a1) * r * 0.6);
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(a2) * r * 0.4, Math.sin(a2) * r * 0.4);
  ctx.stroke();
  ctx.restore();
};

const calendar: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  rrPath(ctx, -r * 0.9, -r * 0.72, r * 1.8, r * 1.6, r * 0.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.9, -r * 0.24);
  ctx.lineTo(r * 0.9, -r * 0.24);
  ctx.moveTo(-r * 0.45, -r * 1.0);
  ctx.lineTo(-r * 0.45, -r * 0.5);
  ctx.moveTo(r * 0.45, -r * 1.0);
  ctx.lineTo(r * 0.45, -r * 0.5);
  ctx.stroke();
  ctx.fillRect(-r * 0.58, r * 0.08, r * 0.34, r * 0.3);
  ctx.fillRect(r * 0.14, r * 0.08, r * 0.34, r * 0.3);
  ctx.restore();
};

const globe: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.92, 0);
  ctx.lineTo(r * 0.92, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.45, r * 0.92, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.36, r * 0.83, r * 0.3, 0, 0, Math.PI);
  ctx.stroke();
  ctx.restore();
};

const robot: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  rrPath(ctx, -r * 0.8, -r * 0.5, r * 1.6, r * 1.2, r * 0.28);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.5);
  ctx.lineTo(0, -r * 0.86);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -r * 0.96, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-r * 0.32, 0, r * 0.14, 0, Math.PI * 2);
  ctx.arc(r * 0.32, 0, r * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, r * 0.38);
  ctx.lineTo(r * 0.3, r * 0.38);
  ctx.stroke();
  ctx.restore();
};

const warning: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.92);
  ctx.lineTo(r * 0.95, r * 0.78);
  ctx.lineTo(-r * 0.95, r * 0.78);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.34);
  ctx.lineTo(0, r * 0.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, r * 0.48, r * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const chart: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  ctx.beginPath();
  ctx.moveTo(-r * 0.9, -r * 0.9);
  ctx.lineTo(-r * 0.9, r * 0.9);
  ctx.lineTo(r * 0.9, r * 0.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.6, r * 0.4);
  ctx.lineTo(-r * 0.1, -r * 0.1);
  ctx.lineTo(r * 0.25, r * 0.15);
  ctx.lineTo(r * 0.75, -r * 0.65);
  ctx.stroke();
  ctx.restore();
};

const doc: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  ctx.beginPath();
  ctx.moveTo(-r * 0.66, -r * 0.92);
  ctx.lineTo(r * 0.24, -r * 0.92);
  ctx.lineTo(r * 0.7, -r * 0.42);
  ctx.lineTo(r * 0.7, r * 0.92);
  ctx.lineTo(-r * 0.66, r * 0.92);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r * 0.2, -r * 0.92);
  ctx.lineTo(r * 0.2, -r * 0.4);
  ctx.lineTo(r * 0.7, -r * 0.4);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    ctx.moveTo(-r * 0.4, r * (0.02 + i * 0.32));
    ctx.lineTo(r * 0.44, r * (0.02 + i * 0.32));
  }
  ctx.stroke();
  ctx.restore();
};

const bug: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  ctx.beginPath();
  ctx.ellipse(0, r * 0.1, r * 0.5, r * 0.72, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  for (const sx of [-1, 1]) {
    ctx.moveTo(sx * r * 0.5, -r * 0.2);
    ctx.lineTo(sx * r * 0.95, -r * 0.5);
    ctx.moveTo(sx * r * 0.5, r * 0.15);
    ctx.lineTo(sx * r * 0.98, r * 0.15);
    ctx.moveTo(sx * r * 0.44, r * 0.5);
    ctx.lineTo(sx * r * 0.9, r * 0.8);
    ctx.moveTo(sx * r * 0.2, -r * 0.6);
    ctx.lineTo(sx * r * 0.45, -r * 0.95);
  }
  ctx.stroke();
  ctx.restore();
};

const star: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.42 : r * 0.95;
    const ang = -Math.PI / 2 + (Math.PI / 5) * i;
    const px = Math.cos(ang) * rad;
    const py = Math.sin(ang) * rad;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const chat: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  rrPath(ctx, -r * 0.9, -r * 0.8, r * 1.8, r * 1.3, r * 0.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.36, r * 0.5);
  ctx.lineTo(-r * 0.5, r * 0.95);
  ctx.lineTo(-r * 0.02, r * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-r * 0.38, -r * 0.16, r * 0.1, 0, Math.PI * 2);
  ctx.arc(0, -r * 0.16, r * 0.1, 0, Math.PI * 2);
  ctx.arc(r * 0.38, -r * 0.16, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const rocket: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.98);
  ctx.quadraticCurveTo(r * 0.55, -r * 0.2, r * 0.42, r * 0.5);
  ctx.lineTo(-r * 0.42, r * 0.5);
  ctx.quadraticCurveTo(-r * 0.55, -r * 0.2, 0, -r * 0.98);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -r * 0.26, r * 0.17, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.42, r * 0.2);
  ctx.lineTo(-r * 0.85, r * 0.72);
  ctx.lineTo(-r * 0.34, r * 0.5);
  ctx.moveTo(r * 0.42, r * 0.2);
  ctx.lineTo(r * 0.85, r * 0.72);
  ctx.lineTo(r * 0.34, r * 0.5);
  ctx.stroke();
  ctx.restore();
};

const moon: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.85, Math.PI * 0.32, Math.PI * 1.62);
  ctx.arc(-r * 0.3, -r * 0.16, r * 0.82, Math.PI * 1.5, Math.PI * 0.42, true);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
};

/** Один человек: голова и плечи. Для «команды» берите `users`. */
const personIcon: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  ctx.beginPath();
  ctx.arc(0, -r * 0.42, r * 0.34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, r * 0.92, r * 0.68, Math.PI * 1.12, Math.PI * 1.88);
  ctx.stroke();
  ctx.restore();
};

const users: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  ctx.beginPath();
  ctx.arc(-r * 0.3, -r * 0.34, r * 0.32, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(r * 0.48, -r * 0.44, r * 0.24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-r * 0.3, r * 0.98, r * 0.62, Math.PI * 1.12, Math.PI * 1.88);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(r * 0.5, r * 0.86, r * 0.46, Math.PI * 1.2, Math.PI * 1.8);
  ctx.stroke();
  ctx.restore();
};

const code: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  ctx.beginPath();
  ctx.moveTo(-r * 0.25, -r * 0.8);
  ctx.lineTo(-r * 0.85, 0);
  ctx.lineTo(-r * 0.25, r * 0.8);
  ctx.moveTo(r * 0.25, -r * 0.8);
  ctx.lineTo(r * 0.85, 0);
  ctx.lineTo(r * 0.25, r * 0.8);
  ctx.stroke();
  ctx.restore();
};

const fire: IconFn = (ctx, x, y, s, color, t = 0) => {
  const r = begin(ctx, x, y, s, color);
  const w = Math.sin(t * 4) * 0.06;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.98);
  ctx.quadraticCurveTo(r * (0.72 + w), -r * 0.2, r * 0.5, r * 0.4);
  ctx.quadraticCurveTo(r * 0.32, r * 0.95, 0, r * 0.95);
  ctx.quadraticCurveTo(-r * 0.32, r * 0.95, -r * 0.5, r * 0.4);
  ctx.quadraticCurveTo(-r * (0.62 - w), -r * 0.15, 0, -r * 0.98);
  ctx.stroke();
  ctx.restore();
};

const flag: IconFn = (ctx, x, y, s, color, t = 0) => {
  const r = begin(ctx, x, y, s, color);
  ctx.beginPath();
  ctx.moveTo(-r * 0.62, -r * 0.95);
  ctx.lineTo(-r * 0.62, r * 0.95);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.62, -r * 0.85);
  ctx.quadraticCurveTo(-r * 0.05, -r * (0.5 + Math.sin(t * 3) * 0.16), r * 0.85, -r * 0.72);
  ctx.lineTo(r * 0.85, r * 0.08);
  ctx.quadraticCurveTo(-r * 0.05, r * (0.3 + Math.sin(t * 3) * 0.14), -r * 0.62, r * 0.05);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
};

const hexIcon: IconFn = (ctx, x, y, s, color, t = 0) => {
  const r = begin(ctx, x, y, s, color);
  hexPath(ctx, 0, 0, r * 0.92, t * 0.2);
  ctx.stroke();
  hexPath(ctx, 0, 0, r * 0.46, -t * 0.3);
  ctx.stroke();
  ctx.restore();
};

const shield: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.95);
  ctx.lineTo(r * 0.78, -r * 0.6);
  ctx.lineTo(r * 0.78, r * 0.1);
  ctx.quadraticCurveTo(r * 0.7, r * 0.72, 0, r * 0.98);
  ctx.quadraticCurveTo(-r * 0.7, r * 0.72, -r * 0.78, r * 0.1);
  ctx.lineTo(-r * 0.78, -r * 0.6);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
};

const thumb: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  rrPath(ctx, -r * 0.95, -r * 0.1, r * 0.5, r * 1.0, r * 0.12);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.4, r * 0.9);
  ctx.lineTo(r * 0.5, r * 0.9);
  ctx.quadraticCurveTo(r * 0.82, r * 0.9, r * 0.86, r * 0.5);
  ctx.lineTo(r * 0.95, -r * 0.04);
  ctx.quadraticCurveTo(r * 1.0, -r * 0.32, r * 0.62, -r * 0.32);
  ctx.lineTo(r * 0.1, -r * 0.32);
  ctx.quadraticCurveTo(r * 0.02, -r * 0.36, r * 0.06, -r * 0.55);
  ctx.quadraticCurveTo(r * 0.24, -r * 1.05, -r * 0.06, -r * 0.98);
  ctx.quadraticCurveTo(-r * 0.24, -r * 0.94, -r * 0.3, -r * 0.5);
  ctx.quadraticCurveTo(-r * 0.34, -r * 0.16, -r * 0.4, -r * 0.1);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
};

const question: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -r * 0.24, r * 0.3, Math.PI * 0.95, Math.PI * 0.35);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(r * 0.02, r * 0.06);
  ctx.lineTo(0, r * 0.32);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, r * 0.6, r * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/**
 * Фирменный знак HEXSTORM: гранёный кристалл-остриё.
 * Нормирован по высоте — `s` задаёт высоту знака, ширина ≈ 0.6·s.
 * Используется везде, где на экране обозначается сама игра.
 */
const arcadia: IconFn = (ctx, x, y, s, color) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const P = (px: number, py: number): [number, number] => [px * s, py * s];
  const A = P(0, -0.5); // вершина
  const L = P(-0.298, 0.234); // левый угол
  const R = P(0.298, 0.234); // правый угол
  const B = P(0, 0.5); // нижнее остриё
  const I = P(0, -0.112); // вершина внутренней грани
  const IL = P(-0.108, 0.189);
  const IR = P(0.107, 0.189);
  const IB = P(0, 0.307);

  const seg = (p1: [number, number], p2: [number, number]) => {
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
  };

  // внутренние грани — тоньше
  ctx.lineWidth = Math.max(1, s * 0.027);
  ctx.beginPath();
  seg(I, IL);
  seg(I, IR);
  seg(IL, IB);
  seg(IR, IB);
  seg(L, IL);
  seg(R, IR);
  ctx.stroke();

  // осевые волоски
  ctx.lineWidth = Math.max(0.8, s * 0.014);
  ctx.beginPath();
  seg(A, I);
  seg(IB, B);
  ctx.stroke();

  // внешний контур — самый жирный
  ctx.lineWidth = Math.max(1.6, s * 0.052);
  ctx.beginPath();
  ctx.moveTo(A[0], A[1]);
  ctx.lineTo(R[0], R[1]);
  ctx.lineTo(B[0], B[1]);
  ctx.lineTo(L[0], L[1]);
  ctx.closePath();
  ctx.stroke();

  ctx.restore();
};

// ---------------------------------------------------------------- платформы и соцсети

const windows: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  const g = r * 0.08;
  const q = r * 0.82;
  ctx.fillRect(-q, -q, q - g, q - g);
  ctx.fillRect(g, -q, q - g, q - g);
  ctx.fillRect(-q, g, q - g, q - g);
  ctx.fillRect(g, g, q - g, q - g);
  ctx.restore();
};

const apple: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.42);
  ctx.bezierCurveTo(-r * 0.3, -r * 0.72, -r * 0.95, -r * 0.5, -r * 0.82, r * 0.12);
  ctx.bezierCurveTo(-r * 0.74, r * 0.6, -r * 0.36, r * 0.98, -r * 0.06, r * 0.82);
  ctx.bezierCurveTo(r * 0.1, r * 0.74, r * 0.16, r * 0.74, r * 0.32, r * 0.84);
  ctx.bezierCurveTo(r * 0.62, r * 0.98, r * 0.9, r * 0.5, r * 0.84, r * 0.06);
  ctx.bezierCurveTo(r * 0.72, -r * 0.54, r * 0.28, -r * 0.7, 0, -r * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(r * 0.06, -r * 0.52);
  ctx.bezierCurveTo(r * 0.1, -r * 0.86, r * 0.4, -r * 0.98, r * 0.44, -r * 0.98);
  ctx.bezierCurveTo(r * 0.5, -r * 0.66, r * 0.26, -r * 0.46, r * 0.06, -r * 0.52);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const steam: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.94, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(r * 0.28, -r * 0.3, r * 0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-r * 0.34, r * 0.36, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-r * 0.34, r * 0.36);
  ctx.lineTo(r * 0.28, -r * 0.3);
  ctx.stroke();
  ctx.restore();
};

const gift: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  rrPath(ctx, -r * 0.86, -r * 0.36, r * 1.72, r * 1.26, r * 0.12);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.95, -r * 0.36);
  ctx.lineTo(r * 0.95, -r * 0.36);
  ctx.moveTo(0, -r * 0.36);
  ctx.lineTo(0, r * 0.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.4);
  ctx.bezierCurveTo(-r * 0.1, -r * 0.95, -r * 0.72, -r * 0.95, -r * 0.5, -r * 0.5);
  ctx.moveTo(0, -r * 0.4);
  ctx.bezierCurveTo(r * 0.1, -r * 0.95, r * 0.72, -r * 0.95, r * 0.5, -r * 0.5);
  ctx.stroke();
  ctx.restore();
};

const wrench: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  ctx.beginPath();
  ctx.moveTo(-r * 0.75, r * 0.75);
  ctx.lineTo(r * 0.1, -r * 0.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(r * 0.42, -r * 0.42, r * 0.46, Math.PI * 0.72, Math.PI * 0.34);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-r * 0.72, r * 0.72, r * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const heart: IconFn = (ctx, x, y, s, color, t = 0) => {
  const r = begin(ctx, x, y, s, color) * (1 + Math.sin(t * 3.4) * 0.05);
  ctx.beginPath();
  ctx.moveTo(0, r * 0.86);
  ctx.bezierCurveTo(-r * 1.2, r * 0.06, -r * 0.62, -r * 0.98, 0, -r * 0.32);
  ctx.bezierCurveTo(r * 0.62, -r * 0.98, r * 1.2, r * 0.06, 0, r * 0.86);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const youtube: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  rrPath(ctx, -r * 0.95, -r * 0.66, r * 1.9, r * 1.32, r * 0.34);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.16, -r * 0.32);
  ctx.lineTo(r * 0.36, 0);
  ctx.lineTo(-r * 0.16, r * 0.32);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const telegram: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  ctx.beginPath();
  ctx.moveTo(-r * 0.92, -r * 0.16);
  ctx.lineTo(r * 0.92, -r * 0.86);
  ctx.lineTo(r * 0.44, r * 0.88);
  ctx.lineTo(-r * 0.04, r * 0.3);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.04, r * 0.3);
  ctx.lineTo(r * 0.92, -r * 0.86);
  ctx.moveTo(-r * 0.04, r * 0.3);
  ctx.lineTo(-r * 0.06, r * 0.86);
  ctx.stroke();
  ctx.restore();
};

const zzz: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  const z = (cx: number, cy: number, k: number) => {
    ctx.beginPath();
    ctx.moveTo(cx - k, cy - k);
    ctx.lineTo(cx + k, cy - k);
    ctx.lineTo(cx - k, cy + k);
    ctx.lineTo(cx + k, cy + k);
    ctx.stroke();
  };
  z(-r * 0.42, r * 0.5, r * 0.28);
  z(r * 0.16, -r * 0.06, r * 0.34);
  z(r * 0.66, -r * 0.6, r * 0.24);
  ctx.restore();
};

const refund: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.8, Math.PI * 0.62, Math.PI * 2.28);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.46, r * 0.28);
  ctx.lineTo(-r * 0.5, r * 0.82);
  ctx.lineTo(-r * 0.96, r * 0.52);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.4);
  ctx.lineTo(0, r * 0.4);
  ctx.stroke();
  ctx.restore();
};

const sliders: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  for (let i = 0; i < 3; i++) {
    const ly = -r * 0.62 + i * r * 0.62;
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, ly);
    ctx.lineTo(r * 0.9, ly);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-r * 0.4 + i * r * 0.52, ly, r * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.restore();
};

const eye: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  ctx.beginPath();
  ctx.moveTo(-r * 0.95, 0);
  ctx.quadraticCurveTo(0, -r * 0.8, r * 0.95, 0);
  ctx.quadraticCurveTo(0, r * 0.8, -r * 0.95, 0);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

// ---------------------------------------------------------------- файлы, инструменты, 3D

const folder: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  ctx.beginPath();
  ctx.moveTo(-r * 0.92, -r * 0.66);
  ctx.lineTo(-r * 0.3, -r * 0.66);
  ctx.lineTo(-r * 0.08, -r * 0.38);
  ctx.lineTo(r * 0.92, -r * 0.38);
  ctx.lineTo(r * 0.92, r * 0.74);
  ctx.lineTo(-r * 0.92, r * 0.74);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.92, -r * 0.06);
  ctx.lineTo(r * 0.92, -r * 0.06);
  ctx.stroke();
  ctx.restore();
};

const download: IconFn = (ctx, x, y, s, color, t = 0) => {
  const r = begin(ctx, x, y, s, color);
  // стрелка мягко «ныряет» в лоток
  const dy = Math.sin(t * 3.2) * r * 0.08;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.92 + dy);
  ctx.lineTo(0, r * 0.3 + dy);
  ctx.moveTo(-r * 0.44, -r * 0.14 + dy);
  ctx.lineTo(0, r * 0.32 + dy);
  ctx.lineTo(r * 0.44, -r * 0.14 + dy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.88, r * 0.42);
  ctx.lineTo(-r * 0.88, r * 0.88);
  ctx.lineTo(r * 0.88, r * 0.88);
  ctx.lineTo(r * 0.88, r * 0.42);
  ctx.stroke();
  ctx.restore();
};

const check: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  ctx.lineWidth *= 1.5;
  ctx.beginPath();
  ctx.moveTo(-r * 0.72, r * 0.04);
  ctx.lineTo(-r * 0.22, r * 0.56);
  ctx.lineTo(r * 0.76, -r * 0.52);
  ctx.stroke();
  ctx.restore();
};

const bolt: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  ctx.beginPath();
  ctx.moveTo(r * 0.22, -r * 0.98);
  ctx.lineTo(-r * 0.62, r * 0.14);
  ctx.lineTo(-r * 0.06, r * 0.14);
  ctx.lineTo(-r * 0.26, r * 0.98);
  ctx.lineTo(r * 0.62, -r * 0.2);
  ctx.lineTo(r * 0.04, -r * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const play: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.26, -r * 0.44);
  ctx.lineTo(r * 0.5, 0);
  ctx.lineTo(-r * 0.26, r * 0.44);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const crosshair: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const ang = (Math.PI / 2) * i;
    ctx.moveTo(Math.cos(ang) * r * 0.36, Math.sin(ang) * r * 0.36);
    ctx.lineTo(Math.cos(ang) * r * 0.98, Math.sin(ang) * r * 0.98);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const plug: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color);
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, -r * 0.95);
  ctx.lineTo(-r * 0.3, -r * 0.42);
  ctx.moveTo(r * 0.3, -r * 0.95);
  ctx.lineTo(r * 0.3, -r * 0.42);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.66, -r * 0.42);
  ctx.lineTo(r * 0.66, -r * 0.42);
  ctx.lineTo(r * 0.66, -r * 0.02);
  ctx.quadraticCurveTo(r * 0.62, r * 0.5, 0, r * 0.52);
  ctx.quadraticCurveTo(-r * 0.62, r * 0.5, -r * 0.66, -r * 0.02);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, r * 0.52);
  ctx.lineTo(0, r * 0.98);
  ctx.stroke();
  ctx.restore();
};

/** Куб в изометрии: шестиугольный контур и три ребра из центра. */
const cube: IconFn = (ctx, x, y, s, color) => {
  const r = begin(ctx, x, y, s, color) * 0.94;
  const v = (k: number): [number, number] => {
    const ang = -Math.PI / 2 + (Math.PI / 3) * k;
    return [Math.cos(ang) * r, Math.sin(ang) * r];
  };
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const [px, py] = v(k);
    k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  for (const k of [1, 3, 5]) {
    const [px, py] = v(k);
    ctx.moveTo(0, 0);
    ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
};

/** Стрелка-указатель мыши. Остриё — в точке (x, y). */
const cursor: IconFn = (ctx, x, y, s, color) => {
  begin(ctx, x, y, s, color);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, s * 0.78);
  ctx.lineTo(s * 0.2, s * 0.6);
  ctx.lineTo(s * 0.34, s * 0.94);
  ctx.lineTo(s * 0.47, s * 0.88);
  ctx.lineTo(s * 0.33, s * 0.55);
  ctx.lineTo(s * 0.58, s * 0.53);
  ctx.closePath();
  ctx.lineWidth = Math.max(2, s * 0.07);
  ctx.strokeStyle = C.bg;
  ctx.stroke();
  ctx.fill();
  ctx.restore();
};

export const ICONS: Record<string, IconFn> = {
  folder,
  download,
  check,
  bolt,
  play,
  crosshair,
  plug,
  cube,
  cursor,
  arcadia,
  person: personIcon,
  windows,
  apple,
  steam,
  gift,
  wrench,
  heart,
  youtube,
  telegram,
  zzz,
  refund,
  sliders,
  eye,
  money,
  clock,
  calendar,
  globe,
  robot,
  warning,
  chart,
  doc,
  bug,
  star,
  chat,
  rocket,
  moon,
  users,
  code,
  fire,
  flag,
  hex: hexIcon,
  shield,
  thumb,
  question,
};

export function icon(
  ctx: Ctx,
  name: keyof typeof ICONS | string,
  x: number,
  y: number,
  size: number,
  color: string = C.h1,
  t = 0,
): void {
  const fn = ICONS[name];
  if (fn) fn(ctx, x, y, size, color, t);
}
