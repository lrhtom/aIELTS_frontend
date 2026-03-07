// ─── 类型定义 ─────────────────────────────────────────────────────────────────

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

// ─── Store 初始状态工厂 ────────────────────────────────────────────────────────

export interface ReadingState {
    step: number;              // 2 = 阅读界面, 3 = 结果界面
    isLoading: boolean;
    vocabList: VocabItem[];
    quizData: QuizData | null;
    searchQuery: string;
    isLeftOpen: boolean;
    isRightOpen: boolean;
    startTime: number;
    elapsedSeconds: number;
    isPassageOpen: boolean;
}

export function createReadingState(): ReadingState {
    return {
        step: 2,
        isLoading: true,
        vocabList: [],
        quizData: null,
        searchQuery: '',
        isLeftOpen: true,
        isRightOpen: true,
        startTime: 0,
        elapsedSeconds: 0,
        isPassageOpen: false,
    };
}