import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import { translations, type Lang, type Translations } from './translations';

interface LanguageContextValue {
    lang: Lang;
    translations: Translations;
    setLang: (lang: Lang, syncToServer?: boolean) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
    lang: 'en',
    translations: translations.en,
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

    const t = useMemo(() => translations[lang], [lang]);

    // Sync html lang attribute for accessibility
    useEffect(() => {
        document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    }, [lang]);

    return (
        <LanguageContext.Provider value={{ lang, translations: t, setLang }}>
            {children}
        </LanguageContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLang() {
    return useContext(LanguageContext);
}
