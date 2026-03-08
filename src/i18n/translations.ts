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
            title: string;
            label: string;
            desc: string;
        };
        model: {
            title: string;
            label: string;
            desc: string;
        };
        system: {
            title: string;
        };
    };
    profile: {
        heading: string;
        subheading: string;
        menu: {
            home: string;
            settings: string;
        };
        welcome: string;
        welcomeDesc: string;
        info: {
            title: string;
            username: string;
            email: string;
            created: string;
        };
        balance: {
            title: string;
            description: string;
            recharge: string;
            history: string;
        };
        quickAccess: {
            title: string;
            practice: string;
            stats: string;
            targets: string;
            history: string;
        };
        account: {
            title: string;
            description: string;
            logout: string;
            delete: string;
            deleting: string;
            warning: string;
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
            title: '语言设置',
            label: '🌐 语言 / Language',
            desc: '选择界面显示语言',
        },
        model: {
            title: 'AI模型设置',
            label: '🧠 AI 模型 / AI Model',
            desc: '选择底层驱动的 AI 大模型',
        },
        system: {
            title: '系统信息',
        },
        avatar: {
            title: '头像设置',
            description: '上传您的个人头像照片，支持JPG、PNG、GIF、WebP格式，最大5MB',
        },
    },
    profile: {
        heading: '👤 个人主页',
        subheading: '查看和管理您的账户信息',
        menu: {
            home: '主页',
            settings: '设置',
        },
        welcome: '欢迎回来',
        welcomeDesc: '这里是您的个人中心，管理您的学习进度和账户设置',
        info: {
            title: '个人信息',
            username: '用户名',
            email: '邮箱',
            created: '创建时间',
        },
        balance: {
            title: 'AT币余额',
            description: 'AT币用于AI练习消耗，可用于所有AI功能',
            recharge: '充值',
            history: '历史记录',
        },
        quickAccess: {
            title: '快捷访问',
            practice: '练习',
            stats: '统计',
            targets: '目标',
            history: '历史',
        },
        account: {
            title: '账户管理',
            description: '管理您的账户安全和隐私设置',
            logout: '退出登录',
            delete: '注销账户',
            deleting: '正在注销...',
            warning: '警告：注销账户后所有数据将被永久删除',
        },
        avatarHint: '点击头像切换/设置头像（请在设置页面操作）',
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
            title: 'Language Settings',
            label: '🌐 Language / 语言',
            desc: 'Choose the interface display language',
        },
        model: {
            title: 'AI Model Settings',
            label: '🧠 AI Model / AI 模型',
            desc: 'Choose the underlying AI model',
        },
        system: {
            title: 'System Information',
        },
        avatar: {
            title: 'Avatar Settings',
            description: 'Upload your personal avatar photo, supports JPG, PNG, GIF, WebP formats, maximum 5MB',
        },
    },
    profile: {
        heading: '👤 Profile',
        subheading: 'View and manage your account information',
        menu: {
            home: 'Home',
            settings: 'Settings',
        },
        welcome: 'Welcome back',
        welcomeDesc: 'This is your personal center, manage your learning progress and account settings',
        info: {
            title: 'Personal Information',
            username: 'Username',
            email: 'Email',
            created: 'Created Date',
        },
        balance: {
            title: 'AT Balance',
            description: 'AT coins are used for AI practice consumption and can be used for all AI features',
            recharge: 'Recharge',
            history: 'History',
        },
        quickAccess: {
            title: 'Quick Access',
            practice: 'Practice',
            stats: 'Stats',
            targets: 'Targets',
            history: 'History',
        },
        account: {
            title: 'Account Management',
            description: 'Manage your account security and privacy settings',
            logout: 'Logout',
            delete: 'Delete Account',
            deleting: 'Deleting...',
            warning: 'Warning: All data will be permanently deleted after account deletion',
        },
        avatarHint: 'Click avatar to change/set avatar (Please use settings page)',
    },
};

export const translations: Record<Lang, Translations> = { zh, en };
