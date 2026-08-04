// i18next type augmentation - gives t('mock.config.title') key completion plus compile-time checking.
// resources.translation reuses the type source of truth, Translations (= typeof zh), so migrating to the
// functional t() keeps the core guarantee of the original in-house system: a missing key is a compile error.
import 'i18next';
import type { Translations } from './translations';

declare module 'i18next' {
    interface CustomTypeOptions {
        defaultNS: 'translation';
        resources: {
            translation: Translations;
        };
        returnNull: false;
    }
}
