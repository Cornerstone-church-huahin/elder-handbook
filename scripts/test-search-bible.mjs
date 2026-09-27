// ค้นหา: บุคคล → ข้อพระคัมภีร์ → ธรรมนูญ/ระเบียบ · ข้อพระคัมภีร์จากหัวข้อ + ค้นทั้งเล่ม
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4173/index.html'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const p = await b.newPage({ viewport: { width: 390, height: 844 } })
const errs = []; p.on('pageerror', (e) => errs.push(e.message))
await p.goto(URL + '#/search?q=' + encodeURIComponent('ผู้ปกครอง')); await p.waitForSelector('.scripture-results .sr-verse')
const heads = await p.locator('.section__title').allTextContents()
const iP = heads.findIndex((h) => h.includes('บุคคล')), iS = heads.findIndex((h) => h.includes('ข้อพระคัมภีร์')), iC = heads.findIndex((h) => h.includes('ธรรมนูญ'))
check(iP >= 0 && iP < iS && iS < iC, 'order: people → scripture → charter/rules ' + heads.join(' | '))
const refs = await p.locator('.scripture-results .result__title').allTextContents()
check(refs[0] === '1 ทิโมธี 3:1–7' && refs.includes('ทิตัส 1:5–9') && refs.includes('1 เปโตร 5:1–4'), 'elder passages listed: ' + refs.slice(0, 4).join(', '))
check((await p.locator('.sr-verse__text').first().textContent()).includes('ผู้ปกครองดูแลคริสตจักร'), 'shows real TH1971 text preview')
const people = await p.locator('.person-chip').allTextContents()
check(!people.some((x) => x.includes('อับราฮัม') || x.includes('ซาราห์')), 'no unrelated people (Abraham/Sarah) for ผู้ปกครอง: ' + people.map(x=>x.slice(0,8)).join(','))
await p.click('.sr-full'); await p.waitForSelector('.sr-hits .sr-verse', { timeout: 60000 })
const found = await p.textContent('.scripture-results .source-note')
check(/พบคำว่า “ผู้ปกครอง” [\d,]+ ข้อ/.test(found), 'full-Bible search count: ' + found)
check(await p.locator('.sr-hits mark').first().textContent() === 'ผู้ปกครอง', 'term highlighted')
await p.click('.scripture-results .sr-verse >> nth=0'); await p.waitForSelector('.bv--sel')
check((await p.textContent('.bible-head__title')).includes('1 ทิโมธี 3') && (await p.textContent('.bv--sel')).startsWith('1'), 'tap opens reader at the verse')
// ค้นเป็นข้ออ้างอิง
await p.goto(URL + '#/search?q=' + encodeURIComponent('ยอห์น 3:16')); await p.waitForSelector('.scripture-results .sr-verse')
check((await p.locator('.scripture-results .result__title').first().textContent()) === 'ยอห์น 3:16', 'reference query shows that verse first')
// หัวข้ออื่น
await p.goto(URL + '#/search?q=' + encodeURIComponent('ลูกป่วยหนัก')); await p.waitForSelector('.scripture-results .sr-verse')
check((await p.locator('.scripture-results .result__title').first().textContent()).startsWith('ยากอบ 5'), 'illness query → James 5 first')
await p.goto(URL + '#/search?q=' + encodeURIComponent('ผู้ปกครอง')); await p.waitForSelector('.scripture-results .sr-verse'); await p.waitForTimeout(300)
await p.locator('.scripture-results').scrollIntoViewIfNeeded(); await p.screenshot({ path: '/tmp/claude-0/shots/search-bible.png' })
check(errs.length === 0, 'no JS errors ' + errs.join(';'))
await b.close(); console.log(fail ? fail + ' FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
