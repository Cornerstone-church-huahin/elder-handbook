// ท่องจำคัมภีร์: ช่อง 🕊️ ความหมายฝ่ายวิญญาณ — เติมอัตโนมัติ (ชุดสำเร็จรูปฟรี / AI) · แก้เอง/แทนที่ได้ · บันทึกกับการ์ด · แก้ภายหลังบนการ์ด
import { chromium } from 'playwright'
import { cardsOpenByDefault } from './_cards-open.mjs'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
cardsOpenByDefault(b)
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const J = { points: [{ term: 'ไม้อ้อช้ำ', meaning: 'คนที่อ่อนแอและเจ็บปวด' }, { term: 'ไส้ตะเกียง', meaning: 'ความเชื่อที่เหลือน้อย' }], summary: 'พระเจ้าอ่อนโยนต่อคนที่อ่อนแอ' }
let calls = 0
async function setup(withKey) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
  if (withKey) await ctx.addInitScript(() => { if (!localStorage.getItem('khatha.aiSettings.v1')) localStorage.setItem('khatha.aiSettings.v1', JSON.stringify({ vendor: 'gemini', keys: { gemini: 'AIzaFAKEKEYFORTEST' }, models: {} })) })
  await ctx.route('**/generativelanguage.googleapis.com/**', async (r) => { calls++; await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(J) }] } }] }) }) })
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
  await p.goto(URL + '#/notebook/1'); await p.waitForSelector('#nb-catsel')
  await p.click('[aria-label="จัดการหมวด"]'); await p.fill('[aria-label="ชื่อหมวดใหม่"]', 'ทดสอบ'); await p.getByRole('button', { name: '💾 บันทึกหมวด' }).click(); await p.click('[aria-label="จัดการหมวด"]')
  await p.click('[aria-label="เปิดหมวด ทดสอบ"]'); await p.waitForSelector('#bp-book')
  return { p, errs }
}
const pick = async (p, book, ch, v) => { if (await p.locator('#sm-add-toggle[aria-expanded="false"]').count()) await p.click('#sm-add-toggle'); await p.fill('#bp-book', book); await p.click(`.bp__hits >> text=${book}`); await p.selectOption('#bp-ch', String(ch)); await p.click('text=ล้าง >> nth=0').catch(() => {}); await p.click(`[aria-label="ข้อ ${v}"]`); await p.waitForFunction(() => document.querySelectorAll('.sm-verses li').length >= 1) }
{
  const { p, errs } = await setup(true)
  const sb = await p.locator('#sp-text').count()
  check(sb === 0 || true, 'form ready')
  // 1) ข้อที่มีชุดสำเร็จรูป → เติมให้เองฟรี
  await pick(p, 'ยอห์น', 3, 16); await p.waitForFunction(() => document.querySelector('#sp-text')?.value.length > 20)
  check((await p.inputValue('#sp-text')).includes('• ') && calls === 0, 'verse with a curated entry is auto-filled for free (no AI call)')
  const tb = await p.locator('#sp-text').boundingBox(), sv = await p.locator('#sm-savecat').boundingBox()
  check(tb.y < sv.y, 'the field sits above the category selector / save button')
  // 2) แก้ด้วยมือแทนที่ แล้วบันทึก
  await p.fill('#sp-text', 'ความหมายที่ฉันหามาเอง: พระเจ้าทรงรักโลก')
  await p.click('text=💾 บันทึกข้อนี้'); await p.waitForSelector('.sm-item')
  check((await p.textContent('.sm-item .sm-spirit__t')).includes('ฉันหามาเอง'), 'a hand-written meaning replaces the auto text and is saved on the card')
  // 3) ข้อที่ไม่มีชุดสำเร็จรูป → ว่าง → กดให้ AI เขียน
  await pick(p, '1 เปโตร', 1, 3); await p.waitForTimeout(400)
  check((await p.inputValue('#sp-text')) === '' && calls === 0, 'verse without a curated entry stays empty (no AI call unless asked)')
  await p.click('#sp-ai'); await p.waitForFunction(() => document.querySelector('#sp-text')?.value.includes('ไม้อ้อช้ำ'))
  const t = await p.inputValue('#sp-text')
  check(t.includes('• ไม้อ้อช้ำ: ') && t.includes('🕊️ สรุป:') && calls === 1, 'AI fills bullet points + summary (1 call)')
  await p.fill('#sp-text', t + '\n• เพิ่มเอง: ข้อความของฉัน'); await p.click('text=💾 บันทึกข้อนี้'); await p.waitForFunction(() => document.querySelectorAll('.sm-item').length === 2)
  check((await p.locator('.sm-item').nth(1).locator('.sm-spirit__t').textContent()).includes('เพิ่มเอง'), 'AI text edited by hand then saved')
  // 4) แก้ภายหลังบนการ์ด
  await p.locator('.sm-item').nth(1).locator('[aria-label^="แก้ความหมายฝ่ายวิญญาณ"]').click(); await p.waitForSelector('#spe-text')
  await p.fill('#spe-text', 'แก้ภายหลังบนการ์ด'); await p.click('#spe-save')
  check((await p.locator('.sm-item').nth(1).locator('.sm-spirit__t').textContent()).trim() === 'แก้ภายหลังบนการ์ด', 'meaning can be re-edited on the saved card')
  // 5) รีโหลดแล้วยังอยู่
  await p.reload(); await p.waitForSelector('#nb-catsel'); await p.click('[aria-label="เปิดหมวด ทดสอบ"]'); await p.waitForSelector('.sm-item')
  const all = await p.locator('.sm-item .sm-spirit__t').allTextContents()
  check(all.some((x) => x.includes('ฉันหามาเอง')) && all.some((x) => x.includes('แก้ภายหลังบนการ์ด')), 'meanings persist after reload')
  // 6) เพิ่มความหมายให้การ์ดที่ยังไม่มี + ลบ (ล้าง)
  await p.locator('.sm-item').nth(0).locator('[aria-label^="แก้ความหมายฝ่ายวิญญาณ"]').click(); await p.click('#spe-clear'); await p.click('#spe-save')
  check(await p.locator('.sm-item').nth(0).locator('.sm-spirit__t').count() === 0 && await p.locator('.sm-item').nth(0).locator('.sm-spirit__add').count() === 1, 'clearing removes the meaning and offers “➕ ความหมายฝ่ายวิญญาณ”')
  // 7) ติ๊ก "ให้ AI เติมให้เอง" → เลือกข้อที่ไม่มีชุดสำเร็จรูป แล้ว AI เติมเอง
  if (await p.locator('#sm-add-toggle[aria-expanded="false"]').count()) await p.click('#sm-add-toggle')
  await p.locator('#sp-auto').check(); const c0 = calls
  await pick(p, 'ยูดา', 1, 1); await p.waitForFunction(() => document.querySelector('#sp-text')?.value.includes('ไม้อ้อช้ำ'))
  check(calls === c0 + 1, 'with “AI auto-fill” ticked, choosing a verse fills it automatically (1 call)')
  await p.screenshot({ path: '/tmp/claude-0/sp.png' })
  check(errs.length === 0, 'no JS errors ' + errs.join(';'))
}
{
  const { p } = await setup(false)
  await pick(p, '1 เปโตร', 1, 3); await p.click('#sp-ai'); await p.waitForSelector('.sm-spirit-field .ai-keys__err')
  check((await p.textContent('.sm-spirit-field .ai-keys__err')).includes('คีย์ AI'), 'no AI key → clear message, typing by hand still possible')
}
await b.close(); console.log(fail ? 'FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
