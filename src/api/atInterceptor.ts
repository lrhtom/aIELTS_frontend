import { apiClient } from './client';
import { balanceApi } from './balance';
import { calculateCost } from '../config/ai_cost';
import { currentT } from '../i18n/currentT';

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

        // Precheck is advisory only — actual cost is determined server-side.
        // We warn when balance is low but never block; the backend handles billing.
        if (balance.atBalance < estimatedCost) {
            console.warn(`AT币余额可能不足 (预估): ${balance.atBalance} AT < ${estimatedCost} AT`);
            // 'at-balance-insufficient' is the event ATBalanceMonitor actually
            // listens for ('at-balance-low' had no listener, so this advisory
            // warning was never shown). Monitor renders it as
            // needMoreBalance: '{message} (需要{required} AT，当前{current} AT)'.
            window.dispatchEvent(new CustomEvent('at-balance-insufficient', {
                detail: {
                    message: currentT()('billing.estimatedShort'),
                    requiredBalance: estimatedCost,
                    currentBalance: balance.atBalance
                }
            }));
        }

        return true;
    }

    static async intercept<T>(
        service: string,
        apiCall: () => Promise<T>,
        params?: Record<string, number>
    ): Promise<T> {
        // 预检余额（仅提醒，不阻断；实际扣费由服务端决定）
        await this.checkAndConsume({
            service,
            params
        });

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

    static async writingChat(messages: Array<Record<string, unknown>>, params?: Record<string, number>) {
        return this.intercept('writing', () =>
            apiClient.post<{ reply: string, grammar_score: number, vocab_score: number, relevance_score: number, corrected_text: string, atConsumed?: number }>('/writing/chat', { messages }),
            params
        );
    }

    static async writingChatWithFiles(messages: Array<Record<string, unknown>>, files: File[], params?: Record<string, number>) {
        return this.intercept('writing', () => {
            const formData = new FormData();
            formData.append('messages', JSON.stringify(messages));
            files.forEach(f => formData.append('files', f));
            return apiClient.post<{ reply: string, grammar_score: number, vocab_score: number, relevance_score: number, corrected_text: string, atConsumed?: number }>(
                '/writing/chat',
                formData,
                { headers: { 'Content-Type': undefined as unknown as string } }
            );
        }, params);
    }

    static async checkScenario(scenario: string, params?: Record<string, number>) {
        return this.intercept('speaking', () =>
            apiClient.post<{ valid: boolean, reason: string, atConsumed?: number }>('/speaking/check-scenario', { scenario }),
            params
        );
    }

    static async generateRandomScenario(params?: Record<string, number>) {
        return this.intercept('speaking', () =>
            apiClient.post<{ scenario: string, atConsumed?: number }>('/speaking/scenario/random'),
            params
        );
    }

    static async scenarioChat(scenario: string, messages: Array<Record<string, unknown>>, modifiers?: Record<string, string[]>, params?: Record<string, number>) {
        return this.intercept('speaking', () =>
            apiClient.post<{ reply: string, grammar_score: number, vocab_score: number, relevance_score: number, is_continue: number, atConsumed?: number }>('/speaking/scenario-chat', { scenario, messages, modifiers }),
            params
        );
    }

    static async scenarioChatWithFiles(scenario: string, messages: Array<Record<string, unknown>>, files: File[], modifiers?: Record<string, string[]>, params?: Record<string, number>) {
        return this.intercept('speaking', () => {
            const formData = new FormData();
            formData.append('scenario', scenario);
            formData.append('messages', JSON.stringify(messages));
            if (modifiers && Object.keys(modifiers).length) formData.append('modifiers', JSON.stringify(modifiers));
            files.forEach(f => formData.append('files', f));
            return apiClient.post<{ reply: string, grammar_score: number, vocab_score: number, relevance_score: number, is_continue: number, corrected_text: string, atConsumed?: number }>(
                '/speaking/scenario-chat',
                formData,
                { headers: { 'Content-Type': undefined as unknown as string } }
            );
        }, params);
    }

    static async scenarioOpening(scenario: string, files: File[], modifiers?: Record<string, string[]>, params?: Record<string, number>) {
        return this.intercept('speaking', () => {
            if (files.length === 0) {
                return apiClient.post<{ opening: string, atConsumed?: number }>('/speaking/scenario-opening', { scenario, modifiers });
            }
            const formData = new FormData();
            formData.append('scenario', scenario);
            if (modifiers && Object.keys(modifiers).length) formData.append('modifiers', JSON.stringify(modifiers));
            files.forEach(f => formData.append('files', f));
            return apiClient.post<{ opening: string, atConsumed?: number }>(
                '/speaking/scenario-opening',
                formData,
                { headers: { 'Content-Type': undefined as unknown as string } }
            );
        }, params);
    }

    static async generatePart1(params?: Record<string, number>) {
        return this.intercept('speaking', () =>
            apiClient.post<{ questions: Array<{topic: string, question: string}>, atConsumed?: number }>('/speaking/part1/generate'),
            params
        );
    }

    static async evaluatePart1(question: string, user_answer: string, duration_seconds: number, next_question_plan?: {topic: string, question: string}, params?: Record<string, number>) {
        return this.intercept('speaking', () =>
            apiClient.post<{ grammar_score: number, vocab_score: number, relevance_score: number, are_a_score: number, are_r_score: number, are_e_score: number, are_feedback: string, corrected_text: string, length_feedback: string, word_count: number, duration_seconds: number, weighted_total_score: number, final_multiplier: number, next_question_dynamic?: string, atConsumed?: number }>('/speaking/part1/evaluate', { question, user_answer, duration_seconds, next_question_plan }),
            params
        );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static async summaryPart2(history: Array<any>, params?: Record<string, number>) {
        return this.intercept('speaking', () =>
            apiClient.post<{ overall_band_estimate: number, strengths: string, weaknesses: string, analysis: string, advice: string, atConsumed?: number }>('/speaking/part2/summary', { history }),
            params
        );
    }

    static async generatePart3(part2_topic?: string, params?: Record<string, number>) {
        return this.intercept('speaking', () =>
            apiClient.post<{ questions: Array<{topic: string, question: string}>, atConsumed?: number }>('/speaking/part3/generate', { part2_topic }),
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static async summaryPart3(history: Array<any>, params?: Record<string, number>) {
        return this.intercept('speaking', () =>
            apiClient.post<{ overall_band_estimate: number, strengths: string, weaknesses: string, analysis: string, advice: string, atConsumed?: number }>('/speaking/part3/summary', { history }),
            params
        );
    }

    // ── Question-bank endpoints (zero AT cost) ──
    static async bankGeneratePart1(params?: Record<string, number>) {
        return this.intercept('speaking_bank', () =>
            apiClient.post<{ questions: Array<{topic: string, question: string}>, bank_topics: string[], source: string }>('/speaking/bank/part1/generate'),
            params
        );
    }

    static async bankGeneratePart2(params?: Record<string, number>) {
        return this.intercept('speaking_bank', () =>
            apiClient.post<{ questions: Array<{topic: string, question: string}>, bank_topic: string, source: string }>('/speaking/bank/part2/generate'),
            params
        );
    }

    static async bankGeneratePart3(part2_topic: string, params?: Record<string, number>) {
        return this.intercept('speaking_bank', () =>
            apiClient.post<{ questions: Array<{topic: string, question: string}>, bank_topic: string, source: string }>('/speaking/bank/part3/generate', { part2_topic }),
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