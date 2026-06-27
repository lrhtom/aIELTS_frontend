/**
 * 前端自动截图工具 (带自动登录)
 * 
 * 运行前确保：
 * 1. 运行：npx playwright install chromium
 * 2. 启动前端和后端服务
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

// ============================================================
// 配置区
// ============================================================
const BASE_URL = 'http://localhost:5173';
const API_BASE = 'http://localhost:8000';

const PAGES = [
    // 顶层
    ['/', 'home'],
    ['/profile', 'profile'],
    ['/settings', 'settings'],
    ['/prompts', 'prompts'],
    ['/store', 'store'],
    ['/feedback', 'feedback'],
    ['/markdown-notes', 'markdown_notes'],

    // 练习
    ['/practice', 'practice_hub'],
    ['/practice/ai', 'practice_ai'],
    ['/practice/ai/bank', 'practice_ai_bank'],
    ['/practice/ai/others', 'practice_ai_others'],
    ['/practice/ai/reading', 'practice_reading_config'],
    ['/practice/ai/listening', 'practice_listening_config'],

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
    ['/writing/ai-teachers', 'writing_ai_teachers'],
    ['/writing/ai-teachers/records', 'writing_records'],

    // 词汇
    ['/vocabulary', 'vocabulary_hub'],
    ['/vocabulary/practice', 'vocabulary_training_config'],
    ['/vocabulary/custom-cards', 'vocabulary_custom_cards_create'],
    ['/vocabulary/notebook', 'vocabulary_notebook_list'],
    ['/vocabulary/books', 'vocabulary_books_list'],
    ['/vocabulary/plans', 'vocabulary_plans'],
    ['/vocabulary/plans/7', 'vocabulary_plan_detail'],
    ['/vocabulary/flashcard/doing', 'vocabulary_flashcard'],

    // 创意工坊
    ['/creative-workshop', 'creative_workshop'],
    ['/creative-workshop/favorites', 'creative_workshop_favorites'],

    // 在这里增加更多页面...
];

const CONFIG = {
    outputDir: './screenshots',               // 保存截图的目录
    viewport: { width: 1440, height: 900 },     // 窗口尺寸
    fullPage: false,                            // 是否截长图
    waitTime: 2000,                             // 页面加载后等待时长(ms)
    format: 'png',                              // 'png' 或 'jpeg'
    
    // 自动登录测试账号
    auth: {
        username: 'testuser',
        password: 'testpassword123'
    }
};

// ============================================================

async function promptLang() {
    const rl = createInterface({ input, output });
    const ans = (await rl.question('选择截图使用的网站语言 [1=中文 / 2=English] (默认 1): ')).trim();
    rl.close();
    if (ans === '2' || ans.toLowerCase() === 'en') return 'en';
    return 'zh';
}

async function run() {
    mkdirSync(CONFIG.outputDir, { recursive: true });

    const lang = await promptLang();
    console.log(`\n🌐 网站语言: ${lang === 'zh' ? '中文' : 'English'} (ielts_lang=${lang})`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: CONFIG.viewport,
        deviceScaleFactor: 2,
    });

    // 在所有页面脚本运行前注入语言到 localStorage，
    // 这样 LanguageContext 初始化时就能拿到对应的 ielts_lang，
    // 不依赖于"先登录再去 settings 切换语言"的脆弱流程。
    await context.addInitScript((langValue) => {
        try { localStorage.setItem('ielts_lang', langValue); } catch { /* noop */ }
    }, lang);

    // 1. 登录流程
    console.log(`\n🔑 正在使用测试账号 (${CONFIG.auth.username}) 登录...`);
    const page = await context.newPage();
    let loginOk = false;
    try {
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
        await page.fill('#username', CONFIG.auth.username);
        await page.fill('#password', CONFIG.auth.password);
        await page.click('button[type="submit"]');

        // 等待登录成功跳转到 profile 或者其他需要鉴权完毕的标志
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000); // 额外缓冲
        loginOk = true;
        console.log('  ✅ 登录成功！\n');
    } catch (e) {
        console.log(`  ❌ 登录失败: ${e.message}\n`);
    }

    // 1.5 把用户的服务端语言偏好也设为本次选定语言，
    // 否则 AuthContext 加载 profile 后会用 user.languagePreference 反向覆盖 LanguageContext，
    // 把 localStorage 设进去的 ielts_lang 顶掉。
    if (loginOk) {
        const cookies = await context.cookies();
        const csrf = cookies.find(c => c.name === 'aielts_csrf')?.value;
        if (!csrf) {
            console.log('  ⚠️ 未找到 aielts_csrf cookie，跳过服务端语言同步\n');
        } else {
            try {
                const res = await context.request.put(`${API_BASE}/api/auth/settings`, {
                    headers: {
                        'X-CSRF-Token': csrf,
                        'Content-Type': 'application/json',
                    },
                    data: { language_preference: lang },
                });
                if (res.ok()) {
                    console.log(`  ✅ 服务端 language_preference 已切到 ${lang}\n`);
                } else {
                    console.log(`  ⚠️ 服务端语言同步失败 (HTTP ${res.status()}): ${await res.text()}\n`);
                }
            } catch (e) {
                console.log(`  ⚠️ 服务端语言同步异常: ${e.message}\n`);
            }
        }
    }

    // 2. 遍历截图
    console.log(`📸 开始截图，共 ${PAGES.length} 个页面\n`);

    for (let i = 0; i < PAGES.length; i++) {
        const [path, name] = PAGES[i];
        const url = `${BASE_URL}${path}`;
        const filename = `${name}.${CONFIG.format}`;
        const filepath = join(CONFIG.outputDir, filename);

        try {
            console.log(`  [${i + 1}/${PAGES.length}] ${url}`);
            
            // 使用同一个 page 实例以保持登录态 (session)
            await page.goto(url, { waitUntil: 'networkidle' });
            
            if (CONFIG.waitTime > 0) {
                await page.waitForTimeout(CONFIG.waitTime);
            }

            await page.screenshot({
                path: filepath,
                fullPage: CONFIG.fullPage,
                type: CONFIG.format,
            });

            console.log(`    ✅ -> ${filepath}`);
        } catch (err) {
            console.log(`    ❌ 失败: ${err.message}`);
        }
    }

    await page.close();
    await browser.close();
    console.log(`\n🎉 截图完成！文件保存在 ${CONFIG.outputDir}/\n`);
}

run().catch(console.error);
