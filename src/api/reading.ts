import { api } from './client';

export type ReadingQuestionTypeKey =
    | 'multiple_choice'
    | 'true_false'
    | 'yes_no'
    | 'matching_headings'
    | 'matching_info'
    | 'matching_features'
    | 'matching_sentence'
    | 'sentence_completion'
    | 'summary_completion'
    | 'note_completion'
    | 'short_answer';

export type ReadingJudgementMode = 'easy' | 'normal';

export interface ReadingMeta {
    questionTypes: Array<{
        key: ReadingQuestionTypeKey;
        needsWordLimit: boolean;
        needsLabelledParagraphs: boolean;
    }>;
    topics: Array<{ key: string; name: string }>;
    difficulties: string[];
    judgementModes: ReadingJudgementMode[];
    fullMode: { passageCount: number; questionsPerPassage: number };
}

export interface ReadingGenerateRequest {
    words?: string[];
    difficulty?: string;
    absurdMode?: boolean;
    questionType?: ReadingQuestionTypeKey;
    judgementMode?: ReadingJudgementMode;
    topic?: string;
    wordCountMin?: number;
    wordCountMax?: number;
}

export interface ReadingFullRequest {
    difficulty?: string;
    absurdMode?: boolean;
    topic?: string;
    /** 只生成第 N 篇 (1|2|3); 省略则生成全 3 篇 */
    passageNum?: 1 | 2 | 3;
    /** 单篇模式下的题型组合 (2-3 种题型 key); 省略则用系统预设 */
    mixTypes?: ReadingQuestionTypeKey[];
}

export function getReadingMeta(): Promise<ReadingMeta> {
    return api<ReadingMeta>('/reading/meta');
}

export function generateReading(body: ReadingGenerateRequest): Promise<unknown> {
    return api('/reading/generate', { method: 'POST', body });
}

export function generateReadingFull(body: ReadingFullRequest): Promise<unknown> {
    return api('/reading/full', { method: 'POST', body });
}
