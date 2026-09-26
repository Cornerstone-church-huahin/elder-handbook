// ทดสอบ preview.html ในกรอบ srcdoc แบบ sandbox (เหมือนแผงพรีวิว) — ต้องไม่มี error
import { chromium } from 'playwright'
import fs from 'fs'
const html = fs.readFileSync('preview.html', 'utf8')
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 420, height: 900 } })
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()))
await p.setContent('<iframe id=f sandbox="allow-scripts" style="width:400px;height:880px;border:0"></iframe>')
await p.$eval('#f', (el, h) => { el.srcdoc = h }, html)
await p.waitForTimeout(1500)
const f = p.frames()[1]
const t = async (sel) => (await f.locator(sel).first().textContent().catch(() => '')) || ''
console.log('h1:', await t('h1'))
await f.click('text=สามีเสียชีวิต'); await p.waitForTimeout(300); console.log('search →', await t('.result__title'))
await f.click('.result'); await p.waitForTimeout(300); console.log('kit →', await t('h1'))
await f.click('text=ย้อนกลับ'); await p.waitForTimeout(300); console.log('back →', await t('h1'))
await f.click('[aria-label="ตั้งค่า"]'); await p.waitForTimeout(300)
await f.click('#scale-150'); await p.waitForTimeout(300)
console.log('font-size:', await f.evaluate(() => getComputedStyle(document.documentElement).fontSize))
await f.click('text=สมาชิก >> nth=0'); await p.waitForTimeout(300); console.log('tab →', await t('h1'))
await p.screenshot({ path: process.env.SHOT || 'preview-test.png' })
console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'NO ERRORS')
await b.close()
