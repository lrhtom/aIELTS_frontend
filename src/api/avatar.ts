import { apiClient } from './client';

export interface AvatarResponse {
    message: string;
    avatar_url?: string;
    user: {
        id: string;
        username: string;
        email: string;
        avatar_url?: string;
        atBalance: number;
    };
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
        // 检查文件类型
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            return {
                isValid: false,
                error: '只支持以下图片格式: JPG, PNG, GIF, WebP'
            };
        }

        // 检查文件大小 (5MB限制)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            return {
                isValid: false,
                error: '图片大小不能超过5MB'
            };
        }

        return { isValid: true };
    },

    // 将文件转换为Base64用于预览
    fileToBase64: (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
        });
    }
};