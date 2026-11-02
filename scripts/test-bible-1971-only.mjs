// พระคัมภีร์ทั้งระบบใช้ฉบับ 1971 (TH1971) ฉบับเดียว: ไม่มีข้อมูล/โค้ดของฉบับอื่น · ข้อชุดสำรองออฟไลน์ตรงกับ 1971 · ลิงก์ภายนอกเป็นฉบับ 1971 (bible.com id 275)
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
const walk = (d, out = []) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p, out) : out.push(p) } return out }
const src = [...walk('src'), 'vite.config.ts', 'index.html'].filter((f) => /\.(ts|tsx|html|css)$/.test(f))
const forbidden = /World English|bible-en|loadBookEn|EN_BOOKS|\b(KJV|NIV|ESV|NASB|NLT|TNCV|THSV|TH-?KJV)\b|\bWEB\b/
const bad = src.filter((f) => forbidden.test(readFileSync(f, 'utf8')))
check(bad.length === 0, 'no other Bible version referenced in source' + (bad.length ? ': ' + bad.join(', ') : ''))
check(!existsSync('public/data/bible-en') && !existsSync('scripts/build_bible_en.py'), 'no English Bible data/builder in repo')
const ids = new Set(); for (const f of src) for (const m of readFileSync(f, 'utf8').matchAll(/bible\.com\/(?:th\/)?bible\/(\d+)/g)) ids.add(m[1])
check([...ids].every((x) => x === '275'), 'external bible.com links all use version 275 (TH1971): ' + [...ids].join(','))
// ข้อชุดสำรองออฟไลน์ต้องตรงกับไฟล์ 1971
const core = JSON.parse(readFileSync('public/data/bible-core.json', 'utf8')); let ok = 0; const norm = (s) => s.replace(/\s+/g, '')
for (const [k, v] of Object.entries(core)) { const [b, c, n] = k.split('.').map(Number); const t = JSON.parse(readFileSync(`public/data/bible/${b}.json`, 'utf8')).c[c - 1][n - 1]; if (norm(t) === norm(v)) ok++ }
check(ok === Object.keys(core).length, `offline core verses identical to 1971 (${ok}/${Object.keys(core).length})`)
check(readdirSync('public/data/bible').length === 66, '66 books of TH1971 present')
console.log(fail ? 'FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
