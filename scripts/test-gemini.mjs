// ปุ่มเปิดแอป AI ที่สมัครไว้ (ไม่ใช้ API): Gemini · ChatGPT · Claude
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4173/index.html'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] })
await ctx.route(/gemini\.google\.com|chatgpt\.com|claude\.ai/, (r) => r.fulfill({ status: 200, body: 'ok' }))
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
const open = async (sel) => { const [pop] = await Promise.all([ctx.waitForEvent('page'), p.click(sel)]); const u = pop.url(); await pop.close(); return u }
await p.goto(URL); await p.waitForSelector('.ai-app')
check(await p.locator('.ai-app').count() === 3, 'home: 3 AI buttons')
check((await open('.ai-app--gemini')).startsWith('https://gemini.google.com/app'), 'Gemini opens')
check((await open('.ai-app--chatgpt')).startsWith('https://chatgpt.com/'), 'ChatGPT opens')
check((await open('.ai-app--claude')).startsWith('https://claude.ai/new'), 'Claude opens')
await p.goto(URL + '#/search?q=' + encodeURIComponent('พ่อตาโมเสส')); await p.waitForSelector('.ai-app')
check((await open('.ai-app--chatgpt')).includes('?q=' + encodeURIComponent('พ่อตาโมเสส')), 'ChatGPT gets the question prefilled')
check((await open('.ai-app--claude')).includes('?q=' + encodeURIComponent('พ่อตาโมเสส')), 'Claude gets the question prefilled')
await open('.ai-app--gemini')
check((await p.evaluate(() => navigator.clipboard.readText())) === 'พ่อตาโมเสส', 'Gemini: question copied to paste')
check((await p.textContent('.ai-apps .source-note')).includes('วาง'), 'tells user to paste in Gemini')
await p.goto(URL); await p.waitForSelector('.ai-apps'); await p.locator('.ai-apps').scrollIntoViewIfNeeded(); await p.screenshot({ path: '/tmp/claude-0/shots/aiapps.png' })
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
