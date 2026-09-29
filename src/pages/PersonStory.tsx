import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { eraTitle } from '../data/people'
import { useSpeech, type SpeechSection } from '../lib/speech'
import { Spoken, useFollow } from '../components/Spoken'
import { usePeople } from './People'

/**
 * เรื่องเล่าชีวิตแบบเล่านิทาน (ไม่มีข้ออ้างอิงขัดจังหวะ) · ฟังพร้อมไฮไลต์วิ่งตาม
 * เล่าจบแล้วต่อเรื่องของบุคคลถัดไปตามลำดับ (อาดัม → … → ลูกา) อัตโนมัติ
 */
interface Story { id: string; sections: { heading: string; text: string }[] }
const cache = new Map<string, Promise<Story | null>>()
function loadStory(id: string) {
  if (!cache.has(id)) {
    cache.set(id, fetch(`./data/stories/${id}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => { cache.delete(id); return null }))
  }
  return cache.get(id)!
}
const AUTO_KEY = 'khatha.story.autoNext'
const paras = (t: string) => t.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean)

/** เปลี่ยนคน = เริ่มหน้าใหม่ทั้งหมด (กันเนื้อหาของคนก่อนค้างอยู่ตอนเล่าต่อคนถัดไป) */
export default function PersonStoryPage() {
  const { id = '' } = useParams()
  return <PersonStory key={id} />
}

function PersonStory() {
  const { id = '' } = useParams()
  const [sp, setSp] = useSearchParams()
  const nav = useNavigate()
  const { doc } = usePeople()
  const [story, setStory] = useState<Story | null | undefined>(undefined)
  const tts = useSpeech()
  const fw = useFollow(tts.speaking || tts.paused)
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => setSlot(document.getElementById('topbar-slot')), [])
  const [autoNext, setAutoNextState] = useState(() => {
    try { return localStorage.getItem(AUTO_KEY) !== '0' } catch { return true }
  })
  const setAutoNext = (v: boolean) => {
    setAutoNextState(v)
    try { localStorage.setItem(AUTO_KEY, v ? '1' : '0') } catch { /* ignore */ }
  }

  useEffect(() => {
    setStory(undefined)
    loadStory(id).then((st) => setStory(st && st.id === id ? st : st ? { ...st, id } : st))
  }, [id])

  const people = doc ? [...doc.people].sort((a, b) => a.order - b.order) : []
  const idx = people.findIndex((x) => x.id === id)
  const p = people[idx]
  const next = people[idx + 1]
  const prev = people[idx - 1]
  const era = p && doc?.eras.find((e) => e.id === p.era)

  // ส่วนที่อ่าน: ชื่อเรื่อง → หัวข้อ → ย่อหน้า … → "จบเรื่อง" (สัญญาณให้ต่อคนถัดไป)
  const reachedEnd = useRef(false)
  const secs = (): SpeechSection[] => {
    if (!story || !p) return []
    const out: SpeechSection[] = [{ id: 'title', text: `เรื่องเล่าชีวิตของ${p.th}` }]
    story.sections.forEach((s, i) => {
      out.push({ id: `${i}|h`, text: s.heading })
      paras(s.text).forEach((t, k) => out.push({ id: `${i}|${k}`, text: t }))
    })
    out.push({ id: '__end', text: next && autoNext ? `จบเรื่องของ${p.th} ต่อไปคือเรื่องของ${next.th}` : `จบเรื่องของ${p.th}` })
    return out
  }
  const play = (from?: { id: string; at: number }) => {
    reachedEnd.current = false
    tts.speakSections(secs(), (sid) => { if (sid === '__end') reachedEnd.current = true }, fw.onWord, from)
  }
  const tapRead = (sid: string, at: number) => play({ id: sid, at }) // แตะตรงไหน อ่านจากตรงนั้น

  // เปิดมาจากการเล่าต่อเนื่อง (?play=1) → เริ่มเล่าทันทีเมื่อเนื้อหาพร้อม
  const autoplay = sp.get('play') === '1'
  useEffect(() => {
    if (!autoplay || !story || !p || story.id !== p.id) return
    setSp({}, { replace: true })
    window.scrollTo(0, 0)
    play()
  }, [autoplay, story, p?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // เล่าจบเอง (ไม่ได้กดหยุด) → ไปเรื่องของบุคคลถัดไป
  useEffect(() => {
    if (tts.speaking || tts.paused || !reachedEnd.current) return
    reachedEnd.current = false
    if (autoNext && next) nav(`/people/${next.id}/story?play=1`, { replace: true })
  }, [tts.speaking, tts.paused, autoNext, next, nav])

  // เปลี่ยนคนเอง (กดก่อนหน้า/ถัดไป) → หยุดเสียง
  const { stop } = tts
  useEffect(() => () => stop(), [id, stop])

  if (!doc || story === undefined) return <p className="empty">กำลังเปิดเรื่องเล่า…</p>
  if (!p || !story) return <p className="empty">ยังไม่มีเรื่องเล่าของบุคคลนี้ · <Link to={`/people/${id}`}>กลับหน้าบุคคล</Link></p>

  return (
    <div className="story">
      <p className="eyebrow">📖 เรื่องเล่าชีวิต · ลำดับที่ {p.order} จาก {people.length}{era ? ` · ${eraTitle(era)}` : ''}</p>
      <h1 className="story__title">{p.th}</h1>
      <p className="person-head__role">{p.role}</p>
      <label className="story__auto">
        <input type="checkbox" checked={autoNext} onChange={(e) => setAutoNext(e.target.checked)} />
        เล่าจบแล้วต่อเรื่องของบุคคลถัดไปอัตโนมัติ{next ? ` (${next.th})` : ''}
      </label>
      <p className="source-note story__hint">แตะตัวหนังสือ = อ่านจากตรงนั้น · กดค้าง = เครื่องมือ (คัดลอก แชร์ แก้คำอ่าน)</p>
      {tts.noVoice && <p className="nb-none">มือถือเครื่องนี้ยังไม่มีเสียงภาษาไทย · ติดตั้งเสียงไทยในการตั้งค่าการอ่านออกเสียงของเครื่อง</p>}

      {story.sections.map((s, i) => (
        <section key={i} className="story__sec">
          <h2><Spoken text={s.heading} id={`${i}|h`} follow={fw.follow} onTap={tapRead} /></h2>
          {paras(s.text).map((t, k) => <p key={k}><Spoken text={t} id={`${i}|${k}`} follow={fw.follow} onTap={tapRead} /></p>)}
        </section>
      ))}

      <nav className="pager story__pager" aria-label="เรื่องเล่าก่อนหน้าและถัดไป">
        {prev ? <Link className="btn btn--ghost" to={`/people/${prev.id}/story`}>◀ {prev.th}</Link> : <span />}
        {next ? <Link className="btn btn--ghost" to={`/people/${next.id}/story`}>{next.th} ▶</Link> : <span />}
      </nav>
      <Link className="source-note" to={`/people/${p.id}`}>ดูบทเรียน ข้อพระคัมภีร์ และโครงบทเรียนของ{p.th} ›</Link>

      {tts.supported && slot && createPortal(
        <div className="nb-fab" role="group" aria-label="ฟังเรื่องเล่า">
          {tts.speaking ? (
            <button type="button" className="nb-fab__btn nb-fab__btn--stop" onClick={tts.pause} aria-label="หยุดชั่วคราว">⏸ หยุด</button>
          ) : tts.paused ? (
            <>
              <button type="button" className="nb-fab__btn" onClick={tts.resume} aria-label="ฟังต่อ">▶ ฟังต่อ</button>
              <button type="button" className="nb-fab__btn" onClick={() => { reachedEnd.current = false; tts.stop() }} aria-label="เริ่มใหม่">↺</button>
            </>
          ) : (
            <button type="button" className="nb-fab__btn" onClick={() => play()} aria-label="ฟังเรื่องเล่า">🔊 ฟังเรื่องเล่า</button>
          )}
        </div>,
        slot,
      )}
    </div>
  )
}
