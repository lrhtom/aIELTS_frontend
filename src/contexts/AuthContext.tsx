import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { type User, authApi } from '../api/auth';

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
                } catch (error) {
                    console.error('Failed to restore session:', error);
                    // Automatic token refresh logic in client.ts will handle 401s.
                    // If it completely fails, localStorage is cleared and auth:logout is dispatched.
                }
            }
            setIsLoading(false);
        };

        initAuth();

        const handleLogout = () => {
            setUser(null);
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
        };

        const handleATConsumed = (event: Event) => {
            const customEvent = event as CustomEvent<{ consumed: number; description?: string }>;
            // 更新用户AT币余额
            const detail = customEvent.detail;
            if (user && detail.consumed) {
                const updatedUser = {
                    ...user,
                    atBalance: (user.atBalance || 0) - detail.consumed
                };
                setUser(updatedUser);
                console.log(`AT币消耗更新: ${detail.consumed} AT, 新余额: ${updatedUser.atBalance} AT`);
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
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
    };

    const updateUser = (userData: User) => {
        setUser(userData);
    };

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
