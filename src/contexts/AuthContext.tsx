import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
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
    login: (tokens: { access: string, refresh: string }, userData: User) => void;
    logout: () => void;
    updateUser: (userData: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('access_token');
            if (token) {
                try {
                    const userData = await authApi.getProfile();
                    setUser(userData);
                    applyUserBackground(userData);   // ← 恢复会话时应用背景
                } catch (error) {
                    console.error('Failed to restore session:', error);
                }
            }
            setIsLoading(false);
        };

        initAuth();

        const handleLogout = () => {
            setUser(null);
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            resetBackground();   // ← 登出时清除背景
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
    }, []);

    const login = (tokens: { access: string; refresh: string }, userData: User) => {
        localStorage.setItem('access_token', tokens.access);
        localStorage.setItem('refresh_token', tokens.refresh);
        setUser(userData);
        applyUserBackground(userData);   // ← 登录时应用背景
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        resetBackground();   // ← 登出时清除背景
    };

    const updateUser = useCallback((userData: User) => {
        setUser(userData);
        applyUserBackground(userData);   // ← 更新用户资料时同步背景
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
