// AI服务AT币消耗配置
export interface AIServiceCost {
    service: string;
    baseCost: number;
    description: string;
    factors?: Record<string, number>; // 影响成本的额外因素
}

export const aiCostConfig: Record<string, AIServiceCost> = {
    reading: {
        service: 'reading',
        baseCost: 10,
        description: '阅读练习生成',
        factors: {
            articleLength: 0.05, // 每100个单词额外消耗
            questionCount: 1, // 每个问题额外消耗
        }
    },
    listening: {
        service: 'listening',
        baseCost: 12,
        description: '听力练习生成',
        factors: {
            audioLength: 0.02, // 每分钟额外消耗
            questionCount: 1,
        }
    },
    writing: {
        service: 'writing',
        baseCost: 8,
        description: '写作批改',
        factors: {
            essayLength: 0.03, // 每100个单词额外消耗
            correctionDepth: 2, // 深度批改额外消耗
        }
    },
    speaking: {
        service: 'speaking',
        baseCost: 6,
        description: '口语对话',
        factors: {
            conversationLength: 0.04, // 每回合额外消耗
            feedbackDetail: 1,
        }
    },
    speaking_bank: {
        service: 'speaking_bank',
        baseCost: 0,
        description: '口语题库 (真题，不消耗AT币)',
    },
    prompt: {
        service: 'prompt',
        baseCost: 3,
        description: 'AI提示词生成',
    },
};

export function calculateCost(service: string, params?: Record<string, number>): number {
    const config = aiCostConfig[service];
    if (!config) {
        return 0;
    }

    let cost = config.baseCost;

    if (config.factors && params) {
        for (const [factor, multiplier] of Object.entries(config.factors)) {
            if (params[factor]) {
                cost += params[factor] * multiplier;
            }
        }
    }

    return Math.round(cost);
}