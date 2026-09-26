// ทดสอบบุคคลในพระคัมภีร์ด้วย AI จำลอง: ป๊อปอัพเลือกชื่อ (เรียงยุค/พันธสัญญา), หน้าบุคคล, ปุ่มสอน, เทียบสถานการณ์, ลิงก์จาก Kit
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4183/index.html'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const p = await b.newPage({ viewport: { width: 390, height: 844 } })
const errs = []; p.on('pageerror', e => errs.push(e.message))
await p.addInitScript(() => {
  window.__prompts = []
  window.claude = { use: async (n) => n !== 'sample' ? null : Object.assign(async () => ({ text: '' }), { json: async (input) => {
    window.__prompts.push(input); await new Promise(r => setTimeout(r, 150))
    if (input.includes('"matches"')) return { matches: [{ id: 'hannah', why: 'รอคอย', lesson: 'อธิษฐาน', refs: ['1 ซามูเอล 1'] }, { id: 'not-in-list', why: 'x', lesson: '', refs: [] }] }
    if (input.includes('"sections"')) return { sections: [{ heading: 'ช่วงแรก', text: 'เรื่องย่อ', items: ['ก', 'ข'] }] }
    return { title: 'ป่วย', understanding: 'x', openers: ['a'], questions: ['q'], avoid_saying: [], scripture_refs: [{ ref: 'สดุดี 23', theme: 't' }], bible_characters: [{ name: 'เฮเซคียาห์', connection: 'ป่วยหนักและอธิษฐาน' }], prayers: { short: 's', full: 'f', intercession: 'i' }, next_steps: ['n'], encouragement: 'e', safety: { level: 'none', note: '' } }
  } }) }
  const o = window.scrollTo.bind(window); window.scrollTo = (...a) => { o(...a); return {} }
})
await p.goto(URL); await p.waitForTimeout(700)
await p.click('text=บุคคลในพระคัมภีร์ 100 คน'); await p.waitForSelector('.testament-head')
const heads = await p.locator('.testament-block > .testament-head span').allTextContents()
check(heads.join('|') === 'พันธสัญญาเดิม|พันธสัญญาใหม่', 'list split into Old / New Testament: ' + heads.join('|'))
check(await p.locator('.era-block').count() === 9, 'list shows 9 eras')
const firstLast = await p.locator('.era-block .result__title').evaluateAll(els => [els[0].textContent, els[els.length - 1].textContent])
check(firstLast[0] === 'อาดัม' && firstLast[1] === 'ลูกา', 'order Genesis (Adam) → Early Church (Luke)')
// ป๊อปอัพ
await p.click('text=📜 เลือกดูรายชื่อทั้ง 100 คน'); await p.waitForSelector('.sheet')
check(await p.locator('.sheet .pick').count() === 100, 'picker lists 100 names')
check((await p.locator('.sheet .testament-head').count()) === 2, 'picker grouped by testament')
await p.click('.sheet__era-group button:has-text("พระกิตติคุณ")'); await p.waitForTimeout(200)
const st = await p.locator('.sheet__list').evaluate(el => el.scrollTop)
check(st > 500, 'era jump scrolls the list (' + st + ')')
await p.fill('#people-picker-q', 'รูธ'); await p.waitForTimeout(100)
check(await p.locator('.sheet .pick').count() === 1, 'picker search filters by name')
await p.screenshot({ path: '/tmp/claude-0/shots/picker.png' })
await p.click('.sheet .pick'); await p.waitForTimeout(200)
check((await p.locator('h1').textContent()) === 'รูธ', 'pick opens Ruth profile')
check((await p.locator('.timeline-tag').textContent()).includes('พันธสัญญาเดิม'), 'profile shows testament + era')
check((await p.locator('.ref-list__ref').first().textContent()).includes('นางรูธ'), 'profile shows scripture refs')
await p.click('text=เรื่องราวชีวิต'); await p.waitForSelector('.ai-sec')
check((await p.evaluate(() => window.__prompts.at(-1))).includes('ห้ามยกหรือเขียนข้อความพระคัมภีร์'), 'teach prompt has scripture rule')
await p.screenshot({ path: '/tmp/claude-0/shots/person.png', fullPage: true })
// เทียบสถานการณ์
await p.goto(URL); await p.waitForTimeout(500); await p.click('text=บุคคลในพระคัมภีร์ 100 คน'); await p.waitForSelector('#compare-q')
await p.fill('#compare-q', 'อยากมีลูกแต่ไม่มีสักที'); await p.press('#compare-q', 'Enter'); await p.waitForSelector('.compare-card')
check(await p.locator('.compare-card').count() === 1, 'compare shows only people from the list (unknown id dropped)')
// Kit: บุคคลที่เกี่ยวข้อง + ลิงก์จาก AI
await p.goto(URL); await p.waitForTimeout(500); await p.fill('#home-search', 'ป่วย'); await p.press('#home-search', 'Enter'); await p.click('.result >> nth=0'); await p.waitForSelector('.kit-section')
check(await p.locator('.person-chip').count() > 0, 'kit page shows related people without AI')
check(await p.locator('.kit-section a:has-text("เฮเซคียาห์")').count() === 1, 'AI-named character links to profile')
check((await p.evaluate(() => window.__prompts.at(-1))).includes('เลือกจากรายชื่อนี้'), 'kit prompt grounded in the 100 list')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
