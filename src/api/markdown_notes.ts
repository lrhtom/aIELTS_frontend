import { apiClient } from './client';

export interface MarkdownNote {
    id: number;
    title: string;
    tags: string[];
    content: string;
    created_at: string;
    updated_at: string;
}

export async function listMarkdownNotes() {
    const resp = await apiClient.get('/markdown-notes/');
    return resp.data as { notes: MarkdownNote[] };
}

export async function getMarkdownNote(pk: number) {
    const resp = await apiClient.get(`/markdown-notes/${pk}/`);
    return resp.data as { note: MarkdownNote };
}

export async function createMarkdownNote(data: { title: string; tags?: string[]; content?: string }) {
    const resp = await apiClient.post('/markdown-notes/', data);
    return resp.data as { note: MarkdownNote };
}

export async function updateMarkdownNote(pk: number, data: Partial<Pick<MarkdownNote, 'title' | 'tags' | 'content'>>) {
    const resp = await apiClient.patch(`/markdown-notes/${pk}/`, data);
    return resp.data as { note: MarkdownNote };
}

export async function deleteMarkdownNote(pk: number) {
    await apiClient.delete(`/markdown-notes/${pk}/`);
}
