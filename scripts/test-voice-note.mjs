// ป้ายสถานะเสียงอ่าน: บอกว่าตอนนี้เล่นต่อได้ไหมเมื่อกดโฮม/ย่อแอป/จอดับ (โหมดไฟล์เสียง Gemini) หรือจะหยุด (เสียงมือถือ) พร้อมสาเหตุและทางไปตั้งค่า
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
async function run(setup, label) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.addInitScript(() => { window.SpeechSynthesisUtterance = function (t) { this.text = t }; Object.defineProperty(window, 'speechSynthesis', { value: { speaking: false, pending: false, getVoices: () => [{ name: 'Google ไทย', lang: 'th-TH' }], speak: () => {}, cancel: () => {} } }) })
  if (setup) await ctx.addInitScript(setup)
  const p = await ctx.newPage()
  await p.goto(URL + '#/notebook/1'); await p.waitForSelector('#nb-catsel')
  await p.click('[aria-label="จัดการหมวด"]'); await p.fill('[aria-label="ชื่อหมวดใหม่"]', 'ท'); await p.getByRole('button', { name: '💾 บันทึกหมวด' }).click(); await p.click('[aria-label="จัดการหมวด"]')
  await p.click('[aria-label="เปิดหมวด ท"]'); await p.click('#sm-custom-toggle'); await p.fill('#sm-custom-label', 'ก'); await p.fill('#sm-custom-text', 'ข'); await p.click('#sm-custom-save'); await p.waitForTimeout(250)
  const inCat = await p.locator('.voice-note').first().textContent()
  await p.click('[aria-label="กลับไปหมวดทั้งหมด"]'); await p.waitForSelector('.sm-bar')
  const inList = await p.locator('.sm-bar .voice-note').textContent()
  return { p, inCat, inList, label }
}
{
  const r = await run(null, 'no key')
  check(r.inList.includes('เสียงจะหยุด') && r.inList.includes('ยังไม่ได้ใส่คีย์ Gemini') && r.inCat.includes('เสียงจะหยุด'), 'no Gemini key → warns that phone voice stops when leaving the app, with the reason (both category list and inside a category)')
  const href = await r.p.locator('.voice-note__link').first().getAttribute('href')
  check((href || '').includes('/settings'), 'has a link to Settings: ' + href)
  check((await r.p.locator('.us-settings .voice-note').count()) === 1, 'also shown in the listening-settings card at the bottom')
}
{
  const r = await run(() => localStorage.setItem('khatha.aiSettings.v1', JSON.stringify({ vendor: 'gemini', keys: { gemini: 'AIzaFAKE' }, models: {} })))
  check(r.inList.includes('โหมดไฟล์เสียง') && r.inList.includes('✅') && r.inCat.includes('✅'), 'Gemini key + default switch on → shows the file-audio mode that keeps playing in background')
}
{
  const r = await run(() => { localStorage.setItem('khatha.aiSettings.v1', JSON.stringify({ vendor: 'gemini', keys: { gemini: 'AIzaFAKE' }, models: {} })); localStorage.setItem('khatha.cloudVoice.v1', JSON.stringify({ on: false, voice: 'Kore' })) })
  check(r.inList.includes('เสียงจะหยุด') && r.inList.includes('ปิดอยู่'), 'key present but switch off → says the switch is off')
}
await b.close(); console.log(fail ? 'FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
