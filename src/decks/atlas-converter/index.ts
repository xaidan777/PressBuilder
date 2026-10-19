/**
 * Ролик «Atlas Converter» — сцены по слайдам deck.json.
 * Новая сцена = новый файл рядом + одна строка в этом массиве.
 */

import type { SceneDef } from '../../engine/types.ts';
import { scene01 } from './s01_meet.ts';
import { scene02 } from './s02_atlas.ts';
import { scene03 } from './s03_batch.ts';
import { scene04 } from './s04_window.ts';

export const SCENES: SceneDef[] = [scene01, scene02, scene03, scene04];
