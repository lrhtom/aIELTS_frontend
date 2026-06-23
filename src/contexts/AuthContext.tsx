import React, { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { type User, authApi } from '../api/auth';

// ── 背景模糊层管理 ────────────────────────────────────────
function getOrCreateBgLayer(blur: number): HTMLDivElement {
    let layer = document.getElementById('bg-image-layer') as HTMLDivElement | null;
    if (!layer) {
        layer = document.createElement('div');
        layer.id = 'bg-image-layer';
        Object.assign(layer.style, {
            position: 'fixed',
            inset: '0',
            zIndex: '-9999',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'fixed',
            transform: 'scale(1.08)', // 防止模糊后出现白边
            transition: 'background-image 0.3s ease, filter 0.2s ease',
        });
        document.body.prepend(layer);
    }
    layer.style.filter = `blur(${blur}px)`;
    return layer;
}

function removeBgLayer() {
    document.getElementById('bg-image-layer')?.remove();
}

// ── 背景工具函数 ──────────────────────────────────────────
// eslint-disable-next-line react-refresh/only-export-components
export function applyUserBackground(user: User | null) {
    if (user?.bg_image_url) {
        // 图片模式：通过独立 div 层展示，带模糊
        const blur = typeof user.bg_blur === 'number' ? user.bg_blur : 2;
        const layer = getOrCreateBgLayer(blur);
        layer.style.backgroundImage = `url(${user.bg_image_url})`;
        // body 本身透明，让模糊层打底
        document.body.style.background = 'transparent';
        document.body.style.backgroundColor = 'transparent';
    } else if (user?.bg_color) {
        // 颜色/渐变模式：不需要模糊层
        removeBgLayer();
        const isGrad = user.bg_color.startsWith('linear-gradient') || user.bg_color.startsWith('radial-gradient');
        // 先清 shorthand，再设置属性，否则 background 会覆盖 backgroundColor
        document.body.style.background = isGrad ? user.bg_color : '';
        document.body.style.backgroundColor = isGrad ? '' : user.bg_color;
    } else {
        resetBackground();
    }
}

// eslint-disable-next-line react-refresh/only-export-components
export function resetBackground() {
    removeBgLayer();
    document.body.style.background = '';
    document.body.style.backgroundColor = '';
    document.body.style.backgroundImage = '';
    document.body.style.backgroundSize = '';
    document.body.style.backgroundPosition = '';
    document.body.style.backgroundAttachment = '';
}
// ─────────────────────────────────────────────────────────

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    /** Called after `authApi.login(...)` / `authApi.register(...)` — auth cookies
     *  have already been planted by the server, so this just syncs local state. */
    login: (userData: User) => void;
    logout: () => void;
    updateUser: (userData: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

import { useLang } from '../i18n/LanguageContext';
import { type Lang } from '../i18n/translations';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const hasInitRef = useRef(false);
    const { lang, setLang } = useLang();

    useEffect(() => {
        const initAuth = async () => {
            if (hasInitRef.current) return;
            hasInitRef.current = true;

            // Always try to fetch the profile — the browser will auto-attach
            // any httpOnly auth cookies; a 401 means "not logged in" and we
            // simply land on the public state.
            try {
                const userData = await authApi.getProfile();
                setUser(userData);
                applyUserBackground(userData);
                if (userData.languagePreference && userData.languagePreference !== lang) {
                    setLang(userData.languagePreference as Lang, false);
                }
                if (userData.aiProvider) {
                    localStorage.setItem('ai_provider', userData.aiProvider);
                }
            } catch {
                // 401 / network failure → leave user=null. No client-side token
                // state to clean up; cookies are managed entirely by the server.
            }
            setIsLoading(false);
        };

        initAuth();

        const handleLogout = () => {
            setUser(null);
            resetBackground();
        };

        const handleATConsumed = (event: Event) => {
            const customEvent = event as CustomEvent<{ consumed: number; description?: string }>;
            const detail = customEvent.detail;
            if (user && detail.consumed) {
                const updatedUser = { ...user, atBalance: (user.atBalance || 0) - detail.consumed };
                setUser(updatedUser);
            }
        };

        window.addEventListener('auth:logout', handleLogout);
        window.addEventListener('at-consumed', handleATConsumed);
        return () => {
            window.removeEventListener('auth:logout', handleLogout);
            window.removeEventListener('at-consumed', handleATConsumed);
        };
    }, [lang, setLang, user]);

    const login = (userData: User) => {
        setUser(userData);
        applyUserBackground(userData);
        if (userData.languagePreference && userData.languagePreference !== lang) {
            setLang(userData.languagePreference as Lang, false);
        }
        if (userData.targetVocabName) {
            localStorage.setItem('ielts_target_vocab', userData.targetVocabName);
        }
        if (userData.aiProvider) {
            localStorage.setItem('ai_provider', userData.aiProvider);
        }
    };

    const logout = () => {
        // Fire-and-forget: server clears cookies + rotates jwt_token_id. If
        // the server is unreachable we still reset local state so the UI doesn't
        // pretend the user is still signed in.
        void authApi.logout();
        setUser(null);
        resetBackground();
    };

    const updateUser = useCallback((userData: User) => {
        setUser(userData);
        applyUserBackground(userData);
    }, []);

    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
