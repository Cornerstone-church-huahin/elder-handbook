import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BIBLE_BOOKS, getPassage, keyWords, parseRef, searchBible, type BibleHit, type Passage } from '../data/bible'
import { topicRefs } from '../data/bibleTopics'

export interface ScriptureSearch {
  cards: { ref: string; ps: Passage }[] | null
  full: { state: 'loading'; done: number } | { state: 'done'; hits: BibleHit[] }
}

/** ค้นข้อพระคัมภีร์ให้อัตโนมัติ: ข้อที่คัดไว้ตามหัวข้อ + คำที่ตรงกันทั้งพระคัมภีร์ (ฉบับ 1971) */
export function useScriptureSearch(text: string): ScriptureSearch {
  const term = text.trim()
  const [cards, setCards] = useState<ScriptureSearch['cards']>(null)
  const [full, setFull] = useState<ScriptureSearch['full']>({ state: 'loading', done: 0 })
  useEffect(() => {
    let alive = true
    setCards(null)
    setFull({ state: 'loading', done: 0 })
    if (!term) return
    const refs = [...(parseRef(term) ? [term] : []), ...topicRefs(term, 12)]
    Promise.all(refs.map(async (ref) => ({ ref, ps: await getPassage(ref) }))).then(
      (xs) => alive && setCards(xs.filter((x): x is { ref: string; ps: Passage } => !!x.ps && x.ps.blocks.length > 0)),
    )
    // ข้ออ้างอิง (เช่น "ยอห์น 3:16") ไม่ต้องค้นทั้งเล่ม
    if (parseRef(term)) setFull({ state: 'done', hits: [] })
    else searchBible(term, (done) => alive && setFull({ state: 'loading', done })).then((hits) => alive && setFull({ state: 'done', hits }))
    return () => {
      alive = false
    }
  }, [term])
  return { cards, full }
}

export function scriptureCount(s: ScriptureSearch): number | null {
  if (s.cards === null || s.full.state === 'loading') return null
  return s.cards.length + s.full.hits.length
}

export default function ScriptureResults({ text, data }: { text: string; data: ScriptureSearch }) {
  const [show, setShow] = useState(20)
  const term = text.trim()
  useEffect(() => setShow(20), [term])
  const words = keyWords(term)
  const { cards, full } = data

  // ไฮไลต์คำที่ตรงกันในข้อความ
  const mark = (s: string) => {
    const terms = [term, ...words].filter(Boolean).sort((a, b) => b.length - a.length)
    const first = terms.map((w) => s.indexOf(w)).filter((i) => i >= 0)
    const a = first.length ? Math.max(0, Math.min(...first) - 40) : 0
    const cut = s.slice(a, a + 170)
    const re = new RegExp(`(${terms.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
    return (
      <>
        {a > 0 && '…'}
        {cut.split(re).map((part, i) => (terms.includes(part) ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>))}
        {a + 170 < s.length && '…'}
      </>
    )
  }

  if (!term) return null
  const loading = full.state === 'loading'
  return (
    <div className="acc__inner scripture-results">
      {cards && cards.length > 0 && (
        <>
          <p className="sr-sub">📌 ข้อหลักในหัวข้อนี้</p>
          <ul className="results">
            {cards.map(({ ref, ps }) => {
              const f = ps.blocks[0]
              const preview = ps.blocks.flatMap((b) => b.verses.map((v) => v.text)).join(' ')
              return (
                <li key={ref}>
                  <Link to={`/bible/${parseRef(ref)!.book}/${f.chapter}?v=${f.verses[0].n}`} className="result sr-verse">
                    <span className="result__body">
                      <span className="result__title">{ps.label}</span>
                      <span className="sr-verse__text">{preview.length > 110 ? preview.slice(0, 110) + '…' : preview}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {loading ? (
        <p className="empty" role="status">กำลังค้นคำว่า “{term}” ทั้งพระคัมภีร์… {Math.round((full.done / 66) * 100)}%</p>
      ) : full.hits.length > 0 ? (
        <>
          <p className="sr-sub">🔎 ข้อที่มีคำว่า “{term}”{words.length > 1 ? ` (${words.join(' + ')})` : ''} · {full.hits.length.toLocaleString('th-TH')} ข้อ</p>
          <ul className="results sr-hits">
            {full.hits.slice(0, show).map((h) => (
              <li key={`${h.book}.${h.chapter}.${h.verse}`}>
                <Link to={`/bible/${h.book}/${h.chapter}?v=${h.verse}`} className="result sr-verse">
                  <span className="result__body">
                    <span className="result__title">{BIBLE_BOOKS[h.book - 1].name} {h.chapter}:{h.verse}</span>
                    <span className="sr-verse__text">{mark(h.text)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {full.hits.length > show && (
            <button type="button" className="btn btn--ghost" onClick={() => setShow(show + 30)}>แสดงเพิ่ม ({full.hits.length - show} ข้อ)</button>
          )}
        </>
      ) : (
        !cards?.length && <p className="empty">ไม่พบคำนี้ในพระคัมภีร์ ลองพิมพ์คำอื่นหรือคำที่สั้นลง</p>
      )}
      <p className="source-note">ข้อความจากพระคริสตธรรมคัมภีร์ฉบับ 1971 · แตะเพื่อเปิดอ่านและฟังต่อจากข้อนั้น</p>
    </div>
  )
}
