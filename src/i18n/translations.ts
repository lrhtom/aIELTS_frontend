// i18n entry point - the copy itself lives in ./locales/<lang>/<module>.ts, split by language x page
// - zh is the source of truth for types: Translations = typeof zh, and en (plus any future language) is constrained by typeof, so a missing key is a compile error
// - Adding a language: copy the locales/zh/ directory structure and translate -> add a member to the Lang union -> register one line in translations
// - Component usage (i18next): useLang() -> t('<namespace>.<key>'); non-React modules use currentT()('<key>')
// - The zh and en trees are also the source for the i18next resources (see ./i18next.ts); the translations Record below now only serves types and a few typeof uses
import { zh } from './locales/zh';
import { en } from './locales/en';

export type Lang = 'zh' | 'en';

export type Translations = typeof zh;

export const translations: Record<Lang, Translations> = { zh, en };
