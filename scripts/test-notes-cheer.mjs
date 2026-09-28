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
// ---- พระคำ 4 ข้อ ----
await p.goto(URL + '#/prayer'); await p.waitForSelector('.nb-card'); await p.fill('#nb-q', 'อาหาร'); await p.waitForSelector('.nb-card--open .nb-verse')
check(await p.locator('.nb-card--open .nb-verse').count() === 4, 'meal prayer shows 4 verses: ' + (await p.locator('.nb-card--open .nb-verse__ref').allTextContents()).join(' / '))
await p.fill('#nb-q', ''); await p.click('.nb-add'); await p.fill('#nb-title', 'คำนำอธิษฐานยามตื่นนอน'); await p.fill('#nb-ref1', 'สดุดี 143:8'); await p.fill('#nb-text', 'ข้าแต่พระบิดาเจ้า ขอบพระคุณสำหรับเช้าวันใหม่ อาเมน'); await p.click('text=💾 บันทึก'); await p.waitForTimeout(300)
await p.fill('#nb-q', 'ยามตื่นนอน'); await p.waitForSelector('.nb-card--open .nb-verse')
const refs = await p.locator('.nb-card--open .nb-verse__ref').allTextContents()
check(refs.length === 4 && refs[0].includes('สดุดี 143:8'), 'own verse kept + 3 popular related verses added: ' + refs.join(' / '))
// ---- หนุนใจ ----
await p.click('.nb-card--open .nb-tabs >> text=หนุนใจ'); await p.waitForSelector('.nb-cheer__text p')
const cheer = await p.textContent('.nb-cheer__text')
check(cheer.includes('วันนี้') && cheer.includes('ขอพระเจ้าทรงอวยพร'), 'auto encouragement for morning prayer: ' + cheer.slice(0, 60))
check(await p.locator('.nb-tabs >> text=บันทึก').count() === 0 && await p.locator('.nb-tabs >> text=หนุนใจ').count() === 1, 'tab renamed บันทึก → หนุนใจ')
await p.click('.nb-cheer__btns >> text=✏️ แก้ไข'); await p.fill('textarea[id^="nb-cheer-"]', 'ขอพระเจ้าทรงอวยพรคุณตลอดวันนะครับ'); await p.click('.nb-cheer >> text=💾 บันทึก'); await p.waitForTimeout(200)
check((await p.textContent('.nb-cheer__text')).includes('ตลอดวันนะครับ'), 'encouragement editable & saved')
await p.click('.nb-cheer >> text=บันทึกส่วนตัว'); check(await p.locator('textarea[id^="nb-notes-"]').count() === 1, 'private notes still available inside หนุนใจ')
await p.evaluate(() => (window.__said = [])); await p.click('[aria-label^="ฟังต่อเนื่อง"]'); await p.waitForTimeout(300)
await p.waitForSelector('[aria-label="ฟังหน้านี้"]', { timeout: 60000 })
const all = await p.evaluate(() => window.__said.map((x) => x.text).join(' | '))
check(all.indexOf('คำหนุนใจ.') > all.indexOf('คำอธิษฐาน.') && all.includes('ตลอดวันนะครับ'), 'continuous ends with encouragement')
// ---- โน้ต ----
check(await p.locator('.bottomnav a').count() === 5 && (await p.locator('.bottomnav').textContent()).includes('โน้ต'), 'bottom menu has 5 items incl. โน้ต')
await p.goto(URL + '#/notes'); await p.waitForSelector('.notes-head')
const today = await p.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })
await p.click('.notes-head >> text=＋ เพิ่ม'); await p.fill('#note-title', 'เยี่ยมคุณยายที่โรงพยาบาล'); await p.fill('#note-date', today); await p.fill('#note-time', '15:30'); await p.fill('#note-body', 'นำหนังสือเพลงไป')
check(await p.locator('.note-sheet a[href*="calendar.google.com"]').count() === 1, 'add-to-calendar link for dated note')
await p.click('.note-sheet >> text=💾 บันทึก')
await p.click('.notes-head >> text=＋ เพิ่ม'); await p.fill('#note-title', 'ซื้อน้ำมันเจิม'); await p.fill('#note-date', ''); await p.click('.note-sheet >> text=💾 บันทึก')
await p.waitForTimeout(200)
const groups = await p.locator('.notes-group .section__title').allTextContents()
check(groups[0].startsWith('วันนี้') && groups.some((g) => g.startsWith('บันทึกย่อ')), 'grouped: today / memos: ' + groups.join(' | '))
check((await p.textContent('.memo__when')).includes('วันนี้ 15:30'), 'shows วันนี้ 15:30')
check((await p.textContent('.nav-badge')) === '1', 'bottom menu badge shows 1 due today')
await p.click('.notes-filter >> text=บันทึกย่อ'); check(await p.locator('.memo').count() === 1, 'filter memos')
await p.click('.notes-filter >> text=ทั้งหมด'); await p.click('[aria-label="ทำแล้ว: เยี่ยมคุณยายที่โรงพยาบาล"]'); await p.waitForTimeout(200)
check(await p.locator('.nav-badge').count() === 0, 'mark done → badge cleared')
await p.reload(); await p.waitForSelector('.notes-head'); check((await p.textContent('.notes')).includes('ซื้อน้ำมันเจิม'), 'notes persist')
await p.screenshot({ path: '/tmp/claude-0/shots/notes.png' })
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
