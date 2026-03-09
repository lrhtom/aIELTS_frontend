import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react';
import { translations, type Lang, type Translations } from './translations';

interface LanguageContextValue {
    lang: Lang;
    translations: Translations;
    setLang: (lang: Lang) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
    lang: 'zh',
    translations: translations.zh,
    setLang: () => { },
});

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [lang, setLangState] = useState<Lang>(() => {
        const saved = localStorage.getItem('ielts_lang');
        return (saved === 'zh' || saved === 'en') ? saved : 'zh';
    });

    const setLang = (newLang: Lang) => {
        setLangState(newLang);
        localStorage.setItem('ielts_lang', newLang);
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
