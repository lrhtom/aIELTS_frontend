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
}
