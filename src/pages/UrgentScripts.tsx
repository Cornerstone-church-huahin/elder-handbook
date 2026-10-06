import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { IconSearch } from '../components/Icons'
import SharedSyncLine from '../components/SharedSyncLine'
import { usePrivateStore } from '../lib/privateStore'
import { RATES, useSpeech } from '../lib/speech'
import type { SharedItem } from '../lib/sync'

/**
 * สคริปต์ด่วน — คำพูด/คีย์เวิร์ดที่ต้องใช้ตอนประชุมหรือสถานการณ์เร่งด่วน
 * เพิ่ม แก้ไข ลบ เรียงลำดับได้ กดฟังได้ทีละเรื่องหรือฟังต่อเนื่องทั้งหมด
 * ส่วนตัวรายคน: เก็บในเครื่องและสำรองออนไลน์ในโฟลเดอร์ของตัวเอง คนอื่นไม่เห็น
 */
interface ScriptItem extends SharedItem { ownerId?: string; title: string; tag: string; body: string; pos: number; created: number }

const SAMPLE = {
  title: 'เปิดประชุมผู้ปกครอง (ตัวอย่าง — ลบหรือแก้ไขได้)',
  tag: 'ประชุม',
  body: 'กล่าวต้อนรับและขอบคุณทุกท่านที่สละเวลามาประชุม\nเปิดด้วยการอธิษฐานสั้น ๆ ขอพระเจ้านำการประชุมนี้\nแจ้งวาระการประชุมและเวลาที่ใช้ให้ทุกคนทราบ\nขอให้พูดทีละคน และฟังกันด้วยความรัก\nสรุปมติและผู้รับผิดชอบก่อนปิดประชุมทุกครั้ง',
}
const newId = () => `us_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export default function UrgentScriptsPage() {
  const store = usePrivateStore<ScriptItem>({ key: 'khatha.urgentScripts.v1', name: 'urgent-scripts', label: 'สคริปต์ด่วน', legacyFile: 'urgent-scripts.json', legacyMine: (x, name) => !!name && x.by === name })
  const tts = useSpeech('th-TH')
  const [q, setQ] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', tag: '', body: '' })
  const [err, setErr] = useState('')
  const [delId, setDelId] = useState<string | null>(null)
  const [cur, setCur] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => setSlot(document.getElementById('topbar-slot')), [])
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const list = [...store.items].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0) || (a.updated ?? 0) - (b.updated ?? 0))
  const needle = q.trim().toLowerCase()
  const shown = needle ? list.filter((s) => [s.title, s.tag, s.body].join('\n').toLowerCase().includes(needle)) : list
  const active = tts.speaking || tts.paused
  const rateIdx = Math.max(0, RATES.findIndex((x) => x.rate === tts.rate))

  useEffect(() => {
    if (!active || !cur) return
    document.getElementById(`us-${cur}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [cur, active])

  const secs = (s: ScriptItem) =>
    [{ id: `${s.id}|t`, text: `${s.title}.` }, { id: `${s.id}|b`, text: s.body || '' }].filter((x) => x.text.trim() && x.text.trim() !== '.')
  const play = (scripts: ScriptItem[]) => {
    if (!tts.supported || !scripts.length) return
    const all = scripts.flatMap(secs)
    if (!all.length) return
    setCur(scripts[0].id)
    tts.speakSections(all, (sid) => setCur(String(sid).split('|')[0]))
  }
  const playAllFrom = (i: number) => play(shown.slice(Math.max(0, i)))
  const curIdx = shown.findIndex((s) => s.id === cur)
  const stepTo = (d: number) => {
    const i = curIdx < 0 ? 0 : curIdx + d
    if (i >= 0 && i < shown.length) playAllFrom(i)
  }

  const openNew = () => { setEditId('new'); setForm({ title: '', tag: '', body: '' }); setErr(''); setDelId(null) }
  const openEdit = (s: ScriptItem) => { setEditId(s.id); setForm({ title: s.title || '', tag: s.tag || '', body: s.body || '' }); setErr(''); setDelId(null) }
  const cancel = () => { setEditId(null); setErr('') }
  const save = (e: FormEvent) => {
    e.preventDefault()
    const title = form.title.trim(), body = form.body.trim(), tag = form.tag.trim()
    if (!title) return setErr('ใส่ชื่อสคริปต์ก่อน เช่น “เปิดประชุม”')
    if (!body) return setErr('ใส่ข้อความที่ต้องพูดก่อน')
    if (editId === 'new') {
      const pos = list.length ? Math.max(...list.map((s) => s.pos ?? 0)) + 1 : 0
      store.put([{ id: newId(), title, tag, body, pos, created: Date.now(), updated: 0 }])
    } else {
      const old = list.find((s) => s.id === editId)
      if (old) store.put([{ ...old, title, tag, body }])
      if (cur === editId) tts.stop()
    }
    cancel()
  }
  const move = (id: string, d: number) => {
    const i = list.findIndex((s) => s.id === id)
    const j = i + d
    if (i < 0 || j < 0 || j >= list.length) return
    const next = [...list]
    ;[next[i], next[j]] = [next[j], next[i]]
    store.put(next.map((s, k) => ({ ...s, pos: k })))
  }
  const del = (id: string) => { if (cur === id) tts.stop(); store.remove(id); setDelId(null) }
  const copy = async (s: ScriptItem) => {
    try { await navigator.clipboard.writeText(`${s.title}\n\n${s.body || ''}`); setNote(`คัดลอก “${s.title}” แล้ว`) }
    catch { setNote('คัดลอกไม่ได้ กดค้างที่ข้อความเพื่อคัดลอกเอง') }
    window.setTimeout(() => setNote(''), 2200)
  }
  const addSample = () => store.put([{ id: newId(), ...SAMPLE, pos: 0, created: Date.now(), updated: 0 }])

  const formView = (
    <form className="card us-form" onSubmit={save}>
      <h2 className="section__title">{editId === 'new' ? 'เพิ่มสคริปต์ใหม่' : 'แก้ไขสคริปต์'}</h2>
      <label className="prayer-form__name">ชื่อสคริปต์ (เรื่องอะไร)
        <input className="us-input" type="text" value={form.title} maxLength={120} placeholder="เช่น เปิดประชุม / แจ้งมติ / ปิดประชุม" autoFocus onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </label>
      <label className="prayer-form__name">หมวด (ไม่ใส่ก็ได้)
        <input className="us-input" type="text" value={form.tag} maxLength={40} placeholder="เช่น ประชุม · อภิบาล · ฉุกเฉิน" onChange={(e) => setForm({ ...form, tag: e.target.value })} />
      </label>
      <label className="prayer-form__name">ข้อความ / คีย์เวิร์ดที่ต้องพูด
        <small>ขึ้นบรรทัดใหม่ทีละประเด็น เสียงอ่านจะหยุดพักตามบรรทัด</small>
        <textarea className="us-input" rows={8} value={form.body} placeholder="พิมพ์สิ่งที่ต้องพูด..." onChange={(e) => setForm({ ...form, body: e.target.value })} />
      </label>
      {err && <p className="ai-keys__err" role="alert">{err}</p>}
      <div className="duty__btns">
        <button type="submit" className="btn btn--gold">บันทึก</button>
        <button type="button" className="btn btn--ghost" onClick={cancel}>ยกเลิก</button>
      </div>
    </form>
  )

  return (
    <>
      <div className="page-head">
        <span className="page-icon" aria-hidden="true">🚨</span>
        <h1>สคริปต์ด่วน</h1>
        <p>{list.length} สคริปต์ · เก็บคำพูดสำคัญไว้ กดฟังได้ทันที กดชื่อเพื่อเปิดอ่าน/พับเก็บ ค้นหาได้จากชื่อ หมวด หรือเนื้อหา</p>
      </div>

      {list.length > 0 && !tts.supported && <p className="ai-keys__err">เบราว์เซอร์นี้ไม่รองรับเสียงอ่าน — ยังอ่านและแก้ไขสคริปต์ได้ตามปกติ</p>}
      {list.length > 0 && tts.noVoice && <p className="ai-keys__err">เครื่องนี้ยังไม่มีเสียงภาษาไทย · Android: ตั้งค่า › การจัดการทั่วไป › การอ่านออกเสียง › Google › ติดตั้งข้อมูลเสียงภาษาไทย</p>}
      {list.length > 0 && tts.supported && slot && createPortal(
        <div className="nb-fab" role="group" aria-label="ฟังสคริปต์ต่อเนื่อง">
          {active ? (
            <>
              {tts.speaking
                ? <button type="button" className="nb-fab__btn nb-fab__btn--stop" onClick={tts.pause} aria-label="หยุดชั่วคราว">⏸ หยุด</button>
                : <button type="button" className="nb-fab__btn" onClick={tts.resume} aria-label="ฟังต่อ">▶ ต่อ</button>}
              <button type="button" className="nb-fab__btn" disabled={curIdx <= 0} onClick={() => stepTo(-1)} aria-label="สคริปต์ก่อนหน้า">⏮</button>
              <button type="button" className="nb-fab__btn" disabled={curIdx < 0 || curIdx >= shown.length - 1} onClick={() => stepTo(1)} aria-label="สคริปต์ถัดไป">⏭</button>
              <button type="button" className="nb-fab__btn" onClick={tts.stop} aria-label="หยุดเลย">⏹</button>
            </>
          ) : (
            <button type="button" className="nb-fab__btn" onClick={() => playAllFrom(0)} aria-label="ฟังทั้งหมดต่อเนื่อง">▶ ฟังทั้งหมด</button>
          )}
        </div>, slot)}

      <div className="nb-bar us-tools">
        <label className="nb-search">
          <span className="sr-only">ค้นหาสคริปต์</span>
          <IconSearch />
          <input type="search" value={q} placeholder="ค้นหาสคริปต์" onChange={(e) => setQ(e.target.value)} />
        </label>
        <button type="button" className="btn btn--gold nb-add" onClick={openNew}>＋ เพิ่มสคริปต์</button>
      </div>

      {list.length > 1 && !needle && (
        <p className="us-fold">
          <button type="button" className="mini" onClick={() => setOpen(Object.fromEntries(list.map((x) => [x.id, true])))}>▾ ขยายทั้งหมด</button>
          <button type="button" className="mini" onClick={() => setOpen({})}>▴ พับทั้งหมด</button>
        </p>
      )}
      {note && <p className="nb-sync nb-sync--ok" role="status">{note}</p>}
      {editId === 'new' && formView}

      {list.length === 0 && editId !== 'new' && (
        <div className="empty us-empty">
          <p>ยังไม่มีสคริปต์ กด “＋ เพิ่มสคริปต์” เพื่อพิมพ์คำพูดที่ต้องใช้ เช่น เปิดประชุม แจ้งมติ ปิดประชุม</p>
          <button type="button" className="btn btn--ghost" onClick={addSample}>ดูตัวอย่าง 1 สคริปต์</button>
        </div>
      )}
      {needle && shown.length === 0 && list.length > 0 && <p className="empty">ไม่พบสคริปต์ที่ตรงกับคำค้น</p>}

      <ol className="us-list">
        {shown.map((s) => {
          const on = active && cur === s.id
          const isOpen = !!needle || !!open[s.id] || on || editId === s.id
          const idx = list.findIndex((x) => x.id === s.id)
          return (
            <li key={s.id} id={`us-${s.id}`} className={`us-card${on ? ' us-card--on' : ''}${isOpen ? '' : ' us-card--fold'}`}>
              {editId === s.id ? formView : (
                <>
                  <div className="us-head">
                    <button type="button" className="qa-q" aria-expanded={isOpen} onClick={() => setOpen({ ...open, [s.id]: !open[s.id] })}>
                    <span className="qa-q__t">{s.title}</span>
                    {s.tag && <span className="badge">{s.tag}</span>}
                    <span className="qa-q__chev" aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
                  </button>
                    {isOpen && tts.supported && (on
                      ? <button type="button" className="us-play us-play--on" onClick={tts.stop} aria-label="หยุดอ่าน">⏹ หยุด</button>
                      : <button type="button" className="us-play" onClick={() => playAllFrom(shown.findIndex((x) => x.id === s.id))} aria-label="ฟังต่อเนื่องตั้งแต่นี้">▶ ฟังต่อเนื่อง</button>)}
                  </div>
                  {isOpen && <p className="us-card__body">{s.body}</p>}
                  {!isOpen ? null : delId === s.id ? (
                    <div className="duty__btns duty__btns--warn">
                      <span>ลบสคริปต์นี้?</span>
                      <button type="button" className="btn btn--danger" onClick={() => del(s.id)}>ลบ</button>
                      <button type="button" className="btn btn--ghost" onClick={() => setDelId(null)}>ไม่ลบ</button>
                    </div>
                  ) : (
                    <div className="duty__btns us-card__btns">
                      
                      <button type="button" className="mini" onClick={() => openEdit(s)}>✏️ แก้ไข</button>
                      <button type="button" className="mini" onClick={() => copy(s)}>📋 คัดลอก</button>
                      <button type="button" className="mini" onClick={() => { setDelId(s.id); setEditId(null) }}>🗑️ ลบ</button>
                      <button type="button" className="mini" aria-label="เลื่อนขึ้น" disabled={!!needle || idx === 0} onClick={() => move(s.id, -1)}>▲</button>
                      <button type="button" className="mini" aria-label="เลื่อนลง" disabled={!!needle || idx === list.length - 1} onClick={() => move(s.id, 1)}>▼</button>
                    </div>
                  )}
                </>
              )}
            </li>
          )
        })}
      </ol>

      {list.length > 0 && tts.supported && (
        <section className="card us-settings" aria-label="ตั้งค่าเสียงอ่าน">
          <h2 className="section__title">⚙️ ตั้งค่าเสียงอ่าน</h2>
          <label className="us-loop">
            <input type="checkbox" checked={!!tts.looping} onChange={(e) => tts.setLoop(e.target.checked)} /> 🔁 วนอ่านซ้ำเมื่อจบ
          </label>
          <label className="nb-speed">
            <span className="nb-speed__label">ความเร็วเสียง: <b>{RATES[rateIdx].label}</b></span>
            <input type="range" min={0} max={RATES.length - 1} step={1} value={rateIdx} aria-valuetext={RATES[rateIdx].label}
              onChange={(e) => { tts.setRate(RATES[+e.target.value].rate); tts.stop() }} />
            <span className="nb-speed__ends" aria-hidden="true"><span>🐢 ช้าที่สุด</span><span>ปกติ</span></span>
          </label>
          {tts.noVoice && <p className="ai-keys__err">เครื่องนี้ยังไม่มีเสียงภาษาไทย · Android: ตั้งค่า › การจัดการทั่วไป › การอ่านออกเสียง › Google › ติดตั้งข้อมูลเสียงภาษาไทย</p>}
        </section>
      )}

      <SharedSyncLine sync={store.sync} items={list} onRetry={store.syncNow} mine />

      <p className="source-note">สคริปต์เป็นส่วนตัวของท่าน คนอื่นไม่เห็น · เมื่อเชื่อมออนไลน์ ทุกเครื่องของท่านเองเห็นและฟังชุดเดียวกัน (เข้าด้วยชื่อเดิม) · ใช้เสียงอ่านเดียวกับส่วนอื่นของแอป</p>
    </>
  )
}
