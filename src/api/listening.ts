import { api } from './client';

export type ListeningQuestionTypeKey =
    | 'article'
    | 'sentence'
    | 'multiple_choice'
    | 'map'
    | 'form'
    | 'table'
    | 'flowchart'
    | 'matching'
    | 'short_answer';

export type ListeningSectionKey = 's1' | 's2' | 's3' | 's4';

export interface ListeningMeta {
    questionTypes: Array<{
        key: ListeningQuestionTypeKey;
        speakers: number;
        lengthDesc: string;
        needsWordLimit: boolean;
        legacy: boolean;
    }>;
    scenarios: Record<ListeningSectionKey, Array<{ key: string; name: string }>>;
    difficulties: string[];
    fullMode: { sectionCount: number; questionsPerSection: number };
}

export interface ListeningGenerateRequest {
    words?: string[];
    difficulty?: string;
    absurdMode?: boolean;
    practiceType?: ListeningQuestionTypeKey;
    scenario?: string;
    wordCountMin?: number;
    wordCountMax?: number;
}

export interface ListeningFullRequest {
    difficulty?: string;
    absurdMode?: boolean;
    scenarioS1?: string;
    scenarioS2?: string;
    scenarioS3?: string;
    scenarioS4?: string;
    /** 只生成第 N 段 (1|2|3|4); 省略则生成全 4 段 */
    sectionNum?: 1 | 2 | 3 | 4;
}

export function getListeningMeta(): Promise<ListeningMeta> {
    return api<ListeningMeta>('/listening/meta');
}

export function generateListening(body: ListeningGenerateRequest): Promise<unknown> {
    return api('/listening/generate', { method: 'POST', body });
}

export function generateListeningFull(body: ListeningFullRequest): Promise<unknown> {
    return api('/listening/full', { method: 'POST', body });
}
