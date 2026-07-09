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
 *   node screenshot.mjs --full             # 截长图 (整页滚动)
 *   node screenshot.mjs --zoom 0.8         # 浏览器缩放比 (默认 0.9 = 90% 缩放，视野比 1440x900 更大)
 *   node screenshot.mjs --mobile           # 手机视口 390x844 @3x (默认不缩放)
 *   node screenshot.mjs --admin            # 非交互直接选管理员账号 (交互运行时会在启动时询问，无需此参数)
 *   node screenshot.mjs --headed           # 有头模式 (调试用)
 *   node screenshot.mjs --out ./shots      # 自定义输出目录
 *   node screenshot.mjs --list             # 列出全部页面后退出
 *
 * 结束后输出 成功/有报错/失败 统计，并写入 <输出目录>/_report.json；
 * 有页面截图失败时退出码为 1。
 */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

// ============================================================
// 配置区
// ============================================================
const BASE_URL = 'http://localhost:5173';
const API_BASE = 'http://localhost:8000';
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

// 未登录时 AuthContext 探测 profile (401) / 刷新 token (400) 必然失败，公开页上属预期噪音
const ANON_AUTH_NOISE = /status of (400|401).*\/api\/auth\//i;

// 动态路由参数：登录后从 API 取第一条真实数据的 id 替换占位符；该账号没有数据则跳过对应页面
const DYNAMIC_PARAMS = {
    ':planId':     { api: '/api/plans/',                      pick: b => b?.plans?.[0]?.id,     desc: '学习计划' },
    ':notebookId': { api: '/api/notebooks/',                  pick: b => b?.notebooks?.[0]?.id, desc: '生词本' },
    ':bookId':     { api: '/api/vocab/books/',                pick: b => b?.books?.[0]?.id,     desc: '词书' },
    ':projectId':  { api: '/api/creative-workshop/projects/', pick: b => b?.projects?.[0]?.id,  desc: '创意工坊作品' },
};

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

    // 阅读/听力/口语 运行时
    ['/reading', 'reading'],
    ['/listening', 'listening'],
    ['/speaking', 'speaking'],

    // 写作
    ['/writing', 'writing_hub'],
    ['/writing/chat-config', 'writing_chat_config'],
    ['/writing/correction', 'writing_correction'],
    ['/writing/task1', 'writing_task1'],
    ['/writing/task2', 'writing_task2'],
    ['/writing/task2/opinion', 'writing_task2_opinion'],
    ['/writing/task2/opinion-drill', 'writing_task2_opinion_drill'],
    ['/writing/ai-teacher', 'writing_ai_teacher_gen'],
    ['/writing/task1-ai-teacher', 'writing_task1_ai_teacher_gen'],
    ['/writing/ai-teachers', 'writing_ai_teachers'],
    ['/writing/ai-teachers/records', 'writing_records'],

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
    ['/vocabulary/flashcard/doing', 'vocabulary_flashcard'],

    // 创意工坊
    ['/creative-workshop', 'creative_workshop'],
    ['/creative-workshop/favorites', 'creative_workshop_favorites'],
    ['/creative-workshop/pages/:projectId', 'creative_workshop_preview'],
    ['/creative-workshop/edit/:projectId', 'creative_workshop_edit'],

    // 在这里增加更多页面...
];

const CONFIG = {
    outputDir: join(SCRIPT_DIR, 'screenshots'), // 保存截图的目录 (相对脚本所在目录，可用 --out 覆盖)
    viewport: { width: 1440, height: 900 },     // 基准窗口尺寸 (--mobile 切换为 390x844)
    zoom: 0.9,                                  // 浏览器缩放比: 0.9 = 90% 缩放，视野更大 (视口放大为 1600x1000)
    deviceScaleFactor: 2,
    fullPage: false,                            // 是否截长图 (--full 开启)
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
    const args = { lang: null, only: null, full: false, mobile: false, headed: false, out: null, list: false, zoom: null, admin: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        switch (a) {
            case '--lang': args.lang = argv[++i]; break;
            case '--only': args.only = argv[++i]; break;
            case '--out': args.out = argv[++i]; break;
            case '--zoom': args.zoom = Number(argv[++i]); break;
            case '--full': args.full = true; break;
            case '--mobile': args.mobile = true; break;
            case '--headed': args.headed = true; break;
            case '--admin': args.admin = true; break;
            case '--list': args.list = true; break;
            case '--help':
            case '-h':
                console.log('用法: node screenshot.mjs [--lang zh|en|both] [--only <过滤>] [--zoom <比例>] [--admin] [--full] [--mobile] [--headed] [--out <目录>] [--list]');
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
    await page.screenshot({ path: filepath, fullPage: CONFIG.fullPage, type: CONFIG.format });
    return errors.splice(0); // 返回并清空本页收集到的错误
}

async function shootAll(page, pages, outDir, results, lang) {
    // console error / 未捕获异常 收集器 (capturePage 每页取走一次)
    const errors = [];
    page.on('console', msg => {
        if (msg.type() !== 'error') return;
        const loc = msg.location()?.url;
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
        for (let attempt = 0; attempt <= CONFIG.retries; attempt++) {
            errors.length = 0;
            try {
                if (attempt > 0) console.log(`    🔁 重试 ${attempt}/${CONFIG.retries}...`);
                pageErrors = await capturePage(page, path, opts, filepath, errors);
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
            console.log(`    ⚠️ -> ${filepath} (${pageErrors.length} 条页面报错)`);
            results.push({ lang, name, path, file: filename, status: 'warn', errors: pageErrors, ms });
        } else {
            console.log(`    ✅ -> ${filepath}`);
            results.push({ lang, name, path, file: filename, status: 'ok', errors: [], ms });
        }
    }
}

// ============================================================
// 一种语言跑一整轮 (独立 context，登录态互不污染)
// ============================================================
async function runForLang(browser, lang, pages, outDir, results) {
    mkdirSync(outDir, { recursive: true });
    console.log(`\n🌐 网站语言: ${lang === 'zh' ? '中文' : 'English'} (ielts_lang=${lang}) -> ${outDir}`);

    const context = await browser.newContext({
        viewport: CONFIG.viewport,
        deviceScaleFactor: CONFIG.deviceScaleFactor,
        reducedMotion: 'reduce', // 减少过渡动画，截图更稳定
    });

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
    if (pages.length === 0) {
        console.error(`--only "${args.only}" 没有匹配到任何页面 (--list 查看全部)`);
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
    if (args.out) CONFIG.outputDir = args.out;
    if (args.mobile) {
        CONFIG.viewport = MOBILE_VIEWPORT.viewport;
        CONFIG.deviceScaleFactor = MOBILE_VIEWPORT.deviceScaleFactor;
        CONFIG.zoom = 1; // 手机视口保持真实设备尺寸，--zoom 可显式覆盖
    }
    if (args.zoom != null) CONFIG.zoom = args.zoom;
    if (CONFIG.zoom !== 1) {
        // 模拟浏览器缩放：90% 缩放 = 同一窗口能看到 1/0.9 倍的内容 → 等效于放大视口
        CONFIG.viewport = {
            width: Math.round(CONFIG.viewport.width / CONFIG.zoom),
            height: Math.round(CONFIG.viewport.height / CONFIG.zoom),
        };
    }
    console.log(`🖥️ 视口 ${CONFIG.viewport.width}x${CONFIG.viewport.height} @${CONFIG.deviceScaleFactor}x (缩放 ${Math.round(CONFIG.zoom * 100)}%)`);

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
    try {
        for (const lang of langs) {
            // 单语言 → 平铺在输出目录 (与旧版兼容)；both → 按语言分子目录
            const outDir = langs.length > 1 ? join(CONFIG.outputDir, lang) : CONFIG.outputDir;
            await runForLang(browser, lang, pages, outDir, results);
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

    mkdirSync(CONFIG.outputDir, { recursive: true });
    const reportPath = join(CONFIG.outputDir, '_report.json');
    writeFileSync(reportPath, JSON.stringify({
        generatedAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        viewport: CONFIG.viewport,
        zoom: CONFIG.zoom,
        fullPage: CONFIG.fullPage,
        langs,
        summary: { ok: ok.length, warn: warn.length, skip: skip.length, fail: fail.length, elapsedSeconds: Number(elapsed) },
        results,
    }, null, 2));
    console.log(`📄 报告: ${reportPath}\n`);

    if (fail.length > 0) process.exitCode = 1;
}

run().catch(err => { console.error(err); process.exitCode = 1; });
