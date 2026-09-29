import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { DAYS, findOccasion, RITES, upcomingDates } from '../data/ceremonies'
import { speakableRef, useSpeech, type SpeechSection } from '../lib/speech'
import { Spoken, useFollow } from '../components/Spoken'
import { useNotes, todayStr } from '../lib/notes'
import { RefReader } from './People'

/** เตรียมพิธี (/service) และ วันสำคัญ (/occasions) แยกเป็น 2 ไอคอน → แต่ละเรื่องมี 4 แท็บย่อย อ่านต่อเนื่องข้ามแท็บได้ */
const thDate = (d: Date) => d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

/** รายการเรื่อง (ใช้ร่วมกันทั้งเตรียมพิธีและวันสำคัญ) */
function OccList({ list, base }: { list: typeof RITES; base: string }) {
  return (
    <ul className="results occ-list">
      {list.map((o) => (
        <li key={o.id}>
          <Link to={`${base}/${o.id}`} className="result">
            <span className="result__icon" aria-hidden="true">{o.icon}</span>
            <span className="result__body">
              <span className="result__title">{o.title}</span>
              <span className="occ-sub">{o.sub}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** ไอคอน "เตรียมพิธี" — พิธีสำคัญของคริสตจักร */
export function RitesHome() {
  return (
    <div className="occ">
      <div className="page-head">
        <span className="page-icon" aria-hidden="true">⛪</span>
        <h1>เตรียมพิธี</h1>
        <p>ความเป็นมา ความหมาย ขั้นตอน และคำอธิษฐานของแต่ละพิธี</p>
      </div>
      <OccList list={RITES} base="/service" />
    </div>
  )
}

/** ไอคอน "วันสำคัญ" — วันสำคัญตามปฏิทินคริสตจักร */
export function OccasionsHome() {
  const next = upcomingDates(new Date(), 4)
  return (
    <div className="occ">
      <div className="page-head">
        <span className="page-icon" aria-hidden="true">📅</span>
        <h1>วันสำคัญ</h1>
        <p>วันสำคัญตามปฏิทินคริสตจักร ความเป็นมา ความหมาย และการจัด</p>
      </div>
      <section className="occ-next">
        <h2 className="section__title">วันสำคัญที่กำลังจะถึง</h2>
        <ul>
          {next.map((x) => (
            <li key={x.label + x.date.toDateString()}>
              <Link to={`/occasions/${x.o.id}?tab=plan`}><b>{x.label}</b><span>{thDate(x.date)}</span></Link>
            </li>
          ))}
        </ul>
      </section>
      <OccList list={DAYS} base="/occasions" />
    </div>
  )
}

type Sub = 'history' | 'meaning' | 'plan' | 'prayer'
const SUB_IDS: Sub[] = ['history', 'meaning', 'plan', 'prayer']

export function OccasionPage() {
  const { id = '' } = useParams()
  const [sp, setSp] = useSearchParams()
  const o = findOccasion(id)
  const sub = (SUB_IDS.includes(sp.get('tab') as Sub) ? sp.get('tab') : 'history') as Sub
  const tts = useSpeech()
  const fw = useFollow(tts.speaking || tts.paused)
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => setSlot(document.getElementById('topbar-slot')), [])
  const { stop } = tts
  // เปลี่ยนแท็บเพราะการอ่านต่อเนื่อง → อ่านต่อ · ผู้ใช้เปลี่ยนแท็บหรือเรื่องเอง → หยุด
  const autoTab = useRef(false)
  const subRef = useRef<Sub>(sub)
  subRef.current = sub
  useEffect(() => {
    if (autoTab.current) return void (autoTab.current = false)
    stop()
  }, [sub, id, stop])
  const notes = useNotes()
  const [added, setAdded] = useState<string[]>([])
  const year = new Date().getFullYear()
  const topRef = useRef<HTMLDivElement>(null)
  const { pathname, search } = useLocation()
  const want = o?.kind === 'rite' ? '/service/' : '/occasions/'
  if (o && !pathname.startsWith(want)) return <Navigate to={want + o.id + search} replace />
  if (!o) return <p className="empty">ไม่พบเรื่องนี้ · <Link to="/">กลับ</Link></p>
  const planLabel = o.kind === 'rite' ? 'ขั้นตอน' : 'วันที่และการจัด'
  const prayer = o.prayer ?? []
  const SUBS: [Sub, string][] = [['history', '📜 ความเป็นมา'], ['meaning', '💡 ความหมาย'], ['plan', o.kind === 'rite' ? '📋 ขั้นตอน' : '🗓️ วันที่และการจัด'], ...(prayer.length ? [['prayer', '🙏 อธิษฐาน'] as [Sub, string]] : [])]
  const setSub = (s: Sub) => setSp(s === 'history' ? {} : { tab: s }, { replace: true })
  const label = (s: Sub) => (s === 'history' ? 'ความเป็นมา' : s === 'meaning' ? 'ความหมาย' : s === 'plan' ? planLabel : 'คำกล่าวและคำอธิษฐาน')
  const blocks = (b: { heading: string; items: string[] }[], k: string): SpeechSection[] =>
    b.flatMap((x, i) => [{ id: `${k}|${i}|h`, text: x.heading }, ...x.items.map((t, j) => ({ id: `${k}|${i}|${j}`, text: t, say: speakableRef }))])
  const tabSecs = (s: Sub): SpeechSection[] => [
    { id: `${s}|head`, text: `${label(s)}.` },
    ...(s === 'history' ? o.history.map((t, i) => ({ id: `h|${i}`, text: t }))
      : s === 'meaning' ? o.meaning.map((t, i) => ({ id: `m|${i}`, text: t }))
      : s === 'plan' ? blocks(o.plan, 'p') : blocks(prayer, 'r')),
  ]
  const tabOf = (sid: string): Sub | undefined => {
    const k = sid.split('|')[0]
    return ({ h: 'history', m: 'meaning', p: 'plan', r: 'prayer' } as Record<string, Sub>)[k] ?? (SUB_IDS.includes(k as Sub) ? (k as Sub) : undefined)
  }
  // อ่านต่อเนื่องจากแท็บที่เปิดอยู่จนจบแท็บสุดท้าย แล้วเปลี่ยนแท็บให้อัตโนมัติ
  const play = (from?: { id: string; at: number }) => {
    const order = SUBS.map(([s]) => s)
    const start = order.indexOf(from ? tabOf(from.id) ?? subRef.current : subRef.current)
    const secs: SpeechSection[] = [{ id: 'title', text: o.title }, ...order.slice(start).flatMap(tabSecs)]
    tts.speakSections(secs, (sid) => {
      const t = tabOf(sid)
      if (t && t !== subRef.current) { autoTab.current = true; subRef.current = t; setSub(t); window.scrollTo({ top: 0 }) }
    }, fw.onWord, from)
  }
  const tap = (sid: string, at: number) => play({ id: sid, at })
  const S = (t: string, sid: string) => <Spoken text={t} id={sid} follow={fw.follow} onTap={tap} />
  const dateList = o.dates ? [...o.dates(year), ...o.dates(year + 1)].filter(([, d]) => d >= new Date(new Date().toDateString())).slice(0, 6) : []
  const addNote = (label: string, d: Date) => {
    notes.save({ title: `${o.icon} ${label}`, body: `เตรียม: ${o.title}`, date: todayStr(d), time: '' })
    setAdded([...added, label + d.toDateString()])
  }

  return (
    <div className="occ" ref={topRef}>
      <p className="bible__crumb"><Link to={o.kind === 'rite' ? '/service' : '/occasions'}>{o.kind === 'rite' ? 'เตรียมพิธี' : 'วันสำคัญ'}</Link></p>
      <h1 className="occ-title"><span aria-hidden="true">{o.icon}</span> {o.title}</h1>
      <p className="occ-sub">{o.sub}</p>
      <div className="nb-tabs occ-subtabs" role="tablist">
        {SUBS.map(([s, label]) => <button key={s} type="button" role="tab" aria-selected={sub === s} onClick={() => setSub(s)}>{label}</button>)}
      </div>

      <div className="occ-body">
        {sub === 'history' && o.history.map((t, i) => <p key={i}>{S(t, `h|${i}`)}</p>)}
        {sub === 'meaning' && o.meaning.map((t, i) => <p key={i}>{S(t, `m|${i}`)}</p>)}
        {sub === 'plan' && (
          <>
            {dateList.length > 0 && (
              <section className="occ-dates">
                <h3>🗓️ วันที่ (คำนวณให้อัตโนมัติ)</h3>
                <ul>
                  {dateList.map(([label, d]) => {
                    const k = label + d.toDateString()
                    return (
                      <li key={k}>
                        <span><b>{label}</b><br />{thDate(d)}</span>
                        <button type="button" className="mini" disabled={added.includes(k)} onClick={() => addNote(label, d)}>{added.includes(k) ? '✓ อยู่ในโน้ตแล้ว' : '📝 เพิ่มลงโน้ต'}</button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
            {o.plan.map((b, i) => (
              <section key={i} className="occ-plan">
                <h3>{S(b.heading, `p|${i}|h`)}</h3>
                <ul>{b.items.map((t, k) => <li key={k}>{S(t, `p|${i}|${k}`)}</li>)}</ul>
              </section>
            ))}
          </>
        )}
        {sub === 'prayer' && prayer.map((b, i) => (
          <section key={i} className="occ-plan occ-prayer">
            <h3>{S(b.heading, `r|${i}|h`)}</h3>
            {b.items.map((t, k) => <p key={k}>{S(t, `r|${i}|${k}`)}</p>)}
          </section>
        ))}
      </div>

      <section className="section">
        <h2 className="section__title">📖 ข้อพระคำที่ใช้</h2>
        <ul className="ref-list">{o.refs.map((r) => <li key={r}><RefReader text={r} /></li>)}</ul>
        <p className="source-note">กดเพื่ออ่านข้อความจริงฉบับ 1971 · ↗ เปิดในแอปพระคัมภีร์</p>
      </section>

      {tts.supported && slot && createPortal(
        <div className="nb-fab" role="group" aria-label="ฟังเสียงอ่าน">
          {tts.speaking ? (
            <button type="button" className="nb-fab__btn nb-fab__btn--stop" onClick={tts.pause} aria-label="หยุดชั่วคราว">⏸ หยุด</button>
          ) : tts.paused ? (
            <>
              <button type="button" className="nb-fab__btn" onClick={tts.resume} aria-label="ฟังต่อ">▶ ฟังต่อ</button>
              <button type="button" className="nb-fab__btn" onClick={tts.stop} aria-label="เริ่มใหม่">↺</button>
            </>
          ) : (
            <button type="button" className="nb-fab__btn" onClick={() => play()} aria-label="ฟังต่อเนื่อง">🔊 ฟังต่อเนื่อง</button>
          )}
        </div>,
        slot,
      )}
    </div>
  )
}
