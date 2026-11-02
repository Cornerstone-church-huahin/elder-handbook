/**
 * ข้ออ้างอิงโยง (cross-references) — ข้อที่พระคัมภีร์เองใช้โยงถึงกัน ("พระคัมภีร์ตีความพระคัมภีร์")
 * ข้อมูลมาจาก Treasury of Scripture Knowledge (ผ่านชุดข้อมูล MetaV / bible-cross-reference-json) · เก็บเป็นไฟล์รายเล่มใน public/data/xref
 * ที่นี่เก็บเฉพาะ "ตำแหน่งข้อ" ส่วนข้อความที่แสดงดึงจากฉบับ 1971 ในแอป — ไม่ใช้ AI ไม่ใช้โควต้า
 */
import { BIBLE_BOOKS, loadBook, parseRef } from '../data/bible'

const cache = new Map<number, Promise<number[][][] | null>>()
function loadXref(book: number) {
  if (!cache.has(book)) {
    cache.set(
      book,
      fetch(`./data/xref/${book}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { c: number[][][] } | null) => d?.c ?? null)
        .catch(() => { cache.delete(book); return null }),
    )
  }
  return cache.get(book)!
}

export interface XrefItem { label: string; book: number; ch: number; v: number }
const decode = (n: number): XrefItem => {
  const book = Math.floor(n / 1_000_000), ch = Math.floor((n % 1_000_000) / 1000), v = n % 1000
  return { label: `${BIBLE_BOOKS[book - 1].name} ${ch}:${v}`, book, ch, v }
}

/** ข้ออ่านประกอบของข้อ/ช่วงข้อในการ์ด (รวมทุกข้อ ตัดซ้ำ ตัดข้อที่อยู่ในช่วงเดียวกัน และข้อที่ไม่มีในฉบับ 1971) */
export async function xrefsFor(label: string): Promise<XrefItem[]> {
  const r = parseRef(label)
  if (!r || !r.verses.length) return []
  const data = await loadXref(r.book)
  const rows = data?.[r.chapter - 1]
  if (!rows) return []
  const seen = new Set<number>()
  const out: number[] = []
  for (const v of r.verses) for (const n of rows[v - 1] ?? []) if (!seen.has(n)) { seen.add(n); out.push(n) }
  const items = out.map(decode).filter((x) => !(x.book === r.book && x.ch === r.chapter && r.verses.includes(x.v)))
  // ตรวจว่ามีข้อนั้นจริงในฉบับ 1971 (เลขข้อของบางเล่มต่างกันเล็กน้อย)
  const books = [...new Set(items.map((x) => x.book))]
  const loaded = new Map(await Promise.all(books.map(async (b) => [b, await loadBook(b)] as const)))
  return items.filter((x) => !!loaded.get(x.book)?.[x.ch - 1]?.[x.v - 1])
}
