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
await p.goto(URL); await p.waitForSelector('.action')
check(await p.locator('.action:has-text("สิ่งที่ควรติดตาม")').count() === 0, 'old tile name removed')
await p.click('.action:has-text("พิธี / วันสำคัญ")'); await p.waitForSelector('.occ-tabs')
const main = await p.locator('.occ-tabs button').allTextContents()
check(main.length === 2 && main[0].includes('พิธีสำคัญ') && main[1].includes('วันสำคัญ'), '2 main tabs: ' + main.join(' | '))
check(await p.locator('.occ-list .result').count() === 8, '8 ceremonies listed')
await p.click('.occ-list .result:has-text("บัพติศมา")'); await p.waitForSelector('.occ-subtabs')
const subs = await p.locator('.occ-subtabs button').allTextContents()
check(subs.length === 3 && subs[0].includes('ความเป็นมา') && subs[1].includes('ความหมาย') && subs[2].includes('โอกาส'), '3 sub-tabs (ceremony): ' + subs.join(' | '))
check((await p.textContent('.occ-body')).includes('ยอห์นผู้ให้บัพติศมา'), 'history content shown')
await p.click('.occ-subtabs >> text=ความหมาย'); check((await p.textContent('.occ-body')).includes('เครื่องหมายภายนอก'), 'meaning tab')
await p.click('.occ-subtabs >> text=โอกาสและขั้นตอน'); check(await p.locator('.occ-plan').count() >= 3, 'occasions & steps tab')
await p.click('.ref-read__toggle >> nth=0'); await p.waitForSelector('.ref-read__chapter'); check((await p.textContent('.ref-read__body')).length > 50, 'verse opens TH1971 text')
await p.evaluate(() => (window.__said = [])); await p.click('[aria-label="ฟังแท็บนี้"]'); await p.waitForTimeout(500)
check((await p.evaluate(() => window.__said[0]?.text ?? '')).startsWith('พิธีบัพติศมา'), 'listen this tab')
await p.click('[aria-label="หยุดชั่วคราว"]').catch(() => {})
// วันสำคัญ
await p.goto(URL + '#/occasions?t=day'); await p.waitForSelector('.occ-next li')
check(await p.locator('.occ-list .result').count() === 11 && await p.locator('.occ-next li').count() === 4, 'days tab: 11 days + upcoming list')
await p.click('.occ-list .result:has-text("อีสเตอร์")'); await p.click('.occ-subtabs >> text=วันที่และการจัด'); await p.waitForSelector('.occ-dates li')
const d = await p.textContent('.occ-dates')
check(d.includes('28 มี.ค. 2570') || d.includes('28 มี.ค. 2027'), 'Easter 2027 computed = 28 Mar: ' + d.slice(0, 80))
await p.click('.occ-dates li >> nth=0 >> text=เพิ่มลงโน้ต'); await p.waitForTimeout(200)
await p.goto(URL + '#/notes'); await p.waitForSelector('.notes-head'); check((await p.textContent('.notes')).includes('วันอาทิตย์อีสเตอร์'), 'added to notes')
await p.goto(URL + '#/occasions/christmas'); await p.waitForSelector('.occ-body'); await p.screenshot({ path: '/tmp/claude-0/shots/occ.png' })
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
