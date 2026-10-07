import { useState, type FormEvent } from 'react'
import { IconSearch } from '../components/Icons'
import SharedSyncLine from '../components/SharedSyncLine'
import { useRole } from '../lib/members'
import { useSharedStore } from '../lib/sharedStore'
import type { SharedItem } from '../lib/sync'
import type { MeetingPlan } from './MeetingSchedule'

/** การเตรียมงาน — รายการสิ่งที่ต้องเตรียมก่อนการประชุม/กิจกรรม ติ๊กเมื่อเสร็จ ระบุผู้รับผิดชอบ · ทุกคนเห็น ผู้แก้ไขได้ติ๊ก/แก้ไข */
interface Task { id: string; text: string; owner: string; done: boolean }
interface Prep extends SharedItem { title: string; planId: string; due: string; tasks: Task[]; created: number }

const STANDARD = ['ยืนยันวัน เวลา สถานที่', 'แจ้งผู้เข้าร่วมประชุม', 'จัดทำวาระการประชุมและส่งให้ล่วงหน้า', 'เตรียมเอกสารและมติครั้งก่อน', 'จัดสถานที่และอุปกรณ์', 'มอบหมายผู้อธิษฐานเปิด-ปิด', 'มอบหมายผู้จดบันทึกการประชุม']
const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
const thaiDate = (s: string) => { const d = new Date(`${s}T00:00:00`); return isNaN(+d) ? s : d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) }

export default function MeetingPrepPage() {
  const role = useRole()
  const canEdit = role === 'admin' || role === 'editor'
  const store = useSharedStore<Prep>({ localKey: 'khatha.meetPrep.v1', file: 'meeting-prep.json', label: 'การเตรียมงาน' })
  const plans = useSharedStore<MeetingPlan>({ localKey: 'khatha.meetSchedule.v1', file: 'meeting-schedule.json', label: 'ตารางการประชุม' }).items
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [form, setForm] = useState<{ title: string; planId: string; due: string; standard: boolean } | null>(null)
  const [err, setErr] = useState('')
  const [delId, setDelId] = useState<string | null>(null)
  const [newTask, setNewTask] = useState<Record<string, { text: string; owner: string }>>({})
  const [hideDone, setHideDone] = useState(true)

  const list = [...store.items].sort((a, b) => Number(isDone(a)) - Number(isDone(b)) || (a.due || '9999').localeCompare(b.due || '9999') || (b.created ?? 0) - (a.created ?? 0))
  function isDone(p: Prep) { return p.tasks.length > 0 && p.tasks.every((t) => t.done) }
  const needle = q.trim().toLowerCase()
  const shown = list.filter((p) => (!needle || [p.title, ...p.tasks.flatMap((t) => [t.text, t.owner])].join('\n').toLowerCase().includes(needle)) && (needle || !hideDone || !isDone(p)))
  const doneCount = list.filter(isDone).length
  const planName = (id: string) => { const m = plans.find((x) => x.id === id && !x.deleted); return m ? `${m.title} (${thaiDate(m.date)})` : '' }
  const upcomingPlans = plans.filter((m) => !m.deleted).sort((a, b) => b.date.localeCompare(a.date))

  const create = (e: FormEvent) => {
    e.preventDefault()
    if (!form) return
    const plan = plans.find((x) => x.id === form.planId)
    const title = form.title.trim() || (plan ? `เตรียมงาน: ${plan.title}` : '')
    if (!title) return setErr('ใส่ชื่อรายการเตรียมงาน หรือเลือกการประชุมจากตาราง')
    store.put([{ id: uid('pp_'), title, planId: form.planId, due: form.due || plan?.date || '', tasks: form.standard ? STANDARD.map((t) => ({ id: uid('t_'), text: t, owner: '', done: false })) : [], created: Date.now(), updated: 0 }])
    setForm(null)
  }
  const patch = (p: Prep, fn: (t: Task[]) => Task[]) => store.put([{ ...p, tasks: fn(p.tasks) }])
  const addTask = (p: Prep) => {
    const n = newTask[p.id]
    if (!n?.text.trim()) return
    patch(p, (t) => [...t, { id: uid('t_'), text: n.text.trim(), owner: (n.owner || '').trim(), done: false }])
    setNewTask({ ...newTask, [p.id]: { text: '', owner: '' } })
  }

  const formView = form && (
    <form className="card us-form" onSubmit={create}>
      <h2 className="section__title">รายการเตรียมงานใหม่</h2>
      <label className="prayer-form__name">เตรียมสำหรับการประชุมในตาราง (ไม่เลือกก็ได้)
        <select className="us-input" value={form.planId} onChange={(e) => { const m = plans.find((x) => x.id === e.target.value); setForm({ ...form, planId: e.target.value, due: m?.date ?? form.due }) }}>
          <option value="">— ไม่ผูกกับการประชุม —</option>
          {upcomingPlans.map((m) => <option key={m.id} value={m.id}>{m.title} · {thaiDate(m.date)}</option>)}
        </select>
      </label>
      <label className="prayer-form__name">ชื่อรายการ (เว้นว่าง = ใช้ชื่อการประชุมที่เลือก)
        <input className="us-input" type="text" value={form.title} maxLength={140} placeholder="เช่น เตรียมงานประชุมประจำปี" onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </label>
      <label className="prayer-form__name">กำหนดเสร็จ (ไม่ใส่ก็ได้)
        <input className="us-input" type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
      </label>
      <label className="us-loop"><input type="checkbox" checked={form.standard} onChange={(e) => setForm({ ...form, standard: e.target.checked })} /> ใส่รายการเตรียมมาตรฐานให้ ({STANDARD.length} ข้อ แก้ไขได้ภายหลัง)</label>
      {err && <p className="ai-keys__err" role="alert">{err}</p>}
      <div className="duty__btns">
        <button type="submit" className="btn btn--gold">สร้าง</button>
        <button type="button" className="btn btn--ghost" onClick={() => setForm(null)}>ยกเลิก</button>
      </div>
    </form>
  )

  return (
    <>
      <div className="page-head">
        <span className="page-icon" aria-hidden="true">✅</span>
        <h1>การเตรียมงาน</h1>
        <p>{list.length - doneCount} รายการที่ยังเตรียมไม่เสร็จ · ติ๊กเมื่อทำเสร็จ ระบุผู้รับผิดชอบได้</p>
      </div>
      <div className="nb-bar us-tools">
        <label className="nb-search">
          <span className="sr-only">ค้นหารายการเตรียมงาน</span>
          <IconSearch />
          <input type="search" value={q} placeholder="ค้นหารายการ / ผู้รับผิดชอบ" onChange={(e) => setQ(e.target.value)} />
        </label>
        {canEdit && <button type="button" className="btn btn--gold nb-add edit-only" onClick={() => { setForm({ title: '', planId: '', due: '', standard: true }); setErr('') }}>＋ รายการใหม่</button>}
      </div>
      {formView}
      {list.length === 0 && !form && <div className="empty us-empty"><p>ยังไม่มีรายการเตรียมงาน{canEdit ? ' กด “＋ รายการใหม่” เพื่อสร้าง (เลือกผูกกับนัดประชุมในตารางได้)' : ''}</p></div>}
      {doneCount > 0 && !needle && <button type="button" className="linkish" onClick={() => setHideDone(!hideDone)}>{hideDone ? '▾ แสดง' : '▴ ซ่อน'}รายการที่เสร็จแล้ว ({doneCount})</button>}
      <ul className="us-list">
        {shown.map((p) => {
          const done = p.tasks.filter((t) => t.done).length
          const isOpen = !!open[p.id] || !!needle
          const nt = newTask[p.id] ?? { text: '', owner: '' }
          return (
            <li key={p.id} className={`us-card${isOpen ? '' : ' us-card--fold'}`}>
              <button type="button" className="qa-q" aria-expanded={isOpen} onClick={() => setOpen({ ...open, [p.id]: !open[p.id] })}>
                <span className="qa-q__t">{p.title}</span>
                <span className={`badge${isDone(p) ? ' mt-done' : ''}`}>{isDone(p) ? '✓ เสร็จ' : `${done}/${p.tasks.length}`}</span>
                {p.due && <span className="mt-when">{thaiDate(p.due)}</span>}
                <span className="qa-q__chev" aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
              </button>
              {isOpen && (
                <>
                  {p.planId && planName(p.planId) && <p className="mt-meta">🗓️ {planName(p.planId)}</p>}
                  {p.tasks.length > 0 && <div className="mt-bar" aria-hidden="true"><span style={{ width: `${(done / p.tasks.length) * 100}%` }} /></div>}
                  <ul className="mt-tasks">
                    {p.tasks.map((t) => (
                      <li key={t.id} className={t.done ? 'mt-tasks__done' : ''}>
                        <label>
                          <input type="checkbox" checked={t.done} disabled={!canEdit} onChange={() => patch(p, (ts) => ts.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))} />
                          <span>{t.text}{t.owner && <small> · 👤 {t.owner}</small>}</span>
                        </label>
                        {canEdit && <button type="button" className="mini edit-only" aria-label={`ลบ ${t.text}`} onClick={() => patch(p, (ts) => ts.filter((x) => x.id !== t.id))}>✕</button>}
                      </li>
                    ))}
                  </ul>
                  {canEdit && (
                    <div className="mt-addtask edit-only">
                      <input className="us-input" type="text" value={nt.text} placeholder="เพิ่มสิ่งที่ต้องเตรียม" onChange={(e) => setNewTask({ ...newTask, [p.id]: { ...nt, text: e.target.value } })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTask(p) } }} />
                      <input className="us-input" type="text" value={nt.owner} placeholder="ผู้รับผิดชอบ" onChange={(e) => setNewTask({ ...newTask, [p.id]: { ...nt, owner: e.target.value } })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTask(p) } }} />
                      <button type="button" className="btn btn--gold" disabled={!nt.text.trim()} onClick={() => addTask(p)}>＋</button>
                    </div>
                  )}
                  {delId === p.id ? (
                    <div className="duty__btns duty__btns--warn">
                      <span>ลบรายการนี้?</span>
                      <button type="button" className="btn btn--danger" onClick={() => { store.remove(p.id); setDelId(null) }}>ลบ</button>
                      <button type="button" className="btn btn--ghost" onClick={() => setDelId(null)}>ไม่ลบ</button>
                    </div>
                  ) : canEdit && (
                    <div className="duty__btns us-card__btns edit-only">
                      <button type="button" className="mini" onClick={() => setDelId(p.id)}>🗑️ ลบทั้งรายการ</button>
                    </div>
                  )}
                </>
              )}
            </li>
          )
        })}
      </ul>
      <SharedSyncLine sync={store.sync} items={list} onRetry={store.syncNow} />
      <p className="source-note">ทุกคนในกลุ่มเห็นรายการนี้ · ติ๊ก/เพิ่ม/ลบ: แอดมินและผู้ที่มีสิทธิ์ “แก้ไขได้”</p>
    </>
  )
}
