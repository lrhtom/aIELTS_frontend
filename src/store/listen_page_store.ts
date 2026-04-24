// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export interface VocabItem {
    word: string;
    meaning: string;
}

export interface ListeningQuestion {
    id: number;
    question: string;        // 填空题目文本，空格用 _____ 表示
    answers: string[];       // 多个可接受答案
    explanation: string;
}

export interface MultipleChoiceQuestion {
    id: number;
    question: string;
    options: Record<string, string>; // A, B, C, D
    answer: string;                  // 正确答案字母
    explanation: string;
}

export interface ArticleListeningData {
    type: 'article';
    title: string;
    passage: string;
    blanked_passage: string; // 文章填空模式独有
    questions: ListeningQuestion[];
}

export interface SentenceListeningData {
    type: 'sentence';
    title: string;
    passage: string;         // 用于语音合成和结果核对
    questions: ListeningQuestion[];
}

export interface MultipleChoiceListeningData {
    type: 'multiple_choice';
    title: string;
    passage: string;
    questions: MultipleChoiceQuestion[];
}

// ─── 地图标注题类型 ─────────────────────────────────────────────────────────

export interface MapLandmark {
    id: string;
    label: string;
    x: number;
    y: number;
    shape: 'rect' | 'circle';
    w?: number;
    h?: number;
    r?: number;
    questionId?: number;
}

export interface MapPath {
    points: [number, number][];
    label?: string;
}

export interface MapDecoration {
    type: 'tree' | 'lake' | 'garden' | 'parking' | 'fountain';
    x: number;
    y: number;
    w?: number;
    h?: number;
}

export interface MapData {
    name: string;
    width: number;
    height: number;
    landmarks: MapLandmark[];
    paths: MapPath[];
    decorations: MapDecoration[];
}

export interface MapQuestion {
    id: number;
    answer: string;
    explanation: string;
}

export interface MapListeningData {
    type: 'map';
    title: string;
    passage: string;
    map: MapData;
    options: string[];
    questions: MapQuestion[];
}

export type ListeningData = ArticleListeningData | SentenceListeningData | MultipleChoiceListeningData | MapListeningData;

// ─── Store 初始状态工厂 ────────────────────────────────────────────────────────

export interface ListeningState {
    step: number;              // 2 = 练习界面, 3 = 结果界面
    isLoading: boolean;
    vocabList: VocabItem[];
    listeningData: ListeningData | null;
    isRightOpen: boolean;
    isPassageOpen: boolean;
}

export function createListeningState(): ListeningState {
    return {
        step: 2,
        isLoading: true,
        vocabList: [],
        listeningData: null,
        isRightOpen: true,
        isPassageOpen: false,
    };
}
