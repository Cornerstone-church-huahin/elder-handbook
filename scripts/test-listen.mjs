// ปุ่มฟัง: อ่านเฉพาะแท็บที่เปิด · พระคำอ่านชื่อข้อแบบ "บทที่ ข้อ" · หยุดได้ · ปรับความเร็ว (จำลอง speechSynthesis)
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
await ctx.addInitScript(() => {
  window.__said = []
  const voices = [{ name: 'Google ไทย', lang: 'th-TH' }]
  window.SpeechSynthesisUtterance = function (t) { this.text = t }
  Object.defineProperty(window, 'speechSynthesis', { value: {
    getVoices: () => voices,
    speak: (u) => { window.__said.push({ text: u.text, rate: u.rate, lang: u.lang }); setTimeout(() => u.onend && u.onend(), 30) },
    cancel: () => { window.__cancel = (window.__cancel || 0) + 1 },
  } })
})
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
await p.goto(URL + '#/prayer'); await p.waitForSelector('.nb-card')
await p.fill('#nb-q', 'อาหาร'); await p.waitForSelector('.nb-card--open .nb-verse')
await p.waitForFunction(() => !document.querySelector('.nb-card--open .nb-verse')?.textContent.includes('กำลังเปิด'))
await p.click('.nb-listen__go'); await p.waitForTimeout(400)
let said = await p.evaluate(() => window.__said.map((x) => x.text).join(' '))
check(said.includes('ยอห์น บทที่ 6 ข้อ 11') && said.includes('ทรงหยิบขนมปัง'), 'verses tab reads reference + TH1971 text')
check(await p.evaluate(() => window.__said.every((x) => x.lang === 'th-TH')), 'Thai voice used')
await p.evaluate(() => (window.__said = []))
await p.click('.nb-card--open .nb-tabs >> text=อธิษฐาน'); await p.click('.nb-listen__rate >> text=ช้า'); await p.click('.nb-listen__go'); await p.waitForTimeout(800)
said = await p.evaluate(() => window.__said)
check(said.length > 1 && said[0].text.startsWith('ข้าแต่พระเจ้า') && said.every((x) => x.rate === 0.75), 'prayer tab read in chunks at slow speed')
check(said.every((x) => x.text.length <= 200), 'long prayer split into short parts')
await p.click('.nb-card--open .nb-tabs >> text=เรื่องราว'); await p.evaluate(() => (window.__said = [])); await p.click('.nb-listen__go'); await p.waitForTimeout(300)
check((await p.evaluate(() => window.__said.map((x) => x.text).join(' '))).includes('ห้าพันคน'), 'story tab read')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? `${fail} FAILED` : 'ALL PASSED'); process.exit(fail ? 1 : 0)
