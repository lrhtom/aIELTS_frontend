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

        window.addEventListener('auth:logout', handleLogout);
        return () => window.removeEventListener('auth:logout', handleLogout);
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

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
