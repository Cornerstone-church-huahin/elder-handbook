import { useEffect, useMemo, useState } from 'react'
import { BIBLE_BOOKS, loadBook } from '../data/bible'

export interface PickedPassage {
  label: string // เช่น "1 เปโตร 1:1–3" · "1 เปโตร 1:1,3,5"
  verses: number[] // เลขข้อที่เลือก เรียงจากน้อยไปมาก
  lines: string[] // ข้อความของแต่ละข้อ ตรงกับ verses (ว่างถ้าโหลดไม่ได้)
}

/** [1,2,3,5] → "1–3,5" */
export function verseSpec(vs: number[]): string {
  const out: string[] = []
  for (let i = 0; i < vs.length; ) {
    let j = i
    while (j + 1 < vs.length && vs[j + 1] === vs[j] + 1) j++
    out.push(j > i ? `${vs[i]}–${vs[j]}` : `${vs[i]}`)
    i = j + 1
  }
  return out.join(',')
}

const digits = (s: string) => s.replace(/[๐-๙]/g, (d) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(d)))
const squash = (s: string) => digits(s).replace(/\s+/g, '')

/**
 * เลือกข้อพระคัมภีร์: พิมพ์ชื่อเล่ม (พิมพ์ "1" ขึ้น 1 ซามูเอล · 1 โครินธ์ · 1 เปโตร ฯลฯ ให้เลือกทันที)
 * → เลือกบท → ปุ่มเลขข้อทั้งหมดของบทนั้น (เช่น 20 ข้อ = เลข 1–20) แตะเลือกได้ติดกัน (1 2 3) หรือเว้น (1 3 5) หรือข้อเดียว
 * → ข้อความจากพระคัมภีร์ไทยฉบับ 1971 ขึ้นให้ทันที เรียงตามเลขข้อ
 */
export default function BiblePicker({ onChange }: { onChange: (p: PickedPassage | null) => void }) {
  const [q, setQ] = useState('')
  const [book, setBook] = useState<number | null>(null)
  const [chapters, setChapters] = useState<string[][] | null>(null)
  const [ch, setCh] = useState(1)
  const [sel, setSel] = useState<number[]>([])
  const [focus, setFocus] = useState(false)

  const hits = useMemo(() => {
    const k = squash(q)
    if (!k) return []
    const a = BIBLE_BOOKS.filter((b) => squash(b.name).startsWith(k))
    const b = BIBLE_BOOKS.filter((x) => !a.includes(x) && squash(x.name).includes(k))
    return [...a, ...b].slice(0, 8)
  }, [q])

  useEffect(() => {
    setChapters(null)
    if (!book) return
    let alive = true
    loadBook(book).then((c) => alive && setChapters(c ?? []))
    return () => { alive = false }
  }, [book])

  const bookName = book ? BIBLE_BOOKS[book - 1].name : ''
  const chapterCount = book ? BIBLE_BOOKS[book - 1].chapters : 0
  const verseCount = chapters?.[ch - 1]?.length ?? 0

  const pick = (no: number) => {
    setBook(no)
    setQ(BIBLE_BOOKS[no - 1].name)
    setCh(1); setSel([])
    setFocus(false)
  }
  const changeCh = (n: number) => { setCh(n); setSel([]) }
  const toggle = (v: number) => setSel((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v].sort((a, b) => a - b)))

  useEffect(() => {
    if (!book || !sel.length) return onChange(null)
    const chap = chapters && chapters.length ? chapters[ch - 1] : undefined
    onChange({ label: `${bookName} ${ch}:${verseSpec(sel)}`, verses: sel, lines: chap ? sel.map((v) => chap[v - 1] ?? '') : [] })
  }, [book, ch, sel, chapters]) // eslint-disable-line react-hooks/exhaustive-deps

  const nums = (n: number) => Array.from({ length: n }, (_, i) => i + 1)
  return (
    <div className="bp">
      <label className="bp__book">
        <span>📖 ข้อพระคัมภีร์ — พิมพ์ชื่อเล่ม</span>
        <input id="bp-book" value={q} placeholder="เช่น 1 เปโตร  ยอห์น  สดุดี" autoComplete="off"
          onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)}
          onChange={(e) => { setQ(e.target.value); setBook(null); setFocus(true) }} />
      </label>
      {focus && !book && hits.length > 0 && (
        <ul className="bp__hits" role="listbox" aria-label="เล่มที่ตรงกับที่พิมพ์">
          {hits.map((b) => <li key={b.no}><button type="button" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(b.no)}>{b.name}</button></li>)}
        </ul>
      )}
      {book && (
        <>
          <label className="bp__ch">บทที่
            <select id="bp-ch" value={ch} onChange={(e) => changeCh(+e.target.value)}>{nums(chapterCount).map((n) => <option key={n} value={n}>{n}</option>)}</select>
          </label>
          <div className="bp__vs" role="group" aria-label={`เลขข้อ บทที่ ${ch} (${verseCount} ข้อ)`}>
            <p className="bp__vs__h">แตะเลขข้อที่ต้องการ ({verseCount || '…'} ข้อ) — เลือกติดกัน เว้นข้อ หรือข้อเดียวก็ได้
              {sel.length > 0 && <button type="button" className="mini" onClick={() => setSel([])}>ล้าง</button>}</p>
            <div className="bp__grid">
              {nums(verseCount).map((n) => (
                <button key={n} type="button" className={`bp__v${sel.includes(n) ? ' bp__v--on' : ''}`} aria-pressed={sel.includes(n)} aria-label={`ข้อ ${n}`} onClick={() => toggle(n)}>{n}</button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
