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
        absurdMode: {
            label: string;
            desc: string;
        };
        startBtn: string;
        toast: {
            noVocab: string;
        };
    };
    speakingConfig: {
        backToAI: string;
        heading: string;
        subheading: string;
        vocabSettings: {
            title: string;
            desc: string;
        };
        ieltsPart: {
            title: string;
            lockedHint: string;
            parts: {
                part1: { title: string; desc: string };
                part2: { title: string; desc: string };
                part3: { title: string; desc: string };
            };
        };
        subtitles: {
            title: string;
            desc: string;
        };
        modes: {
            title: string;
            items: {
                chat: { title: string; desc: string };
                call: { title: string; desc: string };
                exam: { title: string; desc: string };
            };
        };
        startBtn: string;
        comingSoon: string;
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
        absurdMode: {
            label: string;
            desc: string;
        };
        startBtn: string;
        toast: {
            noVocab: string;
        };
    };
    writingHub: {
        backToPractice: string;
        heading: string;
        subheading: string;
        practiceMode: string;
        correction: {
            title: string;
            desc: string;
        };
        task1: {
            title: string;
            desc: string;
        };
        task2: {
            title: string;
            desc: string;
        };
    };
    task1Selection: {
        backToWriting: string;
        heading: string;
        subheading: string;
        types: {
            chart: { title: string; nameEn: string; desc: string };
            map: { title: string; nameEn: string; desc: string };
            flowchart: { title: string; nameEn: string; desc: string };
            random: { title: string; nameEn: string; desc: string };
        };
        beta: string;
        startBtn: string;
        comingSoon: string;
    };
    chartSelection: {
        backToHub: string;
        heading: string;
        subheading: string;
        types: {
            line: { title: string; nameEn: string };
            pie: { title: string; nameEn: string };
            bar: { title: string; nameEn: string };
            horizontal: { title: string; nameEn: string };
            table: { title: string; nameEn: string };
            random: { title: string; nameEn: string };
        };
        startBtn: string;
    };
    task2Selection: {
        backToWriting: string;
        heading: string;
        subheading: string;
        types: {
            opinion: { title: string; nameEn: string; desc: string };
            report: { title: string; nameEn: string; desc: string };
            mixed: { title: string; nameEn: string; desc: string };
            random: { title: string; nameEn: string; desc: string };
            innovation: { title: string; nameEn: string; desc: string };
        };
        startBtn: string;
    };
    task2OpinionSelection: {
        backToTask2Selection: string;
        heading: string;
        subheading: string;
        types: {
            agree: { title: string; nameEn: string; desc: string };
            discuss: { title: string; nameEn: string; desc: string };
            advantages: { title: string; nameEn: string; desc: string };
            random: { title: string; nameEn: string; desc: string };
        };
        startBtn: string;
    };
    practiceSandbox: {
        loadingDescTask1: string;
        loadingDescTask2: string;
        loadingTitleTask1: string;
        loadingTitleTask2: string;
        promptTitle: string;
        yourAnswer: string;
        placeholderTask1: string;
        placeholderTask2: string;
        finishBtn: string;
        settlementTitle: string;
        settlementDesc: string;
        congratsTask1: string;
        congratsTask2: string;
        wordsWrittenStart: string;
        wordsWrittenEnd: string;
        persistTask1: string;
        persistTask2: string;
        callAiBtn: string;
        backBtn: string;
        evaluatingTitle: string;
        evaluatingDesc: string;
        evaluatingDescLine2: string;
        overallBand: string;
        backToPracticeBtn: string;
        taTask1: string;
        taTask2: string;
        cc: string;
        lr: string;
        gra: string;
        examinerReport: string;
        reviewOriginal: string;
        abortBtn: string;
        titleTask1: string;
        titleTask2: string;
        toastEmpty: string;
        toastTooShortTask1: string;
        toastTooShortTask2: string;
        toastSuccess: string;
        toastFailGenChart: string;
        toastFailGenTask2: string;
        toastFailEval: string;
    };
    writingCorrection: {
        toastEmpty: string;
        toastSuccess: string;
        toastFail: string;
        toastErrorTitle: string;
        backToHall: string;
        title: string;
        subtitle: string;
        yourEssay: string;
        wordCount: string;
        placeholder: string;
        evaluatingBtn: string;
        evaluateBtn: string;
        overallBand: string;
        ta: string;
        cc: string;
        lr: string;
        gra: string;
        examinerFeedback: string;
        promptLabel: string;
        promptPlaceholder: string;
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
            lastLogin: string;
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
        absurdMode: string;
        absurdModeOn: string;
        absurdModeOff: string;
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
        practice: '练习',
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
            vocab: '词汇学习',
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
            desc: '开启后，AI 将在文章中优先融入您提供的信息',
        },
        absurdMode: {
            label: '🎭 荒唐模式',
            desc: '开启后，AI 生成的文章将充满有趣的笑话，帮助记忆',
        },
        startBtn: '开始生成文章',
        toast: {
            noVocab: '请先输入一些目标词汇',
        },
    },
    speakingConfig: {
        backToAI: '← 返回 AI 练习',
        heading: '🗣️ 口语练习配置',
        subheading: '选择题型、模式，AI 为你模拟雅思口语考官',
        vocabSettings: {
            title: '📝 自选词汇',
            desc: '关闭后 AI 根据题型自动选择话题词汇',
        },
        ieltsPart: {
            title: '🎯 雅思题型',
            lockedHint: '🔒 仅考试模式可选',
            parts: {
                part1: { title: 'Part 1', desc: '个人话题问答' },
                part2: { title: 'Part 2', desc: '2分钟主题演讲' },
                part3: { title: 'Part 3', desc: '深度讨论分析' },
            }
        },
        subtitles: {
            title: '📄 显示字幕',
            desc: '通话/考试模式下显示 AI 的文字内容',
        },
        modes: {
            title: '⚡ 练习模式',
            items: {
                chat: { title: '聊天模式', desc: 'AI 文字对话，轻松练习' },
                call: { title: '通话模式', desc: '语音通话，沉浸式练习' },
                exam: { title: '考试模式', desc: '模拟真实雅思考试环境' },
            }
        },
        startBtn: '开始口语练习',
        comingSoon: '考试模式即将上线！',
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
        absurdMode: {
            label: '🎭 荒唐模式',
            desc: '开启后，AI 生成的听力稿将充满有趣的笑话，帮助记忆',
        },
        startBtn: '开始生成听力题目',
        toast: {
            noVocab: '请先输入一些目标词汇',
        },
    },
    writingHub: {
        backToPractice: '← 返回AI突击特训',
        heading: '写作大厅 (Writing)',
        subheading: '选择你要进行的写作练习类型',
        practiceMode: '练习模式',
        correction: {
            title: 'AI写作板块 (AI Writing)',
            desc: '将你的雅思大作文或小作文粘贴至此，AI 考官将根据雅思官方四项评分准则（Task Response, Coherence, Lexical, Grammar）为你进行深入批改和打分。'
        },
        task1: {
            title: '小作文 (Task 1)',
            desc: '针对雅思小作文（Task 1）进行专项训练。为您提供随机的图表题、地图题和流程图，帮助您学习如何构建高级词汇与描述数据或流程。'
        },
        task2: {
            title: '大作文 (Task 2)',
            desc: '针对雅思大作文（Task 2）深度特训。您可以选择不同流派类型的命题（包括观点、报告、混合等），或挑战大模型的创新预测试题。'
        }
    },
    task1Selection: {
        backToWriting: '← 返回写作大厅',
        heading: '📝 雅思小作文 (Task 1) 分类突击',
        subheading: '请选择您要专项攻克的 Task 1 题型',
        types: {
            chart: { title: '图表题', nameEn: 'Chart', desc: '包含折线、柱状、饼图及表格等数据的描述练习' },
            map: { title: '地图题', nameEn: 'Map', desc: '描述设施变迁、地理位置重建及方位等空间语言' },
            flowchart: { title: '流程图', nameEn: 'Flowchart', desc: '描述工业生产制造、自然水循环等步骤性运转原理' },
            random: { title: '随机抽取', nameEn: 'Random Selection', desc: '系统将从上述三种大类中为您随机抽取一篇进行特训' }
        },
        beta: 'Beta',
        startBtn: '🚀 开始特训',
        comingSoon: '即将开发: '
    },
    chartSelection: {
        backToHub: '← 返回雅思小作文分类',
        heading: '📊 图表题 (Chart Question)',
        subheading: '选择接下来的 Task 1 小作文要挑战的图表类型',
        types: {
            line: { title: '折线图', nameEn: 'Line graph' },
            pie: { title: '饼状图', nameEn: 'Pie chart' },
            bar: { title: '柱状图', nameEn: 'Bar chart' },
            horizontal: { title: '横向图', nameEn: 'Horizontal chart' },
            table: { title: '表格', nameEn: 'Table/chart' },
            random: { title: '随机', nameEn: 'Random' }
        },
        startBtn: '开始练习'
    },
    task2Selection: {
        backToWriting: '← 返回写作大厅',
        heading: '🖋️ 雅思大作文 (Task 2) 分类突击',
        subheading: '请选择接下来大作文练习想要挑战的文章架构类型',
        types: {
            opinion: { title: '观点题（议论文）', nameEn: 'Opinion Essay', desc: '阐述你对某一社会现象、政策或观点的明确立场（Agree/Disagree 等）' },
            report: { title: '报告文', nameEn: 'Report', desc: '分析给定现象的原因，并提出相应的解决措施 (Cause & Solution)' },
            mixed: {
                title: '混合文',
                nameEn: 'Mixed Essay',
                desc: '回答两个以上不同的提问（如：原因+观点同意程度）...',
            },
            random: {
                title: '随机选择',
                nameEn: 'Random Selection',
                desc: '系统随机抽取雅思常考话题（如教育、环境等）及考试题型',
            },
            innovation: {
                title: 'AI创新题',
                nameEn: 'AI Creative Task',
                desc: '打破常规模式！AI考官将生成雅思全新趋势预测题...',
            },
        },
        startBtn: '🚀 获取随机题干并开始作答'
    },
    task2OpinionSelection: {
        backToTask2Selection: '← 返回大作文选择',
        heading: '⚖️ 观点题 (Opinion Essay) 专项训练',
        subheading: '请选择你想集中突破的具体观点题衍生结构',
        types: {
            agree: { title: '同意与否', nameEn: 'Agree/Disagree', desc: '给出某一看法，询问你“在多大程度上同意或不同意？” (To what extent do you agree or disagree?)' },
            discuss: { title: '双边讨论', nameEn: 'Discuss both views', desc: '给出两种对立观点，要求“探讨双方观点并给出你自己的立场” (Discuss both views and give your opinion)' },
            advantages: { title: '利弊分析', nameEn: 'Advantages/Disadvantages', desc: '分析某一做法“利是否大于弊？” (Do the advantages outweigh the disadvantages?)' },
            random: { title: '随机选择', nameEn: 'Random Selection', desc: '由系统在上述观点类结构中为您抽取' }
        },
        startBtn: '🚀 开始该子类测验'
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
            lastLogin: '最近登录',
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
        absurdMode: '🎭 荒唐模式',
        absurdModeOn: '开',
        absurdModeOff: '关',
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
    practiceSandbox: {
        loadingDescTask1: 'AI 考官正在构思图表特训考卷...',
        loadingDescTask2: 'AI 考官正在构思 {type} 的考卷...',
        loadingTitleTask1: '正在为您生成专属图表题目...',
        loadingTitleTask2: '正在为您生成专属题目...',
        promptTitle: '考卷题目 (Prompt)',
        yourAnswer: '你的作答 (Your Answer)',
        placeholderTask1: 'Write your essay here... (Take about 20 minutes)',
        placeholderTask2: 'Write your essay here... (Take about 40 minutes)',
        finishBtn: '完成作答，进入核算',
        settlementTitle: '结算页',
        settlementDesc: '系统计算结果如下',
        congratsTask1: '恭喜你完成了这篇雅思小作文！',
        congratsTask2: '恭喜你完成了这篇雅思大作文！',
        wordsWrittenStart: '你一共写了 ',
        wordsWrittenEnd: ' 个单词。',
        persistTask1: '坚持练习是突破图表题解析的关键！',
        persistTask2: '坚持练习是突破写作分数的关键！',
        callAiBtn: '立即呼叫 AI 考官进行深度批改',
        backBtn: '先不批了，返回大厅',
        evaluatingTitle: 'AI 考官正在阅卷...',
        evaluatingDesc: '正在根据雅思评卷细则进行交叉验证打分：',
        evaluatingDescLine2: '任务回应统筹中... / 连贯与衔接分析中... / 词汇复杂度检索中... / 句式多样性测试中...',
        overallBand: '综合得分 (Overall Band)',
        backToPracticeBtn: '返回继续练习',
        taTask1: '任务完成情况 (Task Achievement)',
        taTask2: '任务回应 (Task Response)',
        cc: '连贯与衔接 (Coherence/Cohesion)',
        lr: '词汇资源 (Lexical Resource)',
        gra: '语法多样性 (Grammatical Range)',
        examinerReport: '考官详细反馈 (Examiner Report)',
        reviewOriginal: '你的原文回顾',
        abortBtn: '← 放弃考试',
        titleTask1: '📝 小作文特训 - 图表解析',
        titleTask2: '🖋️ 大作文特训 - {type}',
        toastEmpty: '请先输入您的作文',
        toastTooShortTask1: '字数太少了，再写一点吧 (建议至少 150 词)',
        toastTooShortTask2: '字数太少了，再多写一点吧 (建议至少 250 词)',
        toastSuccess: '批改完成！',
        toastFailGenChart: '图表生成失败',
        toastFailGenTask2: '题目获取失败',
        toastFailEval: '批改失败',
    },
    writingCorrection: {
        toastEmpty: '输入框不能为空！请先写点什么。',
        toastSuccess: '批改完成！',
        toastFail: '提交失败',
        toastErrorTitle: '错误',
        backToHall: '← 写作大厅',
        title: '📝 AI写作板块 (AI Writing)',
        subtitle: '将你的作文输入下方，获知各项评分雅思标准分级图表',
        yourEssay: '你的作文内容',
        wordCount: '字数: ',
        placeholder: '在此输入或粘贴您的雅思小作文/大作文...',
        evaluatingBtn: '⏳ AI 正在深度批改中...',
        evaluateBtn: '🏁 开始批改 (Evaluate)',
        overallBand: '综合得分 (Overall Band)',
        ta: '🎯 任务回应/完成情况 (Task Response)',
        cc: '🔗 连贯与衔接 (Coherence & Cohesion)',
        lr: '📚 词汇资源 (Lexical Resource)',
        gra: '📝 语法多样性 (Grammatical Range)',
        examinerFeedback: '💡 考官详细反馈 (Detailed Feedback by AI Examiner)',
        promptLabel: '作文题目 (选填)',
        promptPlaceholder: '（选填）将你需要回答的雅思原题粘贴在此处，有助于AI更精准地评判跑题情况...',
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
        absurdMode: {
            label: '🎭 Absurd Mode',
            desc: 'When enabled, AI will generate a passage full of jokes to aid memorization',
        },
        startBtn: 'Start Generating Passage',
        toast: {
            noVocab: 'Please enter some target vocabulary first',
        },
    },
    speakingConfig: {
        backToAI: '← Back to AI Practice',
        heading: '🗣️ Speaking Practice Config',
        subheading: 'Choose part and mode, let AI act as your IELTS examiner',
        vocabSettings: {
            title: '📝 Custom Vocabulary',
            desc: 'When disabled, AI will automatically select topical vocabulary',
        },
        ieltsPart: {
            title: '🎯 IELTS Part',
            lockedHint: '🔒 Only available in Exam Mode',
            parts: {
                part1: { title: 'Part 1', desc: 'Personal Topic Q&A' },
                part2: { title: 'Part 2', desc: '2-Minute Monologue' },
                part3: { title: 'Part 3', desc: 'In-depth Discussion' },
            }
        },
        subtitles: {
            title: '📄 Show Subtitles',
            desc: 'Display AI text content in Call/Exam mode',
        },
        modes: {
            title: '⚡ Practice Mode',
            items: {
                chat: { title: 'Chat Mode', desc: 'AI text chat for relaxed practice' },
                call: { title: 'Call Mode', desc: 'Voice call for immersive practice' },
                exam: { title: 'Exam Mode', desc: 'Simulate real IELTS test environment' },
            }
        },
        startBtn: 'Start Speaking Practice',
        comingSoon: 'Exam mode is coming soon!',
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
        absurdMode: {
            label: '🎭 Absurd Mode',
            desc: 'When enabled, AI will generate a script full of jokes to aid memorization',
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
            lastLogin: 'Last Login',
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
        absurdMode: '🎭 Absurd Mode',
        absurdModeOn: 'ON',
        absurdModeOff: 'OFF',
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
    writingHub: {
        backToPractice: '← Back to AI Practice',
        heading: 'Writing Hall (Writing)',
        subheading: 'Choose the type of writing practice you want to do',
        practiceMode: 'Practice Mode',
        correction: {
            title: 'AI Writing Correction',
            desc: 'Paste your IELTS Task 1 or Task 2 essay here, and the AI examiner will deeply correct and grade it based on the four official IELTS scoring criteria.'
        },
        task1: {
            title: 'Task 1 Practice',
            desc: 'Specialized training for IELTS Task 1. We provide random chart, map, and flowchart questions to help you learn how to construct advanced vocabulary.'
        },
        task2: {
            title: 'Task 2 Practice',
            desc: 'In-depth training for IELTS Task 2. You can choose different types of prompts or challenge the AI model\'s innovative prediction questions.'
        }
    },
    task1Selection: {
        backToWriting: '← Back to Writing Hub',
        heading: '📝 IELTS Task 1 Category Training',
        subheading: 'Please select the Task 1 type you want to focus on',
        types: {
            chart: { title: 'Chart Question', nameEn: 'Chart', desc: 'Exercises covering line, bar, pie charts and tables' },
            map: { title: 'Map Question', nameEn: 'Map', desc: 'Describe spatial language such as facility changes and orientation' },
            flowchart: { title: 'Flowchart', nameEn: 'Flowchart', desc: 'Describe step-by-step processes like industrial manufacturing' },
            random: { title: 'Random Selection', nameEn: 'Random Selection', desc: 'System will randomly pick one from the above three categories' }
        },
        beta: 'Beta',
        startBtn: '🚀 Start Training',
        comingSoon: 'Coming Soon: '
    },
    chartSelection: {
        backToHub: '← Back to Task 1 Selection',
        heading: '📊 Chart Question',
        subheading: 'Choose the chart type for your next Task 1 practice',
        types: {
            line: { title: 'Line Graph', nameEn: 'Line graph' },
            pie: { title: 'Pie Chart', nameEn: 'Pie chart' },
            bar: { title: 'Bar Chart', nameEn: 'Bar chart' },
            horizontal: { title: 'Horizontal Chart', nameEn: 'Horizontal chart' },
            table: { title: 'Table', nameEn: 'Table/chart' },
            random: { title: 'Random', nameEn: 'Random' }
        },
        startBtn: 'Start Practice'
    },
    task2Selection: {
        backToWriting: '← Back to Writing Hub',
        heading: '🖋️ IELTS Task 2 Category Training',
        subheading: 'Please select the essay structure you want to challenge',
        types: {
            opinion: { title: 'Opinion Essay', nameEn: 'Opinion Essay', desc: 'State your clear position on a social phenomenon (Agree/Disagree etc.)' },
            report: { title: 'Report', nameEn: 'Report', desc: 'Analyze causes of a phenomenon and propose solutions (Cause & Solution)' },
            mixed: { title: 'Mixed Essay', nameEn: 'Mixed Essay', desc: 'Answer two or more different questions (e.g., Cause + Opinion)' },
            random: { title: 'Random Selection', nameEn: 'Random Selection', desc: 'System randomly picks from common IELTS topics and question types' },
            innovation: { title: 'AI Creative Task', nameEn: 'AI Creative Task', desc: 'Break the mold! AI examiner generates novel IELTS trend prediction prompts' }
        },
        startBtn: '🚀 Get Random Prompt and Start'
    },
    task2OpinionSelection: {
        backToTask2Selection: '← Back to Task 2 Selection',
        heading: '⚖️ Opinion Essay Sub-topic Practice',
        subheading: 'Please select the specific Opinion derived structure you want to break through',
        types: {
            agree: { title: 'Agree/Disagree', nameEn: 'Agree/Disagree', desc: 'Given a view, asks "To what extent do you agree or disagree?"' },
            discuss: { title: 'Discuss both views', nameEn: 'Discuss both views', desc: 'Given two opposing views, asks "Discuss both views and give your opinion"' },
            advantages: { title: 'Advantages/Disadvantages', nameEn: 'Advantages/Disadvantages', desc: 'Analyze a practice: "Do the advantages outweigh the disadvantages?"' },
            random: { title: 'Random Selection', nameEn: 'Random Selection', desc: 'System will randomly pick from the above opinion structures' }
        },
        startBtn: '🚀 Start Sub-topic Quiz'
    },
    practiceSandbox: {
        loadingDescTask1: 'AI Examiner is designing a chart practice test...',
        loadingDescTask2: 'AI Examiner is designing a {type} practice test...',
        loadingTitleTask1: 'Generating your exclusive chart prompt...',
        loadingTitleTask2: 'Generating your exclusive prompt...',
        promptTitle: 'Prompt',
        yourAnswer: 'Your Answer',
        placeholderTask1: 'Write your essay here... (Take about 20 minutes)',
        placeholderTask2: 'Write your essay here... (Take about 40 minutes)',
        finishBtn: 'Finish Answering & Proceed to Settlement',
        settlementTitle: 'Settlement',
        settlementDesc: 'Results are as follows',
        congratsTask1: 'Congratulations on finishing this Task 1 essay!',
        congratsTask2: 'Congratulations on finishing this Task 2 essay!',
        wordsWrittenStart: 'You wrote a total of ',
        wordsWrittenEnd: ' words.',
        persistTask1: 'Persistence is the key to mastering chart descriptions!',
        persistTask2: 'Persistence is the key to improving your writing band!',
        callAiBtn: 'Call AI Examiner for In-depth Correction',
        backBtn: 'Skip correction for now, back to hall',
        evaluatingTitle: 'AI Examiner is grading...',
        evaluatingDesc: 'Cross-validating scores based on official IELTS rubrics:',
        evaluatingDescLine2: 'Task achievement... / Coherence & Cohesion... / Lexical range... / Grammatical accuracy...',
        overallBand: 'Overall Band',
        backToPracticeBtn: 'Back to Practice',
        taTask1: 'Task Achievement',
        taTask2: 'Task Response',
        cc: 'Coherence/Cohesion',
        lr: 'Lexical Resource',
        gra: 'Grammatical Range',
        examinerReport: 'Examiner Report',
        reviewOriginal: 'Original Text Review',
        abortBtn: '← Abort Test',
        titleTask1: '📝 Task 1 Training - Chart Analysis',
        titleTask2: '🖋️ Task 2 Training - {type}',
        toastEmpty: 'Please input your essay first',
        toastTooShortTask1: 'Your essay is too short, please write more (aim for 150+ words)',
        toastTooShortTask2: 'Your essay is too short, please write more (aim for 250+ words)',
        toastSuccess: 'Correction completed!',
        toastFailGenChart: 'Failed to generate chart prompt',
        toastFailGenTask2: 'Failed to generate prompt',
        toastFailEval: 'Failed to evaluate',
    },
    writingCorrection: {
        toastEmpty: 'The text box is empty! Please write something first.',
        toastSuccess: 'Evaluation complete!',
        toastFail: 'Submission failed',
        toastErrorTitle: 'Error',
        backToHall: '← Back to Writing Hall',
        title: '📝 AI Writing',
        subtitle: 'Enter your essay below to get a graded report based on official IELTS criteria',
        yourEssay: 'Your Essay Content',
        wordCount: 'Word Count: ',
        placeholder: 'Type or paste your IELTS Task 1 or Task 2 essay here...',
        evaluatingBtn: '⏳ AI is grading deeply...',
        evaluateBtn: '🏁 Evaluate',
        overallBand: 'Overall Band',
        ta: '🎯 Task Response / Achievement',
        cc: '🔗 Coherence & Cohesion',
        lr: '📚 Lexical Resource',
        gra: '📝 Grammatical Range and Accuracy',
        examinerFeedback: '💡 Detailed Feedback by AI Examiner',
        promptLabel: 'Essay Prompt (Optional)',
        promptPlaceholder: '(Optional) Paste the original IELTS prompt here for more accurate Task Response evaluation...',
    },
};

export const translations: Record<Lang, Translations> = { zh, en };
