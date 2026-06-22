import { apiClient } from './client';

export type AIQuestionSkill = 'reading' | 'listening' | 'writing';

export interface AIQuestionSummary {
    id: number;
    skill: AIQuestionSkill;
    subtype: string;
    title: string;
    isAnswered: boolean;
    answeredAt: string | null;
    lastAttemptAt: string | null;
    createdAt: string | null;
}

export interface AIQuestionDetail extends AIQuestionSummary {
    content: Record<string, unknown>;
    userAnswer: unknown;
    aiFeedback: unknown;
}

export async function listAIQuestions(params?: { skill?: AIQuestionSkill; answered?: boolean }) {
    const query: Record<string, string> = {};
    if (params?.skill) query.skill = params.skill;
    if (typeof params?.answered === 'boolean') query.answered = params.answered ? 'true' : 'false';
    const resp = await apiClient.get('/ai-questions/', { params: query });
    return resp.data as { items: AIQuestionSummary[]; count: number };
}

export async function getAIQuestion(id: number) {
    const resp = await apiClient.get(`/ai-questions/${id}/`);
    return resp.data as AIQuestionDetail;
}

export async function submitAIQuestion(id: number, userAnswer: unknown, aiFeedback?: unknown) {
    const body: Record<string, unknown> = { userAnswer };
    if (aiFeedback !== undefined) body.aiFeedback = aiFeedback;
    const resp = await apiClient.post(`/ai-questions/${id}/submit/`, body);
    return resp.data as AIQuestionDetail;
}

export async function deleteAIQuestion(id: number) {
    await apiClient.delete(`/ai-questions/${id}/`);
}
