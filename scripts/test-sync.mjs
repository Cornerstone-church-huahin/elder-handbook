// ใช้ร่วมกันออนไลน์: 2 เครื่อง (ผู้ปกครองสามี-ภรรยา) ผ่าน GitHub API จำลอง (repo ส่วนตัว)
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const TOKEN = 'github_pat_TEST'
let file = null, sha = 0, puts = 0, forceConflict = false
const others = {}
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,PUT', 'content-type': 'application/json' }
async function gh(route) {
  const r = route.request()
  if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
  if (r.headers()['authorization'] !== `Bearer ${TOKEN}`) return route.fulfill({ status: 401, headers: cors, body: '{}' })
  const url = new globalThis.URL(r.url())
  if (url.pathname.endsWith('/elder-handbook-data')) return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ private: true, permissions: { push: true } }) })
  const path = url.pathname.split('/contents/')[1] ?? ''
  if (path !== 'prayers.json') { // ไฟล์อื่น (หัวข้อ/หน้าที่/คำอ่าน ฯลฯ) — แยกเก็บ ไม่ปนกับสมุดคำอธิษฐาน
    others[path] ??= { c: null, sha: 0 }
    const o = others[path]
    if (r.method() === 'GET') return o.c ? route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ content: o.c, encoding: 'base64', sha: String(o.sha) }) }) : route.fulfill({ status: 404, headers: cors, body: '{}' })
    const bd = r.postDataJSON(); if (o.c && bd.sha !== String(o.sha)) return route.fulfill({ status: 409, headers: cors, body: '{}' })
    o.c = bd.content; o.sha++; return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ content: { sha: String(o.sha) } }) })
  }
  if (r.method() === 'GET') {
    if (!file) return route.fulfill({ status: 404, headers: cors, body: '{}' })
    return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ content: file, encoding: 'base64', sha: String(sha) }) })
  }
  const body = r.postDataJSON()
  if (forceConflict || (file && body.sha !== String(sha))) { forceConflict = false; return route.fulfill({ status: 409, headers: cors, body: '{}' }) }
  file = body.content; sha++; puts++
  return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ content: { sha: String(sha) } }) })
}
const device = async (name) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.route('https://api.github.com/**', gh)
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message))
  await p.goto(URL + '#/settings'); await p.waitForSelector('#sync-token')
  await p.fill('#sync-name', name); await p.fill('#sync-token', TOKEN); await p.click('text=เชื่อมต่อและบันทึก')
  await p.waitForSelector('.ai-keys__ok'); return p
}
const decode = () => JSON.parse(Buffer.from(file, 'base64').toString('utf8'))

const A = await device('เจ็ท')
check(true, 'device A connects with token')
await A.goto(URL + '#/prayer'); await A.waitForSelector('.nb-sync--ok', { timeout: 8000 })
check(file && decode().items.length === 5, 'first device uploads starter prayers')
await A.click('.nb-add'); await A.fill('#nb-title', 'อธิษฐานเผื่อคุณยายสมศรี'); await A.fill('#nb-text', 'ข้าแต่พระบิดาเจ้า ทดสอบใช้ร่วมกัน อาเมน'); await A.click('text=💾 บันทึก')
await A.waitForTimeout(1500)
check(decode().items.some((x) => x.title === 'อธิษฐานเผื่อคุณยายสมศรี' && x.by === 'เจ็ท'), 'saved prayer goes online right away (with author)')

// เครื่องที่ 2 เข้าร่วมด้วยลิงก์ (ไม่ต้องพิมพ์รหัส)
await A.goto(URL + '#/settings'); await A.waitForSelector('.invite')
check(await A.locator('text=ส่งลิงก์ให้อีกเครื่อง').count() === 1, 'settings offers invite link once connected'); await A.goto(URL + '#/prayer'); await A.waitForSelector('.nb-card')
const bctx = await b.newContext({ viewport: { width: 390, height: 844 } }); await bctx.route('https://api.github.com/**', gh)
const B = await bctx.newPage(); B.errs = []; B.on('pageerror', (e) => B.errs.push(e.message))
await B.goto(URL + '#/join?t=' + encodeURIComponent(TOKEN)); await B.waitForSelector('#join-name')
check(!B.url().includes(TOKEN), 'token removed from address bar right away')
await B.fill('#join-name', 'ภรรยา'); await B.click('text=เริ่มใช้ร่วมกัน'); await B.waitForSelector('.nb-card', { timeout: 8000 })
check(true, 'device B joined with one tap from the link')
await B.goto(URL + '#/prayer'); await B.waitForSelector('.nb-sync--ok', { timeout: 8000 })
check((await B.textContent('.nb-list')).includes('คุณยายสมศรี'), 'device B sees prayer saved on A')
await B.fill('#nb-q', 'คุณยาย'); await B.waitForTimeout(300)
await B.click('.nb-card--open .nb-card__more'); await B.click('.nb-menu >> text=แก้ไข'); await B.fill('#nb-title', 'อธิษฐานเผื่อคุณยายสมศรี (แก้โดยภรรยา)'); await B.click('text=💾 บันทึก'); await B.waitForTimeout(1500)
forceConflict = true // จำลองว่ามีอีกเครื่องบันทึกพร้อมกัน
await A.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await A.waitForTimeout(1500)
check((await A.textContent('.nb-list')).includes('แก้โดยภรรยา'), 'device A sees B edit when reopened')
check((await A.textContent('.nb-sync')).includes('แก้ไขล่าสุดโดย ภรรยา'), 'sync line shows who updated last: ' + (await A.textContent('.nb-sync')))
await A.fill('#nb-q', 'คุณยาย'); await A.waitForTimeout(300); await A.click('.nb-card--open .nb-card__more'); await A.click('.nb-menu__danger'); await A.click('.duty__btns--warn .btn--danger'); await A.waitForTimeout(1800)
check(decode().items.find((x) => x.title.includes('คุณยาย'))?.deleted === true, 'delete syncs online (conflict retried)')
await B.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await B.waitForTimeout(1500); await B.fill('#nb-q', '')
check(!(await B.textContent('.nb-list')).includes('คุณยาย'), 'device B no longer shows deleted prayer')
// รหัสผิด
const C = await b.newContext(); await C.route('https://api.github.com/**', gh); const cp = await C.newPage()
await cp.goto(URL + '#/settings'); await cp.fill('#sync-token', 'wrong'); await cp.click('text=เชื่อมต่อและบันทึก'); await cp.waitForSelector('.ai-keys__err')
check((await cp.textContent('.ai-keys__err')).includes('ไม่ถูกต้อง'), 'wrong token rejected with a clear message')
check(!file.includes(TOKEN) && ![...A.errs, ...B.errs].length, 'token never uploaded; no JS errors ' + [...A.errs, ...B.errs].join(';'))
await b.close(); console.log(fail ? `${fail} FAILED` : 'ALL PASSED'); process.exit(fail ? 1 : 0)
