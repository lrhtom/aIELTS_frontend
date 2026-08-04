import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { type Lang } from './translations';
import i18n from './i18next';

interface LanguageContextValue {
    lang: Lang;
    /** Functional i18next lookup: t('mock.config.title'). */
    t: TFunction<'translation'>;
    setLang: (lang: Lang, syncToServer?: boolean) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
    lang: 'en',
    t: i18n.getFixedT('en', 'translation'),
    setLang: () => { },
});

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [lang, setLangState] = useState<Lang>(() => {
        // Priority for unauthenticated visitors:
        //   1. Explicit user choice (localStorage) — sticks across sessions.
        //   2. Default English — unlogged visitors always see the English UI
        //      first; Chinese browsers can flip via the language toggle.
        // Once a logged-in user's profile hydrates, AuthContext calls setLang()
        // with their saved server preference and overrides this default.
        const saved = localStorage.getItem('ielts_lang');
        if (saved === 'zh' || saved === 'en') return saved;
        return 'en';
    });

    const setLang = (newLang: Lang, syncToServer = true) => {
        setLangState(newLang);
        // Keep the i18next engine's active language in sync (for any non-React
        // reads via i18n.t / getFixedT that omit an explicit lng). React
        // re-rendering itself is driven by the `lang` state above, not by this.
        void i18n.changeLanguage(newLang);
        localStorage.setItem('ielts_lang', newLang);

        // Server-side sync is best-effort: the non-httpOnly `aielts_csrf` cookie
        // is the cheapest signal of "user is logged in" we have client-side now
        // that JWTs live in httpOnly cookies. If the cookie is absent we skip
        // the call to avoid burning a guaranteed 401 on every guest visitor.
        if (syncToServer && document.cookie.includes('aielts_csrf=')) {
            import('../api/client').then(({ apiClient }) => {
                apiClient.put('/auth/settings', { language_preference: newLang }).catch(console.error);
            });
        }
    };

    // New function-style accessor, re-derived on each language switch.
    const t = useMemo(() => i18n.getFixedT(lang, 'translation'), [lang]);

    // Sync html lang attribute for accessibility
    useEffect(() => {
        document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    }, [lang]);

    return (
        <LanguageContext.Provider value={{ lang, t, setLang }}>
            {children}
        </LanguageContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLang() {
    return useContext(LanguageContext);
}
