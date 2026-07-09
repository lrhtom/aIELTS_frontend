import { apiClient } from './client';

export interface CheckinResponse {
    ok: boolean;
    bonus?: number;
    checkin_count?: number;
    checkin_streak?: number;
    card_awarded?: number;
    balance?: number;
    message: string;
}

export interface CheckinStatusResponse {
    today: string;
    today_checked: boolean;
    total_checkins: number;
    current_streak: number;
    makeup_cards: number;
    makeup_window_days: number;
    today_bonus: number;
    calendar: CalendarEntry[];
    registered_date: string;
    total_year_seconds: number;
}

export interface CalendarEntry {
    date: string;
    checked: boolean;
    makeup: boolean;
    streak: number;
    bonus: number;
    count: number;
    activity: boolean;
    practice: number;
    speaking: number;
    listening: number;
    reading: number;
    writing: number;
    vocab: number;
    learning_seconds: number;
}

export interface MakeupResponse {
    ok: boolean;
    bonus?: number;
    balance?: number;
    date?: string;
    makeup_cards?: number;
    message: string;
}

export const checkinApi = {
    doCheckin: async (): Promise<CheckinResponse> => {
        const response = await apiClient.post<CheckinResponse>('/checkin');
        return response.data;
    },

    getStatus: async (): Promise<CheckinStatusResponse> => {
        const response = await apiClient.get<CheckinStatusResponse>('/checkin/status');
        return response.data;
    },

    makeup: async (date: string): Promise<MakeupResponse> => {
        const response = await apiClient.post<MakeupResponse>('/checkin/makeup', { date });
        return response.data;
    },
};
