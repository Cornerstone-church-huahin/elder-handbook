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
function loadBook(book: number) {
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
