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

    static async checkScenario(scenario: string, params?: Record<string, number>) {
        return this.intercept('speaking', () =>
            apiClient.post<{ valid: boolean, reason: string, atConsumed?: number }>('/speaking/check-scenario', { scenario }),
            params
        );
    }

    static async scenarioChat(scenario: string, messages: Array<Record<string, unknown>>, params?: Record<string, number>) {
        return this.intercept('speaking', () =>
            apiClient.post<{ reply: string, grammar_score: number, vocab_score: number, relevance_score: number, is_continue: number, atConsumed?: number }>('/speaking/scenario-chat', { scenario, messages }),
            params
        );
    }

    static async generatePart1(params?: Record<string, number>) {
        return this.intercept('speaking', () =>
            apiClient.post<{ questions: Array<{topic: string, question: string}>, atConsumed?: number }>('/speaking/part1/generate'),
            params
        );
    }

    static async evaluatePart1(question: string, user_answer: string, duration_seconds: number, params?: Record<string, number>) {
        return this.intercept('speaking', () =>
            apiClient.post<{ grammar_score: number, vocab_score: number, relevance_score: number, are_a_score: number, are_r_score: number, are_e_score: number, are_feedback: string, corrected_text: string, length_feedback: string, word_count: number, duration_seconds: number, weighted_total_score: number, final_multiplier: number, atConsumed?: number }>('/speaking/part1/evaluate', { question, user_answer, duration_seconds }),
            params
        );
    }

    static async summaryPart1(history: Array<any>, params?: Record<string, number>) {
        return this.intercept('speaking', () =>
            apiClient.post<{ overall_band_estimate: number, strengths: string, weaknesses: string, are_analysis: string, advice: string, atConsumed?: number }>('/speaking/part1/summary', { history }),
            params
        );
    }

    static async generatePart2(params?: Record<string, number>) {
        return this.intercept('speaking', () =>
            apiClient.post<{ questions: Array<{topic: string, question: string}>, atConsumed?: number }>('/speaking/part2/generate'),
            params
        );
    }

    static async evaluatePart2(question: string, user_answer: string, duration_seconds: number, params?: Record<string, number>) {
        return this.intercept('speaking', () =>
            apiClient.post<{
                grammar_score: number,
                vocab_score: number,
                relevance_score: number,
                coherence_score: number,
                depth_score: number,
                feedback: string,
                corrected_text: string,
                length_feedback: string,
                word_count: number,
                duration_seconds: number,
                weighted_total_score: number,
                final_multiplier: number,
                atConsumed?: number
            }>('/speaking/part2/evaluate', { question, user_answer, duration_seconds }),
            params
        );
    }

    static async summaryPart2(history: Array<any>, params?: Record<string, number>) {
        return this.intercept('speaking', () =>
            apiClient.post<{ overall_band_estimate: number, strengths: string, weaknesses: string, analysis: string, advice: string, atConsumed?: number }>('/speaking/part2/summary', { history }),
            params
        );
    }

    static async generatePart3(params?: Record<string, number>) {
        return this.intercept('speaking', () =>
            apiClient.post<{ questions: Array<{topic: string, question: string}>, atConsumed?: number }>('/speaking/part3/generate'),
            params
        );
    }

    static async evaluatePart3(question: string, user_answer: string, duration_seconds: number, params?: Record<string, number>) {
        return this.intercept('speaking', () =>
            apiClient.post<{
                grammar_score: number,
                vocab_score: number,
                relevance_score: number,
                coherence_score: number,
                depth_score: number,
                feedback: string,
                corrected_text: string,
                length_feedback: string,
                word_count: number,
                duration_seconds: number,
                weighted_total_score: number,
                final_multiplier: number,
                atConsumed?: number
            }>('/speaking/part3/evaluate', { question, user_answer, duration_seconds }),
            params
        );
    }

    static async summaryPart3(history: Array<any>, params?: Record<string, number>) {
        return this.intercept('speaking', () =>
            apiClient.post<{ overall_band_estimate: number, strengths: string, weaknesses: string, analysis: string, advice: string, atConsumed?: number }>('/speaking/part3/summary', { history }),
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