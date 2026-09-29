import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { DAYS, findOccasion, RITES, upcomingDates } from '../data/ceremonies'
import { useSpeech, type SpeechSection } from '../lib/speech'
import { Spoken, useFollow } from '../components/Spoken'
import { useNotes, todayStr } from '../lib/notes'
import { RefReader } from './People'

/** พิธี / วันสำคัญ: 2 แท็บหลัก (พิธีสำคัญ · วันสำคัญ) → แต่ละเรื่องมี 3 แท็บย่อย */
const thDate = (d: Date) => d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

export function OccasionsHome() {
  const [sp, setSp] = useSearchParams()
  const tab = sp.get('t') === 'day' ? 'day' : 'rite'
  const list = tab === 'rite' ? RITES : DAYS
  const next = upcomingDates(new Date(), 4)
  return (
    <div className="occ">
      <div className="page-head">
        <span className="page-icon" aria-hidden="true">⛪</span>
        <h1>พิธี / วันสำคัญ</h1>
        <p>ความเป็นมา ความหมาย และการจัดในคริสตจักร</p>
      </div>
      <div className="nb-tabs occ-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'rite'} onClick={() => setSp({}, { replace: true })}>🕊️ พิธีสำคัญ <small>{RITES.length}</small></button>
        <button type="button" role="tab" aria-selected={tab === 'day'} onClick={() => setSp({ t: 'day' }, { replace: true })}>📅 วันสำคัญ <small>{DAYS.length}</small></button>
      </div>
      {tab === 'day' && (
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
      )}
      <ul className="results occ-list">
        {list.map((o) => (
          <li key={o.id}>
            <Link to={`/occasions/${o.id}`} className="result">
              <span className="result__icon" aria-hidden="true">{o.icon}</span>
              <span className="result__body">
                <span className="result__title">{o.title}</span>
                <span className="occ-sub">{o.sub}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

type Sub = 'history' | 'meaning' | 'plan'

export function OccasionPage() {
  const { id = '' } = useParams()
  const [sp, setSp] = useSearchParams()
  const o = findOccasion(id)
  const sub = (['history', 'meaning', 'plan'].includes(sp.get('tab') ?? '') ? sp.get('tab') : 'history') as Sub
  const tts = useSpeech()
  const fw = useFollow(tts.speaking || tts.paused)
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => setSlot(document.getElementById('topbar-slot')), [])
  const { stop } = tts
  useEffect(() => stop(), [sub, id, stop])
  const notes = useNotes()
  const [added, setAdded] = useState<string[]>([])
  const year = new Date().getFullYear()
  const topRef = useRef<HTMLDivElement>(null)
  if (!o) return <p className="empty">ไม่พบเรื่องนี้ · <Link to="/occasions">กลับ</Link></p>
  const planLabel = o.kind === 'rite' ? 'โอกาสและขั้นตอน' : 'วันที่และการจัด'
  const SUBS: [Sub, string][] = [['history', '📜 ความเป็นมา'], ['meaning', '💡 ความหมาย'], ['plan', o.kind === 'rite' ? '📋 โอกาสและขั้นตอน' : '🗓️ วันที่และการจัด']]
  const setSub = (s: Sub) => setSp(s === 'history' ? {} : { tab: s }, { replace: true })

  const secs = (): SpeechSection[] => {
    const out: SpeechSection[] = [{ id: 'title', text: `${o.title}. ${sub === 'history' ? 'ความเป็นมา' : sub === 'meaning' ? 'ความหมาย' : planLabel}` }]
    if (sub === 'history') o.history.forEach((t, i) => out.push({ id: `h|${i}`, text: t }))
    if (sub === 'meaning') o.meaning.forEach((t, i) => out.push({ id: `m|${i}`, text: t }))
    if (sub === 'plan') o.plan.forEach((b, i) => { out.push({ id: `p|${i}|h`, text: b.heading }); b.items.forEach((t, k) => out.push({ id: `p|${i}|${k}`, text: t })) })
    return out
  }
  const play = (from?: { id: string; at: number }) => tts.speakSections(secs(), undefined, fw.onWord, from)
  const tap = (sid: string, at: number) => play({ id: sid, at })
  const S = (t: string, sid: string) => <Spoken text={t} id={sid} follow={fw.follow} onTap={tap} />
  const dateList = o.dates ? [...o.dates(year), ...o.dates(year + 1)].filter(([, d]) => d >= new Date(new Date().toDateString())).slice(0, 6) : []
  const addNote = (label: string, d: Date) => {
    notes.save({ title: `${o.icon} ${label}`, body: `เตรียม: ${o.title}`, date: todayStr(d), time: '' })
    setAdded([...added, label + d.toDateString()])
  }

  return (
    <div className="occ" ref={topRef}>
      <p className="bible__crumb"><Link to={o.kind === 'rite' ? '/occasions' : '/occasions?t=day'}>{o.kind === 'rite' ? 'พิธีสำคัญ' : 'วันสำคัญ'}</Link></p>
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
            <button type="button" className="nb-fab__btn" onClick={() => play()} aria-label="ฟังแท็บนี้">🔊 ฟังหน้านี้</button>
          )}
        </div>,
        slot,
      )}
    </div>
  )
}
