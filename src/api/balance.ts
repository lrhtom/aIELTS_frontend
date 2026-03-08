import { apiClient } from './client';

export interface BalanceResponse {
    atBalance: number;
    lastTransaction?: string;
    transactionCount?: number;
}

export interface TransactionRequest {
    amount: number;
    description: string;
    type: 'consume' | 'reward' | 'refund';
}

export const balanceApi = {
    getBalance: async (): Promise<BalanceResponse> => {
        const response = await apiClient.get('/balance');
        return response.data;
    },

    updateBalance: async (transaction: TransactionRequest): Promise<BalanceResponse> => {
        const response = await apiClient.post('/balance/transactions', transaction);
        return response.data;
    },

    checkBalance: async (requiredAmount: number): Promise<boolean> => {
        const balance = await balanceApi.getBalance();
        return balance.atBalance >= requiredAmount;
    },

    consumeAT: async (amount: number, description: string): Promise<BalanceResponse> => {
        return await balanceApi.updateBalance({
            amount,
            description,
            type: 'consume'
        });
    },
};