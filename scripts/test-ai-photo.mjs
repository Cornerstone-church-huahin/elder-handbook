// แชร์เป็นภาพ: แต่งรูปอัตโนมัติในเครื่อง (ปรับสว่าง/สี + โทนเช้า/เย็น) และ AI แต่งรูป (Gemini จำลอง): ต้องยินยอมก่อน · สร้างซ้ำได้แบบต่างกัน · เลือกภาพย่อ/กลับต้นฉบับ · แจ้งข้อผิดพลาด
import { chromium } from 'playwright'
import { cardsOpenByDefault } from './_cards-open.mjs'
import fs from 'node:fs'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
cardsOpenByDefault(b)
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
async function open(withKey) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
  if (withKey) await ctx.addInitScript(() => localStorage.setItem('khatha.aiSettings.v1', JSON.stringify({ vendor: 'gemini', keys: { gemini: 'AIzaFAKEKEYFORTEST' }, models: {} })))
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
  await p.goto(URL + '#/notebook/1'); await p.waitForSelector('#nb-catsel')
  await p.click('.sm-tab >> text=ค้นหาข้อพระคัมภีร์'); await p.fill('#bs-q', 'ความกลัว กังวล')
  await p.getByRole('button', { name: '🔎 ค้นหา', exact: true }).click(); await p.waitForSelector('.bs__card .bs__text', { timeout: 60000 })
  await p.locator('.bs__card').first().getByRole('button', { name: /แชร์/ }).click(); await p.waitForSelector('.sv-text')
  await p.getByRole('tab', { name: /แชร์เป็นภาพ/ }).click(); await p.waitForSelector('.sv-canvas')
  const photo = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 900; c.height = 700; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 700); g.addColorStop(0, '#6aa0d8'); g.addColorStop(1, '#6b8e4e'); x.fillStyle = g; x.fillRect(0, 0, 900, 700); x.strokeStyle = '#222'; x.lineWidth = 4; x.beginPath(); x.moveTo(0, 120); x.quadraticCurveTo(450, 220, 900, 100); x.stroke(); return c.toDataURL('image/png') })
  fs.writeFileSync('/tmp/claude-0/ai-photo.png', Buffer.from(photo.split(',')[1], 'base64'))
  await p.setInputFiles('[aria-label="เลือกรูปพื้นหลัง"]', '/tmp/claude-0/ai-photo.png'); await p.waitForSelector('#sv-auto')
  return { p, ctx, errs }
}
const src = (p) => p.locator('.sv-canvas').evaluate((c) => c.toDataURL())
const changed = async (p, before) => { await p.waitForFunction((b) => document.querySelector('.sv-canvas').toDataURL() !== b, before, { timeout: 8000 }); return true }

// ---- ไม่มีคีย์: ปรับอัตโนมัติในเครื่อง ----
{
  const { p, ctx, errs } = await open(false)
  check((await p.textContent('.sv-tools')).includes('ต้องใส่คีย์ Gemini'), 'no key → tells where to add the Gemini key')
  let before = await src(p)
  await p.click('#sv-auto'); await changed(p, before)
  check((await p.textContent('.sv-tools')).length > 0 && await p.locator('.sv-sl').count() >= 7, 'auto-adjust applied (sliders set from the photo analysis)')
  before = await src(p); await p.getByRole('button', { name: '🌇 ยามเย็น' }).click(); await changed(p, before); check(true, 'evening tone changes the photo')
  before = await src(p); await p.getByRole('button', { name: '🌅 ยามเช้า' }).click(); await changed(p, before); check(true, 'morning tone changes the photo')
  check(errs.length === 0, 'no JS errors ' + errs.join(';')); await ctx.close()
}

// ---- มีคีย์: AI แต่งรูป (จำลอง Gemini) ----
{
  const { p, ctx, errs } = await open(true)
  const reqs = []; let n = 0; let mode = 'ok'
  await ctx.route('**/generativelanguage.googleapis.com/**', async (r) => {
    const body = JSON.parse(r.request().postData() || '{}'); reqs.push({ url: r.request().url(), body })
    if (mode === 'quota') return r.fulfill({ status: 429, contentType: 'application/json', body: '{"error":{"message":"quota"}}' })
    n++
    const png = await p.evaluate((k) => { const c = document.createElement('canvas'); c.width = 64; c.height = 80; const x = c.getContext('2d'); x.fillStyle = `hsl(${k * 70},70%,55%)`; x.fillRect(0, 0, 64, 80); return c.toDataURL('image/png').split(',')[1] }, n)
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }, { inlineData: { mimeType: 'image/png', data: png } }] } }] }) })
  })
  check(await p.locator('#sv-ai').isDisabled(), 'AI button disabled until the user consents to sending the photo')
  await p.check('#sv-consent'); check(!(await p.locator('#sv-ai').isDisabled()), 'consent ticked → AI button enabled')
  let before = await src(p)
  await p.click('#sv-ai'); await p.waitForSelector('.sv-ver'); await changed(p, before)
  check(reqs.length === 1 && /gemini-2\.5-flash-image:generateContent/.test(reqs[0].url), 'calls the Gemini image model')
  const parts = reqs[0].body.contents[0].parts
  check(parts.some((x) => x.inlineData?.data?.length > 1000) && parts[0].text.includes('power lines') && /golden-hour|sunset/.test(parts[0].text), 'sends the photo + prompt (remove wires + evening tone)')
  check(await p.locator('.sv-ver').count() === 2, 'thumbnails: original + attempt 1')
  const p1 = parts[0].text
  before = await src(p)
  await p.click('#sv-ai'); await p.waitForFunction(() => document.querySelectorAll('.sv-ver').length === 3); await changed(p, before)
  const p2 = reqs[1].body.contents[0].parts[0].text
  check(p2 !== p1 && p2.includes('attempt #2') && p2.includes('different'), 'regenerate asks for a clearly different look (attempt #2)')
  check(reqs[1].body.contents[0].parts[1].inlineData.data === reqs[0].body.contents[0].parts[1].inlineData.data, 'each attempt starts from the original photo')
  before = await src(p); await p.getByRole('button', { name: 'ต้นฉบับ' }).click(); await changed(p, before); check(true, 'tap the original thumbnail → back to the original photo')
  before = await src(p); await p.getByRole('button', { name: 'ครั้งที่ 1' }).click(); await changed(p, before); check(true, 'tap attempt 1 → that version is used')
  mode = 'quota'; await p.click('#sv-ai'); await p.waitForSelector('[role=alert]')
  check((await p.textContent('[role=alert]')).includes('โควต้า'), 'quota error shown in Thai: ' + (await p.textContent('[role=alert]')))
  check(errs.length === 0, 'no JS errors ' + errs.join(';')); await ctx.close()
}
await b.close(); console.log(fail ? 'FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
