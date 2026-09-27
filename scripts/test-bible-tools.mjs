// พระคัมภีร์: ไฮไลต์ (ของแต่ละคน, ขึ้นออนไลน์), แชร์, ภาษาอังกฤษ (WEB) + อ่านออกเสียง/เล่นซ้ำ/เล่นวน
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4173/index.html'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const TOKEN = 'github_pat_TEST'; const files = {}; const shas = {}
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,PUT', 'content-type': 'application/json' }
async function gh(route) {
  const r = route.request()
  if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
  const url = new globalThis.URL(r.url())
  if (url.pathname.endsWith('/elder-handbook-data')) return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ private: true, permissions: { push: true } }) })
  const f = url.pathname.split('/contents/')[1]
  if (r.method() === 'GET') return files[f] ? route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ content: files[f], encoding: 'base64', sha: String(shas[f]) }) }) : route.fulfill({ status: 404, headers: cors, body: '{}' })
  const body = r.postDataJSON()
  if (files[f] && body.sha !== String(shas[f])) return route.fulfill({ status: 409, headers: cors, body: '{}' })
  files[f] = body.content; shas[f] = (shas[f] ?? 0) + 1
  return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ content: { sha: String(shas[f]) } }) })
}
const dec = (f) => files[f] ? JSON.parse(Buffer.from(files[f], 'base64').toString('utf8')) : null
const device = async (name) => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] })
  await ctx.route('https://api.github.com/**', gh)
  await ctx.addInitScript(() => {
    window.__said = []; window.__shared = null
    navigator.share = async (d) => { window.__shared = d }
    const voices = [{ name: 'Google ไทย', lang: 'th-TH' }, { name: 'Google US English', lang: 'en-US' }]
    window.SpeechSynthesisUtterance = function (t) { this.text = t }
    let cur = null
    const synth = { speaking: false, pending: false, getVoices: () => voices,
      speak: (u) => {
        window.__said.push({ text: u.text, lang: u.lang }); synth.speaking = true
        const step = window.__slow ? 150 : 3; const ws = [...u.text.matchAll(/\S+/g)]; const ts = []
        ws.forEach((m, i) => ts.push(setTimeout(() => u.onboundary && u.onboundary({ charIndex: m.index }), i * step)))
        const me = setTimeout(() => { synth.speaking = false; u.onend && u.onend() }, ws.length * step + 30); cur = { me, u, ts }
      },
      cancel: () => { if (cur) { clearTimeout(cur.me); cur.ts.forEach(clearTimeout); cur = null } synth.speaking = false } }
    Object.defineProperty(window, 'speechSynthesis', { value: synth })
  })
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', (e) => p.errs.push(e.message))
  await p.goto(URL + '#/settings'); await p.waitForSelector('#sync-token')
  await p.fill('#sync-name', name); await p.fill('#sync-token', TOKEN); await p.click('text=เชื่อมต่อและบันทึก'); await p.waitForSelector('.ai-keys__ok')
  return p
}
const A = await device('เจ็ท')
await A.goto(URL + '#/bible/43/3'); await A.waitForSelector('.bv')
await A.click('#v16'); await A.click('#v17'); await A.waitForSelector('.bible-selbar')
const labels = await A.locator('.bible-selbar__btns button').allTextContents()
check(['ไฮไลต์', 'คัดลอก', 'แชร์', 'อังกฤษ'].every((l) => labels.some((x) => x.includes(l))), 'toolbar: highlight / copy / share / English: ' + labels.join(','))
await A.click('[aria-label="ไฮไลต์"]'); check(await A.locator('.hl-dot').count() === 6, '5 colors + clear')
await A.click('[aria-label="ไฮไลต์สีเขียว"]'); await A.waitForTimeout(1500)
check(await A.locator('#v16.hl--green').count() === 1 && await A.locator('#v17.hl--green').count() === 1, 'verses highlighted green')
check(dec('highlights.json')?.items.filter((x) => !x.deleted && x.owner === 'เจ็ท').length === 2, 'highlights saved online under owner เจ็ท')
await A.reload(); await A.waitForSelector('.bv'); check(await A.locator('#v16.hl--green').count() === 1, 'highlight persists')
// เปลี่ยนสี / ลบ
await A.click('#v17'); await A.click('[aria-label="ไฮไลต์"]'); await A.click('[aria-label="ไฮไลต์สีชมพู"]')
check(await A.locator('#v17.hl--pink').count() === 1, 'change color')
await A.click('#v17'); await A.click('[aria-label="ไฮไลต์"]'); await A.click('[aria-label="ลบไฮไลต์"]')
check(await A.locator('#v17[class*="hl--"]').count() === 0 && await A.locator('#v16.hl--green').count() === 1, 'clear highlight on one verse')
await A.waitForTimeout(1200)
// แชร์
await A.click('#v16'); await A.click('[aria-label="แชร์"]'); await A.waitForTimeout(200)
const shared = await A.evaluate(() => window.__shared?.text ?? '')
check(shared.startsWith('ยอห์น 3:16') && shared.includes('พระเจ้าทรงรักโลก'), 'share opens phone share sheet with verse')
// อังกฤษ
await A.click('[aria-label="แปลอังกฤษ"]'); await A.waitForSelector('.en-sheet .bv')
check((await A.textContent('.en-sheet__text')).includes('For God so loved the world'), 'English (WEB) text for John 3:16')
check((await A.textContent('.en-sheet .sheet__title')).includes('John 3:16'), 'English reference label')
await A.evaluate(() => (window.__said = []))
await A.click('[aria-label="Read aloud"]'); await A.waitForTimeout(800)
let said = await A.evaluate(() => window.__said)
check(said.length > 0 && said.every((x) => x.lang === 'en-US') && said.map((x) => x.text).join(' ').includes('For God so loved'), 'reads aloud in English voice')
// ไฮไลต์วิ่งตามคำที่อ่าน
await A.evaluate(() => { window.__slow = true }); await A.click('[aria-label="Replay"]'); await A.waitForTimeout(1500)
const w1 = await A.locator('.en-sheet mark.en-word').textContent().catch(() => '')
await A.waitForTimeout(600)
const w2 = await A.locator('.en-sheet mark.en-word').textContent().catch(() => '')
check(!!w1 && !!w2 && w1 !== w2, `highlight follows the words being read ("${w1}" → "${w2}")`)
check(await A.locator('.en-sheet .bv--now').count() === 1, 'current verse marked')
await A.click('[aria-label="Pause"]'); await A.evaluate(() => { window.__slow = false })
await A.click('[aria-label="Loop"]'); await A.evaluate(() => (window.__said = []))
await A.click('[aria-label="Replay"]'); await A.waitForTimeout(2500)
said = await A.evaluate(() => window.__said.map((x) => x.text).join(' | '))
check((said.match(/John 3:16/g) ?? []).length >= 2, 'loop replays repeatedly')
await A.click('[aria-label="Pause"]'); await A.waitForTimeout(100)
await A.click('.en-sheet .sheet__close'); check(await A.locator('.en-sheet').count() === 0, 'close popup')
// ภรรยา: ไม่เห็นไฮไลต์ของเจ็ท
const B = await device('ปิ่น')
await B.goto(URL + '#/bible/43/3'); await B.waitForSelector('.bv'); await B.waitForTimeout(1500)
check(await B.locator('#v16[class*="hl--"]').count() === 0, 'wife does not see Jett highlights')
await B.click('#v1'); await B.click('[aria-label="ไฮไลต์"]'); await B.click('[aria-label="ไฮไลต์สีฟ้า"]'); await B.waitForTimeout(1500)
await A.reload(); await A.waitForSelector('.bv'); await A.waitForTimeout(1500)
check(await A.locator('#v1[class*="hl--"]').count() === 0 && await A.locator('#v16.hl--green').count() === 1, 'Jett does not see wife highlights, keeps his own')
check(dec('highlights.json').items.some((x) => x.owner === 'ปิ่น' && x.v === 1), 'wife highlight stored online under ปิ่น')
await A.click('#v16'); await A.screenshot({ path: '/tmp/claude-0/shots/hl.png' })
await A.click('[aria-label="แปลอังกฤษ"]'); await A.waitForSelector('.en-sheet .bv'); await A.screenshot({ path: '/tmp/claude-0/shots/en.png' })
check(A.errs.length + B.errs.length === 0, 'no JS errors ' + [...A.errs, ...B.errs].join(';'))
await b.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
