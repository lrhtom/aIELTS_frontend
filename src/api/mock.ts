// 全套模拟 (Mock Exam) API — 生成编排 + 考试状态机
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
    /** 'random' 由后端定型（存入配置快照，重生成同型） */
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
    /** 服务端当前时间（校准客户端时钟偏移用） */
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
