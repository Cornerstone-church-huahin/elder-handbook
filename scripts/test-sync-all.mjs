// ทุกการบันทึกขึ้นออนไลน์: หัวข้อ, หน้าที่ผู้ปกครอง, เนื้อหาบุคคล — เครื่อง A บันทึก เครื่อง B เห็น
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const TOKEN = 'github_pat_TEST'
const files = {}; const shas = {}
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,PUT', 'content-type': 'application/json' }
async function gh(route) {
  const r = route.request()
  if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
  if (r.headers()['authorization'] !== `Bearer ${TOKEN}`) return route.fulfill({ status: 401, headers: cors, body: '{}' })
  const url = new globalThis.URL(r.url())
  if (url.pathname.endsWith('/elder-handbook-data')) return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ private: true, permissions: { push: true } }) })
  const f = url.pathname.split('/contents/')[1]
  if (r.method() === 'GET') {
    if (!files[f]) return route.fulfill({ status: 404, headers: cors, body: '{}' })
    return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ content: files[f], encoding: 'base64', sha: String(shas[f]) }) })
  }
  const body = r.postDataJSON()
  if (files[f] && body.sha !== String(shas[f])) return route.fulfill({ status: 409, headers: cors, body: '{}' })
  files[f] = body.content; shas[f] = (shas[f] ?? 0) + 1
  return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ content: { sha: String(shas[f]) } }) })
}
const dec = (f) => files[f] ? JSON.parse(Buffer.from(files[f], 'base64').toString('utf8')) : null
const device = async (name) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.route('https://api.github.com/**', gh)
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message))
  await p.goto(URL + '#/settings'); await p.waitForSelector('#sync-token')
  await p.fill('#sync-name', name); await p.fill('#sync-token', TOKEN); await p.click('text=เชื่อมต่อและบันทึก')
  await p.waitForSelector('.ai-keys__ok'); return p
}
const A = await device('เจ็ท')
// เนื้อหาบุคคล
await A.goto(URL + '#/people/adam'); await A.waitForSelector('.ai-sec')
await A.click('text=✏️ แก้ไข / เพิ่มเติม'); const t = await A.inputValue('#teach-edit')
await A.fill('#teach-edit', t + '\n\n## จากเจ็ท\nการล่อลวงเริ่มจากการสงสัยพระวจนะ'); await A.click('text=💾 บันทึก'); await A.waitForTimeout(1500)
check(dec('people-edits.json')?.items.some((x) => x.id === 'adam:story' && x.by === 'เจ็ท'), 'person edit goes online (people-edits.json)')
// หน้าที่ผู้ปกครอง
await A.goto(URL + '#/'); await A.waitForTimeout(500); await A.click('[aria-label="ตั้งค่า"]'); await A.click('text=หน้าที่ผู้ปกครอง'); await A.waitForSelector('.duty')
await A.fill('#duty-new', 'โทรหาผู้ป่วยทุกวันจันทร์'); await A.click('text=＋ เพิ่ม'); await A.waitForTimeout(1500)
check(dec('duties.json')?.items.some((x) => x.text?.includes('โทรหาผู้ป่วย') || JSON.stringify(x).includes('โทรหาผู้ป่วย')), 'duty goes online (duties.json)')
// หัวข้อ
await A.goto(URL + '#/people'); await A.waitForSelector('.theme-pick'); await A.click('.theme-pick')
await A.fill('.sheet__search', 'การรับใช้'); await A.click('text=สร้างหัวข้อใหม่')
await A.fill('.theme-new input[type=search]', 'รูธ'); await A.click('.theme-person >> text=รูธ'); await A.click('text=บันทึกหัวข้อ'); await A.waitForTimeout(1500)
check(JSON.stringify(dec('themes.json') ?? {}).includes('การรับใช้'), 'custom topic goes online (themes.json)')

const B = await device('ปิ่น')
await B.goto(URL + '#/people/adam'); await B.waitForTimeout(2000)
check(await B.locator('.ai-sec').filter({ hasText: 'จากเจ็ท' }).count() === 1, 'wife device sees person edit')
check((await B.locator('.ai-explain .badge').first().textContent()).includes('เจ็ท'), 'shows who edited')
await B.goto(URL + '#/'); await B.waitForTimeout(500); await B.click('[aria-label="ตั้งค่า"]'); await B.click('text=หน้าที่ผู้ปกครอง'); await B.waitForTimeout(2000)
check(await B.locator('.duty').filter({ hasText: 'โทรหาผู้ป่วย' }).count() === 1, 'wife device sees new duty')
await B.goto(URL + '#/people'); await B.waitForTimeout(2000); await B.click('.theme-pick')
check(await B.locator('.sheet').filter({ hasText: 'การรับใช้' }).count() === 1, 'wife device sees custom topic')
check(A.errs.length + B.errs.length === 0, 'no JS errors ' + [...A.errs, ...B.errs].join(';'))
await b.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
