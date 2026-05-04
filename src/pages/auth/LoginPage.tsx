import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../i18n/LanguageContext';
import { authApi } from '../../api/auth';
import '../../styles/auth_pages.css';

const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'login' | 'reset'>('login');

    // Reset password fields
    const [resetIdentifier, setResetIdentifier] = useState('');
    const [resetNewPassword, setResetNewPassword] = useState('');
    const [resetMsg, setResetMsg] = useState('');

    const { login } = useAuth();
    const navigate = useNavigate();
    const { translations: t } = useLang();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await authApi.login(username, password);
            if (response.tokens) {
                login(response.tokens, response.user);
                navigate('/profile');
            }
        } catch (err: unknown) {
            const e = err as { response?: { status?: number }; message?: string };
            console.error('Login error:', err);
            if (e.response?.status === 403 || e.message?.includes('ACCOUNT_BANNED')) {
                setError(t.auth.errorBanned);
            } else if (e.response?.status === 401) {
                setError(t.auth.errorUnauthorized);
            } else {
                setError(t.auth.errorGeneral);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setResetMsg('');

        if (!resetNewPassword || resetNewPassword.length < 6) {
            setError(t.auth.resetTooShort);
            return;
        }

        setLoading(true);
        try {
            const res = await authApi.resetPassword(resetIdentifier, resetNewPassword);
            setResetMsg(res.message || t.auth.resetSuccess);
            setResetIdentifier('');
            setResetNewPassword('');
        } catch (err: unknown) {
            const e = err as { response?: { status?: number; data?: { error?: string } } };
            if (e.response?.status === 404) {
                setError(t.auth.resetNotFound);
            } else {
                setError(e.response?.data?.error || t.auth.errorGeneral);
            }
        } finally {
            setLoading(false);
        }
    };

    const switchMode = () => {
        setError('');
        setResetMsg('');
        setMode(mode === 'login' ? 'reset' : 'login');
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <h1>{mode === 'login' ? t.auth.loginTitle : t.auth.resetPasswordTitle}</h1>
                    <p>{mode === 'login' ? t.auth.loginSubtitle : t.auth.resetPasswordDesc}</p>
                </div>

                {mode === 'login' ? (
                    <form className="auth-form" onSubmit={handleLogin}>
                        {error && <div className="auth-error">{error}</div>}

                        <div className="form-group">
                            <label htmlFor="username">{t.auth.username}</label>
                            <input
                                type="text"
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                placeholder={t.auth.username}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">{t.auth.password}</label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder={t.auth.password}
                            />
                        </div>

                        <button
                            type="submit"
                            className={`auth-submit ${loading ? 'loading' : ''}`}
                            disabled={loading}
                        >
                            {loading ? t.auth.loggingIn : t.auth.loginBtn}
                        </button>

                        <div className="auth-footer">
                            <p>
                                {t.auth.noAccount}{' '}
                                <Link to="/register">{t.auth.toRegister}</Link>
                            </p>
                            <button type="button" className="auth-link-btn" onClick={switchMode}>
                                {t.auth.forgotPassword}
                            </button>
                            <Link to="/" className="back-home">{t.auth.backToHome}</Link>
                        </div>
                    </form>
                ) : (
                    <form className="auth-form" onSubmit={handleReset}>
                        {error && <div className="auth-error">{error}</div>}
                        {resetMsg && <div className="auth-info">{resetMsg}</div>}

                        <div className="form-group">
                            <label htmlFor="resetIdentifier">{t.auth.resetIdentifier}</label>
                            <input
                                type="text"
                                id="resetIdentifier"
                                value={resetIdentifier}
                                onChange={(e) => setResetIdentifier(e.target.value)}
                                required
                                placeholder={t.auth.resetIdentifierPlaceholder}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="resetNewPassword">{t.auth.resetNewPassword}</label>
                            <input
                                type="password"
                                id="resetNewPassword"
                                value={resetNewPassword}
                                onChange={(e) => setResetNewPassword(e.target.value)}
                                required
                                placeholder={t.auth.resetNewPasswordPlaceholder}
                            />
                        </div>

                        <button
                            type="submit"
                            className={`auth-submit ${loading ? 'loading' : ''}`}
                            disabled={loading}
                        >
                            {loading ? t.auth.resetSubmitting : t.auth.resetSubmitBtn}
                        </button>

                        <div className="auth-footer">
                            <button type="button" className="auth-link-btn" onClick={switchMode}>
                                {t.auth.backToLogin}
                            </button>
                            <Link to="/" className="back-home">{t.auth.backToHome}</Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default LoginPage;
