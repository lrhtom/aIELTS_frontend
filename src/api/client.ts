import axios, { type AxiosError, type AxiosRequestConfig } from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE;

export const apiClient = axios.create({
    baseURL: `${API_BASE}/api`,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Flag to prevent multiple concurrent refresh token requests
let isRefreshing = false;
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

apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        
        // 【新增】判断是否为登录、注册、验证码等公开接口。
        // 如果是这些接口，不携带 Authorization 头，防止被后端的单设备登录逻辑提前 401 拦截。
        const publicPaths = ['/auth/login', '/auth/register', '/auth/send-code'];
        const isPublicPath = publicPaths.some(path => config.url?.includes(path));

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
                // If currently refreshing, put this request in a queue to retry later
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
                return Promise.reject(error);
            }
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
