// 💡 ตีความแบบไม่ใช้ AI: ข้ออ้างอิงโยง (ทุกข้อ) + ตีความสำเร็จรูป 50 ข้อยอดนิยม — ไม่มีคีย์ AI ก็ใช้ได้
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
let ai = 0; await ctx.route('**/generativelanguage.googleapis.com/**', (r) => { ai++; r.abort() })
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
await p.goto(URL + '#/notebook/1'); await p.waitForSelector('#nb-catsel')
await p.click('[aria-label="จัดการหมวด"]'); await p.fill('[aria-label="ชื่อหมวดใหม่"]', 'ทดสอบ'); await p.getByRole('button', { name: '💾 บันทึกหมวด' }).click(); await p.click('[aria-label="จัดการหมวด"]')
await p.click('[aria-label="เปิดหมวด ทดสอบ"]'); await p.waitForSelector('#bp-book')
const add = async (book, ch, vs) => { await p.fill('#bp-book', book); await p.click(`.bp__hits >> text=${book}`); await p.selectOption('#bp-ch', String(ch)); for (const v of vs) await p.click(`[aria-label="ข้อ ${v}"]`); await p.waitForFunction((n) => document.querySelectorAll('.sm-verses li').length === n, vs.length); await p.click('text=💾 บันทึกข้อนี้'); await p.waitForTimeout(250) }
await add('ยอห์น', 3, [16]); await add('1 เปโตร', 1, [3])
const cards = p.locator('.sm-item')
// ยอห์น 3:16 → มีทั้งข้อโยงและตีความสำเร็จรูป
await cards.nth(0).locator('[aria-label^="ตีความ"]').click(); await p.waitForSelector('.vi')
await p.waitForSelector('.vi-ref')
await p.click('#vi-allrefs'); check((await p.locator('.vi-ref').count()) > 8, 'can expand to all references')
const refs = await p.locator('.vi-ref').allTextContents()
check(refs.length >= 5 && refs.every((r) => /\d+:\d+/.test(r)), `cross-references listed for ยอห์น 3:16 (${refs.slice(0, 4).join(', ')} …)`)
check(refs.some((r) => r.startsWith('โรม 5:8')), 'includes โรม 5:8 (a classic cross-reference)')
await p.locator('.vi-ref', { hasText: 'โรม 5:8' }).first().click(); await p.waitForSelector('.vi-reftext')
check((await p.textContent('.vi-reftext')).length > 30, 'tapping a reference shows its text from the 1971 Bible: ' + (await p.textContent('.vi-reftext')).slice(0, 40))
check((await p.textContent('.vi')).includes('ตีความสำเร็จรูป') && (await p.textContent('.vi')).includes('พูดให้เข้าใจวันนี้'), 'curated interpretation (draft banner + today/apply sections) shown with no AI key')
check((await p.textContent('.vi')).includes('ให้ AI ตีความเพิ่มเติม'), 'optional AI button still offered')
await p.click('[aria-label="ปิดคำตีความ"]')
// ข้อที่ไม่มีชุดสำเร็จรูป → ยังมีข้อโยง แต่ไม่มีแบนเนอร์
await cards.nth(1).locator('[aria-label^="ตีความ"]').click(); await p.waitForSelector('.vi-ref')
check(!(await p.textContent('.vi')).includes('ตีความสำเร็จรูป') && (await p.locator('.vi-ref').count()) >= 1, 'verse without a curated entry still gets cross-references, and offers the AI button')
check(ai === 0, 'no AI call was made')
await p.screenshot({ path: '/tmp/claude-0/vx.png' })
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? 'FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
