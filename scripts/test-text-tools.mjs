// ปุ่มฟัง: อ่านเฉพาะแท็บที่เปิด · พระคำอ่านชื่อข้อแบบ "บทที่ ข้อ" · หยุดได้ · ปรับความเร็ว (จำลอง speechSynthesis)
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
await ctx.addInitScript(() => {
  if (location.hash.includes('ai=1') || sessionStorage.getItem('ai')) { sessionStorage.setItem('ai', '1'); window.claude = { use: async (n) => n !== 'sample' ? null : Object.assign(async () => ({ text: '' }), { json: async (input) => ({ en: 'Noah was the son of Lamech. He walked with God.' }) }) } }
  // จำลองเสียงอ่านแบบมือถือ Android: บางวลีไม่แจ้งว่าอ่านจบ, cancel ส่ง error "interrupted", มีสัญญาณตำแหน่งคำ
  window.__said = []; let n = 0; let cur = null
  const voices = [{ name: 'Google ไทย', lang: 'th-TH', voiceURI: 'g-th', localService: true }, { name: 'Samsung ไทย ชาย', lang: 'th-TH', voiceURI: 's-th-m', localService: true }, { name: 'Google US English', lang: 'en-US', voiceURI: 'g-en', localService: true }]
  window.SpeechSynthesisUtterance = function (t) { this.text = t }
  const synth = {
    speaking: false, pending: false,
    getVoices: () => voices,
    speak: (u) => {
      window.__said.push({ text: u.text, rate: u.rate, lang: u.lang, pitch: u.pitch, voice: u.voice && u.voice.name })
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
const press = async (loc) => { await loc.scrollIntoViewIfNeeded(); const bx = await loc.boundingBox(); await p.mouse.move(bx.x + 30, bx.y + 10); await p.mouse.down(); await p.waitForTimeout(800); await p.mouse.up(); await p.waitForTimeout(200) }
await p.goto(URL + '#/people/noah/story'); await p.waitForSelector('.story__sec p')
const para = p.locator('.story__sec p').first()
await press(para); await p.waitForSelector('.text-tools')
const labels = await p.locator('.text-tools .bible-selbar__btns button').allTextContents()
check(['ไฮไลต์', 'คัดลอก', 'แชร์', 'อังกฤษ', 'คำอ่าน', 'ฟังต่อ'].every((l, i) => labels[i]?.endsWith(l)), 'same 6 tools as Bible bar: ' + labels.join(','))
await p.click('.text-tools [aria-label="ไฮไลต์"]'); await p.click('.text-tools [aria-label="ไฮไลต์สีเขียว"]'); await p.waitForTimeout(300)
check(await p.locator('.story__sec p').first().locator('.spoken.hl--green').count() === 1, 'paragraph highlighted green')
await p.reload(); await p.waitForSelector('.story__sec p'); await p.waitForTimeout(300)
check(await p.locator('.story__sec p').first().locator('.spoken.hl--green').count() === 1, 'highlight persists')
await press(p.locator('.story__sec p').first()); await p.click('.text-tools [aria-label="ไฮไลต์"]'); await p.click('.text-tools [aria-label="ลบไฮไลต์"]'); await p.waitForTimeout(200)
check(await p.locator('.story__sec p').first().locator('.spoken[class*="hl--"]').count() === 0, 'highlight removed')
// อังกฤษ ไม่มีคีย์ → ลิงก์ Google แปลภาษา
await press(p.locator('.story__sec p').first()); await p.click('.text-tools [aria-label="แปลอังกฤษ"]'); await p.waitForSelector('.en-sheet')
await p.waitForSelector('.en-sheet a[href*="translate.google.com"]'); check(true, 'no AI key → offers Google Translate')
await p.click('.en-sheet .sheet__close')
// อังกฤษ มีผู้ช่วย AI
await p.goto(URL + '#/people/noah/story?ai=1'); await p.evaluate(() => sessionStorage.setItem('ai', '1')); await p.reload(); await p.waitForSelector('.story__sec p')
await press(p.locator('.story__sec p').first()); await p.click('.text-tools [aria-label="แปลอังกฤษ"]'); await p.waitForSelector('.en-sheet .bv')
check((await p.textContent('.en-sheet__text')).includes('Noah was the son of Lamech'), 'AI translation shown for story text')
await p.evaluate(() => (window.__said = [])); await p.click('.en-sheet [aria-label="Read aloud"]'); await p.waitForTimeout(400)
check((await p.evaluate(() => window.__said)).some((x) => x.lang === 'en-US' && x.text.includes('Noah')), 'read aloud in English')
await p.click('.en-sheet .sheet__close')
// ข้อพระคำ (หน้าบุคคล) → WEB ไม่ใช้ AI
await p.goto(URL + '#/people/noah'); await p.waitForSelector('.ref-read__toggle'); await p.click('.ref-read__toggle >> nth=1'); await p.waitForSelector('.ref-read__chapter .spoken')
await press(p.locator('.ref-read__chapter .spoken').first()); await p.click('.text-tools [aria-label="แปลอังกฤษ"]'); await p.waitForSelector('.en-sheet .bv')
check((await p.textContent('.en-sheet .sheet__title')).includes('World English Bible') && (await p.textContent('.en-sheet .sheet__title')).includes('Hebrews 11'), 'verse → World English Bible (no AI): ' + (await p.textContent('.en-sheet .sheet__title strong')))
await p.click('.en-sheet .sheet__close')
// สมุดคำอธิษฐาน
await p.goto(URL + '#/prayer'); await p.waitForSelector('.nb-card'); await p.fill('#nb-q', 'อาหาร'); await p.waitForSelector('.nb-card--open .nb-tabs')
await p.click('.nb-card--open .nb-tabs >> text=อธิษฐาน'); await press(p.locator('.nb-card__text p').first()); await p.waitForSelector('.text-tools')
check(await p.locator('.text-tools .bible-selbar__btns button').count() === 6, 'prayer page: same 6 tools')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
