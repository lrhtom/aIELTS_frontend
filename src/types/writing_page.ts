export type WritingTaskType = 'task1' | 'task2';
export type WritingStep = 'loading' | 'answering' | 'settlement' | 'evaluating' | 'result';

export interface CorrectionResponse {
    Task_Response: number;
    Coherence_Cohesion: number;
    Lexical_Resource: number;
    Grammatical_Range: number;
    Overall_Band: number;
    word_count?: number;
    Feedback?: string;
    feedback?: string;
    Model_Essay?: string;
    Revised_Essay?: string;
    Actionable_Advice?: string[];
    Sentence_Corrections?: {
        original: string;
        improved: string;
        error_type: string;
        severity?: 'warning' | 'suggestion';
        explanation: string;
    }[];
    Vocabulary_Upgrades?: {
        original: string;
        upgrades: string[];
        context: string;
    }[];
    Topic_Vocabulary?: {
        word: string;
        meaning: string;
        example: string;
    }[];
}
