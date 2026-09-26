// ทดสอบคีย์ AI 3 ผู้ให้บริการ (Claude · Gemini · ChatGPT) บนเว็บจริง (ไม่มี window.claude) ด้วยเซิร์ฟเวอร์ AI จำลอง
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const SET = {
  title: 'ทดสอบ', keys: ['วางใจ', 'สันติสุข', 'กำลัง'], scriptures: [{ ref: 'อิสยาห์ 41:10', gist: 'พระเจ้าอยู่ด้วย' }], people: [],
  intercede: { situation: 's', before_scripture: 'b', before_person: 'p', prayer: 'ข้าแต่พระบิดาเจ้า VENDOR ขอทรงอยู่กับ (ชื่อ) อาเมน', after: 'a', breath: 'br' },
  self: { before: 'x', prayer: 'ข้าแต่พระบิดาเจ้า ตนเอง อาเมน', breath: 'y' }, followup: 'f', safety: { level: 'none', note: '' },
}
const seen = []
const reply = (vendor, prompt) => {
  const t = prompt.includes('{"ok":true}') ? '{"ok":true}' : JSON.stringify(SET).replace('VENDOR', vendor)
  if (vendor === 'claude') return { content: [{ type: 'text', text: t }], stop_reason: 'end_turn' }
  if (vendor === 'gemini') return { candidates: [{ content: { parts: [{ text: t }] }, finishReason: 'STOP' }] }
  return { choices: [{ message: { content: t } }] }
}
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' }
const mock = (vendor, keyOf) => async (route) => {
  const r = route.request()
  if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
  const body = r.postDataJSON(); const key = keyOf(r)
  seen.push({ vendor, key, url: r.url(), body })
  if (key !== 'good-' + vendor) return route.fulfill({ status: 401, headers: cors, body: JSON.stringify({ error: { message: 'bad key' } }) })
  const prompt = vendor === 'claude' ? body.messages[0].content : vendor === 'gemini' ? body.contents[0].parts[0].text : body.messages[1].content
  route.fulfill({ status: 200, headers: cors, body: JSON.stringify(reply(vendor, prompt)) })
}
await ctx.route('https://api.anthropic.com/**', mock('claude', (r) => r.headers()['x-api-key']))
await ctx.route('https://generativelanguage.googleapis.com/**', mock('gemini', (r) => r.headers()['x-goog-api-key']))
await ctx.route('https://api.openai.com/**', mock('openai', (r) => (r.headers()['authorization'] || '').replace('Bearer ', '')))
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))

await p.goto(URL + '#/settings'); await p.waitForSelector('.ai-vendors')
check(await p.locator('.ai-vendor').count() === 3, 'three providers shown')
// ผิดคีย์ → ข้อความแจ้ง
await p.click('.ai-vendor >> text=Gemini'); await p.fill('#ai-key', 'wrong'); await p.click('text=ทดสอบและบันทึก')
await p.waitForSelector('.ai-keys__err'); check((await p.textContent('.ai-keys__err')).includes('คีย์ไม่ถูกต้อง'), 'wrong key reported')

for (const [label, id] of [['Claude', 'claude'], ['Gemini', 'gemini'], ['ChatGPT', 'openai']]) {
  await p.goto(URL + '#/settings'); await p.waitForSelector('.ai-vendors')
  await p.click(`.ai-vendor >> text=${label}`); await p.fill('#ai-key', 'good-' + id); await p.click('text=ทดสอบและบันทึก')
  await p.waitForSelector('.ai-keys__ok'); check((await p.textContent('.ai-keys__ok')).includes('ใช้ได้'), `${label}: key test ok`)
  await p.goto(URL + '#/prayer?q=' + encodeURIComponent('ทดสอบ ' + id + ' ป่วย')); await p.fill('#prayer-name', 'คุณสมศรี')
  await p.waitForSelector('.prayer-text', { timeout: 8000 })
  const txt = await p.textContent('.main')
  check(txt.includes(id) && txt.includes('ร่างโดย AI'), `${label}: prayer came from ${id}`)
  const last = seen.filter((s) => s.vendor === id).pop()
  check(!JSON.stringify(last.body).includes('คุณสมศรี'), `${label}: member name not sent`)
}
check(seen.some((s) => s.vendor === 'gemini' && s.url.includes('gemini-3.8-flash')), 'gemini default model used')
check(seen.some((s) => s.vendor === 'openai' && s.body.model === 'gpt-6-astra'), 'openai default model used')
// AI ล่ม → ใช้ข้อมูลในแอปแทน ไม่เด้งกลับ
await ctx.unroute('https://api.openai.com/**'); await ctx.route('https://api.openai.com/**', (r) => r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: cors }) : r.fulfill({ status: 500, headers: cors, body: '{}' }))
await p.goto(URL + '#/prayer?q=' + encodeURIComponent('ลูกป่วย ไม่สบาย ล่ม')); await p.waitForSelector('.prayer-text', { timeout: 8000 })
check((await p.textContent('.main')).includes('เตรียมจากข้อมูลในแอป'), 'AI failure falls back to local prayer')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await p.goto(URL + '#/settings'); await p.waitForSelector('.ai-vendors'); await p.screenshot({ path: process.env.SHOT || '/dev/null' })
await b.close(); console.log(fail ? `${fail} FAILED` : 'ALL PASSED'); process.exit(fail ? 1 : 0)
