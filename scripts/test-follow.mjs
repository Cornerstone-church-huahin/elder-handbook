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
const track = async (label) => {
  await p.evaluate(() => { window.__slow = true }); await p.waitForTimeout(900)
  const a = await p.locator('mark.spoken-now').first().textContent().catch(() => '')
  await p.waitForTimeout(1500)
  const b2 = await p.locator('mark.spoken-now').first().textContent().catch(() => '')
  check(!!a && !!b2 && a !== b2, `${label}: highlight follows the voice ("${a.slice(0, 15)}" → "${b2.slice(0, 15)}")`)
}
// พระคัมภีร์
await p.goto(URL + '#/bible/19/23'); await p.waitForSelector('.bv')
await p.evaluate(() => { window.__slow = true }); await p.click('[aria-label="ฟังบทนี้"]'); await track('Bible reader')
await p.click('[aria-label="หยุดชั่วคราว"]'); check(await p.locator('mark.spoken-now').count() === 1, 'highlight stays where paused')
await p.click('[aria-label="เริ่มใหม่"]'); check(await p.locator('mark.spoken-now').count() === 0, 'highlight cleared after stop')
// สมุดคำอธิษฐาน
await p.goto(URL + '#/prayer'); await p.waitForSelector('.nb-card'); await p.fill('#nb-q', 'อาหาร'); await p.waitForSelector('.nb-card--open .nb-verse')
await p.waitForFunction(() => !document.querySelector('.nb-card--open .nb-verse')?.textContent.includes('กำลังเปิด'))
await p.click('.nb-card--open .nb-tabs >> text=อธิษฐาน'); await p.click('[aria-label="ฟังหน้านี้"]'); await track('Prayer notebook')
await p.click('[aria-label="หยุดชั่วคราว"]')
// บุคคล
await p.goto(URL + '#/people/adam'); await p.waitForSelector('.ai-sec'); await p.click('[aria-label="ฟังแท็บนี้"]'); await track('Person teaching tab')
await p.click('[aria-label="หยุดชั่วคราว"]')
await p.click('.ref-read__toggle >> nth=0'); await p.waitForSelector('.ref-read__listen'); await p.click('.ref-read__listen'); await track('Person verse reader')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
