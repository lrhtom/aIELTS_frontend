// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export interface VocabItem {
    word: string;
    meaning: string;
}

export type ReadingQuestionType =
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

// ── Question shape 是宽松联合: 各题型只用其中一部分字段 ──
export interface Question {
    id: number;
    explanation: string;
    // 大部分题型有 question 文本, matching_headings 用 paragraph, note_completion 无
    question?: string;
    paragraph?: string;
    // 单答案 (MCQ / TF / YN / matching_*): 字母或 True/False/...
    answer?: string;
    // 多个可接受答案 (sentence_completion / short_answer / note_completion)
    answers?: string[];
    // 选项字典 (MCQ / TF / YN)
    options?: Record<string, string>;
}

// ── 单题型 QuizData ──
export interface QuizData {
    title: string;
    passage: string;
    topic?: string;
    questionType: ReadingQuestionType;
    questions: Question[];
    judgementMode?: ReadingJudgementMode | null;
    // 题型专属字段 (来自 backend passthrough)
    headings_bank?: Record<string, string>;
    paragraph_labels?: string[];
    features_bank?: Record<string, string>;
    endings_bank?: Record<string, string>;
    summary_intro?: string;
    summary_text?: string;
    word_bank?: Record<string, string>;
    note_intro?: string;
    note_content?: string;
    layout?: 'notes' | 'table' | 'flowchart';
    wordLimit?: string;
}

// ── 综合套题 ──
export interface FullPassageSection {
    questionType: ReadingQuestionType;
    instructions: string;
    startId: number;
    endId: number;
    questions: Question[];
    headings_bank?: Record<string, string>;
    paragraph_labels?: string[];
    features_bank?: Record<string, string>;
    endings_bank?: Record<string, string>;
    summary_intro?: string;
    summary_text?: string;
    word_bank?: Record<string, string>;
    note_intro?: string;
    note_content?: string;
    layout?: 'notes' | 'table' | 'flowchart';
    wordLimit?: string;
}

export interface FullPassage {
    passageNum: number;
    title: string;
    passage: string;
    topic?: string;
    sections: FullPassageSection[];
}

export interface FullQuizData {
    title: string;
    topic?: string;
    questionType: 'full';
    singlePassage: boolean;
    passages: FullPassage[];
}

// ─── Store 初始状态工厂 ────────────────────────────────────────────────────────

export interface ReadingState {
    step: number;              // 2 = 阅读界面, 3 = 结果界面
    isLoading: boolean;
    vocabList: VocabItem[];
    quizData: QuizData | null;
    fullData: FullQuizData | null;   // 综合套题数据 (mode = 'full')
    activePassage: number;           // 综合套题当前选中的 passage 编号
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
        fullData: null,
        activePassage: 1,
        searchQuery: '',
        isLeftOpen: true,
        isRightOpen: true,
        startTime: 0,
        elapsedSeconds: 0,
        isPassageOpen: false,
    };
}
