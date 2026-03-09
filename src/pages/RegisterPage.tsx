import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../i18n/LanguageContext';
import { authApi } from '../api/auth';
import type { ApiError } from '../api/client';
import '../styles/auth_pages.css';

const RegisterPage: React.FC = () => {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const { login } = useAuth();
    const { translations: t } = useLang();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError(t.auth.errorPasswordMismatch);
            return;
        }

        setLoading(true);

        try {
            const registerData = {
                username: formData.username,
                email: formData.email,
                password: formData.password
            };

            const response = await authApi.register(registerData);

            if (response.tokens) {
                login(response.tokens, response.user);
                navigate('/profile');
            } else {
                navigate('/login?registered=true');
            }
        } catch (err) {
            const apiError = err as ApiError;
            // 处理后端抛出的 REGISTER_TAKEN 错误
            const errorMsg = apiError.message.includes('REGISTER_TAKEN')
                ? t.auth.errorRegisterTaken
                : apiError.message;
            setError(errorMsg || t.auth.errorGeneral);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <h1>{t.auth.registerTitle}</h1>
                    <p>{t.auth.registerSubtitle}</p>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    {error && <div className="auth-error">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="username">{t.auth.username}</label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            required
                            placeholder={t.auth.username}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">{t.auth.email}</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            placeholder={t.auth.email}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">{t.auth.password}</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            placeholder={t.auth.password}
                            minLength={6}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">{t.auth.confirmPassword}</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            required
                            placeholder={t.auth.confirmPassword}
                            minLength={6}
                        />
                    </div>

                    <button
                        type="submit"
                        className={`auth-submit ${loading ? 'loading' : ''}`}
                        disabled={loading}
                    >
                        {loading ? t.auth.registering : t.auth.registerBtn}
                    </button>

                    <div className="auth-footer">
                        <p>
                            {t.auth.hasAccount}{' '}
                            <Link to="/login">{t.auth.toLogin}</Link>
                        </p>
                        <Link to="/" className="back-home">{t.auth.backToHome}</Link>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RegisterPage;
