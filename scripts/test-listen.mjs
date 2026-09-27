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
    speak: (u) => { window.__said.push({ text: u.text, rate: u.rate, lang: u.lang }); if (window.__slow) { const words = [...u.text.matchAll(/\S+/g)]; words.forEach((m, k) => setTimeout(() => u.onboundary && u.onboundary({ charIndex: m.index }), k * 120)); setTimeout(() => u.onend && u.onend(), words.length * 120 + 50) } else setTimeout(() => u.onend && u.onend(), 30) },
    cancel: () => { window.__cancel = (window.__cancel || 0) + 1 },
  } })
})
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
await p.goto(URL + '#/prayer'); await p.waitForSelector('.nb-card')
await p.fill('#nb-q', 'อาหาร'); await p.waitForSelector('.nb-card--open .nb-verse')
await p.waitForFunction(() => !document.querySelector('.nb-card--open .nb-verse')?.textContent.includes('กำลังเปิด'))
await p.click('[aria-label="ฟังหน้านี้"]'); await p.waitForTimeout(400)
let said = await p.evaluate(() => window.__said.map((x) => x.text).join(' '))
check(said.includes('ยอห์น บทที่ 6 ข้อ 11') && said.includes('ทรงหยิบขนมปัง'), 'verses tab reads reference + TH1971 text')
check(await p.evaluate(() => window.__said.every((x) => x.lang === 'th-TH')), 'Thai voice used')
await p.evaluate(() => (window.__said = []))
await p.click('.nb-card--open .nb-tabs >> text=อธิษฐาน'); await p.goto(URL + '#/settings'); await p.waitForSelector('#speech-rate'); await p.locator('#speech-rate').fill('0'); check((await p.textContent('.nb-speed__label')).includes('ช้าที่สุด'), 'speed set once in settings: ช้าที่สุด')
await p.goto(URL + '#/prayer'); await p.waitForSelector('.nb-card'); await p.fill('#nb-q', 'อาหาร'); await p.waitForSelector('.nb-fab'); check(await p.locator('.nb-card--open .nb-speed').count() === 0, 'no speed slider inside the card'); await p.click('.nb-card--open .nb-tabs >> text=อธิษฐาน'); await p.evaluate(() => (window.__said = [])); await p.click('[aria-label="ฟังหน้านี้"]'); await p.waitForTimeout(800)
said = await p.evaluate(() => window.__said)
check(said.length > 1 && said[0].text.startsWith('ข้าแต่พระเจ้า') && said.every((x) => x.rate === 0.4), 'prayer tab read in chunks at slowest speed (0.4)')
check(said.every((x) => x.text.length <= 200), 'long prayer split into short parts')
await p.click('.nb-card--open .nb-tabs >> text=เรื่องราว'); await p.evaluate(() => (window.__said = [])); await p.click('[aria-label="ฟังหน้านี้"]'); await p.waitForTimeout(300)
check((await p.evaluate(() => window.__said.map((x) => x.text).join(' '))).includes('ห้าพันคน'), 'story tab read')
await p.goto(URL + '#/settings'); await p.waitForSelector('#speech-rate')
check(await p.locator('#speech-rate').getAttribute('max') === '4' && (await p.textContent('.nb-speed__label')).includes('ช้าที่สุด'), '5 levels; setting remembered')
await p.goto(URL + '#/prayer'); await p.waitForSelector('.nb-card'); await p.fill('#nb-q', 'อาหาร'); await p.waitForSelector('.nb-fab'); await p.waitForTimeout(1000)
const fit = await p.evaluate(() => document.querySelector('.nb-card--open').getBoundingClientRect().bottom <= innerHeight && getComputedStyle(document.querySelector('.bottomnav')).display === 'none' && !!document.querySelector('.topbar .nb-fab'))
check(fit, 'reading mode: card fits screen, bottom menu hidden, listen buttons in top bar')
await p.click('.nb-card--open .nb-card__more'); check(await p.locator('.nb-menu button').count() === 5, 'menu ⋯ has big text, copy, edit, delete, collapse')
await p.click('.nb-menu >> text=พับการ์ด'); await p.waitForTimeout(200); check(await p.evaluate(() => getComputedStyle(document.querySelector('.bottomnav')).display !== 'none'), 'collapsing the card brings the bottom menu back')
await p.fill('#nb-q', ''); await p.fill('#nb-q', 'อาหาร'); await p.waitForSelector('.nb-card--open .nb-verse'); await p.waitForTimeout(600)
await p.click('.nb-card--open .nb-tabs >> text=บันทึก'); await p.evaluate(() => (window.__said = []))
await p.click('[aria-label^="ฟังต่อเนื่อง"]'); await p.waitForTimeout(2500)
const all = await p.evaluate(() => window.__said.map((x) => x.text).join(' | '))
const iv = all.indexOf('พระคำ.'), is = all.indexOf('เรื่องราว.'), ip = all.indexOf('คำอธิษฐาน.')
check(iv === 0 && is > iv && ip > is && all.includes('ทรงหยิบขนมปัง') && all.includes('ห้าพันคน') && all.includes('ชำระอาหาร'), 'continuous: verses → story → prayer in order')
check(await p.evaluate(() => window.__said.every((x) => x.rate === 0.4)), 'continuous uses chosen speed')
check((await p.locator('.nb-card--open .nb-tabs [aria-selected=true]').textContent()).includes('อธิษฐาน'), 'tab follows what is being read')
// หยุดชั่วคราวแล้วฟังต่อจากจุดเดิม (ไม่เริ่มใหม่)
await p.evaluate(() => { window.__slow = true; window.__said = [] })
await p.click('.nb-card--open .nb-tabs >> text=อธิษฐาน'); await p.click('[aria-label="ฟังหน้านี้"]'); await p.waitForTimeout(1000)
await p.click('[aria-label="หยุดชั่วคราว"]'); const before = await p.evaluate(() => window.__said.length)
check(await p.locator('[aria-label="ฟังต่อ"]').count() === 1, 'pause shows ฟังต่อ')
await p.waitForTimeout(500); check(await p.evaluate(() => window.__said.length) === before, 'nothing read while paused')
await p.evaluate(() => { window.__slow = false }); await p.click('[aria-label="ฟังต่อ"]'); await p.waitForTimeout(1500)
const seq = await p.evaluate(() => window.__said.map((x) => x.text))
check(seq.length > before && seq[before - 1].endsWith(seq[before]) && seq.filter((t) => t === seq[0]).length === 1, 'resume continues from the word where it paused: "' + seq[before - 1] + '" → "' + seq[before] + '"')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? `${fail} FAILED` : 'ALL PASSED'); process.exit(fail ? 1 : 0)
