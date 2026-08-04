import { apiClient } from './client';

export type AIQuestionSkill = 'reading' | 'listening' | 'writing' | 'speaking' | 'mock';
export type AIQuestionStatus = 'generating' | 'ready' | 'failed';

/** Hub status of a full mock exam part (derived by the backend's _effective_part_status) */
export type MockPartStatus =
    | 'generating' | 'gen_failed'   // generating / generation failed
    | 'locked' | 'ready'            // locked by order / ready to start
    | 'in_progress'                 // in progress (a refresh resumes it)
    | 'submitted' | 'forfeited' | 'expired'; // submitted / forfeited with 0 / expired

/** The lightweight snapshot the list endpoint attaches to skill='mock' rows */
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
    /** The description the user entered at generation time; an empty string when they left it blank */
    description: string;
    status: AIQuestionStatus;
    errorMessage: string;
    /** whether it is favorited */
    isFavorite: boolean;
    /** ISO timestamp of when it was favorited, null when it is not; drives the 'most recently favorited first' ordering */
    favoritedAt: string | null;
    isAnswered: boolean;
    /** ai_feedback_json is non-empty. Speaking uses it to tell 'in progress' from 'report ready' */
    hasFeedback: boolean;
    answeredAt: string | null;
    lastAttemptAt: string | null;
    createdAt: string | null;
    /** Site-wide template question: set by an admin, at most one per skill, visible to every user on that tab */
    isTemplate: boolean;
    /** Which template this row is a personal copy of; null when it is not a copy */
    templateSourceId: number | null;
    /** Whether this row belongs to the current user. Someone else's template also appears in the list, where this is false */
    isOwner: boolean;
    /** Only present on skill='mock' rows: a snapshot of the four skills' generation and exam progress */
    mock?: MockListSnapshot;
    /** Only present on a full writing set parent row (skill='writing' + subtype='full') */
    writingFull?: WritingFullSnapshot;
}

/** Aggregate snapshot of a full writing set (Task 1 + Task 2) parent row */
export interface WritingFullTask {
    id: number | null;
    status: AIQuestionStatus;
    title: string;
    subtype: string;
    isAnswered: boolean;
    hasFeedback: boolean;
    errorMessage: string;
}

export interface WritingFullSnapshot {
    derivedStatus: AIQuestionStatus;
    tasks: Record<'task1' | 'task2', WritingFullTask>;
    answeredCount: number;
    gradedCount: number;
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

/** Toggle the favorite state and return the updated detail (with the new favoritedAt / isFavorite). */
export async function toggleFavoriteAIQuestion(id: number) {
    const resp = await apiClient.post(`/ai-questions/${id}/favorite/`);
    return resp.data as AIQuestionDetail;
}

/** Generate a full writing set (Task 1 + Task 2): the parent row comes back immediately and both children generate in the background. */
export async function generateWritingFull(params: {
    task1Type?: string;
    task2Type?: string;
    task2TopicCategory?: string;
    customPrompt?: string;
    customName?: string;
    customDescription?: string;
}) {
    const resp = await apiClient.post('/writing/full/generate', params);
    return resp.data as { aiQuestionId: number; status: AIQuestionStatus; title: string } & WritingFullSnapshot;
}

/** Polling for the full writing hub: how far each of the two children has got through generation, answering and marking. */
export async function getWritingFull(id: number) {
    const resp = await apiClient.get(`/writing/full/${id}/`);
    return resp.data as { id: number; title: string; createdAt: string | null } & WritingFullSnapshot;
}

/** Admin: make a question the site-wide template, or clear it. At most one per skill; setting a new one displaces the old. */
export async function setAIQuestionTemplate(id: number, on: boolean) {
    const resp = await apiClient.post(`/ai-questions/${id}/template/`, { on });
    return resp.data as AIQuestionDetail;
}

/**
 * Open a site-wide template question: the backend copies it under the current user and returns that row.
 *
 * Do not rename this back to something starting with use* - eslint's react-hooks/rules-of-hooks would treat it
 * as a React Hook and error out as soon as it is called from an ordinary event handler.
 *
 * Copying rather than sharing is mandatory: an AIQuestion row holds a single userAnswer, so a shared row would
 * let every user's answers overwrite each other. The backend dedupes on templateSourceId, copying a given template
 * only once, so repeated clicks do not pile up cards; the template's own author gets the original row back.
 */
export async function copyTemplateQuestion(id: number) {
    const resp = await apiClient.post(`/ai-questions/${id}/use/`);
    return resp.data as AIQuestionDetail;
}

/** Create the row at the start of a speaking session (no AI call, no AT charged); every later turn overwrites it through submitAIQuestion.
 *  parentId: in the full mock, pass the mock parent row's id and this session is attached as its speaking child (the backend reuses it idempotently). */
export async function startSpeakingSession(mode: string, title: string, content: Record<string, unknown>, parentId?: number) {
    const body: Record<string, unknown> = { mode, title, content };
    if (parentId) body.parentId = parentId;
    const resp = await apiClient.post('/speaking/session/start', body);
    return resp.data as { id: number; reused?: boolean };
}
