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

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body } = options;

    const res = await fetch(`${API_BASE}/api${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `API Error: ${res.status}`);
    }

    return res.json();
}
