// 🕊️ ความหมายฝ่ายวิญญาณบนการ์ด: ปุ่ม 🔁 ฟังวนซ้ำ — เล่นเฉพาะความหมาย (ตัดเครื่องหมาย markdown) วนไปเรื่อย ๆ จนกดหยุด · แสดงผล markdown เป็นตัวหนา/รายการ
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
await ctx.addInitScript(() => {
  window.__said = []
  window.SpeechSynthesisUtterance = function (t) { this.text = t }
  const synth = { speaking: false, pending: false, getVoices: () => [{ name: 'Google ไทย', lang: 'th-TH' }], speak: (u) => { window.__said.push(u.text); synth.speaking = true; setTimeout(() => { synth.speaking = false; u.onend && u.onend() }, 40) }, cancel: () => { synth.speaking = false } }
  Object.defineProperty(window, 'speechSynthesis', { value: synth })
})
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
await p.goto(URL + '#/notebook/1'); await p.waitForSelector('#nb-catsel')
await p.click('[aria-label="จัดการหมวด"]'); await p.fill('[aria-label="ชื่อหมวดใหม่"]', 'ทดสอบ'); await p.getByRole('button', { name: '💾 บันทึกหมวด' }).click(); await p.click('[aria-label="จัดการหมวด"]')
await p.click('[aria-label="เปิดหมวด ทดสอบ"]'); await p.waitForSelector('#bp-book')
await p.fill('#bp-book', '1 เปโตร'); await p.click('.bp__hits >> text=1 เปโตร'); await p.selectOption('#bp-ch', '1'); await p.click('[aria-label="ข้อ 3"]'); await p.waitForFunction(() => document.querySelectorAll('.sm-verses li').length >= 1)
await p.fill('#sp-text', 'พระธรรม **อิสยาห์ 42:3** เป็นบทเพลง 🕊️ ★\n\n---\n\n### 1. ไม้อ้อช้ำ (A bruised reed)\n\n* **ไม้อ้อ:** พืชริมน้ำที่เปราะบาง → เทียบ มัทธิว 12:20-21 ~ ครับ\n* เล็งถึงผู้ที่จิตใจแตกสลาย')
await p.click('text=💾 บันทึกข้อนี้'); await p.waitForSelector('.sm-spirit')
const html = await p.locator('.sm-spirit__t').innerHTML(), txt = await p.locator('.sm-spirit__t').textContent()
check(!txt.includes('**') && !txt.includes('###') && !txt.includes('---') && html.includes('<b>'), 'markdown is rendered (bold/heading/list), no raw ** ### ---')
const play = p.locator('[aria-label^="ฟังความหมายฝ่ายวิญญาณ"]'); await play.click()
await p.waitForSelector('[aria-label^="หยุดฟังความหมาย"]')
await p.waitForFunction(() => { const a = window.__said.join('|'); return a.includes('จิตใจแตกสลาย') && a.lastIndexOf('สาธุการ') > a.indexOf('จิตใจแตกสลาย') }, null, { timeout: 15000 })
const said = await p.evaluate(() => window.__said)
const all = said.join(' | ')
check(all.includes('สาธุการ') && all.includes('ไม้อ้อ'), 'reads the verse text first, then the spiritual meaning (' + said.length + ' chunks so far)')
check(all.indexOf('สาธุการ') < all.indexOf('ไม้อ้อ'), 'order: verse → meaning')
check(all.includes('1 เปโตร บทที่ 1 ข้อ 3'), 'the card reference is read first as “… บทที่ 1 ข้อ 3”')
const joined = said.join(' ')
check(joined.includes('อิสยาห์ บทที่ 42 ข้อ 3') && joined.includes('มัทธิว บทที่ 12 ข้อ 20 ถึง 21'), 'references inside the meaning are read like Bible references (อิสยาห์ บทที่ 42 ข้อ 3, มัทธิว บทที่ 12 ข้อ 20 ถึง 21)')
check(!/[*#~★→🕊]|---|bruised|reed/.test(all), 'strange symbols, emoji and English-only parentheses are not read: ' + JSON.stringify(said.slice(-2)))
// วนกลับ: หลังจบความหมาย กลับไปอ่านข้อพระคัมภีร์อีกครั้ง
const firstMeaning = said.findIndex((x) => x.includes('ไม้อ้อ'))
check(said.slice(firstMeaning + 1).some((x) => x.includes('สาธุการ')), 'after the meaning it loops back to the verse, then the meaning again')
const n1 = (await p.evaluate(() => window.__said.length)); await p.waitForTimeout(600); const n2 = await p.evaluate(() => window.__said.length)
check(n2 > n1, 'keeps looping while not stopped (' + n1 + ' → ' + n2 + ')')
await p.click('[aria-label^="หยุดฟังความหมาย"]'); await p.waitForTimeout(300)
const s1 = await p.evaluate(() => window.__said.length); await p.waitForTimeout(600); const s2 = await p.evaluate(() => window.__said.length)
check(s1 === s2 && await p.locator('[aria-label^="ฟังความหมายฝ่ายวิญญาณ"]').count() === 1, 'stop button stops it and the play button returns')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await p.screenshot({ path: '/tmp/claude-0/sl.png' })
await b.close(); console.log(fail ? 'FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
