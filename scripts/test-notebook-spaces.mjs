// หน้าแรก: แถบ 6 ปุ่ม (3 เดิม + สมุด 1/2/3 อีกแถว) · สมุด 1/2/3 = ระบบเดียวกับเตรียมคำอธิษฐาน แต่เป็นสมุดว่างแยกที่เก็บ
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
await ctx.addInitScript(() => {
  window.__said = []
  window.SpeechSynthesisUtterance = function (t) { this.text = t }
  const synth = { speaking: false, pending: false, getVoices: () => [{ name: 'Google ไทย', lang: 'th-TH' }], speak: (u) => { window.__said.push(u.text); synth.speaking = true; setTimeout(() => { synth.speaking = false; u.onend && u.onend() }, 15) }, cancel: () => { synth.speaking = false } }
  Object.defineProperty(window, 'speechSynthesis', { value: synth })
})
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
await p.goto(URL + '#/'); await p.waitForSelector('.greeting__btns .urgent-btn')
const boxes = await p.locator('.greeting__btns .urgent-btn').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim(), top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width) } }))
check(boxes.length === 6, '6 pills on home: ' + boxes.map((x) => x.t).join(' / '))
const rows = new Set(boxes.map((x) => x.top)); check(rows.size === 2, '2 rows (' + [...rows].join(',') + ')')
check(boxes.every((x) => x.h >= 28), 'pills still tappable (heights ' + boxes.map((x) => x.h).join(',') + ')')
await p.click('text=ท่องจำคัมภีร์'); await p.waitForSelector('.nb-bar')
check((await p.textContent('h1')).includes('ท่องจำคัมภีร์'), 'opens ท่องจำคัมภีร์ (สมุด 1)')
check(await p.locator('.nb-card').count() === 0, 'starts empty (no built-in prayers)')
await p.click('.nb-add'); await p.fill('#nb-title', 'บทความทดสอบ'); await p.fill('#nb-cat', 'ท่องจำ'); await p.fill('#nb-ref1', 'ยอห์น 3:16'); await p.fill('#nb-text', 'ข้อความของสมุดหนึ่ง\n\nย่อหน้าสอง')
await p.click('text=💾 บันทึก'); await p.waitForTimeout(300)
check(await p.locator('.nb-card').count() === 1, 'saved as a card')
const store = await p.evaluate(() => ({ n1: JSON.parse(localStorage.getItem('khatha.notebook1.v1') || '[]').length, n2: localStorage.getItem('khatha.notebook2.v1'), main: localStorage.getItem('khatha.prayerbook.v2') }))
check(store.n1 === 1 && store.n2 === null, 'stored in its own key (notebook1=1, notebook2 untouched)')
check(!(store.main || '').includes('บทความทดสอบ'), 'not mixed into the main prayer notebook')
await p.reload(); await p.waitForSelector('.nb-card'); check(await p.locator('.nb-card').count() === 1, 'kept after reload')
await p.click('.nb-card'); await p.waitForSelector('.nb-card--open .nb-tabs')
check(await p.locator('.nb-card--open .nb-tabs button').count() === 4, 'same 4 tabs inside the card')
check(await p.locator('[aria-label="ฟังหน้านี้"]').count() === 1 && await p.locator('[aria-label^="ฟังต่อเนื่อง"]').count() === 1, 'top-bar listen buttons present')
await p.click('[aria-label="ฟังหน้านี้"]'); await p.waitForTimeout(500)
check((await p.evaluate(() => window.__said.length)) > 0, 'reads aloud')
await p.goto(URL + '#/notebook/2'); await p.waitForSelector('.nb-bar')
check((await p.textContent('h1')).includes('สมุด 2') && await p.locator('.nb-card').count() === 0, 'สมุด 2 is separate and empty')
check(await p.locator('.nb-restore').count() === 0, 'no "restore starter prayers" button in extra notebooks')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? 'FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
