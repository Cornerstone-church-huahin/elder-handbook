// แชร์เป็นภาพบนจอสัมผัส (จำลองนิ้วด้วย CDP touch): ลากข้อความ/โลโก้ด้วยนิ้ว · บีบนิ้วสองนิ้วย่อขยาย · พื้นหลังสำเร็จรูป 12 แบบ · ปุ่มรีเซ็ต
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
const cdp = await ctx.newCDPSession(p)
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ x: q.x, y: q.y, id: i })) })
const finger = async (from, to, steps = 8) => { await touch('touchStart', [from]); for (let i = 1; i <= steps; i++) { await touch('touchMove', [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }]); await p.waitForTimeout(16) } await touch('touchEnd', []) }
await p.goto(URL + '#/notebook/1'); await p.waitForSelector('#nb-catsel')
await p.tap('.sm-tab >> text=ค้นหาข้อพระคัมภีร์'); await p.fill('#bs-q', 'ความกลัว กังวล')
await p.getByRole('button', { name: '🔎 ค้นหา', exact: true }).tap(); await p.waitForSelector('.bs__card .bs__text', { timeout: 60000 })
await p.locator('.bs__card').first().getByRole('button', { name: /แชร์/ }).tap(); await p.waitForSelector('.sv-text')
await p.getByRole('tab', { name: /แชร์เป็นภาพ/ }).tap(); await p.waitForSelector('.sv-canvas')
const prefs = () => p.evaluate(() => JSON.parse(localStorage.getItem('khatha.share.v2') || '{}').style || {})
const settle = () => p.waitForTimeout(500)

// ---- พื้นหลังสำเร็จรูป ----
await p.waitForFunction(() => document.querySelectorAll('.sv-art img').length === 12, null, { timeout: 15000 })
check(await p.locator('.sv-art').count() === 12 && await p.locator('.sv-art img').count() === 12, 'first page: 12 built-in backgrounds with thumbnails')
const total = Number((await p.locator('.sv-h', { hasText: 'พื้นหลังสำเร็จรูป' }).textContent()).match(/(\d+) แบบ/)[1])
check(total >= 100, 'library has 100+ built-in backgrounds (' + total + ')')
for (let i = 0; i < 9; i++) await p.locator('#sv-more-arts').tap().catch(() => {})
await p.waitForFunction((n) => document.querySelectorAll('.sv-art').length === n, total, { timeout: 15000 })
await p.waitForFunction((n) => document.querySelectorAll('.sv-art img').length === n, total, { timeout: 20000 })
check(await p.locator('.sv-art img').count() === total, '"ดูเพิ่ม" reveals all ' + total + ' with thumbnails')
const thumbSrcs = await p.locator('.sv-art img').evaluateAll((els) => els.map((e) => e.src.length + e.src.slice(-60)))
check(new Set(thumbSrcs).size >= total - 2, 'thumbnails are all different (' + new Set(thumbSrcs).size + ')')
await p.getByRole('button', { name: 'ทะเลสงบ', exact: true }).tap(); await p.waitForTimeout(300)
check(await p.locator('.sv-art').count() === 8, 'category chip filters to one scene (8 variants)')
await p.getByRole('button', { name: /^ทั้งหมด/ }).tap()
const cvs = p.locator('.sv-canvas'); const before0 = await cvs.evaluate((c) => c.toDataURL())
await p.locator('[aria-label="พื้นหลัง รุ่งอรุณ · ดั้งเดิม"]').tap(); await settle()
const after = await cvs.evaluate((c) => c.toDataURL()); check(after !== before0, 'tapping a background changes the card')
const seen = new Set([after])
for (const id of ['อาทิตย์ตก+กางเขน · ดั้งเดิม', 'ดาวและพระจันทร์ · ดั้งเดิม', 'ทะเลสงบ · ดั้งเดิม', 'ลำแสงผ่านเมฆ · ดั้งเดิม', 'ป่าหมอก · ดั้งเดิม']) { await p.locator(`[aria-label="พื้นหลัง ${id}"]`).tap(); await settle(); seen.add(await cvs.evaluate((c) => c.toDataURL())) }
check(seen.size === 6, 'each background looks different (' + seen.size + '/6 distinct)')
check(await p.locator('#sv-reset-photo').count() === 1, 'photo tools appear after choosing a background')

// ---- นิ้วลากข้อความ ----
const rect = await cvs.boundingBox(); const boxes = async () => JSON.parse(await cvs.getAttribute('data-boxes'))
const at = (lx, ly) => ({ x: rect.x + (lx / 1080) * rect.width, y: rect.y + (ly / 1350) * rect.height })
let bx = await boxes(); const c0 = at(bx.text.x + bx.text.w / 2, bx.text.y + bx.text.h / 2)
await finger(c0, { x: c0.x + 30, y: c0.y - 40 }); await settle()
let st = await prefs(); check(Math.abs(st.textX - 0.5) > 0.03 || Math.abs(st.textY - 0.47) > 0.03, `finger drag moves the text (textX ${st.textX?.toFixed(2)}, textY ${st.textY?.toFixed(2)})`)
// ---- บีบนิ้ว (สองนิ้ว) ----
bx = await boxes(); const mid = at(bx.text.x + bx.text.w / 2, bx.text.y + bx.text.h / 2); const sc0 = st.textScale
await touch('touchStart', [{ x: mid.x - 20, y: mid.y }, { x: mid.x + 20, y: mid.y }])
for (let i = 1; i <= 8; i++) { await touch('touchMove', [{ x: mid.x - 20 - i * 6, y: mid.y }, { x: mid.x + 20 + i * 6, y: mid.y }]); await p.waitForTimeout(16) }
await touch('touchEnd', []); await settle()
st = await prefs(); check(st.textScale > sc0 * 1.15, `pinch-out with two fingers enlarges the text frame (${sc0.toFixed(2)} → ${st.textScale.toFixed(2)})`)
bx = await boxes(); const mid2 = at(bx.text.x + bx.text.w / 2, bx.text.y + bx.text.h / 2); const sc1 = st.textScale;
await touch('touchStart', [{ x: mid2.x - 80, y: mid2.y }, { x: mid2.x + 80, y: mid2.y }])
for (let i = 1; i <= 8; i++) { await touch('touchMove', [{ x: mid2.x - 80 + i * 7, y: mid2.y }, { x: mid2.x + 80 - i * 7, y: mid2.y }]); await p.waitForTimeout(16) }
await touch('touchEnd', []); await settle()
st = await prefs(); check(st.textScale < sc1 * 0.85, `pinch-in shrinks it (${sc1.toFixed(2)} → ${st.textScale.toFixed(2)})`)
// ---- นิ้วลากโลโก้ + บีบ ----
const scroll0 = await p.evaluate(() => document.querySelector('.sv-card').scrollTop)
bx = await boxes(); const l0 = at(bx.logo.x + bx.logo.w / 2, bx.logo.y + bx.logo.h / 2)
await finger(l0, { x: l0.x - 40, y: l0.y - 80 }); await settle()
st = await prefs(); check(st.logoX < 0.46 && st.logoY < 0.8, `finger drag moves the logo (logoX ${st.logoX?.toFixed(2)}, logoY ${st.logoY?.toFixed(2)})`)
bx = await boxes(); const lm = at(bx.logo.x + bx.logo.w / 2, bx.logo.y + bx.logo.h / 2); const ls0 = st.logoScale
await touch('touchStart', [{ x: lm.x - 10, y: lm.y }, { x: lm.x + 10, y: lm.y }])
for (let i = 1; i <= 8; i++) { await touch('touchMove', [{ x: lm.x - 10 - i * 6, y: lm.y }, { x: lm.x + 10 + i * 6, y: lm.y }]); await p.waitForTimeout(16) }
await touch('touchEnd', []); await settle()
st = await prefs(); check(st.logoScale > ls0 * 1.3, `pinch enlarges the logo (${ls0.toFixed(2)} → ${st.logoScale.toFixed(2)})`)
check(Math.abs((await p.evaluate(() => document.querySelector('.sv-card').scrollTop)) - scroll0) < 3, 'dragging / pinching on the preview does not scroll the sheet')

// ---- รีเซ็ต ----
await p.getByRole('tab', { name: '📷 ภาพ' }).tap(); await p.locator('.sv-sl', { hasText: 'สว่าง' }).first().locator('input').fill('30'); await settle()
check((await prefs()).brightness === 30, 'brightness adjusted')
await p.locator('#sv-reset-photo').tap(); await settle(); check((await prefs()).brightness === 0, 'photo reset button restores photo adjustments')
await p.locator('.sv-reset').tap(); check(await p.locator('#sv-reset-all').count() === 1, 'reset-all asks for confirmation')
await p.locator('#sv-reset-all').tap(); await settle(); st = await prefs()
check(st.textX === 0.5 && st.textY === 0.47 && st.textScale === 1 && st.logoX === 0.5 && st.logoScale === 1 && st.preset === 'navy', 'reset-all restores layout, style and logo to defaults')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? 'FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
