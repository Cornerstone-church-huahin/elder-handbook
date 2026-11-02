// ท่องจำคัมภีร์: ไอคอน 🔤 แก้คำอ่านบนการ์ด → เลือกคำจากข้อความทั้งก้อน → ใส่คำอ่าน → เสียงอ่านเปลี่ยนทันที และใช้กับการ์ดอื่นที่มีคำเดียวกัน (ทั้งแอป)
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
await p.goto(URL + '#/notebook/1'); await p.waitForSelector('#nb-catsel')
await p.click('[aria-label="จัดการหมวด"]'); await p.fill('[aria-label="ชื่อหมวดใหม่"]', 'ทดสอบ'); await p.getByRole('button', { name: '💾 บันทึกหมวด' }).click(); await p.click('[aria-label="จัดการหมวด"]')
await p.click('[aria-label="เปิดหมวด ทดสอบ"]'); await p.waitForSelector('#bp-book')
const addVerse = async (book, ch, vs) => { await p.fill('#bp-book', book); await p.click(`.bp__hits >> text=${book}`); await p.selectOption('#bp-ch', String(ch)); for (const v of vs) await p.click(`[aria-label="ข้อ ${v}"]`); await p.waitForFunction((n) => document.querySelectorAll('.sm-verses li').length === n, vs.length); await p.click('text=💾 บันทึกข้อนี้'); await p.waitForTimeout(250) }
await addVerse('1 เปโตร', 1, [1, 2]); await addVerse('ยูดา', 1, [1])
const cards = p.locator('.sm-item')
check(await cards.count() === 2, 'two verse cards created')
const btn = cards.first().locator('[aria-label^="แก้คำอ่าน"]')
const bb = await btn.boundingBox(), cb = await cards.first().boundingBox()
check(!!bb && bb.x > cb.x + cb.width * 0.7, '🔤 pronunciation icon sits in the right-hand column of the card')
const bodyText = await cards.first().locator('.sm-item__body p').textContent()
await btn.click(); await p.waitForSelector('.pron-sheet')
const ws = await p.locator('.pron-pick .pron-w').allTextContents()
check(ws.length > 15 && ws.join('').replace(/\s/g, '').includes(bodyText.replace(/[0-9\s]/g, '').slice(-12)), `the whole card text is tappable word by word (${ws.length} words, incl. the last words)`)
check(ws.join('').replace(/\s/g, '').startsWith('1เปโตรบทที่1ข้อ1ถึง2'), 'the spoken reference ("1 เปโตร บทที่ 1 ข้อ 1 ถึง 2") is included too: ' + ws.join('').slice(0, 30))
// เลือกคำท้ายข้อความ แล้วใส่คำอ่านใหม่
const target = ws.find((w) => w.includes('เยซู')) ?? ws[ws.length - 3]
await p.locator('.pron-pick .pron-w', { hasText: target }).first().click()
check((await p.textContent('#pron-edit-word')).includes(target), 'tapping a word selects it: ' + target)
await p.fill('#pron-edit-say', 'อ่านใหม่ทดสอบ'); await p.getByRole('button', { name: /^💾 บันทึก$/ }).click(); await p.waitForSelector('.pron-sheet', { state: 'detached', timeout: 5000 })
const store = await p.evaluate(() => JSON.parse(localStorage.getItem('khatha.pronounce.v1') || '[]'))
check(store.some((x) => x.word === target && x.say === 'อ่านใหม่ทดสอบ'), 'correction saved to the shared pronunciation list: ' + target + ' → อ่านใหม่ทดสอบ')
// เล่นการ์ด → เสียงใช้คำอ่านใหม่
await p.evaluate(() => (window.__said = []))
await cards.first().locator('[aria-label^="ฟัง "]').click(); await p.waitForTimeout(900)
const said = await p.evaluate(() => window.__said.join(' | '))
check(said.includes('อ่านใหม่ทดสอบ') && !said.includes(target), 'playing the card now says the corrected reading')
await p.click('[aria-label="หยุดเลย"]').catch(() => {})
// เปิดซ้ำ: คำที่แก้แล้วมีขีดเส้นใต้
await btn.click(); await p.waitForSelector('.pron-sheet')
check(await p.locator('.pron-w.is-fixed', { hasText: target }).count() >= 1, 'words that already have a correction are underlined in gold')
await p.getByRole('button', { name: 'ปิด' }).click()
// ทั้งแอป: หน้าพระคัมภีร์ (ยอห์น 3) อ่านคำเดียวกันด้วยคำอ่านที่แก้ไว้
await p.goto(URL + '#/bible/43/3'); await p.waitForSelector('.bv'); await p.evaluate(() => (window.__said = []))
await p.click('[aria-label="ฟังบทนี้"]'); await p.waitForTimeout(1500)
const said2 = await p.evaluate(() => window.__said.join(' | '))
check(said2.includes('อ่านใหม่ทดสอบ'), 'the Bible page reads the same word with the corrected reading too (app-wide)')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? 'FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
