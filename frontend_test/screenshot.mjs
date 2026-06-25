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

// ============================================================
// 配置区
// ============================================================
const BASE_URL = 'http://localhost:5173';

const PAGES = [
    ['/', 'home'],
    ['/vocabulary/plans', 'vocabulary_plans'],
    ['/vocabulary/plans/7', 'vocabulary_plan_detail'],
    ['/vocabulary/flashcard/doing', 'flashcard'],
    ['/listening', 'listening'],
    ['/speaking', 'speaking'],
    ['/reading', 'reading'],
    ['/writing', 'writing'],
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

async function run() {
    mkdirSync(CONFIG.outputDir, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: CONFIG.viewport,
        deviceScaleFactor: 2,
    });

    // 1. 登录流程
    console.log(`\n🔑 正在使用测试账号 (${CONFIG.auth.username}) 登录...`);
    const page = await context.newPage();
    try {
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
        await page.fill('#username', CONFIG.auth.username);
        await page.fill('#password', CONFIG.auth.password);
        await page.click('button[type="submit"]');
        
        // 等待登录成功跳转到 profile 或者其他需要鉴权完毕的标志
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000); // 额外缓冲
        console.log('  ✅ 登录成功！\n');
    } catch (e) {
        console.log(`  ❌ 登录失败: ${e.message}\n`);
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
