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
const markTop = () => p.evaluate(() => { const m = document.querySelector('mark.spoken-now'); return m ? Math.round(m.getBoundingClientRect().top) : -1 })
await p.goto(URL + '#/people/enoch/story'); await p.waitForSelector('.story__sec p')
// ย่อหน้าที่อยู่ล่างสุดของจอ → แตะอ่าน → ไฮไลต์ต้องเด้งขึ้นไปอยู่ด้านบน
await p.evaluate(() => { window.__slow = true })
const target = await p.evaluate(() => { const ps = [...document.querySelectorAll('.story__sec p')]; const el = ps[4]; window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - (innerHeight - 120)); return 4 })
await p.waitForTimeout(300)
const bx = await p.locator('.story__sec p').nth(target).boundingBox(); await p.mouse.click(bx.x + 10, bx.y + 10)
await p.waitForTimeout(1500)
let t = await markTop(); check(t > 50 && t < 260, 'highlight near bottom → page scrolls so it sits at the top (mark top=' + t + ')')
// อ่านต่อไปเรื่อย ๆ ไฮไลต์ไม่หลุดจอ
let ok = true
for (let i = 0; i < 12; i++) { await p.waitForTimeout(700); t = await markTop(); if (t < 50 || t > 844 - 90) ok = false }
check(ok, 'while reading on, highlight always stays on screen (last top=' + t + ')')
await p.click('[aria-label="หยุดชั่วคราว"]')
// พระคัมภีร์
await p.goto(URL + '#/bible/19/119'); await p.waitForSelector('.bv'); await p.click('[aria-label="ฟังบทนี้"]'); ok = true
for (let i = 0; i < 20; i++) { await p.waitForTimeout(600); t = await markTop(); if (t !== -1 && (t < 90 || t > 844 - 90)) ok = false }
check(ok, 'Bible: highlight stays visible below sticky chapter header (last top=' + t + ')')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
