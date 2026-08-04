import { apiClient } from './client';
import type { User } from './auth';
import { currentT } from '../i18n/currentT';

export interface AvatarResponse {
    message: string;
    avatar_url?: string;
    user: User;
}

export interface AvatarError {
    error: string;
    detail?: string;
}

export const avatarApi = {
    uploadAvatar: async (file: File): Promise<AvatarResponse> => {
        const formData = new FormData();
        formData.append('avatar', file);

        const response = await apiClient.post<AvatarResponse>('/auth/avatar', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    deleteAvatar: async (): Promise<AvatarResponse> => {
        const response = await apiClient.delete<AvatarResponse>('/auth/avatar');
        return response.data;
    },

    validateImageFile: (file: File): { isValid: boolean; error?: string } => {
        // check the file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            return {
                isValid: false,
                error: currentT()('profile.avatarUpload.errFormat')
            };
        }

        // check the file size (5MB limit)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            return {
                isValid: false,
                error: currentT()('profile.avatarUpload.errSize')
            };
        }

        return { isValid: true };
    },

    // convert the file to Base64 for the preview
    fileToBase64: (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
        });
    }
};