// ทดสอบชั้น AI ด้วย Claude จำลอง (ไม่เรียก AI จริง): Kit, โหมดเยี่ยม, ถามเอง, ไม่มี AI, ปฏิเสธสิทธิ์
import { chromium } from 'playwright'
import fs from 'fs'
const html = fs.readFileSync('preview.html', 'utf8')
const FAKE = {
  title: 'ก่อนผ่าตัด', understanding: 'สมาชิกอาจกลัวความเจ็บปวดและผลที่ไม่แน่นอน',
  openers: ['วันนี้รู้สึกอย่างไรบ้างครับ', 'ผมมาเยี่ยมและอยากอธิษฐานด้วย', 'มีอะไรอยากเล่าให้ฟังไหม'],
  questions: ['กังวลเรื่องไหนมากที่สุด', 'ครอบครัวเป็นอย่างไร', 'อยากให้อธิษฐานเรื่องอะไร', 'หมอบอกอะไรบ้าง'],
  avoid_saying: [{ say: 'ไม่ต้องกลัวหรอก', why: 'ปฏิเสธความรู้สึก' }],
  scripture_refs: [{ ref: 'สดุดี 23:1-4', theme: 'พระเจ้าอยู่ด้วยในหุบเขา' }, { ref: 'ฟีลิปปี 4:6-7', theme: 'มอบความกังวลในคำอธิษฐาน' }],
  bible_characters: [{ name: 'เฮเซคียาห์', connection: 'ทูลขอเมื่อป่วยหนัก' }],
  prayers: { short: 'ข้าแต่พระบิดาเจ้า โปรดประทานสันติสุขแก่ (ชื่อ) ในพระนามพระเยซูคริสต์ อาเมน', full: 'ข้าแต่พระบิดาเจ้า ... อาเมน', intercession: 'ข้าแต่พระบิดาเจ้า ... อาเมน' },
  next_steps: ['โทรหาหลังผ่าตัด 1 วัน'], encouragement: 'พระเจ้าอยู่กับคุณ', safety: { level: 'none', note: '' },
}
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
async function open(mode) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } })
  const errs = []; p.on('pageerror', e => errs.push(e.message))
  const inject = mode === 'none' ? '' : `<script>window.__calls=0;window.claude={use:async(n)=>n!=='sample'?null:Object.assign(async()=>({text:''}),{json:async(input,o)=>{window.__calls++;window.__prompt=input;
    ${mode === 'deny' ? "throw {code:'not_granted',message:'x'}" : `await new Promise(r=>setTimeout(r,300));o.onText&&o.onText({text:'{',delta:'{'});await new Promise(r=>setTimeout(r,300));return ${JSON.stringify(FAKE)}`}}})};</script>`
  await p.setContent(inject + html); await p.waitForTimeout(400)
  return { p, errs }
}
{ const { p, errs } = await open('ok')
  await p.fill('#home-search', 'ป่วย'); await p.press('#home-search', 'Enter'); await p.click('.result >> nth=0'); await p.waitForTimeout(150)
  check(await p.locator('text=กำลังเตรียมคู่มือ').or(p.locator('text=กำลังเขียนคู่มือ')).count() > 0, 'loading state shows')
  await p.waitForSelector('.kit-section', { timeout: 5000 })
  check(await p.locator('.kit-section').count() === 8, `kit shows 8 sections (${await p.locator('.kit-section').count()})`)
  check(await p.locator('text=ร่างโดย AI').count() === 1, 'AI draft badge shown')
  check(await p.locator('text=สดุดี 23:1-4').count() === 1, 'scripture reference shown')
  const prompt = await p.evaluate(() => window.__prompt)
  check(prompt.includes('ห้ามยกหรือเขียนข้อความพระคัมภีร์') && prompt.includes('ผู้ป่วย'), 'prompt has scripture rule + topic')
  await p.click('text=เข้าโหมดเยี่ยม'); await p.waitForTimeout(150)
  check(await p.locator('.fieldmode').count() === 1, 'field mode opens')
  for (const t of ['คำหนุนใจ', 'คำถาม', 'คำอธิษฐาน', 'ถัดไป']) { await p.click('.fieldmode__nav .primary'); check((await p.locator('.fieldmode__body h2').textContent()) === t, `field mode → ${t}`) }
  await p.click('text=เสร็จ'); check(await p.locator('.fieldmode').count() === 0, 'field mode closes')
  await p.screenshot({ path: '/tmp/claude-0/shots/ai-kit.png', fullPage: true })
  // ถามเอง
  await p.click('.bottomnav >> text=ค้นหา'); await p.fill('#search-q', 'ลูกติดเกม ไม่ยอมไปโบสถ์'); await p.press('#search-q', 'Enter'); await p.waitForTimeout(150)
  await p.click('.ask-ai'); await p.waitForSelector('.kit-section', { timeout: 5000 })
  check((await p.evaluate(() => window.__prompt)).includes('ลูกติดเกม'), 'free-text ask sends typed topic')
  check(errs.length === 0, 'no JS errors ' + errs.join(';')) }
{ const { p } = await open('none')
  await p.fill('#home-search', 'ป่วย'); await p.press('#home-search', 'Enter'); await p.click('.result >> nth=0'); await p.waitForTimeout(300)
  check(await p.locator('text=ผู้ช่วย AI ใช้ได้เมื่อเปิดแอปผ่านลิงก์ของ Claude').count() === 1, 'no-AI message when opened as plain file') }
{ const { p } = await open('deny')
  await p.fill('#home-search', 'ป่วย'); await p.press('#home-search', 'Enter'); await p.click('.result >> nth=0'); await p.waitForTimeout(500)
  check(await p.locator('text=ยังไม่ได้อนุญาต').count() === 1, 'declined consent message') }
await b.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
