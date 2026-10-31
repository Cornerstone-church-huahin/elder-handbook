// ฟังบทความ + ท่องจำพระคัมภีร์: ปุ่ม 6 ปุ่มหน้าแรก · เพิ่มการ์ด · ติ๊กเลือก · เล่นตามลำดับที่ติ๊กและวนซ้ำ · หยุด/ต่อ · ความเร็ว
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
await ctx.addInitScript(() => {
  window.__said = []; let cur = null
  const voices = [{ name: 'Google ไทย', lang: 'th-TH' }]
  window.SpeechSynthesisUtterance = function (t) { this.text = t }
  const synth = {
    speaking: false, pending: false, getVoices: () => voices,
    speak: (u) => {
      window.__said.push({ text: u.text, rate: u.rate })
      cur = { u, t: setTimeout(() => { synth.speaking = false; cur = null; u.onend && u.onend() }, 30) }; synth.speaking = true
    },
    cancel: () => { if (cur) { clearTimeout(cur.t); const u = cur.u; cur = null; setTimeout(() => u.onerror && u.onerror({ error: 'interrupted' }), 5) } synth.speaking = false },
  }
  Object.defineProperty(window, 'speechSynthesis', { value: synth })
})
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
await p.goto(URL); await p.waitForSelector('.greeting__btns')
const btns = await p.locator('.greeting__btns .urgent-btn').allInnerTexts()
check(btns.length >= 3, 'home buttons: ' + btns.join(' | '))
const hasAll = ['ฟังบทความ', 'ท่องจำพระคัมภีร์', 'แท็บ 3'].every((t) => btns.some((x) => x.includes(t)))
check(hasAll, 'new buttons present')
const ys = await p.locator('.greeting__btns .urgent-btn').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
check(new Set(ys).size <= 2, 'buttons form at most 2 rows: ' + ys.join(','))
await p.screenshot({ path: process.env.SHOT_HOME || '/tmp/home.png' })

// ---------- ท่องจำพระคัมภีร์ ----------
await p.getByRole('link', { name: /ท่องจำพระคัมภีร์/ }).click()
await p.getByRole('heading', { name: 'ท่องจำพระคัมภีร์' }).waitFor()
const verses = [['ยอห์น 3:16', 'เพราะว่าพระเจ้าทรงรักโลก'], ['สดุดี 23:1', 'พระเยโฮวาห์ทรงเป็นผู้เลี้ยงของข้าพเจ้า'], ['ฟิลิปปี 4:13', 'ข้าพเจ้าทำทุกสิ่งได้']]
for (const [r, t] of verses) {
  await p.getByRole('button', { name: /เพิ่มข้อพระคัมภีร์/ }).click()
  await p.getByPlaceholder('เช่น ยอห์น 3:16').fill(r)
  await p.getByPlaceholder(/พิมพ์หรือวางข้อความ/).fill(t)
  await p.getByRole('button', { name: 'บันทึก', exact: true }).click()
}
check(await p.locator('.lc-card').count() === 3, '3 verse cards saved')
check(await p.getByRole('button', { name: /ฟังที่เลือก/ }).isDisabled(), 'play disabled until something ticked')
await p.getByLabel('เลือกท่อง ยอห์น 3:16').check()
await p.getByLabel('เลือกท่อง ฟิลิปปี 4:13').check()
await p.getByRole('button', { name: /ฟังที่เลือก \(2\)/ }).click()
await p.waitForTimeout(1800)
const said = await p.evaluate(() => window.__said.map((x) => x.text))
const ref1 = said.findIndex((x) => x.includes('ยอห์น บทที่ 3 ข้อ 16'))
const ref3 = said.findIndex((x) => x.includes('ฟิลิปปี บทที่ 4 ข้อ 13'))
check(ref1 === 0 && ref3 > ref1, 'plays ticked 1 then 3 in order, ref spoken as บทที่/ข้อ: ' + said.slice(0, 4).join(' / '))
check(!said.some((x) => x.includes('สดุดี')), 'unticked verse not played')
check(said.filter((x) => x.includes('ยอห์น บทที่ 3')).length >= 2, 'loops back to verse 1 repeatedly')
await p.getByRole('button', { name: /หยุดชั่วคราว/ }).click()
await p.waitForTimeout(300)
const n1 = (await p.evaluate(() => window.__said.length)); await p.waitForTimeout(500)
check((await p.evaluate(() => window.__said.length)) === n1, 'pause stops playback')
check(await p.getByRole('button', { name: /ฟังต่อ/ }).isVisible(), 'resume button shown')
await p.getByRole('button', { name: /หยุดเลย/ }).click()
// ความเร็ว: เลื่อนแถบ → ใช้ค่านั้นตอนเล่นครั้งถัดไป และจำไว้
await p.locator('.nb-speed input[type=range]').fill('0')
await p.getByRole('button', { name: /ฟังที่เลือก/ }).click(); await p.waitForTimeout(200)
const rate = await p.evaluate(() => window.__said[window.__said.length - 1].rate)
check(rate === 0.4, 'speed slider applies (0.4): ' + rate)
await p.getByRole('button', { name: /หยุดเลย/ }).click()
// ข้อเดียว = วนซ้ำข้อเดียว
await p.getByRole('button', { name: 'ล้างที่เลือก' }).click()
await p.getByLabel('เลือกท่อง สดุดี 23:1').check()
await p.evaluate(() => { window.__said.length = 0 })
await p.getByRole('button', { name: /ฟังที่เลือก \(1\)/ }).click(); await p.waitForTimeout(1200)
const one = await p.evaluate(() => window.__said.map((x) => x.text))
check(one.filter((x) => x.includes('สดุดี บทที่ 23')).length >= 2, 'single verse repeats')
await p.getByRole('button', { name: /หยุดเลย/ }).click()
// ปิดวนซ้ำ: เล่นจบแล้วหยุด
await p.getByLabel(/วนอ่านซ้ำ/).uncheck()
await p.evaluate(() => { window.__said.length = 0 })
await p.getByRole('button', { name: /ฟังที่เลือก/ }).click(); await p.waitForTimeout(1200)
check((await p.evaluate(() => window.__said.length)) <= 4, 'loop off: plays once then stops')
// รีโหลด: ข้อมูลและการติ๊กยังอยู่
await p.reload(); await p.getByRole('heading', { name: 'ท่องจำพระคัมภีร์' }).waitFor()
check(await p.locator('.lc-card').count() === 3 && await p.getByLabel('เลือกท่อง สดุดี 23:1').isChecked(), 'persists after reload (cards + ticks)')

// ---------- ฟังบทความ ----------
await p.goto(URL + '#/listen'); await p.getByRole('heading', { name: 'ฟังบทความ' }).waitFor()
await p.getByRole('button', { name: /เพิ่มบทความ/ }).click()
await p.getByPlaceholder('เช่น คำเทศนาวันอาทิตย์').fill('บทความ A')
await p.getByPlaceholder(/วางหรือพิมพ์บทความ/).fill('ย่อหน้าหนึ่งของเอ\nย่อหน้าสองของเอ')
await p.getByRole('button', { name: 'บันทึก', exact: true }).click()
await p.getByRole('button', { name: /เพิ่มบทความ/ }).click()
await p.getByPlaceholder(/วางหรือพิมพ์บทความ/).fill('เนื้อบทความบี ไม่ใส่ชื่อ')
await p.getByRole('button', { name: 'บันทึก', exact: true }).click()
check(await p.locator('.lc-card').count() === 2, '2 articles saved (second auto-titled)')
await p.getByLabel('เลือกฟัง บทความ A').check()
await p.evaluate(() => { window.__said.length = 0 })
await p.getByLabel(/วนอ่านซ้ำ/).check()
await p.getByRole('button', { name: /ฟังที่เลือก \(1\)/ }).click(); await p.waitForTimeout(1500)
const art = await p.evaluate(() => window.__said.map((x) => x.text))
check(art[0].includes('บทความที่ 1 บทความ A') && art.some((x) => x.includes('ย่อหน้าสองของเอ')) && art.filter((x) => x.includes('ย่อหน้าหนึ่ง')).length >= 2, 'article read: title, paragraphs, loops: ' + art.slice(0, 4).join(' / '))
check(!art.some((x) => x.includes('บทความบี')), 'unticked article not played')
await p.getByRole('button', { name: /หยุดเลย/ }).click()
await p.screenshot({ path: process.env.SHOT_LIST || '/tmp/listen.png' })
// ผู้ชม (viewer) ไม่เห็นปุ่มเพิ่ม/แก้ไข: เช็กคลาส edit-only
check(await p.locator('.lc__add.edit-only').count() === 1, 'add button hidden for viewers (edit-only)')
check(!errs.length, 'no page errors ' + errs.join('|'))
await b.close(); process.exit(fail ? 1 : 0)
