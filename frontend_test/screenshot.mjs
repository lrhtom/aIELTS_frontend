/**
 * Frontend automatic screenshot tool (auto login + failure detection + summary report)
 *
 * Before running, make sure:
 * 1. run: npx playwright install chromium
 * 2. the frontend (5173) and backend (8000) are both up
 *
 * Usage:
 *   node screenshot.mjs                    # interactively pick language + login account, shoot every page
 *   node screenshot.mjs --lang en          # English UI, skipping the language prompt
 *   node screenshot.mjs --lang both        # one round each in Chinese and English (output into zh/ and en/ subdirectories)
 *   node screenshot.mjs --only writing     # only pages whose name or path contains 'writing' (comma-separated for several)
 *   node screenshot.mjs --full             # force a full-page screenshot everywhere (scrolling the whole page)
 *   node screenshot.mjs --no-full          # disable automatic full-page shots, capturing only the current viewport
 *   node screenshot.mjs --no-scroll        # disable the pre-scroll before a full-page shot (on by default, to trigger lazy or scroll-revealed content)
 *   # (default) with none of the above, it detects automatically: content taller than the viewport gets a full-page shot (with a pre-scroll to load lazy content), otherwise just the viewport
 *   node screenshot.mjs --zoom 0.8         # browser zoom factor (default 0.9 = 90% zoom, giving a wider view than 1440x900)
 *   node screenshot.mjs --mobile           # mobile viewport 390x844 @3x (no zoom by default)
 *   node screenshot.mjs --admin            # pick the admin account non-interactively (an interactive run asks at startup, so this is not needed then)
 *   node screenshot.mjs --headed           # headed mode (for debugging)
 *   node screenshot.mjs --out ./shots      # custom output directory
 *   node screenshot.mjs --list             # list every page and exit
 *   node screenshot.mjs --include-costly   # also shoot pages that might trigger a paid AI generation (skipped by default)
 *
 * At the end it prints a succeeded/with-errors/failed summary and writes <output directory>/_report.json;
 * the exit code is 1 if any page failed to capture.
 *
 * [On spending money] This tool cannot spend money by construction: every request to an AI generation endpoint is
 * intercepted by BILLING_ROUTES (see the comment below), and the AT balance is reconciled after the run. A drop in
 * the balance means the guard has a hole; it reports a siren and exits with code 1.
 */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline/promises';
import { emitKeypressEvents } from 'readline';
import { stdin as input, stdout as output } from 'process';

// ============================================================
// Configuration
// ============================================================
const BASE_URL = 'http://localhost:5173';
const API_BASE = 'http://localhost:8000';
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

// While logged out, AuthContext's profile probe (401) and token refresh (400) inevitably fail - expected noise on public pages
const ANON_AUTH_NOISE = /status of (400|401).*\/api\/auth\//i;

// ============================================================
// Billing guard: this tool is structurally forbidden from spending money
// ============================================================
// Background (a real incident): some answering pages, when cold-loaded with no bankId in the URL, fire a real AI
// generation - `/writing/chart/doing` does exactly that (the mount effect in chart_practice_page.tsx does
// `if (bankId) loadFromBank() else fetchChart()`). One generation costs thousands of AT, and it also inserts a junk
// row into the bank, polluting the usage statistics used in the dissertation. That has already burned money once.
//
// 'Being careful when adding pages' cannot prevent it: people will keep adding to the list and page behaviour will
// change. So this **intercepts the network** instead - any request to the endpoints below is aborted, the page
// degrades naturally to an error or empty state, the screenshot records it, and no money goes out. The list is
//
// transcribed line by line from `backend/api/urls.py` rather than guessed from keywords.
// Note that article-copy and story-mode **generate on GET too** (produced on the spot when there is no cache),
const BILLING_ROUTES = [
    /\/api\/reading\/(generate|full)\b/,
    // so these are intercepted by path, not by method.
    // Note it deliberately excludes listening/audio: that is edge-tts synthesising speech in a subprocess, which is
    // free - the view has neither a TransactionRecord nor an AIClient call (listening_views.py
    // generate_listening_audio). Blocking it would only break the listening page's player and make the screenshot unrepresentative.
    /\/api\/listening\/(generate|full)\b/,
    /\/api\/speaking\/chat\b/,
    /\/api\/speaking\/scenario\/random\b/,
    /\/api\/speaking\/part[123]\/(generate|evaluate|summary)\b/,
    /\/api\/speaking\/bank\/part[123]\/generate\b/,
    /\/api\/writing\/(generate|chat|correction)\b/,
    /\/api\/writing\/chart\/generate\b/,
    /\/api\/writing\/task2\/generate\b/,
    // Full writing set: two AI calls in one click (the Task 1 chart plus the Task 2 prompt).
    // Only /full/generate is blocked, not /full/<id>/ - the latter is the hub page's read-only polling.
    /\/api\/writing\/full\/generate\b/,
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

// The interceptor is installed on the context, so every page in this round shares it. Blocked requests are recorded
// in blocked[] and get their own column in the summary - being blocked is not an error, it is the guard working, but it must be visible.
async function installBillingGuard(context, blocked) {
    await context.route('**/api/**', async (route) => {
        const url = route.request().url();
        if (!isBillingRoute(url)) return route.continue();
        blocked.push(`${route.request().method()} ${new URL(url).pathname}`);
        return route.abort('blockedbyclient');
    });
}

// The guard's backstop: compare the AT balance before and after the run.
// The interception list is maintained by hand, so if the backend later adds a billed endpoint that is not listed here, the balance difference catches it.
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

// Dynamic route parameters: after logging in, fetch the first real record's id from the API to replace the placeholder; pages are skipped when the account has no such data
const DYNAMIC_PARAMS = {
    ':planId':     { api: '/api/plans/',                      pick: b => b?.plans?.[0]?.id,     desc: '学习计划' },
    ':notebookId': { api: '/api/notebooks/',                  pick: b => b?.notebooks?.[0]?.id, desc: '生词本' },
    ':bookId':     { api: '/api/vocab/books/',                pick: b => b?.books?.[0]?.id,     desc: '词书' },
    ':projectId':  { api: '/api/creative-workshop/projects/', pick: b => b?.projects?.[0]?.id,  desc: '创意工坊作品' },
    // bankId on an answering page: with it the page reads an existing question from the bank, without it the question is generated on the spot (which costs money).
    // So these placeholders are not just there to fill in a URL - they are the safety valve that bypasses the paid branch.
    ':bankWriting': { api: '/api/ai-questions/?skill=writing&status=ready',
                      pick: pickBankId('task2'), desc: '写作 Task2 题库题' },
    ':bankChart':   { api: '/api/ai-questions/?skill=writing&status=ready',
                      pick: pickBankId('task1', 'chart'), desc: '写作图表题库题' },
    // Same for the reading and listening answering pages: prefer the site template question, falling back to the first item in the bank
    ':bankReading':   { api: '/api/ai-questions/?skill=reading&status=ready',
                        pick: pickTemplateFirst(), desc: '阅读题库题' },
    ':bankListening': { api: '/api/ai-questions/?skill=listening&status=ready',
                        pick: pickTemplateFirst(), desc: '听力题库题' },
    ':writingFullId': { api: '/api/ai-questions/?skill=writing',
                        pick: b => bankList(b).find(q => q?.subtype === 'full')?.id, desc: '写作全套练习' },
    ':mockId':      { api: '/api/mock/', pick: b => firstOf(b, 'mocks', 'results', 'items')?.id, desc: '模拟考记录' },
};

// The bank's response shape is not identical across endpoints, so just take the first array field
function firstOf(body, ...keys) {
    for (const k of keys) {
        const v = body?.[k];
        if (Array.isArray(v) && v.length) return v[0];
    }
    if (Array.isArray(body) && body.length) return body[0];
    const arr = Object.values(body ?? {}).find(v => Array.isArray(v) && v.length);
    return arr?.[0];
}

function bankList(body) {
    return (body?.questions ?? body?.results ?? body?.items
        ?? (Array.isArray(body) ? body : [])) || [];
}

/**
 * Pick a question id from a bank listing. Priority:
 *   1. a site template question whose subtype matches  <- the admin's chosen showcase, stable in content and ideal for a screenshot
 *   2. a subtype match
 *   3. the first item in the list
 * The template question is the fixed reference for the dissertation's screenshots: a different account or a different machine still captures the same question.
 */
function pickBankId(...needles) {
    const hits = (list) => list.filter(q => needles.some(n => String(q?.subtype ?? '').includes(n)));
    return (body) => {
        const list = bankList(body);
        const matched = hits(list);
        return (matched.find(q => q?.isTemplate) ?? matched[0] ?? list.find(q => q?.isTemplate) ?? list[0])?.id;
    };
}

/** The same, but without matching on subtype: simply 'template first, otherwise the first item'. */
function pickTemplateFirst() {
    return (body) => {
        const list = bankList(body);
        return (list.find(q => q?.isTemplate) ?? list[0])?.id;
    };
}

// [path, name, opts?]
//   opts.public: true          -> capture while logged out (/login and /register redirect away once logged in)
//   opts.ignoreErrors: RegExp  -> page errors matching this are not counted as warnings
//   opts.actions: [...]        -> run { click: '<Playwright selector>', wait?: ms } in order before capturing,
//                                for different views within the same URL (tabs, panels, accordions)
//                                each step accepts: optional=true (skip the whole page when the selector is absent, without failing),
//                                waitNav=true (wait for navigation / network idle after the click), skipReason (why it was skipped)
//   a path containing ':xxxId' -> see DYNAMIC_PARAMS
const PAGES = [
    // Public pages (captured before logging in)
    ['/login', 'login', { public: true, ignoreErrors: ANON_AUTH_NOISE }],
    ['/register', 'register', { public: true, ignoreErrors: ANON_AUTH_NOISE }],

    // Top level
    ['/', 'home'],
    ['/settings', 'settings'],
    ['/store', 'store'],
    ['/feedback', 'feedback'],
    ['/markdown-notes', 'markdown_notes'],

    // Profile (one URL, with the left menu switching views)
    ['/profile', 'profile'],
    ['/profile', 'profile_analytics', { actions: [{ click: ':nth-match(.profile-menu-item, 2)' }] }],
    ['/profile', 'profile_goals',     { actions: [{ click: ':nth-match(.profile-menu-item, 3)' }] }],
    ['/profile', 'profile_finance',   { actions: [{ click: ':nth-match(.profile-menu-item, 4)' }] }],
    ['/profile', 'profile_backpack',  { actions: [{ click: ':nth-match(.profile-menu-item, 5)' }] }],
    ['/profile', 'profile_settings',  { actions: [{ click: ':nth-match(.profile-menu-item, 6)' }] }],
    ['/profile', 'profile_feedback',  { actions: [{ click: ':nth-match(.profile-menu-item, 7)' }] }],
    ['/profile', 'profile_manual',    { actions: [{ click: ':nth-match(.profile-menu-item, 8)' }] }],
    ['/profile', 'profile_background', { actions: [{ click: '.profile-accordion-trigger' }, { click: '.profile-sub-item' }] }],
    // Admin views (only captured with --admin); the style accordion's background sub-item is in the DOM too, so the admin sub-items start from nth 2
    ['/profile', 'profile_admin_users',    { admin: true, actions: [{ click: ':nth-match(.profile-accordion-trigger, 2)' }, { click: ':nth-match(.profile-sub-item, 2)' }] }],
    ['/profile', 'profile_admin_feedback', { admin: true, actions: [{ click: ':nth-match(.profile-accordion-trigger, 2)' }, { click: ':nth-match(.profile-sub-item, 3)' }] }],
    ['/profile', 'profile_admin_routes',   { admin: true, actions: [{ click: ':nth-match(.profile-accordion-trigger, 2)' }, { click: ':nth-match(.profile-sub-item, 4)' }] }],
    ['/profile', 'profile_admin_ai_usage', { admin: true, actions: [{ click: ':nth-match(.profile-accordion-trigger, 2)' }, { click: ':nth-match(.profile-sub-item, 5)' }] }],
    ['/profile', 'profile_admin_code_stats',     { admin: true, actions: [{ click: ':nth-match(.profile-accordion-trigger, 2)' }, { click: ':nth-match(.profile-sub-item, 6)' }] }],
    // The service health page opens on an empty 'start assessment' state; the button is deliberately not clicked, so a screenshot run never triggers a real (paid) AI probe
    ['/profile', 'profile_admin_service_health', { admin: true, actions: [{ click: ':nth-match(.profile-accordion-trigger, 2)' }, { click: ':nth-match(.profile-sub-item, 7)' }] }],

    // Prompt gallery (one URL, two tabs)
    ['/prompts', 'prompts'],
    ['/prompts', 'prompts_create', { actions: [{ click: ':nth-match(.prompt-tab, 2)' }] }],

    // Practice
    ['/practice', 'practice_hub'],
    ['/practice/ai', 'practice_ai'],
    // The bank's four tabs are reached with ?skill= (the page remembers the last tab, so it must be specified explicitly to be reproducible)
    ['/practice/ai/bank?skill=listening', 'practice_ai_bank_listening'],
    ['/practice/ai/bank?skill=reading',   'practice_ai_bank_reading'],
    ['/practice/ai/bank?skill=writing',   'practice_ai_bank_writing'],
    ['/practice/ai/bank?skill=speaking',  'practice_ai_bank_speaking'],
    ['/practice/ai/others', 'practice_ai_others'],
    ['/practice/ai/reading', 'practice_reading_config'],
    ['/practice/ai/listening', 'practice_listening_config'],

    // Open a question from the bank to reach the answering page (one per skill; skipped automatically when the bank is empty)
    //   Prefer clicking the site template question: the backend pins it to the top of the list (-is_template sorts first),
    //   so 'the first answerable card' is naturally the template; without one it falls back to the original first item.
    //   The click selector excludes generating and failed cards; optional means an empty bank is not a failure.
    //   Note: opening someone else's template copies it to the current account before navigating, so allow a little longer.
    ['/practice/ai/bank?skill=listening', 'practice_ai_bank_listening_open', { actions: [{ click: '.ai-bank-card:not(.is-generating):not(.is-failed)', optional: true, waitNav: true, wait: 2500, skipReason: '听力题库为空，无题目可打开' }] }],
    ['/practice/ai/bank?skill=reading',   'practice_ai_bank_reading_open',   { actions: [{ click: '.ai-bank-card:not(.is-generating):not(.is-failed)', optional: true, waitNav: true, wait: 2500, skipReason: '阅读题库为空，无题目可打开' }] }],
    ['/practice/ai/bank?skill=writing',   'practice_ai_bank_writing_open',   { actions: [{ click: '.ai-bank-card:not(.is-generating):not(.is-failed)', optional: true, waitNav: true, wait: 2500, skipReason: '写作题库为空，无题目可打开' }] }],
    ['/practice/ai/bank?skill=speaking',  'practice_ai_bank_speaking_open',  { actions: [{ click: '.ai-bank-card:not(.is-generating):not(.is-failed)', optional: true, waitNav: true, wait: 2500, skipReason: '口语题库为空，无题目可打开' }] }],

    // Full mock
    ['/practice/ai/mock', 'mock_config'],
    ['/mock/:mockId', 'mock_hub'],

    // Reading / listening / speaking runtime
    // These three pages land on the 'no config' empty state when cold-loaded with no state (fixed 2026-07) and never generate automatically
    ['/reading', 'reading'],
    ['/listening', 'listening'],
    ['/speaking', 'speaking'],
    ['/speaking/chat', 'speaking_chat'],
    ['/speaking/summary', 'speaking_summary'],

    // Writing
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
    // The answering page must carry bankId: without it, the 'generate on the spot' branch costs thousands of AT per run (see the BILLING_ROUTES comment)
    ['/writing/task2/doing?bankId=:bankWriting', 'writing_task2_doing'],
    ['/writing/chart/doing?bankId=:bankChart', 'writing_chart_doing'],
    // Full writing set (Task 1 + Task 2): the config page does not generate when cold-loaded, so it is safe; the hub page needs an existing set
    ['/writing/full', 'writing_full_config'],
    ['/writing/full/:writingFullId', 'writing_full_hub'],
    // Reading / listening answering pages: prefer the template question (as above; without bankId they take the generate-on-the-spot branch)
    ['/reading?bankId=:bankReading', 'reading_doing'],
    ['/listening?bankId=:bankListening', 'listening_doing'],

    // Vocabulary
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
    // The article-copy and story pages: the backend returns the same-day cache when it has one, and otherwise **generates on the spot and charges**
    // (learning_plan_views.py ArticleCopyGenerateView / StoryModeGenerateView).
    // Whether the cache exists depends on whether anyone ran it that day, which is unpredictable, so they are skipped by default;
    // --include-costly adds them to the list explicitly, and they are still protected by BILLING_ROUTES.
    ['/vocabulary/plans/:planId/article-copy', 'vocabulary_article_copy', { costly: true }],
    ['/vocabulary/plans/:planId/story', 'vocabulary_story_mode', { costly: true }],

    // Creative workshop
    ['/creative-workshop', 'creative_workshop'],
    ['/creative-workshop/favorites', 'creative_workshop_favorites'],
    // The preview mounts user-generated pages in a sandbox iframe, deliberately without allow-same-origin, so any
    // script inside touching localStorage necessarily throws - that is proof the isolation works, not a defect
    ['/creative-workshop/pages/:projectId', 'creative_workshop_preview',
        { ignoreErrors: /document is sandboxed and lacks the 'allow-same-origin' flag/i }],
    ['/creative-workshop/edit/:projectId', 'creative_workshop_edit'],

    // Catch-all route (App.tsx's path="*"): confirms an unknown URL is caught rather than showing a blank page
    ['/__no_such_page__', 'not_found_redirect'],

    // Add more pages here...
    // Before adding one, confirm that cold-loading it (no bankId in the URL, no location.state) does not fire an AI
    //    generation. If it does, either pass a parameter such as bankId so it uses existing data, or mark it costly: true.
    //    BILLING_ROUTES is the last line of defence, not the first.
];

const CONFIG = {
    outputDir: join(SCRIPT_DIR, 'screenshots'), // Directory the screenshots are saved to (relative to the script, overridable with --out)
    viewport: { width: 1440, height: 900 },     // Base window size (--mobile switches it to 390x844)
    zoom: 0.9,                                  // Browser zoom factor: 0.9 = 90% zoom for a wider view (the viewport becomes 1600x1000)
    deviceScaleFactor: 2,
    fullPage: false,                            // Force a full-page screenshot everywhere (enabled by --full)
    autoFull: true,                             // Automatic full-page shots: without --full, a page whose content is meaningfully taller than the viewport gets one (--no-full disables it)
    autoFullMargin: 32,                         // Automatic full-page threshold (px): the content must exceed the viewport height by this much to count as a long page, ignoring scrollbars and other minor overflow
    autoScroll: true,                           // Scroll to the bottom screen by screen and back to the top before a full-page shot, to trigger content that only loads or appears on scroll (lazy images, IntersectionObserver reveals, virtual lists) (--no-scroll disables it)
    autoScrollDelay: 150,                       // Wait after each screen of scrolling (ms): time for lazy images to decode and reveal animations to react
    autoScrollMaxSteps: 60,                     // Maximum number of scroll steps: stops very long or infinitely growing pages from hanging the script
    waitTime: 2000,                             // Extra wait once the page has settled (ms)
    settleTimeout: 10000,                       // Maximum wait for networkidle (ms); a timeout is not a failure
    navTimeout: 30000,                          // Per-page navigation timeout (ms)
    retries: 1,                                 // Number of retries after a page fails
    format: 'png',                              // 'png' or 'jpeg'

    // Automatic login test account
    auth: {
        username: 'testuser',
        password: 'testpassword123'
    },

    // Admin account (used with --admin; needed to capture the 4 admin views in the profile)
    // Logging in invalidates that account's browser session (kicked out with token_invalidated), so be careful running this while lrhtom is in use
    adminAuth: {
        username: 'lrhtom',
        password: '20040502lrh'
    }
};

const MOBILE_VIEWPORT = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 };

// ============================================================
// CLI arguments
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

// Interactively ask for whichever options were not supplied (language / login account); anything given on the command line is not asked about
async function promptOptions(args) {
    const picked = { lang: args.lang, admin: args.admin };
    if (!input.isTTY) return { lang: picked.lang ?? 'zh', admin: picked.admin }; // Non-interactive environments (CI, pipes) use the defaults

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

// Interactively ask the user for a zoom factor (%), rewriting the line in place while typing to preview the resulting viewport size live.
// Returns the zoom as a decimal (0.9, say); empty input, invalid input or a non-interactive environment returns null (the caller keeps the default).
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
            // carriage return + clear-to-end-of-line -> refresh in place for a live effect
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
                return finish(null); // empty or invalid -> use the default
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
// Login plus server-side language sync
// ============================================================
async function login(page) {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: CONFIG.navTimeout });
    await page.fill('#username', CONFIG.auth.username);
    await page.fill('#password', CONFIG.auth.password);
    await page.click('button[type="submit"]');
    // Leaving /login is the sign that login succeeded; staying on /login means it failed (wrong password, or the backend is down)
    await page.waitForURL(u => !u.pathname.startsWith('/login'), { timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: CONFIG.settleTimeout }).catch(() => {});
}

// Set the user's server-side language preference to the language chosen for this run too,
// otherwise once AuthContext loads the profile it overwrites LanguageContext from user.languagePreference
// and displaces the ielts_lang written into localStorage.
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

// Resolve every placeholder in DYNAMIC_PARAMS -> { ':planId': '3' | null, ... }
async function resolveDynamicParams(context, pages) {
    const resolved = {};
    for (const [param, { api, pick }] of Object.entries(DYNAMIC_PARAMS)) {
        if (!pages.some(([path]) => path.includes(param))) continue; // do not request what is not used
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
// Single-page capture (with retries, failure detection and console error collection)
// ============================================================
// An optional action throws when its target is missing, and shootAll uses that to record the page as skipped rather than failed
class SkipPage extends Error {
    constructor(message) { super(message); this.skip = true; }
}

// Scroll to the bottom screen by screen and back to the top, triggering content that only loads or appears on scroll - lazy images
// (loading=lazy), IntersectionObserver reveal animations, and virtual lists that render incrementally; otherwise those regions are blank or placeholders in the full-page shot.
// Wait a moment after each screen so the content can react, until the bottom is reached and the height stops growing; return to the top at the end so sticky headers reset.
async function scrollFullPage(page) {
    // Turn off smooth scrolling, so assigning scrollTop is not slowed by an animation and the measurements stay stable
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
        // reached the bottom and the total height stopped growing after triggering lazy loading -> everything is loaded
        if (atBottom && height <= prevHeight + 2) break;
        prevHeight = height;
    }
    // let lazy images and requests finish
    await page.waitForLoadState('networkidle', { timeout: CONFIG.settleTimeout }).catch(() => {});
    await page.evaluate(() => { (document.scrollingElement || document.documentElement).scrollTop = 0; });
    await page.waitForTimeout(150); // after returning to the top, wait for sticky and lazily rendered elements to settle
}

async function capturePage(page, path, opts, filepath, errors) {
    const url = `${BASE_URL}${path}`;
    // networkidle never arrives on pages with polling or long-lived connections, so it is a best-effort wait rather than a hard requirement
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: CONFIG.navTimeout });
    await page.waitForLoadState('networkidle', { timeout: CONFIG.settleTimeout }).catch(() => {});

    // When the session has expired, ProtectedRoute kicks back to /login - the screenshot would be the login page, which must count as a failure
    const finalPath = new URL(page.url()).pathname;
    if (!path.startsWith('/login') && finalPath.startsWith('/login')) {
        throw new Error('被重定向到 /login (登录态失效？)');
    }

    // Switching views within one URL (clicking a tab, expanding a panel), or opening the first list item to reach the next page
    for (const step of opts?.actions ?? []) {
        if (step.click) {
            if (step.optional) {
                // The target may not exist (an empty bank, say): wait briefly and skip the whole page if it still is not there
                const el = await page.waitForSelector(step.click, { timeout: 4000 }).catch(() => null);
                if (!el) throw new SkipPage(step.skipReason || `未找到 ${step.click}，跳过`);
                await el.click();
            } else {
                await page.click(step.click, { timeout: 5000 });
            }
        }
        // If the click navigates, wait for the page to settle before capturing (the answering page has to fetch its content by bankId)
        if (step.waitNav) {
            await page.waitForLoadState('networkidle', { timeout: CONFIG.settleTimeout }).catch(() => {});
        }
        await page.waitForTimeout(step.wait ?? 400);
    }

    if (CONFIG.waitTime > 0) await page.waitForTimeout(CONFIG.waitTime);

    // If a full-page shot is possible (forced with --full, or automatic by default), scroll to the bottom first to pull in content that only loads or appears on scroll,
    // otherwise those regions are blank or placeholders in the full-page shot. Measuring the height after scrolling is what gives the true content height.
    let fullPage = CONFIG.fullPage;
    if ((fullPage || CONFIG.autoFull) && CONFIG.autoScroll) {
        await scrollFullPage(page);
    }

    // Decide this page's capture mode: --full forces a full-page shot; otherwise detect automatically - a page meaningfully taller than the viewport gets one
    if (!fullPage && CONFIG.autoFull) {
        const contentHeight = await page.evaluate(() => Math.max(
            document.documentElement?.scrollHeight ?? 0,
            document.body?.scrollHeight ?? 0,
        ));
        const viewportHeight = page.viewportSize()?.height ?? CONFIG.viewport.height;
        fullPage = contentHeight > viewportHeight + CONFIG.autoFullMargin;
    }

    await page.screenshot({ path: filepath, fullPage, type: CONFIG.format });
    return { errors: errors.splice(0), fullPage }; // Return the errors collected on this page (and clear them) plus the capture mode actually used
}

async function shootAll(page, pages, outDir, results, lang) {
    // Collector for console errors and uncaught exceptions (capturePage drains it once per page)
    const errors = [];
    page.on('console', msg => {
        if (msg.type() !== 'error') return;
        const loc = msg.location()?.url;
        // Requests aborted by our own billing guard report ERR_BLOCKED_BY_CLIENT in the page.
        // That is not a page defect, it is us cutting them off deliberately, and it is already reported honestly in the shield column.
        // Counting it as a warning too would make it fixed noise every run and drown out real page errors.
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
                // An optional action skipping deliberately: no retry, not a failure
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
// One full round per language (separate contexts, so login states do not contaminate each other)
// ============================================================
async function runForLang(browser, lang, pages, outDir, results, guard) {
    mkdirSync(outDir, { recursive: true });
    console.log(`\n🌐 网站语言: ${lang === 'zh' ? '中文' : 'English'} (ielts_lang=${lang}) -> ${outDir}`);

    const context = await browser.newContext({
        viewport: CONFIG.viewport,
        deviceScaleFactor: CONFIG.deviceScaleFactor,
        reducedMotion: 'reduce', // Reduce transition animations for steadier screenshots
    });
    await installBillingGuard(context, guard.blocked);

    // Inject the language into localStorage before any page script runs,
    // so LanguageContext picks up the right ielts_lang on initialisation
    // rather than relying on the fragile 'log in first, then switch language in settings' flow.
    await context.addInitScript((langValue) => {
        try { localStorage.setItem('ielts_lang', langValue); } catch { /* noop */ }
    }, lang);

    const page = await context.newPage();

    try {
        // 1. Capture the public pages first (/login and /register redirect away once logged in)
        const publicPages = pages.filter(([, , opts]) => opts?.public);
        const protectedPages = pages.filter(([, , opts]) => !opts?.public);
        if (publicPages.length > 0) {
            console.log(`\n📸 未登录页面 (${publicPages.length} 个)`);
            await shootAll(page, publicPages, outDir, results, lang);
        }

        // 2. Log in (abort the round on failure - carrying on would only capture a pile of login pages)
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

        // The balance can only be read once logged in; only the first round's starting point is recorded, since every language round shares one account
        if (guard.startBalance == null) {
            guard.startBalance = await readBalance(context);
            if (guard.startBalance != null) console.log(`  💰 起始 AT 余额: ${guard.startBalance.toLocaleString()}`);
        }

        // 3. Resolve the dynamic route parameters
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

        // 4. Walk the pages and capture (reusing one page instance to keep the session)
        console.log(`\n📸 已登录页面 (${readyPages.length} 个)`);
        await shootAll(page, readyPages, outDir, results, lang);

        guard.endBalance = await readBalance(context);
    } finally {
        await context.close();
    }
}

// ============================================================
// Main flow
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
        // Distinguish 'nothing matched' from 'things matched but were all filtered out as costly' - reporting the latter as the former makes people think the filter was mistyped
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
        CONFIG.zoom = 1; // The mobile viewport keeps real device dimensions; --zoom can override it explicitly
    }
    if (args.zoom != null) {
        CONFIG.zoom = args.zoom;
    } else if (!args.mobile && input.isTTY) {
        // Without --zoom in an interactive environment: let the user specify it, previewing the resulting viewport live as they type
        const z = await promptZoom(CONFIG.viewport, CONFIG.deviceScaleFactor);
        if (z != null) CONFIG.zoom = z;
    }
    if (CONFIG.zoom !== 1) {
        // Emulate browser zoom: 90% zoom means the same window shows 1/0.9 times as much content -> equivalent to enlarging the viewport
        CONFIG.viewport = {
            width: Math.round(CONFIG.viewport.width / CONFIG.zoom),
            height: Math.round(CONFIG.viewport.height / CONFIG.zoom),
        };
    }
    console.log(`🖥️ 视口 ${CONFIG.viewport.width}x${CONFIG.viewport.height} @${CONFIG.deviceScaleFactor}x (缩放 ${Math.round(CONFIG.zoom * 100)}%)`);
    console.log(`📐 长图: ${CONFIG.fullPage ? '强制全部截长图 (--full)' : CONFIG.autoFull ? `自动检测 (内容比视口高 >${CONFIG.autoFullMargin}px 的页面截长图)` : '关闭, 只截当前视口 (--no-full)'}${(CONFIG.fullPage || CONFIG.autoFull) ? (CONFIG.autoScroll ? ' + 预滚动加载懒内容' : ' (已关闭预滚动 --no-scroll)') : ''}`);

    // Clear the old screenshot directory before each run, so images from renamed or deleted pages do not linger into this round's results
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
            // One language -> flat in the output directory (compatible with the old behaviour); both -> a subdirectory per language
            const outDir = langs.length > 1 ? join(CONFIG.outputDir, lang) : CONFIG.outputDir;
            await runForLang(browser, lang, pages, outDir, results, guard);
        }
    } finally {
        await browser.close();
    }

    // Summary
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

    // Billing guard reconciliation
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
            // The guard has a hole: BILLING_ROUTES is missing a new endpoint. This must be reported prominently.
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
