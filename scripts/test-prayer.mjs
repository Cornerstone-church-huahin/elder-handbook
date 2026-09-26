// ทดสอบผู้ช่วยอธิษฐานเผื่อด้วย AI จำลอง: 2 ส่วน, เลือกเปิดก่อนอธิษฐาน, ชื่อไม่ถูกส่งให้ AI, บุคคลจากรายชื่อเท่านั้น, โหมดตัวใหญ่, คัดลอก
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4185/index.html'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'])
const p = await ctx.newPage()
const errs = []; p.on('pageerror', e => errs.push(e.message))
await p.addInitScript(() => {
  window.__prompts = []
  window.claude = { use: async (n) => n !== 'sample' ? null : Object.assign(async () => ({ text: '' }), { json: async (input) => {
    window.__prompts.push(input); await new Promise(r => setTimeout(r, 150))
    return {
      title: 'คุณแม่ป่วยหนัก', keys: ['วางใจ', 'สันติสุข', 'กำลัง'],
      scriptures: [{ ref: 'อิสยาห์ 41:10', gist: 'พระเจ้าอยู่ด้วยและทรงชูกำลัง' }],
      people: [{ id: 'hezekiah', story: 'เฮเซคียาห์ป่วยหนักและร้องทูลพระเจ้า', bridge: 'เช่นเดียวกับ (ชื่อ) ที่กำลังรอคอย' }, { id: 'fake-person', story: 'x', bridge: 'y' }],
      intercede: { situation: 'เราเห็นความกังวลของ (ชื่อ)', before_scripture: 'ขอเปิดอิสยาห์ 41:10', before_person: 'ขอเล่าเรื่องเฮเซคียาห์', prayer: 'ข้าแต่พระบิดาเจ้า ขอทรงอยู่กับ (ชื่อ) ในพระนามพระเยซูคริสต์ อาเมน', after: 'พระเจ้าทรงอยู่กับ (ชื่อ)', breath: 'พระเจ้าทรงอยู่ด้วย' },
      self: { before: 'ข้าพเจ้าเองก็อ่อนแอ', prayer: 'ข้าแต่พระบิดาเจ้า ขอทรงชูกำลังข้าพระองค์ ในพระนามพระเยซูคริสต์ อาเมน', breath: 'ขอทรงชูกำลัง' },
      followup: 'โทรหาภายใน 2 วัน', safety: { level: 'none', note: '' },
    }
  } }) }
  const o = window.scrollTo.bind(window); window.scrollTo = (...a) => { o(...a); return {} }
})
await p.goto(URL); await p.waitForTimeout(700)
check(await p.locator('.prayer-cta').count() === 0, 'home has no large prayer banner (menu card only)')
await p.click('.action:has-text("อธิษฐานเผื่อ")'); await p.waitForSelector('#prayer-q')
await p.fill('#prayer-q', 'คุณแม่ของพี่น้องป่วยหนัก อยู่ ICU')
await p.click('text=🙏 สร้างคำอธิษฐาน'); await p.waitForSelector('.prayer-text')
const prompt = await p.evaluate(() => window.__prompts.at(-1))
check(await p.locator('#prayer-name').count() === 0, 'no name field (removed by request)')
check(prompt.includes('ห้ามยกหรือเขียนข้อความพระคัมภีร์') && prompt.includes('hezekiah: เฮเซคียาห์'), 'prompt has scripture rule + 100-person roster')
check((await p.locator('.prayer-text').textContent()).includes('พี่น้อง') && !(await p.locator('.prayer-text').textContent()).includes('(ชื่อ)'), '(ชื่อ) becomes พี่น้อง')
check(await p.locator('.prayer-key, .prayer-head').count() === 0, 'no title / memory keys (removed by request)')
await p.click('.seg button:has-text("พระคำ")'); await p.waitForSelector('.verse-card__text:not(.verse-card__text--wait)')
check((await p.locator('.verse-card').first().textContent()).includes('อย่ากลัวเลย เพราะเราอยู่กับเจ้า'), 'scripture tab shows real TH1971 verse text')
await p.click('.seg button:has-text("บุคคล")'); check((await p.locator('.say').first().textContent()).includes('เฮเซคียาห์'), 'opening can switch to Bible person')
check(!(await p.textContent('.main')).includes('fake-person') && (await p.locator('.person-open__head').textContent()).includes('เฮเซคียาห์'), 'person tab shows listed person; fake dropped')
await p.click('text=🧎 เพื่อตนเอง'); check((await p.locator('.prayer-text').textContent()).includes('ข้าพระองค์'), 'self-prayer tab')
await p.click('text=🙏 เผื่อพี่น้อง')
await p.click('.seg button:has-text("พระคำ")')
await p.click('text=📋 คัดลอกไปส่งทาง Line'); await p.waitForTimeout(200)
const clip = await p.evaluate(() => navigator.clipboard.readText()).catch(() => '')
check(clip.includes('พี่น้อง') && clip.includes('อิสยาห์ 41:10'), 'copy for Line includes prayer and reference')
await p.screenshot({ path: '/tmp/claude-0/shots/prayer.png', fullPage: true })
await p.click('text=🔠 เปิดตัวอักษรใหญ่เพื่ออธิษฐาน'); await p.waitForSelector('.prayer-big')
await p.click('.fieldmode__nav .primary'); check((await p.locator('.prayer-big').textContent()).includes('ข้าแต่พระบิดาเจ้า'), 'large mode steps to the prayer')
await p.click('.fieldmode__close')
// จากหน้าคู่มือ
await p.goto(URL); await p.waitForTimeout(500); await p.fill('#home-search', 'เสียชีวิต'); await p.press('#home-search', 'Enter'); await p.click('.result >> nth=0'); await p.click('text=🙏 สร้างคำอธิษฐานเผื่อเรื่องนี้'); await p.waitForSelector('.prayer-text')
check(true, 'kit page links straight into prayer generation')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
