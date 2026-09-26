// รวมข้อพระคัมภีร์ที่คำอธิษฐานในแอปใช้ (prayerLocal + คำอธิษฐานที่บันทึกไว้) เป็นไฟล์เล็ก ๆ ให้ใช้ออฟไลน์ได้ทันที
// ใช้: npx tsx scripts/build_core_verses.mjs
import fs from 'node:fs'
globalThis.fetch = async (u) => ({ ok: true, json: async () => JSON.parse(fs.readFileSync('public/' + u.replace('./', ''), 'utf8')) })
const { parseRef, getVerses } = await import('../src/data/bible.ts')
const src = fs.readFileSync('src/lib/prayerLocal.ts', 'utf8')
const refs = new Set([...src.matchAll(/ref: '([^']+)'/g)].map((m) => m[1]))
for (const p of JSON.parse(fs.readFileSync('public/data/saved-prayers.json', 'utf8')).prayers) if (p.ref) refs.add(p.ref)
const out = {}
for (const r of refs) {
  const ref = parseRef(r)
  if (!ref) throw new Error('bad ref ' + r)
  for (const v of await getVerses(ref)) out[`${ref.book}.${ref.chapter}.${v.n}`] = v.text
}
fs.writeFileSync('public/data/bible-core.json', JSON.stringify(out))
console.log(refs.size, 'refs', Object.keys(out).length, 'verses')
