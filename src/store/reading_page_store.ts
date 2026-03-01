import { reactive } from '../utils/reactive';

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

// ─── 响应式 Store ─────────────────────────────────────────────────────────────

export const readingStore = reactive({
    // 流程控制
    step: 2 as number,           // 2 = 阅读界面, 3 = 结果界面
    isLoading: true as boolean,

    // 数据
    vocabList: [] as VocabItem[],
    quizData: null as QuizData | null,

    // UI 状态
    searchQuery: '' as string,
    isLeftOpen: true as boolean,
    isRightOpen: true as boolean,
});

/** 重置 store 到初始状态（进入新阅读前调用） */
export function resetReadingStore() {
    readingStore.step = 2;
    readingStore.isLoading = true;
    readingStore.vocabList = [];
    readingStore.quizData = null;
    readingStore.searchQuery = '';
    readingStore.isLeftOpen = true;
    readingStore.isRightOpen = true;
}