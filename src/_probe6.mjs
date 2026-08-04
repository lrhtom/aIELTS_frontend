import { chromium } from 'playwright';
const BASE='http://localhost:5173';
const b=await chromium.launch({headless:true});
const p=await (await b.newContext({viewport:{width:1600,height:1000}})).newPage();
await p.goto(BASE+'/login',{waitUntil:'domcontentloaded'});
await p.fill('#username','lrhtom'); await p.fill('#password','20040502lrh');
await p.click('button[type="submit"]');
await p.waitForURL(u=>!u.pathname.startsWith('/login'),{timeout:20000});
await p.goto(BASE+'/reading?bankId=140',{waitUntil:'domcontentloaded'});
await p.waitForLoadState('networkidle',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(3000);
await p.locator('.pbb-part').nth(1).click(); await p.waitForTimeout(1500);

const letters=await p.locator('.matching-grid thead .mg-letter-head').allInnerTexts();
console.log('表头字母:',JSON.stringify(letters));
const rowId=await p.locator('.matching-grid tbody tr').first().getAttribute('data-question-id');
console.log('首行 data-question-id:',rowId);
const aria=await p.locator('.mg-cell-label').first().getAttribute('aria-label');
console.log('首个格子 aria-label:',aria);

await p.locator('.mg-cell-label').first().click();
await p.waitForTimeout(1000);
console.log('点击后立刻 aria-pressed =',await p.locator('.mg-cell-label').first().getAttribute('aria-pressed'));

// Force a rebuild: switch away, then switch back
await p.locator('.pbb-part').nth(0).click(); await p.waitForTimeout(1200);
await p.locator('.pbb-part').nth(1).click(); await p.waitForTimeout(1500);
const after=await p.locator('.mg-cell-label').first().getAttribute('aria-pressed');
const cls=await p.locator('.matching-grid tbody tr').first().locator('td').first().getAttribute('class');
console.log('切走再切回后 aria-pressed =',after,' cell class =',cls);
console.log(after==='true' ? '→ 答案存对了键，只是当场没重渲染：渲染问题'
                           : '→ 切回来仍未选中：存的键和读的键不一致');
await b.close();
