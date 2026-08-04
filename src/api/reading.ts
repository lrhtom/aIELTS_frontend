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
    fullMode: { passageCount: number; questionsByPassage: Record<string, number>; totalQuestions: number };
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
    /** User custom prompt instructions (advanced, optional) */
    customPrompt?: string;
}

export interface ReadingFullRequest {
    difficulty?: string;
    absurdMode?: boolean;
    topic?: string;
    /** Generate only passage N (1|2|3); omit to generate all 3 */
    passageNum?: 1 | 2 | 3;
    /** The question-type mix for single-passage mode (2-3 type keys); omit to use the system preset */
    mixTypes?: ReadingQuestionTypeKey[];
    /** User custom prompt instructions (advanced, optional) */
    customPrompt?: string;
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
