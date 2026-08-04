// --- Type definitions ---------------------------------------------------------

export interface VocabItem {
    word: string;
    meaning: string;
}

// -- Question types for the existing 4 formats --
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

// -- Map (kept) --
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

// -- Data for the 5 new question types --
// Form / Table / Flowchart / ShortAnswer are all text-answer types: only the layout differs
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
    question: string;   // item name
    answer: string;     // letters A-G
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

// -- Combined paper (4 sections) --
export interface SectionSubsection {
    type: 'multiple_choice' | 'map' | 'matching';
    instructions?: string;
    startId: number;
    endId: number;
    questions: (MultipleChoiceQuestion | MapQuestion | MatchingListeningItem)[];
    // fields that may appear
    options?: string[];                         // map: option list A-H
    map?: MapData;                              // map
    options_bank?: Record<string, string>;      // matching
}

export interface FullListeningSection {
    sectionNum: 1 | 2 | 3 | 4;
    sectionType: 'form' | 'mixed' | 'note';
    title: string;
    passage: string;
    scenario?: string;
    // Section 1: form / Section 4: note - single question type
    form_intro?: string;
    form_content?: string;
    note_intro?: string;
    note_content?: string;
    // Section 2/3: subsections
    subsections?: SectionSubsection[];
    // the flattened complete question list (the backend already merges them into flat questions)
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

// --- Store initial state factory ----------------------------------------------

export interface ListeningState {
    step: number;
    isLoading: boolean;
    vocabList: VocabItem[];
    listeningData: ListeningData | null;
    activeSection: 1 | 2 | 3 | 4;
    isRightOpen: boolean;
    isPassageOpen: boolean;
    // time on task (matching reading_page_store; the audio playback position playbackTime is a separate thing)
    startTime: number;
    elapsedSeconds: number;
}

export function createListeningState(): ListeningState {
    return {
        step: 2,
        isLoading: true,
        vocabList: [],
        listeningData: null,
        activeSection: 1,
        isRightOpen: true,
        // The results page expands the transcript by default: checking answers almost always needs it, and making the user open it again is busywork
        isPassageOpen: true,
        startTime: 0,
        elapsedSeconds: 0,
    };
}
