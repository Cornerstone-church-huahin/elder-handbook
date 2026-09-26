// จำลองเว็บจริง: เสิร์ฟ dist + /api/ai ปลอม (ตรวจรหัสเข้าใช้) แล้วทดสอบการอธิษฐานผ่านเซิร์ฟเวอร์
import http from 'http'
import fs from 'fs'
import path from 'path'
import { chromium } from 'playwright'
const PRAYER = { title: 'ทดสอบ', keys: ['ก', 'ข', 'ค'], scriptures: [{ ref: 'สดุดี 23', gist: 'x' }], people: [], intercede: { situation: 's', before_scripture: 'b', before_person: 'p', prayer: 'ข้าแต่พระบิดาเจ้า ขอทรงอยู่กับ (ชื่อ) ในพระนามพระเยซูคริสต์ อาเมน', after: 'a', breath: 'br' }, self: { before: '', prayer: 'ข้าแต่พระบิดาเจ้า อาเมน', breath: '' }, followup: '', safety: { level: 'none', note: '' } }
let calls = 0
const srv = http.createServer((req, res) => {
  if (req.url.startsWith('/api/ai')) {
    let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
      calls++
      if (req.headers['x-access-code'] !== 'elder2026') { res.writeHead(401, { 'content-type': 'application/json' }); return res.end('{"code":"locked"}') }
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ text: 'นี่คือคำตอบ\n```json\n' + JSON.stringify(PRAYER) + '\n```' }))
    }); return
  }
  const f = path.join('dist', req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0])
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end() }
  const ext = path.extname(f); res.writeHead(200, { 'content-type': { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }[ext] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res)
}).listen(4199)
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const p = await b.newPage({ viewport: { width: 390, height: 844 } })
const errs = []; p.on('pageerror', e => errs.push(e.message))
await p.goto('http://localhost:4199/#/prayer?q=' + encodeURIComponent('ทดสอบเรื่องป่วย')); await p.waitForTimeout(1200)
check((await p.locator('.card').first().textContent()).includes('รหัสเข้าใช้'), 'without access code: asks to enter code')
await p.goto('http://localhost:4199/#/settings'); await p.waitForSelector('#ai-code')
await p.fill('#ai-code', 'elder2026'); await p.click('text=บันทึกรหัส')
await p.goto('http://localhost:4199/#/prayer?q=' + encodeURIComponent('ทดสอบเรื่องป่วย')); await p.waitForSelector('.prayer-text', { timeout: 5000 })
check((await p.locator('.prayer-text').textContent()).includes('ข้าแต่พระบิดาเจ้า'), 'with code: prayer generated via /api/ai (JSON in code fence parsed)')
const before = calls
await p.reload(); await p.waitForSelector('.prayer-text', { timeout: 5000 })
check(calls === before, 'same request served from local cache (no second AI call)')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); srv.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
