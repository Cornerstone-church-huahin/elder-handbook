import { useState } from 'react'
import { todayStr, useNotes, type Note } from '../lib/notes'

/** โน้ต: ตารางเวลา/นัดหมาย + บันทึกย่อเตือนความจำ (ใช้ร่วมกันออนไลน์) */
type Filter = 'all' | 'plan' | 'memo'
const DOW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']

function dateLabel(date: string, time: string): string {
  const today = todayStr()
  const t = new Date()
  t.setDate(t.getDate() + 1)
  const tomorrow = todayStr(t)
  const d = new Date(`${date}T00:00`)
  const day = date === today ? 'วันนี้' : date === tomorrow ? 'พรุ่งนี้' : `${DOW[d.getDay()]} ${d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}`
  return `${day}${time ? ` ${time} น.` : ''}`
}

/** เพิ่มลงปฏิทินของมือถือ (Google Calendar) เพื่อให้เครื่องเตือนตามเวลา */
function calendarUrl(n: Note): string {
  const d = n.date.replace(/-/g, '')
  let dates = `${d}/${d}`
  if (n.time) {
    const [h, m] = n.time.split(':').map(Number)
    const end = new Date(`${n.date}T${n.time}`)
    end.setHours(end.getHours() + 1)
    const e = `${todayStr(end).replace(/-/g, '')}T${String(end.getHours()).padStart(2, '0')}${String(end.getMinutes()).padStart(2, '0')}00`
    dates = `${d}T${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}00/${e}`
  } else {
    const nx = new Date(`${n.date}T00:00`)
    nx.setDate(nx.getDate() + 1)
    dates = `${d}/${todayStr(nx).replace(/-/g, '')}`
  }
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(n.title)}&details=${encodeURIComponent(n.body)}&dates=${dates}&ctz=Asia/Bangkok`
}

export default function NotesPage() {
  const { items, save, remove, dueToday } = useNotes()
  const [filter, setFilter] = useState<Filter>('all')
  const [edit, setEdit] = useState<Partial<Note> | null>(null)
  const [showDone, setShowDone] = useState(false)
  const today = todayStr()
  const shown = items.filter((n) => (filter === 'all' ? true : filter === 'plan' ? !!n.date : !n.date))
  const key = (n: Note) => `${n.date}T${n.time || '99:99'}`
  const open = shown.filter((n) => !n.done)
  const todayList = open.filter((n) => n.date && n.date <= today).sort((a, b) => key(a).localeCompare(key(b)))
  const upcoming = open.filter((n) => n.date && n.date > today).sort((a, b) => key(a).localeCompare(key(b)))
  const memos = open.filter((n) => !n.date).sort((a, b) => b.updated - a.updated)
  const done = shown.filter((n) => n.done).sort((a, b) => b.updated - a.updated)

  const row = (n: Note) => (
    <li key={n.id} className={`memo${n.done ? ' memo--done' : ''}${n.date && n.date < today && !n.done ? ' memo--late' : ''}`}>
      <input type="checkbox" className="memo__check" checked={n.done} onChange={(e) => save({ ...n, done: e.target.checked })} aria-label={`ทำแล้ว: ${n.title}`} />
      <button type="button" className="memo__main" onClick={() => setEdit(n)}>
        <span className="memo__title">{n.title}</span>
        {n.date && <span className="memo__when">🗓️ {dateLabel(n.date, n.time)}</span>}
        {n.body && <span className="memo__body">{n.body}</span>}
      </button>
    </li>
  )
  const group = (title: string, list: Note[]) =>
    list.length ? (
      <section className="notes-group" key={title}>
        <h2 className="section__title">{title} <small>({list.length})</small></h2>
        <ul className="notes-list">{list.map(row)}</ul>
      </section>
    ) : null

  return (
    <div className="notes">
      <div className="notes-head">
        <h1>📝 โน้ต</h1>
        <button type="button" className="btn btn--gold" onClick={() => setEdit({ title: '', body: '', date: filter === 'memo' ? '' : today, time: '', private: false })}>＋ เพิ่ม</button>
      </div>
      <div className="nb-tabs notes-filter" role="tablist">
        {([['all', 'ทั้งหมด'], ['plan', '🗓️ ตารางเวลา'], ['memo', '📌 บันทึกย่อ']] as [Filter, string][]).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>
      {dueToday > 0 && filter !== 'memo' && <p className="notes-due">🔔 วันนี้มี {dueToday} เรื่องที่ต้องทำ</p>}
      {group('วันนี้', todayList)}
      {group('กำลังจะถึง', upcoming)}
      {group('บันทึกย่อ', memos)}
      {!todayList.length && !upcoming.length && !memos.length && <p className="empty">ยังไม่มีโน้ต · กด ＋ เพิ่ม เพื่อบันทึกนัดหมายหรือเรื่องที่ต้องจำ</p>}
      {done.length > 0 && (
        <>
          <button type="button" className="linkish" onClick={() => setShowDone(!showDone)}>{showDone ? '▴' : '▾'} ทำเสร็จแล้ว ({done.length})</button>
          {showDone && <ul className="notes-list">{done.map(row)}</ul>}
        </>
      )}
      <p className="source-note">โน้ตเป็นส่วนตัวของท่าน คนอื่นไม่เห็น · ทุกเครื่องของท่านเห็นชุดเดียวกันเมื่อเชื่อมออนไลน์ · อยากให้มือถือเตือนตามเวลา กด “เพิ่มลงปฏิทิน”</p>

      {edit && (
        <div className="sheet-backdrop" onClick={() => setEdit(null)}>
          <div className="sheet sheet--short note-sheet" role="dialog" aria-modal="true" aria-label="โน้ต" onClick={(e) => e.stopPropagation()}>
            <div className="sheet__head">
              <div className="sheet__title"><strong>{edit.id ? '✏️ แก้ไขโน้ต' : '＋ โน้ตใหม่'}</strong></div>
              <button type="button" className="sheet__close" onClick={() => setEdit(null)}>ปิด</button>
            </div>
            <label className="voice-row"><span>เรื่อง</span><input id="note-title" value={edit.title ?? ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="เช่น เยี่ยมคุณยายที่โรงพยาบาล" autoFocus /></label>
            <label className="voice-row"><span>รายละเอียด</span><textarea id="note-body" rows={3} value={edit.body ?? ''} onChange={(e) => setEdit({ ...edit, body: e.target.value })} placeholder="เช่น นำหนังสือเพลงไปด้วย" /></label>
            <div className="note-when">
              <label className="voice-row"><span>วันที่ (ไม่ใส่ = บันทึกย่อ)</span><input id="note-date" type="date" value={edit.date ?? ''} onChange={(e) => setEdit({ ...edit, date: e.target.value })} /></label>
              <label className="voice-row"><span>เวลา</span><input id="note-time" type="time" value={edit.time ?? ''} disabled={!edit.date} onChange={(e) => setEdit({ ...edit, time: e.target.value })} /></label>
            </div>
            <div className="pron-actions">
              <button type="button" className="btn btn--gold" disabled={!edit.title?.trim()} onClick={() => { save({ ...edit, title: edit.title!.trim(), body: (edit.body ?? '').trim(), time: edit.date ? edit.time ?? '' : '' }); setEdit(null) }}>💾 บันทึก</button>
              {edit.id ? <button type="button" className="btn btn--ghost" onClick={() => { remove(edit.id!); setEdit(null) }}>🗑️ ลบ</button> : <button type="button" className="btn btn--ghost" onClick={() => setEdit(null)}>ยกเลิก</button>}
            </div>
            {edit.date && edit.title?.trim() && <a className="btn btn--ghost" href={calendarUrl(edit as Note)} target="_blank" rel="noopener noreferrer">🔔 เพิ่มลงปฏิทิน (ให้มือถือเตือน)</a>}
          </div>
        </div>
      )}
    </div>
  )
}
