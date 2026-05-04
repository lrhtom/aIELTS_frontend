import { apiClient } from './client';

export interface CheckinResponse {
    ok: boolean;
    bonus?: number;
    checkin_count?: number;
    balance?: number;
    message: string;
}

export interface CheckinStatusResponse {
    today_checked: boolean;
    total_checkins: number;
    today_bonus: number;
    calendar: CalendarEntry[];
    registered_date: string;
    total_year_seconds: number;
}

export interface CalendarEntry {
    date: string;
    checked: boolean;
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

export const checkinApi = {
    doCheckin: async (): Promise<CheckinResponse> => {
        const response = await apiClient.post<CheckinResponse>('/checkin');
        return response.data;
    },

    getStatus: async (): Promise<CheckinStatusResponse> => {
        const response = await apiClient.get<CheckinStatusResponse>('/checkin/status');
        return response.data;
    },
};
