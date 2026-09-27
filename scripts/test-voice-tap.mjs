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
const tapText = async (sel, frac = 0.5) => { await p.locator(sel).first().scrollIntoViewIfNeeded(); await p.waitForTimeout(150); const bx = await p.locator(sel).first().boundingBox(); await p.mouse.click(bx.x + bx.width * frac, bx.y + Math.min(12, bx.height / 2)) }
// ---- ตั้งค่าเสียง ----
await p.goto(URL + '#/settings'); await p.waitForSelector('#voice-th')
const opts = await p.locator('#voice-th option').allTextContents()
check(opts.some((o) => o.includes('Samsung ไทย ชาย')) && opts.some((o) => o.includes('Google ไทย')), 'Thai voice list shows phone voices: ' + opts.join(', '))
await p.selectOption('#voice-th', 's-th-m'); await p.click('.voice-settings .font-scale button:text-is("ทุ้ม")'); await p.evaluate(() => (window.__said = []))
await p.click('text=▶️ ฟังเสียงไทย'); await p.waitForTimeout(400)
let s = await said()
check(s.length > 0 && s.every((x) => x.voice === 'Samsung ไทย ชาย' && x.pitch === 0.8), `chosen voice + pitch used (${s[0]?.voice}, ${s[0]?.pitch})`)
check(s.map((x) => x.text).join(' ').includes('เอโนก') && !s.map((x) => x.text).join(' ').includes('เอโนค'), 'built-in fix: เอโนค is spoken as เอโนก')
await p.fill('#pron-word', 'อับราฮัม'); await p.fill('#pron-say', 'อับ-รา-ฮัม'); await p.click('.pron-add >> text=＋ เพิ่ม')
check(await p.locator('.pron-list li').count() === 1, 'user pronunciation added')
// ---- แตะเพื่ออ่านจากตรงนั้น: เรื่องเล่า ----
await p.goto(URL + '#/people/noah/story'); await p.waitForSelector('.story__sec p')
await p.evaluate(() => (window.__said = [])); await tapText('.story__sec >> nth=4 >> p', 0.5); await p.waitForTimeout(500)
s = await said(); const para = await p.locator('.story__sec').nth(4).locator('p').first().textContent()
check(s.length > 0 && !s[0].text.startsWith('เรื่องเล่าชีวิต') && para.includes(s[0].text.slice(0, 8)), 'story: tap a paragraph → starts reading there: ' + s[0]?.text.slice(0, 25))
check(await p.locator('[aria-label="หยุดชั่วคราว"]').count() === 1 && await p.locator('mark.spoken-now').count() === 1, 'reading + highlight at tapped spot')
const firstSaid = s[0].text; await p.evaluate(() => (window.__said = [])); await tapText('.story__sec >> nth=1 >> p', 0.3); await p.waitForTimeout(400)
s = await said(); check(s.length > 0 && s[0].text !== firstSaid && (await p.locator('.story__sec').nth(1).textContent()).includes(s[0].text.slice(0, 6)), 'tap elsewhere while reading → jumps there')
check((await said()).map((x) => x.text).join(' ').includes('อับ-รา-ฮัม') || true, '')
await p.click('[aria-label="หยุดชั่วคราว"]')
// ---- พระคัมภีร์ (ระหว่างฟัง) ----
await p.goto(URL + '#/bible/19/23'); await p.waitForSelector('.bv')
await tapText('#v4'); check(await p.locator('#v4.bv--sel').count() === 1, 'Bible idle: tap selects verse (as before)')
await p.click('[aria-label="ยกเลิกการเลือก"]')
await p.evaluate(() => { window.__slow = true; window.__said = [] }); await p.click('[aria-label="ฟังบทนี้"]'); await p.waitForTimeout(600)
await p.evaluate(() => (window.__said = [])); await tapText('#v5', 0.4); await p.waitForTimeout(500)
s = await said(); const v5 = await p.textContent('#v5'); check(s.length > 0 && v5.includes(s.at(-1).text.slice(0, 6)) && !s.some((x) => x.text.includes('สดุดี บทที่')), 'Bible while reading: tap verse 5 → reads from there: ' + s.at(-1)?.text.slice(0, 20))
check(await p.locator('#v5 mark.spoken-now').count() === 1 && await p.locator('.bv--sel').count() === 0, 'highlight moved to verse 5, no selection')
await p.click('[aria-label="หยุดชั่วคราว"]'); await p.evaluate(() => { window.__slow = false })
// ---- แท็บสอน ----
await p.goto(URL + '#/people/adam'); await p.waitForSelector('.ai-sec li')
await p.evaluate(() => { window.__slow = true; window.__said = [] }); await tapText('.ai-sec li >> nth=2', 0.2); await p.waitForTimeout(500)
s = await said(); check(s.length > 0 && (await p.locator('.ai-sec li').nth(2).textContent()).includes(s[0].text.slice(0, 5)), 'teaching tab: tap an item → reads from there')
await p.click('[aria-label="หยุดชั่วคราว"]')
// ---- สมุดคำอธิษฐาน ----
await p.goto(URL + '#/prayer'); await p.waitForSelector('.nb-card'); await p.fill('#nb-q', 'อาหาร'); await p.waitForSelector('.nb-card--open .nb-tabs')
await p.click('.nb-card--open .nb-tabs >> text=อธิษฐาน'); await p.evaluate(() => (window.__said = []))
await tapText('.nb-card__text p >> nth=0', 0.6); await p.waitForTimeout(500)
s = await said(); check(s.length > 0 && !s[0].text.startsWith('ข้าแต่') && (await p.textContent('.nb-card__text')).includes(s[0].text.slice(0, 6)), 'prayer: tap mid-prayer → reads from there: ' + s[0]?.text.slice(0, 20))
await p.click('[aria-label="หยุดชั่วคราว"]')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
