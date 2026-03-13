import { apiClient } from './client';

export interface VocabCard {
    word:           string;
    zh:             string;
    due:            string;       // ISO datetime
    stability:      number;
    difficulty:     number;
    elapsed_days:   number;
    scheduled_days: number;
    reps:           number;
    lapses:         number;
    state:          number;       // 0=New 1=Learning 2=Review 3=Relearning
    last_review:    string | null;
    // Word enrichment (empty when Word row doesn't exist)
    phonetic:       string;
    grammar:        string;
    definitions:    Array<{ pos: string; meaning: string }>;
    examples:       Array<{ en: string; zh: string }>;
}

export interface VocabStats {
    total: number;
    new:   number;  // state=0
    due:   number;  // state!=0 且 due<=now
}

/** 批量同步词汇，返回全部卡片状态及统计 */
export async function syncVocab(words: Array<{ word: string; zh: string }>) {
    const resp = await apiClient.post('/vocab/sync', { words });
    return resp.data as { cards: VocabCard[]; stats: VocabStats };
}

/** 获取用户全部卡片，dueOnly=true 仅返回今日到期 */
export async function getCards(dueOnly = false) {
    const resp = await apiClient.get('/vocab/cards', {
        params: dueOnly ? { due_only: 'true' } : {},
    });
    return resp.data as { cards: VocabCard[]; stats: VocabStats };
}

/** 提交复习评分（1=忘了 / 2=困难 / 3=一般 / 4=容易） */
export async function submitReview(
    word:             string,
    rating:           number,
    clientLastReview: string | null,
) {
    const resp = await apiClient.post('/vocab/review', {
        word,
        rating,
        client_last_review: clientLastReview,
    });
    return resp.data as { card: VocabCard };
}
