// ทดสอบโมดูลระเบียบปฏิบัติฯ ด้วย AI จำลอง: สารบัญ, เปิดข้อ, ลิงก์ข้ออ้างอิง, ค้นหา, ถาม AI, อธิบายข้อ
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4182/index.html'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const p = await b.newPage({ viewport: { width: 390, height: 844 } })
const errs = []; p.on('pageerror', e => errs.push(e.message))
await p.addInitScript(() => {
  window.__prompts = []
  window.claude = { use: async (n) => n !== 'sample' ? null : Object.assign(async () => ({ text: '' }), { json: async (input, o) => {
    window.__prompts.push(input)
    await new Promise(r => setTimeout(r, 200))
    if (input.includes('คำถาม:')) return { found: true, answer: 'ผู้ปกครองทำพิธีได้เมื่อได้รับสิทธิพิเศษ (ข้อ 25)', steps: ['คณะธรรมกิจเสนอชื่อ'], cited: [25, 999], note: '' }
    return { simple: 'สรุปง่าย ๆ', steps: ['ทำ 1'], watch: '' }
  } }) }
  // จำลองตัวเปิดของ Claude: scrollTo คืนค่าที่ไม่ใช่ undefined
  const o = window.scrollTo.bind(window); window.scrollTo = (...a) => { o(...a); return {} }
})
await p.goto(URL); await p.waitForTimeout(800)
await p.click('.action:has-text("ธรรมนูญและระเบียบ")'); await p.waitForSelector('.toc__chapter')
check(await p.locator('.toc__chapter').count() === 10, 'TOC shows 10 chapters')
await p.click('.toc__chapter >> nth=1'); await p.click('text=การมอบสิทธิพิเศษให้ผู้ปกครอง'); await p.waitForTimeout(200)
check((await p.locator('h1').textContent()) === 'ข้อ 25', 'opens article 25')
check((await p.locator('.official-text__body').textContent()).includes('พิธีบัพติศมา'), 'official text verbatim')
check((await p.locator('.official-text footer').textContent()).includes('หน้า 7'), 'citation with page number')
await p.click('text=💡 ให้ AI อธิบายข้อนี้ให้อ่านง่าย'); await p.waitForSelector('.ai-explain')
check((await p.locator('.ai-explain .badge').textContent()).includes('ไม่ใช่ข้อความทางการ'), 'AI explanation labelled not official')
await p.click('text=ข้อ 26 ›'); await p.waitForTimeout(200)
check((await p.locator('h1').textContent()) === 'ข้อ 26', 'next article')
// ค้นหา + ถาม AI
await p.click('text=สารบัญ'); await p.fill('#charter-q', 'ผู้ปกครองทำพิธีบัพติศมาได้ไหม'); await p.press('#charter-q', 'Enter'); await p.waitForTimeout(200)
check((await p.locator('.result .art-no').first().textContent()) === 'ข้อ 25', 'search ranks article 25 first')
await p.click('button.ask-ai'); await p.waitForSelector('.ai-explain', { timeout: 5000 })
const prompt = await p.evaluate(() => window.__prompts.at(-1))
check(prompt.includes('<article no="25"') && prompt.includes('ตอบจากข้อที่ให้มาข้างบนเท่านั้น'), 'AI gets official articles + grounding rule')
check(await p.locator('.official-text').count() === 1, 'shows only cited article that exists (999 dropped)')
// ค้นหารวม
await p.click('.bottomnav >> text=ค้นหา'); await p.fill('#search-q', 'องค์ประชุม'); await p.press('#search-q', 'Enter'); await p.waitForTimeout(400)
check(await p.locator('.badge:has-text("ธรรมนูญ")').count() > 0, 'universal search includes 📜 ธรรมนูญ results')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await p.screenshot({ path: '/tmp/claude-0/shots/charter-search.png' })
await p.goto(URL); await p.waitForTimeout(500); await p.click('.action:has-text("ธรรมนูญและระเบียบ")'); await p.waitForSelector('.toc__chapter'); await p.click('.toc__chapter >> nth=1')
await p.screenshot({ path: '/tmp/claude-0/shots/charter-toc.png', fullPage: false })
await b.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
