// ปุ่มฟัง: อ่านเฉพาะแท็บที่เปิด · พระคำอ่านชื่อข้อแบบ "บทที่ ข้อ" · หยุดได้ · ปรับความเร็ว (จำลอง speechSynthesis)
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
await ctx.addInitScript(() => {
  // จำลองเสียงอ่านแบบมือถือ Android: บางวลีไม่แจ้งว่าอ่านจบ, cancel ส่ง error "interrupted", มีสัญญาณตำแหน่งคำ
  window.__said = []; let n = 0; let cur = null
  const voices = [{ name: 'Google ไทย', lang: 'th-TH' }]
  window.SpeechSynthesisUtterance = function (t) { this.text = t }
  const synth = {
    speaking: false, pending: false,
    getVoices: () => voices,
    speak: (u) => {
      window.__said.push({ text: u.text, rate: u.rate, lang: u.lang })
      const k = ++n; const words = [...u.text.matchAll(/\S+/g)]; const step = window.__slow ? 120 : 8
      cur = { u, timers: [] }; synth.speaking = true
      words.forEach((m, i) => cur.timers.push(setTimeout(() => u.onboundary && u.onboundary({ charIndex: m.index }), i * step)))
      const me = cur
      cur.timers.push(setTimeout(() => { synth.speaking = false; if (k % 4 !== 0) u.onend && u.onend() /* ทุกวลีที่ 4 ไม่แจ้งอ่านจบ */ ; if (cur === me) cur = null }, words.length * step + 20))
    },
    cancel: () => { if (cur) { cur.timers.forEach(clearTimeout); const u = cur.u; cur = null; setTimeout(() => u.onerror && u.onerror({ error: 'interrupted' }), 5) } synth.speaking = false },
  }
  Object.defineProperty(window, 'speechSynthesis', { value: synth })
})
const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
await p.goto(URL); await p.waitForSelector('.action')
check(await p.locator('.action:has-text("สิ่งที่ควรติดตาม")').count() === 0, 'old tile name removed')
check(await p.locator('.action:has-text("พิธี / วันสำคัญ")').count() === 0 && await p.locator('.action:has-text("วันสำคัญ")').count() === 1, 'days tile renamed วันสำคัญ')
await p.click('.action:has-text("เตรียมพิธี")'); await p.waitForSelector('.occ-list')
check((await p.textContent('h1')).includes('เตรียมพิธี') && await p.locator('.occ-tabs').count() === 0, 'เตรียมพิธี page (no days tab)')
check(await p.locator('.occ-list .result').count() === 9, '9 ceremonies listed')
check((await p.textContent('.occ-list .result >> nth=0')).includes('การนำรับเชื่อ'), 'leading to faith is listed first')
check(!(await p.textContent('.occ-list')).includes('คริสต์มาส'), 'no days inside เตรียมพิธี')
await p.click('.occ-list .result:has-text("บัพติศมา")'); await p.waitForSelector('.occ-subtabs')
const subs = await p.locator('.occ-subtabs button').allTextContents()
check(subs.length === 4 && subs[0].includes('ความเป็นมา') && subs[1].includes('ความหมาย') && subs[2].trim() === '📋 ขั้นตอน' && subs[3].includes('อธิษฐาน'), '4 sub-tabs (ceremony): ' + subs.join(' | '))
const tops = await p.$$eval('.occ-subtabs button', (a) => a.map((x) => Math.round(x.getBoundingClientRect().top)))
check(new Set(tops).size === 1, '4 sub-tabs in one row: ' + tops)
check((await p.textContent('.occ-body')).includes('ยอห์นผู้ให้บัพติศมา'), 'history content shown')
await p.click('.occ-subtabs >> text=ความหมาย'); check((await p.textContent('.occ-body')).includes('เครื่องหมายภายนอก'), 'meaning tab')
await p.click('.occ-subtabs >> text=ขั้นตอน'); check(await p.locator('.occ-plan').count() >= 3, 'occasions & steps tab')
await p.click('.ref-read__toggle >> nth=0'); await p.waitForSelector('.ref-read__chapter'); check((await p.textContent('.ref-read__body')).length > 50, 'verse opens TH1971 text')
await p.click('.occ-subtabs >> text=อธิษฐาน')
const pr = await p.textContent('.occ-body')
check(pr.includes('คำถามคำปฏิญาณ') && pr.includes('ข้าพเจ้าให้บัพติศมาแก่ท่าน'), 'prayer tab: vows + baptism words')
const heads = await p.$$eval('.occ-prayer h3', (a) => a.map((x) => x.textContent))
check(heads[0].includes('คำกล่าวนำ') && heads.at(-1).includes('คำอวยพรปิด') && heads.some((h) => h.includes('คำอธิษฐานปิด')), 'prayer script runs opening → closing prayer → benediction: ' + heads.join(' / '))
// ฟังต่อเนื่อง: เริ่มที่ความเป็นมา → ความหมาย → ขั้นตอน → อธิษฐาน แท็บเปลี่ยนเอง
await p.click('.occ-subtabs >> text=ความเป็นมา')
await p.evaluate(() => (window.__said = [])); await p.click('[aria-label="ฟังต่อเนื่อง"]')
await p.waitForFunction(() => location.hash.includes('tab=meaning'), null, { timeout: 60000 }); check(true, 'auto moved to meaning tab')
await p.waitForFunction(() => location.hash.includes('tab=plan'), null, { timeout: 60000 }); check(true, 'auto moved to plan tab')
await p.waitForFunction(() => location.hash.includes('tab=prayer'), null, { timeout: 90000 }); check(true, 'auto moved to prayer tab')
await p.waitForFunction(() => window.__said.some((x) => x.text.includes('อาเมน')), null, { timeout: 90000 })
const said = await p.evaluate(() => window.__said.map((x) => x.text).join(' '))
const order = ['พิธีบัพติศมา', 'ความเป็นมา.', 'ความหมาย.', 'ขั้นตอน.', 'คำกล่าวและคำอธิษฐาน.'].map((k) => said.indexOf(k))
check(order.every((x, i) => x >= 0 && (i === 0 || x > order[i - 1])), 'read in order title → history → meaning → plan → prayer: ' + order)
check(!said.includes('28:19'), 'refs spoken as บทที่/ข้อ')
await p.click('[aria-label="หยุดชั่วคราว"]').catch(() => {})
await p.goto(URL + '#/occasions/salvation?tab=prayer'); await p.waitForFunction(() => location.hash.startsWith('#/service/salvation'))
check(true, 'old /occasions/<rite> link redirects to /service'); await p.waitForSelector('.occ-prayer')
const sv = await p.textContent('.occ-body')
check(sv.includes('คำนำรับเชื่อ') && sv.includes('คำอธิษฐานรับเชื่อ') && sv.includes('อวยพรผู้เชื่อใหม่'), 'salvation prayer tab has lead-in + sinner prayer + blessing')
await p.goto(URL + '#/occasions/wedding?tab=prayer'); await p.waitForSelector('.occ-prayer')
const wh = await p.$$eval('.occ-prayer h3', (a) => a.map((x) => x.textContent))
check(wh[1].includes('คำอธิษฐานเปิด') && wh.at(-1).includes('คำอวยพรปิด') && wh.some((h) => h.includes('คำปฏิญาณ')), 'wedding script opening prayer → vows → benediction')
// วันสำคัญ
await p.goto(URL + '#/occasions'); await p.waitForSelector('.occ-next li')
check(!(await p.textContent('.occ-list')).includes('บัพติศมา'), 'no rites inside วันสำคัญ')
check(await p.locator('.occ-list .result').count() === 11 && await p.locator('.occ-next li').count() === 4, 'days tab: 11 days + upcoming list')
await p.click('.occ-list .result:has-text("อีสเตอร์")'); await p.click('.occ-subtabs >> text=วันที่จัด'); await p.waitForSelector('.occ-dates li')
const d = await p.textContent('.occ-dates')
check(d.includes('28 มี.ค. 2570') || d.includes('28 มี.ค. 2027'), 'Easter 2027 computed = 28 Mar: ' + d.slice(0, 80))
await p.click('.occ-dates li >> nth=0 >> text=เพิ่มลงโน้ต'); await p.waitForTimeout(200)
await p.goto(URL + '#/notes'); await p.waitForSelector('.notes-head'); check((await p.textContent('.notes')).includes('วันอาทิตย์อีสเตอร์'), 'added to notes')
await p.goto(URL + '#/occasions/christmas'); await p.waitForSelector('.occ-body'); await p.screenshot({ path: '/tmp/claude-0/shots/occ.png' })
// อ่านจบเรื่องหนึ่ง → ต่อเรื่องถัดไปในหมวดเดียวกันอัตโนมัติ
await p.goto(URL + '#/service/salvation'); await p.waitForSelector('.occ-body p')
check((await p.textContent('.story__auto')).includes('พิธีบัพติศมา'), 'auto-next toggle shows next rite')
await p.evaluate(() => (window.__said = [])); await p.click('[aria-label="ฟังต่อเนื่อง"]')
await p.waitForFunction(() => location.hash.startsWith('#/service/baptism'), null, { timeout: 180000 })
await p.waitForFunction(() => window.__said.some((x) => x.text === 'พิธีบัพติศมา'), null, { timeout: 20000 })
const s2 = await p.evaluate(() => window.__said.map((x) => x.text).join(' | '))
check(s2.indexOf('จบการนำรับเชื่อ ต่อไปคือพิธีบัพติศมา') > s2.indexOf('คำกล่าวและคำอธิษฐาน.') && s2.lastIndexOf('| พิธีบัพติศมา') > s2.indexOf('จบการนำรับเชื่อ'), 'salvation → baptism read continuously')
check(await p.locator('[aria-label="หยุดชั่วคราว"]').count() === 1 && (await p.textContent('.occ-title')).includes('บัพติศมา'), 'baptism page is playing')
await p.click('[aria-label="หยุดชั่วคราว"]').catch(() => {})
await p.goto(URL + '#/occasions/advent'); await p.waitForSelector('.occ-body p')
check((await p.textContent('.story__auto')).includes('คริสต์มาส'), 'days also continue (advent → christmas)')
await p.goto(URL + '#/service/anointing'); await p.waitForSelector('.occ-body p')
check(await p.locator('.story__auto').count() === 0, 'last rite has no auto-next (does not jump into days)')
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
