import { apiClient } from './client';

export interface User {
    id: string;
    email: string;
    username: string;
    nickname?: string;
    avatar_url?: string;
    target_score?: string | null;
    target_listening?: string | null;
    target_reading?: string | null;
    target_writing?: string | null;
    target_speaking?: string | null;
    current_score?: string | null;
    exam_date?: string | null;
    membership_tier?: string;
    vip_expires_at?: string | null;
    daily_ai_quota?: number;
    is_email_verified?: boolean;
    last_login?: string | null;
    createdAt: string;
    updatedAt: string;
    atBalance: number;
    is_staff?: boolean;
    is_superuser?: boolean;
    bg_color?: string | null;
    bg_image_url?: string | null;
    bg_blur?: number | null;
    aiGenerationRetryCount?: number;
    targetVocabName?: string | null;
    languagePreference?: string;
    aiProvider?: string;
}

export interface AuthResponse {
    message?: string;
    user: User;
    tokens?: {
        access: string;
        refresh: string;
    };
}

export const authApi = {
    login: async (username: string, password: string): Promise<AuthResponse> => {
        const response = await apiClient.post('/auth/login', { username, password });
        // The backend DRF simplejwt token_obtain_pair view returns { access, refresh } by default
        // We might want to fetch the profile right after to get the user object
        const tokens = response.data;
        const profileResponse = await apiClient.get('/auth/profile', {
            headers: {
                Authorization: `Bearer ${tokens.access}`,
            },
        });

        return {
            user: profileResponse.data.user,
            tokens: tokens
        };
    },

    register: async (data: Record<string, string>): Promise<AuthResponse> => {
        const response = await apiClient.post('/auth/register', data);
        return response.data;
    },

    sendVerificationCode: async (email: string, username: string): Promise<void> => {
        await apiClient.post('/auth/send-code', { email, username });
    },

    getProfile: async (): Promise<User> => {
        const response = await apiClient.get('/auth/profile');
        return response.data.user;
    },

    deleteAccount: async (): Promise<void> => {
        await apiClient.delete('/auth/delete-account');
    },

    resetPassword: async (identifier: string, newPassword: string): Promise<{ message: string }> => {
        const response = await apiClient.post('/auth/reset-password', { identifier, new_password: newPassword });
        return response.data;
    },

    changeUsername: async (newUsername: string): Promise<{ message: string; username: string; at_balance: number }> => {
        const response = await apiClient.post('/auth/change-username', { new_username: newUsername });
        return response.data;
    },

    updateSettings: async (settings: {
        ai_generation_retry_count?: number;
        target_vocab_name?: string;
        language_preference?: string;
        ai_provider?: string;
        target_listening?: number | string | null;
        target_reading?: number | string | null;
        target_writing?: number | string | null;
        target_speaking?: number | string | null;
        exam_date?: string | null;
    }): Promise<User> => {
        const response = await apiClient.put('/auth/settings', settings);
        return response.data.user;
    },
};
