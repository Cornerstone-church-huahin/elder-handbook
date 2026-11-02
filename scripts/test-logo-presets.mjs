// โลโก้ต้นแบบ: ปรับพอดีวง (ซูม/เลื่อน/เต็มวง) · บันทึกหลายอัน พร้อมตำแหน่ง · แตะแล้วกลับมาครบ · อัปเดต/ลบ · จำไว้หลังปิดแอป
import { chromium } from 'playwright'
import { cardsOpenByDefault } from './_cards-open.mjs'
import fs from 'node:fs'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
cardsOpenByDefault(b)
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
const mk = async (name, w, h, color) => { await p.goto('about:blank'); const d = await p.evaluate(([w2, h2, c]) => { const cv = document.createElement('canvas'); cv.width = w2; cv.height = h2; const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w2, h2); x.fillStyle = c; x.beginPath(); x.arc(w2 / 2, h2 / 2, Math.min(w2, h2) * 0.34, 0, 7); x.fill(); x.fillStyle = '#fff'; x.fillRect(w2 / 2 - 6, h2 * 0.3, 12, h2 * 0.4); return cv.toDataURL('image/png') }, [w, h, color]); fs.writeFileSync(`/tmp/claude-0/${name}.png`, Buffer.from(d.split(',')[1], 'base64')) }
await mk('logoA', 300, 300, '#7b4a1e'); await mk('logoB', 400, 200, '#1e5a7b')
const open = async () => {
  await p.goto(URL + '#/notebook/1'); await p.waitForSelector('#nb-catsel')
  await p.click('.sm-tab >> text=ค้นหาข้อพระคัมภีร์'); await p.fill('#bs-q', 'ความกลัว กังวล'); await p.getByRole('button', { name: '🔎 ค้นหา', exact: true }).click(); await p.waitForSelector('.bs__card .bs__text', { timeout: 60000 })
  await p.locator('.bs__card').first().getByRole('button', { name: /แชร์/ }).click(); await p.waitForSelector('.sv-text')
  await p.getByRole('tab', { name: /แชร์เป็นภาพ/ }).click(); await p.waitForSelector('.sv-canvas'); await p.getByRole('tab', { name: '🏷️ โลโก้' }).click(); await p.waitForSelector('#sv-logo-new')
}
const prefs = () => p.evaluate(() => JSON.parse(localStorage.getItem('khatha.share.v2') || '{}').style || {})
const settle = () => p.waitForTimeout(400)
const ed = () => p.locator('.sv-logoed').evaluate((c) => c.toDataURL())
const tile = (n) => p.locator(`[aria-label="ใช้โลโก้ ${n}"]`)
await open()
check(await p.locator('.sv-logotile').count() === 1 && (await p.locator('.sv-logotile').first().textContent()).includes('มาตรฐาน'), 'library starts with the standard logo tile')
// ---- เพิ่มโลโก้ใหม่ + ปรับพอดีวง ----
await p.setInputFiles('[aria-label="เลือกรูปโลโก้"]', '/tmp/claude-0/logoA.png'); await settle()
let before = await ed()
await p.locator('.sv-sl', { hasText: 'ซูมรูปในวง' }).locator('input').fill('1.4'); await settle()
check((await ed()) !== before && (await prefs()).logoZoom === 1.4, 'zoom slider zooms the logo inside the circle (1.4×)')
before = await ed()
await p.locator('.sv-logoed').evaluate((c) => { const card = c.closest('.sv-card'); const r = c.getBoundingClientRect(); const sticky = document.querySelector('.sv-sticky').getBoundingClientRect(); card.scrollTop += r.top - sticky.bottom - 20 }); await settle()
const eb = await p.locator('.sv-logoed').boundingBox()
check(await p.evaluate(([x, y]) => document.elementFromPoint(x, y)?.classList.contains('sv-logoed'), [eb.x + eb.width / 2, eb.y + eb.height / 2]), 'the logo editor is on screen and not covered')
await p.mouse.move(eb.x + eb.width / 2, eb.y + eb.height / 2); await p.mouse.down(); await p.mouse.move(eb.x + eb.width / 2 + 30, eb.y + eb.height / 2 - 20, { steps: 6 }); await p.mouse.up(); await settle()
const st1 = await prefs(); check(Math.abs(st1.logoOX) > 0.05 && Math.abs(st1.logoOY) > 0.05 && (await ed()) !== before, `dragging the logo in the editor pans it (ox ${st1.logoOX?.toFixed(2)}, oy ${st1.logoOY?.toFixed(2)})`)
await p.click('#sv-logo-fit'); await settle(); const st2 = await prefs(); check(st2.logoZoom === 1 && st2.logoOX === 0 && st2.logoOY === 0, '"พอดีรูป" resets zoom and pan')
await p.locator('.sv-sl', { hasText: 'ซูมรูปในวง' }).locator('input').fill('1.4')
await p.getByRole('button', { name: 'โปร่งใส' }).click(); await p.getByRole('button', { name: '▢ มุมมน' }).click(); await settle()
const st3 = await prefs(); check(st3.logoBg === 'transparent' && st3.logoShape === 'rounded', 'shape and background options work')
await p.getByRole('button', { name: '⭕ วงกลม' }).click(); await p.getByRole('button', { name: 'พื้นขาว' }).click()
// ---- บันทึกเป็นต้นแบบ A (ซ้ายบน) ----
await p.locator('[aria-label="วางโลโก้ ซ้ายบน"]').click(); await p.fill('#sv-logo-name', 'โลโก้ A'); await p.click('#sv-logo-save-new'); await p.waitForSelector('[aria-label="ใช้โลโก้ โลโก้ A"]')
check(await p.locator('.sv-logotile').count() === 2, 'saved as preset "โลโก้ A" (shows in the library)')
// ---- ต้นแบบ B (โลโก้อีกแบบ ขวาล่าง) ----
await p.setInputFiles('[aria-label="เลือกรูปโลโก้"]', '/tmp/claude-0/logoB.png'); await settle()
await p.click('#sv-logo-fill'); await settle(); const stB = await prefs(); check(Math.abs(stB.logoZoom - 2) < 0.02, `"ขยายเต็มวง" fills the circle for a wide logo (zoom ${stB.logoZoom})`)
await p.locator('[aria-label="วางโลโก้ ขวาล่าง"]').click(); await p.locator('.sv-sl', { hasText: 'ขนาดโลโก้บนการ์ด' }).locator('input').fill('1.5'); await p.fill('#sv-logo-name', 'โลโก้ B'); await p.click('#sv-logo-save-new'); await p.waitForSelector('[aria-label="ใช้โลโก้ โลโก้ B"]')
check(await p.locator('.sv-logotile').count() === 3, 'second preset "โลโก้ B" saved')
// ---- แตะเลือก: ทุกอย่างกลับมา ----
await tile('โลโก้ A').click(); await settle(); let s = await prefs()
check(s.logoZoom === 1.4 && Math.abs(s.logoX - 0.14) < 0.001 && Math.abs(s.logoY - 0.09) < 0.001 && s.logoScale === 1, `tap A → its fit and its saved top-left position return (x ${s.logoX}, y ${s.logoY}, zoom ${s.logoZoom})`)
let bx = JSON.parse(await p.locator('.sv-canvas').getAttribute('data-boxes')); check(bx.logo && Math.abs(bx.logo.x + bx.logo.w / 2 - 0.14 * 1080) < 30, 'the card preview shows the logo at that saved spot')
await tile('โลโก้ B').click(); await settle(); s = await prefs()
check(Math.abs(s.logoZoom - 2) < 0.02 && Math.abs(s.logoX - 0.86) < 0.001 && Math.abs(s.logoY - 0.91) < 0.001 && s.logoScale === 1.5, `tap B → bottom-right position and 1.5× size return (x ${s.logoX}, y ${s.logoY}, size ${s.logoScale})`)
// ยังเลื่อนเองได้ (ค่าเริ่มต้นคือที่บันทึกไว้ แต่ลากได้)
await p.getByRole('tab', { name: '✋ จัดวาง' }).click(); await p.locator('.sv-tools .sv-sl', { hasText: 'ซ้าย–ขวา' }).nth(1).locator('input').fill('0.3'); await settle(); check((await prefs()).logoX === 0.3, 'the position can still be moved after choosing a preset')
await p.getByRole('tab', { name: '🏷️ โลโก้' }).click(); await tile('โลโก้ A').click(); await settle(); check(Math.abs((await prefs()).logoX - 0.14) < 0.001, 'choosing the preset again restores the saved default position')
// ---- อัปเดตต้นแบบ ----
await p.locator('.sv-sl', { hasText: 'ซูมรูปในวง' }).locator('input').fill('1.8'); await p.click('#sv-logo-save-upd'); await settle()
await tile('โลโก้ B').click(); await settle(); await tile('โลโก้ A').click(); await settle(); check((await prefs()).logoZoom === 1.8, 'update preset keeps the new fit (1.8×)')
// ---- จำไว้หลังปิดแอป ----
await p.reload(); await open(); check(await p.locator('.sv-logotile').count() === 3, 'presets survive reloading the app (stored on this device)')
await tile('โลโก้ B').click(); await settle(); check(Math.abs((await prefs()).logoX - 0.86) < 0.001, 'a reloaded preset still applies its position')
// ---- ลบ ----
await p.locator('[aria-label="ลบโลโก้ โลโก้ B"]').click(); await p.click('#sv-logo-del-yes'); await p.waitForFunction(() => document.querySelectorAll('.sv-logotile').length === 2)
check(await p.locator('[aria-label="ใช้โลโก้ โลโก้ B"]').count() === 0, 'delete preset (with confirmation)')
await tile('มาตรฐาน').click(); await settle(); s = await prefs(); check(s.logoX === 0.5 && s.logoY === 0.86 && s.logoZoom === 1, 'standard tile restores the default logo and position')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? 'FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
