import { apiClient } from './client';

export type AIQuestionSkill = 'reading' | 'listening' | 'writing' | 'speaking' | 'mock';
export type AIQuestionStatus = 'generating' | 'ready' | 'failed';

/** 全套模拟考试部分的大厅状态（后端 _effective_part_status 派生） */
export type MockPartStatus =
    | 'generating' | 'gen_failed'   // 生成中 / 生成失败
    | 'locked' | 'ready'            // 顺序锁定 / 可开始
    | 'in_progress'                 // 作答中（刷新可续）
    | 'submitted' | 'forfeited' | 'expired'; // 已交卷 / 退出判0 / 超时

/** skill='mock' 行在列表接口附带的轻量快照 */
export interface MockListSnapshot {
    derivedStatus: AIQuestionStatus;
    slots: Record<'listening' | 'reading' | 'writingTask1' | 'writingTask2', AIQuestionStatus>;
    parts: Record<'listening' | 'reading' | 'writing' | 'speaking', MockPartStatus>;
    hasReport: boolean;
    overall: number | null;
}

export interface AIQuestionSummary {
    id: number;
    skill: AIQuestionSkill;
    subtype: string;
    title: string;
    /** 用户在生成时填写的简介，未填则空串 */
    description: string;
    status: AIQuestionStatus;
    errorMessage: string;
    /** 是否已收藏 */
    isFavorite: boolean;
    /** 收藏时刻 ISO 串，未收藏为 null；用于"后收藏的排前面"排序 */
    favoritedAt: string | null;
    isAnswered: boolean;
    /** ai_feedback_json 非空。speaking 用它区分"进行中"与"已出报告" */
    hasFeedback: boolean;
    answeredAt: string | null;
    lastAttemptAt: string | null;
    createdAt: string | null;
    /** 仅 skill='mock' 行存在：四科生成/考试进度快照 */
    mock?: MockListSnapshot;
}

export interface AIQuestionDetail extends AIQuestionSummary {
    content: Record<string, unknown>;
    userAnswer: unknown;
    aiFeedback: unknown;
}

export async function listAIQuestions(params?: { skill?: AIQuestionSkill; answered?: boolean; status?: AIQuestionStatus }) {
    const query: Record<string, string> = {};
    if (params?.skill) query.skill = params.skill;
    if (typeof params?.answered === 'boolean') query.answered = params.answered ? 'true' : 'false';
    if (params?.status) query.status = params.status;
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

/** 切换收藏状态，返回更新后的详情（含新的 favoritedAt / isFavorite）。 */
export async function toggleFavoriteAIQuestion(id: number) {
    const resp = await apiClient.post(`/ai-questions/${id}/favorite/`);
    return resp.data as AIQuestionDetail;
}

/** 口语会话开局建行（不调 AI、不扣 AT），后续每轮经 submitAIQuestion 覆盖式同步。
 *  parentId: 全套模拟场景传 mock 父行 id，本会话挂为其口语子行（后端幂等复用）。 */
export async function startSpeakingSession(mode: string, title: string, content: Record<string, unknown>, parentId?: number) {
    const body: Record<string, unknown> = { mode, title, content };
    if (parentId) body.parentId = parentId;
    const resp = await apiClient.post('/speaking/session/start', body);
    return resp.data as { id: number; reused?: boolean };
}
