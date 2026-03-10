// Translations for zh (Chinese) and en (English)
// Usage: t.nav.home, t.home.hero.title, etc.

export type Lang = 'zh' | 'en';

export interface Translations {
    nav: {
        home: string;
        practice: string;
        settings: string;
        prompts: string;
        collapse: string;
    };
    common: {
        back: string;
        confirm: string;
        cancel: string;
        save: string;
        saving: string;
        saved: string;
        error: string;
        loading: string;
        home: string;
        underline: string;
    };
    auth: {
        loginTitle: string;
        loginSubtitle: string;
        registerTitle: string;
        registerSubtitle: string;
        username: string;
        email: string;
        password: string;
        confirmPassword: string;
        loginBtn: string;
        loggingIn: string;
        registerBtn: string;
        registering: string;
        noAccount: string;
        hasAccount: string;
        toRegister: string;
        toLogin: string;
        backToHome: string;
        errorUnauthorized: string;
        errorGeneral: string;
        errorPasswordMismatch: string;
        errorRegisterTaken: string;
        verificationCode: string;
        codePlaceholder: string;
        sendCode: string;
        resendCode: string;
        codeSent: string;
        sendingCode: string;
        errorCodeInvalid: string;
        errorEmailRequired: string;
        errorBanned: string;
        manualTitle: string;
        manualSearch: string;
        manualEmpty: string;
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
            hintExact: string;
            hintRange: string;
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
            userId: string;
            registeredTime: string;
            emailVerify: string;
            verified: string;
            notVerified: string;
        };
        avatar: {
            title: string;
            description: string;
        };
        movedMessage: string;
        goToProfile: string;
    };
    profile: {
        heading: string;
        subheading: string;
        menu: {
            home: string;
            settings: string;
            backpack: string;
            style: string;
            background: string;
            admin: string;
            manual: string;
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
            backpack: string;
        };
        account: {
            title: string;
            description: string;
            logout: string;
            delete: string;
            deleting: string;
            warning: string;
            confirmDelete: string;
        };
        backpack: {
            empty: string;
            emptyHint: string;
        };
        feedback: {
            title: string;
            desc: string;
            email: string;
            message: string;
            submit: string;
            success: string;
            placeholderTitle: string;
            placeholderDesc: string;
            backToSubmit: string;
        };
        avatarHint: string;
        background: {
            title: string;
            desc: string;
            colorSection: string;
            colorDesc: string;
            imageSection: string;
            imageDesc: string;
            blurSection: string;
            blurDesc: string;
            blurClear: string;
            blurBlurry: string;
            tabUrl: string;
            tabUpload: string;
            urlPlaceholder: string;
            preview: string;
            uploading: string;
            uploadPlaceholder: string;
            uploadSuccess: string;
            clearBtn: string;
            saveTitle: string;
            saveAutoHint: string;
            presets: {
                white: string;
                beige: string;
                mint: string;
                blue: string;
                violet: string;
                morning: string;
                green: string;
                dusk: string;
                sky: string;
                coral: string;
            };
        };
        admin: {
            feedback: {
                title: string;
                unresolved: string;
                resolved: string;
                resolve: string;
                delete: string;
                noData: string;
                total: string;
            };
        };
    };
    readingDetails: {
        dictionary: string;
        questions: string;
        time: string;
        hideTargets: string;
        showTargets: string;
        submitConfirm: string;
        writingPassage: string;
        searchPlaceholder: string;
        underline: string;
        submitBtn: string;
    };
    listeningDetails: {
        startAudio: string;
        speaking: string;
        audioDone: string;
        typeArticle: string;
        typeSentence: string;
        typeMC: string;
        wordLimit: string;
        generatingAudio: string;
        audioError: string;
        noQuestions: string;
        writingPassage: string;
        wordUnit: string;
    };
    results: {
        analysis: string;
        originalPassage: string;
        hidePassage: string;
        showPassage: string;
        targetVocab: string;
        yourAnswer: string;
        correctAnswer: string;
        acceptableAnswers: string;
        statusCorrect: string;
        statusIncorrect: string;
        explanation: string;
    };
    components: {
        vocabInput: {
            label: string;
            invalidLines: string;
            placeholder: string;
            formatDesc: string;
            toastHint: string;
        };
        aiModel: {
            label: string;
            desc: string;
        };
        toast: {
            errorTitle: string;
        };
    };
}

const zh: Translations = {
    nav: {
        home: '主页',
        practice: '题库',
        settings: '设置',
        prompts: 'AI 提示词',
        collapse: '收起',
    },
    common: {
        back: '返回',
        confirm: '确定',
        cancel: '取消',
        save: '保存',
        saving: '保存中...',
        saved: '已保存',
        error: '错误',
        loading: '加载中...',
        home: '主页',
        underline: '下划线',
    },
    auth: {
        loginTitle: '欢迎回来',
        loginSubtitle: '登录以继续您的 aIELTS 学习之旅',
        registerTitle: '创建新账号',
        registerSubtitle: '加入 aIELTS，全方位提升您的雅思能力',
        username: '用户名',
        email: '邮箱地址',
        password: '密码',
        confirmPassword: '确认密码',
        loginBtn: '登录',
        loggingIn: '登录中...',
        registerBtn: '注册账号',
        registering: '注册中...',
        noAccount: '还没有账号？',
        hasAccount: '已拥有账号？',
        toRegister: '立即注册',
        toLogin: '直接登录',
        backToHome: '返回主页',
        errorUnauthorized: '用户名或密码错误。',
        errorGeneral: '发生错误，请稍后重试。',
        errorPasswordMismatch: '两次输入的密码不一致。',
        errorRegisterTaken: '注册失败：用户名或邮箱可能已被使用。',
        verificationCode: '邮箱验证码',
        codePlaceholder: '请输入6位验证码',
        sendCode: '获取验证码',
        resendCode: '重新获取({n}s)',
        codeSent: '验证码已发送到你的邮箱，请查收',
        sendingCode: '发送中...',
        errorCodeInvalid: '验证码错误或已过期，请重新获取',
        errorEmailRequired: '请先填写用户名和邮箱地址',
        errorBanned: '账号异常，请联系管理员处理。',
        manualTitle: '使用手册',
        manualSearch: '搜索功能或页面...',
        manualEmpty: '未找到相关内容',
    },
    home: {
        hero: {
            title: '掌握雅思，从 aIELTS 开始',
            subtitle: 'AI 驱动的一站式雅思学习平台，助您突破语言瓶颈，实现留学梦想。',
            startPractice: '开始练习',
            vocab: '词汇库',
        },
        announcements: {
            heading: '最新动态',
            items: [
                { date: '2024-03-20', tag: '新功能', content: 'AI 写作批改功能现已上线，支持实时反馈。' },
                { date: '2024-03-15', tag: '优化', content: '提升了口语练习的语音识别准确度。' },
                { date: '2024-03-10', tag: '活动', content: '加入备考群，与志同道合的同学一起努力。' },
            ],
        },
        footer: '© 2024 aIELTS. All rights reserved.',
    },
    practiceHub: {
        backToHome: '← 返回主页',
        heading: '雅思题库',
        subheading: '选择您的练习模式，开启高效提分之旅',
        realPractice: {
            title: '历年真题/模拟题',
            desc: '挑战雅思历年经典真题，还原真实考试体验。',
        },
        aiPractice: {
            title: 'AI 个性化练习',
            desc: '利用 AI 技术，针对您的弱项进行智能出题与分析。',
        },
        comingSoon: '更多练习模式正在开发中，敬请期待...',
    },
    aiPractice: {
        backToPractice: '← 返回题库',
        heading: 'AI 智能练习',
        subheading: '采用 DeepSeek/Gemini/GPT 等模型，为您量身定制学习内容',
        reading: {
            title: 'AI 智能阅读',
            desc: '根据您的词汇水平动态生成雅思阅读文章与题目。',
        },
        listening: {
            title: 'AI 智能听力',
            desc: '生成雅思风格听力材料，训练您的听音辨位与抓词能力。',
        },
        speaking: {
            title: 'AI 模拟口语',
            desc: '与 AI 进行 1:1 模拟对话，提供发音、语法与逻辑评分。',
        },
        writing: {
            title: 'AI写作板块',
            desc: '上传作文获取细致反馈',
        },
        comingSoon: '更多模块正在同步开发中...',
    },
    readingConfig: {
        backToAI: '← 返回 AI 练习',
        heading: '阅读练习配置',
        subheading: '定制专属于您的阅读训练材料',
        targetScore: '目标 Band 分数',
        customVocab: {
            label: '使用您的专属词汇库',
            desc: '开启后，AI 将在文章中优先融入您提供的词汇',
        },
        startBtn: '开始生成文章',
        toast: {
            noVocab: '请先输入一些目标词汇',
        },
    },
    listeningConfig: {
        backToAI: '← 返回 AI 练习',
        heading: '听力练习配置',
        subheading: '定制专属于您的听力训练材料',
        practiceType: {
            label: '练习模式',
            article: { title: '文章填空', desc: '根据听力内容补全文章缺失部分' },
            sentence: { title: '句子填空', desc: '集中训练对长难句核心信息的捕捉' },
            multipleChoice: { title: '多项选择', desc: '训练排除干扰项，精准定位答案' },
        },
        targetScore: '目标 Band 分数',
        wordCount: {
            label: '每空字数限制',
            min: '最少',
            max: '最多',
            sep: '至',
            word: '字',
            hintExact: '每空恰好 {n} 个词',
            hintRange: '每空 {min} ~ {max} 个词',
        },
        customVocab: {
            label: '融入目标词汇',
            desc: 'AI 将在听力稿中合理嵌入您指定的词汇',
        },
        startBtn: '开始生成听力题目',
        toast: {
            noVocab: '请先输入一些目标词汇',
        },
    },
    settings: {
        heading: '账户设置',
        subheading: '管理您的账号信息、界面偏好及系统配置',
        language: {
            title: '语言与地区',
            label: '界面语言',
            desc: '选择您偏好的系统语言',
        },
        model: {
            title: 'AI 配置',
            label: 'AI 引擎',
            desc: '选择后台出题和批改所使用的引擎',
        },
        system: {
            title: '系统信息',
            userId: '用户 ID',
            registeredTime: '注册时间',
            emailVerify: '邮箱验证',
            verified: '已验证',
            notVerified: '未验证',
        },
        avatar: {
            title: '头像设置',
            description: '点击头像上传新的图片',
        },
        movedMessage: '设置功能已迁移到个人主页。请点击下方按钮访问个人主页。',
        goToProfile: '前往个人主页',
    },
    profile: {
        heading: '个人主页',
        subheading: '您的个人仪表盘，记录学习点滴与成就',
        menu: {
            home: '概览',
            settings: '设置',
            backpack: '背包',
            style: '网站样式',
            background: '背景自定义',
            admin: '管理后台',
            manual: '网站手册',
        },
        welcome: '欢迎来到您的个人主页',
        welcomeDesc: '在这里，您可以查看余额、学习进度以及管理个人偏好。',
        info: {
            title: '个人资料',
            username: '用户名',
            email: '电子邮箱',
            created: '加入日期',
        },
        balance: {
            title: 'AT 代币余额',
            description: 'AT 用于消耗 AI 算力生成题目',
            recharge: '充值',
            history: '交易记录',
        },
        quickAccess: {
            title: '快速访问',
            practice: '继续练习',
            stats: '学习统计',
            targets: '目标管理',
            history: '最近足迹',
            backpack: '打开背包',
        },
        account: {
            title: '账号管理',
            description: '安全与账号注销',
            logout: '退出登录',
            delete: '注销账号',
            deleting: '正在注销...',
            warning: '警告：此操作不可逆',
            confirmDelete: '确定要注销账户吗？此操作不可逆。',
        },
        backpack: {
            empty: '你的背包还是空的',
            emptyHint: '参加练习或活动可以获得道具哦！',
        },
        feedback: {
            title: 'Bug 反馈',
            desc: '遇到问题了吗？请告诉我们，我们会尽快修复',
            email: '邮箱地址',
            message: '问题描述',
            submit: '提交反馈',
            success: '反馈已收到，感谢您的支持！',
            placeholderTitle: '简述问题',
            placeholderDesc: '请详细描述您遇到的问题...',
            backToSubmit: '返回并再次提交',
        },
        avatarHint: '点击头像上传头像',
        background: {
            title: '网站背景设置',
            desc: '设置专属背景，登录后自动应用；退出后自动清除',
            colorSection: '颜色自定义',
            colorDesc: '选择纯色或渐变色作为背景',
            imageSection: '背景图片自定义',
            imageDesc: '上传图片或粘贴图片地址',
            blurSection: '背景模糊度',
            blurDesc: '仅对背景图片有效，0 为不模糊',
            blurClear: '清晰',
            blurBlurry: '模糊',
            tabUrl: '链接 URL',
            tabUpload: '上传图片',
            urlPlaceholder: '粘贴图片链接',
            preview: '预览',
            uploading: '上传中...',
            uploadPlaceholder: '点击选择图片',
            uploadSuccess: '图片上传成功！',
            clearBtn: '清除背景',
            saveTitle: '保存设置',
            saveAutoHint: '图片上传后会自动保存',
            presets: {
                white: '默认白',
                beige: '暖米色',
                mint: '薄荷绿',
                blue: '浅蓝灰',
                violet: '紫罗兰',
                morning: '晨光',
                green: '绿意',
                dusk: '暮色',
                sky: '天空',
                coral: '珊瑚色',
            },
        },
        admin: {
            feedback: {
                title: '反馈管理',
                unresolved: '待处理',
                resolved: '已解决',
                resolve: '解决',
                delete: '删除',
                noData: '暂无反馈记录',
                total: '共 {count} 条反馈',
            },
        },
    },
    readingDetails: {
        dictionary: '词典',
        questions: '题目',
        time: '耗时',
        hideTargets: '💡 隐藏目标词',
        showTargets: '💡 显示目标词',
        submitConfirm: '您还有未完成的题目，确定要交卷吗？',
        writingPassage: 'AI 正在为您编写雅思阅读文章...',
        searchPlaceholder: '🔍 搜索单词或释义...',
        underline: '下划线',
        submitBtn: '提交答案',
    },
    listeningDetails: {
        startAudio: '开始播放',
        speaking: '正在朗读...',
        audioDone: '朗读结束',
        typeArticle: '文章填空',
        typeSentence: '句子填空',
        typeMC: '选择题',
        wordLimit: '每空不超过',
        generatingAudio: '正在生成音频...',
        audioError: '播放音频出错',
        noQuestions: 'AI 未能生成题目，请重试',
        writingPassage: 'AI 正在为您编写雅思听力原文...',
        wordUnit: '个词',
    },
    results: {
        analysis: '结果分析与解析',
        originalPassage: '原文回顾',
        hidePassage: '隐藏原文',
        showPassage: '显示原文',
        targetVocab: '目标词汇',
        yourAnswer: '您的答案',
        correctAnswer: '正确答案',
        acceptableAnswers: '可接受的答案',
        statusCorrect: '正确',
        statusIncorrect: '错误',
        explanation: '解析',
    },
    components: {
        vocabInput: {
            label: '已添加词汇',
            invalidLines: '行格式有误',
            placeholder: 'ubiquitous - 普遍存在的\nmitigate - 减轻\nephemeral - 短暂的\n\n每行一个词，格式：单词 - 释义',
            formatDesc: '每行一个，格式：单词 - 中文释义，每行必须同时包含英文和中文',
            toastHint: '格式有误，需同时包含英文单词和中文释义',
        },
        aiModel: {
            label: 'AI 模型',
            desc: '选择后台出题和批改所使用的引擎',
        },
        toast: {
            errorTitle: '异常',
        },
    },
};

const en: Translations = {
    nav: {
        home: 'Home',
        practice: 'Practice',
        settings: 'Settings',
        prompts: 'Prompt Hub',
        collapse: 'Collapse',
    },
    common: {
        back: 'Back',
        confirm: 'Confirm',
        cancel: 'Cancel',
        save: 'Save',
        saving: 'Saving...',
        saved: 'Saved',
        error: 'Error',
        loading: 'Loading...',
        home: 'Home',
        underline: 'Underline',
    },
    auth: {
        loginTitle: 'Welcome Back',
        loginSubtitle: 'Log in to continue your aIELTS learning journey',
        registerTitle: 'Create Account',
        registerSubtitle: 'Join aIELTS to master English and achieve your dreams',
        username: 'Username',
        email: 'Email Address',
        password: 'Password',
        confirmPassword: 'Confirm Password',
        loginBtn: 'Log In',
        loggingIn: 'Logging in...',
        registerBtn: 'Register',
        registering: 'Registering...',
        noAccount: "Don't have an account?",
        hasAccount: 'Already have an account?',
        toRegister: 'Sign up now',
        toLogin: 'Login here',
        backToHome: 'Back to Home',
        errorUnauthorized: 'Invalid username or password.',
        errorGeneral: 'An error occurred. Please try again later.',
        errorPasswordMismatch: 'Passwords do not match.',
        errorRegisterTaken: 'Registration failed: Username or email might be taken.',
        verificationCode: 'Verification Code',
        codePlaceholder: 'Enter 6-digit code',
        sendCode: 'Send Code',
        resendCode: 'Resend ({n}s)',
        codeSent: 'Code sent to your email, please check your inbox',
        sendingCode: 'Sending...',
        errorCodeInvalid: 'Invalid or expired code, please request a new one',
        errorEmailRequired: 'Please fill in username and email first',
        errorBanned: 'Account suspended. Please contact the administrator.',
        manualTitle: 'User Manual',
        manualSearch: 'Search features or pages...',
        manualEmpty: 'No results found',
    },
    home: {
        hero: {
            title: 'Master IELTS with aIELTS',
            subtitle: 'AI-powered all-in-one IELTS learning platform to help you break through linguistic barriers.',
            startPractice: 'Start Practice',
            vocab: 'Vocabulary',
        },
        announcements: {
            heading: 'Latest Updates',
            items: [
                { date: '2024-03-20', tag: 'New', content: 'AI Writing correction is live with real-time feedback.' },
                { date: '2024-03-15', tag: 'Optimization', content: 'Improved voice recognition for speaking practice.' },
                { date: '2024-03-10', tag: 'Community', content: 'Join our study group and work together with peers.' },
            ],
        },
        footer: '© 2024 aIELTS. All rights reserved.',
    },
    practiceHub: {
        backToHome: '← Back to Home',
        heading: 'IELTS Practice Hub',
        subheading: 'Choose your practice mode and start your efficiency journey',
        realPractice: {
            title: 'Real Past Papers',
            desc: 'Challenge yourself with real IELTS exam questions for authentic experience.',
        },
        aiPractice: {
            title: 'AI Personalized Training',
            desc: 'Intelligent question generation tailored to your personal weaknesses.',
        },
        comingSoon: 'More practice modes are coming soon...',
    },
    aiPractice: {
        backToPractice: '← Back to Hub',
        heading: 'AI Smart Practice',
        subheading: 'Powered by DeepSeek/Gemini/GPT for personalized content',
        reading: {
            title: 'AI Reading',
            desc: 'Dynamic IELTS reading passages generated based on your vocabulary level.',
        },
        listening: {
            title: 'AI Listening',
            desc: 'IELTS-style audio materials to train your hearing and word capturing.',
        },
        speaking: {
            title: 'AI Speaking',
            desc: '1:1 simulated dialogue with AI for pronunciation and grammar feedback.',
        },
        writing: {
            title: 'AI Writing',
            desc: 'Get professional feedback on vocabulary, grammar, and coherence.',
        },
        comingSoon: 'More modules for preparation are in development...',
    },
    readingConfig: {
        backToAI: '← Back to AI Practice',
        heading: 'Reading Configuration',
        subheading: 'Customize your reading training materials',
        targetScore: 'Target Band Score',
        customVocab: {
            label: 'Use Custom Vocabulary',
            desc: 'If enabled, AI will incorporate your words into the passage',
        },
        startBtn: 'Start Generating Passage',
        toast: {
            noVocab: 'Please enter some target vocabulary first',
        },
    },
    listeningConfig: {
        backToAI: '← Back to AI Practice',
        heading: 'Listening Configuration',
        subheading: 'Customize your listening training materials',
        practiceType: {
            label: 'Practice Mode',
            article: { title: 'Article Gap-fill', desc: 'Complete the passage based on audio content' },
            sentence: { title: 'Sentence Completion', desc: 'Focus on capturing core info in long sentences' },
            multipleChoice: { title: 'Multiple Choice', desc: 'Listen and answer 4-option multiple choice questions' },
        },
        targetScore: 'Target Band Score',
        wordCount: {
            label: 'Word Limit per Blank',
            min: 'Min',
            max: 'Max',
            sep: 'to',
            word: 'word(s)',
            hintExact: 'Exactly {n} word(s) per blank',
            hintRange: '{min} to {max} word(s) per blank',
        },
        customVocab: {
            label: 'Include Target Vocabulary',
            desc: 'AI will embed your specified words into the script',
        },
        startBtn: 'Start Generating Quiz',
        toast: {
            noVocab: 'Please enter some target vocabulary first',
        },
    },
    settings: {
        heading: 'Account Settings',
        subheading: 'Manage your profile, preferences, and system settings',
        language: {
            title: 'Language & Region',
            label: 'Interface Language',
            desc: 'Choose your preferred system language',
        },
        model: {
            title: 'AI Configuration',
            label: 'AI Engine',
            desc: 'Select the engine for generation and correction',
        },
        system: {
            title: 'System',
            userId: 'User ID',
            registeredTime: 'Joined Date',
            emailVerify: 'Email Verification',
            verified: 'Verified',
            notVerified: 'Not Verified',
        },
        avatar: {
            title: 'Avatar Settings',
            description: 'Click on the avatar to upload a new image',
        },
        movedMessage: 'Settings have been moved to Profile page. Please click the button below to access your Profile.',
        goToProfile: 'Go to Profile',
    },
    profile: {
        heading: 'Profile Page',
        subheading: 'Your personal dashboard for tracking progress and achievements',
        menu: {
            home: 'Overview',
            settings: 'Settings',
            backpack: 'Backpack',
            style: 'Site Style',
            background: 'Background',
            admin: 'Admin Panel',
            manual: 'User Manual',
        },
        welcome: 'Welcome to your Profile',
        welcomeDesc: 'Here you can view your balance, progress, and manage preferences.',
        info: {
            title: 'Personal Info',
            username: 'Username',
            email: 'Email',
            created: 'Joined Date',
        },
        balance: {
            title: 'AT Token Balance',
            description: 'AT is used for AI generation costs',
            recharge: 'Recharge',
            history: 'Transactions',
        },
        quickAccess: {
            title: 'Quick Access',
            practice: 'Continue',
            stats: 'Stats',
            targets: 'Targets',
            history: 'History',
            backpack: 'Backpack',
        },
        account: {
            title: 'Account Management',
            description: 'Security and deactivation',
            logout: 'Logout',
            delete: 'Delete Account',
            deleting: 'Deleting...',
            warning: 'Warning: This action is irreversible',
            confirmDelete: 'Are you sure you want to delete your account? This cannot be undone.',
        },
        backpack: {
            empty: 'Your backpack is empty',
            emptyHint: 'Get items by participating in practice or events!',
        },
        feedback: {
            title: 'Bug Feedback',
            desc: 'Found a bug? Tell us and we will fix it soon',
            email: 'Email',
            message: 'Description',
            submit: 'Send Feedback',
            success: 'Received! Thanks for your support.',
            placeholderTitle: 'Brief issue title',
            placeholderDesc: 'Please describe the problem in detail...',
            backToSubmit: 'Back to Submit',
        },
        avatarHint: 'Click to upload avatar',
        background: {
            title: 'Site Background',
            desc: 'Set custom background; applied on login, cleared on logout',
            colorSection: 'Color Customization',
            colorDesc: 'Choose solid or gradient colors',
            imageSection: 'Image Customization',
            imageDesc: 'Upload image or paste URL',
            blurSection: 'Blur Intensity',
            blurDesc: 'Only applies to images; 0 for no blur',
            blurClear: 'Clear',
            blurBlurry: 'Blurry',
            tabUrl: 'Link URL',
            tabUpload: 'Upload File',
            urlPlaceholder: 'Paste image URL',
            preview: 'Preview',
            uploading: 'Uploading...',
            uploadPlaceholder: 'Click to select image',
            uploadSuccess: 'Uploaded successfully!',
            clearBtn: 'Clear Background',
            saveTitle: 'Save Settings',
            saveAutoHint: 'Auto-saved after upload',
            presets: {
                white: 'Default White',
                beige: 'Warm Beige',
                mint: 'Mint Green',
                blue: 'Light Blue Gray',
                violet: 'Violet',
                morning: 'Morning Light',
                green: 'Greenery',
                dusk: 'Dusk',
                sky: 'Sky',
                coral: 'Coral',
            },
        },
        admin: {
            feedback: {
                title: 'Feedback Management',
                unresolved: 'Pending',
                resolved: 'Resolved',
                resolve: 'Resolve',
                delete: 'Delete',
                noData: 'No feedback found',
                total: 'Total {count} feedbacks',
            },
        },
    },
    readingDetails: {
        dictionary: 'Dictionary',
        questions: 'Questions',
        time: 'Time',
        hideTargets: '💡 Hide Target Words',
        showTargets: '💡 Show Target Words',
        submitConfirm: 'You have unanswered questions. Submit anyway?',
        writingPassage: 'AI is writing your IELTS reading passage...',
        searchPlaceholder: '🔍 Search word or meaning...',
        underline: 'Underline',
        submitBtn: 'Submit Answers',
    },
    listeningDetails: {
        startAudio: 'Start Playing',
        speaking: 'Reading...',
        audioDone: 'Playback Finished',
        typeArticle: 'Article Gap-fill',
        typeSentence: 'Sentence Gap-fill',
        typeMC: 'Multiple Choice',
        wordLimit: 'Words per blank',
        generatingAudio: 'Generating audio...',
        audioError: 'Audio playback error',
        noQuestions: 'AI failed to generate quiz, please try again',
        writingPassage: 'AI is writing your IELTS listening script...',
        wordUnit: 'words',
    },
    results: {
        analysis: 'Analysis & Explanations',
        originalPassage: 'Review Passage',
        hidePassage: 'Hide Passage',
        showPassage: 'Show Passage',
        targetVocab: 'Target Vocabulary',
        yourAnswer: 'Your Answer',
        correctAnswer: 'Correct Answer',
        acceptableAnswers: 'Acceptable Answers',
        statusCorrect: 'Correct',
        statusIncorrect: 'Incorrect',
        explanation: 'Explanation',
    },
    components: {
        vocabInput: {
            label: 'Vocab Added',
            invalidLines: 'invalid format(s)',
            placeholder: 'ubiquitous - 普遍存在的\nmitigate - 减轻\nephemeral - 短暂的\n\nOne per line: word - Chinese meaning',
            formatDesc: 'One word per line, format: word - meaning (must include EN + ZH)',
            toastHint: 'Format error: need EN word and ZH meaning',
        },
        aiModel: {
            label: 'AI Model',
            desc: 'Select the engine for generation and correction',
        },
        toast: {
            errorTitle: 'Error',
        },
    },
};

export const translations: Record<Lang, Translations> = { zh, en };
