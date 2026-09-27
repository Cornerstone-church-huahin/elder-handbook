// ปุ่มฟัง: อ่านเฉพาะแท็บที่เปิด · พระคำอ่านชื่อข้อแบบ "บทที่ ข้อ" · หยุดได้ · ปรับความเร็ว (จำลอง speechSynthesis)
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
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
const idle = () => p.waitForSelector('[aria-label="ฟังแท็บนี้"]', { timeout: 90000 })
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
await p.goto(URL + '#/people/adam'); await p.waitForSelector('.ai-sec')
check(await p.locator('.teach-tabs [role=tab]').count() === 5, '5 compact tabs')
check(await p.locator('.topbar .nb-fab').count() === 1, 'listen buttons in top bar')
await p.click('[aria-label="ฟังแท็บนี้"]'); await p.waitForTimeout(300); await idle()
let said = await p.evaluate(() => window.__said.map((x) => x.text).join(' '))
check(said.startsWith('เรื่องราวชีวิต') && !said.includes('คำถามชวนคิด'), 'this-tab reads only life story')
await p.evaluate(() => { window.__said = []; window.__slow = true })
await p.click('[aria-label="ฟังต่อเนื่องทุกแท็บ"]'); await p.waitForTimeout(1500)
await p.click('[aria-label="หยุดชั่วคราว"]'); const n1 = await p.evaluate(() => window.__said.length)
await p.waitForTimeout(500); check(await p.evaluate(() => window.__said.length) === n1, 'pause stops speech')
await p.click('[aria-label="ฟังต่อ"]'); await p.waitForTimeout(400)
const resumed = await p.evaluate(() => window.__said.at(-1).text)
check(!resumed.startsWith('เรื่องราวชีวิต'), 'resume continues (not restart): ' + resumed.slice(0, 20))
await p.evaluate(() => { window.__slow = false })
await idle()
said = await p.evaluate(() => window.__said.map((x) => x.text).join(' '))
const order = ['เรื่องราวชีวิต.', 'จุดเด่นและบทเรียน.', 'โครงบทเรียนสำหรับสอน.', 'ใช้ในการอภิบาล.', 'คำถามชวนคิด.'].map((h) => said.indexOf(h))
check(order.every((x, i) => x >= 0 && (i === 0 || x > order[i - 1])), 'continuous reads all 5 tabs in order ' + order)
check((await p.locator('.teach-tabs [aria-selected=true]').textContent()).includes('คำถาม'), 'tab followed the voice to the last tab')
// เริ่มจากแท็บกลาง → อ่านจากแท็บนั้นเป็นต้นไป
await p.click('.teach-btn:has-text("อภิบาล")'); await p.evaluate(() => { window.__said = [] })
await p.click('[aria-label="ฟังต่อเนื่องทุกแท็บ"]'); await p.waitForTimeout(300); await idle()
said = await p.evaluate(() => window.__said.map((x) => x.text).join(' '))
check(said.startsWith('ใช้ในการอภิบาล') && said.includes('คำถามชวนคิด') && !said.includes('เรื่องราวชีวิต.'), 'continuous starts from the chosen tab')
// ปุ่มฟังพระคำหยุดเสียงแท็บก่อน (อ่านทีละแหล่ง)
await p.click('[aria-label="ฟังแท็บนี้"]'); await p.waitForTimeout(200)
await p.click('.ref-read__toggle >> nth=0'); await p.waitForSelector('.ref-read__listen'); await p.click('.ref-read__listen'); await p.waitForTimeout(200)
check(await p.locator('[aria-label="ฟังแท็บนี้"]').count() === 1, 'starting verse audio stops tab audio')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
