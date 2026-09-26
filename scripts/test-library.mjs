// ทดสอบคลังคำอธิษฐานของคริสตจักร: ถวายทรัพย์ · อาหาร · การเงิน (ไม่มี AI และมี AI)
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
const go = async (q) => { await p.goto(URL + '#/prayer/ai?q=' + encodeURIComponent(q)); await p.waitForSelector('.prayer-text') }

await go('อธิษฐานนำถวายทรัพย์วันอาทิตย์')
check((await p.textContent('.prayer-text')).includes('ท้องพระคลัง'), 'offering: church prayer used')
check((await p.locator('.say').first().textContent()).includes('ให้เรายืนขึ้น'), 'offering: opens with leader invitation')
check((await p.textContent('.main')).includes('อธิษฐานนำ'), 'offering: step titled อธิษฐานนำ')
await p.click('.seg >> text=พระคำ'); await p.waitForSelector('.verse-card__text:not(.verse-card__text--wait)')
check((await p.locator('.verse-card').first().textContent()).includes('สิ่งของทุกอย่างมาจากพระองค์'), 'offering: 1 Chr 29:14 real text')

await go('ขอบคุณพระเจ้าก่อนทานอาหารงานเลี้ยง')
check(await p.locator('.versions button').count() === 2, 'meal: 2 church versions to choose')
await p.click('.versions >> text=แบบที่ 2')
check((await p.textContent('.prayer-text')).includes('ผ่านทางพระเยซูคริสต์'), 'meal: switch to version 2')

await go('ตกงาน มีหนี้ และเครียดมาก')
check((await p.textContent('.prayer-text')).includes('พี่น้อง'), 'finance: pastoral intercession')
await p.click('.prayer-tabs >> text=เพื่อตนเอง')
check((await p.textContent('.prayer-text')).includes('ทวีคูณขนมปังและปลา') && await p.locator('.versions button').count() === 3, 'finance: self tab uses church prayers (3 versions)')

// มี AI: ส่งคลังเป็นแนวทาง และยังเลือกต้นฉบับได้
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }
let sent = ''
await ctx.route('https://api.anthropic.com/**', async (r) => {
  if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors })
  sent = r.request().postDataJSON().messages[0].content
  const set = { title: 't', keys: [], scriptures: [{ ref: '1 พงศาวดาร 29:14', gist: 'g', person: 'david' }], people: [{ id: 'david', story: 's', bridge: 'b' }],
    intercede: { situation: 'AI-INVITE', before_scripture: 'e', before_person: 'c', prayer: 'ข้าแต่พระบิดาเจ้า AI-ADAPTED อาเมน', after: 'a', breath: 'x' },
    self: { before: 'x', prayer: 'ข้าแต่พระบิดาเจ้า ตนเอง อาเมน', breath: 'y' }, followup: '', safety: { level: 'none', note: '' } }
  r.fulfill({ status: 200, headers: cors, body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(set) }], stop_reason: 'end_turn' }) })
})
await p.goto(URL + '#/settings'); await p.evaluate(() => localStorage.setItem('khatha.aiSettings.v1', JSON.stringify({ vendor: 'claude', keys: { claude: 'k' }, models: {} }))); await p.reload()
await go('ถวายทรัพย์สร้างโบสถ์ใหม่')
check(sent.includes('ถวายคืน สู่ท้องพระคลัง') || sent.includes('ท้องพระคลัง'), 'AI: church offering prayer sent as reference')
check((await p.textContent('.prayer-text')).includes('AI-ADAPTED'), 'AI: adapted prayer shown first')
await p.click('.versions >> text=ถวายคืนสู่ท้องพระคลัง')
check((await p.textContent('.prayer-text')).includes('ท้องพระคลัง'), 'AI: original church prayer selectable')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? `${fail} FAILED` : 'ALL PASSED'); process.exit(fail ? 1 : 0)
