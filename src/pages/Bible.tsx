import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BIBLE_BOOKS, chapterUrl, loadBook, parseRef } from '../data/bible'
import { useSpeech } from '../lib/speech'

/**
 * พระคัมภีร์ฉบับ 1971 แบบแอปพระคัมภีร์: พันธสัญญาเดิม/ใหม่ → เล่ม → บท → ข้อ
 * อ่านออกเสียงได้ทั้งเล่ม (ต่อเนื่อง) ทั้งบท หรือเฉพาะข้อที่เลือก · คัดลอก/ส่งข้อที่เลือกได้
 * ข้อความมาจากไฟล์ฉบับ 1971 ในแอปเท่านั้น
 */

const LAST_KEY = 'khatha.bible.last'
function getLast(): { b: number; c: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_KEY) ?? 'null')
    return v && BIBLE_BOOKS[v.b - 1] ? v : null
  } catch {
    return null
  }
}
function setLast(b: number, c: number) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify({ b, c }))
  } catch {
    /* ignore */
  }
}

/** ส่วนหัว/ปุ่มฟังที่แถบบนของแอป */
function useTopSlot() {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => setSlot(document.getElementById('topbar-slot')), [])
  return slot
}

// ---------- หน้าแรก: เลือกพันธสัญญาและเล่ม ----------
export function BibleHome() {
  const [sp, setSp] = useSearchParams()
  const t = sp.get('t') === 'new' ? 'new' : 'old'
  const nav = useNavigate()
  const last = getLast()
  const [q, setQ] = useState('')
  const [err, setErr] = useState('')
  const books = BIBLE_BOOKS.filter((b) => b.testament === t)
  const jump = (e: FormEvent) => {
    e.preventDefault()
    const r = parseRef(q)
    if (!r) {
      const b = BIBLE_BOOKS.find((x) => x.name.includes(q.trim()) && q.trim())
      if (b) return nav(`/bible/${b.no}`)
      return setErr('ไม่พบ ลองพิมพ์ เช่น ยอห์น 3:16 หรือ สดุดี 23')
    }
    const bk = BIBLE_BOOKS[r.book - 1]
    const ch = bk.chapters === 1 && r.chapter > 1 ? 1 : Math.min(r.chapter, bk.chapters)
    const v = bk.chapters === 1 && r.chapter > 1 ? r.chapter : r.verses[0]
    nav(`/bible/${r.book}/${ch}${v ? `?v=${v}` : ''}`)
  }
  return (
    <div className="page bible">
      <h1 className="bible__title">📖 พระคัมภีร์ <small>ฉบับ 1971</small></h1>
      <form className="bible-jump" onSubmit={jump} role="search">
        <input id="bible-q" type="search" value={q} onChange={(e) => { setQ(e.target.value); setErr('') }} placeholder="ไปที่… เช่น ยอห์น 3:16" aria-label="ไปที่ข้อพระคัมภีร์" />
        <button type="submit" className="btn btn--gold">ไป</button>
      </form>
      {err && <p className="source-note">{err}</p>}
      {last && (
        <Link className="bible-last" to={`/bible/${last.b}/${last.c}`}>
          ▶ อ่านต่อ: <strong>{BIBLE_BOOKS[last.b - 1].name} {last.c}</strong>
        </Link>
      )}
      <div className="nb-tabs bible-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={t === 'old'} onClick={() => setSp({}, { replace: true })}>พันธสัญญาเดิม <small>39 เล่ม</small></button>
        <button type="button" role="tab" aria-selected={t === 'new'} onClick={() => setSp({ t: 'new' }, { replace: true })}>พันธสัญญาใหม่ <small>27 เล่ม</small></button>
      </div>
      <ul className={`bible-books bible-books--${t}`}>
        {books.map((b) => (
          <li key={b.no}>
            <Link to={`/bible/${b.no}`} className="bible-book">
              <span className="bible-book__name">{b.name}</span>
              <span className="bible-book__n">{b.chapters} บท</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------- เล่ม: เลือกบท → เลือกข้อ ----------
export function BibleBookPage() {
  const b = BIBLE_BOOKS[Number(useParams().book) - 1]
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const c = Number(sp.get('c')) || 0 // บทที่เลือกแล้ว → แสดงตารางข้อ
  const [count, setCount] = useState<number | null>(null)
  useEffect(() => {
    setCount(null)
    if (b && c) loadBook(b.no).then((all) => setCount(all?.[c - 1]?.length ?? 0))
  }, [b, c])
  if (!b) return <p className="empty">ไม่พบพระธรรมเล่มนี้</p>
  if (c >= 1 && c <= b.chapters)
    return (
      <div className="page bible">
        <p className="bible__crumb"><Link to={`/bible/${b.no}`} replace>{b.name}</Link> › บทที่ {c}</p>
        <h1 className="bible__title">{b.name} {c} <small>{count ? `${count} ข้อ` : ''}</small></h1>
        <Link className="btn btn--gold bible-listen-book" to={`/bible/${b.no}/${c}`}>📖 อ่านทั้งบท</Link>
        <p className="source-note">เลือกข้อ — เปิดที่ข้อนั้น และฟังตั้งแต่ข้อนั้นเป็นต้นไปได้</p>
        {count === null ? <p className="empty">กำลังเปิด…</p> : !count ? <p className="empty">เปิดบทนี้ไม่ได้ตอนนี้ (อาจออฟไลน์)</p> : (
          <ul className="bible-chapters">
            {Array.from({ length: count }, (_, i) => (
              <li key={i}><Link to={`/bible/${b.no}/${c}?v=${i + 1}`} className="bible-ch bible-v">{i + 1}</Link></li>
            ))}
          </ul>
        )}
      </div>
    )
  return (
    <div className="page bible">
      <p className="bible__crumb"><Link to={b.testament === 'new' ? '/bible?t=new' : '/bible'}>{b.testament === 'new' ? 'พันธสัญญาใหม่' : 'พันธสัญญาเดิม'}</Link></p>
      <h1 className="bible__title">{b.name} <small>{b.chapters} บท</small></h1>
      <button type="button" className="btn btn--gold bible-listen-book" onClick={() => nav(`/bible/${b.no}/1?play=all`)}>
        🔊 ฟังทั้งเล่ม (ต่อเนื่องตั้งแต่บทที่ 1)
      </button>
      <p className="source-note">เลือกบท แล้วเลือกข้อ</p>
      <ul className="bible-chapters">
        {Array.from({ length: b.chapters }, (_, i) => (
          <li key={i}><Link to={`/bible/${b.no}?c=${i + 1}`} className="bible-ch">{i + 1}</Link></li>
        ))}
      </ul>
    </div>
  )
}

/** "3:16–18, 20" จากเลขข้อที่เลือก */
function rangeLabel(vs: number[]): string {
  const s = [...vs].sort((a, b) => a - b)
  const out: string[] = []
  for (let i = 0; i < s.length; i++) {
    let j = i
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++
    out.push(j > i ? `${s[i]}–${s[j]}` : `${s[i]}`)
    i = j
  }
  return out.join(', ')
}

// ---------- บท: อ่าน ฟัง เลือกข้อ คัดลอก/ส่ง ----------
export function BibleChapterPage() {
  const params = useParams()
  const bookNo = Number(params.book)
  const ch = Number(params.ch)
  const b = BIBLE_BOOKS[bookNo - 1]
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const [all, setAll] = useState<string[][] | null | undefined>(undefined)
  const [sel, setSel] = useState<number[]>([])
  const [reading, setReading] = useState<{ c: number; v: number } | null>(null)
  const [msg, setMsg] = useState('')
  const tts = useSpeech()
  const slot = useTopSlot()
  const autoNav = useRef(false)
  const chRef = useRef(ch)
  chRef.current = ch

  useEffect(() => {
    setAll(undefined)
    loadBook(bookNo).then((c) => setAll(c))
  }, [bookNo])

  // เปลี่ยนบทเอง → หยุดเสียงและล้างข้อที่เลือก · เปลี่ยนเพราะฟังต่อเนื่อง → อ่านต่อ
  const { stop } = tts
  useEffect(() => {
    if (b) setLast(bookNo, ch)
    setSel([])
    if (autoNav.current) {
      autoNav.current = false
      return
    }
    stop()
    setReading(null)
    window.scrollTo(0, 0)
  }, [bookNo, ch, stop, b])

  const verses = all?.[ch - 1] ?? []

  // เปิดจากการค้นหา (?v=16): เลือกข้อและเลื่อนไปหา
  const vParam = Number(sp.get('v'))
  useEffect(() => {
    if (!vParam || !verses.length) return
    setSel([vParam])
    window.setTimeout(() => document.getElementById(`v${vParam}`)?.scrollIntoView({ block: 'center' }), 50)
  }, [vParam, verses.length])

  // ข้อที่กำลังอ่าน → เลื่อนให้เห็น
  useEffect(() => {
    if (reading && reading.c === ch && reading.v > 0 && tts.speaking) document.getElementById(`v${reading.v}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [reading, ch, tts.speaking])

  const onSection = (id: string) => {
    const [c, v] = id.split(':').map(Number)
    setReading({ c, v })
    if (c !== chRef.current) {
      autoNav.current = true
      chRef.current = c
      nav(`/bible/${bookNo}/${c}`, { replace: true })
    }
  }
  // ข้อเริ่มต้น: ข้อที่เลือกจากตารางข้อ (?v=) หรือข้อที่แตะเลือกไว้ข้อเดียว → ฟังตั้งแต่ข้อนั้นเป็นต้นไป
  const start = sel.length === 1 ? sel[0] : vParam && sel.includes(vParam) ? vParam : 1
  const chapterSections = (c: number, from = 1) => {
    const vs = all?.[c - 1] ?? []
    const head = from > 1 ? `${b.name} บทที่ ${c} ข้อ ${from}` : `${b.name} บทที่ ${c}`
    return [{ id: `${c}:0`, text: head }, ...vs.map((t, i) => ({ id: `${c}:${i + 1}`, text: t })).filter((x, i) => x.text && i + 1 >= from)]
  }
  const listenChapter = () => tts.speakSections(chapterSections(ch, start), onSection)
  const listenOn = () => {
    const secs = [...chapterSections(ch, start)]
    for (let c = ch + 1; c <= b.chapters; c++) secs.push(...chapterSections(c))
    tts.speakSections(secs, onSection)
  }
  const listenSelected = () =>
    tts.speakSections([...sel].sort((x, y) => x - y).map((v) => ({ id: `${ch}:${v}`, text: verses[v - 1] })), onSection)

  // ?play=all จากปุ่ม "ฟังทั้งเล่ม"
  const autoplay = sp.get('play') === 'all'
  useEffect(() => {
    if (!autoplay || !all) return
    setSp({}, { replace: true })
    listenOn()
  }, [autoplay, all]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (v: number) => setSel((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))
  const sorted = [...sel].sort((x, y) => x - y)
  const selLabel = `${b?.name} ${ch}:${rangeLabel(sel)}`
  const selText = () => `${selLabel}\n${sorted.map((v) => `${v} ${verses[v - 1]}`).join('\n')}\n(พระคริสตธรรมคัมภีร์ ฉบับ 1971)`
  const flash = (m: string) => {
    setMsg(m)
    window.setTimeout(() => setMsg(''), 1800)
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(selText())
      flash('คัดลอกแล้ว วางในแชต Line ได้เลย')
    } catch {
      flash('คัดลอกไม่ได้ กดค้างที่ข้อความเพื่อคัดลอกเอง')
    }
  }
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: selText() })
        return
      } catch {
        return // ผู้ใช้ยกเลิก
      }
    }
    copy()
  }

  if (!b || ch < 1 || ch > b.chapters) return <p className="empty">ไม่พบบทนี้</p>
  const busy = tts.speaking || tts.paused
  return (
    <div className="page bible bible--read">
      <div className="bible-head">
        <Link className="bible-nav" to={ch > 1 ? `/bible/${bookNo}/${ch - 1}` : `/bible/${bookNo}`} aria-label="บทก่อน">◀</Link>
        <Link className="bible-head__title" to={`/bible/${bookNo}?c=${ch}`} aria-label="เลือกข้อ">{b.name} {ch} <span aria-hidden="true">▾</span></Link>
        <Link className="bible-nav" to={ch < b.chapters ? `/bible/${bookNo}/${ch + 1}` : `/bible/${bookNo}`} aria-label="บทถัดไป" aria-disabled={ch >= b.chapters}>▶</Link>
      </div>
      {tts.noVoice && <p className="nb-none">มือถือเครื่องนี้ยังไม่มีเสียงภาษาไทย · ติดตั้งเสียงไทยในการตั้งค่าการอ่านออกเสียงของเครื่อง</p>}

      {all === undefined ? (
        <p className="empty">กำลังเปิด…</p>
      ) : !verses.length ? (
        <p className="empty">เปิดบทนี้ไม่ได้ตอนนี้ (อาจออฟไลน์) · <a href={chapterUrl(bookNo, ch)} target="_blank" rel="noreferrer">เปิดในแอปพระคัมภีร์ ↗</a></p>
      ) : (
        <div className="bible-text">
          {verses.map((t, i) => {
            const v = i + 1
            const on = reading?.c === ch && reading.v === v && busy
            return (
              <p key={v} id={`v${v}`} className={`bv${sel.includes(v) ? ' bv--sel' : ''}${on ? ' bv--now' : ''}`} onClick={() => toggle(v)}>
                <sup>{v}</sup>{t}
              </p>
            )
          })}
          <div className="bible-foot">
            {ch > 1 ? <Link className="btn btn--ghost" to={`/bible/${bookNo}/${ch - 1}`}>◀ บทที่ {ch - 1}</Link> : <span />}
            {ch < b.chapters ? <Link className="btn btn--ghost" to={`/bible/${bookNo}/${ch + 1}`}>บทที่ {ch + 1} ▶</Link> : <span />}
          </div>
          <p className="source-note">แตะที่ข้อเพื่อเลือก แล้วคัดลอก ส่ง หรือฟังเฉพาะข้อนั้น · <a href={chapterUrl(bookNo, ch)} target="_blank" rel="noreferrer">เปิดในแอปพระคัมภีร์ ↗</a></p>
        </div>
      )}

      {sel.length > 0 && (
        <div className="bible-selbar" role="toolbar" aria-label="ข้อที่เลือก">
          <span className="bible-selbar__ref">{msg || selLabel}</span>
          <button type="button" onClick={copy} aria-label="คัดลอก">📋</button>
          <button type="button" onClick={share} aria-label="ส่ง">📤</button>
          <button type="button" onClick={listenSelected} aria-label="ฟังข้อที่เลือก">🔊</button>
          {sel.length === 1 && <button type="button" onClick={listenOn} aria-label="ฟังตั้งแต่ข้อนี้เป็นต้นไป">⏩</button>}
          <button type="button" onClick={() => setSel([])} aria-label="ยกเลิกการเลือก">✕</button>
        </div>
      )}

      {tts.supported && slot && all && createPortal(
        <div className="nb-fab" role="group" aria-label="ฟังเสียงอ่าน">
          {tts.speaking ? (
            <button type="button" className="nb-fab__btn nb-fab__btn--stop" onClick={tts.pause} aria-label="หยุดชั่วคราว">⏸ หยุด</button>
          ) : tts.paused ? (
            <>
              <button type="button" className="nb-fab__btn" onClick={tts.resume} aria-label="ฟังต่อ">▶ ฟังต่อ</button>
              <button type="button" className="nb-fab__btn" onClick={() => { tts.stop(); setReading(null) }} aria-label="เริ่มใหม่">↺</button>
            </>
          ) : (
            <>
              <button type="button" className="nb-fab__btn" onClick={listenChapter} aria-label="ฟังบทนี้">{start > 1 ? `🔊 ข้อ ${start}–จบบท` : '🔊 บทนี้'}</button>
              <button type="button" className="nb-fab__btn" onClick={listenOn} aria-label="ฟังต่อเนื่องจนจบเล่ม">▶ ต่อเนื่อง</button>
            </>
          )}
        </div>,
        slot,
      )}
    </div>
  )
}
