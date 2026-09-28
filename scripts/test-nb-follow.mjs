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
const vis = () => p.evaluate(() => {
  const m = document.querySelector('mark.spoken-now'); if (!m) return null
  const r = m.getBoundingClientRect(); const bar = document.querySelector('.nb-bar').getBoundingClientRect()
  const nav = document.querySelector('.bottomnav'); const nb = nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect().top : innerHeight
  return { top: Math.round(r.top), bottom: Math.round(r.bottom), barBottom: Math.round(bar.bottom), limit: Math.round(nb), text: m.textContent.slice(0, 15) }
})
await p.goto(URL + '#/prayer'); await p.waitForSelector('.nb-card'); await p.fill('#nb-q', 'อาหาร'); await p.waitForSelector('.nb-card--open .nb-verse')
await p.waitForFunction(() => !document.querySelector('.nb-card--open .nb-verse')?.textContent.includes('กำลังเปิด'))
const title = await p.textContent('.nb-card--open .nb-card__title')
await p.evaluate(() => { window.__said = []; window.__slow = true }); await p.click('[aria-label^="ฟังต่อเนื่อง"]'); await p.waitForTimeout(700)
const said0 = await p.evaluate(() => window.__said[0]?.text)
check(said0 === title, 'continuous starts with the prayer title: ' + said0)
let v = await vis(); check(v && v.text && title.includes(v.text.slice(0, 5)) && v.top >= v.barBottom, 'title highlighted and visible (not under search bar): ' + JSON.stringify(v))
let bad = []
for (let i = 0; i < 30; i++) { await p.waitForTimeout(500); v = await vis(); if (v && (v.top < v.barBottom - 2 || v.bottom > v.limit)) bad.push(v) }
check(bad.length === 0, 'highlight never hidden under the search bar or bottom (' + bad.length + ' bad) ' + JSON.stringify(bad[0] ?? ''))
if (await p.locator('[aria-label="หยุดชั่วคราว"]').count()) await p.click('[aria-label="หยุดชั่วคราว"]')
await p.evaluate(() => { window.__slow = false })
if (await p.locator('[aria-label="เริ่มใหม่"]').count()) await p.click('[aria-label="เริ่มใหม่"]'); await p.click('.nb-card--open .nb-tabs >> text=อธิษฐาน'); await p.evaluate(() => (window.__said = []))
await p.click('[aria-label="ฟังหน้านี้"]'); await p.waitForTimeout(2000)
const s2 = await p.evaluate(() => window.__said.map((x) => x.text))
check(s2.join(' ').startsWith(title.slice(0, 20)) && s2.some((x) => x.startsWith('ข้าแต่')) && !s2[0].startsWith('ข้าแต่'), 'this-tab also starts with title then prayer ' + JSON.stringify(s2.slice(0,3)))
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
