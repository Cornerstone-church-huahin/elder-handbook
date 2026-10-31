import { useEffect, useMemo, useState, type FormEvent } from 'react'
import ListenControls, { useChecked, useLoopPref } from '../components/ListenControls'
import SharedSyncLine from '../components/SharedSyncLine'
import { Spoken, useFollow } from '../components/Spoken'
import { useSharedStore } from '../lib/sharedStore'
import { speakableRef, useSpeech, type SpeechSection } from '../lib/speech'
import type { SharedItem } from '../lib/sync'

/**
 * ท่องจำพระคัมภีร์ — การ์ดละ 1 ข้อ (ชื่อพระคัมภีร์ บทที่:ข้อที่ + เนื้อหา) ติ๊กข้อที่จะท่อง แล้วกดเล่น
 * เล่นตามลำดับในรายการ จบแล้ววนกลับข้อแรกไปเรื่อย ๆ จนกดหยุด (ติ๊กข้อเดียว = อ่านซ้ำข้อเดียว)
 * ที่เก็บ/ซิงก์/เสียง/ความเร็ว ใช้หลักการเดียวกับ "เตรียมคำอธิษฐาน"
 */
export interface MemoVerse extends SharedItem { ref: string; text: string; pos: number; created: number }
const newId = () => `mv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export default function MemoryVersesPage() {
  const store = useSharedStore<MemoVerse>({ localKey: 'khatha.memoVerses.v1', file: 'memory-verses.json', label: 'ท่องจำพระคัมภีร์' })
  const tts = useSpeech('th-TH')
  const [loop, setLoop] = useLoopPref(tts, 'khatha.memoVerses.loop')
  const checked = useChecked('khatha.memoVerses.checked')
  const fw = useFollow(tts.speaking || tts.paused)
  const [cur, setCur] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState({ ref: '', text: '' })
  const [err, setErr] = useState('')
  const [delId, setDelId] = useState<string | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const active = tts.speaking || tts.paused

  const list = useMemo(() => [...store.items].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0) || (a.created ?? 0) - (b.created ?? 0)), [store.items])
  const chosen = list.filter((v) => checked.has(v.id))

  useEffect(() => {
    if (!active || !cur) return
    document.getElementById(`mv-${cur}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [cur, active])

  const secs = (v: MemoVerse): SpeechSection[] => [
    { id: `${v.id}|r`, text: v.ref, say: speakableRef },
    { id: `${v.id}|b`, text: v.text },
  ]
  const play = () => {
    if (!chosen.length) return
    setCur(chosen[0].id)
    tts.speakSections(chosen.flatMap(secs), (sid) => setCur(String(sid).split('|')[0]), fw.onWord)
  }

  const openNew = () => { setEditId('new'); setForm({ ref: '', text: '' }); setErr(''); setDelId(null) }
  const openEdit = (v: MemoVerse) => { setEditId(v.id); setForm({ ref: v.ref, text: v.text }); setErr(''); setDelId(null) }
  const cancel = () => { setEditId(null); setErr('') }
  const save = (e: FormEvent) => {
    e.preventDefault()
    const ref = form.ref.trim(), text = form.text.trim()
    if (!ref) return setErr('ใส่ชื่อพระคัมภีร์ บทที่ ข้อที่ เช่น ยอห์น 3:16')
    if (!text) return setErr('ใส่เนื้อหาข้อพระคัมภีร์ก่อน')
    if (editId === 'new') {
      const pos = list.length ? Math.max(...list.map((v) => v.pos ?? 0)) + 1 : 0
      store.put([{ id: newId(), ref, text, pos, created: Date.now(), updated: 0 }])
    } else {
      const old = list.find((v) => v.id === editId)
      if (old) store.put([{ ...old, ref, text }])
      if (cur === editId) tts.stop()
    }
    cancel()
  }
  const move = (id: string, d: number) => {
    const i = list.findIndex((v) => v.id === id), j = i + d
    if (i < 0 || j < 0 || j >= list.length) return
    const next = [...list]
    ;[next[i], next[j]] = [next[j], next[i]]
    store.put(next.map((v, k) => ({ ...v, pos: k })))
  }
  const del = (id: string) => { if (cur === id) tts.stop(); store.remove(id); checked.set(checked.ids.filter((x) => x !== id)); setDelId(null) }

  const formView = (
    <form className="card us-form" onSubmit={save}>
      <h2 className="section__title">{editId === 'new' ? 'เพิ่มข้อพระคัมภีร์' : 'แก้ไขข้อพระคัมภีร์'}</h2>
      <label className="prayer-form__name">ชื่อพระคัมภีร์ บทที่ ข้อที่
        <input className="us-input" type="text" value={form.ref} maxLength={60} placeholder="เช่น ยอห์น 3:16" autoFocus onChange={(e) => setForm({ ...form, ref: e.target.value })} />
      </label>
      <label className="prayer-form__name">เนื้อหาข้อพระคัมภีร์
        <textarea className="us-input" rows={5} value={form.text} placeholder="พิมพ์หรือวางข้อความพระคัมภีร์..." onChange={(e) => setForm({ ...form, text: e.target.value })} />
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
        <span className="page-icon" aria-hidden="true">📖</span>
        <h1>ท่องจำพระคัมภีร์</h1>
        <p>{list.length} ข้อ · ติ๊กข้อที่จะท่อง แล้วกดเล่น เล่นวนซ้ำจนกดหยุด</p>
      </div>

      <ListenControls tts={tts} total={list.length} selected={chosen.length} loop={loop} onLoop={setLoop} onPlay={play}
        onSelectAll={() => checked.set(list.map((v) => v.id))} onClear={() => checked.set([])} label="ข้อพระคัมภีร์" />

      {editId !== 'new' && <button type="button" className="btn btn--gold nb-add edit-only lc__add" onClick={openNew}>＋ เพิ่มข้อพระคัมภีร์</button>}
      {editId === 'new' && formView}

      {list.length === 0 && editId !== 'new' && <p className="empty">ยังไม่มีข้อพระคัมภีร์ กด “＋ เพิ่มข้อพระคัมภีร์” แล้วใส่ชื่อข้อกับเนื้อหา</p>}

      <ol className="us-list">
        {list.map((v, idx) => {
          const on = active && cur === v.id
          const isOpen = !!open[v.id] || on || editId === v.id
          return (
            <li key={v.id} id={`mv-${v.id}`} className={`us-card lc-card${on ? ' us-card--on' : ''}${isOpen ? '' : ' us-card--fold'}`}>
              {editId === v.id ? formView : (
                <>
                  <div className="lc-head">
                    <label className="lc-check" aria-label={`เลือกท่อง ${v.ref}`}>
                      <input type="checkbox" checked={checked.has(v.id)} onChange={() => checked.toggle(v.id)} />
                    </label>
                    <button type="button" className="qa-q" aria-expanded={isOpen} onClick={() => setOpen({ ...open, [v.id]: !open[v.id] })}>
                      <span className="qa-q__t">{v.ref}</span>
                      <span className="qa-q__chev" aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
                    </button>
                  </div>
                  {!isOpen && <p className="lc-preview">{v.text}</p>}
                  {isOpen && <div className="us-card__body"><p><Spoken text={v.text} id={`${v.id}|b`} follow={fw.follow} /></p></div>}
                  {isOpen && (delId === v.id ? (
                    <div className="duty__btns duty__btns--warn">
                      <span>ลบข้อนี้?</span>
                      <button type="button" className="btn btn--danger" onClick={() => del(v.id)}>ลบ</button>
                      <button type="button" className="btn btn--ghost" onClick={() => setDelId(null)}>ไม่ลบ</button>
                    </div>
                  ) : (
                    <div className="duty__btns us-card__btns edit-only">
                      <button type="button" className="mini" onClick={() => openEdit(v)}>✏️ แก้ไข</button>
                      <button type="button" className="mini" onClick={() => { setDelId(v.id); setEditId(null) }}>🗑️ ลบ</button>
                      <button type="button" className="mini" aria-label="เลื่อนขึ้น" disabled={idx === 0} onClick={() => move(v.id, -1)}>▲</button>
                      <button type="button" className="mini" aria-label="เลื่อนลง" disabled={idx === list.length - 1} onClick={() => move(v.id, 1)}>▼</button>
                    </div>
                  ))}
                </>
              )}
            </li>
          )
        })}
      </ol>

      <SharedSyncLine sync={store.sync} items={list.map((v) => ({ ...v, title: v.ref }))} onRetry={store.syncNow} />
    </>
  )
}
