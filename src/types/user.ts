export interface User {
    id: string;
    email: string;
    username: string;
    nickname?: string;
    avatar_url?: string;
    target_score?: string | null;
    current_score?: string | null;
    exam_date?: string | null;
    membership_tier?: string;
    vip_expires_at?: string | null;
    daily_ai_quota?: number;
    is_email_verified?: boolean;
    last_login?: string | null;
    createdAt: string;
    updatedAt: string;
    atBalance: number; // AT balance
}