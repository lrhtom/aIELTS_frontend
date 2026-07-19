import i18n from './i18next';
import type { TFunction } from 'i18next';

/**
 * Non-hook access to the current-language i18next `t` for modules outside the
 * React tree (api clients, interceptors). Mirrors LanguageContext's default:
 * explicit localStorage choice wins, otherwise English.
 *
 * The returned function is a snapshot bound to the language at call time — call
 * at message-build time, not at module load, so a language switch is picked up
 * on the next call. Usage: currentT()('billing.insufficientBalance').
 */
export function currentT(): TFunction<'translation'> {
    return i18n.getFixedT(localStorage.getItem('ielts_lang') === 'zh' ? 'zh' : 'en', 'translation');
}
