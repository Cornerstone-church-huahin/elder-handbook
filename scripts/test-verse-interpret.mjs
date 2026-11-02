// ท่องจำคัมภีร์: ไอคอน 💡 ตีความบนการ์ด → แผงเด้ง (บริบทออฟไลน์) → AI ตีความ (จำลอง Gemini) → พับ/ขยาย/สร้างใหม่/ลบ/เก็บไว้กับการ์ด
import { chromium } from 'playwright'
import { cardsOpenByDefault } from './_cards-open.mjs'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
cardsOpenByDefault(b)
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const J = { context: 'เปโตรเขียนถึงคริสเตียนที่กระจัดกระจายและถูกกดดัน', meaning: 'ผู้เขียนหนุนใจผู้อ่านให้มีความหวังที่มั่นคงท่ามกลางความทุกข์', keywords: [{ word: 'ความหวัง', note: 'ความมั่นใจต่อสิ่งที่พระเจ้าสัญญา' }], truth: 'พระเจ้าทรงสัตย์ซื่อต่อพระสัญญา', today: 'วันนี้ที่งานหนักและข่าวร้ายเยอะ ข้อนี้ชวนให้เรายึดสิ่งที่ไม่เปลี่ยนแปลง', apply: { life: 'จัดเวลาสงบทุกเช้า', thought: 'มองปัญหาในภาพใหญ่ของพระสัญญา', action: 'ส่งข้อความหนุนใจเพื่อนหนึ่งคน' }, caution: 'ไม่ได้หมายความว่าจะไม่มีความทุกข์', related: ['โรม 5:3', 'เรื่องแต่ง 99:99'] }
let calls = 0
async function run(withKey) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
  if (withKey) await ctx.addInitScript(() => localStorage.setItem('khatha.aiSettings.v1', JSON.stringify({ vendor: 'claude', keys: { gemini: 'AIzaFAKEKEYFORTEST' }, models: {} })))
  await ctx.route('**/generativelanguage.googleapis.com/**', async (r) => { calls++; await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(J) }] } }] }) }) })
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
  await p.goto(URL + '#/notebook/1'); await p.waitForSelector('#nb-catsel')
  await p.click('[aria-label="จัดการหมวด"]'); await p.fill('[aria-label="ชื่อหมวดใหม่"]', 'ทดสอบ'); await p.getByRole('button', { name: '💾 บันทึกหมวด' }).click(); await p.click('[aria-label="จัดการหมวด"]')
  await p.click('[aria-label="เปิดหมวด ทดสอบ"]'); await p.waitForSelector('#bp-book')
  await p.fill('#bp-book', '1 เปโตร'); await p.click('.bp__hits >> text=1 เปโตร'); await p.selectOption('#bp-ch', '1'); await p.click('[aria-label="ข้อ 3"]')
  await p.waitForFunction(() => document.querySelectorAll('.sm-verses li').length === 1); await p.click('text=💾 บันทึกข้อนี้'); await p.waitForTimeout(250)
  return { p, errs }
}
{
  const { p, errs } = await run(true)
  const card = p.locator('.sm-item').first(), btn = card.locator('button[aria-label^="ตีความ"]')
  const bb = await btn.boundingBox(), cb = await card.boundingBox()
  check(!!bb && bb.x > cb.x + cb.width * 0.7, '💡 icon sits in the right-hand column of the card')
  await btn.click(); await p.waitForSelector('.vi')
  const vb = await p.locator('.vi').boundingBox(); const bb2 = await btn.boundingBox(), cb2 = await card.boundingBox()
  check(vb.width > cb2.width * 0.85 && vb.y > bb2.y, 'the panel pops up full width below the verse')
  check((await p.textContent('.vi')).includes('ผู้เขียน:') && (await p.textContent('.vi')).includes('เปโตร'), 'offline context (book intro) is shown without any AI')
  await p.click('#vi-near'); check((await p.locator('.vi-near p').count()) >= 2, 'neighbouring verses (1971) can be expanded')
  await p.click('#vi-run'); await p.waitForSelector('.vi-sec--hi')
  const t = await p.textContent('.vi')
  check(t.includes('พูดให้เข้าใจวันนี้') && t.includes('ลงมือทำสัปดาห์นี้') && t.includes('ข้อควรระวัง'), 'AI interpretation sections rendered (meaning / today / apply / caution)')
  check(t.includes('โรม 5:3') && !t.includes('99:99'), 'only valid cross-references are kept (fake reference dropped)')
  await p.click('[aria-label="พับคำตีความ"]'); check((await p.locator('.vi-body').count()) === 0, 'panel folds down to its header')
  await p.click('[aria-label="ขยายคำตีความ"]'); check(await p.locator('.vi-sec--hi').count() === 1, 'panel expands again')
  await p.click('[aria-label="ปิดคำตีความ"]'); check(await p.locator('.vi').count() === 0, 'panel closes')
  await p.reload(); await p.waitForSelector('#nb-catsel'); await p.click('[aria-label="เปิดหมวด ทดสอบ"]'); await p.waitForSelector('.sm-item'); await p.locator('.sm-item').first().locator('[aria-label^="ตีความ"]').click(); await p.waitForSelector('.vi-sec--hi')
  const before = calls; check(true, 'interpretation is saved with the card (kept after reload), calls so far: ' + before)
  await p.click('#vi-again'); await p.waitForTimeout(600); check(calls === before + 1, 'regenerate calls AI again')
  await p.click('#vi-del'); check(await p.locator('.vi-sec--hi').count() === 0 && await p.locator('#vi-run').count() === 1, 'delete interpretation returns to the empty state')
  await p.click('#vi-run'); await p.waitForSelector('.vi-sec--hi'); await p.screenshot({ path: '/tmp/claude-0/vi.png' })
  check(errs.length === 0, 'no JS errors ' + errs.join(';'))
}
{
  const { p } = await run(false)
  await p.locator('.sm-item').first().locator('[aria-label^="ตีความ"]').click(); await p.waitForSelector('.vi'); await p.click('#vi-run')
  await p.waitForSelector('.ai-keys__err'); check((await p.textContent('.ai-keys__err')).includes('คีย์ AI'), 'no key → clear message, context still available')
}
await b.close(); console.log(fail ? 'FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
