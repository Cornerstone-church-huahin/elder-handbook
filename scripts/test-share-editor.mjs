// แชร์เป็นภาพ: ลาก/ย่อขยายข้อความและโลโก้บนภาพ · แถบจัดวาง · ปรับโลโก้/ความคมชัด · ย้อนกลับทีละหน้าโดยไม่ออกจากหน้าต่าง · เปลี่ยนรูปได้ทุกหน้า · จำรูปไว้ตอนปิด-เปิด
import { chromium } from 'playwright'
import fs from 'node:fs'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: false })
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
const photo = (c1, c2) => p.evaluate(([a, b2]) => { const c = document.createElement('canvas'); c.width = 900; c.height = 700; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 900, 700); g.addColorStop(0, a); g.addColorStop(1, b2); x.fillStyle = g; x.fillRect(0, 0, 900, 700); x.fillStyle = '#fff'; for (let i = 0; i < 40; i++) x.fillRect((i * 97) % 900, (i * 53) % 700, 30, 30); return c.toDataURL('image/png') }, [c1, c2])
fs.writeFileSync('/tmp/claude-0/ed1.png', Buffer.from((await (async () => { await p.goto('about:blank'); return photo('#2b5876', '#f6a96b') })()).split(',')[1], 'base64'))
fs.writeFileSync('/tmp/claude-0/ed2.png', Buffer.from((await photo('#4e4376', '#2b5876')).split(',')[1], 'base64'))
await p.goto(URL + '#/notebook/1'); await p.waitForSelector('#nb-catsel')
await p.click('.sm-tab >> text=ค้นหาข้อพระคัมภีร์'); await p.fill('#bs-q', 'ความกลัว กังวล')
await p.getByRole('button', { name: '🔎 ค้นหา', exact: true }).click(); await p.waitForSelector('.bs__card .bs__text', { timeout: 60000 })
const openShare = async (i) => { await p.locator('.bs__card').nth(i).getByRole('button', { name: /แชร์/ }).click(); await p.waitForSelector('.sv-text'); await p.getByRole('tab', { name: /แชร์เป็นภาพ/ }).click(); await p.waitForSelector('.sv-canvas') }
const settle = () => p.waitForTimeout(450)
const boxes = () => p.locator('.sv-canvas').evaluate((c) => JSON.parse(c.dataset.boxes || 'null'))
const prefs = () => p.evaluate(() => JSON.parse(localStorage.getItem('khatha.share.v2') || '{}').style || {})
const url0 = await p.evaluate(() => location.hash)
await openShare(0)
await p.setInputFiles('[aria-label="เลือกรูปพื้นหลัง"]', '/tmp/claude-0/ed1.png'); await settle()
const cv = p.locator('.sv-canvas'); const rect = await cv.boundingBox()
const at = (lx, ly) => ({ x: rect.x + (lx / 1080) * rect.width, y: rect.y + (ly / 1350) * rect.height })
let bx = await boxes(); check(!!bx?.text && !!bx?.logo, 'canvas reports the text and logo boxes for hit-testing')

let st = await prefs()
// ---- ย่อขยายด้วยมุมทอง ----
await p.mouse.move(at(540, 40).x, at(540, 40).y); await p.mouse.down(); await p.mouse.up(); await settle() // เลือกข้อความก่อน
const tb0 = await boxes(); const tt = at(tb0.text.x + tb0.text.w / 2, tb0.text.y + tb0.text.h / 2); await p.mouse.click(tt.x, tt.y); await settle()
bx = await boxes(); const corner = at(bx.text.x + bx.text.w, bx.text.y + bx.text.h)
st = await prefs(); const s0 = st.textScale
await p.mouse.move(corner.x, corner.y); await p.mouse.down(); await p.mouse.move(corner.x + 50, corner.y + 60, { steps: 6 }); await p.mouse.up(); await settle()
st = await prefs(); check(st.textScale > s0 * 1.1, `dragging the gold corner enlarges the text frame (${s0.toFixed(2)} → ${st.textScale.toFixed(2)})`)
bx = await boxes(); const c2 = at(Math.min(1080 - 50, bx.text.x + bx.text.w), Math.min(1350 - 50, bx.text.y + bx.text.h)); const s1 = st.textScale
await p.mouse.move(c2.x, c2.y); await p.mouse.down(); await p.mouse.move(c2.x - 80, c2.y - 90, { steps: 6 }); await p.mouse.up(); await settle()
st = await prefs(); check(st.textScale < s1 * 0.9, `dragging the corner inward shrinks it (${s1.toFixed(2)} → ${st.textScale.toFixed(2)})`)

// ---- ลากข้อความ ----
const t0 = at(bx.text.x + bx.text.w / 2, bx.text.y + bx.text.h / 2)
await p.mouse.move(t0.x, t0.y); await p.mouse.down(); await p.mouse.move(t0.x + 40, t0.y - 30, { steps: 6 }); await p.mouse.up(); await settle()
st = await prefs(); check(Math.abs(st.textX - 0.5) > 0.03 && Math.abs(st.textY - 0.47) > 0.03, `dragging the text moves it (textX ${st.textX?.toFixed(2)}, textY ${st.textY?.toFixed(2)})`)
// กรอบล้นการ์ด: มุมจับยังจับได้ (ถูกขยับเข้ามาในการ์ด) แล้วย่อกลับได้
bx = await boxes(); const hx = Math.min(1080 - 50, bx.text.x + bx.text.w), hy = Math.min(1350 - 50, bx.text.y + bx.text.h); const hp = at(hx, hy); const sBig = (await prefs()).textScale
await p.mouse.move(hp.x, hp.y); await p.mouse.down(); await p.mouse.move(hp.x - 30, hp.y - 40, { steps: 5 }); await p.mouse.up(); await settle()
check((await prefs()).textScale < sBig, 'resize handle stays reachable even when the frame extends past the card')
// ---- ลากโลโก้ ----
bx = await boxes(); const l0 = at(bx.logo.x + bx.logo.w / 2, bx.logo.y + bx.logo.h / 2)
await p.mouse.move(l0.x, l0.y); await p.mouse.down(); await p.mouse.move(l0.x - 60, l0.y - 90, { steps: 6 }); await p.mouse.up(); await settle()
st = await prefs(); check(st.logoX < 0.45 && st.logoY < 0.8, `dragging the logo moves it freely (logoX ${st.logoX?.toFixed(2)}, logoY ${st.logoY?.toFixed(2)})`)
bx = await boxes(); const lc = at(bx.logo.x + bx.logo.w, bx.logo.y + bx.logo.h); const ls0 = st.logoScale
await p.mouse.move(lc.x, lc.y); await p.mouse.down(); await p.mouse.move(lc.x + 40, lc.y + 40, { steps: 6 }); await p.mouse.up(); await settle()
st = await prefs(); check(st.logoScale > ls0 * 1.1, `logo can be enlarged by its corner (${ls0.toFixed(2)} → ${st.logoScale.toFixed(2)})`)

// ---- แถบจัดวาง + ปรับโลโก้/ความคมชัด ----
await p.getByRole('tab', { name: '✋ จัดวาง' }).click(); check(await p.locator('.sv-tools .sv-sl').count() === 6, 'layout tab: X/Y/size sliders for text and logo')
await p.click('#sv-reset-layout'); await settle(); st = await prefs(); check(st.textX === 0.5 && st.logoY === 0.86 && st.textScale === 1, 'reset layout restores defaults')
await p.getByRole('tab', { name: '📷 ภาพ' }).click(); check(await p.getByText('ความคมชัด', { exact: false }).count() >= 1, 'photo tab has a sharpness slider')
let before = await cv.evaluate((c) => c.toDataURL())
await p.locator('.sv-sl', { hasText: 'ความคมชัด' }).locator('input').fill('80'); await settle()
check((await cv.evaluate((c) => c.toDataURL())) !== before && (await prefs()).sharpness === 80, 'photo sharpness changes the image')
await p.getByRole('tab', { name: '🏷️ โลโก้' }).click()
const labels = await p.locator('.sv-tools .sv-sl span').allTextContents()
check(['ความสว่าง', 'สี', 'ความคมชัด', 'ขนาดโลโก้'].every((l) => labels.some((x) => x.includes(l))), 'logo tab: brightness / colour / sharpness / size sliders')
before = await cv.evaluate((c) => c.toDataURL()); await p.locator('.sv-sl', { hasText: 'ความสว่าง' }).locator('input').fill('50'); await settle()
check((await cv.evaluate((c) => c.toDataURL())) !== before, 'logo brightness changes the image')

// ---- เปลี่ยนรูปจากหน้าโลโก้ โดยไม่ออกจากหน้า ----
before = await cv.evaluate((c) => c.toDataURL())
await p.setInputFiles('[aria-label="เลือกรูปพื้นหลัง"]', '/tmp/claude-0/ed2.png'); await settle()
check((await cv.evaluate((c) => c.toDataURL())) !== before && await p.getByRole('tab', { name: '🏷️ โลโก้', selected: true }).count() === 1, 'swap the photo while on the logo tab (stays on that tab, edits kept)')
check((await prefs()).sharpness === 80 && (await p.locator('.sv-swap').textContent()).includes('เปลี่ยนรูป'), 'other settings are kept after swapping the photo')

// ---- ย้อนกลับทีละหน้า (ปุ่มย้อนกลับของเครื่อง) ----
const sel = () => p.locator('[role=tab][aria-selected=true]').allTextContents()
await p.goBack(); await p.waitForTimeout(200); check((await sel()).some((t) => t.includes('สี')) && await p.locator('.sv-canvas').count() === 1, 'device Back: logo → colour step (not leaving)')
await p.goBack(); await p.waitForTimeout(200); await p.goBack(); await p.waitForTimeout(200); await p.goBack(); await p.waitForTimeout(200)
check((await sel()).some((t) => t.includes('ภาพ') && !t.includes('แชร์เป็นภาพ')), 'device Back keeps stepping back to the photo step')
await p.goBack(); await p.waitForTimeout(200); check(await p.locator('.sv-text').count() === 1 && await p.locator('.sv-canvas').count() === 0, 'Back from the first step → text share page (still inside the sheet)')
await p.goBack(); await p.waitForTimeout(300); check(await p.locator('.sv-modal').count() === 0 && (await p.evaluate(() => location.hash)) === url0, 'Back again closes the sheet and stays on the same page: ' + await p.evaluate(() => location.hash))

// ---- ปิดแล้วเปิดข้ออื่น: รูปที่เลือกไว้ยังอยู่ ----
await openShare(1); await settle()
check((await p.locator('.sv-swap').textContent()).includes('เปลี่ยนรูป'), 'photo is remembered when opening another verse')
// ปุ่มถัดไป/ย้อนกลับ
await p.locator('.sv-actions [aria-label="ถัดไป"]').click(); await p.locator('.sv-actions [aria-label="ถัดไป"]').click(); await p.locator('.sv-actions [aria-label="ย้อนกลับ"]').click()
check((await sel()).some((t) => t.includes('สไตล์')) || (await sel()).some((t) => t.includes('จัดวาง')), 'on-screen ◀ ▶ buttons step between pages')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? 'FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
