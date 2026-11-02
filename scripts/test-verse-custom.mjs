// ท่องจำคัมภีร์: ✍️ เขียนเอง — พิมพ์/วางข้ออ้างอิงและข้อความเอง · ใช้ข้อที่เลือกเป็นต้นแบบแล้วแก้ · การ์ดที่ได้แก้ไข/ตีความ/ฟังได้ปกติ
import { chromium } from 'playwright'
import { cardsOpenByDefault } from './_cards-open.mjs'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
cardsOpenByDefault(b)
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
await p.goto(URL + '#/notebook/1'); await p.waitForSelector('#nb-catsel')
await p.click('[aria-label="จัดการหมวด"]'); await p.fill('[aria-label="ชื่อหมวดใหม่"]', 'ทดสอบ'); await p.getByRole('button', { name: '💾 บันทึกหมวด' }).click(); await p.click('[aria-label="จัดการหมวด"]')
await p.click('[aria-label="เปิดหมวด ทดสอบ"]'); await p.waitForSelector('#bp-book')
check(await p.locator('#sm-custom-label').count() === 0, 'custom form hidden by default')
await p.click('#sm-custom-toggle'); await p.waitForSelector('#sm-custom-label')
check(await p.locator('#sm-custom-save').isDisabled(), 'save disabled while empty')
// 1) พิมพ์เองทั้งหมด (ข้ออ้างอิงที่อ่านออก → เลขข้อถูกต้อง)
await p.fill('#sm-custom-label', 'สดุดี 127:1'); await p.fill('#sm-custom-text', 'ถ้าพระยาห์เวห์มิได้ทรงสร้างบ้าน บรรดาผู้ที่สร้างก็เหนื่อยเปล่า')
await p.click('#sm-custom-save'); await p.waitForSelector('.sm-item')
check((await p.textContent('.sm-item .sm-item__body')).includes('พระยาห์เวห์') && (await p.textContent('.sm-item .sm-item__body')).includes('สดุดี 127:1'), 'a verse typed by hand is saved with exactly the typed wording')
check(await p.locator('#sm-custom-label').count() === 0, 'form closes after saving')
// 2) หัวข้อที่ไม่ใช่ข้ออ้างอิง หลายบรรทัด
await p.click('#sm-custom-toggle'); await p.fill('#sm-custom-label', 'คำสอนของผู้ปกครอง'); await p.fill('#sm-custom-text', 'บรรทัดหนึ่ง\nบรรทัดสอง')
await p.click('#sm-custom-save'); await p.waitForFunction(() => document.querySelectorAll('.sm-item').length === 2)
const t2 = await p.locator('.sm-item').nth(1).locator('.sm-item__body').textContent()
check(t2.includes('คำสอนของผู้ปกครอง') && t2.includes('บรรทัดหนึ่ง') && t2.includes('บรรทัดสอง'), 'free-form title + multi-line text saved')
// 3) ใช้ข้อที่เลือกเป็นต้นแบบ
await p.click('#sm-custom-toggle'); await p.fill('#bp-book', 'ยูดา'); await p.click('.bp__hits >> text=ยูดา'); await p.selectOption('#bp-ch', '1'); await p.click('[aria-label="ข้อ 1"]')
await p.waitForFunction(() => document.querySelectorAll('.sm-verses li').length === 1); await p.waitForSelector('#sm-custom-fill'); await p.click('#sm-custom-fill')
check((await p.inputValue('#sm-custom-label')).includes('ยูดา') && (await p.inputValue('#sm-custom-text')).length > 20, 'the selected passage can be copied in as a template to edit')
await p.fill('#sm-custom-text', 'แก้ข้อความเองตามพระคัมภีร์เล่มที่ใช้'); await p.click('#sm-custom-save'); await p.waitForFunction(() => document.querySelectorAll('.sm-item').length === 3)
check((await p.locator('.sm-item').nth(2).textContent()).includes('แก้ข้อความเองตามพระคัมภีร์เล่มที่ใช้'), 'edited template saved')
// 4) การ์ดเขียนเองใช้ฟังก์ชันอื่นได้ (ตีความ/แก้ไข)
await p.locator('.sm-item').nth(0).locator('[aria-label^="ตีความ"]').click(); await p.waitForSelector('.vi'); check(true, 'interpret panel opens on a hand-written card')
await p.locator('.sm-item').nth(1).locator('[aria-label^="แก้ไข"]').click(); await p.waitForSelector('#sm-edit-save'); check(await p.locator('textarea[aria-label^="ข้อความข้อ"]').count() >= 1, 'edit works on a free-form card')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? 'FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
