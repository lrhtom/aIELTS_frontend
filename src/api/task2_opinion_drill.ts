import { api } from './client';

export type OpinionDrillCategory =
    | 'education'
    | 'technology'
    | 'culture'
    | 'urbanization'
    | 'government'
    | 'environment'
    | 'media'
    | 'society'
    | 'abstract'
    | 'random';

export interface OpinionDrillQuestion {
    id: number;
    category: OpinionDrillCategory;
    styleId: number;
    prompt: string;
}

export interface OpinionDrillEvaluation {
    scores: {
        grammar: number;
        relevance: number;
        vocabulary: number;
    };
    overall: number;
    feedback: string;
    referenceAnswer: string;
}

export async function generateOpinionDrillQuestions(payload: {
    count: number;
    categories: OpinionDrillCategory[];
}): Promise<{ questions: OpinionDrillQuestion[]; atConsumed?: number }> {
    return api('/writing/task2/opinion-drill/generate', {
        method: 'POST',
        body: payload,
    });
}

export async function evaluateOpinionDrillAnswer(payload: {
    prompt: string;
    userAnswer: string;
    lang: 'zh' | 'en';
}): Promise<OpinionDrillEvaluation & { atConsumed?: number }> {
    return api('/writing/task2/opinion-drill/evaluate', {
        method: 'POST',
        body: payload,
    });
}
