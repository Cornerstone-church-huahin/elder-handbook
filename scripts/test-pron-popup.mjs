// ปุ่มฟัง: อ่านเฉพาะแท็บที่เปิด · พระคำอ่านชื่อข้อแบบ "บทที่ ข้อ" · หยุดได้ · ปรับความเร็ว (จำลอง speechSynthesis)
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
await ctx.addInitScript(() => {
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
const said = () => p.evaluate(() => window.__said)
// กดค้างที่คำ "อิสอัค" ในเรื่องเล่าของอับราฮัม
await p.goto(URL + '#/people/abraham/story'); await p.waitForSelector('.story__sec p')
const pos = await p.evaluate(() => {
  for (const el of document.querySelectorAll('.story__sec p .spoken')) {
    const tn = el.firstChild; const i = tn?.textContent?.indexOf('อิสอัค') ?? -1
    if (i >= 0) { el.scrollIntoView({ block: 'center' }); const r = document.createRange(); r.setStart(tn, i + 2); r.setEnd(tn, i + 3); const b = r.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } }
  }
})
await p.waitForTimeout(200)
const P = await p.evaluate(() => { const el = [...document.querySelectorAll('.story__sec p .spoken')].find((e) => e.textContent.includes('อิสอัค')); const tn = el.firstChild; const i = tn.textContent.indexOf('อิสอัค'); const r = document.createRange(); r.setStart(tn, i + 2); r.setEnd(tn, i + 3); const b = r.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } })
await p.mouse.move(P.x, P.y); await p.mouse.down(); await p.waitForTimeout(800); await p.mouse.up()
await p.waitForSelector('.pron-sheet')
let w = await p.textContent('#pron-edit-word')
if (w !== 'อิสอัค') { for (let k = 0; k < 3 && w !== 'อิสอัค'; k++) { if ('อิสอัค'.startsWith(w)) await p.click('[aria-label="เพิ่มคำหลัง"]'); else await p.click('[aria-label="เพิ่มคำหน้า"]'); w = await p.textContent('#pron-edit-word') } }
check(w === 'อิสอัค', 'long-press opens pronunciation popup on the word: ' + w)
check(await p.locator('[aria-label="หยุดชั่วคราว"]').count() === 0, 'long-press does not start reading')
check((await p.inputValue('#pron-edit-say')) === 'อิดสะอัก', 'shows current fix (built-in) to edit')
await p.fill('#pron-edit-say', 'อิ-สะ-อัก'); await p.evaluate(() => (window.__said = []))
await p.click('text=▶️ ฟังคำอ่านใหม่'); await p.waitForTimeout(300)
check((await said()).some((x) => x.text.includes('อิ-สะ-อัก')), 'can listen to new reading')
await p.click('.pron-actions >> text=บันทึก'); await p.waitForTimeout(900)
check(await p.locator('.pron-sheet').count() === 0, 'saved & closed')
check((await p.evaluate(() => localStorage.getItem('khatha.pronounce.v1'))).includes('อิ-สะ-อัก'), 'saved to shared pronunciation list')
await p.evaluate(() => (window.__said = []))
const sec = await p.evaluate(() => [...document.querySelectorAll('.story__sec p')].findIndex((e) => e.textContent.includes('อิสอัค')))
await p.locator('.story__sec p').nth(sec).scrollIntoViewIfNeeded(); const bx = await p.locator('.story__sec p').nth(sec).boundingBox(); await p.mouse.click(bx.x + 5, bx.y + 8)
await p.waitForTimeout(1500)
const all = (await said()).map((x) => x.text).join(' ')
check(all.includes('อิ-สะ-อัก') && !all.includes('อิสอัค'), 'reading now uses the new pronunciation everywhere')
await p.click('[aria-label="หยุดชั่วคราว"]')
// ตั้งค่ายังเห็นคำที่แก้
await p.goto(URL + '#/settings'); await p.waitForSelector('.pron-list li')
check((await p.textContent('.pron-list')).includes('อิสอัค → อิ-สะ-อัก'), 'also listed in settings')
// พระคัมภีร์: กดค้างที่ข้อ → ป๊อปอัพ ไม่เลือกข้อ
await p.goto(URL + '#/bible/1/21'); await p.waitForSelector('#v3')
const bb = await p.locator('#v3 .spoken').boundingBox(); await p.mouse.move(bb.x + 40, bb.y + 10); await p.mouse.down(); await p.waitForTimeout(800); await p.mouse.up()
await p.waitForSelector('.pron-sheet'); check(await p.locator('.bv--sel').count() === 0, 'Bible: long-press opens popup without selecting verse')
await p.click('.sheet__close'); await p.click('#v3'); check(await p.locator('#v3.bv--sel').count() === 1, 'normal tap still selects verse')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
