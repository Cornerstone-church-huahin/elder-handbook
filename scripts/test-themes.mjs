// หน้าบุคคล: เลือกหัวข้อจากรายการ (ไม่เปลืองพื้นที่) · สร้างหัวข้อใหม่ เช่น "การรับใช้" · แก้ไข/ลบได้
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4173/'
const SHOT = process.env.SHOT
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage()
const errs = []; p.on('pageerror', (e) => errs.push(e.message))
await p.goto(URL + '#/people'); await p.waitForSelector('.theme-pick')
check(await p.locator('.theme-chips .chip').count() === 0, 'no long list of topic chips on the page')
await p.click('.theme-pick'); await p.waitForSelector('.sheet')
if (SHOT) await p.screenshot({ path: SHOT + '/t1.png' })
await p.click('.theme-item >> text=ความกลัว'); await p.waitForTimeout(200)
check((await p.textContent('.theme-pick')).includes('ความกลัว') && await p.locator('.acc__list .result:visible').count() > 0, 'pick built-in topic → filtered, lists open')
await p.click('.theme-pick'); await p.fill('.sheet__search', 'การรับใช้'); await p.click('text=สร้างหัวข้อใหม่')
await p.waitForSelector('#theme-name'); const auto = await p.locator('.theme-person input:checked').count()
check(auto > 0, 'new topic "การรับใช้" auto-suggests people: ' + auto)
await p.fill('.theme-new input[type=search]', 'รูธ'); await p.click('.theme-person >> text=รูธ')
if (SHOT) await p.screenshot({ path: SHOT + '/t2.png' })
await p.click('text=บันทึกหัวข้อ'); await p.waitForTimeout(200)
check((await p.textContent('.theme-pick')).includes('การรับใช้') && (await p.textContent('.main')).includes('รูธ'), 'saved topic is selected and shows chosen people')
await p.reload(); await p.waitForSelector('.theme-pick'); await p.click('.theme-pick')
check((await p.textContent('.sheet')).includes('หัวข้อของฉัน') && (await p.textContent('.sheet')).includes('การรับใช้'), 'custom topic kept and listed under "หัวข้อของฉัน"')
await p.click('[aria-label="ลบ การรับใช้"]'); await p.click('.mini--danger')
check(!(await p.textContent('.sheet')).includes('การรับใช้'), 'custom topic can be deleted')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? `${fail} FAILED` : 'ALL PASSED'); process.exit(fail ? 1 : 0)
