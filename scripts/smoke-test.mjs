// ทดสอบหน้าจอมือถือ: ไม่มี scroll แนวนอนทุกขนาดตัวอักษร + ค้นหา + นำทาง
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4173/'
const OUT = process.env.OUT || 'shots'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fail++ }
for (const w of [360, 390, 768]) for (const s of [100, 125, 150]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2 })
  await ctx.addInitScript((v) => localStorage.setItem('khatha.fontScale', String(v)), s)
  const p = await ctx.newPage()
  const errs = []; p.on('pageerror', e => errs.push(e.message))
  for (const route of ['#/', '#/search?q=สมาชิกกลัวการผ่าตัด', '#/settings', '#/kit/grief']) {
    await p.goto(URL + route); await p.waitForTimeout(300)
    const o = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    check(o <= 0, `w=${w} scale=${s} ${route} no horizontal scroll (${o})`)
    if (w === 390 && route !== '#/kit/grief') await p.screenshot({ path: `${OUT}/${s}-${route.replace(/[#/?=]/g, '_').slice(0,20)}.png`, fullPage: true })
  }
  check(errs.length === 0, `w=${w} scale=${s} no JS errors ${errs.join(';')}`)
  await ctx.close()
}
// ค้นหา
const p = await b.newPage({ viewport: { width: 390, height: 800 } })
const cases = { 'สมาชิกกลัวการผ่าตัด': 'ก่อนผ่าตัด', 'สามีเสียชีวิต': 'สูญเสีย', 'ทะเลาะกับลูก': 'ครอบครัว', 'เป็นหนี้และเครียด': 'การเงิน', 'รู้สึกว่าพระเจ้าทอดทิ้ง': 'หมดกำลังใจ' }
for (const [q, want] of Object.entries(cases)) {
  await p.goto(URL + '#/'); await p.fill('#home-search', q); await p.press('#home-search', 'Enter'); await p.waitForTimeout(200)
  const first = await p.locator('.result:has(.badge) .result__title').first().textContent().catch(() => '')
  check(first.includes(want), `search "${q}" → first result "${first}"`)
}
// ขนาดปุ่ม
await p.goto(URL + '#/')
const minH = await p.$$eval('.action, .bottomnav a, .search button', els => Math.min(...els.map(e => e.getBoundingClientRect().height)))
check(minH >= 44, `touch targets ≥44px (min ${minH})`)
// การ์ดนำไปหน้า Kit
check(await p.locator('.action').count() === 9 && await p.locator('.chip').count() === 0 && await p.locator('text=ยังไม่มีรายการติดตาม').count() === 0, 'home: 9 menu cards incl. follow-ups, no big sections')
await p.click('.action:has-text("เตรียมคำอธิษฐาน")'); await p.waitForTimeout(200)
check((await p.locator('h1').textContent()).includes("เตรียมคำอธิษฐาน"), "prayer menu card opens prayer page")
await b.close()
console.log(fail ? `${fail} FAILED` : 'ALL PASSED'); process.exit(fail ? 1 : 0)
