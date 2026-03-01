// types.ts
export type Role = 'user' | 'assistant' | 'system';

export interface Message {
    role: Role;
    content: string;
}

export interface WordItem {
    en: string;
    zh: string;
    count: number;
}