// The i18next engine instance (bare i18next, without react-i18next).
//
// Design notes:
// - React's reactive rendering stays with LanguageContext: switching language changes the Context's `lang`
//   state, which triggers a re-render, and useLang() fetches getFixedT(lang) again from it. i18next's own
//   changeLanguage does not trigger a React re-render - which is exactly what makes bare i18next workable in
//   React: rendering stays with the Context and the translation engine (interpolation, plurals, fallbacks) goes to i18next.
// - The copy still comes from the existing zh / en trees assembled in locales/<lang>/index.ts, mounted whole under
//   the single namespace 'translation', with key paths mapping 1:1 onto the old property access paths (mock.config.title).
// - Type safety comes from the CustomTypeOptions augmentation in i18next.d.ts (resources.translation =
//   typeof zh), so t('mock.config.title') still completes and a mistyped key still fails to compile.
import i18n from 'i18next';
import { zh } from './locales/zh';
import { en } from './locales/en';
import type { Lang } from './translations';

const saved = localStorage.getItem('ielts_lang');
const initialLng: Lang = saved === 'zh' ? 'zh' : 'en';

// initImmediate: false -> inline resources load synchronously, so getFixedT works right after the import with no await.
void i18n.init({
    lng: initialLng,
    fallbackLng: 'en',
    resources: {
        zh: { translation: zh },
        en: { translation: en },
    },
    defaultNS: 'translation',
    keySeparator: '.',
    nsSeparator: false, // A single namespace with no ':' in the keys, so disabling ns prefix parsing is safer
    returnNull: false,
    returnEmptyString: false,
    returnObjects: true, // array and object leaves (config.rules.items, for example) are returned as-is
    initAsync: false, // v26: formerly initImmediate:false - inline resources load synchronously
    interpolation: {
        // React escapes on its own; our copy is plain text and needs no second escaping from i18next.
        escapeValue: false,
    },
});

export default i18n;
