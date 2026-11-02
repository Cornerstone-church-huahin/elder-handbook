// รูปถ่ายฟรีจากเน็ต (Wikimedia Commons จำลอง): คัดเฉพาะสาธารณสมบัติ/CC0 · โหลดเพิ่ม · เลือกแล้วใช้เป็นพื้นหลัง · แจ้งข้อผิดพลาดเมื่อออฟไลน์
import { chromium } from 'playwright'
import { cardsOpenByDefault } from './_cards-open.mjs'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
cardsOpenByDefault(b)
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
const calls = []; let offline = false
const page = (id, title, lic, w, h) => ({ pageid: id, title: `File:${title}`, index: id, imageinfo: [{ thumburl: `https://upload.wikimedia.org/mock/${title}`, width: w, height: h, descriptionurl: `https://commons.wikimedia.org/wiki/File:${title}`, extmetadata: { LicenseShortName: { value: lic } } }] })
await ctx.route('**/commons.wikimedia.org/w/api.php**', async (r) => {
  const u = new globalThis.URL(r.request().url()); calls.push(u.searchParams.toString())
  if (offline) return r.abort()
  if (u.searchParams.get('titles')) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ query: { pages: { 9: page(9, 'Full.jpg', 'Public domain', 4000, 3000) } } }) })
  const off = Number(u.searchParams.get('gsroffset') || 0)
  const pages = off === 0
    ? { 1: page(1, 'Sunrise_a.jpg', 'Public domain', 3000, 2000), 2: page(2, 'Sunrise_b.jpg', 'CC0', 2400, 3200), 3: page(3, 'Sunrise_c.jpg', 'CC BY-SA 4.0', 3000, 2000), 4: page(4, 'Tiny.jpg', 'Public domain', 300, 200) }
    : { 5: page(5, 'Sunrise_d.jpg', 'Public domain', 3500, 2500) }
  return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ query: { pages }, ...(off === 0 ? { continue: { gsroffset: 50 } } : {}) }) })
})
const png = await (async () => { const pg = await ctx.newPage(); await pg.goto('about:blank'); const d = await pg.evaluate(() => { const c = document.createElement('canvas'); c.width = 320; c.height = 240; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 320, 240); g.addColorStop(0, '#ff7e5f'); g.addColorStop(1, '#feb47b'); x.fillStyle = g; x.fillRect(0, 0, 320, 240); return c.toDataURL('image/png') }); await pg.close(); return Buffer.from(d.split(',')[1], 'base64') })()
await ctx.route('**/upload.wikimedia.org/**', (r) => offline ? r.abort() : r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: png }))
await p.goto(URL + '#/notebook/1'); await p.waitForSelector('#nb-catsel')
await p.click('.sm-tab >> text=ค้นหาข้อพระคัมภีร์'); await p.fill('#bs-q', 'ความกลัว กังวล'); await p.getByRole('button', { name: '🔎 ค้นหา', exact: true }).click(); await p.waitForSelector('.bs__card .bs__text', { timeout: 60000 })
await p.locator('.bs__card').first().getByRole('button', { name: /แชร์/ }).click(); await p.waitForSelector('.sv-text')
await p.getByRole('tab', { name: /แชร์เป็นภาพ/ }).click(); await p.waitForSelector('.sv-canvas')
await p.locator('#sv-web-toggle').click(); await p.waitForSelector('.sv-arts--web .sv-art')
check(calls.length >= 1 && /generator=search/.test(calls[0]) && /gsrsearch=sunrise/.test(calls[0]), 'searches Wikimedia Commons (no key): ' + calls[0].slice(0, 90))
const hits = await p.locator('.sv-arts--web .sv-art').allTextContents()
check(hits.length === 2 && hits.some((t) => /Public domain/.test(t)) && hits.some((t) => /CC0/.test(t)), 'only public-domain / CC0 and large-enough images are shown (' + hits.join(', ') + ')')
await p.locator('#sv-web-more').click(); await p.waitForFunction(() => document.querySelectorAll('.sv-arts--web .sv-art').length === 3)
check(calls.some((c) => /gsroffset=50/.test(c)), '"โหลดรูปเพิ่ม" fetches the next page (3 shown)')
await p.getByRole('button', { name: '⛰️ ภูเขา' }).click(); await p.waitForTimeout(400)
check(calls.some((c) => /gsrsearch=mountain/.test(c)), 'topic chip searches that topic (mountain)')
const before = await p.locator('.sv-canvas').evaluate((c) => c.toDataURL())
await p.locator('.sv-arts--web .sv-art').first().click(); await p.waitForFunction((b2) => document.querySelector('.sv-canvas').toDataURL() !== b2, before, { timeout: 8000 })
check(true, 'choosing a photo uses it as the background')
check((await p.locator('.sv-web .source-note[role=status]').textContent()).includes('Wikimedia Commons'), 'shows where the photo came from')
check(await p.locator('#sv-reset-photo').count() === 1, 'photo tools (filters/tone/AI) are available for it')
offline = true; await p.locator('#sv-web-go').click(); await p.waitForSelector('.sv-web [role=alert]')
check((await p.textContent('.sv-web [role=alert]')).includes('อินเทอร์เน็ต'), 'offline → clear Thai message: ' + (await p.textContent('.sv-web [role=alert]')))
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? 'FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
