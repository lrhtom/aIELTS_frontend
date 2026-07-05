// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export interface VocabItem {
    word: string;
    meaning: string;
}

// ── 现有 4 种题型的 Question ──
export interface ListeningQuestion {
    id: number;
    question: string;
    answers: string[];
    explanation: string;
}

export interface MultipleChoiceQuestion {
    id: number;
    question: string;
    options: Record<string, string>;
    answer: string;
    explanation: string;
}

export interface ArticleListeningData {
    type: 'article';
    title: string;
    passage: string;
    blanked_passage: string;
    questions: ListeningQuestion[];
}

export interface SentenceListeningData {
    type: 'sentence';
    title: string;
    passage: string;
    questions: ListeningQuestion[];
}

export interface MultipleChoiceListeningData {
    type: 'multiple_choice';
    title: string;
    passage: string;
    questions: MultipleChoiceQuestion[];
}

// ── 地图 (保留) ──
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
    // FLUX.2-pro rendered map image. When present the frontend renders <img>
    // instead of the landmark-based SVG (see ListeningMapSVG). Legacy bank
    // records without this field keep working via the SVG fallback.
    //
    // `imagePath` is a media-relative key (e.g. `maps/2/abc.png`) — pass through
    // `mediaUrl()` to get the env-appropriate full URL. `imageUrl` is retained
    // only to read very old records that stored an absolute `/media/...` URL.
    imagePath?: string;
    imageUrl?: string;
    imageModel?: string;
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

// ── 5 种新题型的 Data ──
// Form / Table / Flowchart / ShortAnswer 都是 text-answer 类型: 只是 layout 不同
export interface FormListeningData {
    type: 'form';
    title: string;
    passage: string;
    scenario?: string;
    form_intro?: string;
    form_content: string;
    questions: ListeningQuestion[];   // answers[]
}

export interface TableListeningData {
    type: 'table';
    title: string;
    passage: string;
    scenario?: string;
    table_intro?: string;
    table_content: string;
    questions: ListeningQuestion[];
}

export interface FlowchartListeningData {
    type: 'flowchart';
    title: string;
    passage: string;
    scenario?: string;
    flowchart_intro?: string;
    flowchart_content: string;
    questions: ListeningQuestion[];
}

export interface ShortAnswerListeningData {
    type: 'short_answer';
    title: string;
    passage: string;
    scenario?: string;
    short_intro?: string;
    questions: ListeningQuestion[];    // has question text + answers[]
}

// Matching: 5 items each mapped to letter A-G
export interface MatchingListeningItem {
    id: number;
    question: string;   // 项目名字
    answer: string;     // 字母 A-G
    explanation: string;
}

export interface MatchingListeningData {
    type: 'matching';
    title: string;
    passage: string;
    scenario?: string;
    matching_intro?: string;
    options_bank: Record<string, string>;
    questions: MatchingListeningItem[];
}

export type SingleListeningData =
    | ArticleListeningData
    | SentenceListeningData
    | MultipleChoiceListeningData
    | MapListeningData
    | FormListeningData
    | TableListeningData
    | FlowchartListeningData
    | ShortAnswerListeningData
    | MatchingListeningData;

// ── 综合套题 (4 sections) ──
export interface SectionSubsection {
    type: 'multiple_choice' | 'map' | 'matching';
    instructions?: string;
    startId: number;
    endId: number;
    questions: (MultipleChoiceQuestion | MapQuestion | MatchingListeningItem)[];
    // 可能出现的字段
    options?: string[];                         // map: 选项列表 A-H
    map?: MapData;                              // map
    options_bank?: Record<string, string>;      // matching
}

export interface FullListeningSection {
    sectionNum: 1 | 2 | 3 | 4;
    sectionType: 'form' | 'mixed' | 'note';
    title: string;
    passage: string;
    scenario?: string;
    // Section 1: form / Section 4: note — 单题型
    form_intro?: string;
    form_content?: string;
    note_intro?: string;
    note_content?: string;
    // Section 2/3: subsections
    subsections?: SectionSubsection[];
    // 平铺后的完整题目 (backend 已合并到 flat questions)
    questions: (ListeningQuestion | MultipleChoiceQuestion | MapQuestion | MatchingListeningItem)[];
}

export interface FullListeningData {
    type: 'full';
    title: string;
    singleSection: boolean;
    sections: FullListeningSection[];
}

export type ListeningData = SingleListeningData | FullListeningData;

// Legacy narrowed union for existing render paths
export type LegacyListeningData = ArticleListeningData | SentenceListeningData | MultipleChoiceListeningData | MapListeningData;

// ─── Store 初始状态工厂 ────────────────────────────────────────────────────────

export interface ListeningState {
    step: number;
    isLoading: boolean;
    vocabList: VocabItem[];
    listeningData: ListeningData | null;
    activeSection: 1 | 2 | 3 | 4;
    isRightOpen: boolean;
    isPassageOpen: boolean;
}

export function createListeningState(): ListeningState {
    return {
        step: 2,
        isLoading: true,
        vocabList: [],
        listeningData: null,
        activeSection: 1,
        isRightOpen: true,
        isPassageOpen: false,
    };
}
