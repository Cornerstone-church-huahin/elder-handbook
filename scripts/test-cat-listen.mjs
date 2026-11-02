// ท่องจำคัมภีร์ ระดับหมวด: ติ๊กเลือกหมวด 1/หลายหมวด/ทั้งหมด · ▶ ต่อหมวด · โหมดฟัง (เฉพาะข้อ / ข้อ+ความหมาย) · เรียงตามลำดับที่ติ๊ก · วนซ้ำ
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
await p.click('[aria-label="จัดการหมวด"]')
for (const n of ['หมวดเอ', 'หมวดบี', 'หมวดซี', 'หมวดดี']) { await p.fill('[aria-label="ชื่อหมวดใหม่"]', n); await p.getByRole('button', { name: '💾 บันทึกหมวด' }).click() }
await p.click('[aria-label="จัดการหมวด"]')
const add = async (cat, label, text, meaning) => {
  await p.click(`[aria-label="เปิดหมวด ${cat}"]`); await p.waitForSelector('#sm-add-toggle')
  if ((await p.locator('#sm-add-toggle').getAttribute('aria-expanded')) === 'false') await p.click('#sm-add-toggle')
  await p.click('#sm-custom-toggle'); await p.fill('#sm-custom-label', label); await p.fill('#sm-custom-text', text); if (meaning) await p.fill('#spc-text', meaning)
  await p.click('#sm-custom-save'); await p.waitForTimeout(250); await p.click('[aria-label="กลับไปหมวดทั้งหมด"]'); await p.waitForSelector('#sm-cats-play, .sm-cats')
}
await add('หมวดเอ', 'เอ1', 'เอเนื้อ', 'เอความหมาย'); await add('หมวดบี', 'บี1', 'บีเนื้อ', ''); await add('หมวดซี', 'ซี1', 'ซีเนื้อ', 'ซีความหมาย')
const row = (n) => p.locator('.sm-cat-row', { hasText: n })
check(await row('หมวดเอ').locator('input[type=checkbox]').count() === 1 && await row('หมวดเอ').locator('[aria-label^="ฟังหมวด"]').count() === 1, 'category card with verses has a tick box and ▶')
check(await row('หมวดดี').locator('input[type=checkbox]').count() === 0 && await row('หมวดดี').locator('[aria-label^="ฟังหมวด"]').count() === 0, 'empty category has no tick box / ▶')
check(await p.locator('#sm-mode-both').isChecked() && await p.locator('#sm-cats-play').textContent().then((t) => t.includes('ฟังทุกหมวด')), 'default: mode both, button says “ฟังทุกหมวด”')
const said = () => p.evaluate(() => window.__said.join(' | ')); const reset = () => p.evaluate(() => { window.__said = [] })
const stop = async () => { for (let i = 0; i < 25; i++) { await p.evaluate(() => document.querySelector('[aria-label="หยุดเลย"]')?.click()); await p.waitForTimeout(90); if (await p.locator('#sm-cats-play').count()) { await p.waitForTimeout(150); if (await p.locator('#sm-cats-play').count()) return } } }
const waitLoop = (w) => p.waitForFunction((x) => (window.__said.join('|').match(new RegExp(x, 'g')) || []).length >= 2, w, { timeout: 10000 })
// 1) ▶ หมวดเอ (ข้อ + ความหมาย) วนซ้ำ
await reset(); await row('หมวดเอ').locator('[aria-label^="ฟังหมวด"]').click(); await waitLoop('เอเนื้อ'); let t = await said()
check(t.includes('เอความหมาย') && !t.includes('บี') && !t.includes('ซี'), '▶ on one category plays only that category (verse + meaning), looping'); await stop()
// 2) โหมดเฉพาะข้อ
await p.click('#sm-mode-verse'); await reset(); await row('หมวดเอ').locator('[aria-label^="ฟังหมวด"]').click(); await waitLoop('เอเนื้อ'); t = await said()
check(!t.includes('เอความหมาย'), 'verse-only mode: no spiritual meaning'); await stop(); await p.click('#sm-mode-both')
// 3) ติ๊ก ซี แล้ว เอ → เรียงตามที่ติ๊ก (ซี ก่อน เอ) ข้าม บี
await row('หมวดซี').locator('input[type=checkbox]').check(); await row('หมวดเอ').locator('input[type=checkbox]').check()
check((await p.locator('#sm-cats-play').textContent()).includes('(2)'), 'button shows the count of ticked categories (2)')
await reset(); await p.click('#sm-cats-play'); await waitLoop('ซีเนื้อ'); t = await said()
const iC = t.indexOf('ซีเนื้อ'), iCm = t.indexOf('ซีความหมาย'), iA = t.indexOf('เอเนื้อ'), iAm = t.indexOf('เอความหมาย')
check(iC >= 0 && iC < iCm && iCm < iA && iA < iAm && !t.includes('บี'), 'plays in the order ticked: ซี (verse, meaning) then เอ (verse, meaning); บี skipped; loops')
// ⏭ ข้ามไปหมวดถัดไปในคิว
await p.evaluate(() => { window.__said = [] }); await p.click('[aria-label="หมวดถัดไป"]').catch(() => {}); await p.waitForTimeout(400); t = await said()
check(!t.includes('ซีเนื้อ') || t.indexOf('เอเนื้อ') >= 0, '⏭ jumps within the ticked queue'); await stop()
// 4) ไม่ติ๊ก = ทุกหมวดเรียงตามรายการ
await p.locator('input[aria-label="เลือกฟัง: หมวด หมวดซี"], .sm-cat-row input[type=checkbox]').evaluateAll((els) => els.forEach((e) => e.checked && e.click()))
await p.waitForTimeout(150); check((await p.locator('#sm-cats-play').textContent()).includes('ฟังทุกหมวด'), 'unticking all → “ฟังทุกหมวด”')
await reset(); await p.click('#sm-cats-play'); await waitLoop('เอเนื้อ'); t = await said()
const shown = await p.locator('.sm-cat-row b').allTextContents(); const pos = (n) => shown.indexOf(n)
const byRow = [['หมวดซี', 'ซีเนื้อ'], ['หมวดบี', 'บีเนื้อ'], ['หมวดเอ', 'เอเนื้อ']].sort((x, y) => pos(x[0]) - pos(y[0]))
check(t.indexOf(byRow[0][1]) < t.indexOf(byRow[1][1]) && t.indexOf(byRow[1][1]) < t.indexOf(byRow[2][1]) && !t.includes('บีความหมาย'), 'all categories play in the order shown on screen (บี has no meaning)')
// 5) เปิดหมวดขณะเล่น → หยุด
await row('หมวดบี').locator('.sm-cat').click(); await p.waitForSelector('#sm-add-toggle'); await p.waitForTimeout(300)
const n1 = await p.evaluate(() => window.__said.length); await p.waitForTimeout(500); const n2 = await p.evaluate(() => window.__said.length)
check(n1 === n2, 'opening a category stops the category-level playback')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await p.click('[aria-label="กลับไปหมวดทั้งหมด"]'); await p.waitForSelector('.sm-cats'); await row('หมวดซี').locator('input[type=checkbox]').check(); await p.screenshot({ path: '/tmp/claude-0/catlisten.png' })
await b.close(); console.log(fail ? 'FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
