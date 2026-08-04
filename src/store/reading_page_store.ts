// --- Type definitions ---------------------------------------------------------

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

// -- Question shape is a loose union: each question type uses only some of the fields --
export interface Question {
    id: number;
    explanation: string;
    // most types have question text; matching_headings uses paragraph and note_completion has none
    question?: string;
    paragraph?: string;
    // single answer (MCQ / TF / YN / matching_*): a letter or True/False/...
    answer?: string;
    // several acceptable answers (sentence_completion / short_answer / note_completion)
    answers?: string[];
    // option dictionary (MCQ / TF / YN)
    options?: Record<string, string>;
}

// -- Single-type QuizData --
export interface QuizData {
    title: string;
    passage: string;
    topic?: string;
    questionType: ReadingQuestionType;
    questions: Question[];
    judgementMode?: ReadingJudgementMode | null;
    // question-type-specific fields (passed through from the backend)
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

// -- Combined paper --
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

// --- Store initial state factory ----------------------------------------------

export interface ReadingState {
    step: number;              // 2 = the reading view, 3 = the results view
    isLoading: boolean;
    vocabList: VocabItem[];
    quizData: QuizData | null;
    fullData: FullQuizData | null;   // combined paper data (mode = 'full')
    activePassage: number;           // the passage number currently selected in a combined paper
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
        // The results page expands the passage by default: checking answers almost always needs it, and making the user open it again is busywork
        isPassageOpen: true,
    };
}
