import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../api/auth';
import type { ApiError } from '../api/client';
import '../styles/auth_pages.css';

export default function RegisterPage() {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();
    const { login } = useAuth();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('两次输入的密码不一致。');
            return;
        }

        setIsLoading(true);

        try {
            const registerData = {
                username: formData.username,
                email: formData.email,
                password: formData.password
            };

            const response = await authApi.register(registerData);

            // The API is configured to return tokens upon successful registration
            if (response.tokens) {
                login(response.tokens, response.user);
                navigate('/');
            } else {
                // Fallback: If no tokens returned, navigate to login
                navigate('/login?registered=true');
            }
        } catch (err) {
            const apiError = err as ApiError;
            // The validation errors might come in as deeply nested objects from DRF, showing the main message
            const errorMsg = apiError.message.includes('object')
                ? '注册失败：用户名或邮箱可能已被使用。'
                : apiError.message;
            setError(errorMsg || '注册发生错误，请稍后重试。');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <div className="auth-header-top">
                        <button
                            className="auth-back-btn"
                            onClick={() => navigate('/')}
                        >
                            ← 返回主页
                        </button>
                    </div>
                    <h2>创建新账号</h2>
                    <p>加入 aIELTS，全方位提升您的雅思能力</p>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="username">用户名</label>
                        <input
                            id="username"
                            type="text"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            placeholder="选择一个用于登录的用户名"
                            required
                            disabled={isLoading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">邮箱地址</label>
                        <input
                            id="email"
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="example@email.com"
                            required
                            disabled={isLoading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">密码</label>
                        <input
                            id="password"
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="至少6位密码"
                            required
                            disabled={isLoading}
                            minLength={6}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">确认密码</label>
                        <input
                            id="confirmPassword"
                            type="password"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            placeholder="再次输入密码"
                            required
                            disabled={isLoading}
                            minLength={6}
                        />
                    </div>

                    <button
                        type="submit"
                        className={`auth-submit-btn ${isLoading ? 'loading' : ''}`}
                        disabled={isLoading}
                    >
                        {isLoading ? '注册中...' : '注册账号'}
                    </button>
                </form>

                <div className="auth-footer">
                    已拥有账号？ <Link to="/login">直接登录</Link>
                </div>
            </div>
        </div>
    );
}
