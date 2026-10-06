import { useState, type FormEvent } from 'react'
import { IconSearch } from '../components/Icons'
import SharedSyncLine from '../components/SharedSyncLine'
import { useSharedStore } from '../lib/sharedStore'
import { useSpeech } from '../lib/speech'
import type { SharedItem } from '../lib/sync'

/** ถามตอบ — เก็บคำถามที่มีคนถามมากับคำตอบของท่าน ค้นหาได้ทั้งคำถามและคำตอบ */
interface QaItem extends SharedItem { q: string; a: string; tag: string; created: number }

const SAMPLE = {
  q: 'ตัวอย่าง: ผู้ปกครองต้องประชุมกันบ่อยแค่ไหน?',
  tag: 'ตัวอย่าง',
  a: 'ตอบตามที่คริสตจักรกำหนดไว้ในระเบียบ (พิมพ์คำตอบจริงของท่านแทนข้อความนี้)\nแล้วกด ✏️ แก้ไข เพื่อใส่คำตอบที่ถูกต้อง หรือกด 🗑️ ลบ ถ้าไม่ต้องการตัวอย่างนี้',
}
const newId = () => `qa_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export default function QaPage() {
  const store = useSharedStore<QaItem>({ localKey: 'khatha.qa.v1', file: 'qa.json', label: 'ถามตอบ' })
  const tts = useSpeech('th-TH')
  const [q, setQ] = useState('')
  const [tagF, setTagF] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ q: '', a: '', tag: '' })
  const [err, setErr] = useState('')
  const [delId, setDelId] = useState<string | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [cur, setCur] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const list = [...store.items].sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0))
  const tags = [...new Set(list.map((s) => (s.tag || '').trim()).filter(Boolean))]
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const searching = words.length > 0
  const shown = list.filter((s) => {
    if (tagF && (s.tag || '').trim() !== tagF) return false
    const hay = [s.q, s.a, s.tag].join('\n').toLowerCase()
    return words.every((w) => hay.includes(w))
  })
  const active = tts.speaking || tts.paused

  const openNew = () => { setEditId('new'); setForm({ q: '', a: '', tag: '' }); setErr(''); setDelId(null) }
  const openEdit = (s: QaItem) => { setEditId(s.id); setForm({ q: s.q || '', a: s.a || '', tag: s.tag || '' }); setErr(''); setDelId(null) }
  const cancel = () => { setEditId(null); setErr('') }
  const save = (e: FormEvent) => {
    e.preventDefault()
    const qq = form.q.trim(), aa = form.a.trim(), tag = form.tag.trim()
    if (!qq) return setErr('ใส่คำถามก่อน')
    if (!aa) return setErr('ใส่คำตอบก่อน (ถ้ายังไม่มีคำตอบ พิมพ์ว่า “รอตรวจสอบ” ไว้ก่อนได้)')
    if (editId === 'new') store.put([{ id: newId(), q: qq, a: aa, tag, created: Date.now(), updated: 0 }])
    else {
      const old = list.find((s) => s.id === editId)
      if (old) store.put([{ ...old, q: qq, a: aa, tag }])
      if (cur === editId) tts.stop()
    }
    cancel()
  }
  const del = (id: string) => { if (cur === id) tts.stop(); store.remove(id); setDelId(null) }
  const copy = async (s: QaItem) => {
    try { await navigator.clipboard.writeText(`ถาม: ${s.q}\n\nตอบ: ${s.a}`); setNote('คัดลอกแล้ว วางส่งต่อได้เลย') }
    catch { setNote('คัดลอกไม่ได้ กดค้างที่ข้อความเพื่อคัดลอกเอง') }
    window.setTimeout(() => setNote(''), 2200)
  }
  const listen = (s: QaItem) => {
    if (!tts.supported) return
    setCur(s.id)
    tts.speakSections([{ id: `${s.id}|q`, text: `${s.q}.` }, { id: `${s.id}|a`, text: s.a }])
  }

  const formView = (
    <form className="card us-form" onSubmit={save}>
      <h2 className="section__title">{editId === 'new' ? 'เพิ่มคำถาม-คำตอบ' : 'แก้ไขคำถาม-คำตอบ'}</h2>
      <label className="prayer-form__name">คำถาม
        <textarea className="us-input" rows={2} value={form.q} autoFocus placeholder="เช่น สมาชิกย้ายมาจากโบสถ์อื่นต้องทำอย่างไร?" onChange={(e) => setForm({ ...form, q: e.target.value })} />
      </label>
      <label className="prayer-form__name">คำตอบ
        <textarea className="us-input" rows={7} value={form.a} placeholder="พิมพ์คำตอบที่ใช้ตอบได้เลย" onChange={(e) => setForm({ ...form, a: e.target.value })} />
      </label>
      <label className="prayer-form__name">หมวด (ไม่ใส่ก็ได้ ช่วยให้ค้นหาง่าย)
        <input className="us-input" type="text" list="qa-tags" value={form.tag} maxLength={40} placeholder="เช่น สมาชิก · การเงิน · พิธี" onChange={(e) => setForm({ ...form, tag: e.target.value })} />
        <datalist id="qa-tags">{tags.map((t) => <option key={t} value={t} />)}</datalist>
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
        <span className="page-icon" aria-hidden="true">💬</span>
        <h1>ถามตอบ</h1>
        <p>{list.length} ข้อ · เก็บคำถามที่มีคนถามมาและคำตอบไว้ ค้นหาเจอได้ทันที</p>
      </div>
      <SharedSyncLine sync={store.sync} items={list} onRetry={store.syncNow} />
      <div className="nb-bar us-tools">
        <label className="nb-search">
          <span className="sr-only">ค้นหาคำถามหรือคำตอบ</span>
          <IconSearch />
          <input type="search" value={q} placeholder="ค้นหาคำถามหรือคำตอบ" onChange={(e) => setQ(e.target.value)} />
        </label>
        <button type="button" className="btn btn--gold nb-add" onClick={openNew}>＋ เพิ่มคำถาม</button>
      </div>
      {tags.length > 0 && (
        <div className="theme-chips" role="group" aria-label="กรองตามหมวด">
          <button type="button" className={`chip${tagF === '' ? ' chip--on' : ''}`} aria-pressed={tagF === ''} onClick={() => setTagF('')}>ทั้งหมด</button>
          {tags.map((t) => (
            <button key={t} type="button" className={`chip${tagF === t ? ' chip--on' : ''}`} aria-pressed={tagF === t} onClick={() => setTagF(tagF === t ? '' : t)}>{t}</button>
          ))}
        </div>
      )}
      {note && <p className="nb-sync nb-sync--ok" role="status">{note}</p>}
      {editId === 'new' && formView}
      {list.length === 0 && editId !== 'new' && (
        <div className="empty us-empty">
          <p>ยังไม่มีคำถาม กด “＋ เพิ่มคำถาม” เพื่อใส่คำถามที่มีคนถามมาและคำตอบของท่าน</p>
          <button type="button" className="btn btn--ghost" onClick={() => store.put([{ id: newId(), ...SAMPLE, created: Date.now(), updated: 0 }])}>ดูตัวอย่าง 1 ข้อ</button>
        </div>
      )}
      {(searching || tagF) && list.length > 0 && (
        <p className="source-note" role="status">{shown.length === 0 ? 'ไม่พบคำถามหรือคำตอบที่ตรงกัน' : `พบ ${shown.length} ข้อ`}</p>
      )}
      <ul className="us-list">
        {shown.map((s) => {
          const isOpen = searching || !!open[s.id]
          const on = active && cur === s.id
          return (
            <li key={s.id} className={`us-card${on ? ' us-card--on' : ''}`}>
              {editId === s.id ? formView : (
                <>
                  <button type="button" className="qa-q" aria-expanded={isOpen} onClick={() => setOpen({ ...open, [s.id]: !open[s.id] })}>
                    <span className="qa-q__t">{s.q}</span>
                    {s.tag && <span className="badge">{s.tag}</span>}
                    <span className="qa-q__chev" aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
                  </button>
                  {isOpen && (
                    <>
                      <p className="us-card__body">{s.a}</p>
                      {delId === s.id ? (
                        <div className="duty__btns duty__btns--warn">
                          <span>ลบข้อนี้?</span>
                          <button type="button" className="btn btn--danger" onClick={() => del(s.id)}>ลบ</button>
                          <button type="button" className="btn btn--ghost" onClick={() => setDelId(null)}>ไม่ลบ</button>
                        </div>
                      ) : (
                        <div className="duty__btns us-card__btns">
                          {tts.supported && (on
                            ? <button type="button" className="btn us-listen" onClick={tts.stop}>⏹ หยุด</button>
                            : <button type="button" className="btn btn--gold us-listen" onClick={() => listen(s)}>▶ ฟัง</button>)}
                          <button type="button" className="mini" onClick={() => openEdit(s)}>✏️ แก้ไข</button>
                          <button type="button" className="mini" onClick={() => copy(s)}>📋 คัดลอก</button>
                          <button type="button" className="mini" onClick={() => { setDelId(s.id); setEditId(null) }}>🗑️ ลบ</button>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </li>
          )
        })}
      </ul>
      <p className="source-note">เมื่อเชื่อมออนไลน์ (ตั้งค่า › รหัสเข้าใช้ร่วม) ทุกเครื่องที่ใส่รหัสเดียวกัน ทั้งของท่านและคู่ผู้ปกครอง จะเห็น ฟัง และแก้ไขคำถาม-คำตอบชุดเดียวกัน</p>
    </>
  )
}
