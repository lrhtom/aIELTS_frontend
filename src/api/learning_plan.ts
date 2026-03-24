import { apiClient } from './client';
import type { VocabCard, VocabStats } from './vocab';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface LearningPlan {
    id:             number;
    name:           string;
    daily_count:    number;
    default_mode?:  string;
    mastery_target?: number;
    word_count:     number;
    studied_today:  number;
    today_words:    TodayWord[];
    created_at:     string;
    updated_at:     string;
}

export interface TodayWord {
    word:     string;
    zh:       string;
    state:    number;   // 0=New 1=Learning 2=Review 3=Relearning
    reps:     number;
    phonetic: string;
}

export interface PlanEntry {
    id:                  number;
    word:                string;
    zh:                  string;
    added_at:            string;
    fsrs_due:            string | null;
    fsrs_state:          number;   // 0=New 1=Learning 2=Review 3=Relearning
    fsrs_scheduled_days: number;
    // Word enrichment
    phonetic:            string;
    grammar:             string;
    definitions:         Array<{ pos: string; meaning: string }>;
    examples:            Array<{ en: string; zh: string }>;
}

export interface VocabBook {
    id:          number;
    name:        string;
    description: string;
    word_count:  number;
}

export interface BookWord {
    id:       number;
    word:     string;
    phonetic: string;
    zh_brief: string;
    order:    number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Plan CRUD
// ──────────────────────────────────────────────────────────────────────────────

export async function listPlans(): Promise<{ plans: LearningPlan[] }> {
    const resp = await apiClient.get('/plans/');
    return resp.data;
}

export async function getPlanDetail(id: number): Promise<{ plan: LearningPlan }> {
    const resp = await apiClient.get(`/plans/${id}/`);
    return resp.data;
}

export async function createPlan(name: string, daily_count: number): Promise<{ plan: LearningPlan }> {
    const resp = await apiClient.post('/plans/', { name, daily_count });
    return resp.data;
}

export async function updatePlan(
    id: number,
    data: Partial<{ name: string; daily_count: number; default_mode: string; mastery_target: number }>,
): Promise<{ plan: LearningPlan }> {
    const resp = await apiClient.patch(`/plans/${id}/`, data);
    return resp.data;
}

export async function deletePlan(id: number): Promise<void> {
    await apiClient.delete(`/plans/${id}/`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Plan words
// ──────────────────────────────────────────────────────────────────────────────

export async function listPlanWords(id: number, q?: string): Promise<{ entries: PlanEntry[] }> {
    const resp = await apiClient.get(`/plans/${id}/words/`, { params: q ? { q } : {} });
    return resp.data;
}

type AddWordPayload =
    | { mode: 'manual';      word: string; zh?: string; phonetic?: string; grammar?: string; examples?: Array<{ en: string; zh: string }> }
    | { mode: 'notebook';    notebook_id: number }
    | { mode: 'book_all';    book_id: number }
    | { mode: 'book_range';  book_id: number; start: number; end: number }
    | { mode: 'book_select'; book_id: number; word_ids: number[] };

export async function addWord(
    id: number,
    payload: AddWordPayload,
): Promise<{ entries_added: number; entry?: PlanEntry }> {
    const resp = await apiClient.post(`/plans/${id}/words/`, payload);
    return resp.data;
}

export async function updatePlanWord(
    id: number,
    eid: number,
    data: { zh?: string; next_review_days?: number },
): Promise<{ entry: PlanEntry }> {
    const resp = await apiClient.patch(`/plans/${id}/words/${eid}/`, data);
    return resp.data;
}

export async function removePlanWord(id: number, eid: number): Promise<void> {
    await apiClient.delete(`/plans/${id}/words/${eid}/`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Start plan
// ──────────────────────────────────────────────────────────────────────────────

export async function startPlan(
    id: number,
    mode: 'study' | 'review' = 'study',
): Promise<{ cards: VocabCard[]; stats: VocabStats & { studied_today: number; remaining_today: number }; review_mode?: boolean }> {
    const resp = await apiClient.post(`/plans/${id}/start/`, { mode });
    return resp.data;
}

// ──────────────────────────────────────────────────────────────────────────────
// VocabBook browser
// ──────────────────────────────────────────────────────────────────────────────

export async function listVocabBooks(): Promise<{ books: VocabBook[] }> {
    const resp = await apiClient.get('/vocab/books/');
    return resp.data;
}

export async function listBookWords(
    bookId: number,
    page = 1,
    pageSize = 20,
    q?: string,
): Promise<{ words: BookWord[]; total: number; page: number; page_size: number }> {
    const resp = await apiClient.get(`/vocab/books/${bookId}/words/`, {
        params: { page, page_size: pageSize, ...(q ? { q } : {}) },
    });
    return resp.data;
}
