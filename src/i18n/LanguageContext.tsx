import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import { translations, type Lang, type Translations } from './translations';

interface LanguageContextValue {
    lang: Lang;
    translations: Translations;
    setLang: (lang: Lang, syncToServer?: boolean) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
    lang: 'zh',
    translations: translations.zh,
    setLang: () => { },
});

function detectBrowserLang(): Lang {
    // navigator.languages is more accurate than navigator.language on multi-lang browsers.
    const candidates: string[] = [];
    if (typeof navigator !== 'undefined') {
        if (Array.isArray(navigator.languages)) candidates.push(...navigator.languages);
        if (navigator.language) candidates.push(navigator.language);
    }
    for (const tag of candidates) {
        if (typeof tag === 'string' && tag.toLowerCase().startsWith('zh')) {
            return 'zh';
        }
    }
    return 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [lang, setLangState] = useState<Lang>(() => {
        // Priority:
        //   1. explicit user choice (localStorage) — takes precedence for both anon
        //      and logged-in users so the toggle button always sticks
        //   2. browser language — Chinese if `zh*`, otherwise English
        // Once a logged-in user's profile hydrates, AuthContext calls setLang()
        // with their saved preference and overrides the browser default.
        const saved = localStorage.getItem('ielts_lang');
        if (saved === 'zh' || saved === 'en') return saved;
        return detectBrowserLang();
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
