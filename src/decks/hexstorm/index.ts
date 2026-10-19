/**
 * Порядок сцен презентации.
 * Новая сцена = новый файл рядом + одна строка в этом массиве.
 */

import type { SceneDef } from '../../engine/types.ts';
import { scene01 } from './s01_launch.ts';
import { scene02 } from './s02_spike.ts';
import { scene03 } from './s03_reaction.ts';
import { scene04 } from './s04_agenda.ts';
import { scene05 } from './s05_author.ts';
import { scene06 } from './s06_aicode.ts';
import { scene07 } from './s07_stack.ts';
import { scene08 } from './s08_hours.ts';
import { scene09 } from './s09_experiment.ts';
import { scene10 } from './s10_next.ts';
import { scene11 } from './s11_lesson.ts';
import { scene12 } from './s12_delay.ts';
import { scene13 } from './s13_calendar.ts';
import { scene14 } from './s14_release.ts';
import { scene15 } from './s15_firstreviews.ts';
import { scene16 } from './s16_refunds.ts';
import { scene17 } from './s17_platforms.ts';
import { scene18 } from './s18_difficulty.ts';
import { scene19 } from './s19_slider.ts';
import { scene20 } from './s20_crash.ts';
import { scene21 } from './s21_bombing.ts';
import { scene22 } from './s22_flashmob.ts';
import { scene23 } from './s23_gift.ts';
import { scene24 } from './s24_recovery.ts';
import { scene25 } from './s25_feelings.ts';
import { scene26 } from './s26_thanks.ts';
import { scene27 } from './s27_money.ts';
import { scene28 } from './s28_price.ts';
import { scene29 } from './s29_secondspike.ts';
import { scene30 } from './s30_recalc.ts';
import { scene31 } from './s31_proud.ts';
import { scene32 } from './s32_plateau.ts';
import { scene33 } from './s33_forecast.ts';
import { scene34 } from './s34_answer.ts';
import { scene35 } from './s35_wall.ts';
import { scene36 } from './s36_outro.ts';

export const SCENES: SceneDef[] = [
  // Часть 1 — интрига и знакомство
  scene01,
  scene02,
  scene03,
  scene04,
  scene05,
  scene06,
  scene07,
  scene08,
  scene09,
  scene10,
  // Часть 2 — публикация в Steam
  scene11,
  scene12,
  scene13,
  scene14,
  scene15,
  scene16,
  scene17,
  scene18,
  scene19,
  scene20,
  scene21,
  scene22,
  scene23,
  scene24,
  scene25,
  scene26,
  // Часть 3 — деньги, перерасчёт и выводы
  scene27,
  scene28,
  scene29,
  scene30,
  scene31,
  scene32,
  scene33,
  scene34,
  scene35,
  scene36,
];
