// ท่องจำคัมภีร์: ปุ่ม ✏️ แก้ไขในการ์ดข้อพระคัมภีร์ (อยู่ด้านขวา) — เปลี่ยนข้อ/บท · แก้ข้อความ · ย้ายหมวด · ยกเลิก
import { chromium } from 'playwright'
import { cardsOpenByDefault } from './_cards-open.mjs'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
cardsOpenByDefault(b)
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
await p.goto(URL + '#/notebook/1'); await p.waitForSelector('#nb-catsel')
const addCat = async (n) => { await p.fill('[aria-label="ชื่อหมวดใหม่"]', n); await p.getByRole('button', { name: '💾 บันทึกหมวด' }).click() }
await p.click('[aria-label="จัดการหมวด"]'); await addCat('ความรัก'); await addCat('ความเชื่อ'); await p.click('[aria-label="จัดการหมวด"]')
await p.click('[aria-label="เปิดหมวด ความรัก"]'); await p.waitForSelector('#bp-book')
await p.fill('#bp-book', 'ยอห์น'); await p.click('.bp__hits >> text=ยอห์น'); await p.selectOption('#bp-ch', '3'); await p.click('[aria-label="ข้อ 16"]')
await p.waitForFunction(() => document.querySelectorAll('.sm-verses li').length === 1); await p.click('text=💾 บันทึกข้อนี้'); await p.waitForSelector('.sm-item')
const card = p.locator('.sm-item').first()
const eb = await card.locator('[aria-label^="แก้ไข"]').boundingBox(); const cb = await card.boundingBox()
check(!!eb && eb.x > cb.x + cb.width * 0.7, `✏️ edit button sits on the right side of the card (x=${Math.round(eb?.x)} of ${Math.round(cb.x + cb.width)})`)
await card.locator('[aria-label^="แก้ไข"]').click(); await p.waitForSelector('#sm-edit-save')
check(await p.locator('[aria-label="ข้อ 16"][aria-pressed=true]').count() === 1 && (await p.inputValue('#bp-book-edit')) === 'ยอห์น' && (await p.inputValue('#bp-ch-edit')) === '3', 'edit mode opens with the current book / chapter / verse already selected')
check(await p.locator('[aria-label="ข้อความข้อ 16"]').count() === 1 && (await p.inputValue('[aria-label="ข้อความข้อ 16"]')).includes('พระเจ้าทรงรักโลก'), 'verse text shown in an editable box')
// เพิ่มข้อ 17 + แก้ข้อความข้อ 16 เอง
await p.click('[aria-label="ข้อ 17"]'); await p.waitForSelector('[aria-label="ข้อความข้อ 17"]')
check(await p.locator('.sm-edit__row').count() === 2, 'selecting verse 17 adds its text row (1971)')
await p.fill('[aria-label="ข้อความข้อ 16"]', 'ข้อความที่แก้เอง ข้อสิบหก')
await p.click('#sm-edit-save'); await p.waitForSelector('.sm-item:not(.sm-item--edit)')
const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('khatha.notebook1.v1') || '[]').filter((x) => !x.deleted))
check(stored.length === 1 && stored[0].title === 'ยอห์น 3:16–17' && stored[0].text.startsWith('16\tข้อความที่แก้เอง ข้อสิบหก\n17\t'), 'saved: title → ยอห์น 3:16–17 and the manually edited text kept: ' + stored[0]?.title)
check((await p.locator('.sm-item').first().textContent()).includes('ข้อความที่แก้เอง'), 'card shows the edited text')
// ยกเลิก
await p.locator('.sm-item').first().locator('[aria-label^="แก้ไข"]').click(); await p.waitForSelector('#sm-edit-cancel'); await p.fill('[aria-label="ข้อความข้อ 16"]', 'จะไม่ถูกบันทึก'); await p.click('#sm-edit-cancel')
check(!(await p.locator('.sm-item').first().textContent()).includes('จะไม่ถูกบันทึก'), 'cancel discards the changes')
// ย้ายหมวด
await p.locator('.sm-item').first().locator('[aria-label^="แก้ไข"]').click(); await p.waitForSelector('#sm-edit-save')
await p.selectOption('[aria-label="ย้ายไปหมวด"]', 'ความเชื่อ'); await p.click('#sm-edit-save'); await p.waitForTimeout(300)
check(await p.locator('.sm-item').count() === 0 && (await p.textContent('.nb-sync--ok')).includes('ความเชื่อ'), 'moving to another category removes it here and confirms')
await p.click('[aria-label="กลับไปหมวดทั้งหมด"]'); await p.click('[aria-label="เปิดหมวด ความเชื่อ"]'); await p.waitForSelector('.sm-item')
check((await p.locator('.sm-item').first().textContent()).includes('ยอห์น 3:16–17'), 'the card now lives in ความเชื่อ')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? 'FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
