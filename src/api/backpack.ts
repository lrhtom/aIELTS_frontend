import { apiClient } from './client';

/** 背包物品类型（与后端 UserItem.ItemType 对齐） */
export type ItemType = 'makeup_card';

export interface BackpackItem {
    item_type: ItemType | string;
    quantity: number;
}

export interface BackpackResponse {
    items: BackpackItem[];
}

export async function getBackpack(): Promise<BackpackResponse> {
    const resp = await apiClient.get<BackpackResponse>('/backpack');
    return resp.data;
}
