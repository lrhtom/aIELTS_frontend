import axios, { type AxiosError, type AxiosRequestConfig } from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE;
const PUBLIC_AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/send-code'];

export const apiClient = axios.create({
    baseURL: `${API_BASE}/api`,
    headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
    },
});

// Flag to prevent multiple concurrent refresh token requests
let isRefreshing = false;
// Prevent refresh storms — don't refresh more than once per cooldown window
let lastRefreshTime = 0;
const REFRESH_COOLDOWN_MS = 30_000;
// Queue of failed requests during refresh
let failedQueue: Array<{
    resolve: (value?: unknown) => void;
    reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });

    failedQueue = [];
};

async function refreshAccessTokenForFetch(): Promise<string | null> {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
        return null;
    }

    try {
        const response = await axios.post(`${API_BASE}/api/auth/token/refresh`, {
            refresh: refreshToken,
        });

        const newAccessToken = response.data?.access;
        if (!newAccessToken) {
            return null;
        }

        localStorage.setItem('access_token', newAccessToken);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
        return newAccessToken;
    } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        window.dispatchEvent(new Event('auth:logout'));
        return null;
    }
}

apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        
        // 【新增】判断是否为登录、注册、验证码等公开接口。
        // 如果是这些接口，不携带 Authorization 头，防止被后端的单设备登录逻辑提前 401 拦截。
        const isPublicPath = PUBLIC_AUTH_PATHS.some(path => config.url?.includes(path));

        if (isPublicPath) {
            delete config.headers['Authorization'];
        } else if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        const provider = localStorage.getItem('ai_provider') || 'deepseek';
        config.headers['X-AI-Provider'] = provider;
        return config;
    },
    (error) => Promise.reject(error)
);

// AT币消耗拦截器
apiClient.interceptors.response.use(
    (response) => {
        // 检查响应是否包含AT币消耗信息
        if (response.data && response.data.atConsumed) {
            console.log(`AT币消耗: ${response.data.atConsumed} AT`, response.data.description || 'AI服务调用');

            // 更新本地AT币余额
            window.dispatchEvent(new CustomEvent('at-consumed', {
                detail: {
                    consumed: response.data.atConsumed,
                    description: response.data.description || 'AI服务调用'
                }
            }));
        }
        return response;
    },
    async (error) => {
        // 处理AT币退款（AI操作失败）
        if (error.response?.data?.atRefunded) {
            window.dispatchEvent(new CustomEvent('at-refunded', {
                detail: { refunded: error.response.data.atRefunded }
            }));
        }

        // 处理AT币不足的错误
        if (error.response?.status === 402) { // Payment Required
            const errorMessage = error.response?.data?.message || 'AT币余额不足';
            console.error('AT币余额不足:', errorMessage);

            // 显示Toast通知给用户
            window.dispatchEvent(new CustomEvent('at-balance-insufficient', {
                detail: {
                    message: errorMessage,
                    requiredBalance: error.response?.data?.requiredBalance,
                    currentBalance: error.response?.data?.currentBalance
                }
            }));

            // 阻止错误传播，返回一个特殊的错误
            const atError = new Error(errorMessage);
            atError.name = 'ATBalanceError';
            return Promise.reject(atError);
        }

        return Promise.reject(error);
    }
);

apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        if (!originalRequest) {
            return Promise.reject(error);
        }

        if (error.response?.status === 401 && !originalRequest._retry) {
            // Avoid looping if the refresh token endpoint itself returns 401
            // Also avoid refreshing if the login endpoint itself returns 401 (e.g. invalid credentials)
            if (originalRequest.url?.includes('/auth/token/refresh') || originalRequest.url?.includes('/auth/login')) {
                return Promise.reject(error);
            }

            if (isRefreshing) {
                // If currently refreshing, mark retried and queue to retry later
                originalRequest._retry = true;
                return new Promise(function (resolve, reject) {
                    failedQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        if (originalRequest.headers) {
                            originalRequest.headers['Authorization'] = 'Bearer ' + token;
                        }
                        return apiClient(originalRequest);
                    })
                    .catch((err) => {
                        return Promise.reject(err);
                    });
            }

            originalRequest._retry = true;

            // Rate-limit refreshes: don't refresh more than once per cooldown window
            const now = Date.now();
            if (now - lastRefreshTime < REFRESH_COOLDOWN_MS) {
                return Promise.reject(error);
            }
            lastRefreshTime = now;
            isRefreshing = true;

            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
                try {
                    const response = await axios.post(`${API_BASE}/api/auth/token/refresh`, {
                        refresh: refreshToken,
                    });

                    const newAccessToken = response.data.access;
                    localStorage.setItem('access_token', newAccessToken);

                    apiClient.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
                    if (originalRequest.headers) {
                        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                    }

                    processQueue(null, newAccessToken);

                    return apiClient(originalRequest);
                } catch (refreshError) {
                    processQueue(refreshError as Error, null);
                    // Refresh token is invalid, log user out
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    window.dispatchEvent(new Event('auth:logout'));
                    return Promise.reject(refreshError);
                } finally {
                    isRefreshing = false;
                }
            } else {
                isRefreshing = false;
                return Promise.reject(error);
            }
        }

        // If a retried request still gets 401, the refresh token is dead — force logout
        if (error.response?.status === 401 && originalRequest._retry) {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            window.dispatchEvent(new Event('auth:logout'));
        }

        return Promise.reject(error);
    }
);

interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
}

export interface ApiError extends Error {
    status: number;
}

// 保持旧的 api 接口兼容性，内部路由到 axios
export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body } = options;

    try {
        const response = await apiClient.request<T>({
            url: path,
            method,
            data: body,
        });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const data = error.response?.data || { error: error.message };
            const err = new Error(data.error || `API Error: ${error.response?.status}`) as ApiError;
            err.status = error.response?.status || 500;
            throw err;
        }
        throw error;
    }
}

/**
 * 原生 Fetch 包装器，用于处理 SSE 流式响应。
 * 注入 Authorization 和 X-AI-Provider 头。
 */
export async function fetchStream(path: string, options: RequestOptions = {}): Promise<Response> {
    const { method = 'GET', body } = options;
    const url = `${API_BASE}/api${path}`;

    const isPublicPath = PUBLIC_AUTH_PATHS.some(p => path.includes(p));
    const requestWithToken = async (accessToken: string | null) => {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream, application/json;q=0.9, */*;q=0.8',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'ngrok-skip-browser-warning': '69420',
        };

        if (!isPublicPath && accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const provider = localStorage.getItem('ai_provider') || 'deepseek';
        headers['X-AI-Provider'] = provider;

        return fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });
    };

    let token = localStorage.getItem('access_token');
    let response = await requestWithToken(token);

    if (response.status === 401 && !isPublicPath) {
        const refreshedToken = await refreshAccessTokenForFetch();
        if (refreshedToken) {
            token = refreshedToken;
            response = await requestWithToken(token);
        }
    }

    if (response.status === 402) {
        // Handle AT Coin error specifically
        try {
            const data = await response.json();
            const errorMessage = data.message || data.error || 'AT币余额不足';
            window.dispatchEvent(new CustomEvent('at-balance-insufficient', {
                detail: {
                    message: errorMessage,
                    requiredBalance: data.requiredBalance,
                    currentBalance: data.currentBalance
                }
            }));
            const err = new Error(errorMessage) as ApiError;
            err.status = 402;
            throw err;
        } catch {
            throw new Error('AT币余额不足');
        }
    }

    if (!response.ok) {
        let msg = '请求失败';
        try {
            const data = await response.json();
            msg = data.error || data.message || msg;
        } catch {}
        const err = new Error(msg) as ApiError;
        err.status = response.status;
        throw err;
    }

    return response;
}
