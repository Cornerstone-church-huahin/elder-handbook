/**
 * พระคัมภีร์ไทย ฉบับ 1971 (TH1971) — อ่านข้อความจริงจากไฟล์ public/data/bible/<เล่ม>.json
 * (สร้างโดย scripts/build_bible.py จากต้นฉบับ TH1971) ข้อความพระคัมภีร์ในแอปมาจากที่นี่เท่านั้น
 * AI ให้ได้แค่ "ข้ออ้างอิง" แล้วแอปดึงข้อความจริงมาแสดง — ถ้าหาไม่พบจะไม่แสดงข้อความเอง
 */

// ชื่อเล่ม (ตามฉบับ 1971) + ชื่อที่มักเขียนแบบอื่น · ลำดับ = หมายเลขเล่ม 1–66 · รหัส USFM สำหรับลิงก์ bible.com
const BOOKS: [string[], string][] = [
  [['ปฐมกาล'], 'GEN'], [['อพยพ'], 'EXO'], [['เลวีนิติ'], 'LEV'], [['กันดารวิถี'], 'NUM'], [['เฉลยธรรมบัญญัติ'], 'DEU'],
  [['โยชูวา'], 'JOS'], [['ผู้วินิจฉัย', 'วินิจฉัย'], 'JDG'], [['นางรูธ', 'รูธ'], 'RUT'], [['1 ซามูเอล'], '1SA'], [['2 ซามูเอล'], '2SA'],
  [['1 พงศ์กษัตริย์'], '1KI'], [['2 พงศ์กษัตริย์'], '2KI'], [['1 พงศาวดาร'], '1CH'], [['2 พงศาวดาร'], '2CH'], [['เอสรา'], 'EZR'],
  [['เนหะมีย์'], 'NEH'], [['เอสเธอร์'], 'EST'], [['โยบ'], 'JOB'], [['สดุดี'], 'PSA'], [['สุภาษิต'], 'PRO'],
  [['ปัญญาจารย์'], 'ECC'], [['เพลงซาโลมอน', 'เพลงโซโลมอน', 'เพลงไพเราะ'], 'SNG'], [['อิสยาห์'], 'ISA'], [['เยเรมีย์'], 'JER'], [['เพลงคร่ำครวญ'], 'LAM'],
  [['เอเสเคียล'], 'EZK'], [['ดาเนียล'], 'DAN'], [['โฮเชยา'], 'HOS'], [['โยเอล'], 'JOL'], [['อาโมส'], 'AMO'],
  [['โอบาดีห์'], 'OBA'], [['โยนาห์'], 'JON'], [['มีคาห์'], 'MIC'], [['นาฮูม'], 'NAM'], [['ฮาบากุก'], 'HAB'],
  [['เศฟันยาห์'], 'ZEP'], [['ฮักกัย'], 'HAG'], [['เศคาริยาห์'], 'ZEC'], [['มาลาคี'], 'MAL'],
  [['มัทธิว'], 'MAT'], [['มาระโก'], 'MRK'], [['ลูกา'], 'LUK'], [['ยอห์น'], 'JHN'], [['กิจการของอัครทูต', 'กิจการ'], 'ACT'],
  [['โรม'], 'ROM'], [['1 โครินธ์'], '1CO'], [['2 โครินธ์'], '2CO'], [['กาลาเทีย'], 'GAL'], [['เอเฟซัส'], 'EPH'],
  [['ฟีลิปปี'], 'PHP'], [['โคโลสี'], 'COL'], [['1 เธสะโลนิกา'], '1TH'], [['2 เธสะโลนิกา'], '2TH'], [['1 ทิโมธี'], '1TI'],
  [['2 ทิโมธี'], '2TI'], [['ทิตัส'], 'TIT'], [['ฟีเลโมน'], 'PHM'], [['ฮีบรู'], 'HEB'], [['ยากอบ'], 'JAS'],
  [['1 เปโตร'], '1PE'], [['2 เปโตร'], '2PE'], [['1 ยอห์น'], '1JN'], [['2 ยอห์น'], '2JN'], [['3 ยอห์น'], '3JN'],
  [['ยูดา'], 'JUD'], [['วิวรณ์'], 'REV'],
]

const thaiDigits = (s: string) => s.replace(/[๐-๙]/g, (d) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(d)))

// ชื่อยาวก่อน เพื่อไม่ให้ "ยอห์น" จับ "1 ยอห์น"
const NAMES = BOOKS.flatMap(([names], i) => names.map((n) => ({ n, book: i + 1 }))).sort((a, b) => b.n.length - a.n.length)

export interface VerseRef {
  book: number
  name: string // ชื่อเล่มตามฉบับ 1971
  chapter: number
  verses: number[] // ว่าง = ทั้งบท (ไม่แสดงข้อความ ให้เปิดอ่านเอง)
  label: string // ข้ออ้างอิงที่จัดรูปแบบแล้ว
}

/** แปลงข้ออ้างอิงภาษาไทย เช่น "ยอห์น 11:25–26", "1 พงศ์กษัตริย์ 17:16", "สดุดี 37:5,7" → VerseRef */
export function parseRef(input: string): VerseRef | null {
  const s = thaiDigits(input).replace(/\s+/g, ' ').replace(/^(\d)\s*/, '$1 ').trim()
  const hit = NAMES.find(({ n }) => s.startsWith(n))
  if (!hit) return null
  const rest = s.slice(hit.n.length).trim()
  const m = rest.match(/^(\d+)(?:\s*:\s*([\d\s,–—-]+))?/)
  if (!m) return null
  const chapter = +m[1]
  const verses: number[] = []
  for (const part of (m[2] ?? '').split(',')) {
    const r = part.trim().match(/^(\d+)(?:\s*[–—-]\s*(\d+))?$/)
    if (!r) continue
    const a = +r[1]
    const b = r[2] ? +r[2] : a
    for (let v = a; v <= Math.min(b, a + 11); v++) verses.push(v)
  }
  const name = BOOKS[hit.book - 1][0][0]
  return { book: hit.book, name, chapter, verses, label: `${name} ${chapter}${m[2] ? ':' + m[2].replace(/\s+/g, '').replace(/-/g, '–') : ''}` }
}

/** ลิงก์เปิดอ่านบน bible.com (ฉบับ 1971) — เปิดแอป YouVersion ได้ถ้าติดตั้งไว้ */
export function refUrl(r: VerseRef): string {
  const code = BOOKS[r.book - 1][1]
  const v = r.verses.length ? `.${r.verses[0]}${r.verses.length > 1 ? '-' + r.verses[r.verses.length - 1] : ''}` : ''
  return `https://www.bible.com/th/bible/275/${code}.${r.chapter}${v}.TH1971`
}

const cache = new Map<number, Promise<string[][] | null>>()
export function loadBook(book: number) {
  if (!cache.has(book)) {
    cache.set(
      book,
      fetch(`./data/bible/${book}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { c: string[][] } | null) => d?.c ?? null)
        .catch(() => {
          cache.delete(book)
          return null
        }),
    )
  }
  return cache.get(book)!
}

export interface VerseText { n: number; text: string }

/** ดึงข้อความจริงของข้อที่อ้างอิง (สูงสุด 12 ข้อ) — คืน [] ถ้าไม่พบ */
export async function getVerses(r: VerseRef): Promise<VerseText[]> {
  if (!r.verses.length) return []
  const c = await loadBook(r.book)
  const ch = c?.[r.chapter - 1]
  if (ch) return r.verses.map((n) => ({ n, text: ch[n - 1] ?? '' })).filter((v) => v.text)
  // ออฟไลน์และยังไม่เคยเปิดเล่มนี้: ใช้ชุดข้อที่คำอธิษฐานในแอปใช้ (bible-core.json เก็บในเครื่องตั้งแต่ติดตั้ง)
  const core = await loadCore()
  return r.verses.map((n) => ({ n, text: core?.[`${r.book}.${r.chapter}.${n}`] ?? '' })).filter((v) => v.text)
}

let corePromise: Promise<Record<string, string> | null> | null = null
function loadCore() {
  if (!corePromise) {
    corePromise = fetch('./data/bible-core.json')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => {
        corePromise = null
        return null
      })
  }
  return corePromise
}

export interface PassageBlock { chapter: number; verses: VerseText[] }
export interface Passage { label: string; url: string; blocks: PassageBlock[] }

/**
 * อ่านช่วงพระคัมภีร์เต็มจากฉบับ 1971 (ไม่จำกัด 12 ข้อ) รองรับ:
 * "ปฐมกาล 3" · "ปฐมกาล 2–3" · "โรม 5:12–19" · "อพยพ 35:30–36:1" · "1 โครินธ์ 15:22, 45" · "ยูดา 14–15" (เล่มที่มีบทเดียว)
 * คืน null ถ้าอ่านข้ออ้างอิงไม่ได้ · blocks ว่างถ้าโหลดไฟล์ไม่ได้ (ออฟไลน์)
 */
export async function getPassage(input: string): Promise<Passage | null> {
  const head = parseRef(input)
  if (!head) return null
  const s = thaiDigits(input).replace(/\s+/g, ' ').replace(/^(\d)\s*/, '$1 ').trim()
  const hit = NAMES.find(({ n }) => s.startsWith(n))!
  const body = s.slice(hit.n.length).replace(/[—-]/g, '–').replace(/\s+/g, '')
  const c = await loadBook(head.book)
  const url = refUrl(head)
  if (!c) return { label: `${head.name} ${body}`, url, blocks: [] }
  const chap = (n: number) => c[n - 1] ?? []
  const pick = (ch: number, a: number, b: number): PassageBlock => ({
    chapter: ch,
    verses: chap(ch).slice(a - 1, b).map((text, i) => ({ n: a + i, text })).filter((v) => v.text),
  })
  const blocks: PassageBlock[] = []
  const one = c.length === 1
  let m: RegExpMatchArray | null
  if ((m = body.match(/^(\d+):(\d+)–(\d+):(\d+)$/))) {
    const [c1, v1, c2, v2] = m.slice(1).map(Number)
    for (let ch = c1; ch <= c2; ch++) blocks.push(pick(ch, ch === c1 ? v1 : 1, ch === c2 ? v2 : chap(ch).length))
  } else if ((m = body.match(/^(\d+):(.+)$/))) {
    const ch = +m[1]
    for (const part of m[2].split(',')) {
      const r = part.match(/^(\d+)(?:–(\d+))?$/)
      if (r) blocks.push(pick(ch, +r[1], r[2] ? +r[2] : +r[1]))
    }
  } else if ((m = body.match(/^(\d+)(?:–(\d+))?$/))) {
    const a = +m[1]
    const b = m[2] ? +m[2] : a
    if (one) blocks.push(pick(1, a, b)) // ยูดา 14–15 = ข้อ 14–15
    else for (let ch = a; ch <= b; ch++) blocks.push(pick(ch, 1, chap(ch).length))
  }
  // รวมช่วงที่อยู่บทเดียวกัน (เช่น 15:22, 45)
  const merged: PassageBlock[] = []
  for (const bl of blocks) {
    const last = merged[merged.length - 1]
    if (last && last.chapter === bl.chapter) last.verses.push(...bl.verses)
    else merged.push({ ...bl, verses: [...bl.verses] })
  }
  const out = merged.filter((b) => b.verses.length)
  const f = out[0]
  const gap = !!f && f.verses.some((v, i) => i > 0 && v.n !== f.verses[i - 1].n + 1) // เช่น 15:22, 45 → เปิดทั้งบท
  const whole = !f || gap || out.length > 1 || f.verses.length === chap(f.chapter).length
  const link = f ? refUrl({ ...head, chapter: f.chapter, verses: whole ? [] : [f.verses[0].n, f.verses[f.verses.length - 1].n] }) : url
  return { label: `${head.name} ${body.replace(/,/g, ', ')}`, url: link, blocks: out }
}

const CHAPTERS = [50, 40, 27, 36, 34, 24, 21, 4, 31, 24, 22, 25, 29, 36, 10, 13, 10, 42, 150, 31, 12, 8, 66, 52, 5, 48, 12, 14, 3, 9, 1, 4, 7, 3, 3, 3, 2, 14, 4, 28, 16, 24, 21, 28, 16, 16, 13, 6, 6, 4, 4, 5, 3, 6, 4, 3, 1, 13, 5, 5, 3, 5, 1, 1, 1, 22]
export interface BibleBook { no: number; name: string; code: string; chapters: number; testament: 'old' | 'new' }
/** รายชื่อ 66 เล่มตามฉบับ 1971 (ปฐมกาล → วิวรณ์) */
export const BIBLE_BOOKS: BibleBook[] = BOOKS.map(([names, code], i) => ({ no: i + 1, name: names[0], code, chapters: CHAPTERS[i], testament: i < 39 ? 'old' : 'new' }))
export const chapterUrl = (book: number, ch: number, v?: [number, number]) =>
  `https://www.bible.com/th/bible/275/${BOOKS[book - 1][1]}.${ch}${v ? `.${v[0]}${v[1] !== v[0] ? '-' + v[1] : ''}` : ''}.TH1971`

export interface BibleHit { book: number; chapter: number; verse: number; text: string; score: number }

// คำเชื่อมที่ไม่ต้องใช้ในการค้น (พิมพ์ "พ่อตาโมเสส" ก็เจอ "พ่อตาของโมเสส")
const STOP = new Set(['ของ', 'ที่', 'และ', 'ใน', 'กับ', 'เป็น', 'ได้', 'ให้', 'แก่', 'แห่ง', 'ซึ่ง', 'จะ', 'ก็', 'ไป', 'มา', 'คือ', 'เรื่อง', 'เกี่ยวกับ', 'ข้อ', 'บท', 'พระคัมภีร์', 'ว่า', 'the', 'of', 'and'])

const PREFIX = new Set(['ผู้', 'การ', 'ความ', 'นัก', 'ชาว', 'หญิง', 'ชาย', 'ช่าง', 'พระ'])

/** แยกคำค้นภาษาไทยเป็นคำสำคัญ (ใช้ตัวตัดคำของเครื่อง) เช่น "พ่อตาโมเสส" → ["พ่อตา", "โมเสส"] */
export function keyWords(term: string): string[] {
  const t = term.trim()
  if (!t) return []
  let parts: string[] = t.split(/\s+/)
  try {
    const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => { segment: (s: string) => Iterable<{ segment: string; isWordLike?: boolean }> } }).Segmenter
    if (Seg) parts = [...new Seg('th', { granularity: 'word' }).segment(t)].filter((x) => x.isWordLike !== false).map((x) => x.segment.trim())
  } catch {
    /* เครื่องเก่า: ใช้การเว้นวรรค */
  }
  // คำนำหน้า เช่น ผู้/การ/ความ รวมกับคำถัดไป ("ผู้" + "ปกครอง" → "ผู้ปกครอง")
  const joined: string[] = []
  for (let i = 0; i < parts.length; i++) {
    const w = parts[i]
    if (PREFIX.has(w) && i + 1 < parts.length) {
      parts[i + 1] = w + parts[i + 1]
      continue
    }
    joined.push(w)
  }
  const out = joined.filter((w) => w && !STOP.has(w))
  // รวมคำที่ถูกตัดสั้นเกินไป (1 ตัวอักษร) เข้ากับคำก่อนหน้า
  const merged: string[] = []
  for (const w of out) {
    if (w.length <= 1 && merged.length) merged[merged.length - 1] += w
    else merged.push(w)
  }
  return [...new Set(merged)]
}

/**
 * ค้นในพระคัมภีร์ทั้งเล่ม (ฉบับ 1971) แบบ "คำตรงกัน":
 * ตรงทั้งวลี > มีครบทุกคำสำคัญ (ไม่ต้องติดกัน) > ขาดไปหนึ่งคำ (เมื่อพิมพ์ตั้งแต่ 3 คำ)
 * onProgress(เล่มที่ค้นแล้ว, 66)
 */
export async function searchBible(term: string, onProgress?: (done: number, total: number) => void): Promise<BibleHit[]> {
  const t = term.trim()
  if (!t) return []
  const words = keyWords(t)
  const need = words.length >= 3 ? words.length - 1 : words.length
  const hits: BibleHit[][] = Array.from({ length: 66 }, () => [])
  let done = 0
  let next = 1
  const worker = async () => {
    while (next <= 66) {
      const b = next++
      const c = await loadBook(b)
      c?.forEach((vs, ci) =>
        vs.forEach((text, vi) => {
          let score = 0
          if (text.includes(t)) score = 100
          else if (words.length) {
            const n = words.filter((w) => text.includes(w)).length
            const pos = words.map((w) => text.indexOf(w)).filter((x) => x >= 0)
            const span = pos.length ? Math.max(...pos) - Math.min(...pos) : 0
            // ต้องมีคำครบ (หรือขาดหนึ่งคำเมื่อพิมพ์หลายคำ) และคำอยู่ไม่ห่างกันเกินไป
            if (n >= need && n > 0 && span <= 60) {
              score = 10 * n + Math.max(0, 30 - span / 2)
              if (n === words.length) score += 20
            }
          }
          if (score) hits[b - 1].push({ book: b, chapter: ci + 1, verse: vi + 1, text, score })
        }),
      )
      onProgress?.(++done, 66)
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
  return hits.flat().sort((x, y) => y.score - x.score || x.book - y.book || x.chapter - y.chapter || x.verse - y.verse)
}

// ---------- ภาษาอังกฤษ: World English Bible (WEB, สาธารณสมบัติ) — ฉบับแปลที่พิมพ์แล้ว ไม่ใช้ AI แปล ----------
const enCache = new Map<number, Promise<string[][] | null>>()
export const EN_BOOKS = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation']
export function loadBookEn(book: number) {
  if (!enCache.has(book)) {
    enCache.set(
      book,
      fetch(`./data/bible-en/${book}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { c: string[][] } | null) => d?.c ?? null)
        .catch(() => {
          enCache.delete(book)
          return null
        }),
    )
  }
  return enCache.get(book)!
}
