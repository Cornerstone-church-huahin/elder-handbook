// ทดสอบหมวดการบริหาร: หัวข้อ, ผังโครงสร้าง, ข้อความทางการแบบกดเปิด, ป้ายแหล่งที่มา, ถาม AI ประมวล 2 แหล่ง
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4184/index.html'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const p = await b.newPage({ viewport: { width: 390, height: 844 } })
const errs = []; p.on('pageerror', e => errs.push(e.message))
await p.addInitScript(() => {
  window.__prompts = []
  window.claude = { use: async (n) => n !== 'sample' ? null : Object.assign(async () => ({ text: '' }), { json: async (input) => {
    window.__prompts.push(input); await new Promise(r => setTimeout(r, 150))
    return { answer: 'แจ้งล่วงหน้าไม่น้อยกว่า 30 วัน (ข้อ 82.15)', steps: ['ส่งหนังสือ'], cited: [82.15, 999], used_lesson: true, differences: 'บทเรียนแนะนำ 1 สัปดาห์สำหรับประชุมธรรมกิจ', note: '' }
  } }) }
  const o = window.scrollTo.bind(window); window.scrollTo = (...a) => { o(...a); return {} }
})
await p.goto(URL); await p.waitForTimeout(700)
await p.click('.action:has-text("การบริหารจัดการ")'); await p.waitForSelector('.topic-card')
check(await p.locator('.topic-card').count() === 12, '12 topic cards')
await p.click('.topic-card >> nth=1'); await p.waitForSelector('.org')
check((await p.locator('h1').textContent()).includes('โครงสร้าง'), 'structure topic opens with org chart')
check(await p.locator('.src--bylaws').count() > 0 && await p.locator('.src--lesson').count() > 0, 'both source labels shown')
await p.click('.bylaw >> nth=0'); await p.waitForTimeout(150)
check((await p.locator('.bylaw[open] .official-text__body').textContent()).includes('สมาชิกสมบูรณ์จำนวน 30 คน'), 'tapping a bylaw shows official text (ข้อ 78)')
check(await p.locator('.note--diff, .note--gap, .note--match').count() >= 3, 'comparison notes shown')
await p.screenshot({ path: '/tmp/claude-0/shots/manage-structure.png', fullPage: true })
// หัวข้อคณะธรรมกิจ: ต้องมีข้อสังเกตเรื่องประชุม 10 ครั้ง
await p.click('text=ทุกหัวข้อ'); await p.click('text=คณะธรรมกิจคริสตจักร'); await p.waitForSelector('.note--gap')
check((await p.locator('.note--gap').first().textContent()).includes('10 ครั้ง'), 'flags the 10-meetings claim as needing verification')
// ถาม AI
await p.click('text=ทุกหัวข้อ'); await p.fill('#manage-q', 'ต้องแจ้งประชุมสัปปุรุษล่วงหน้ากี่วัน'); await p.press('#manage-q', 'Enter'); await p.waitForSelector('.ai-explain')
const prompt = await p.evaluate(() => window.__prompts.at(-1))
check(prompt.includes('<article no="82"') && prompt.includes('<lesson topic='), 'AI gets both official articles and lesson content')
check(prompt.includes('ถือแหล่งที่ 1 เป็นหลัก'), 'AI told bylaws take precedence')
check(await p.locator('.official-text').count() === 1, 'cited article shown, invalid citation dropped (82.15→82 kept, 999 dropped)')
check(await p.locator('.ai-explain .note--diff').count() === 1, 'differences between sources shown')
// ค้นหารวม
await p.click('.bottomnav >> text=ค้นหา'); await p.fill('#search-q', 'เหรัญญิก'); await p.press('#search-q', 'Enter'); await p.waitForTimeout(400)
check(await p.locator('.badge:has-text("การบริหาร")').count() > 0, 'universal search shows 🏛️ การบริหาร results')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
