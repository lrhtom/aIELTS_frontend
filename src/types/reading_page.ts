export interface VocabItem {
    word: string;
    meaning: string;
}

export interface Question {
    id: number;
    question: string;
    options: Record<string, string>;
    answer: string;
    explanation: string;
}

export interface QuizData {
    title: string;
    passage: string;
    questions: Question[];
}