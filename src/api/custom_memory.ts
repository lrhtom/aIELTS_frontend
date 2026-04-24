import { apiClient } from './client';

export interface CustomMemoryDeck {
    id: number;
    title: string;
    daily_count: number;
    source_text: string;
    card_count: number;
    has_activity_today: boolean;
    today_target: number;
    studied_today: number;
    created_at: string;
    updated_at: string;
}

export interface CustomMemoryCard {
    id: number;
    deck_id: number;
    front_text: string;
    back_text: string;
    order: number;
    due: string;
    stability: number;
    difficulty: number;
    elapsed_days: number;
    scheduled_days: number;
    reps: number;
    lapses: number;
    state: number;
    last_review: string | null;
}

export interface CustomMemoryStats {
    total: number;
    new: number;
    due: number;
    studied_today: number;
    remaining_today: number;
    today_target: number;
}

export async function listCustomDecks() {
    const resp = await apiClient.get('/custom-memory/decks/');
    return resp.data as {
        decks: CustomMemoryDeck[];
    };
}

export async function createCustomDeck(title: string, text: string, dailyCount: number) {
    const resp = await apiClient.post('/custom-memory/decks/', { title, text, daily_count: dailyCount });
    return resp.data as {
        deck: CustomMemoryDeck;
        cards: CustomMemoryCard[];
        stats: CustomMemoryStats;
    };
}

export async function appendCustomDeck(deckId: number, text: string) {
    const resp = await apiClient.post(`/custom-memory/decks/${deckId}/append/`, { text });
    return resp.data as {
        deck: CustomMemoryDeck;
        cards_added: number;
        stats: CustomMemoryStats;
    };
}

export async function startCustomDeck(deckId: number, dueOnly = false, useDailyLimit = true) {
    const resp = await apiClient.post(`/custom-memory/decks/${deckId}/start/`, {
        due_only: dueOnly,
        use_daily_limit: useDailyLimit,
    });
    return resp.data as {
        deck: CustomMemoryDeck;
        cards: CustomMemoryCard[];
        stats: CustomMemoryStats;
    };
}

export async function reviewCustomCard(cardId: number, rating: number, clientLastReview: string | null) {
    const resp = await apiClient.post('/custom-memory/review/', {
        card_id: cardId,
        rating,
        client_last_review: clientLastReview,
    });
    return resp.data as { card: CustomMemoryCard };
}
