import { apiClient } from './client';

export interface StoreProduct {
    id: number;
    name: string;
    description: string;
    price_amount: string;
    price_currency: string;
    reward_type: string;
    reward_amount: number;
}

export async function listProducts(): Promise<{ products: StoreProduct[] }> {
    const resp = await apiClient.get('/store/products');
    return resp.data;
}

export async function purchaseProduct(productId: number): Promise<{ message: string; new_balance?: number }> {
    const resp = await apiClient.post('/store/purchase', { product_id: productId });
    return resp.data;
}

export interface CartItem {
    cart_item_id: number;
    product_id: number;
    name: string;
    price_amount: string;
    price_currency: string;
    quantity: number;
}

export interface CartData {
    items: CartItem[];
    total_items: number;
    total_cny: string;
}

export async function getCart(): Promise<CartData> {
    const resp = await apiClient.get('/store/cart/');
    return resp.data;
}

export async function addToCart(productId: number, quantity: number = 1): Promise<{ message: string; quantity: number }> {
    const resp = await apiClient.post('/store/cart/add', { product_id: productId, quantity });
    return resp.data;
}

export async function removeFromCart(productId: number, quantity: number = 1, deleteAll: boolean = false): Promise<{ message: string; quantity: number }> {
    const resp = await apiClient.post('/store/cart/remove', { product_id: productId, quantity, delete_all: deleteAll });
    return resp.data;
}

export async function checkoutCart(): Promise<{ message: string; new_balance?: number }> {
    const resp = await apiClient.post('/store/cart/checkout');
    return resp.data;
}
