import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { IconSearch } from '../components/Icons'
import SharedSyncLine from '../components/SharedSyncLine'
import { useRole } from '../lib/members'
import { useSharedStore } from '../lib/sharedStore'
import type { SharedItem } from '../lib/sync'

/** ตารางการประชุม — นัดหมายล่วงหน้า (วัน เวลา สถานที่ วาระ) · ทุกคนในกลุ่มเห็น · แอดมิน/แก้ไขได้ เพิ่ม-แก้-ลบ */
export interface MeetingPlan extends SharedItem { title: string; date: string; time: string; place: string; agenda: string; created: number }

const uid = () => `ms_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const thaiDate = (s: string) => { const d = new Date(`${s}T00:00:00`); return isNaN(+d) ? s : d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' }) }
const daysTo = (s: string) => Math.round((+new Date(`${s}T00:00:00`) - +new Date(`${today()}T00:00:00`)) / 86400000)
const when = (s: string) => { const n = daysTo(s); return n === 0 ? 'วันนี้' : n === 1 ? 'พรุ่งนี้' : n > 1 ? `อีก ${n} วัน` : `${-n} วันที่แล้ว` }

function ics(m: MeetingPlan): string {
  const d = m.date.replace(/-/g, '')
  const t = (m.time || '').replace(':', '')
  const start = t ? `DTSTART:${d}T${t}00` : `DTSTART;VALUE=DATE:${d}`
  const esc = (x: string) => x.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n')
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//elder-handbook//TH', 'BEGIN:VEVENT', `UID:${m.id}@elder-handbook`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`, start, ...(t ? [`DURATION:PT2H`] : []), `SUMMARY:${esc(m.title)}`, ...(m.place ? [`LOCATION:${esc(m.place)}`] : []), ...(m.agenda ? [`DESCRIPTION:${esc(m.agenda)}`] : []), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
}

export default function MeetingSchedulePage() {
  const role = useRole()
  const canEdit = role === 'admin' || role === 'editor'
  const store = useSharedStore<MeetingPlan>({ localKey: 'khatha.meetSchedule.v1', file: 'meeting-schedule.json', label: 'ตารางการประชุม' })
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [form, setForm] = useState<{ id: string; title: string; date: string; time: string; place: string; agenda: string } | null>(null)
  const [err, setErr] = useState('')
  const [delId, setDelId] = useState<string | null>(null)
  const [pastOpen, setPastOpen] = useState(false)

  const list = [...store.items]
  const needle = q.trim().toLowerCase()
  const match = (m: MeetingPlan) => !needle || [m.title, m.date, thaiDate(m.date), m.place, m.agenda].join('\n').toLowerCase().includes(needle)
  const upcoming = list.filter((m) => m.date >= today() && match(m)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
  const past = list.filter((m) => m.date < today() && match(m)).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))

  const openNew = () => { setForm({ id: uid(), title: '', date: today(), time: '', place: '', agenda: '' }); setErr(''); setDelId(null) }
  const openEdit = (m: MeetingPlan) => { setForm({ id: m.id, title: m.title, date: m.date, time: m.time || '', place: m.place || '', agenda: m.agenda || '' }); setErr(''); setDelId(null) }
  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!form) return
    if (!form.title.trim()) return setErr('ใส่ชื่อการประชุมก่อน เช่น “ประชุมผู้ปกครองประจำเดือน”')
    if (!form.date) return setErr('เลือกวันที่ก่อน')
    const old = list.find((x) => x.id === form.id)
    store.put([{ id: form.id, title: form.title.trim(), date: form.date, time: form.time, place: form.place.trim(), agenda: form.agenda.trim(), created: old?.created ?? Date.now(), updated: 0 }])
    setForm(null)
  }
  const download = (m: MeetingPlan) => {
    const url = URL.createObjectURL(new Blob([ics(m)], { type: 'text/calendar' }))
    const a = document.createElement('a')
    a.href = url; a.download = `meeting-${m.date}.ics`
    document.body.appendChild(a); a.click(); a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 30000)
  }

  const formView = form && (
    <form className="card us-form" onSubmit={save}>
      <h2 className="section__title">{list.some((x) => x.id === form.id) ? 'แก้ไขนัดประชุม' : 'นัดประชุมใหม่'}</h2>
      <label className="prayer-form__name">ชื่อการประชุม
        <input className="us-input" type="text" value={form.title} maxLength={140} autoFocus placeholder="เช่น ประชุมผู้ปกครองประจำเดือน" onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </label>
      <div className="mt-row mt-row--2">
        <label className="prayer-form__name">วันที่
          <input className="us-input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </label>
        <label className="prayer-form__name">เวลา (ไม่ใส่ก็ได้)
          <input className="us-input" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
        </label>
      </div>
      <label className="prayer-form__name">สถานที่ (ไม่ใส่ก็ได้)
        <input className="us-input" type="text" value={form.place} maxLength={160} placeholder="เช่น ห้องประชุมชั้น 2 / Zoom" onChange={(e) => setForm({ ...form, place: e.target.value })} />
      </label>
      <label className="prayer-form__name">วาระ / เรื่องที่จะประชุม (ไม่ใส่ก็ได้)
        <textarea className="us-input" rows={5} value={form.agenda} placeholder="ขึ้นบรรทัดใหม่ทีละวาระ" onChange={(e) => setForm({ ...form, agenda: e.target.value })} />
      </label>
      {err && <p className="ai-keys__err" role="alert">{err}</p>}
      <div className="duty__btns">
        <button type="submit" className="btn btn--gold">บันทึก</button>
        <button type="button" className="btn btn--ghost" onClick={() => setForm(null)}>ยกเลิก</button>
      </div>
    </form>
  )

  const card = (m: MeetingPlan, isPast: boolean) => {
    const isOpen = !!open[m.id] || form?.id === m.id
    return (
      <li key={m.id} className={`us-card${isOpen ? '' : ' us-card--fold'}${!isPast && daysTo(m.date) <= 1 ? ' us-card--on' : ''}`}>
        {form?.id === m.id ? formView : (
          <>
            <button type="button" className="qa-q" aria-expanded={isOpen} onClick={() => setOpen({ ...open, [m.id]: !open[m.id] })}>
              <span className="qa-q__t">{m.title}</span>
              <span className="badge">{thaiDate(m.date)}{m.time ? ` · ${m.time} น.` : ''}</span>
              {!isPast && <span className="mt-when">{when(m.date)}</span>}
              <span className="qa-q__chev" aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
            </button>
            {isOpen && (
              <>
                {m.place && <p className="mt-meta">📍 {m.place}</p>}
                {m.agenda ? <ol className="mt-list">{m.agenda.split('\n').filter((x) => x.trim()).map((x, i) => <li key={i}>{x}</li>)}</ol> : <p className="source-note">ยังไม่ได้ใส่วาระ</p>}
                <div className="duty__btns us-card__btns">
                  <Link className="mini" to="/meetings/prep">✅ เตรียมงาน</Link>
                  <Link className="mini" to="/meetings/minutes">📝 บันทึกมติ</Link>
                  <button type="button" className="mini" onClick={() => download(m)}>📅 เพิ่มลงปฏิทิน</button>
                </div>
                {delId === m.id ? (
                  <div className="duty__btns duty__btns--warn">
                    <span>ลบนัดประชุมนี้?</span>
                    <button type="button" className="btn btn--danger" onClick={() => { store.remove(m.id); setDelId(null) }}>ลบ</button>
                    <button type="button" className="btn btn--ghost" onClick={() => setDelId(null)}>ไม่ลบ</button>
                  </div>
                ) : canEdit && (
                  <div className="duty__btns us-card__btns edit-only">
                    <button type="button" className="mini" onClick={() => openEdit(m)}>✏️ แก้ไข</button>
                    <button type="button" className="mini" onClick={() => { setDelId(m.id); setForm(null) }}>🗑️ ลบ</button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </li>
    )
  }

  return (
    <>
      <div className="page-head">
        <span className="page-icon" aria-hidden="true">🗓️</span>
        <h1>ตารางการประชุม</h1>
        <p>{upcoming.length} นัดที่จะถึง · นัดหมายวัน เวลา สถานที่ และวาระ</p>
      </div>
      <div className="nb-bar us-tools">
        <label className="nb-search">
          <span className="sr-only">ค้นหานัดประชุม</span>
          <IconSearch />
          <input type="search" value={q} placeholder="ค้นหานัดประชุม" onChange={(e) => setQ(e.target.value)} />
        </label>
        {canEdit && <button type="button" className="btn btn--gold nb-add edit-only" onClick={openNew}>＋ นัดประชุม</button>}
      </div>
      {form && !list.some((x) => x.id === form.id) && formView}
      {upcoming.length === 0 && !form && <div className="empty us-empty"><p>{needle ? 'ไม่พบนัดประชุมที่ตรงกับคำค้น' : `ยังไม่มีนัดประชุมที่จะถึง${canEdit ? ' กด “＋ นัดประชุม” เพื่อเพิ่ม' : ''}`}</p></div>}
      <ul className="us-list">{upcoming.map((m) => card(m, false))}</ul>
      {past.length > 0 && (
        <>
          <button type="button" className="linkish" onClick={() => setPastOpen(!pastOpen)}>{pastOpen || needle ? '▴' : '▾'} การประชุมที่ผ่านมา ({past.length})</button>
          {(pastOpen || needle) && <ul className="us-list">{past.map((m) => card(m, true))}</ul>}
        </>
      )}
      <SharedSyncLine sync={store.sync} items={list} onRetry={store.syncNow} />
      <p className="source-note">ทุกคนในกลุ่มเห็นตารางนี้ · เพิ่ม/แก้ไข/ลบ: แอดมินและผู้ที่มีสิทธิ์ “แก้ไขได้” · ปุ่ม “เพิ่มลงปฏิทิน” ดาวน์โหลดไฟล์ .ics เปิดด้วยปฏิทินในมือถือ</p>
    </>
  )
}
