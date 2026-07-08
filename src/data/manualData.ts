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
            id: 'account',
            title: '账户系统',
            icon: '🔐',
            subsections: [
                {
                    id: 'register',
                    title: '注册与邮箱验证',
                    content: '注册时需填写用户名、邮箱和密码，点击"获取验证码"后会向您的邮箱发送 6 位数字验证码，输入验证码即可完成注册。注册成功后自动登录。',
                    keywords: ['注册', '邮箱', '验证', '验证码', 'signup']
                },
                {
                    id: 'login',
                    title: '登录与密码重置',
                    content: '使用用户名和密码登录。忘记密码时，在登录页点击"忘记密码？"，输入用户名或邮箱并设置新密码（至少 6 位）即可重置。若账号被管理员封禁，登录时会提示账号异常。',
                    keywords: ['登录', '密码', '重置', '忘记', 'signin']
                },
                {
                    id: 'username',
                    title: '修改用户名',
                    content: '在"设置"页面的账号管理区域，可以修改用户名。每次改名消耗 10,000 AT 币，新用户名需 2-30 个字符，支持字母、数字、下划线、连字符和中文，不可与已有用户名重复。',
                    keywords: ['改名', '用户名', 'AT', '消耗', '修改']
                },
                {
                    id: 'avatar',
                    title: '头像上传',
                    content: '在设置页面点击头像即可上传新头像。支持 JPG/PNG/GIF/WEBP 格式，文件最大 5MB。上传后自动裁剪为 400×400 尺寸。也可删除头像恢复默认。',
                    keywords: ['头像', '上传', '图片', 'avatar']
                },
                {
                    id: 'delete',
                    title: '注销账户',
                    content: '在设置页面的账号管理区域可申请注销账户。注销后账户立即停用，30 天内可联系管理员恢复，超过 30 天将永久删除。',
                    keywords: ['注销', '删除', '账户', '恢复']
                }
            ]
        },
        {
            id: 'profile',
            title: '个人主页',
            icon: '🏠',
            subsections: [
                {
                    id: 'dashboard',
                    title: '学习仪表盘',
                    content: '个人主页顶部展示四项核心数据：今日学习时长、AT 币余额、学习计划数量和词汇总量。一目了然掌握当前学习状态。',
                    keywords: ['仪表盘', '统计', '主页', 'dashboard']
                },
                {
                    id: 'calendar',
                    title: '学习日历（热力图）',
                    content: '日历以 53 周 × 7 天的热力图展示过去一年的学习记录。颜色越深表示当天学习时间越长（<5 分钟/5-10 分钟/10-30 分钟/≥30 分钟）。顶部显示累计学习总时长、累计提交天数和连续提交天数。悬停可查看当天具体数据。',
                    keywords: ['日历', '热力图', '统计', '连续', '提交']
                },
                {
                    id: 'plans-overview',
                    title: '计划速览',
                    content: '个人主页下方展示您的学习计划列表，每个计划显示今日进度条（今日已学/今日目标）和总进度条（已学/总词数）。点击可进入计划详情。',
                    keywords: ['计划', '进度', '目标', '速览']
                },
                {
                    id: 'info',
                    title: '个人资料',
                    content: '右侧展示您的用户名、邮箱、注册时间和最近登录时间。所有信息与账户绑定，修改用户名后自动更新。',
                    keywords: ['资料', '信息', '邮箱', '注册']
                }
            ]
        },
        {
            id: 'practice',
            title: 'AI 练习模块',
            icon: '📚',
            subsections: [
                {
                    id: 'reading',
                    title: 'AI 智能阅读',
                    content: 'AI 根据目标分数和词汇量生成雅思风格阅读文章，支持选择题（A/B/C/D）和判断题（T/F 或 T/F/NG）。开启荒唐模式后 AI 会生成幽默文章。支持划词翻译、词典查询和目标词汇高亮。提交答案后查看详细解析。',
                    keywords: ['阅读', '选择题', '判断题', '荒唐', '翻译']
                },
                {
                    id: 'listening',
                    title: 'AI 智能听力',
                    content: '提供四种练习模式：文章填空、句子填空、多项选择和地图标注。AI 生成听力原文并配合语音播放。可设置每空字数限制（min/max），开启荒唐模式生成趣味内容。',
                    keywords: ['听力', '填空', '选择', '地图', '音频']
                },
                {
                    id: 'speaking',
                    title: 'AI 模拟口语',
                    content: '支持三种练习模式：自由对话（语音或键盘输入，可开启纯语音模式模拟通话）、全真模拟（1v1 考官计时，Part 选择器可选 Part 1/2/3 单项或"全套"Part 1→2→3 连续）和场景对话（角色扮演）。覆盖雅思口语 Part 1-3 全部题型。练习结束后生成总结报告。所有口语会话自动保存到 AI 题库：每轮对话与 AI 评分实时落库，中途退出可从题库"口语"标签继续；已生成报告的会话点击直达报告页。完成报告后，个人主页 → 学习分析 → 口语 标签会展示分数趋势和七维能力雷达。',
                    keywords: ['口语', '对话', '模拟', '语音', '考试', '题库', '会话', '分析']
                },
                {
                    id: 'writing',
                    title: '写作批改与训练',
                    content: '写作大厅提供三种入口：AI 写作批改（粘贴作文获取四项评分）、Task 1 特训（图表题/地图题/流程图）、Task 2 特训（观点题/报告文/混合文/AI 创新题）。Task 1 支持上传图表图片让 AI 识别。地图题提供两种生成模式：SVG 线稿（文字模型生成，仿真雅思考卷风格）和 FLUX.2-pro 光栅图（图像模型生成，更接近插画风）。批改从任务完成度、连贯与衔接、词汇资源和语法多样性四个维度评分。另有点子练习题板块，一轮生成多道观点题逐题作答并总结。',
                    keywords: ['写作', '批改', 'Task1', 'Task2', '图表', '作文', '评分']
                }
            ]
        },
        {
            id: 'vocabulary',
            title: '词汇学习系统',
            icon: '📖',
            subsections: [
                {
                    id: 'plans',
                    title: '学习计划（FSRS 间隔重复）',
                    content: '创建学习计划，设定每日学习词数（1-200），从手动输入、笔记本或官方词书添加单词。系统使用 FSRS-4.5 科学记忆算法安排复习，优先复习到期单词再学新词。每个计划最多 3 个。支持编辑计划名称、每日词数和单词列表。',
                    keywords: ['计划', 'FSRS', '间隔', '复习', '记忆', '每日']
                },
                {
                    id: 'flashcard',
                    title: '记忆卡训练',
                    content: '提供四种训练模式：记忆卡（3D 翻转卡片）、4 选 1（选择题）、看中文写英文和抄写模式。翻牌后按 1-4 评分（忘了/困难/一般/容易），系统根据 FSRS 算法自动计算下次复习时间。支持快捷键操作：空格翻转，翻牌后按 1/2/3/4 评分。',
                    keywords: ['记忆卡', '闪卡', '翻转', '训练', '评分', '快捷键']
                },
                {
                    id: 'notebook',
                    title: '我的笔记本',
                    content: '创建个人单词本（最多 10 本），自定义标题、描述和封面颜色。添加单词时支持手动输入或从官方词书批量导入。每个单词可设置自定义中文释义、音标、词性、标签（回车添加）和掌握度星级（0-5），还可添加个人笔记。支持搜索和标签过滤。',
                    keywords: ['笔记本', '单词', '标签', '导入', '释义']
                },
                {
                    id: 'books',
                    title: '官方词书',
                    content: '浏览官方 IELTS 词汇书，查看单词释义和例句。可将词书中的单词导入笔记本或学习计划。支持分页浏览和搜索。',
                    keywords: ['词书', '官方', 'IELTS', '浏览', '导入']
                }
            ]
        },
        {
            id: 'store',
            title: '商店与 AT 币',
            icon: '🛒',
            subsections: [
                {
                    id: 'store-shop',
                    title: 'AT 币充值商店',
                    content: '商店页面展示可供购买的 AT 币套餐。点击"加入购物车"将商品添加到购物车，在购物车中可以调整数量或删除商品。确认无误后点击"去支付"完成购买。管理员免单。',
                    keywords: ['商店', '充值', '购买', '购物车', '支付']
                },
                {
                    id: 'at-usage',
                    title: 'AT 币计费说明',
                    content: 'AT 币是平台虚拟货币，用于消耗 AI 算力资源。每次 AI 生成题目或批改作文都会扣除相应额度。余额不足时无法发起新练习。可在个人主页查看余额，在商店充值。AI 操作失败时会自动退还 AT 币。',
                    keywords: ['AT', '余额', '计费', '消耗', '退款', '充值']
                },
                {
                    id: 'ai-settings',
                    title: 'AI 设置与重试',
                    content: '在设置页面可选择 AI 引擎（DeepSeek/GPT 等）和设置 AI 生成重试次数（0-10 次）。更多重试次数可获得更稳定的生成结果，但会消耗更多 AT 币。建议免费用户设为 0-2 次，付费用户 3-5 次。',
                    keywords: ['AI', '模型', '引擎', '重试', '设置', 'DeepSeek', 'GPT']
                }
            ]
        },
        {
            id: 'workshop',
            title: '创意工坊',
            icon: '🎨',
            subsections: [
                {
                    id: 'workshop-create',
                    title: 'AI 生成学习网页',
                    content: '在创意工坊中输入您的学习方法描述，AI 会立即生成一个专属学习网页。可以描述您想要的功能分区、练习方式等。每个用户只能访问自己生成的页面。',
                    keywords: ['创意', '生成', '网页', 'AI', '学习']
                },
                {
                    id: 'workshop-manage',
                    title: '管理创意页面',
                    content: '您可以收藏喜欢的页面，在"我的收藏"中统一管理。不需要的页面可以删除。所有页面均为您专属，其他用户无法查看。',
                    keywords: ['收藏', '删除', '管理', '页面']
                }
            ]
        },
        {
            id: 'settings',
            title: '个性化设置',
            icon: '⚙️',
            subsections: [
                {
                    id: 'lang',
                    title: '语言切换',
                    content: '平台支持简体中文和 English 两种界面语言。在设置页面或导航栏可随时切换，所有界面文字即时生效。',
                    keywords: ['语言', '中文', 'English', '切换', 'i18n']
                },
                {
                    id: 'background',
                    title: '背景自定义',
                    content: '在"背景自定义"页面可以设置纯色或渐变色背景，或上传背景图片。支持调整背景模糊度（0 为清晰）。设置跟随账号，登录后自动应用，退出后自动清除。',
                    keywords: ['背景', '颜色', '图片', '模糊', '自定义']
                },
                {
                    id: 'admin',
                    title: '管理员功能',
                    content: '管理员账户在个人主页可访问"管理后台"。包括：用户管理（搜索、筛选、封禁/解封、删除、调整 AT 余额）和反馈管理（查看、标记已解决、删除反馈）。仅限 staff/superuser 权限账户使用。',
                    keywords: ['管理员', '后台', '封禁', '用户', 'admin']
                }
            ]
        }
    ],
    en: [
        {
            id: 'account',
            title: 'Account System',
            icon: '🔐',
            subsections: [
                {
                    id: 'register',
                    title: 'Registration & Verification',
                    content: 'Register with a username, email, and password. Click "Send Code" to receive a 6-digit verification code in your inbox. Enter the code to complete registration. You will be automatically logged in afterwards.',
                    keywords: ['register', 'email', 'verification', 'code', 'signup']
                },
                {
                    id: 'login',
                    title: 'Login & Password Reset',
                    content: 'Log in with your username and password. Forgot your password? Click "Forgot password?" on the login page, enter your username or email, and set a new password (minimum 6 characters). Banned accounts will see a suspension notice.',
                    keywords: ['login', 'password', 'reset', 'forgot', 'signin']
                },
                {
                    id: 'username',
                    title: 'Change Username',
                    content: 'You can change your username in the Settings page under Account Management. Each change costs 10,000 AT coins. New username must be 2-30 characters, supporting letters, numbers, underscores, hyphens, and Chinese characters. Must be unique.',
                    keywords: ['change', 'username', 'rename', 'AT', 'cost']
                },
                {
                    id: 'avatar',
                    title: 'Avatar Upload',
                    content: 'Click your avatar in Settings to upload a new profile picture. Supports JPG/PNG/GIF/WEBP, up to 5MB. Images are automatically cropped to 400×400. You can also delete your avatar to restore the default.',
                    keywords: ['avatar', 'upload', 'image', 'photo', 'profile']
                },
                {
                    id: 'delete',
                    title: 'Delete Account',
                    content: 'In Settings under Account Management, you can request account deletion. Your account will be immediately deactivated with a 30-day recovery window. After 30 days, it will be permanently deleted.',
                    keywords: ['delete', 'deactivate', 'account', 'recover']
                }
            ]
        },
        {
            id: 'profile',
            title: 'Profile Page',
            icon: '🏠',
            subsections: [
                {
                    id: 'dashboard',
                    title: 'Dashboard',
                    content: 'The top of your Profile page shows four key metrics: today\'s study time, AT coin balance, number of learning plans, and total vocabulary words. Get a quick overview of your learning status.',
                    keywords: ['dashboard', 'stats', 'profile', 'overview']
                },
                {
                    id: 'calendar',
                    title: 'Learning Calendar (Heatmap)',
                    content: 'The calendar displays a 53-week × 7-day heatmap of your past year\'s learning activity. Darker colors indicate longer study sessions (<5min / 5-10min / 10-30min / ≥30min). The top bar shows total study time, cumulative active days, and consecutive streak. Hover over any cell for detailed daily data.',
                    keywords: ['calendar', 'heatmap', 'streak', 'stats', 'activity']
                },
                {
                    id: 'plans-overview',
                    title: 'Plan Overview',
                    content: 'Below the dashboard, your learning plans are listed with two progress bars each: today\'s progress (studied/target) and total progress (studied/total words). Click any plan to view its details.',
                    keywords: ['plan', 'progress', 'target', 'overview']
                },
                {
                    id: 'info',
                    title: 'Personal Info',
                    content: 'The right column shows your username, email, registration date, and last login time. All information is linked to your account and updates automatically.',
                    keywords: ['info', 'profile', 'email', 'registration']
                }
            ]
        },
        {
            id: 'practice',
            title: 'AI Practice Modules',
            icon: '📚',
            subsections: [
                {
                    id: 'reading',
                    title: 'AI Reading',
                    content: 'AI generates IELTS-style reading passages based on your target score and vocabulary. Supports Multiple Choice (A/B/C/D) and True/False/Not Given questions. Enable Absurd Mode for humorous passages. Features word translation, dictionary lookup, and target vocabulary highlighting. Review detailed explanations after submission.',
                    keywords: ['reading', 'multiple choice', 'true false', 'absurd', 'translation']
                },
                {
                    id: 'listening',
                    title: 'AI Listening',
                    content: 'Four practice modes: Article Gap-fill, Sentence Completion, Multiple Choice, and Map Labelling. AI generates scripts with audio playback. Configure word limits per blank (min/max). Enable Absurd Mode for fun content.',
                    keywords: ['listening', 'gap-fill', 'multiple choice', 'map', 'audio']
                },
                {
                    id: 'speaking',
                    title: 'AI Speaking',
                    content: 'Three practice modes: Free Talk (voice or keyboard, with a voice-only toggle for call-style practice), Mock Exam (timed 1-on-1; pick Part 1/2/3 or "Full Test" for Part 1→2→3 consecutively), and Scenario (role-play). Covers all IELTS Speaking parts. A summary report is generated after each session. Every speaking session is auto-saved to the AI Question Bank: each turn and its AI scores are persisted in real time, so you can resume an unfinished session from the Speaking tab; sessions with a report open straight to the report page. Once a report exists, Profile → Analytics → Speaking shows your score trend and a 7-dimension skills radar.',
                    keywords: ['speaking', 'mock', 'voice', 'exam', 'scenario', 'bank', 'session', 'analytics']
                },
                {
                    id: 'writing',
                    title: 'Writing Correction & Training',
                    content: 'The Writing Hall offers three paths: AI Correction (paste essay, get four-criterion scores), Task 1 Training (charts/maps/flowcharts with image upload support), and Task 2 Training (opinion/report/mixed/innovative essays). Map questions support two generation modes: SVG line-art (driven by your text model, closest to real exam papers) and FLUX.2-pro raster (image model, more illustrated look). Correction covers Task Achievement, Coherence & Cohesion, Lexical Resource, and Grammatical Range. The Opinion Drill generates a set of questions for sequential practice.',
                    keywords: ['writing', 'correction', 'Task 1', 'Task 2', 'chart', 'essay', 'scoring']
                }
            ]
        },
        {
            id: 'vocabulary',
            title: 'Vocabulary System',
            icon: '📖',
            subsections: [
                {
                    id: 'plans',
                    title: 'Learning Plans (FSRS Spaced Repetition)',
                    content: 'Create up to 3 learning plans with a daily word target (1-200). Add words manually, from notebooks, or from official vocab books. The FSRS-4.5 algorithm schedules reviews scientifically — due words are reviewed first, then new words are introduced. Edit plan names, daily targets, and word lists anytime.',
                    keywords: ['plan', 'FSRS', 'spaced', 'repetition', 'memory', 'daily']
                },
                {
                    id: 'flashcard',
                    title: 'Flashcard Training',
                    content: 'Four training modes: Flashcard (3D flip cards), Multiple Choice (4 options), Writing (type English from Chinese), and Copy Mode. Rate each card after flipping (Again/Hard/Good/Easy) — the FSRS algorithm calculates your next review automatically. Keyboard shortcuts: Space to flip, then 1/2/3/4 to rate.',
                    keywords: ['flashcard', 'flip', 'training', 'rating', 'shortcut', '3D']
                },
                {
                    id: 'notebook',
                    title: 'My Notebooks',
                    content: 'Create personal word notebooks (up to 10) with custom titles, descriptions, and cover colors. Add words manually or import from official vocab books. For each word, set a custom Chinese meaning, phonetic notation, part of speech, tags (press Enter to add), mastery rating (0-5 stars), and personal notes. Search and filter by tags.',
                    keywords: ['notebook', 'word', 'tag', 'import', 'definition']
                },
                {
                    id: 'books',
                    title: 'Official Vocab Books',
                    content: 'Browse official IELTS vocabulary books with definitions and examples. Import words directly into your notebooks or learning plans. Supports paginated browsing and search.',
                    keywords: ['vocab', 'book', 'official', 'IELTS', 'browse']
                }
            ]
        },
        {
            id: 'store',
            title: 'Store & AT Coins',
            icon: '🛒',
            subsections: [
                {
                    id: 'store-shop',
                    title: 'AT Coin Store',
                    content: 'Browse and purchase AT coin packages in the Store page. Click "Add to Cart" to add items, adjust quantities or remove items in the cart, then click "Pay" to complete your purchase. Staff accounts get free checkout.',
                    keywords: ['store', 'shop', 'recharge', 'cart', 'payment']
                },
                {
                    id: 'at-usage',
                    title: 'AT Coin Billing',
                    content: 'AT coins are the platform\'s virtual currency for AI computing resources. Each AI generation or essay correction consumes AT coins. You cannot start new sessions with insufficient balance. View your balance on the Profile page and recharge in the Store. Failed AI operations automatically refund AT coins.',
                    keywords: ['AT', 'coins', 'balance', 'billing', 'refund', 'recharge']
                },
                {
                    id: 'ai-settings',
                    title: 'AI Settings & Retries',
                    content: 'In Settings, choose your AI engine (DeepSeek/GPT, etc.) and set the retry count (0-10). More retries mean more reliable generation but higher AT coin consumption. Recommended: 0-2 for free users, 3-5 for paid users.',
                    keywords: ['AI', 'model', 'engine', 'retry', 'settings', 'DeepSeek', 'GPT']
                }
            ]
        },
        {
            id: 'workshop',
            title: 'Creative Workshop',
            icon: '🎨',
            subsections: [
                {
                    id: 'workshop-create',
                    title: 'AI-Generated Learning Pages',
                    content: 'Describe your ideal learning method in the Creative Workshop and AI will generate a dedicated study webpage for you. Specify desired features, layouts, and practice formats. Each user can only access their own generated pages.',
                    keywords: ['creative', 'generate', 'webpage', 'AI', 'learning']
                },
                {
                    id: 'workshop-manage',
                    title: 'Managing Your Pages',
                    content: 'Favorite pages you like and manage them in "My Favorites". Delete pages you no longer need. All pages are private — other users cannot access them.',
                    keywords: ['favorite', 'delete', 'manage', 'pages']
                }
            ]
        },
        {
            id: 'settings',
            title: 'Personalization',
            icon: '⚙️',
            subsections: [
                {
                    id: 'lang',
                    title: 'Language Switching',
                    content: 'The platform supports both Simplified Chinese and English. Switch anytime in Settings or the navbar — all UI text updates instantly.',
                    keywords: ['language', 'Chinese', 'English', 'switch', 'i18n']
                },
                {
                    id: 'background',
                    title: 'Background Customization',
                    content: 'In the Background page, set a solid or gradient color background, or upload a background image. Adjust blur intensity (0 for sharp). Settings follow your account — applied on login, cleared on logout.',
                    keywords: ['background', 'color', 'image', 'blur', 'customize']
                },
                {
                    id: 'admin',
                    title: 'Admin Panel',
                    content: 'Staff and superuser accounts can access the Admin Panel from the Profile page. Features include: User Management (search, filter, ban/unban, delete, adjust AT balance) and Feedback Management (view, mark resolved, delete).',
                    keywords: ['admin', 'panel', 'ban', 'users', 'management']
                }
            ]
        }
    ]
};
