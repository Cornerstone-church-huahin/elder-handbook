// ท่องจำคัมภีร์: เลือกหมวดก่อนบันทึก (ตั้งต้น = หมวดที่เปิดอยู่ · เปลี่ยนได้ทั้งแบบเลือกจากพระคัมภีร์และแบบเขียนเอง)
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
await p.goto(URL + '#/notebook/1'); await p.waitForSelector('#nb-catsel')
await p.click('[aria-label="จัดการหมวด"]')
for (const n of ['การขอ', 'ความหวัง']) { await p.fill('[aria-label="ชื่อหมวดใหม่"]', n); await p.getByRole('button', { name: '💾 บันทึกหมวด' }).click() }
await p.click('[aria-label="จัดการหมวด"]')
await p.click('[aria-label="เปิดหมวด การขอ"]'); await p.waitForSelector('#bp-book')
const pick = async (book, ch, v) => { await p.fill('#bp-book', book); await p.click(`.bp__hits >> text=${book}`); await p.selectOption('#bp-ch', String(ch)); await p.click(`[aria-label="ข้อ ${v}"]`); await p.waitForFunction(() => document.querySelectorAll('.sm-verses li').length >= 1) }
await pick('สดุดี', 127, 2)
check(await p.inputValue('#sm-savecat') === 'การขอ', 'category selector defaults to the open category')
const sb = await p.locator('#sm-savecat').boundingBox(), bb = await p.getByRole('button', { name: '💾 บันทึกข้อนี้' }).boundingBox()
check(sb.y < bb.y, 'selector sits above the save button')
await p.selectOption('#sm-savecat', 'ความหวัง'); await p.click('text=💾 บันทึกข้อนี้'); await p.waitForTimeout(300)
check(await p.locator('.sm-item').count() === 0 && (await p.textContent('.nb-sync--ok')).includes('ความหวัง'), 'saved into the other category (not shown here) with a confirmation')
// เปิดหมวดความหวัง → เห็นข้อ
await p.click('[aria-label="กลับไปหมวดทั้งหมด"]'); await p.click('[aria-label="เปิดหมวด ความหวัง"]'); await p.waitForSelector('.sm-item')
check((await p.textContent('.sm-item')).includes('สดุดี 127:2'), 'the verse is in the chosen category')
// แบบเขียนเอง → ไปหมวดการขอ
await p.click('#sm-custom-toggle'); check(await p.inputValue('#sm-savecat') === 'ความหวัง', 'custom form also has the selector')
await p.selectOption('#sm-savecat', 'การขอ'); await p.fill('#sm-custom-label', 'ทดสอบ'); await p.fill('#sm-custom-text', 'ข้อความ'); await p.click('#sm-custom-save'); await p.waitForTimeout(300)
await p.click('[aria-label="กลับไปหมวดทั้งหมด"]'); await p.click('[aria-label="เปิดหมวด การขอ"]'); await p.waitForSelector('.sm-item')
check((await p.textContent('.sm-item')).includes('ทดสอบ'), 'hand-written verse went to the chosen category')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? 'FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
