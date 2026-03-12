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

    const { login } = useAuth();
    const navigate = useNavigate();
    const { translations: t } = useLang();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await authApi.login(username, password);
            if (response.tokens) {
                login(response.tokens, response.user);
                navigate('/profile');
            }
        } catch (err: any) {
            console.error('Login error:', err);
            if (err.response?.status === 403 || err.message?.includes('ACCOUNT_BANNED')) {
                setError(t.auth.errorBanned);
            } else if (err.response?.status === 401) {
                setError(t.auth.errorUnauthorized);
            } else {
                setError(t.auth.errorGeneral);
            }
        } finally {
            setLoading(false);
        }

    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <h1>{t.auth.loginTitle}</h1>
                    <p>{t.auth.loginSubtitle}</p>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
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
                        <Link to="/" className="back-home">{t.auth.backToHome}</Link>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
