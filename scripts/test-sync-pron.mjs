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
await A.goto(URL + '#/settings'); await A.waitForSelector('#pron-word')
await A.fill('#pron-word', 'อับราฮัม'); await A.fill('#pron-say', 'อับ-รา-ฮำ'); await A.click('.pron-add >> text=＋ เพิ่ม'); await A.waitForTimeout(1500)
check(dec('pronounce.json')?.items.some((x) => x.word === 'อับราฮัม' && x.by === 'เจ็ท'), 'pronunciation fix goes online (pronounce.json)')
const B = await device('ปิ่น')
await B.goto(URL + '#/'); await B.waitForTimeout(2500)
const fixed = await B.evaluate(() => localStorage.getItem('khatha.pronounce.v1') ?? '')
check(fixed.includes('อับ-รา-ฮำ'), 'wife phone receives the fix automatically (any page)')
await B.goto(URL + '#/settings'); await B.waitForSelector('.pron-list li')
await B.locator('.pron-list li').first().locator('[aria-label^="ลบ"]').click(); await B.waitForTimeout(1500)
check(!dec('pronounce.json').items.some((x) => x.word === 'อับราฮัม' && !x.deleted), 'wife can edit/delete too (synced)')
check(A.errs.length + B.errs.length === 0, 'no JS errors ' + [...A.errs, ...B.errs].join(';'))
await b.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
