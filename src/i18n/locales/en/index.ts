// English language pack — shape is enforced against the zh source of truth.
import type { zh } from '../zh';
import * as core from './core';
import * as auth from './auth';
import * as home from './home';
import * as aiPractice from './aiPractice';
import * as reading from './reading';
import * as listening from './listening';
import * as speaking from './speaking';
import * as writing from './writing';
import * as writingAi from './writingAi';
import * as settings from './settings';
import * as profile from './profile';
import * as store from './store';
import * as analytics from './analytics';
import * as assistant from './assistant';
import * as vocab from './vocab';

export const en: typeof zh = {
  ...core,
  ...auth,
  ...home,
  ...aiPractice,
  ...reading,
  ...listening,
  ...speaking,
  ...writing,
  ...writingAi,
  ...settings,
  ...profile,
  ...store,
  ...analytics,
  ...assistant,
  ...vocab,
};
