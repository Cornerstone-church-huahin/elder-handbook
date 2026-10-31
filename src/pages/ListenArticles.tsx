import { useEffect, useMemo, useState, type FormEvent } from 'react'
import ListenControls, { useChecked, useLoopPref } from '../components/ListenControls'
import SharedSyncLine from '../components/SharedSyncLine'
import { Spoken, useFollow } from '../components/Spoken'
import { useSharedStore } from '../lib/sharedStore'
import { useSpeech, type SpeechSection } from '../lib/speech'
import type { SharedItem } from '../lib/sync'

/**
 * ฟังบทความ — วางบทความแล้วฟัง: ติ๊กการ์ดที่ต้องการ กดฟัง เล่นต่อเนื่องตามลำดับแล้ววนซ้ำได้
 * ที่เก็บ/ซิงก์/เสียง/ความเร็ว ใช้หลักการเดียวกับ "เตรียมคำอธิษฐาน" (เก็บในเครื่อง + ใช้ร่วมกันออนไลน์ถ้าตั้งค่าไว้)
 */
export interface Article extends SharedItem { title: string; body: string; pos: number; created: number }
const newId = () => `ar_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const paras = (t: string) => t.split(/\n+/).map((x) => x.trim()).filter(Boolean)

export default function ListenArticlesPage() {
  const store = useSharedStore<Article>({ localKey: 'khatha.listenArticles.v1', file: 'listen-articles.json', label: 'ฟังบทความ' })
  const tts = useSpeech('th-TH')
  const [loop, setLoop] = useLoopPref(tts, 'khatha.listenArticles.loop')
  const checked = useChecked('khatha.listenArticles.checked')
  const fw = useFollow(tts.speaking || tts.paused)
  const [cur, setCur] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState({ title: '', body: '' })
  const [err, setErr] = useState('')
  const [delId, setDelId] = useState<string | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const active = tts.speaking || tts.paused

  const list = useMemo(() => [...store.items].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0) || (a.created ?? 0) - (b.created ?? 0)), [store.items])
  const chosen = list.filter((a) => checked.has(a.id))

  useEffect(() => {
    if (!active || !cur) return
    document.getElementById(`ar-${cur}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [cur, active])

  const secs = (a: Article, n: number): SpeechSection[] => [
    { id: `${a.id}|t`, text: `บทความที่ ${n} ${a.title}.` },
    ...paras(a.body).map((x, i) => ({ id: `${a.id}|p${i}`, text: x })),
  ]
  const play = () => {
    if (!chosen.length) return
    const all = chosen.flatMap((a) => secs(a, list.findIndex((y) => y.id === a.id) + 1))
    setCur(chosen[0].id)
    tts.speakSections(all, (sid) => setCur(String(sid).split('|')[0]), fw.onWord)
  }

  const openNew = () => { setEditId('new'); setForm({ title: '', body: '' }); setErr(''); setDelId(null) }
  const openEdit = (a: Article) => { setEditId(a.id); setForm({ title: a.title, body: a.body }); setErr(''); setDelId(null) }
  const cancel = () => { setEditId(null); setErr('') }
  const save = (e: FormEvent) => {
    e.preventDefault()
    const title = form.title.trim(), body = form.body.trim()
    if (!body) return setErr('วางหรือพิมพ์เนื้อบทความก่อน')
    const name = title || body.split('\n')[0].slice(0, 40)
    if (editId === 'new') {
      const pos = list.length ? Math.max(...list.map((a) => a.pos ?? 0)) + 1 : 0
      store.put([{ id: newId(), title: name, body, pos, created: Date.now(), updated: 0 }])
    } else {
      const old = list.find((a) => a.id === editId)
      if (old) store.put([{ ...old, title: name, body }])
      if (cur === editId) tts.stop()
    }
    cancel()
  }
  const move = (id: string, d: number) => {
    const i = list.findIndex((a) => a.id === id), j = i + d
    if (i < 0 || j < 0 || j >= list.length) return
    const next = [...list]
    ;[next[i], next[j]] = [next[j], next[i]]
    store.put(next.map((a, k) => ({ ...a, pos: k })))
  }
  const del = (id: string) => { if (cur === id) tts.stop(); store.remove(id); checked.set(checked.ids.filter((x) => x !== id)); setDelId(null) }

  const formView = (
    <form className="card us-form" onSubmit={save}>
      <h2 className="section__title">{editId === 'new' ? 'เพิ่มบทความ' : 'แก้ไขบทความ'}</h2>
      <label className="prayer-form__name">ชื่อบทความ (ไม่ใส่ก็ได้)
        <input className="us-input" type="text" value={form.title} maxLength={120} placeholder="เช่น คำเทศนาวันอาทิตย์" onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </label>
      <label className="prayer-form__name">เนื้อบทความ (วางได้เลย)
        <small>ขึ้นบรรทัดใหม่ทีละย่อหน้า เสียงอ่านจะหยุดพักตามย่อหน้า</small>
        <textarea className="us-input" rows={10} value={form.body} autoFocus placeholder="วางหรือพิมพ์บทความที่นี่..." onChange={(e) => setForm({ ...form, body: e.target.value })} />
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
        <span className="page-icon" aria-hidden="true">🎧</span>
        <h1>ฟังบทความ</h1>
        <p>{list.length} บทความ · ติ๊กการ์ดที่ต้องการ แล้วกดฟัง เล่นต่อเนื่องและวนซ้ำได้</p>
      </div>

      <ListenControls tts={tts} total={list.length} selected={chosen.length} loop={loop} onLoop={setLoop} onPlay={play}
        onSelectAll={() => checked.set(list.map((a) => a.id))} onClear={() => checked.set([])} label="บทความ" />

      {editId !== 'new' && <button type="button" className="btn btn--gold nb-add edit-only lc__add" onClick={openNew}>＋ เพิ่มบทความ</button>}
      {editId === 'new' && formView}

      {list.length === 0 && editId !== 'new' && <p className="empty">ยังไม่มีบทความ กด “＋ เพิ่มบทความ” แล้ววางข้อความที่ต้องการฟัง</p>}

      <ol className="us-list">
        {list.map((a, idx) => {
          const on = active && cur === a.id
          const isOpen = !!open[a.id] || on || editId === a.id
          return (
            <li key={a.id} id={`ar-${a.id}`} className={`us-card lc-card${on ? ' us-card--on' : ''}${isOpen ? '' : ' us-card--fold'}`}>
              {editId === a.id ? formView : (
                <>
                  <div className="lc-head">
                    <label className="lc-check" aria-label={`เลือกฟัง ${a.title}`}>
                      <input type="checkbox" checked={checked.has(a.id)} onChange={() => checked.toggle(a.id)} />
                    </label>
                    <button type="button" className="qa-q" aria-expanded={isOpen} onClick={() => setOpen({ ...open, [a.id]: !open[a.id] })}>
                      <span className="qa-q__t">{a.title}</span>
                      <span className="qa-q__chev" aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
                    </button>
                  </div>
                  {isOpen && (
                    <div className="us-card__body">
                      {on && <p><Spoken text={`บทความที่ ${idx + 1} ${a.title}.`} id={`${a.id}|t`} follow={fw.follow} /></p>}
                      {paras(a.body).map((x, i) => <p key={i}><Spoken text={x} id={`${a.id}|p${i}`} follow={fw.follow} /></p>)}
                    </div>
                  )}
                  {isOpen && (delId === a.id ? (
                    <div className="duty__btns duty__btns--warn">
                      <span>ลบบทความนี้?</span>
                      <button type="button" className="btn btn--danger" onClick={() => del(a.id)}>ลบ</button>
                      <button type="button" className="btn btn--ghost" onClick={() => setDelId(null)}>ไม่ลบ</button>
                    </div>
                  ) : (
                    <div className="duty__btns us-card__btns edit-only">
                      <button type="button" className="mini" onClick={() => openEdit(a)}>✏️ แก้ไข</button>
                      <button type="button" className="mini" onClick={() => { setDelId(a.id); setEditId(null) }}>🗑️ ลบ</button>
                      <button type="button" className="mini" aria-label="เลื่อนขึ้น" disabled={idx === 0} onClick={() => move(a.id, -1)}>▲</button>
                      <button type="button" className="mini" aria-label="เลื่อนลง" disabled={idx === list.length - 1} onClick={() => move(a.id, 1)}>▼</button>
                    </div>
                  ))}
                </>
              )}
            </li>
          )
        })}
      </ol>

      <SharedSyncLine sync={store.sync} items={list} onRetry={store.syncNow} />
    </>
  )
}
