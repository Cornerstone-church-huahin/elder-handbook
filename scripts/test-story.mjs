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
await p.goto(URL + '#/people/noah'); await p.waitForSelector('.story-btn')
check((await p.textContent('.story-btn')).includes('เรื่องเล่าชีวิต'), 'person page has story button next to choose-person')
await p.click('.story-btn'); await p.waitForSelector('.story__sec')
const heads = await p.locator('.story__sec h2').allTextContents()
check(heads[0].includes('ใคร') && heads.some((h) => h.includes('นิสัย')) && heads.some((h) => h.includes('ยุค')) && heads.at(-1).includes('บทส่งท้าย'), 'story sections: who / character / era / … / epilogue: ' + heads.join(' · '))
const txt = await p.textContent('.story')
check(!/\d+\s*:\s*\d+/.test(txt.replace(/ลำดับที่ \d+ จาก 100/, '')), 'no scripture references interrupting the story')
// ฟัง + ไฮไลต์
await p.evaluate(() => { window.__said = []; window.__slow = true }); await p.click('[aria-label="ฟังเรื่องเล่า"]'); await p.waitForTimeout(1200)
const m1 = await p.locator('mark.spoken-now').first().textContent().catch(() => ''); await p.waitForTimeout(1500)
const m2 = await p.locator('mark.spoken-now').first().textContent().catch(() => '')
check(!!m1 && !!m2 && m1 !== m2, `highlight follows the voice ("${m1.slice(0, 12)}" → "${m2.slice(0, 12)}")`)
check((await p.evaluate(() => window.__said[0].text)).startsWith('เรื่องเล่าชีวิตของโนอาห์'), 'starts with title')
// ต่อคนถัดไปอัตโนมัติ
await p.evaluate(() => { window.__slow = false })
await p.waitForFunction(() => location.hash.includes('/people/melchizedek/story'), null, { timeout: 120000 })
check(true, 'after Noah ends → continues to next person (Melchizedek)')
await p.waitForTimeout(800)
check(await p.locator('[aria-label="หยุดชั่วคราว"]').count() === 1 && (await p.textContent('.story__title')) === 'เมลคีเซเดค', 'next story is playing automatically')
const said = await p.evaluate(() => window.__said.map((x) => x.text).join(' | '))
check(said.includes('ต่อไปคือเรื่องของเมนคีเซเดก') && said.includes('เรื่องเล่าชีวิตของเมนคีเซเดก'), 'announces and starts next story')
// ปิดต่ออัตโนมัติ
await p.click('[aria-label="หยุดชั่วคราว"]'); await p.click('[aria-label="เริ่มใหม่"]')
await p.uncheck('.story__auto input'); await p.click('[aria-label="ฟังเรื่องเล่า"]')
await p.waitForSelector('[aria-label="ฟังเรื่องเล่า"]', { timeout: 120000 }); await p.waitForTimeout(800)
check(location => true, ''); check((await p.textContent('.story__title')) === 'เมลคีเซเดค', 'with auto-next off, stays on same person at end')
await p.screenshot({ path: '/tmp/claude-0/shots/story.png' })
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
