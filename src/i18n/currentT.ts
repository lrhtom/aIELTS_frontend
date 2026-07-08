import { translations, type Translations } from './translations';

/**
 * Non-hook access to the current language pack for modules outside the React
 * tree (api clients, interceptors). Mirrors LanguageContext's default: explicit
 * localStorage choice wins, otherwise English.
 *
 * Note: values read here are snapshots — call at message-build time, not at
 * module load, so a language switch is picked up on the next call.
 */
export function currentT(): Translations {
    return translations[localStorage.getItem('ielts_lang') === 'zh' ? 'zh' : 'en'];
}
