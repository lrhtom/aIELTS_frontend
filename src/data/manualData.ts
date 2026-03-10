export interface ManualSection {
    id: string;
    title: string;
    icon: string;
    subsections: ManualSubsection[];
}

export interface ManualSubsection {
    id: string;
    title: string;
    content: string;
    keywords?: string[];
}

export interface ManualData {
    zh: ManualSection[];
    en: ManualSection[];
}

export const manualData: ManualData = {
    zh: [
        {
            id: 'auth',
            title: '账户系统',
            icon: '🔐',
            subsections: [
                {
                    id: 'register',
                    title: '快速注册与邮箱验证',
                    content: '本站采用强制邮箱验证机制。注册时需填写用户名、邮箱及密码，并点击“获取验证码”。您将在邮箱中收到 6 位数字验证码，输入后即可完成注册。',
                    keywords: ['注册', '邮箱', '验证', '收不到']
                },
                {
                    id: 'login',
                    title: '登录与安全性',
                    content: '使用用户名和密码登录。若账号被管理员封禁，登录时将提示“账号异常”，请联系管理员处理。',
                    keywords: ['登录', '密码', '错误', '安全']
                },
                {
                    id: 'ban',
                    title: '账号状态说明',
                    content: '如果用户违反社区规则或涉及违规操作，账号可能会被永久或临时封禁。封禁后无法访问任何 AI 练习功能。',
                    keywords: ['封号', '封禁', '异常', '禁言']
                }
            ]
        },
        {
            id: 'practice',
            title: '雅思练习模块',
            icon: '📚',
            subsections: [
                {
                    id: 'reading',
                    title: 'AI 智能阅读',
                    content: '根据您的目标分数 and 词汇量，AI 会实时生成一篇雅思风格的阅读文章，并配套选择题或填空题。支持划词翻译和背景高亮。',
                    keywords: ['阅读', '生成', '翻译', '划词', '题目']
                },
                {
                    id: 'listening',
                    title: '听力训练',
                    content: '提供文章填空、句子填空和多项选择。AI 生成听力原文并配合高仿真语音播放。您可以设置每空的单词数限制。',
                    keywords: ['听力', '音频', '播放', '填空', '字数']
                },
                {
                    id: 'speaking',
                    title: '模拟口语',
                    content: '与 AI 进行 1:1 模拟对话，还原真实雅思口语考试环境。AI 会对您的发音、语法和逻辑进行实时评分。',
                    keywords: ['口语', '模拟', '评分', '发音', '对话']
                },
                {
                    id: 'writing',
                    title: '写作批改',
                    content: '上传您的作文，AI 将从词汇丰富度、语法多样性、连贯性与衔接、任务完成度四个维度给出专业反馈和改进建议。',
                    keywords: ['写作', '批改', '作文', '反馈', '评分']
                }
            ]
        },
        {
            id: 'profile',
            title: '个人中心与工具',
            icon: '👤',
            subsections: [
                {
                    id: 'backpack',
                    title: '我的背包',
                    content: '查看您获得的资源包或特殊奖励。未来将支持道具消耗以开启特殊功能。',
                    keywords: ['背包', '道具', '奖励', '资源']
                },
                {
                    id: 'style',
                    title: '背景与样式自定义',
                    content: '在“网站样式”中，您可以自定义纯色背景或上传背景图片，并根据需要调整背景模糊度。这些设置会随账号跟随，登录后自动生效。',
                    keywords: ['背景', '样式', '自定义', '图片', '模糊', '🎨']
                },
                {
                    id: 'feedback',
                    title: 'Bug 反馈',
                    content: '如果您在使用过程中发现任何技术问题，可以通过“Bug 反馈”板块提交。管理员会在后台查看并处理。',
                    keywords: ['反馈', 'Bug', '报错', '故障', '修复']
                }
            ]
        },
        {
            id: 'ai-at',
            title: 'AI 引擎与 AT 币',
            icon: '🤖',
            subsections: [
                {
                    id: 'models',
                    title: 'AI 模型选择',
                    content: '您可以在设置中切换 AI 引擎（如 DeepSeek、GPT 等），不同引擎会带来不同的出题风格和回复速度。',
                    keywords: ['模型', '引擎', 'DeepSeek', 'GPT', 'Gemini']
                },
                {
                    id: 'at-balance',
                    title: 'AT 币计费',
                    content: 'AT 币用于消耗 AI 资源。生成题目或批改作文会扣除相应额度。当余额为负时，将无法发起的练习。',
                    keywords: ['AT', '余额', '计费', '充值', '消耗', '💰']
                }
            ]
        }
    ],
    en: [
        {
            id: 'auth',
            title: 'Account System',
            icon: '🔐',
            subsections: [
                {
                    id: 'register',
                    title: 'Registration & Verification',
                    content: 'Mandatory email verification. Enter username, email, and password, then click "Send Code". Enter the 6-digit code received in your inbox to complete registration.',
                    keywords: ['register', 'email', 'verification', 'code', 'signup']
                },
                {
                    id: 'login',
                    title: 'Login & Security',
                    content: 'Log in with username and password. If your account is banned, you will see a suspension notice. Contact the administrator for assistance.',
                    keywords: ['login', 'password', 'security', 'error', 'signin']
                },
                {
                    id: 'ban',
                    title: 'Account Status',
                    content: 'Violating community rules may lead to temporary or permanent bans. Banned users cannot access AI practice features.',
                    keywords: ['ban', 'suspended', 'banned', 'blocked', 'status']
                }
            ]
        },
        {
            id: 'practice',
            title: 'IELTS Practice',
            icon: '📚',
            subsections: [
                {
                    id: 'reading',
                    title: 'AI Reading',
                    content: 'AI generates IELTS-style reading passages based on your target score. Includes multiple choice or fill-in-the-blank questions with word translation support.',
                    keywords: ['reading', 'generate', 'translation', 'vocabulary', 'questions']
                },
                {
                    id: 'listening',
                    title: 'Listening Training',
                    content: 'Includes Article, Sentence, and MC modes. AI generates scripts and audio. You can configure word count limits for blank-filling.',
                    keywords: ['listening', 'audio', 'play', 'fill', 'word count']
                },
                {
                    id: 'speaking',
                    title: 'Mock Speaking',
                    content: 'Simulated 1:1 conversation with AI. Get real-time scores for pronunciation, grammar, and logic.',
                    keywords: ['speaking', 'mock', 'score', 'pronunciation', 'dialogue']
                },
                {
                    id: 'writing',
                    title: 'Writing Correction',
                    content: 'Upload your essay and receive professional feedback across four IELTS criteria: Vocabulary, Grammar, Coherence, and Task Achievement.',
                    keywords: ['writing', 'correction', 'essay', 'feedback', 'grading']
                }
            ]
        },
        {
            id: 'profile',
            title: 'Profile & Tools',
            icon: '👤',
            subsections: [
                {
                    id: 'backpack',
                    title: 'My Backpack',
                    content: 'View your earned resource packs or rewards. Future updates will allow using items to unlock special features.',
                    keywords: ['backpack', 'items', 'rewards', 'resources']
                },
                {
                    id: 'style',
                    title: 'Custom Styles',
                    content: 'Customize your background with solid colors or uploaded images in the "Site Style" section. Settings are saved to your account.',
                    keywords: ['background', 'style', 'custom', 'image', 'blur', '🎨']
                },
                {
                    id: 'feedback',
                    title: 'Bug Feedback',
                    content: 'Report technical issues through the "Bug Feedback" section. Administrators review and resolve reports regularly.',
                    keywords: ['feedback', 'bug', 'report', 'issue', 'technical']
                }
            ]
        },
        {
            id: 'ai-at',
            title: 'AI & AT Coins',
            icon: '🤖',
            subsections: [
                {
                    id: 'models',
                    title: 'AI Models',
                    content: 'Switch between AI engines (e.g., DeepSeek, GPT) in settings. Different models offer various generation styles and speeds.',
                    keywords: ['model', 'engine', 'DeepSeek', 'GPT', 'Gemini']
                },
                {
                    id: 'at-balance',
                    title: 'AT Coin Billing',
                    content: 'AT coins are consumed for AI resources. Generation and correction costs AT. You cannot start new sessions if your balance is negative.',
                    keywords: ['AT', 'balance', 'billing', 'recharge', 'coins', '💰']
                }
            ]
        }
    ]
};
