// สคริปต์ด่วน · ถามตอบ · การประชุม: ติ๊กการ์ดเพื่อเลือกฟัง/วน · การตั้งค่าเสียง (วน + ความเร็ว) ชุดเดียวกับทั้งแอป (จำลอง speechSynthesis)
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
await ctx.addInitScript(() => {
  const now = Date.now()
  localStorage.setItem('khatha.urgentScripts.v1', JSON.stringify([1, 2, 3].map((n) => ({ id: `s${n}`, title: `สคริปต์ ${n}`, tag: '', body: `เนื้อหา ${n}`, pos: n, updated: now }))))
  localStorage.setItem('khatha.qa.v1', JSON.stringify([1, 2, 3].map((n) => ({ id: `q${n}`, q: `คำถาม ${n}`, a: `คำตอบ ${n}`, tag: '', created: now, updated: now }))))
  localStorage.setItem('khatha.meetings.v1', JSON.stringify([1, 2, 3].map((n) => ({ id: `m${n}`, date: `2026-10-0${n}`, title: `ประชุม ${n}`, attendees: '', resolutions: [{ id: `r${n}`, topic: `หัวข้อ ${n}`, decision: `มติ ${n}` }], notes: '', files: [], created: now, updated: now }))))
  window.__said = []; let cur = null
  window.SpeechSynthesisUtterance = function (t) { this.text = t }
  const synth = { speaking: false, pending: false, getVoices: () => [{ name: 'Google ไทย', lang: 'th-TH' }],
    speak: (u) => { window.__said.push({ text: u.text, rate: u.rate }); synth.speaking = true; cur = setTimeout(() => { synth.speaking = false; u.onend && u.onend() }, 15) },
    cancel: () => { clearTimeout(cur); synth.speaking = false } }
  Object.defineProperty(window, 'speechSynthesis', { value: synth })
})
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
const said = () => p.evaluate(() => window.__said.map((x) => x.text).join(' | '))
async function page(route, name, pick, expectA, expectNotA, other) {
  await p.goto(URL + '#/' + route); await p.waitForSelector('.us-card')
  const boxes = await p.locator('.us-pick input').count()
  check(boxes === 3, `${name}: checkbox on every card (${boxes})`)
  await p.evaluate(() => (window.__said = []))
  await p.click('[aria-label="ฟังทั้งหมดต่อเนื่อง"]'); await p.waitForTimeout(600)
  const all = await said(); check(all.includes(expectA) && all.includes(expectNotA), `${name}: no tick → plays everything`)
  await p.click('[aria-label="หยุดเลย"]').catch(() => {})
  await p.locator('.us-pick input').nth(pick).check()
  const lbl = await p.textContent('[aria-label="ฟังทั้งหมดต่อเนื่อง"]'); check(/ฟังที่เลือก \(1\)/.test(lbl), `${name}: button says "ฟังที่เลือก (1)": ${lbl}`)
  await p.evaluate(() => (window.__said = []))
  await p.click('[aria-label="ฟังทั้งหมดต่อเนื่อง"]'); await p.waitForTimeout(600)
  const sel = await said(); check(sel.includes(expectA) && !sel.includes(expectNotA), `${name}: ticked only → plays just that card`)
  await p.click('[aria-label="หยุดเลย"]').catch(() => {})
  await p.reload(); await p.waitForSelector('.us-card')
  check(await p.locator('.us-pick input').nth(pick).isChecked(), `${name}: tick is remembered after reload`)
  check(await p.locator('.us-settings .us-loop input').count() === 1 && await p.locator('.us-settings input[type=range]').count() === 1, `${name}: loop checkbox + speed slider card present`)
}
if (!process.env.ONLY || process.env.ONLY === 'scripts') await page('scripts', 'scripts', 1, 'เนื้อหา 2', 'เนื้อหา 1')
if (!process.env.ONLY || process.env.ONLY === 'qa') await page('qa', 'qa', 1, 'คำตอบ 2', 'คำตอบ 1')
if (!process.env.ONLY || process.env.ONLY === 'minutes') await page('meetings/minutes', 'minutes', 1, 'มติ 2', 'มติ 1')
// ความเร็วใช้ร่วมกัน: ตั้งในหน้า qa → หน้า scripts ใช้ค่าเดียวกัน
await p.goto(URL + '#/qa'); await p.waitForSelector('.us-settings input[type=range]')
await p.locator('.us-settings input[type=range]').fill('0')
await p.goto(URL + '#/scripts'); await p.waitForSelector('.us-settings input[type=range]')
check(await p.locator('.us-settings input[type=range]').inputValue() === '0', 'speed set on one page is the same on another page')
check(await p.evaluate(() => localStorage.getItem('khatha.speechRate')) === '0.4', 'saved in the same key as the prayer notebook/settings (khatha.speechRate)')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? 'FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
