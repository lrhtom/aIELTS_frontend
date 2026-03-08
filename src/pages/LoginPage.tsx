import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../api/auth';
import type { ApiError } from '../api/client';
import '../styles/auth_pages.css';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await authApi.login(username, password);
            if (response.tokens) {
                login(response.tokens, response.user);
                navigate('/');
            }
        } catch (err) {
            const apiError = err as ApiError;
            if (apiError.status === 401) {
                setError('用户名或密码错误。');
            } else {
                setError(apiError.message || '登录失败，请稍后重试。');
            }
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
                    <h2>欢迎回来</h2>
                    <p>登录以继续您的 aIELTS 学习之旅</p>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="username">用户名</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="输入您的用户名"
                            required
                            disabled={isLoading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">密码</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="输入您的密码"
                            required
                            disabled={isLoading}
                        />
                    </div>

                    <button
                        type="submit"
                        className={`auth-submit-btn ${isLoading ? 'loading' : ''}`}
                        disabled={isLoading}
                    >
                        {isLoading ? '登录中...' : '登录'}
                    </button>
                </form>

                <div className="auth-footer">
                    还没有账号？ <Link to="/register">立即注册</Link>
                </div>
            </div>
        </div>
    );
}
