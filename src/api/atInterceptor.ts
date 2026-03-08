import { apiClient } from './client';
import { balanceApi } from './balance';
import { calculateCost } from '../config/ai_cost';

export interface ATInterceptorOptions {
    service: string;
    params?: Record<string, number>;
    requiredBalance?: number;
}

export class ATInterceptor {
    private static async checkAndConsume(options: ATInterceptorOptions): Promise<boolean> {
        // 计算预估成本
        const estimatedCost = calculateCost(options.service, options.params);

        // 获取当前余额
        const balance = await balanceApi.getBalance();

        if (balance.atBalance < estimatedCost) {
            console.error(`AT币余额不足: ${balance.atBalance} AT < ${estimatedCost} AT`);
            window.dispatchEvent(new CustomEvent('at-balance-insufficient', {
                detail: {
                    message: `AT币余额不足，需要 ${estimatedCost} AT，当前余额 ${balance.atBalance} AT`,
                    estimatedCost,
                    currentBalance: balance.atBalance
                }
            }));
            return false;
        }

        return true;
    }

    static async intercept<T>(
        service: string,
        apiCall: () => Promise<T>,
        params?: Record<string, number>
    ): Promise<T> {
        // 先检查余额
        const canProceed = await this.checkAndConsume({
            service,
            params
        });

        if (!canProceed) {
            throw new Error('AT币余额不足');
        }

        // 执行API调用
        const result = await apiCall();

        // 尝试从响应中获取实际消耗的AT币数量
        try {
            // 如果响应包含atConsumed信息，记录消耗
            if (typeof result === 'object' && result !== null && 'atConsumed' in result) {
                const consumed = (result as { atConsumed: number }).atConsumed;
                console.log(`AT币消耗完成: ${consumed} AT`);

                // 更新本地余额缓存（可选）
                window.dispatchEvent(new CustomEvent('at-consumed', {
                    detail: {
                        consumed,
                        service,
                        description: `${service}服务调用`
                    }
                }));
            }
        } catch (error) {
            console.error('AT币消耗记录失败:', error);
        }

        return result;
    }

    // 封装常见的API调用
    static async speakingChat(messages: Array<Record<string, unknown>>, params?: Record<string, number>) {
        return this.intercept('speaking', () =>
            apiClient.post<{ reply: string, grammar_score: number, vocab_score: number, relevance_score: number, atConsumed?: number }>('/speaking/chat', { messages }),
            params
        );
    }

    static async readingExercise(params?: Record<string, number>) {
        return this.intercept('reading', () =>
            apiClient.post('/reading/exercise'),
            params
        );
    }

    static async listeningExercise(params?: Record<string, number>) {
        return this.intercept('listening', () =>
            apiClient.post('/listening/exercise'),
            params
        );
    }

    static async writingCorrection(params?: Record<string, number>) {
        return this.intercept('writing', () =>
            apiClient.post('/writing/correction'),
            params
        );
    }

    static async promptGeneration(params?: Record<string, number>) {
        return this.intercept('prompt', () =>
            apiClient.post('/prompt/generate'),
            params
        );
    }
}