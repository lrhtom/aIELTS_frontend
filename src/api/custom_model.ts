import { apiClient } from './client';

// ──────────────────────────────────────────────────────────────────────────────
// Custom (bring-your-own) AI models — an OpenAI-compatible endpoint the user owns.
// The SK key is stored encrypted server-side and only ever returned masked.
// ──────────────────────────────────────────────────────────────────────────────

export interface CustomModel {
    id:         number;
    provider_id: string;   // 'custom:<id>' — the value the model selector stores
    name:       string;
    base_url:   string;
    key_masked: string;    // e.g. 'sk-****9f2a' — never the real key
    created_at: string;
    updated_at: string;
}

/** Structured result of a connectivity test — mirrors backend AIClient.ping(). */
export interface ModelTestResult {
    status: 'ok' | 'auth' | 'ratelimited' | 'reqerror' | 'error' | 'unconfigured';
    http:   number | null;
    body:   string | null;
    error:  string | null;
    tokens: number | null;
}

export async function listCustomModels(): Promise<CustomModel[]> {
    const resp = await apiClient.get<{ models: CustomModel[] }>('/custom-models/');
    return resp.data.models;
}

export async function createCustomModel(
    payload: { name: string; base_url: string; api_key: string },
): Promise<CustomModel> {
    const resp = await apiClient.post<{ model: CustomModel }>('/custom-models/', payload);
    return resp.data.model;
}

export async function updateCustomModel(
    id: number,
    payload: Partial<{ name: string; base_url: string; api_key: string }>,
): Promise<CustomModel> {
    const resp = await apiClient.patch<{ model: CustomModel }>(`/custom-models/${id}/`, payload);
    return resp.data.model;
}

export async function deleteCustomModel(id: number): Promise<void> {
    await apiClient.delete(`/custom-models/${id}/`);
}

/** Ping a saved model. */
export async function testCustomModel(id: number): Promise<ModelTestResult> {
    const resp = await apiClient.post<ModelTestResult>(`/custom-models/${id}/test/`, {});
    return resp.data;
}

/** Ping an unsaved config (used inside the add/edit modal before saving). */
export async function testCustomModelConfig(
    payload: { name: string; base_url: string; api_key: string },
): Promise<ModelTestResult> {
    const resp = await apiClient.post<ModelTestResult>('/custom-models/test/', payload);
    return resp.data;
}
