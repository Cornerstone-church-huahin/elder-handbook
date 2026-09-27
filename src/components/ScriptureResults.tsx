import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BIBLE_BOOKS, getPassage, parseRef, searchBible, type BibleHit, type Passage } from '../data/bible'
import { topicRefs } from '../data/bibleTopics'

/** ข้อพระคัมภีร์ที่เกี่ยวกับคำค้น: ข้อที่คัดไว้ตามหัวข้อ + ค้นคำทั้งพระคัมภีร์ (ฉบับ 1971) */
export default function ScriptureResults({ text }: { text: string }) {
  const [cards, setCards] = useState<{ ref: string; ps: Passage }[] | null>(null)
  const [full, setFull] = useState<{ state: 'idle' } | { state: 'loading'; done: number } | { state: 'done'; hits: BibleHit[] }>({ state: 'idle' })
  const [show, setShow] = useState(20)
  const term = text.trim()

  useEffect(() => {
    let alive = true
    setCards(null)
    setFull({ state: 'idle' })
    setShow(20)
    const direct = parseRef(term) ? [term] : []
    const refs = [...direct, ...topicRefs(term, 12)]
    Promise.all(refs.map(async (ref) => ({ ref, ps: await getPassage(ref) })))
      .then((xs) => alive && setCards(xs.filter((x): x is { ref: string; ps: Passage } => !!x.ps && x.ps.blocks.length > 0)))
    return () => {
      alive = false
    }
  }, [term])

  const runFull = async () => {
    setFull({ state: 'loading', done: 0 })
    const hits = await searchBible(term, (done) => setFull({ state: 'loading', done }))
    setFull({ state: 'done', hits })
  }

  const mark = (s: string) => {
    const i = s.indexOf(term)
    if (i < 0) return s
    const a = Math.max(0, i - 50)
    return (
      <>
        {a > 0 && '…'}{s.slice(a, i)}<mark>{term}</mark>{s.slice(i + term.length, i + term.length + 90)}{i + term.length + 90 < s.length && '…'}
      </>
    )
  }

  if (!term) return null
  return (
    <section className="section scripture-results">
      <h2 className="section__title">📖 ข้อพระคัมภีร์ที่เกี่ยวข้อง</h2>
      {cards === null ? (
        <p className="empty">กำลังเปิดพระคัมภีร์…</p>
      ) : cards.length > 0 ? (
        <ul className="results">
          {cards.map(({ ref, ps }) => {
            const f = ps.blocks[0]
            const first = f.verses[0]
            const preview = ps.blocks.flatMap((b) => b.verses.map((v) => v.text)).join(' ')
            return (
              <li key={ref}>
                <Link to={`/bible/${parseRef(ref)!.book}/${f.chapter}?v=${first.n}`} className="result sr-verse">
                  <span className="result__body">
                    <span className="result__title">{ps.label}</span>
                    <span className="sr-verse__text">{preview.length > 110 ? preview.slice(0, 110) + '…' : preview}</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : null}

      {full.state === 'idle' && (
        <button type="button" className="btn btn--ghost sr-full" onClick={runFull}>🔎 ค้นคำว่า “{term}” ในพระคัมภีร์ทั้งเล่ม</button>
      )}
      {full.state === 'loading' && <p className="empty" role="status">กำลังค้นทั้งพระคัมภีร์… {Math.round((full.done / 66) * 100)}%</p>}
      {full.state === 'done' && (
        <>
          <p className="source-note">พบคำว่า “{term}” {full.hits.length.toLocaleString('th-TH')} ข้อในฉบับ 1971</p>
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
      )}
      <p className="source-note">ข้อความจากพระคริสตธรรมคัมภีร์ฉบับ 1971 · แตะเพื่อเปิดอ่านและฟังต่อจากข้อนั้น</p>
    </section>
  )
}
