// แถบเลื่อนในหน้าแชร์: ค่าบวก/ลบและแถบที่มีค่ากลาง → ลูกกลมเริ่มกลางแถบ ไม่มีสีเติมตอนอยู่กลาง เติมสีเฉพาะจากกลางถึงลูกกลม (+/−) · แถบที่เริ่มจากศูนย์ยังเริ่มจากซ้าย
import { chromium } from 'playwright'
import { cardsOpenByDefault } from './_cards-open.mjs'
import fs from 'node:fs'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
cardsOpenByDefault(b)
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
const png = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 600; c.height = 500; const x = c.getContext('2d'); x.fillStyle = '#446'; x.fillRect(0, 0, 600, 500); return c.toDataURL('image/png') })
fs.writeFileSync('/tmp/claude-0/sl.png', Buffer.from(png.split(',')[1], 'base64'))
await p.goto(URL + '#/notebook/1'); await p.waitForSelector('#nb-catsel')
await p.click('.sm-tab >> text=ค้นหาข้อพระคัมภีร์'); await p.fill('#bs-q', 'ความกลัว กังวล')
await p.getByRole('button', { name: '🔎 ค้นหา', exact: true }).click(); await p.waitForSelector('.bs__card .bs__text', { timeout: 60000 })
await p.locator('.bs__card').nth(0).getByRole('button', { name: /แชร์/ }).click(); await p.waitForSelector('.sv-text'); await p.getByRole('tab', { name: /แชร์เป็นภาพ/ }).click()
await p.setInputFiles('[aria-label="เลือกรูปพื้นหลัง"]', '/tmp/claude-0/sl.png'); await p.waitForTimeout(500)
await p.getByRole('tab', { name: '📷 ภาพ' }).click()
const sl = (t, n = 0) => p.locator('.sv-sl', { hasText: t }).nth(n)
const rowAt = async (loc, frac) => { await loc.evaluate((el) => el.scrollIntoView({ block: 'center' })); await p.waitForTimeout(120); const buf = await loc.locator('input').screenshot(); const d = 'data:image/png;base64,' + buf.toString('base64'); return p.evaluate(async ([u, f]) => { const i = new Image(); i.src = u; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); const q = g.getImageData(Math.round(i.width * f), Math.round(i.height / 2), 1, 1).data; return [q[0], q[1], q[2]] }, [d, frac]) }
const gold = ([r, g, b]) => r > 180 && g > 140 && b < 110, grey = ([r, g, b]) => Math.abs(r - 217) < 14 && Math.abs(g - 214) < 14 && Math.abs(b - 205) < 14
const label = (loc) => loc.locator('b').textContent()
// ค่าบวก/ลบ: สว่าง −50..50
const br = sl('สว่าง'); await br.scrollIntoViewIfNeeded()
check((await br.locator('input').getAttribute('class')).includes('sv-center') && +(await br.locator('input').inputValue()) === 0 && (await label(br)) === '0', 'brightness: thumb in the middle at 0, no sign')
check(grey(await rowAt(br, 0.2)) && grey(await rowAt(br, 0.8)), 'brightness at 0: no fill on either side')
await br.locator('input').fill('30'); await p.waitForTimeout(300)
check((await label(br)) === '+30' && gold(await rowAt(br, 0.6)) && grey(await rowAt(br, 0.2)), 'brightness +30: shows “+30”, filled only from the centre to the thumb')
await br.locator('input').fill('-20'); await p.waitForTimeout(300)
check((await label(br)) === '−20' && gold(await rowAt(br, 0.4)) && grey(await rowAt(br, 0.8)), 'brightness −20: shows “−20”, filled only between the thumb and the centre')
await br.locator('input').fill('0')
// แถบเริ่มจากศูนย์จริง: ยังเริ่มจากซ้าย
check(!(await sl('ความคมชัด').locator('input').getAttribute('class')) && !(await sl('เบลอ').locator('input').getAttribute('class')), 'sharpness / blur (start from 0) keep the normal left-start slider')
// แถบเลื่อนตำแหน่งรูป ±
const px = sl('เลื่อนซ้าย-ขวา'); check((await px.locator('input').getAttribute('class')).includes('sv-center') && (await label(px)) === '0', 'photo pan sliders are centre-origin too')
// แท็บจัดวาง: ตำแหน่ง 0..1 (กลาง 0.5) และขนาด (กลาง 1×)
await p.getByRole('tab', { name: '✋ จัดวาง' }).click()
const tx = p.locator('.sv-tools .sv-sl', { hasText: 'ซ้าย–ขวา' }).first(); 
check((await tx.locator('input').getAttribute('class')).includes('sv-center') && +(await tx.locator('input').inputValue()) === 0.5 && grey(await rowAt(tx, 0.2)) && grey(await rowAt(tx, 0.8)), 'text position slider: centre = 0.5, no fill at the centre')
await tx.locator('input').fill('0.8'); await p.waitForTimeout(300); check(gold(await rowAt(tx, 0.7)) && grey(await rowAt(tx, 0.3)), 'moving right fills only from the centre')
const sz = p.locator('.sv-tools .sv-sl', { hasText: 'ขนาดกรอบ' }).first()
check(+(await sz.locator('input').inputValue()) === 0 && (await label(sz)) === '1×' && grey(await rowAt(sz, 0.2)) && grey(await rowAt(sz, 0.8)), 'size slider (0.3–2.5): 1× is exactly at the middle with no fill')
await sz.locator('input').fill('-1'); await p.waitForTimeout(300); check((await label(sz)) === '0.3×', 'sliding fully left = smallest (0.3×)')
await sz.locator('input').fill('1'); await p.waitForTimeout(300); check((await label(sz)) === '2.5×', 'sliding fully right = largest (2.5×)')
await sz.locator('input').fill('0.01'); await p.waitForTimeout(300); check((await label(sz)) === '1×', 'near the middle it snaps to 1×')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? 'FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
