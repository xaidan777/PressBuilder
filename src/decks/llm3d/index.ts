/**
 * Ролик «3D-движок для LLM-кодинга» — порядок сцен.
 * Новая сцена = новый файл рядом + одна строка в этом массиве.
 */

import type { SceneDef } from '../../engine/types.ts';
import { scene01 } from './s01_hello.ts';
import { scene02 } from './s02_race.ts';
import { scene03 } from './s03_idea.ts';
import { scene04 } from './s04_kit.ts';
import { scene05 } from './s05_market.ts';
import { scene06 } from './s06_reverse.ts';
import { scene07 } from './s07_stack.ts';
import { scene08 } from './s08_editor.ts';
import { scene09 } from './s09_junior.ts';
import { scene10 } from './s10_remake.ts';
import { scene11 } from './s11_realism.ts';
import { scene12 } from './s12_attempts.ts';
import { scene13 } from './s13_howto.ts';
import { scene14 } from './s14_box.ts';
import { scene15 } from './s15_free.ts';
import { scene16 } from './s16_support.ts';
import { scene17 } from './s17_outro.ts';

export const SCENES: SceneDef[] = [
  // Зачем это всё
  scene01,
  scene02,
  scene03,
  scene04,
  // Почему не Unreal / Unity / Godot и на чём собрано
  scene05,
  scene06,
  scene07,
  scene08,
  scene09,
  // Испытания
  scene10,
  scene11,
  scene12,
  // Как пользоваться и где взять
  scene13,
  scene14,
  scene15,
  scene16,
  scene17,
];
