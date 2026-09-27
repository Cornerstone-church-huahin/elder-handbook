// ปุ่มฟัง: อ่านเฉพาะแท็บที่เปิด · พระคำอ่านชื่อข้อแบบ "บทที่ ข้อ" · หยุดได้ · ปรับความเร็ว (จำลอง speechSynthesis)
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] })
await ctx.addInitScript(() => {
  // จำลองเสียงอ่านแบบมือถือ Android: บางวลีไม่แจ้งว่าอ่านจบ, cancel ส่ง error "interrupted", มีสัญญาณตำแหน่งคำ
  window.__said = []; let n = 0; let cur = null
  const voices = [{ name: 'Google ไทย', lang: 'th-TH' }]
  window.SpeechSynthesisUtterance = function (t) { this.text = t }
  const synth = {
    speaking: false, pending: false,
    getVoices: () => voices,
    speak: (u) => {
      window.__said.push({ text: u.text, rate: u.rate, lang: u.lang })
      const k = ++n; const words = [...u.text.matchAll(/\S+/g)]; const step = window.__slow ? 120 : 8
      cur = { u, timers: [] }; synth.speaking = true
      words.forEach((m, i) => cur.timers.push(setTimeout(() => u.onboundary && u.onboundary({ charIndex: m.index }), i * step)))
      const me = cur
      cur.timers.push(setTimeout(() => { synth.speaking = false; if (k % 4 !== 0) u.onend && u.onend() /* ทุกวลีที่ 4 ไม่แจ้งอ่านจบ */ ; if (cur === me) cur = null }, words.length * step + 20))
    },
    cancel: () => { if (cur) { cur.timers.forEach(clearTimeout); const u = cur.u; cur = null; setTimeout(() => u.onerror && u.onerror({ error: 'interrupted' }), 5) } synth.speaking = false },
  }
  Object.defineProperty(window, 'speechSynthesis', { value: synth })
})
const idle = () => p.waitForSelector('[aria-label="ฟังบทนี้"]', { timeout: 90000 })
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
await p.goto(URL); await p.waitForTimeout(600)
check(await p.locator('.action:has-text("เตรียมพระคำ")').count() === 0, 'old name removed')
await p.click('.action:has-text("พระคัมภีร์") >> nth=0'); await p.waitForSelector('.bible-book')
check(await p.locator('.bible-book').count() === 39, 'Old Testament: 39 books')
check((await p.locator('.bible-book__name').first().textContent()) === 'ปฐมกาล', 'starts with Genesis')
await p.click('.bible-tabs >> text=พันธสัญญาใหม่')
check(await p.locator('.bible-book').count() === 27 && (await p.locator('.bible-book__name').last().textContent()) === 'วิวรณ์', 'New Testament: 27 books ending Revelation')
await p.click('.bible-book:has-text("ยอห์น") >> nth=0'); await p.waitForSelector('.bible-ch')
check(await p.locator('.bible-ch').count() === 21, 'John has 21 chapter buttons')
await p.click('.bible-ch >> text=3'); await p.waitForSelector('.bible-v')
check(await p.locator('.bible-v').count() === 36, 'chapter → verse picker (John 3 has 36 verses)')
await p.click('.bible-v >> text=16'); await p.waitForSelector('.bv--sel')
check((await p.locator('#v16').textContent()).includes('พระเจ้าทรงรักโลก') && (await p.textContent('.bv--sel')).startsWith('16'), 'verse 16 opens, selected')
check((await p.textContent('[aria-label="ฟังบทนี้"]')).includes('ข้อ 16'), 'listen button starts from verse 16')
await p.evaluate(() => (window.__said = []))
await p.click('[aria-label="ฟังต่อเนื่องจนจบเล่ม"]'); await p.waitForTimeout(400)
await p.click('[aria-label="หยุดชั่วคราว"]')
let first = await p.evaluate(() => window.__said.map((x) => x.text).join(' '))
check(first.startsWith('ยอห์น บทที่ 3 ข้อ 16') && first.includes('พระเจ้าทรงรักโลก') && !first.includes('นิโคเดมัส'), 'plays from verse 16 onward')
await p.click('[aria-label="เริ่มใหม่"]')
// ชื่อบทด้านบน → ตารางข้อของบทนี้
await p.click('.bible-head__title'); await p.waitForSelector('.bible-v'); check(await p.locator('.bible-v').count() === 36, 'title opens verse picker'); await p.goBack(); await p.waitForSelector('.bv')
// เลือกข้อ คัดลอก
await p.click('[aria-label="ยกเลิกการเลือก"]')
await p.click('#v16'); await p.click('#v17'); await p.waitForSelector('.bible-selbar')
check((await p.textContent('.bible-selbar__ref')) === 'ยอห์น 3:16–17', 'selection label 3:16–17')
await p.click('[aria-label="คัดลอก"]'); await p.waitForTimeout(200)
const clip = await p.evaluate(() => navigator.clipboard.readText())
check(clip.startsWith('ยอห์น 3:16–17\n16 ') && clip.includes('\n17 ') && clip.includes('ฉบับ 1971'), 'copy includes reference + verses')
// ฟังข้อที่เลือก
await p.evaluate(() => (window.__said = []))
await p.click('[aria-label="ฟังข้อที่เลือก"]'); await p.waitForTimeout(300); await idle()
let said = await p.evaluate(() => window.__said.map((x) => x.text).join(' '))
check(said.includes('พระเจ้าทรงรักโลก') && !said.includes('นิโคเดมัส'), 'listen selected verses only')
await p.click('[aria-label="ยกเลิกการเลือก"]')
// ฟังบทนี้
await p.evaluate(() => (window.__said = []))
await p.click('[aria-label="ฟังบทนี้"]'); await p.waitForTimeout(300); await idle()
said = await p.evaluate(() => window.__said.map((x) => x.text).join(' '))
check(said.startsWith('ยอห์น บทที่ 3') && !said.includes('ยอห์น บทที่ 4'), 'listen this chapter only')
// ต่อเนื่อง ข้ามบท (เริ่มบท 20)
await p.goto(URL + '#/bible/43/20'); await p.waitForSelector('.bv'); await p.evaluate(() => (window.__said = []))
await p.click('[aria-label="ฟังต่อเนื่องจนจบเล่ม"]'); await p.waitForTimeout(300); await idle()
said = await p.evaluate(() => window.__said.map((x) => x.text).join(' '))
check(said.includes('ยอห์น บทที่ 20') && said.includes('ยอห์น บทที่ 21'), 'continuous reads on into next chapter')
check((await p.textContent('.bible-head__title')).includes('ยอห์น 21'), 'page followed the voice to chapter 21')
// หยุด/ฟังต่อ
await p.goto(URL + '#/bible/43/1'); await p.waitForSelector('.bv'); await p.evaluate(() => { window.__said = []; window.__slow = true })
await p.click('[aria-label="ฟังบทนี้"]'); await p.waitForTimeout(1500); await p.click('[aria-label="หยุดชั่วคราว"]')
check(await p.locator('.bv--now').count() === 1, 'current verse highlighted')
await p.click('[aria-label="ฟังต่อ"]'); await p.waitForTimeout(300)
check(!(await p.evaluate(() => window.__said.at(-1).text)).startsWith('ยอห์น บทที่ 1'), 'resume continues, not restart')
await p.click('[aria-label="หยุดชั่วคราว"]'); await p.evaluate(() => { window.__slow = false })
// ฟังทั้งเล่มจากหน้าเล่ม (โอบาดีห์ 1 บท)
await p.goto(URL + '#/bible/31'); await p.waitForSelector('.bible-listen-book'); await p.evaluate(() => (window.__said = []))
await p.click('.bible-listen-book'); await p.waitForSelector('.bv'); await p.waitForTimeout(400); await idle()
said = await p.evaluate(() => window.__said.map((x) => x.text).join(' '))
check(said.startsWith('โอบาดีห์ บทที่ 1') && said.length > 1000, 'listen whole book from book page')
// ค้นหาไปที่ข้อ
await p.goto(URL + '#/bible'); await p.waitForSelector('#bible-q')
check((await p.textContent('.bible-last')).includes('โอบาดีห์ 1'), 'continue-reading shortcut')
await p.fill('#bible-q', 'สดุดี 23:1'); await p.press('#bible-q', 'Enter'); await p.waitForSelector('.bv--sel')
check((await p.textContent('.bible-head__title')).includes('สดุดี 23') && (await p.textContent('.bv--sel')).includes('เลี้ยงดู'), 'jump to Psalm 23:1')
await p.goto(URL + '#/bible'); await p.fill('#bible-q', 'ยูดา 3'); await p.press('#bible-q', 'Enter'); await p.waitForSelector('.bv--sel')
check((await p.textContent('.bible-head__title')).includes('ยูดา 1') && (await p.textContent('.bv--sel')).startsWith('3'), 'single-chapter book: Jude 3 → 1:3')
await p.goto(URL + '#/bible/43/3'); await p.waitForSelector('.bv'); await p.screenshot({ path: '/tmp/claude-0/shots/bible-ch.png' })
await p.click('#v16'); await p.screenshot({ path: '/tmp/claude-0/shots/bible-sel.png' })
await p.goto(URL + '#/bible'); await p.waitForSelector('.bible-book'); await p.screenshot({ path: '/tmp/claude-0/shots/bible-home.png' })
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
