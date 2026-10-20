/**
 * Ролик «Game-Ready 3D модели с помощью AI» — порядок сцен.
 * Слайд = раздел текста автора. Модели — реальные ассеты игры DULO (dulo.ts).
 * Новая сцена = новый файл рядом + одна строка в этом массиве.
 */

import type { SceneDef } from '../../engine/types.ts';
import { scene01 } from './s01_hello.ts';
import { scene02 } from './s02_beauty.ts';
import { scene03 } from './s03_plan.ts';
import { scene04 } from './s04_tools.ts';
import { scene05 } from './s05_refs.ts';
import { scene06 } from './s06_views.ts';
import { scene07 } from './s07_iso.ts';
import { scene08 } from './s08_quad.ts';
import { scene09 } from './s09_loops.ts';
import { scene10 } from './s10_blender.ts';
import { scene11 } from './s11_task.ts';
import { scene12 } from './s12_lod.ts';
import { scene13 } from './s13_perf.ts';
import { scene14 } from './s14_scratch.ts';
import { scene15 } from './s15_ref3d.ts';
import { scene16 } from './s16_rig.ts';
import { scene17 } from './s17_weights.ts';
import { scene18 } from './s18_videoref.ts';
import { scene19 } from './s19_frames.ts';
import { scene20 } from './s20_outro.ts';

export const SCENES: SceneDef[] = [
  // Вступление
  scene01,
  scene02,
  scene03,
  // Генераторы и референсы
  scene04,
  scene05,
  scene06,
  scene07,
  // Топология
  scene08,
  scene09,
  // Blender и Claude Code
  scene10,
  scene11,
  // LOD и оптимизация
  scene12,
  scene13,
  // Моделирование без генератора
  scene14,
  scene15,
  // Риг и анимация
  scene16,
  scene17,
  scene18,
  scene19,
  // Итог
  scene20,
];
