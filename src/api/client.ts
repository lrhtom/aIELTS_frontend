/**
 * 统一 API 客户端
 * 所有后端请求通过此模块发出
 * 地址由 VITE_API_BASE 环境变量控制（dev → localhost:8000, prod → 生产域名）
 */

const API_BASE = import.meta.env.VITE_API_BASE;

interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
}

export interface ApiError extends Error {
    status: number;
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body } = options;
    const provider = localStorage.getItem('ai_provider') || 'deepseek';

    const res = await fetch(`${API_BASE}/api${path}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'X-AI-Provider': provider
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        const err = new Error(data.error || `API Error: ${res.status}`) as ApiError;
        err.status = res.status;
        throw err;
    }

    return res.json();
}
