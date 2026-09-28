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
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
await p.goto(URL + '#/prayer'); await p.waitForSelector('.nb-card')
await p.click('.nb-add'); await p.fill('#nb-title', 'ทดสอบเรื่องราว'); await p.fill('#nb-story', '[เรื่องราว: องค์พระเยซูคริสต์กับการอธิษฐานแต่เช้ามืด]\nพระเยซูทรงลุกขึ้นแต่เช้ามืด')
await p.fill('#nb-text', 'ข้าแต่พระบิดาเจ้า ทดสอบ อาเมน'); await p.click('text=💾 บันทึก'); await p.waitForTimeout(400)
await p.fill('#nb-q', 'ทดสอบเรื่องราว'); await p.waitForSelector('.nb-card--open'); await p.click('.nb-card--open .nb-tabs >> text=เรื่องราว')
const first = await p.locator('.nb-prose p').first().textContent()
check(first.startsWith('องค์พระเยซูคริสต์') && !first.includes('เรื่องราว:') && !first.includes('['), 'story shows without "[เรื่องราว: …]": ' + first.slice(0, 30))
await p.evaluate(() => (window.__said = [])); await p.click('[aria-label^="ฟังต่อเนื่อง"]'); await p.waitForTimeout(300)
await p.waitForSelector('[aria-label="ฟังหน้านี้"]', { timeout: 60000 })
const said = await p.evaluate(() => window.__said.map((x) => x.text).join(' | '))
const i = said.indexOf('เรื่องราว.')
check(i >= 0 && said.slice(i + 'เรื่องราว.'.length).trimStart().replace(/^\|\s*/, '').startsWith('องค์พระเยซูคริสต์') && (said.match(/เรื่องราว/g) ?? []).length === 1, 'reads tab name "เรื่องราว" once, then the title: ' + said.slice(i, i + 50))
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
