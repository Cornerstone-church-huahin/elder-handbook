// หน้าแรก: แถบ 6 ปุ่ม · ท่องจำคัมภีร์ (หมวด → การ์ดหมวด → เลือกข้อจากพระคัมภีร์ → ติ๊กฟังวน) · สมุด 2/3 = ระบบเดียวกับเตรียมคำอธิษฐาน แต่เป็นสมุดว่างแยกที่เก็บ
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
const boxes = await p.locator('.greeting__btns .urgent-btn').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent.trim(), top: Math.round(r.top), h: Math.round(r.height) } }))
check(boxes.length === 6, '6 pills on home: ' + boxes.map((x) => x.t).join(' / '))
check(new Set(boxes.map((x) => x.top)).size === 2 && boxes.every((x) => x.h >= 28), '2 rows, still tappable')

// ---- ท่องจำคัมภีร์ ----
await p.click('text=ท่องจำคัมภีร์'); await p.waitForSelector('#nb-catsel')
check(await p.locator('.nb-add').count() === 0 && await p.locator('.nb-empty').count() === 0 && await p.locator('.nb-editor').count() === 0, 'no old "+ เพิ่ม" prayer form, no empty-state card')
const addCat = async (name) => { await p.fill('[aria-label="ชื่อหมวดใหม่"]', name); await p.getByRole('button', { name: '💾 บันทึกหมวด' }).click() }
await p.click('[aria-label="จัดการหมวด"]'); await addCat('ความเชื่อ'); await addCat('ความรัก')
check(await p.locator('.sm-cat').count() === 2, 'categories appear as cards immediately, no content needed')
check((await p.locator('.sm-cat').first().textContent()).includes('ยังไม่มีข้อ'), 'empty category card says no verses yet')
await p.click('[aria-label="จัดการหมวด"]')
await p.selectOption('#nb-catsel', 'ความรัก'); check(await p.locator('.sm-cat').count() === 1, 'select shows only the chosen category card')
await p.click('[aria-label="เปิดหมวด ความรัก"]'); await p.waitForSelector('#bp-book')
await p.fill('#bp-book', '1')
const hits = await p.locator('.bp__hits button').allTextContents()
check(hits.includes('1 เปโตร') && hits.includes('1 โครินธ์'), 'typing "1" suggests 1 เปโตร / 1 โครินธ์ … (' + hits.join(', ') + ')')
await p.click('.bp__hits >> text=1 เปโตร'); await p.waitForSelector('#bp-ch')
check(await p.locator('.bp__v').count() === 25, 'shows a number button for every verse of the chapter (1 เปโตร 1 = 25 verses)')
for (const v of [1, 2, 3]) await p.click(`[aria-label="ข้อ ${v}"]`)
await p.waitForFunction(() => document.querySelectorAll('.sm-verses li').length === 3)
check(await p.locator('.sm-verses li').count() === 3, 'tapping 1,2,3 shows the 3 verses in order from the Bible (TH1971)')
const v1 = await p.locator('.sm-verses li').first().textContent(); check(v1.length > 10, 'verse text loaded: ' + v1.slice(0, 40))
await p.click('text=💾 บันทึกข้อนี้'); await p.waitForTimeout(200)
check(await p.locator('.sm-item').count() === 1 && (await p.locator('.sm-item').first().textContent()).includes('1 เปโตร 1:1–3'), 'saved as a card: 1 เปโตร 1:1–3')
check(await p.locator('.sm-verses').count() === 0, 'picker cleared for the next verse')
await p.fill('#bp-book', 'ยอห์น'); await p.click('.bp__hits >> text=ยอห์น'); await p.selectOption('#bp-ch', '3'); await p.click('[aria-label="ข้อ 16"]'); await p.waitForFunction(() => document.querySelectorAll('.sm-verses li').length === 1)
await p.click('text=💾 บันทึกข้อนี้'); await p.waitForTimeout(200)
check(await p.locator('.sm-item').count() === 2, 'single verse (ยอห์น 3:16) added')
// เลือกเว้นข้อ 1,3,5
await p.fill('#bp-book', 'สดุดี'); await p.click('.bp__hits >> text=สดุดี'); await p.selectOption('#bp-ch', '23'); await p.waitForFunction(() => document.querySelectorAll('.bp__v').length === 6)
check(await p.locator('.bp__v').count() === 6, 'สดุดี 23 shows 6 number buttons')
for (const v of [1, 3, 5]) await p.click(`[aria-label="ข้อ ${v}"]`)
await p.waitForFunction(() => document.querySelectorAll('.sm-verses li').length === 3)
await p.click('text=💾 บันทึกข้อนี้'); await p.waitForTimeout(200)
const last = p.locator('.sm-item').nth(2)
check((await last.textContent()).includes('สดุดี 23:1,3,5') && (await last.locator('sup').allTextContents()).join(',') === '1,3,5', 'non-contiguous 1,3,5 saved as สดุดี 23:1,3,5 with verse numbers 1,3,5')
// ติ๊ก → ฟังที่เลือก → วนซ้ำ
await p.locator('.us-pick input').first().check()
check(/ฟังที่เลือก \(1\)/.test(await p.textContent('[aria-label="ฟังทั้งหมดต่อเนื่อง"]')), 'tick → "▶ ฟังที่เลือก (1)"')
await p.evaluate(() => (window.__said = []))
await p.click('[aria-label="ฟังทั้งหมดต่อเนื่อง"]'); await p.waitForTimeout(1200)
const said = await p.evaluate(() => window.__said)
check(said.some((t) => t.includes('เปโตร')) && !said.some((t) => t.includes('ยอห์น')), 'plays only the ticked verse (ref then text)')
check(said.filter((t) => t.includes('เปโตร')).length >= 2, 'loops by default (' + said.filter((t) => t.includes('เปโตร')).length + ' repeats)')
await p.click('[aria-label="หยุดเลย"]')
check(await p.locator('.us-settings .us-loop input').isChecked(), 'loop checkbox on by default; speed slider present: ' + await p.locator('.us-settings input[type=range]').count())
const store = await p.evaluate(() => ({ n1: JSON.parse(localStorage.getItem('khatha.notebook1.v1') || '[]'), n2: localStorage.getItem('khatha.notebook2.v1') }))
check(store.n1.length === 3 && store.n1.every((x) => x.category === 'ความรัก') && store.n2 === null, 'stored in notebook1 with category (notebook2 untouched)')
await p.reload(); await p.waitForSelector('#nb-catsel'); await p.click('[aria-label="เปิดหมวด ความรัก"]'); await p.waitForSelector('.sm-item')
check(await p.locator('.sm-item').count() === 3, 'kept after reload')
// ลบหมวด → ข้อไปอยู่ ไม่มีหมวด
await p.click('[aria-label="กลับไปหมวดทั้งหมด"]'); await p.click('[aria-label="จัดการหมวด"]'); await p.click('[aria-label="ลบหมวด ความรัก"]'); await p.click('.nb-catmgr__del .btn--danger'); await p.waitForTimeout(200)
check((await p.locator('.sm-cat').allTextContents()).some((t) => t.includes('ไม่มีหมวด') && t.includes('3 ข้อ')), 'delete category: verses kept under ไม่มีหมวด')

// ---- สมุด 2 ----
await p.goto(URL + '#/notebook/2'); await p.waitForSelector('.nb-bar')
check((await p.textContent('h1')).includes('สมุด 2') && await p.locator('.nb-card').count() === 0, 'สมุด 2 is separate and empty (same system as prayer notebook)')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? 'FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
