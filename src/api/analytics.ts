import { apiClient } from './client';

export interface PlanBrief {
    id: number;
    name: string;
    word_count: number;
}

export interface ScheduledBucket {
    days: number;
    count: number;
}

export interface StateBucket {
    state: number;   // 0=New 1=Learning 2=Review 3=Relearning
    label: string;
    count: number;
}

export interface VocabAnalytics {
    plan: PlanBrief;
    total_studied: number;
    scheduled_distribution: ScheduledBucket[];
    state_distribution: StateBucket[];
}

export interface PlanListResponse {
    plans: PlanBrief[];
}

/** GET /analytics/vocab — list user plans (no param) or get analytics (?plan_id=N) */
export async function getVocabAnalytics(planId?: number): Promise<VocabAnalytics | PlanListResponse> {
    const params: Record<string, string> = {};
    if (planId !== undefined) params.plan_id = String(planId);
    const resp = await apiClient.get('/analytics/vocab', { params });
    return resp.data;
}


export async function getScheduledWords(days: number, planId?: number): Promise<{ word: string, zh: string }[]> {
    const res = await apiClient.get('/analytics/scheduled-words', { params: { days, plan_id: planId } });
    return res.data.words;
}

export interface WritingRecord {
    id: number;
    date: string;
    overall: number;
    tr: number | null;
    cc: number | null;
    lr: number | null;
    gra: number | null;
}

export interface WritingSkillsAvg {
    tr: number;
    cc: number;
    lr: number;
    gra: number;
}

export interface WritingAnalytics {
    task1_trend: WritingRecord[];
    task2_trend: WritingRecord[];
    task1_skills_avg: WritingSkillsAvg;
    task2_skills_avg: WritingSkillsAvg;
    total_corrections: number;
}

export async function getWritingAnalytics(): Promise<WritingAnalytics> {
    const res = await apiClient.get('/analytics/writing');
    return res.data;
}

