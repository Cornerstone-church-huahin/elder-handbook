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
const first = async (id) => (await (await fetch(`http://localhost:4173/data/stories/${id}.json`)).json()).sections[0].text.split('\n\n')[0].slice(0, 25)
const eve1 = await first('eve'), abel1 = await first('abel'), adam1 = await first('adam')
await p.goto(URL + '#/people/adam/story'); await p.waitForSelector('.story__sec p')
await p.evaluate(() => (window.__said = [])); await p.click('[aria-label="ฟังเรื่องเล่า"]')
await p.waitForFunction(() => location.hash.includes('/people/abel/story'), null, { timeout: 180000 })
await p.waitForTimeout(1500)
const said = await p.evaluate(() => window.__said.map((x) => x.text).join(' '))
const iEveTitle = said.indexOf('เรื่องเล่าชีวิตของเอวา'), iEve = said.indexOf(eve1), iAbelTitle = said.indexOf('เรื่องเล่าชีวิตของอาแบล'), iAbel = said.indexOf(abel1)
const adamCount = said.split(adam1).length - 1
check(adamCount === 1, 'Adam content read once (not repeated under Eve): ' + adamCount)
check(iEveTitle > 0 && iEve > iEveTitle, 'after Adam → Eve title then Eve content')
const iCainTitle = said.indexOf('เรื่องเล่าชีวิตของคาอิน')
check(iCainTitle > iEve && iCainTitle < iAbelTitle, 'Cain (elder brother) comes between Eve and Abel')
check(iAbelTitle > iEve && iAbel > iAbelTitle, 'after Eve → Abel title then Abel content (keeps going)')
check((await p.textContent('.story__title')) === 'อาแบล' && await p.locator('[aria-label="หยุดชั่วคราว"]').count() === 1, 'Abel page is playing')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
