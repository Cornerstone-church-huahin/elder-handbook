// ท่องจำคัมภีร์ โครงหน้าใหม่: ฟอร์มบันทึกเป็นการ์ดคลายออกได้ · การ์ดที่บันทึกแล้วย่อ/ขยายได้ (ค่าตั้งต้น = ย่อ) · ติ๊กเลือกหลายการ์ดฟังต่อเนื่อง · ▶ การ์ดเดียวฟังทั้งการ์ดวนซ้ำ · โหมดฟัง 2 แบบ
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
await ctx.addInitScript(() => {
  window.__said = []
  window.SpeechSynthesisUtterance = function (t) { this.text = t }
  const synth = { speaking: false, pending: false, getVoices: () => [{ name: 'Google ไทย', lang: 'th-TH' }], speak: (u) => { window.__said.push(u.text); synth.speaking = true; setTimeout(() => { synth.speaking = false; u.onend && u.onend() }, 30) }, cancel: () => { synth.speaking = false } }
  Object.defineProperty(window, 'speechSynthesis', { value: synth })
})
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
await p.goto(URL + '#/notebook/1'); await p.waitForSelector('#nb-catsel')
await p.click('[aria-label="จัดการหมวด"]'); await p.fill('[aria-label="ชื่อหมวดใหม่"]', 'ทดสอบ'); await p.getByRole('button', { name: '💾 บันทึกหมวด' }).click(); await p.click('[aria-label="จัดการหมวด"]')
await p.click('[aria-label="เปิดหมวด ทดสอบ"]')
check(await p.locator('#sm-add-toggle').getAttribute('aria-expanded') === 'true', 'empty category: the add form starts expanded')
const add = async (label, text, meaning) => { await p.click('#sm-custom-toggle'); await p.fill('#sm-custom-label', label); await p.fill('#sm-custom-text', text); if (meaning) await p.fill('#spc-text', meaning); await p.click('#sm-custom-save'); await p.waitForTimeout(250) }
await add('การ์ดเอ', 'แอลฟาเนื้อข้อ', 'แอลฟาความหมาย'); await add('การ์ดบี', 'บีตาเนื้อข้อ', ''); await add('การ์ดซี', 'ซีตาเนื้อข้อ', 'ซีตาความหมาย')
check(await p.locator('.sm-item').count() === 3, 'three cards saved')
// ค่าตั้งต้น: การ์ดย่อ · ฟอร์มย่อเมื่อมีข้อแล้ว (หลังเปิดหมวดใหม่)
await p.reload(); await p.waitForSelector('#nb-catsel'); await p.click('[aria-label="เปิดหมวด ทดสอบ"]'); await p.waitForSelector('.sm-item')
check(await p.locator('#sm-add-toggle').getAttribute('aria-expanded') === 'false' && await p.locator('#bp-book').count() === 0, 'category with cards: the add form is a small collapsed card')
const A = p.locator('.sm-item').nth(0), B = p.locator('.sm-item').nth(1), C = p.locator('.sm-item').nth(2)
check(await A.locator('.sm-item__prev').count() === 1 && await A.locator('button[aria-label^="ตีความ"]').count() === 0, 'saved cards start collapsed (title + one-line preview, no action buttons)')
check(await A.locator('input[type=checkbox]').count() === 1 && await A.locator('[aria-label^="ฟัง "]').count() === 1, 'collapsed card still has its tick box and ▶')
// ขยาย/ย่อทีละการ์ด และทั้งหมด
await A.locator('[aria-label^="ขยาย การ์ดเอ"]').click(); check(await A.locator('button[aria-label^="ตีความ"]').count() === 1 && (await A.textContent('.sm-spirit')).includes('แอลฟาความหมาย'), 'tapping the title expands: verse, 🕊️ meaning and action buttons appear')
await A.locator('[aria-label^="ย่อ การ์ดเอ"]').click(); check(await A.locator('.sm-item__prev').count() === 1, 'tapping again collapses it')
await p.click('#sm-expand-all'); check(await p.locator('.sm-item__prev').count() === 0, 'expand all'); await p.click('#sm-collapse-all'); check(await p.locator('.sm-item__prev').count() === 3, 'collapse all')
await p.click('#sm-add-toggle'); check(await p.locator('#sm-custom-toggle').count() === 1, 'the add card expands on demand'); await p.click('#sm-add-toggle')
// โหมดฟัง
check(await p.locator('#sm-mode-both').isChecked(), 'default listening mode = verse + spiritual meaning')
const said = () => p.evaluate(() => window.__said.join(' | ')); const reset = async () => { await p.evaluate(() => { window.__said = [] }) }
const stop = async () => { for (let i = 0; i < 25; i++) { await p.evaluate(() => document.querySelector('.nb-fab [aria-label="หยุดเลย"]')?.click()); await p.waitForTimeout(90); if (await p.locator('.nb-fab [aria-label="ฟังทั้งหมดต่อเนื่อง"]').count()) { await p.waitForTimeout(150); if (await p.locator('.nb-fab [aria-label="ฟังทั้งหมดต่อเนื่อง"]').count()) return } } }
// ▶ การ์ดเอ (ไม่ติ๊กใคร) → ทั้งการ์ดนั้นวนซ้ำ: ข้อ → ความหมาย → ข้อ...
await reset(); await A.locator('[aria-label^="ฟัง "]').click()
await p.waitForFunction(() => (window.__said.join('|').match(/แอลฟาเนื้อข้อ/g) || []).length >= 2, null, { timeout: 8000 })
let t = await said()
check(t.includes('แอลฟาความหมาย') && !t.includes('บีตา') && !t.includes('ซีตา'), 'one card ▶ plays only that card (verse + meaning)')
check(t.indexOf('แอลฟาเนื้อข้อ') < t.indexOf('แอลฟาความหมาย') && t.indexOf('แอลฟาความหมาย') < t.lastIndexOf('แอลฟาเนื้อข้อ'), 'order: verse → meaning → loops back to the verse')
await stop()
// โหมดเฉพาะข้อพระคัมภีร์
await p.click('#sm-mode-verse'); await reset(); await A.locator('[aria-label^="ฟัง "]').click()
await p.waitForFunction(() => (window.__said.join('|').match(/แอลฟาเนื้อข้อ/g) || []).length >= 2, null, { timeout: 8000 }); t = await said()
check(!t.includes('แอลฟาความหมาย'), 'verse-only mode skips the spiritual meaning'); await stop()
// ติ๊ก A และ C → ฟังที่เลือก (2) → A ข้อ+ความหมาย, C ข้อ+ความหมาย, (B ไม่เล่น) แล้ววน
await p.click('#sm-mode-both')
await A.locator('input[type=checkbox]').check(); await C.locator('input[type=checkbox]').check()
await reset(); await p.locator('.nb-fab__btn', { hasText: 'ฟังที่เลือก (2)' }).click()
await p.waitForFunction(() => (window.__said.join('|').match(/แอลฟาเนื้อข้อ/g) || []).length >= 2, null, { timeout: 10000 }); t = await said()
const iA = t.indexOf('แอลฟาเนื้อข้อ'), iAm = t.indexOf('แอลฟาความหมาย'), iC = t.indexOf('ซีตาเนื้อข้อ'), iCm = t.indexOf('ซีตาความหมาย')
check(iA < iAm && iAm < iC && iC < iCm && !t.includes('บีตา'), 'ticked cards A and C play in order (A verse, A meaning, C verse, C meaning), B is skipped, then it loops')
await stop()
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await p.click('#sm-expand-all'); await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: '/tmp/claude-0/cards.png' })
await p.click('#sm-collapse-all'); await p.screenshot({ path: '/tmp/claude-0/cards2.png' })
await b.close(); console.log(fail ? 'FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
