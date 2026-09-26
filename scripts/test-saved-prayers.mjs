// คำอธิษฐานที่บันทึกไว้: แสดงในหน้าอธิษฐาน, ขึ้นเมื่อค้นหาเรื่องที่ตรง, เปิดอ่านเต็ม, และใช้ได้ออฟไลน์
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
await p.goto(URL + '#/prayer'); await p.waitForSelector('.saved-list')
check(await p.locator('.saved-list .result').count() === 5, 'all 5 saved prayers listed on prayer page')
for (const [q, want] of [['ถวายทรัพย์', 'ถวายทรัพย์'], ['อธิษฐานก่อนทานข้าว', 'พระกระยาหาร'], ['ตกงาน มีหนี้', 'การเงิน']]) {
  await p.goto(URL + '#/search?q=' + encodeURIComponent(q)); await p.waitForTimeout(400)
  const first = await p.locator('.result .result__title').first().textContent().catch(() => '')
  check(first.includes(want), `search "${q}" → first "${first}"`)
  await p.goto(URL + '#/prayer?q=' + encodeURIComponent(q)); await p.waitForSelector('.prayer-text')
  check((await p.locator('.saved-list').textContent()).includes(want), `prayer page "${q}" shows saved "${want}"`)
}
// ให้ service worker ติดตั้งก่อน แล้วตัดเน็ต
await p.goto(URL + '#/'); await p.evaluate(() => navigator.serviceWorker?.ready); await p.waitForTimeout(1500)
await p.reload(); await p.waitForTimeout(800)
await ctx.setOffline(true)
await p.goto(URL + '#/prayer/saved/offering-treasury'); await p.waitForSelector('.saved-text', { timeout: 8000 })
check((await p.textContent('.saved-text')).includes('ท้องพระคลัง'), 'saved prayer opens offline')
await p.goto(URL + '#/prayer?q=' + encodeURIComponent('สามีเพิ่งเสียชีวิต')); await p.waitForSelector('.prayer-text', { timeout: 8000 })
check((await p.textContent('.prayer-text')).includes('ข้าแต่พระบิดาเจ้า'), 'prayer generates offline (no AI)')
await p.click('.seg >> text=พระคำ'); await p.waitForTimeout(800)
check((await p.locator('.verse-card').first().textContent()).includes('เราเป็นเหตุให้คนทั้งปวงเป็นขึ้น'), 'verse text shows offline (core verses)')
await ctx.setOffline(false)
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
if (process.env.SHOT) { await p.goto(URL + '#/prayer/saved/meal-1'); await p.waitForSelector('.saved-text'); await p.screenshot({ path: process.env.SHOT, fullPage: true }) }
await b.close(); console.log(fail ? `${fail} FAILED` : 'ALL PASSED'); process.exit(fail ? 1 : 0)
