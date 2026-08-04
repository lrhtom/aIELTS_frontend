import { apiClient } from './client';

/** Backpack item types (aligned with the backend's UserItem.ItemType) */
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
