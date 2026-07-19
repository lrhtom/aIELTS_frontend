import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../i18n/LanguageContext';
import { authApi } from '../../api/auth';
import type { ApiError } from '../../api/client';
import '../../styles/auth_pages.css';

const RESEND_COOLDOWN = 60; // seconds

const RegisterPage: React.FC = () => {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        verificationCode: '',
    });
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [loading, setLoading] = useState(false);
    const [sendingCode, setSendingCode] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const navigate = useNavigate();
    const { login, user, isLoading } = useAuth();
    const { t } = useLang();

    useEffect(() => {
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, []);

    // Logged-in users skip the register flow entirely.
    useEffect(() => {
        if (!isLoading && user) {
            navigate('/profile', { replace: true });
        }
    }, [isLoading, user, navigate]);

    const startCooldown = () => {
        setCooldown(RESEND_COOLDOWN);
        timerRef.current = setInterval(() => {
            setCooldown(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current!);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError('');
    };

    const emailProvided = formData.email.trim().length > 0;

    const handleSendCode = async () => {
        const { username, email } = formData;
        if (!username.trim() || !email.trim()) {
            setError(t('auth.errorEmailRequired'));
            return;
        }

        setSendingCode(true);
        setError('');
        setInfo('');

        try {
            await authApi.sendVerificationCode(email.trim(), username.trim());
            setInfo(t('auth.codeSent'));
            startCooldown();
        } catch (err) {
            const apiError = err as ApiError;
            const msg = apiError.message || '';
            if (msg.includes('REGISTER_TAKEN')) {
                setError(t('auth.errorRegisterTaken'));
            } else {
                setError(t('auth.errorGeneral'));
            }
        } finally {
            setSendingCode(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setInfo('');

        if (formData.password !== formData.confirmPassword) {
            setError(t('auth.errorPasswordMismatch'));
            return;
        }

        // Verification code is only required when the user chose to provide an email.
        if (emailProvided && !formData.verificationCode.trim()) {
            setError(t('auth.errorCodeInvalid'));
            return;
        }

        setLoading(true);

        try {
            const registerData: {
                username: string;
                password: string;
                email?: string;
                verification_code?: string;
            } = {
                username: formData.username,
                password: formData.password,
            };
            if (emailProvided) {
                registerData.email = formData.email.toLowerCase();
                registerData.verification_code = formData.verificationCode;
            }

            const response = await authApi.register(registerData);

            if (response.user) {
                // Cookies were planted by the server on this response — login()
                // just syncs the React state.
                login(response.user);
                navigate('/profile');
            } else {
                navigate('/login?registered=true');
            }
        } catch (err) {
            const apiError = err as ApiError;
            const msg = apiError.message || '';
            if (msg.includes('REGISTER_TAKEN')) {
                setError(t('auth.errorRegisterTaken'));
            } else if (msg.includes('INVALID_CODE') || msg.includes('VERIFICATION_CODE_REQUIRED')) {
                setError(t('auth.errorCodeInvalid'));
            } else {
                setError(msg || t('auth.errorGeneral'));
            }
        } finally {
            setLoading(false);
        }
    };

    const sendBtnLabel = sendingCode
        ? t('auth.sendingCode')
        : cooldown > 0
            ? t('auth.resendCode').replace('{n}', String(cooldown))
            : t('auth.sendCode');

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <h1>{t('auth.registerTitle')}</h1>
                    <p>{t('auth.registerSubtitle')}</p>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    {error && <div className="auth-error">{error}</div>}
                    {info && <div className="auth-info">{info}</div>}

                    <div className="form-group">
                        <label htmlFor="username">{t('auth.username')}</label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            required
                            placeholder={t('auth.username')}
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">
                            {t('auth.email')} <span style={{ opacity: 0.6, fontWeight: 'normal' }}>({t('common.optional')})</span>
                        </label>
                        <div className="code-input-group">
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder={t('auth.email')}
                                disabled={loading}
                            />
                            <button
                                type="button"
                                className="send-code-btn"
                                onClick={handleSendCode}
                                disabled={sendingCode || cooldown > 0 || loading || !emailProvided}
                            >
                                {sendBtnLabel}
                            </button>
                        </div>
                    </div>

                    {emailProvided && (
                        <div className="form-group">
                            <label htmlFor="verificationCode">{t('auth.verificationCode')}</label>
                            <input
                                type="text"
                                id="verificationCode"
                                name="verificationCode"
                                value={formData.verificationCode}
                                onChange={handleChange}
                                required
                                placeholder={t('auth.codePlaceholder')}
                                maxLength={6}
                                disabled={loading}
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="password">{t('auth.password')}</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            placeholder={t('auth.password')}
                            minLength={6}
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">{t('auth.confirmPassword')}</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            required
                            placeholder={t('auth.confirmPassword')}
                            minLength={6}
                            disabled={loading}
                        />
                    </div>

                    <button
                        type="submit"
                        className={`auth-submit-btn ${loading ? 'loading' : ''}`}
                        disabled={loading}
                    >
                        {loading ? t('auth.registering') : t('auth.registerBtn')}
                    </button>

                    <div className="auth-footer">
                        <p>
                            {t('auth.hasAccount')}{' '}
                            <Link to="/login">{t('auth.toLogin')}</Link>
                        </p>
                        <Link to="/" className="back-home">{t('auth.backToHome')}</Link>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RegisterPage;
