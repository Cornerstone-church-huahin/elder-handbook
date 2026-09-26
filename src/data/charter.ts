/**
 * ระเบียบปฏิบัติของธรรมนูญคริสตจักรภาค 7 (ฉบับ ค.ศ. 2021)
 * ข้อมูลอยู่ใน public/data/charter-bylaws-2021.json (สร้างจาก PDF ด้วย scripts/parse_charter.py)
 * โหลดเมื่อเปิดใช้ครั้งแรกเท่านั้น เพื่อให้แอปเปิดเร็ว
 * Step B: ย้ายเข้าตาราง constitution_documents / constitution_sections
 */

export interface CharterPart { no: string; title: string }
export interface CharterChapter { no: string; title: string; parts: CharterPart[] }
export interface CharterArticle {
  no: number
  chapter: string
  part: string | null
  page_start: number
  page_end: number
  text: string
}
export interface CharterDoc {
  document_id: string
  title: string
  version: string
  effective: string
  source_file: string
  preamble: string
  chapters: CharterChapter[]
  articles: CharterArticle[]
  appendix_note: string
}

const DATA_URL = './data/charter-bylaws-2021.json'
let docPromise: Promise<CharterDoc> | null = null

export function loadCharter(): Promise<CharterDoc> {
  if (!docPromise) {
    docPromise = fetch(DATA_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<CharterDoc>
      })
      .catch((e) => {
        docPromise = null // ให้ลองโหลดใหม่ได้
        throw e
      })
  }
  return docPromise
}

export function chapterLabel(doc: CharterDoc, a: Pick<CharterArticle, 'chapter' | 'part'>): string {
  const ch = doc.chapters.find((c) => c.no === a.chapter)
  if (!ch) return ''
  const head = ch.no === 'transitional' ? ch.title : `หมวด ${ch.no} ${ch.title}`
  const part = a.part ? ch.parts.find((p) => p.no === a.part) : undefined
  return part ? `${head} › ส่วนที่ ${part.no} ${part.title}` : head
}

/** ข้อความอ้างอิงแบบเต็ม เช่น "ระเบียบปฏิบัติฯ ภาค 7 (2021) ข้อ 25 หน้า 7" */
export function citation(a: CharterArticle): string {
  const pages = a.page_start === a.page_end ? `หน้า ${a.page_start}` : `หน้า ${a.page_start}–${a.page_end}`
  return `ระเบียบปฏิบัติของธรรมนูญคริสตจักรภาค 7 (ฉบับ ค.ศ. 2021) ข้อ ${a.no} ${pages}`
}

// ---------- ค้นหา ----------
// ภาษาไทยไม่เว้นวรรคระหว่างคำ จึงใช้ "ชิ้นอักษร 3 ตัว" (trigram) เทียบกัน และให้น้ำหนักคำที่พบน้อยมากกว่าคำที่พบทุกข้อ

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')
const grams = (s: string) => {
  const t = norm(s)
  const out = new Set<string>()
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3))
  if (t.length > 0 && t.length < 3) out.add(t)
  return out
}

interface Index {
  items: { a: CharterArticle; g: Set<string>; head: Set<string>; flat: string }[]
  idf: Map<string, number>
}
const indexCache = new WeakMap<CharterDoc, Index>()

function buildIndex(doc: CharterDoc): Index {
  const items = doc.articles.map((a) => ({
    a,
    g: grams(a.text),
    head: grams(chapterLabel(doc, a)),
    flat: norm(a.text),
  }))
  const df = new Map<string, number>()
  for (const it of items) for (const g of it.g) df.set(g, (df.get(g) ?? 0) + 1)
  const N = items.length
  const idf = new Map<string, number>()
  for (const [g, n] of df) idf.set(g, Math.log(1 + N / n))
  return { items, idf }
}

export interface CharterHit { article: CharterArticle; score: number }

export function searchCharter(doc: CharterDoc, query: string, limit = 10): CharterHit[] {
  const q = query.trim()
  if (!q) return []
  // พิมพ์เลขข้อตรง ๆ เช่น "ข้อ 25" หรือ "25"
  const num = q.match(/^(?:ข้อ\s*)?(\d{1,3})$/)
  if (num) {
    const a = doc.articles.find((x) => x.no === Number(num[1]))
    return a ? [{ article: a, score: 999 }] : []
  }
  let idx = indexCache.get(doc)
  if (!idx) {
    idx = buildIndex(doc)
    indexCache.set(doc, idx)
  }
  const qg = grams(q)
  const qn = norm(q)
  const maxScore = [...qg].reduce((s, g) => s + (idx!.idf.get(g) ?? 0), 0) || 1
  const hits: CharterHit[] = []
  for (const it of idx.items) {
    let s = 0
    for (const g of qg) {
      const w = idx.idf.get(g) ?? 0
      if (it.g.has(g)) s += w
      if (it.head.has(g)) s += w * 0.6 // ตรงกับชื่อหมวด/ส่วน
    }
    if (qn.length >= 4 && it.flat.includes(qn)) s += maxScore // มีวลีที่พิมพ์ทั้งวลี
    const rel = s / maxScore
    if (rel >= 0.35) hits.push({ article: it.a, score: rel })
  }
  return hits.sort((x, y) => y.score - x.score || x.article.no - y.article.no).slice(0, limit)
}

/** แยก "ข้อ 112" ในข้อความเพื่อทำเป็นลิงก์ไปยังข้อที่อ้างถึง */
export function splitArticleRefs(text: string): (string | { no: number; label: string })[] {
  const out: (string | { no: number; label: string })[] = []
  const re = /ข้อ\s?(\d{1,3})(?![\d.])/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index === 0) continue // หัวข้อของตัวเอง
    out.push(text.slice(last, m.index), { no: Number(m[1]), label: m[0] })
    last = m.index + m[0].length
  }
  out.push(text.slice(last))
  return out
}
