/**
 * 前端自动截图工具 (自动登录 + 失败检测 + 汇总报告)
 *
 * 运行前确保：
 * 1. 运行：npx playwright install chromium
 * 2. 启动前端 (5173) 和后端 (8000) 服务
 *
 * 用法：
 *   node screenshot.mjs                    # 交互式选 语言 + 登录账号，截全部页面
 *   node screenshot.mjs --lang en          # 英文界面，跳过语言询问
 *   node screenshot.mjs --lang both        # 中英各截一轮 (输出到 zh/ 和 en/ 子目录)
 *   node screenshot.mjs --only writing     # 只截 name 或 path 含 "writing" 的页面 (逗号分隔多个)
 *   node screenshot.mjs --full             # 强制所有页面截长图 (整页滚动)
 *   node screenshot.mjs --no-full          # 关闭自动长图, 强制只截当前视口
 *   node screenshot.mjs --no-scroll        # 关闭“截长图前逐屏预滚动”(默认开, 用于触发懒加载/滚动才显示的内容)
 *   # (默认) 不加上面参数时自动探测: 页面内容比视口长则截长图 (且预滚动加载懒内容), 否则只截当前视口
 *   node screenshot.mjs --zoom 0.8         # 浏览器缩放比 (默认 0.9 = 90% 缩放，视野比 1440x900 更大)
 *   node screenshot.mjs --mobile           # 手机视口 390x844 @3x (默认不缩放)
 *   node screenshot.mjs --admin            # 非交互直接选管理员账号 (交互运行时会在启动时询问，无需此参数)
 *   node screenshot.mjs --headed           # 有头模式 (调试用)
 *   node screenshot.mjs --out ./shots      # 自定义输出目录
 *   node screenshot.mjs --list             # 列出全部页面后退出
 *   node screenshot.mjs --include-costly   # 连"可能触发付费 AI 生成"的页面也截 (默认跳过)
 *
 * 结束后输出 成功/有报错/失败 统计，并写入 <输出目录>/_report.json；
 * 有页面截图失败时退出码为 1。
 *
 * 【花钱这件事】本工具在结构上不花钱：所有打到 AI 生成端点的请求都会被
 * BILLING_ROUTES 拦截 (见下方注释)，跑完还会核对 AT 余额有没有掉。余额掉了
 * 就是护栏漏了，会报 🚨 并以退出码 1 结束。
 */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline/promises';
import { emitKeypressEvents } from 'readline';
import { stdin as input, stdout as output } from 'process';

// ============================================================
// 配置区
// ============================================================
const BASE_URL = 'http://localhost:5173';
const API_BASE = 'http://localhost:8000';
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

// 未登录时 AuthContext 探测 profile (401) / 刷新 token (400) 必然失败，公开页上属预期噪音
const ANON_AUTH_NOISE = /status of (400|401).*\/api\/auth\//i;

// ============================================================
// 计费护栏：这个工具在结构上不允许花钱
// ============================================================
// 背景（真实事故）：某些答题页在冷加载、URL 上没有 bankId 时，会直接发起真实
// AI 生成——`/writing/chart/doing` 就是这样（chart_practice_page.tsx 的挂载
// effect 里 `if (bankId) loadFromBank() else fetchChart()`）。一次生成动辄几千
// AT，还会往题库里塞一行废数据，污染论文用的用量统计。之前就这样烧掉过一笔。
//
// 靠"加页面时小心点"是防不住的：清单会有人继续加，页面行为也会变。所以这里改成
// **拦网络**——凡是打到下面这些端点的请求一律 abort，页面自然退化成错误/空态，
// 截图照出，钱花不出去。列表逐条对着 `backend/api/urls.py` 抄，不是靠猜关键词。
//
// 注意 article-copy / story-mode 是 **GET 也会生成**（没缓存就现做），所以这里按
// 路径拦，不按方法拦。
const BILLING_ROUTES = [
    /\/api\/reading\/(generate|full)\b/,
    // 注意不含 listening/audio：它是 edge-tts 子进程合成语音，免费，
    // 视图里既没有 TransactionRecord 也没走 AIClient (listening_views.py
    // generate_listening_audio)。拦掉只会让听力答题页的播放器变成坏的，
    // 截出来的图不实。
    /\/api\/listening\/(generate|full)\b/,
    /\/api\/speaking\/chat\b/,
    /\/api\/speaking\/scenario\/random\b/,
    /\/api\/speaking\/part[123]\/(generate|evaluate|summary)\b/,
    /\/api\/speaking\/bank\/part[123]\/generate\b/,
    /\/api\/writing\/(generate|chat|correction)\b/,
    /\/api\/writing\/chart\/generate\b/,
    /\/api\/writing\/task2\/generate\b/,
    /\/api\/writing\/task2\/opinion-drill\/(generate|evaluate)\b/,
    /\/api\/writing\/(task1-)?ai-teacher\/generate\b/,
    /\/api\/mock\/(generate|\d+\/regenerate)\b/,
    /\/api\/creative-workshop\/projects\/generate\//,
    /\/api\/plans\/\d+\/(article-copy|story-mode)\//,
];

const isBillingRoute = (url) => {
    let pathname;
    try { pathname = new URL(url).pathname; } catch { return false; }
    return BILLING_ROUTES.some(re => re.test(pathname));
};

// 拦截器装在 context 上，本轮所有页面共享。被拦的请求记进 blocked[]，
// 汇总时单列一栏——拦到了不是"出错"，是护栏正常工作，但必须让人看见。
async function installBillingGuard(context, blocked) {
    await context.route('**/api/**', async (route) => {
        const url = route.request().url();
        if (!isBillingRoute(url)) return route.continue();
        blocked.push(`${route.request().method()} ${new URL(url).pathname}`);
        return route.abort('blockedbyclient');
    });
}

// 护栏的兜底核对：跑完比一下 AT 余额有没有掉。
// 拦截列表是人手维护的，将来后端加了新的计费端点而这里没跟上，余额差会兜住。
async function readBalance(context) {
    try {
        const res = await context.request.get(`${API_BASE}/api/balance`);
        if (!res.ok()) return null;
        const body = await res.json();
        const v = body?.at_balance ?? body?.balance ?? body?.atBalance;
        return typeof v === 'number' ? v : Number(v);
    } catch {
        return null;
    }
}

// 动态路由参数：登录后从 API 取第一条真实数据的 id 替换占位符；该账号没有数据则跳过对应页面
const DYNAMIC_PARAMS = {
    ':planId':     { api: '/api/plans/',                      pick: b => b?.plans?.[0]?.id,     desc: '学习计划' },
    ':notebookId': { api: '/api/notebooks/',                  pick: b => b?.notebooks?.[0]?.id, desc: '生词本' },
    ':bookId':     { api: '/api/vocab/books/',                pick: b => b?.books?.[0]?.id,     desc: '词书' },
    ':projectId':  { api: '/api/creative-workshop/projects/', pick: b => b?.projects?.[0]?.id,  desc: '创意工坊作品' },
    // 答题页的 bankId：带上它就走"从题库读已有题目"，不带就现场生成(要花钱)。
    // 所以这几个占位符不只是为了填个 URL，是把付费分支绕开的安全阀。
    ':bankWriting': { api: '/api/ai-questions/?skill=writing&status=ready',
                      pick: pickBankId('task2'), desc: '写作 Task2 题库题' },
    ':bankChart':   { api: '/api/ai-questions/?skill=writing&status=ready',
                      pick: pickBankId('task1', 'chart'), desc: '写作图表题库题' },
    ':mockId':      { api: '/api/mock/', pick: b => firstOf(b, 'mocks', 'results', 'items')?.id, desc: '模拟考记录' },
};

// 题库返回结构在不同端点间不完全一致，统一挑第一个数组字段
function firstOf(body, ...keys) {
    for (const k of keys) {
        const v = body?.[k];
        if (Array.isArray(v) && v.length) return v[0];
    }
    if (Array.isArray(body) && body.length) return body[0];
    const arr = Object.values(body ?? {}).find(v => Array.isArray(v) && v.length);
    return arr?.[0];
}

// 从题库列表里挑 subtype 命中任一关键词的第一条；挑不到就退回第一条
function pickBankId(...needles) {
    return (body) => {
        const list = (body?.questions ?? body?.results ?? body?.items
            ?? (Array.isArray(body) ? body : [])) || [];
        const hit = list.find(q => needles.some(n => String(q?.subtype ?? '').includes(n)));
        return (hit ?? list[0])?.id;
    };
}

// [path, name, opts?]
//   opts.public: true          → 未登录状态下截 (登录后 /login /register 会被重定向走)
//   opts.ignoreErrors: RegExp  → 匹配到的页面报错不计入 ⚠️
//   opts.actions: [...]        → 截图前依次执行 { click: '<Playwright 选择器>', wait?: ms }，
//                                用于同一 URL 内的不同视图 (tab / 面板 / 手风琴)
//                                每步可选: optional=true (选择器不存在则跳过整页, 不算失败),
//                                waitNav=true (点击后等页面导航/网络空闲), skipReason (跳过时的说明)
//   path 含 ':xxxId'           → 见 DYNAMIC_PARAMS
const PAGES = [
    // 公开页 (登录前截)
    ['/login', 'login', { public: true, ignoreErrors: ANON_AUTH_NOISE }],
    ['/register', 'register', { public: true, ignoreErrors: ANON_AUTH_NOISE }],

    // 顶层
    ['/', 'home'],
    ['/settings', 'settings'],
    ['/store', 'store'],
    ['/feedback', 'feedback'],
    ['/markdown-notes', 'markdown_notes'],

    // 个人中心 (同一 URL，左侧菜单切换视图)
    ['/profile', 'profile'],
    ['/profile', 'profile_analytics', { actions: [{ click: ':nth-match(.profile-menu-item, 2)' }] }],
    ['/profile', 'profile_goals',     { actions: [{ click: ':nth-match(.profile-menu-item, 3)' }] }],
    ['/profile', 'profile_finance',   { actions: [{ click: ':nth-match(.profile-menu-item, 4)' }] }],
    ['/profile', 'profile_backpack',  { actions: [{ click: ':nth-match(.profile-menu-item, 5)' }] }],
    ['/profile', 'profile_settings',  { actions: [{ click: ':nth-match(.profile-menu-item, 6)' }] }],
    ['/profile', 'profile_feedback',  { actions: [{ click: ':nth-match(.profile-menu-item, 7)' }] }],
    ['/profile', 'profile_manual',    { actions: [{ click: ':nth-match(.profile-menu-item, 8)' }] }],
    ['/profile', 'profile_background', { actions: [{ click: '.profile-accordion-trigger' }, { click: '.profile-sub-item' }] }],
    // 管理员视图 (--admin 时才截)；样式手风琴的 background 子项也在 DOM 里，管理员子项从 nth 2 起
    ['/profile', 'profile_admin_users',    { admin: true, actions: [{ click: ':nth-match(.profile-accordion-trigger, 2)' }, { click: ':nth-match(.profile-sub-item, 2)' }] }],
    ['/profile', 'profile_admin_feedback', { admin: true, actions: [{ click: ':nth-match(.profile-accordion-trigger, 2)' }, { click: ':nth-match(.profile-sub-item, 3)' }] }],
    ['/profile', 'profile_admin_routes',   { admin: true, actions: [{ click: ':nth-match(.profile-accordion-trigger, 2)' }, { click: ':nth-match(.profile-sub-item, 4)' }] }],
    ['/profile', 'profile_admin_ai_usage', { admin: true, actions: [{ click: ':nth-match(.profile-accordion-trigger, 2)' }, { click: ':nth-match(.profile-sub-item, 5)' }] }],
    ['/profile', 'profile_admin_code_stats',     { admin: true, actions: [{ click: ':nth-match(.profile-accordion-trigger, 2)' }, { click: ':nth-match(.profile-sub-item, 6)' }] }],
    // 服务健康页首屏为“开始测评”空态；不自动点按钮，避免每次截图都触发真实 AI 探测(有成本)
    ['/profile', 'profile_admin_service_health', { admin: true, actions: [{ click: ':nth-match(.profile-accordion-trigger, 2)' }, { click: ':nth-match(.profile-sub-item, 7)' }] }],

    // 提示词广场 (同一 URL，两个 tab)
    ['/prompts', 'prompts'],
    ['/prompts', 'prompts_create', { actions: [{ click: ':nth-match(.prompt-tab, 2)' }] }],

    // 练习
    ['/practice', 'practice_hub'],
    ['/practice/ai', 'practice_ai'],
    // 题库四个 tab 用 ?skill= 直达 (页面会记住上次 tab，必须显式指定才可复现)
    ['/practice/ai/bank?skill=listening', 'practice_ai_bank_listening'],
    ['/practice/ai/bank?skill=reading',   'practice_ai_bank_reading'],
    ['/practice/ai/bank?skill=writing',   'practice_ai_bank_writing'],
    ['/practice/ai/bank?skill=speaking',  'practice_ai_bank_speaking'],
    ['/practice/ai/others', 'practice_ai_others'],
    ['/practice/ai/reading', 'practice_reading_config'],
    ['/practice/ai/listening', 'practice_listening_config'],

    // 题库里点开“第一个题目”进入答题页 (每门一张；题库为空则自动跳过)
    //   click 选择器排除生成中/失败卡片，只点可作答的第一张；optional=空题库不算失败
    ['/practice/ai/bank?skill=listening', 'practice_ai_bank_listening_open', { actions: [{ click: '.ai-bank-card:not(.is-generating):not(.is-failed)', optional: true, waitNav: true, wait: 1500, skipReason: '听力题库为空，无题目可打开' }] }],
    ['/practice/ai/bank?skill=reading',   'practice_ai_bank_reading_open',   { actions: [{ click: '.ai-bank-card:not(.is-generating):not(.is-failed)', optional: true, waitNav: true, wait: 1500, skipReason: '阅读题库为空，无题目可打开' }] }],
    ['/practice/ai/bank?skill=writing',   'practice_ai_bank_writing_open',   { actions: [{ click: '.ai-bank-card:not(.is-generating):not(.is-failed)', optional: true, waitNav: true, wait: 1500, skipReason: '写作题库为空，无题目可打开' }] }],
    ['/practice/ai/bank?skill=speaking',  'practice_ai_bank_speaking_open',  { actions: [{ click: '.ai-bank-card:not(.is-generating):not(.is-failed)', optional: true, waitNav: true, wait: 1500, skipReason: '口语题库为空，无题目可打开' }] }],

    // 全套模拟
    ['/practice/ai/mock', 'mock_config'],
    ['/mock/:mockId', 'mock_hub'],

    // 阅读/听力/口语 运行时
    // 这三页无 state 冷加载时会落到"无配置"空态 (2026-07 修复)，不会自动生成
    ['/reading', 'reading'],
    ['/listening', 'listening'],
    ['/speaking', 'speaking'],
    ['/speaking/chat', 'speaking_chat'],
    ['/speaking/summary', 'speaking_summary'],

    // 写作
    ['/writing', 'writing_hub'],
    ['/writing/chat-config', 'writing_chat_config'],
    ['/writing/correction', 'writing_correction'],
    ['/writing/task1', 'writing_task1'],
    ['/writing/task2', 'writing_task2'],
    ['/writing/task2/opinion', 'writing_task2_opinion'],
    ['/writing/task2/opinion-drill', 'writing_task2_opinion_drill'],
    ['/writing/task2/opinion-drill/doing', 'writing_task2_opinion_drill_doing'],
    ['/writing/chat', 'writing_chat'],
    ['/writing/ai-teacher', 'writing_ai_teacher_gen'],
    ['/writing/ai-teacher/lesson', 'writing_ai_teacher_lesson'],
    ['/writing/task1-ai-teacher', 'writing_task1_ai_teacher_gen'],
    ['/writing/task1-ai-teacher/lesson', 'writing_task1_ai_teacher_lesson'],
    ['/writing/ai-teachers', 'writing_ai_teachers'],
    ['/writing/ai-teachers/records', 'writing_records'],
    // 答题页必须带 bankId：不带就是"现场生成"分支，一次几千 AT (见 BILLING_ROUTES 注释)
    ['/writing/task2/doing?bankId=:bankWriting', 'writing_task2_doing'],
    ['/writing/chart/doing?bankId=:bankChart', 'writing_chart_doing'],

    // 词汇
    ['/vocabulary', 'vocabulary_hub'],
    ['/vocabulary/practice', 'vocabulary_training_config'],
    ['/vocabulary/custom-cards', 'vocabulary_custom_cards_create'],
    ['/vocabulary/notebook', 'vocabulary_notebook_list'],
    ['/vocabulary/notebook/:notebookId', 'vocabulary_notebook_detail'],
    ['/vocabulary/books', 'vocabulary_books_list'],
    ['/vocabulary/books/:bookId', 'vocabulary_book_detail'],
    ['/vocabulary/plans', 'vocabulary_plans'],
    ['/vocabulary/plans/:planId', 'vocabulary_plan_detail'],
    ['/vocabulary/flashcard', 'vocabulary_flashcard_config'],
    ['/vocabulary/flashcard/doing', 'vocabulary_flashcard'],
    ['/vocabulary/practice/dictation/doing', 'vocabulary_training_doing'],
    ['/vocabulary/custom-cards/study', 'vocabulary_custom_cards_study'],
    ['/vocabulary/custom-cards/result', 'vocabulary_custom_cards_result'],
    // 抄写/故事两页：后端有当日缓存就直接返回，没有就**现场生成并扣费**
    // (learning_plan_views.py ArticleCopyGenerateView / StoryModeGenerateView)。
    // 缓存有没有取决于当天有没有人跑过，不可预测，所以默认不截；
    // --include-costly 显式打开时才进清单，且仍受 BILLING_ROUTES 拦截保护。
    ['/vocabulary/plans/:planId/article-copy', 'vocabulary_article_copy', { costly: true }],
    ['/vocabulary/plans/:planId/story', 'vocabulary_story_mode', { costly: true }],

    // 创意工坊
    ['/creative-workshop', 'creative_workshop'],
    ['/creative-workshop/favorites', 'creative_workshop_favorites'],
    // 预览用 sandbox iframe 装用户生成的页面，故意不给 allow-same-origin，
    // 里面的脚本碰 localStorage 必然抛错 —— 这是隔离生效的证据，不是缺陷
    ['/creative-workshop/pages/:projectId', 'creative_workshop_preview',
        { ignoreErrors: /document is sandboxed and lacks the 'allow-same-origin' flag/i }],
    ['/creative-workshop/edit/:projectId', 'creative_workshop_edit'],

    // 兜底路由 (App.tsx 的 path="*")：确认未知 URL 会被收拢而不是白屏
    ['/__no_such_page__', 'not_found_redirect'],

    // 在这里增加更多页面...
    // ⚠️ 新增前先确认该页冷加载 (URL 无 bankId / 无 location.state) 不会自动发起
    //    AI 生成。会的话要么带上 bankId 之类的参数走已有数据，要么标 costly: true。
    //    BILLING_ROUTES 是最后一道网，但别把它当第一道。
];

const CONFIG = {
    outputDir: join(SCRIPT_DIR, 'screenshots'), // 保存截图的目录 (相对脚本所在目录，可用 --out 覆盖)
    viewport: { width: 1440, height: 900 },     // 基准窗口尺寸 (--mobile 切换为 390x844)
    zoom: 0.9,                                  // 浏览器缩放比: 0.9 = 90% 缩放，视野更大 (视口放大为 1600x1000)
    deviceScaleFactor: 2,
    fullPage: false,                            // 强制所有页面截长图 (--full 开启)
    autoFull: true,                             // 自动长图: 未开 --full 时, 页面内容比视口高出一截就自动截长图 (--no-full 关闭)
    autoFullMargin: 32,                         // 自动长图阈值(px): 内容高度超过 视口高度 + 该值 才判定为“长页面”, 避开滚动条等零星溢出
    autoScroll: true,                           // 截长图前逐屏滚到底再回顶, 触发“滚动才加载/显示”的懒内容 (懒加载图片 / IntersectionObserver 揭示 / 虚拟列表) (--no-scroll 关闭)
    autoScrollDelay: 150,                       // 每屏滚动后的等待(ms): 给懒加载图片解码、揭示动画反应的时间
    autoScrollMaxSteps: 60,                     // 逐屏滚动的最多步数: 防超长/内容无限增长的页面把脚本卡死
    waitTime: 2000,                             // 页面稳定后额外等待时长(ms)
    settleTimeout: 10000,                       // networkidle 最长等待(ms)，超时不算失败
    navTimeout: 30000,                          // 单页导航超时(ms)
    retries: 1,                                 // 单页失败后的重试次数
    format: 'png',                              // 'png' 或 'jpeg'

    // 自动登录测试账号
    auth: {
        username: 'testuser',
        password: 'testpassword123'
    },

    // 管理员账号 (--admin 时使用；能截 profile 里的 4 个管理员视图)
    // ⚠️ 登录会使该账号在浏览器里的会话失效 (token_invalidated 踢下线)，正在用 lrhtom 时慎跑
    adminAuth: {
        username: 'lrhtom',
        password: '20040502lrh'
    }
};

const MOBILE_VIEWPORT = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 };

// ============================================================
// CLI 参数
// ============================================================
function parseArgs(argv) {
    const args = { lang: null, only: null, full: false, noFull: false, noScroll: false, mobile: false, headed: false, out: null, list: false, zoom: null, admin: false, includeCostly: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        switch (a) {
            case '--include-costly': args.includeCostly = true; break;
            case '--lang': args.lang = argv[++i]; break;
            case '--only': args.only = argv[++i]; break;
            case '--out': args.out = argv[++i]; break;
            case '--zoom': args.zoom = Number(argv[++i]); break;
            case '--full': args.full = true; break;
            case '--no-full': args.noFull = true; break;
            case '--no-scroll': args.noScroll = true; break;
            case '--mobile': args.mobile = true; break;
            case '--headed': args.headed = true; break;
            case '--admin': args.admin = true; break;
            case '--list': args.list = true; break;
            case '--help':
            case '-h':
                console.log('用法: node screenshot.mjs [--lang zh|en|both] [--only <过滤>] [--zoom <比例>] [--admin] [--full] [--no-full] [--no-scroll] [--mobile] [--headed] [--out <目录>] [--list] [--include-costly]');
                console.log('  默认跳过可能触发付费 AI 生成的页面; --include-costly 打开 (仍受 BILLING_ROUTES 拦截保护)');
                console.log('  长图默认自动检测: 页面比视口长自动截长图; --full 强制全部长图; --no-full 强制只截视口');
                console.log('  截长图前会默认逐屏滚动触发懒加载/滚动才显示的内容; --no-scroll 关闭该预滚动');
                process.exit(0);
                break;
            default:
                console.error(`未知参数: ${a} (--help 查看用法)`);
                process.exit(1);
        }
    }
    if (args.lang && !['zh', 'en', 'both'].includes(args.lang)) {
        console.error(`--lang 只接受 zh / en / both，收到: ${args.lang}`);
        process.exit(1);
    }
    if (args.zoom != null && !(args.zoom >= 0.3 && args.zoom <= 2)) {
        console.error(`--zoom 取值范围 0.3 ~ 2 (如 0.9 = 浏览器 90% 缩放)，收到: ${argv[argv.indexOf('--zoom') + 1]}`);
        process.exit(1);
    }
    return args;
}

// 交互式询问缺省的选项 (语言 / 登录账号)；已用命令行参数指定的不再询问
async function promptOptions(args) {
    const picked = { lang: args.lang, admin: args.admin };
    if (!input.isTTY) return { lang: picked.lang ?? 'zh', admin: picked.admin }; // 非交互环境 (CI / 管道) 用默认值

    const rl = createInterface({ input, output });
    if (!picked.lang) {
        const ans = (await rl.question('选择截图使用的网站语言 [1=中文 / 2=English / 3=both] (默认 1): ')).trim().toLowerCase();
        picked.lang = (ans === '2' || ans === 'en') ? 'en' : (ans === '3' || ans === 'both') ? 'both' : 'zh';
    }
    if (!picked.admin) {
        const ans = (await rl.question(
            `选择登录账号 [1=测试账号 ${CONFIG.auth.username} / 2=管理员 ${CONFIG.adminAuth.username} (多截 4 个管理员视图，会挤掉该账号浏览器登录态)] (默认 1): `
        )).trim().toLowerCase();
        picked.admin = (ans === '2' || ans === 'admin');
    }
    rl.close();
    return picked;
}

// 交互式让用户输入缩放比 (%)，输入时用 \r 就地重写，实时预览换算后的视口尺寸。
// 返回缩放小数 (如 0.9)；空输入 / 非法 / 非交互环境 → 返回 null (由调用方保留默认)。
async function promptZoom(base, dsf) {
    if (!input.isTTY) return null;
    return new Promise((resolve) => {
        let buffer = '';
        const calc = (pct) => {
            const z = pct / 100;
            return `${Math.round(base.width / z)}x${Math.round(base.height / z)}`;
        };
        const render = () => {
            const pct = buffer === '' ? null : Number(buffer);
            let preview;
            if (pct === null) {
                preview = '(直接回车 = 默认 90% → 视口 ' + calc(90) + `) @${dsf}x`;
            } else if (Number.isFinite(pct) && pct >= 30 && pct <= 200) {
                preview = `→ 视口 ${calc(pct)} @${dsf}x`;
            } else {
                preview = '(请输入 30 ~ 200 之间的数字)';
            }
            // \r 回行首 + \x1b[K 清到行尾 → 就地刷新，达到"实时"效果
            output.write(`\r\x1b[K🔍 缩放比 %，回车确认: ${buffer}   ${preview}`);
        };

        emitKeypressEvents(input);
        if (input.setRawMode) input.setRawMode(true);
        input.resume();
        render();

        const finish = (val) => {
            input.off('keypress', onKey);
            if (input.setRawMode) input.setRawMode(false);
            output.write('\n');
            resolve(val);
        };
        const onKey = (str, key) => {
            if (!key) return;
            if (key.name === 'return' || key.name === 'enter') {
                const pct = buffer === '' ? null : Number(buffer);
                if (pct !== null && Number.isFinite(pct) && pct >= 30 && pct <= 200) return finish(pct / 100);
                return finish(null); // 空 / 非法 → 用默认
            }
            if (key.name === 'backspace') { buffer = buffer.slice(0, -1); return render(); }
            if (key.ctrl && key.name === 'c') { finish(null); process.exit(1); }
            if (str && /[0-9.]/.test(str)) { buffer += str; render(); }
        };
        input.on('keypress', onKey);
    });
}

function filterPages(pages, only) {
    if (!only) return pages;
    const keys = only.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    return pages.filter(([path, name]) =>
        keys.some(k => name.toLowerCase().includes(k) || path.toLowerCase().includes(k)));
}

// ============================================================
// 登录 + 服务端语言同步
// ============================================================
async function login(page) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: CONFIG.navTimeout });
    await page.fill('#username', CONFIG.auth.username);
    await page.fill('#password', CONFIG.auth.password);
    await page.click('button[type="submit"]');
    // 登录成功的标志是离开 /login；停留在 /login 即失败 (密码错/后端没起)
    await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: CONFIG.settleTimeout }).catch(() => {});
}

// 把用户的服务端语言偏好也设为本次选定语言，
// 否则 AuthContext 加载 profile 后会用 user.languagePreference 反向覆盖 LanguageContext，
// 把 localStorage 设进去的 ielts_lang 顶掉。
async function syncServerLang(context, lang) {
    const cookies = await context.cookies();
    const csrf = cookies.find(c => c.name === 'aielts_csrf')?.value;
    if (!csrf) {
        console.log('  ⚠️ 未找到 aielts_csrf cookie，跳过服务端语言同步');
        return;
    }
    try {
        const res = await context.request.put(`${API_BASE}/api/auth/settings`, {
            headers: { 'X-CSRF-Token': csrf, 'Content-Type': 'application/json' },
            data: { language_preference: lang },
        });
        if (res.ok()) {
            console.log(`  ✅ 服务端 language_preference 已切到 ${lang}`);
        } else {
            console.log(`  ⚠️ 服务端语言同步失败 (HTTP ${res.status()}): ${await res.text()}`);
        }
    } catch (e) {
        console.log(`  ⚠️ 服务端语言同步异常: ${e.message}`);
    }
}

// 解析 DYNAMIC_PARAMS 里全部占位符 → { ':planId': '3' | null, ... }
async function resolveDynamicParams(context, pages) {
    const resolved = {};
    for (const [param, { api, pick }] of Object.entries(DYNAMIC_PARAMS)) {
        if (!pages.some(([path]) => path.includes(param))) continue; // 没用到就不请求
        try {
            const res = await context.request.get(`${API_BASE}${api}`);
            const id = res.ok() ? pick(await res.json()) : null;
            resolved[param] = id != null ? String(id) : null;
        } catch {
            resolved[param] = null;
        }
    }
    return resolved;
}

// ============================================================
// 单页截图 (带重试 + 失败检测 + console 错误收集)
// ============================================================
// optional action 找不到目标时抛出，shootAll 据此把该页记为“跳过”而非“失败”
class SkipPage extends Error {
    constructor(message) { super(message); this.skip = true; }
}

// 逐屏滚到底再回顶：触发“滚动才加载/显示”的懒内容 —— 懒加载图片(loading=lazy)、
// IntersectionObserver 揭示动画、以及滚动时才增量渲染的虚拟列表；否则这些区域在长图里是空白/占位。
// 每滚一屏等一小会儿让内容反应，直到到底且高度不再增长；结束回到顶部让 sticky 头部复位。
async function scrollFullPage(page) {
    // 关掉平滑滚动，避免 scrollTop 赋值被动画拖慢导致测量不稳
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; });
    let prevHeight = 0;
    for (let i = 0; i < CONFIG.autoScrollMaxSteps; i++) {
        const { atBottom, height } = await page.evaluate(() => {
            const el = document.scrollingElement || document.documentElement;
            el.scrollTop = el.scrollTop + window.innerHeight;
            const atBottom = el.scrollTop + window.innerHeight >= el.scrollHeight - 2;
            return { atBottom, height: el.scrollHeight };
        });
        await page.waitForTimeout(CONFIG.autoScrollDelay);
        // 到底了 且 触发懒加载后总高度不再变大 → 内容已全部加载出来
        if (atBottom && height <= prevHeight + 2) break;
        prevHeight = height;
    }
    // 懒加载图片/请求收尾
    await page.waitForLoadState('networkidle', { timeout: CONFIG.settleTimeout }).catch(() => {});
    await page.evaluate(() => { (document.scrollingElement || document.documentElement).scrollTop = 0; });
    await page.waitForTimeout(150); // 回顶后等 sticky/懒渲染稳定
}

async function capturePage(page, path, opts, filepath, errors) {
    const url = `${BASE_URL}${path}`;
    // networkidle 在有轮询/长连接的页面会一直等不到，作为尽力等待而非硬条件
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.navTimeout });
    await page.waitForLoadState('networkidle', { timeout: CONFIG.settleTimeout }).catch(() => {});

    // 登录态失效时 ProtectedRoute 会踢回 /login —— 截出来的是登录页，必须算失败
    const finalPath = new URL(page.url()).pathname;
    if (!path.startsWith('/login') && finalPath.startsWith('/login')) {
        throw new Error('被重定向到 /login (登录态失效？)');
    }

    // 同一 URL 内的视图切换 (点 tab / 展开面板)，或点开列表首项进入下一页
    for (const step of opts?.actions ?? []) {
        if (step.click) {
            if (step.optional) {
                // 目标可能不存在 (如题库为空)：等一小会儿，仍无则跳过整页
                const el = await page.waitForSelector(step.click, { timeout: 4000 }).catch(() => null);
                if (!el) throw new SkipPage(step.skipReason || `未找到 ${step.click}，跳过`);
                await el.click();
            } else {
                await page.click(step.click, { timeout: 5000 });
            }
        }
        // 点击若触发跳转，等页面稳定后再截 (答题页需要按 bankId 拉取内容)
        if (step.waitNav) {
            await page.waitForLoadState('networkidle', { timeout: CONFIG.settleTimeout }).catch(() => {});
        }
        await page.waitForTimeout(step.wait ?? 400);
    }

    if (CONFIG.waitTime > 0) await page.waitForTimeout(CONFIG.waitTime);

    // 若可能截长图 (强制 --full 或默认自动)，先逐屏滚到底：把“滚动才加载/显示”的懒内容拉出来，
    // 否则长图里那些区域是空白/占位。滚动后再量高度，测得的才是完整内容高度。
    let fullPage = CONFIG.fullPage;
    if ((fullPage || CONFIG.autoFull) && CONFIG.autoScroll) {
        await scrollFullPage(page);
    }

    // 决定本页截图模式：--full 强制长图；否则默认自动检测——页面真实内容比视口高出一截就截长图
    if (!fullPage && CONFIG.autoFull) {
        const contentHeight = await page.evaluate(() => Math.max(
            document.documentElement?.scrollHeight ?? 0,
            document.body?.scrollHeight ?? 0,
        ));
        const viewportHeight = page.viewportSize()?.height ?? CONFIG.viewport.height;
        fullPage = contentHeight > viewportHeight + CONFIG.autoFullMargin;
    }

    await page.screenshot({ path: filepath, fullPage, type: CONFIG.format });
    return { errors: errors.splice(0), fullPage }; // 返回本页收集到的错误(并清空) + 实际采用的截图模式
}

async function shootAll(page, pages, outDir, results, lang) {
    // console error / 未捕获异常 收集器 (capturePage 每页取走一次)
    const errors = [];
    page.on('console', msg => {
        if (msg.type() !== 'error') return;
        const loc = msg.location()?.url;
        // 被自家计费护栏 abort 掉的请求会在页面里报 ERR_BLOCKED_BY_CLIENT。
        // 那不是页面缺陷，是我们主动掐的，已经在 🛡️ 一栏如实统计过了。
        // 再计进 ⚠️ 就成了每轮都有的固定噪音，会把真的页面报错淹掉。
        if (/ERR_BLOCKED_BY_CLIENT/i.test(msg.text()) && isBillingRoute(loc ?? '')) return;
        errors.push(`[console] ${msg.text()}${loc ? ` (${loc})` : ''}`);
    });
    page.on('pageerror', err => errors.push(`[pageerror] ${err.message}`));

    for (let i = 0; i < pages.length; i++) {
        const [path, name, opts] = pages[i];
        const filename = `${name}.${CONFIG.format}`;
        const filepath = join(outDir, filename);
        const started = Date.now();
        console.log(`  [${i + 1}/${pages.length}] ${BASE_URL}${path}`);

        let lastErr = null;
        let skipped = null;
        let pageErrors = [];
        let fullPage = false;
        for (let attempt = 0; attempt <= CONFIG.retries; attempt++) {
            errors.length = 0;
            try {
                if (attempt > 0) console.log(`    🔁 重试 ${attempt}/${CONFIG.retries}...`);
                const cap = await capturePage(page, path, opts, filepath, errors);
                pageErrors = cap.errors;
                fullPage = cap.fullPage;
                if (opts?.ignoreErrors) pageErrors = pageErrors.filter(e => !opts.ignoreErrors.test(e));
                lastErr = null;
                break;
            } catch (err) {
                // optional action 主动跳过：不重试、不算失败
                if (err.skip) { skipped = err; lastErr = null; break; }
                lastErr = err;
            }
        }

        const ms = Date.now() - started;
        if (skipped) {
            console.log(`    ⏭️ 跳过: ${skipped.message}`);
            results.push({ lang, name, path, file: null, status: 'skip', errors: [skipped.message], ms });
        } else if (lastErr) {
            console.log(`    ❌ 失败: ${lastErr.message}`);
            results.push({ lang, name, path, file: null, status: 'fail', errors: [lastErr.message], ms });
        } else if (pageErrors.length > 0) {
            console.log(`    ⚠️ -> ${filepath}${fullPage ? ' 📏 长图' : ''} (${pageErrors.length} 条页面报错)`);
            results.push({ lang, name, path, file: filename, status: 'warn', full: fullPage, errors: pageErrors, ms });
        } else {
            console.log(`    ✅ -> ${filepath}${fullPage ? ' 📏 长图' : ''}`);
            results.push({ lang, name, path, file: filename, status: 'ok', full: fullPage, errors: [], ms });
        }
    }
}

// ============================================================
// 一种语言跑一整轮 (独立 context，登录态互不污染)
// ============================================================
async function runForLang(browser, lang, pages, outDir, results, guard) {
    mkdirSync(outDir, { recursive: true });
    console.log(`\n🌐 网站语言: ${lang === 'zh' ? '中文' : 'English'} (ielts_lang=${lang}) -> ${outDir}`);

    const context = await browser.newContext({
        viewport: CONFIG.viewport,
        deviceScaleFactor: CONFIG.deviceScaleFactor,
        reducedMotion: 'reduce', // 减少过渡动画，截图更稳定
    });
    await installBillingGuard(context, guard.blocked);

    // 在所有页面脚本运行前注入语言到 localStorage，
    // 这样 LanguageContext 初始化时就能拿到对应的 ielts_lang，
    // 不依赖于"先登录再去 settings 切换语言"的脆弱流程。
    await context.addInitScript((langValue) => {
        try { localStorage.setItem('ielts_lang', langValue); } catch { /* noop */ }
    }, lang);

    const page = await context.newPage();

    try {
        // 1. 公开页先截 (登录后 /login /register 会被重定向)
        const publicPages = pages.filter(([, , opts]) => opts?.public);
        const protectedPages = pages.filter(([, , opts]) => !opts?.public);
        if (publicPages.length > 0) {
            console.log(`\n📸 未登录页面 (${publicPages.length} 个)`);
            await shootAll(page, publicPages, outDir, results, lang);
        }

        // 2. 登录 (失败直接中止本轮 —— 继续跑只会截出一堆登录页)
        console.log(`\n🔑 正在使用测试账号 (${CONFIG.auth.username}) 登录...`);
        try {
            await login(page);
            console.log('  ✅ 登录成功！');
        } catch (e) {
            console.log(`  ❌ 登录失败: ${e.message}`);
            console.log('  ⛔ 中止本轮受保护页面截图 (请确认前后端已启动、测试账号可用)');
            for (const [path, name] of protectedPages) {
                results.push({ lang, name, path, file: null, status: 'fail', errors: ['未登录，跳过'], ms: 0 });
            }
            return;
        }

        await syncServerLang(context, lang);

        // 登录后才能读余额；只记第一轮的起点，多语言轮次共用同一账号
        if (guard.startBalance == null) {
            guard.startBalance = await readBalance(context);
            if (guard.startBalance != null) console.log(`  💰 起始 AT 余额: ${guard.startBalance.toLocaleString()}`);
        }

        // 3. 动态路由参数解析
        const params = await resolveDynamicParams(context, protectedPages);
        const readyPages = [];
        for (const entry of protectedPages) {
            const param = Object.keys(DYNAMIC_PARAMS).find(p => entry[0].includes(p));
            if (!param) {
                readyPages.push(entry);
            } else if (params[param]) {
                readyPages.push([entry[0].replace(param, params[param]), entry[1], entry[2]]);
            } else {
                const desc = DYNAMIC_PARAMS[param].desc;
                console.log(`  ⚠️ 该账号没有${desc}，跳过 ${entry[1]}`);
                results.push({ lang, name: entry[1], path: entry[0], file: null, status: 'skip', errors: [`无可用${desc}`], ms: 0 });
            }
        }

        // 4. 遍历截图 (同一个 page 实例以保持登录态)
        console.log(`\n📸 已登录页面 (${readyPages.length} 个)`);
        await shootAll(page, readyPages, outDir, results, lang);

        guard.endBalance = await readBalance(context);
    } finally {
        await context.close();
    }
}

// ============================================================
// 主流程
// ============================================================
async function run() {
    const args = parseArgs(process.argv.slice(2));

    let pages = filterPages(PAGES, args.only);
    const matchedBeforeCostly = pages.length;
    let droppedCostly = [];
    if (!args.includeCostly) {
        droppedCostly = pages.filter(([, , o]) => o?.costly);
        pages = pages.filter(([, , o]) => !o?.costly);
        if (droppedCostly.length) {
            console.log(`💸 跳过 ${droppedCostly.length} 个可能触发付费生成的页面 (${droppedCostly.map(p => p[1]).join(', ')})`);
            console.log('   要截它们加 --include-costly；届时 BILLING_ROUTES 仍会拦住实际的生成请求。');
        }
    }
    if (pages.length === 0) {
        // 区分"没匹配上"和"匹配上了但全被 costly 过滤掉了" —— 后者报前者会让人以为写错了过滤词
        if (matchedBeforeCostly > 0) {
            console.error(`--only "${args.only}" 匹配到的 ${matchedBeforeCostly} 个页面全部标记为可能付费，已被跳过。`);
            console.error('确实要截就加 --include-costly。');
        } else {
            console.error(`--only "${args.only}" 没有匹配到任何页面 (--list 查看全部)`);
        }
        process.exit(1);
    }
    if (args.list) {
        for (const [path, name, opts] of pages) {
            const tag = opts?.public ? '[公开] ' : opts?.admin ? '[管理员] ' : '';
            console.log(`${tag}${name.padEnd(36)} ${path}`);
        }
        return;
    }

    const { lang: langChoice, admin } = await promptOptions(args);

    if (admin) {
        CONFIG.auth = CONFIG.adminAuth;
        console.log(`⚠️ 管理员模式: 用 ${CONFIG.adminAuth.username} 登录 —— 会把该账号已有的登录会话挤下线`);
    } else {
        pages = pages.filter(([, , opts]) => !opts?.admin);
        if (pages.length === 0) {
            console.error(`--only "${args.only}" 只匹配到管理员页面，但选择了测试账号 (管理员账号才能截)`);
            process.exit(1);
        }
    }

    if (args.full) CONFIG.fullPage = true;
    if (args.noFull) CONFIG.autoFull = false;
    if (args.noScroll) CONFIG.autoScroll = false;
    if (args.out) CONFIG.outputDir = args.out;
    if (args.mobile) {
        CONFIG.viewport = MOBILE_VIEWPORT.viewport;
        CONFIG.deviceScaleFactor = MOBILE_VIEWPORT.deviceScaleFactor;
        CONFIG.zoom = 1; // 手机视口保持真实设备尺寸，--zoom 可显式覆盖
    }
    if (args.zoom != null) {
        CONFIG.zoom = args.zoom;
    } else if (!args.mobile && input.isTTY) {
        // 未用 --zoom 且交互环境：让用户自己指定，输入时实时预览换算后的视口
        const z = await promptZoom(CONFIG.viewport, CONFIG.deviceScaleFactor);
        if (z != null) CONFIG.zoom = z;
    }
    if (CONFIG.zoom !== 1) {
        // 模拟浏览器缩放：90% 缩放 = 同一窗口能看到 1/0.9 倍的内容 → 等效于放大视口
        CONFIG.viewport = {
            width: Math.round(CONFIG.viewport.width / CONFIG.zoom),
            height: Math.round(CONFIG.viewport.height / CONFIG.zoom),
        };
    }
    console.log(`🖥️ 视口 ${CONFIG.viewport.width}x${CONFIG.viewport.height} @${CONFIG.deviceScaleFactor}x (缩放 ${Math.round(CONFIG.zoom * 100)}%)`);
    console.log(`📐 长图: ${CONFIG.fullPage ? '强制全部截长图 (--full)' : CONFIG.autoFull ? `自动检测 (内容比视口高 >${CONFIG.autoFullMargin}px 的页面截长图)` : '关闭, 只截当前视口 (--no-full)'}${(CONFIG.fullPage || CONFIG.autoFull) ? (CONFIG.autoScroll ? ' + 预滚动加载懒内容' : ' (已关闭预滚动 --no-scroll)') : ''}`);

    // 每次拍照前清空旧截图目录，避免改名/删页后的旧图残留混进本轮结果
    try {
        rmSync(CONFIG.outputDir, { recursive: true, force: true });
        console.log(`🧹 已清空旧截图目录: ${CONFIG.outputDir}`);
    } catch (e) {
        console.log(`  ⚠️ 清空旧截图目录失败 (忽略): ${e.message}`);
    }

    const langs = langChoice === 'both' ? ['zh', 'en'] : [langChoice];

    const started = Date.now();
    const browser = await chromium.launch({ headless: !args.headed });
    const results = [];
    const guard = { blocked: [], startBalance: null, endBalance: null };
    try {
        for (const lang of langs) {
            // 单语言 → 平铺在输出目录 (与旧版兼容)；both → 按语言分子目录
            const outDir = langs.length > 1 ? join(CONFIG.outputDir, lang) : CONFIG.outputDir;
            await runForLang(browser, lang, pages, outDir, results, guard);
        }
    } finally {
        await browser.close();
    }

    // 汇总
    const ok = results.filter(r => r.status === 'ok');
    const warn = results.filter(r => r.status === 'warn');
    const skip = results.filter(r => r.status === 'skip');
    const fail = results.filter(r => r.status === 'fail');
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎉 完成！ ✅ ${ok.length} 成功  ⚠️ ${warn.length} 有页面报错  ⏭️ ${skip.length} 跳过  ❌ ${fail.length} 失败  (耗时 ${elapsed}s)`);
    for (const r of warn) {
        console.log(`  ⚠️ [${r.lang}] ${r.name}: ${r.errors[0]}${r.errors.length > 1 ? ` (+${r.errors.length - 1} 条)` : ''}`);
    }
    for (const r of skip) {
        console.log(`  ⏭️ [${r.lang}] ${r.name}: ${r.errors[0]}`);
    }
    for (const r of fail) {
        console.log(`  ❌ [${r.lang}] ${r.name}: ${r.errors[0]}`);
    }

    // 计费护栏结算
    if (guard.blocked.length > 0) {
        const tally = guard.blocked.reduce((m, k) => (m[k] = (m[k] ?? 0) + 1, m), {});
        console.log(`\n🛡️ 已拦截 ${guard.blocked.length} 次计费调用 (护栏生效，未花钱)：`);
        for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
            console.log(`     ${String(n).padStart(3)} × ${k}`);
        }
        console.log('     ↑ 说明这些页面在冷加载时会自己发起生成；截到的是它们的失败/空态。');
    }
    const { startBalance: b0, endBalance: b1 } = guard;
    if (b0 != null && b1 != null) {
        const delta = b0 - b1;
        if (delta > 0) {
            // 护栏漏了：BILLING_ROUTES 没覆盖到某个新端点。必须显眼报出来。
            console.log(`\n🚨 AT 余额下降 ${delta.toLocaleString()} (${b0.toLocaleString()} → ${b1.toLocaleString()})`);
            console.log('   护栏没拦住某个计费端点 —— 请把它补进 BILLING_ROUTES。');
            process.exitCode = 1;
        } else {
            console.log(`\n💰 AT 余额未变 (${b1.toLocaleString()})，本轮零花费 ✅`);
        }
    }

    mkdirSync(CONFIG.outputDir, { recursive: true });
    const reportPath = join(CONFIG.outputDir, '_report.json');
    writeFileSync(reportPath, JSON.stringify({
        generatedAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        viewport: CONFIG.viewport,
        zoom: CONFIG.zoom,
        fullPage: CONFIG.fullPage,
        autoFull: CONFIG.fullPage ? false : CONFIG.autoFull,
        autoScroll: (CONFIG.fullPage || CONFIG.autoFull) ? CONFIG.autoScroll : false,
        langs,
        summary: { ok: ok.length, warn: warn.length, skip: skip.length, fail: fail.length, elapsedSeconds: Number(elapsed) },
        billingGuard: {
            blockedCount: guard.blocked.length,
            blocked: guard.blocked,
            atBalanceStart: guard.startBalance,
            atBalanceEnd: guard.endBalance,
            atSpent: (guard.startBalance != null && guard.endBalance != null)
                ? guard.startBalance - guard.endBalance : null,
        },
        results,
    }, null, 2));
    console.log(`📄 报告: ${reportPath}\n`);

    if (fail.length > 0) process.exitCode = 1;
}

run().catch(err => { console.error(err); process.exitCode = 1; });
