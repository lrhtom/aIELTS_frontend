import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Lang } from './translations';

interface LanguageContextValue {
    lang: Lang;
    setLang: (lang: Lang) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
    lang: 'zh',
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

    // Sync html lang attribute for accessibility
    useEffect(() => {
        document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    }, [lang]);

    return (
        <LanguageContext.Provider value={{ lang, setLang }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLang() {
    return useContext(LanguageContext);
}
