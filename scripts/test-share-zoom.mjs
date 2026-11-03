// แชร์เป็นภาพ: ซูมรูปพื้นหลังได้ทั้งเข้าและออก · กึ่งกลางแถบ = 1× · ซูมออกเติมขอบด้วยภาพเบลอ · เลื่อนตำแหน่งได้ตอนซูมออก
import { chromium } from 'playwright'
import { cardsOpenByDefault } from './_cards-open.mjs'
import fs from 'node:fs'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
cardsOpenByDefault(b)
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
// รูปทดสอบ: ครึ่งซ้ายแดง ครึ่งขวาน้ำเงิน ขอบรอบเหลือง (ให้เห็นการซูมชัด)
const png = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 900; c.height = 700; const x = c.getContext('2d'); x.fillStyle = '#d32f2f'; x.fillRect(0, 0, 450, 700); x.fillStyle = '#1976d2'; x.fillRect(450, 0, 450, 700); x.strokeStyle = '#ffeb3b'; x.lineWidth = 40; x.strokeRect(20, 20, 860, 660); return c.toDataURL('image/png') })
fs.writeFileSync('/tmp/claude-0/zoomtest.png', Buffer.from(png.split(',')[1], 'base64'))
await p.goto(URL + '#/notebook/1'); await p.waitForSelector('#nb-catsel')
await p.click('.sm-tab >> text=ค้นหาข้อพระคัมภีร์'); await p.fill('#bs-q', 'ความกลัว กังวล')
await p.getByRole('button', { name: '🔎 ค้นหา', exact: true }).click(); await p.waitForSelector('.bs__card .bs__text', { timeout: 60000 })
await p.locator('.bs__card').nth(0).getByRole('button', { name: /แชร์/ }).click(); await p.waitForSelector('.sv-text'); await p.getByRole('tab', { name: /แชร์เป็นภาพ/ }).click()
await p.setInputFiles('[aria-label="เลือกรูปพื้นหลัง"]', '/tmp/claude-0/zoomtest.png'); await p.waitForTimeout(500)
await p.getByRole('tab', { name: '📷 ภาพ' }).click(); await p.waitForSelector('#sv-zoom')
const shot = () => p.locator('.sv-canvas').evaluate((c) => c.toDataURL())
const set = async (v) => { await p.locator('#sv-zoom').fill(String(v)); await p.waitForTimeout(450) }
const label = () => p.locator('.sv-zoom span').first().textContent()
// ภาพรอบต่าง ๆ
check(+(await p.inputValue('#sv-zoom')) === 0 && (await label()).includes('1×'), 'default: slider thumb is at the exact middle (0) and says 1×')
const w = await p.locator('#sv-zoom').boundingBox(); check(!!w && w.width > 200, 'slider is visible')
const base = await shot()
await set(-1); const out = await shot()
check((await label()).includes('0.5×') && out !== base, 'sliding left zooms OUT (0.5×) and the picture changes')
check(await p.locator('#sv-zoom-reset').count() === 1, 'a “กลับ 1×” button appears when not at 1×')
// ตรวจพิกเซลตรงกลางภาพ (ซ้าย/ขวาของกึ่งกลางคือแดง/น้ำเงิน) และมุมการ์ดไม่ว่าง
const px = (data, fx, fy) => p.evaluate(async ([d, x, y]) => { const i = new Image(); i.src = d; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); const q = g.getImageData(Math.floor(i.width * x), Math.floor(i.height * y), 1, 1).data; return [q[0], q[1], q[2], q[3]] }, [data, fx, fy])
const corner = await px(out, 0.02, 0.02); check(corner[3] === 255, 'zoomed-out: the card corner is still painted (blurred backdrop, no empty edge) ' + JSON.stringify(corner))
await set(1); const inn = await shot(); check((await label()).includes('3×') && inn !== base && inn !== out, 'sliding right zooms IN (3×)')
await set(0.02); check((await label()).includes('1×') && (await shot()) === base, 'releasing near the middle snaps back to exactly 1× (same picture as the start)')
// ซูมออก + เลื่อนซ้าย-ขวา
await set(-0.6); const o1 = await shot()
await p.locator('.sv-sl', { hasText: 'เลื่อนซ้าย-ขวา' }).locator('input').fill('1'); await p.waitForTimeout(450)
check((await shot()) !== o1, 'when zoomed out the picture can still be moved left/right')
await set(-0.6); await p.click('#sv-zoom-reset'); await p.waitForTimeout(450)
check((await label()).includes('1×') && await p.locator('#sv-zoom-reset').count() === 0, '“กลับ 1×” resets the zoom')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await p.locator('.sv-sl', { hasText: 'เลื่อนซ้าย-ขวา' }).locator('input').fill('0'); await set(-0.6); await p.locator('.sv-tools').scrollIntoViewIfNeeded(); await p.screenshot({ path: '/tmp/claude-0/zoom.png' })
await b.close(); console.log(fail ? 'FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
