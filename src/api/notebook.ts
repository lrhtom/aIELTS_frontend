import { apiClient } from './client';

export interface Notebook {
    id:          number;
    title:       string;
    description: string;
    cover_color: string;
    is_public:   boolean;
    word_count:  number;
    created_at:  string;
}

export interface NotebookEntry {
    id:            number;
    word:          string;
    phonetic:      string;
    grammar:       string;
    definitions:   Array<{ pos: string; meaning: string }>;
    examples:      Array<{ en: string; zh: string }>;
    custom_zh:     string;
    notes:         string;
    mastery_level: number;
    tags:          string[];
    added_at:      string;
    last_reviewed: string | null;
}

export async function getNotebook(id: number) {
    const resp = await apiClient.get(`/notebooks/${id}/`);
    return resp.data as { notebook: Notebook };
}

export async function listNotebooks() {
    const resp = await apiClient.get('/notebooks/');
    return resp.data as { notebooks: Notebook[] };
}

export async function createNotebook(data: { title: string; description?: string; cover_color?: string; is_public?: boolean }) {
    const resp = await apiClient.post('/notebooks/', data);
    return resp.data as { notebook: Notebook };
}

export async function updateNotebook(id: number, data: Partial<Pick<Notebook, 'title' | 'description' | 'cover_color' | 'is_public'>>) {
    const resp = await apiClient.patch(`/notebooks/${id}/`, data);
    return resp.data as { notebook: Notebook };
}

export async function deleteNotebook(id: number) {
    await apiClient.delete(`/notebooks/${id}/`);
}

export async function listWords(nbId: number, options?: { tag?: string; q?: string }) {
    const resp = await apiClient.get(`/notebooks/${nbId}/words/`, { params: options });
    return resp.data as { entries: NotebookEntry[] };
}

export async function addWord(nbId: number, data: {
    word:      string;
    custom_zh?: string;
    notes?:    string;
    tags?:     string[];
    phonetic?: string;
    grammar?:  string;
    examples?: Array<{ en: string; zh: string }>;
}) {
    const resp = await apiClient.post(`/notebooks/${nbId}/words/`, data);
    return resp.data as { entry: NotebookEntry };
}

export async function updateWord(nbId: number, eid: number, data: { custom_zh?: string; notes?: string; mastery_level?: number; tags?: string[] }) {
    const resp = await apiClient.patch(`/notebooks/${nbId}/words/${eid}/`, data);
    return resp.data as { entry: NotebookEntry };
}

export async function removeWord(nbId: number, eid: number) {
    await apiClient.delete(`/notebooks/${nbId}/words/${eid}/`);
}

/* ── Bulk import from vocab book ──────────────────────────────────────── */

export type BulkImportPayload =
    | { mode: 'book_all';    book_id: number }
    | { mode: 'book_range';  book_id: number; start: number; end: number }
    | { mode: 'book_select'; book_id: number; word_ids: number[] };

export async function bulkImportWords(nbId: number, payload: BulkImportPayload) {
    const resp = await apiClient.post(`/notebooks/${nbId}/words/`, payload);
    return resp.data as { entries_added: number };
}
