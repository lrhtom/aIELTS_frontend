import axios, { type AxiosError, type AxiosRequestConfig } from 'axios';
import { currentT } from '../i18n/currentT';

const API_BASE = import.meta.env.VITE_API_BASE;
const PUBLIC_AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/send-code'];

const CSRF_COOKIE_NAME = 'aielts_csrf';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

/**
 * Read a cookie by name. Used to surface the non-httpOnly `aielts_csrf` cookie
 * the backend issues on login; the JS code echoes it back in a request header
 * to complete the double-submit CSRF check.
 */
function readCookie(name: string): string | null {
    const target = `${name}=`;
    for (const part of document.cookie.split(';')) {
        const trimmed = part.trim();
        if (trimmed.startsWith(target)) return decodeURIComponent(trimmed.slice(target.length));
    }
    return null;
}

export const apiClient = axios.create({
    baseURL: `${API_BASE}/api`,
    // httpOnly auth cookies live on the backend origin; without this the browser
    // refuses to send them on cross-origin XHR.
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420',
    },
});

// Refresh storm guards (multiple tabs, simultaneous 401s)
let isRefreshing = false;
let lastRefreshTime = 0;
const REFRESH_COOLDOWN_MS = 30_000;
let failedQueue: Array<{
    resolve: (value?: unknown) => void;
    reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null) => {
    failedQueue.forEach((prom) => (error ? prom.reject(error) : prom.resolve()));
    failedQueue = [];
};

async function refreshAccessTokenViaCookie(): Promise<boolean> {
    try {
        await axios.post(`${API_BASE}/api/auth/token/refresh`, {}, { withCredentials: true });
        return true;
    } catch {
        window.dispatchEvent(new Event('auth:logout'));
        return false;
    }
}

apiClient.interceptors.request.use(
    (config) => {
        const isPublicPath = PUBLIC_AUTH_PATHS.some(path => config.url?.includes(path));
        if (isPublicPath) {
            delete config.headers['Authorization'];
        }
        // Double-submit CSRF: echo the non-httpOnly cookie value back to the
        // server in a header. Skipped for safe methods because the backend
        // doesn't require it there.
        const method = (config.method || 'get').toLowerCase();
        if (method !== 'get' && method !== 'head' && method !== 'options') {
            const csrf = readCookie(CSRF_COOKIE_NAME);
            if (csrf) {
                config.headers[CSRF_HEADER_NAME] = csrf;
            }
        }
        const provider = localStorage.getItem('ai_provider') || 'deepseek';
        config.headers['X-AI-Provider'] = provider;
        return config;
    },
    (error) => Promise.reject(error)
);

// AT-coin metadata interceptor (unchanged from pre-cookie-migration)
apiClient.interceptors.response.use(
    (response) => {
        if (response.data && response.data.atConsumed) {
            console.log(`AT币消耗: ${response.data.atConsumed} AT`, response.data.description || 'AI服务调用');
            window.dispatchEvent(new CustomEvent('at-consumed', {
                detail: {
                    consumed: response.data.atConsumed,
                    description: response.data.description || 'AI服务调用',
                },
            }));
        }
        return response;
    },
    async (error) => {
        if (error.response?.data?.atRefunded) {
            window.dispatchEvent(new CustomEvent('at-refunded', {
                detail: { refunded: error.response.data.atRefunded },
            }));
        }
        if (error.response?.status === 402) {
            const errorMessage = error.response?.data?.message || currentT().billing.insufficientBalance;
            console.error('AT币余额不足:', errorMessage);
            window.dispatchEvent(new CustomEvent('at-balance-insufficient', {
                detail: {
                    message: errorMessage,
                    requiredBalance: error.response?.data?.requiredBalance,
                    currentBalance: error.response?.data?.currentBalance,
                },
            }));
            const atError = new Error(errorMessage);
            atError.name = 'ATBalanceError';
            return Promise.reject(atError);
        }
        return Promise.reject(error);
    }
);

// 401 → cookie refresh attempt → retry the original request once.
apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
        if (!originalRequest) return Promise.reject(error);

        if (error.response?.status === 401 && !originalRequest._retry) {
            if (originalRequest.url?.includes('/auth/token/refresh') || originalRequest.url?.includes('/auth/login')) {
                return Promise.reject(error);
            }

            if (isRefreshing) {
                originalRequest._retry = true;
                return new Promise(function (resolve, reject) {
                    failedQueue.push({ resolve, reject });
                })
                    .then(() => apiClient(originalRequest))
                    .catch((err) => Promise.reject(err));
            }

            originalRequest._retry = true;

            const now = Date.now();
            if (now - lastRefreshTime < REFRESH_COOLDOWN_MS) {
                return Promise.reject(error);
            }
            lastRefreshTime = now;
            isRefreshing = true;

            try {
                const ok = await refreshAccessTokenViaCookie();
                if (!ok) {
                    processQueue(new Error('refresh failed'));
                    return Promise.reject(error);
                }
                processQueue(null);
                return apiClient(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError as Error);
                window.dispatchEvent(new Event('auth:logout'));
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        if (error.response?.status === 401 && originalRequest._retry) {
            window.dispatchEvent(new Event('auth:logout'));
        }

        return Promise.reject(error);
    }
);

interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    signal?: AbortSignal;
}

export interface ApiError extends Error {
    status: number;
}

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
 * Native fetch wrapper for SSE streaming. Cookies are auto-sent because
 * `credentials: 'include'`; we still inject X-CSRF-Token for non-GET streams.
 */
export async function fetchStream(path: string, options: RequestOptions = {}): Promise<Response> {
    const { method = 'GET', body, signal } = options;
    const url = `${API_BASE}/api${path}`;

    const isPublicPath = PUBLIC_AUTH_PATHS.some(p => path.includes(p));
    const buildHeaders = (): Record<string, string> => {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream, application/json;q=0.9, */*;q=0.8',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'ngrok-skip-browser-warning': '69420',
        };
        const provider = localStorage.getItem('ai_provider') || 'deepseek';
        headers['X-AI-Provider'] = provider;
        const upperMethod = method.toUpperCase();
        if (upperMethod !== 'GET' && upperMethod !== 'HEAD' && upperMethod !== 'OPTIONS') {
            const csrf = readCookie(CSRF_COOKIE_NAME);
            if (csrf) headers[CSRF_HEADER_NAME] = csrf;
        }
        return headers;
    };

    const doFetch = () =>
        fetch(url, {
            method,
            headers: buildHeaders(),
            body: body ? JSON.stringify(body) : undefined,
            signal,
            credentials: 'include',
        });

    let response = await doFetch();

    if (response.status === 401 && !isPublicPath) {
        const refreshed = await refreshAccessTokenViaCookie();
        if (refreshed) {
            response = await doFetch();
        }
    }

    if (response.status === 402) {
        // Parse failure must not swallow the deliberate 402 throw below — only
        // the .json() call is guarded, so err.status survives to the caller.
        let errorMessage = currentT().billing.insufficientBalance;
        let requiredBalance: number | undefined;
        let currentBalance: number | undefined;
        try {
            const data = await response.json();
            errorMessage = data.message || data.error || errorMessage;
            requiredBalance = data.requiredBalance;
            currentBalance = data.currentBalance;
        } catch { /* unparseable body — keep the i18n fallback message */ }
        window.dispatchEvent(new CustomEvent('at-balance-insufficient', {
            detail: { message: errorMessage, requiredBalance, currentBalance },
        }));
        const err = new Error(errorMessage) as ApiError;
        err.status = 402;
        throw err;
    }

    if (!response.ok) {
        let msg = currentT().billing.requestFailed;
        try {
            const data = await response.json();
            msg = data.error || data.message || msg;
        } catch { /* ignore */ }
        const err = new Error(msg) as ApiError;
        err.status = response.status;
        throw err;
    }

    return response;
}

// ── Assistant Todos ──
export const assistantApi = {
    async getTodos() {
        const res = await apiClient.get('/assistant/todos/');
        return res.data;
    },
    async createTodo(text: string) {
        const res = await apiClient.post('/assistant/todos/', { text });
        return res.data;
    },
    async updateTodo(id: number | string, data: { done?: boolean; text?: string }) {
        const res = await apiClient.patch(`/assistant/todos/${id}/`, data);
        return res.data;
    },
    async deleteTodo(id: number | string) {
        await apiClient.delete(`/assistant/todos/${id}/`);
    },
    async clearCompletedTodos() {
        await apiClient.post('/assistant/todos/clear-completed/');
    },

    // ── Assistant Shortcuts ──
    async getShortcuts() {
        const res = await apiClient.get('/assistant/shortcuts/');
        return res.data;
    },
    async createShortcut(data: { title: string; url: string; open_in_new_tab: boolean }) {
        const res = await apiClient.post('/assistant/shortcuts/', data);
        return res.data;
    },
    async updateShortcut(id: number | string, data: { open_in_new_tab?: boolean; title?: string; url?: string }) {
        const res = await apiClient.patch(`/assistant/shortcuts/${id}/`, data);
        return res.data;
    },
    async deleteShortcut(id: number | string) {
        await apiClient.delete(`/assistant/shortcuts/${id}/`);
    }
};
