// สต็อกพื้นหลังของฉัน: สร้างเพิ่มทีละ 5/10 รูป (สุ่มในเครื่อง) · เก็บถาวรในเครื่อง (ปิด-เปิดหน้าแล้วยังอยู่) · ใช้/ลบ/ล้าง · AI สร้าง (Gemini จำลอง)
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
await ctx.addInitScript(() => localStorage.setItem('khatha.aiSettings.v1', JSON.stringify({ vendor: 'gemini', keys: { gemini: 'AIzaFAKEKEYFORTEST' }, models: {} })))
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
const aiReqs = []
await ctx.route('**/generativelanguage.googleapis.com/**', async (r) => {
  aiReqs.push(JSON.parse(r.request().postData() || '{}'))
  const png = await p.evaluate((k) => { const c = document.createElement('canvas'); c.width = 320; c.height = 400; const x = c.getContext('2d'); x.fillStyle = `hsl(${k * 47},60%,60%)`; x.fillRect(0, 0, 320, 400); return c.toDataURL('image/png').split(',')[1] }, aiReqs.length)
  return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png } }] } }] }) })
})
const open = async () => {
  await p.goto(URL + '#/notebook/1'); await p.waitForSelector('#nb-catsel')
  await p.click('.sm-tab >> text=ค้นหาข้อพระคัมภีร์'); await p.fill('#bs-q', 'ความกลัว กังวล'); await p.getByRole('button', { name: '🔎 ค้นหา', exact: true }).click(); await p.waitForSelector('.bs__card .bs__text', { timeout: 60000 })
  await p.locator('.bs__card').first().getByRole('button', { name: /แชร์/ }).click(); await p.waitForSelector('.sv-text')
  await p.getByRole('tab', { name: /แชร์เป็นภาพ/ }).click(); await p.waitForSelector('#sv-gen5')
}
const items = () => p.locator('[aria-label="สต็อกพื้นหลังของฉัน"] .sv-stockitem')
await open()
check(await items().count() === 0 && (await p.textContent('.sv-tools')).includes('ยังไม่มีรูปในสต็อก'), 'stock starts empty with a hint')
await p.click('#sv-gen5'); await p.waitForFunction(() => document.querySelectorAll('[aria-label="สต็อกพื้นหลังของฉัน"] .sv-stockitem').length === 5, null, { timeout: 30000 })
check(await items().count() === 5, '"สร้างเพิ่ม 5 รูป" adds 5 images')
await p.click('#sv-gen10'); await p.waitForFunction(() => document.querySelectorAll('[aria-label="สต็อกพื้นหลังของฉัน"] .sv-stockitem').length === 12, null, { timeout: 40000 })
check((await p.textContent('.sv-tools')).includes('(15 รูป)'), 'after +10 the stock holds 15 (first page shows 12)')
const srcs = await items().locator('img').evaluateAll((els) => els.map((e) => e.src.length + e.src.slice(-80)))
check(new Set(srcs).size === srcs.length, 'every generated thumbnail is different (' + new Set(srcs).size + '/' + srcs.length + ')')
// ถาวร: โหลดหน้าใหม่ แล้วยังอยู่
await p.reload(); await open(); await p.waitForFunction(() => document.querySelectorAll('[aria-label="สต็อกพื้นหลังของฉัน"] .sv-stockitem').length === 12, null, { timeout: 15000 })
check((await p.textContent('.sv-tools')).includes('(15 รูป)'), 'stock survives reloading the page (stored on this device)')
// ใช้เป็นพื้นหลัง
const before = await p.locator('.sv-canvas').evaluate((c) => c.toDataURL())
await items().first().locator('.sv-art').click(); await p.waitForFunction((x) => document.querySelector('.sv-canvas').toDataURL() !== x, before, { timeout: 10000 })
check(await p.locator('#sv-reset-photo').count() === 1, 'tapping a stock image uses it as the background')
// ดูเพิ่ม + ลบ
await p.click('#sv-stock-more'); await p.waitForFunction(() => document.querySelectorAll('[aria-label="สต็อกพื้นหลังของฉัน"] .sv-stockitem').length === 15)
await items().first().locator('.sv-stockx').click(); await p.waitForFunction(() => document.querySelectorAll('[aria-label="สต็อกพื้นหลังของฉัน"] .sv-stockitem').length === 14)
check((await p.textContent('.sv-tools')).includes('(14 รูป)'), 'delete one → 14 left')
// AI สร้าง
await p.click('#sv-genai'); await p.waitForFunction(() => document.querySelectorAll('[aria-label="สต็อกพื้นหลังของฉัน"] .sv-stockitem').length >= 19, null, { timeout: 30000 })
check(aiReqs.length === 5 && aiReqs.every((q) => !q.contents[0].parts.some((x) => x.inlineData)) && /Bible verse card/.test(aiReqs[0].contents[0].parts[0].text), 'AI makes 5 backgrounds from text prompts only (no user photo sent)')
check((await items().first().textContent()).includes('✨'), 'AI images are marked ✨')
// ล้าง
await p.click('#sv-stock-clear'); await p.click('#sv-stock-clear-yes'); await p.waitForFunction(() => document.querySelectorAll('[aria-label="สต็อกพื้นหลังของฉัน"] .sv-stockitem').length === 0)
check((await p.textContent('.sv-tools')).includes('(0 รูป)'), 'clear stock (with confirmation) → empty')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? 'FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
