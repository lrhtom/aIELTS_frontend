// Translations for zh (Chinese) and en (English)
// Usage: t.nav.home, t.home.hero.title, etc.

export type Lang = 'zh' | 'en';

export interface Translations {
    nav: {
        home: string;
        practice: string;
        settings: string;
    };
    home: {
        hero: {
            title: string;
            subtitle: string;
            startPractice: string;
            vocab: string;
        };
        announcements: {
            heading: string;
            items: { date: string; tag: string; content: string }[];
        };
        footer: string;
    };
    practiceHub: {
        backToHome: string;
        heading: string;
        subheading: string;
        realPractice: {
            title: string;
            desc: string;
        };
        aiPractice: {
            title: string;
            desc: string;
        };
        comingSoon: string;
    };
    aiPractice: {
        backToPractice: string;
        heading: string;
        subheading: string;
        reading: {
            title: string;
            desc: string;
        };
        listening: {
            title: string;
            desc: string;
        };
        speaking: {
            title: string;
            desc: string;
        };
        writing: {
            title: string;
            desc: string;
        };
        comingSoon: string;
    };
    readingConfig: {
        backToAI: string;
        heading: string;
        subheading: string;
        targetScore: string;
        customVocab: {
            label: string;
            desc: string;
        };
        startBtn: string;
        toast: {
            noVocab: string;
        };
    };
    listeningConfig: {
        backToAI: string;
        heading: string;
        subheading: string;
        practiceType: {
            label: string;
            article: { title: string; desc: string };
            sentence: { title: string; desc: string };
            multipleChoice: { title: string; desc: string };
        };
        targetScore: string;
        wordCount: {
            label: string;
            min: string;
            max: string;
            sep: string;
            word: string;
        };
        customVocab: {
            label: string;
            desc: string;
        };
        startBtn: string;
        toast: {
            noVocab: string;
        };
    };
    settings: {
        heading: string;
        subheading: string;
        language: {
            label: string;
            desc: string;
        };
        model: {
            label: string;
            desc: string;
        };
    };
}

const zh: Translations = {
    nav: {
        home: '主页',
        practice: '练习',
        settings: '⚙️ 设置',
    },
    home: {
        hero: {
            title: 'Master IELTS with AI',
            subtitle: 'AI 驱动的雅思练习平台，听说读写一站式智能提升',
            startPractice: '🚀 开始练习',
            vocab: '🧠 背单词',
        },
        announcements: {
            heading: '📢 Announcements',
            items: [
                { date: '2026-03-01', tag: 'new', content: 'aIELTS v1.0 正式上线！AI 驱动的雅思练习平台现已可用。' },
                { date: '2026-03-01', tag: 'new', content: '📖 阅读模块已上线 — AI 生成 Band 7.0-7.5 阅读文章 + 题目 + 解析。' },
                { date: '2026-03-01', tag: 'update', content: '🎧 听力、🗣️ 口语、✍️ 写作模块正在开发中，敬请期待！' },
            ],
        },
        footer: '© 2026 aIELTS · Powered by AI',
    },
    practiceHub: {
        backToHome: '← 返回首页',
        heading: '选择练习模式',
        subheading: '真题训练或 AI 智能生成练习',
        realPractice: {
            title: '原题练习',
            desc: '历年真题模拟训练',
        },
        aiPractice: {
            title: 'AI 练习',
            desc: 'AI 智能生成个性化练习',
        },
        comingSoon: '敬请期待',
    },
    aiPractice: {
        backToPractice: '← 返回练习模式',
        heading: 'AI 练习',
        subheading: '选择技能，AI 为你生成个性化练习材料',
        reading: { title: '阅读 Reading', desc: 'AI 生成阅读理解' },
        listening: { title: '听力 Listening', desc: 'AI 生成听力练习' },
        speaking: { title: '口语 Speaking', desc: 'AI 口语对话练习' },
        writing: { title: '写作 Writing', desc: 'AI 写作批改练习' },
        comingSoon: '敬请期待',
    },
    readingConfig: {
        backToAI: '← 返回 AI 练习',
        heading: '📖 阅读练习配置',
        subheading: '选择难度和词汇，AI 为你生成阅读理解练习',
        targetScore: '🎯 目标分数',
        customVocab: {
            label: '📝 自选词汇',
            desc: '关闭后将由 AI 根据难度自动选择词汇',
        },
        startBtn: '📖 开始阅读练习',
        toast: { noVocab: '请输入目标词汇，或关闭自选词汇开关' },
    },
    listeningConfig: {
        backToAI: '← 返回 AI 练习',
        heading: '🎧 听力练习配置',
        subheading: '选择练习类型、难度和词汇，AI 为你生成听力填空练习',
        practiceType: {
            label: '📋 练习类型',
            article: { title: '文章填空', desc: '阅读原文，在文章空缺处填入答案' },
            sentence: { title: '句子填空', desc: '听音后根据题目句子填写答案，不显示原文' },
            multipleChoice: { title: '选择题', desc: '听音后进行四选一单选题练习' },
        },
        targetScore: '🎯 目标分数',
        wordCount: {
            label: '📏 每空答案词数',
            min: '最少',
            max: '最多',
            sep: '~',
            word: '词',
        },
        customVocab: {
            label: '📝 自选词汇',
            desc: '关闭后将由 AI 根据难度自动选择词汇',
        },
        startBtn: '🎧 开始听力练习',
        toast: { noVocab: '请输入目标词汇，或关闭自选词汇开关' },
    },
    settings: {
        heading: '⚙️ 设置',
        subheading: '自定义你的 aIELTS 体验',
        language: {
            label: '🌐 语言 / Language',
            desc: '选择界面显示语言',
        },
        model: {
            label: '🧠 AI 模型 / AI Model',
            desc: '选择底层驱动的 AI 大模型',
        },
    },
};

const en: Translations = {
    nav: {
        home: 'Home',
        practice: 'Practice',
        settings: '⚙️ Settings',
    },
    home: {
        hero: {
            title: 'Master IELTS with AI',
            subtitle: 'Your AI-powered IELTS practice platform — all four skills in one place.',
            startPractice: '🚀 Start Practicing',
            vocab: '🧠 Vocabulary',
        },
        announcements: {
            heading: '📢 Announcements',
            items: [
                { date: '2026-03-01', tag: 'new', content: 'aIELTS v1.0 is officially live! The AI-powered IELTS practice platform is now available.' },
                { date: '2026-03-01', tag: 'new', content: '📖 Reading module is live — AI-generated Band 7.0-7.5 passages with questions and explanations.' },
                { date: '2026-03-01', tag: 'update', content: '🎧 Listening, 🗣️ Speaking, ✍️ Writing modules are in development — stay tuned!' },
            ],
        },
        footer: '© 2026 aIELTS · Powered by AI',
    },
    practiceHub: {
        backToHome: '← Back to Home',
        heading: 'Choose Practice Mode',
        subheading: 'Real exam questions or AI-generated practice',
        realPractice: {
            title: 'Real Exam',
            desc: 'Practice with past IELTS exam questions',
        },
        aiPractice: {
            title: 'AI Practice',
            desc: 'AI-generated personalized practice',
        },
        comingSoon: 'Coming Soon',
    },
    aiPractice: {
        backToPractice: '← Back to Practice',
        heading: 'AI Practice',
        subheading: 'Choose a skill — AI will generate personalized materials for you.',
        reading: { title: 'Reading', desc: 'AI-generated reading comprehension' },
        listening: { title: 'Listening', desc: 'AI-generated listening fill-in-the-blank' },
        speaking: { title: 'Speaking', desc: 'AI-powered speaking practice' },
        writing: { title: 'Writing', desc: 'AI writing correction and feedback' },
        comingSoon: 'Coming Soon',
    },
    readingConfig: {
        backToAI: '← Back to AI Practice',
        heading: '📖 Reading Practice Setup',
        subheading: 'Choose a difficulty and vocabulary list. AI will generate your reading exercise.',
        targetScore: '🎯 Target Band Score',
        customVocab: {
            label: '📝 Custom Vocabulary',
            desc: 'When off, AI will automatically select vocabulary based on difficulty.',
        },
        startBtn: '📖 Start Reading Practice',
        toast: { noVocab: 'Please enter vocabulary words, or turn off the custom vocabulary switch.' },
    },
    listeningConfig: {
        backToAI: '← Back to AI Practice',
        heading: '🎧 Listening Practice Setup',
        subheading: 'Choose practice type, difficulty and vocabulary. AI will generate your listening exercise.',
        practiceType: {
            label: '📋 Practice Type',
            article: { title: 'Passage Fill-in-the-Blank', desc: 'Read the passage and fill in blanks in the text' },
            sentence: { title: 'Sentence Fill-in-the-Blank', desc: 'Listen and fill in blanks in individual sentences' },
            multipleChoice: { title: 'Multiple Choice', desc: 'Listen and answer 4-option multiple choice questions' },
        },
        targetScore: '🎯 Target Band Score',
        wordCount: {
            label: '📏 Words Per Blank',
            min: 'Min',
            max: 'Max',
            sep: '~',
            word: 'word(s)',
        },
        customVocab: {
            label: '📝 Custom Vocabulary',
            desc: 'When off, AI will automatically select vocabulary based on difficulty.',
        },
        startBtn: '🎧 Start Listening Practice',
        toast: { noVocab: 'Please enter vocabulary words, or turn off the custom vocabulary switch.' },
    },
    settings: {
        heading: '⚙️ Settings',
        subheading: 'Customize your aIELTS experience',
        language: {
            label: '🌐 Language / 语言',
            desc: 'Choose the interface display language',
        },
        model: {
            label: '🧠 AI Model / AI 模型',
            desc: 'Choose the underlying AI model',
        },
    },
};

export const translations: Record<Lang, Translations> = { zh, en };
