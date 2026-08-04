// Full mock exam API - generation orchestration plus the exam state machine
import { api } from './client';
import type { AIQuestionStatus, MockPartStatus } from './ai_question';

export type MockExamPart = 'listening' | 'reading' | 'writing' | 'speaking';
export type MockGenSlot = 'listening' | 'reading' | 'writingTask1' | 'writingTask2';

export interface MockGenerateRequest {
    difficulty?: string;
    absurdMode?: boolean;
    customName?: string;
    customPrompt?: string;
    scenarioS1?: string;
    scenarioS2?: string;
    scenarioS3?: string;
    scenarioS4?: string;
    readingTopic?: string;
    /** 'random' is resolved by the backend (stored in the config snapshot, so a regeneration keeps the same type) */
    task1Type?: string;
    task2Type?: string;
    task2TopicCategory?: string;
}

export interface MockChildView {
    id: number;
    skill: string;
    subtype: string;
    title: string;
    status: AIQuestionStatus;
    errorMessage: string;
    isAnswered: boolean;
    hasFeedback: boolean;
    band: number | null;
}

export interface MockPartView {
    status: MockPartStatus;
    genStatus: AIQuestionStatus;
    startedAt: string | null;
    deadline: string | null;
    submittedAt: string | null;
    /** listening / reading / speaking */
    child?: MockChildView | null;
    /** writing */
    task1?: MockChildView | null;
    task2?: MockChildView | null;
}

export interface MockReport {
    bands: Record<MockExamPart, number>;
    overall: number;
    detail?: Record<string, unknown>;
    finalizedAt?: string;
}

export interface MockDetail {
    id: number;
    title: string;
    status: AIQuestionStatus;
    errorMessage: string;
    createdAt: string | null;
    config: Record<string, unknown>;
    order: MockExamPart[];
    durations: Record<MockExamPart, number | null>;
    graceSec: number;
    /** The server's current time (used to calibrate the client clock offset) */
    now: string;
    parts: Record<MockExamPart, MockPartView>;
    report: MockReport | null;
}

export interface MockPartStartResponse {
    part: MockExamPart;
    exam: { status: string; startedAt: string; deadline?: string };
    resumed: boolean;
    now: string;
    durationSec: number | null;
}

export function generateMock(body: MockGenerateRequest) {
    return api<{ mockId: number; status: AIQuestionStatus; title: string }>(
        '/mock/generate', { method: 'POST', body },
    );
}

export function getMockDetail(id: number) {
    return api<MockDetail>(`/mock/${id}`);
}

export function startMockPart(id: number, part: MockExamPart) {
    return api<MockPartStartResponse>(`/mock/${id}/part/${part}/start`, { method: 'POST', body: {} });
}

export function forfeitMockPart(id: number, part: MockExamPart) {
    return api<{ part: MockExamPart; exam: { status: string } }>(
        `/mock/${id}/part/${part}/forfeit`, { method: 'POST', body: {} },
    );
}

export function finalizeMock(id: number, report: MockReport) {
    return api<{ report: MockReport; already: boolean }>(
        `/mock/${id}/finalize`, { method: 'POST', body: { report } },
    );
}

export function regenerateMockSlot(id: number, slot: MockGenSlot) {
    return api<{ slot: MockGenSlot; questionId: number; status: AIQuestionStatus }>(
        `/mock/${id}/regenerate`, { method: 'POST', body: { slot } },
    );
}
