import { useEffect, useState, type FormEvent } from 'react'
import { IconSearch } from '../components/Icons'
import SharedSyncLine from '../components/SharedSyncLine'
import { useSharedStore } from '../lib/sharedStore'
import { RATES, useSpeech } from '../lib/speech'
import type { SharedItem } from '../lib/sync'

/**
 * สคริปต์เร่งด่วน — คำพูด/คีย์เวิร์ดที่ต้องใช้ตอนประชุมหรือสถานการณ์เร่งด่วน
 * เพิ่ม แก้ไข ลบ เรียงลำดับได้ กดฟังได้ทีละเรื่องหรือฟังต่อเนื่องทั้งหมด
 * เก็บในเครื่อง และซิงก์ขึ้น GitHub เหมือนโน้ต/หน้าที่ผู้ปกครองเมื่อเข้าสู่ระบบ
 */
interface ScriptItem extends SharedItem { title: string; tag: string; body: string; pos: number; created: number }

const SAMPLE = {
  title: 'เปิดประชุมผู้ปกครอง (ตัวอย่าง — ลบหรือแก้ไขได้)',
  tag: 'ประชุม',
  body: 'กล่าวต้อนรับและขอบคุณทุกท่านที่สละเวลามาประชุม\nเปิดด้วยการอธิษฐานสั้น ๆ ขอพระเจ้านำการประชุมนี้\nแจ้งวาระการประชุมและเวลาที่ใช้ให้ทุกคนทราบ\nขอให้พูดทีละคน และฟังกันด้วยความรัก\nสรุปมติและผู้รับผิดชอบก่อนปิดประชุมทุกครั้ง',
}
const newId = () => `us_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export default function UrgentScriptsPage() {
  const store = useSharedStore<ScriptItem>({ localKey: 'khatha.urgentScripts.v1', file: 'urgent-scripts.json', label: 'สคริปต์เร่งด่วน' })
  const tts = useSpeech('th-TH')
  const [q, setQ] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', tag: '', body: '' })
  const [err, setErr] = useState('')
  const [delId, setDelId] = useState<string | null>(null)
  const [cur, setCur] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const list = [...store.items].sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0) || (a.updated ?? 0) - (b.updated ?? 0))
  const needle = q.trim().toLowerCase()
  const shown = needle ? list.filter((s) => [s.title, s.tag, s.body].join('\n').toLowerCase().includes(needle)) : list
  const active = tts.speaking || tts.paused
  const curScript = list.find((s) => s.id === cur)
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
        <h1>สคริปต์เร่งด่วน</h1>
        <p>{list.length} สคริปต์ · เก็บคำพูดสำคัญไว้ กดฟังได้ทันที เพิ่ม แก้ไข ลบ หรือเรียงลำดับได้</p>
      </div>

      <SharedSyncLine sync={store.sync} items={list} onRetry={store.syncNow} />

      {list.length > 0 && (
        <section className="card us-bar" aria-label="ฟังต่อเนื่อง">
          {tts.supported ? (
            <>
              <div className="us-bar__main">
                {active ? (
                  <>
                    {tts.speaking
                      ? <button type="button" className="btn" onClick={tts.pause}>⏸ หยุดชั่วคราว</button>
                      : <button type="button" className="btn" onClick={tts.resume}>▶ ฟังต่อ</button>}
                    <button type="button" className="btn btn--ghost" onClick={tts.stop}>⏹ หยุด</button>
                  </>
                ) : (
                  <button type="button" className="btn btn--gold us-bar__all" onClick={() => playAllFrom(0)}>▶ ฟังทั้งหมดต่อเนื่อง</button>
                )}
              </div>
              {active && curScript && <p className="us-now" role="status">กำลังอ่าน: {curScript.title}</p>}
              {active && (
                <div className="us-bar__step">
                  <button type="button" className="mini" disabled={curIdx <= 0} onClick={() => stepTo(-1)} aria-label="สคริปต์ก่อนหน้า">⏮ ก่อนหน้า</button>
                  <button type="button" className="mini" disabled={curIdx < 0 || curIdx >= shown.length - 1} onClick={() => stepTo(1)} aria-label="สคริปต์ถัดไป">ถัดไป ⏭</button>
                </div>
              )}
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
            </>
          ) : (
            <p className="ai-keys__err">เบราว์เซอร์นี้ไม่รองรับเสียงอ่าน — ยังอ่านและแก้ไขสคริปต์ได้ตามปกติ</p>
          )}
        </section>
      )}

      <div className="nb-bar us-tools">
        <label className="nb-search">
          <span className="sr-only">ค้นหาสคริปต์</span>
          <IconSearch />
          <input type="search" value={q} placeholder="ค้นหาสคริปต์" onChange={(e) => setQ(e.target.value)} />
        </label>
        <button type="button" className="btn btn--gold nb-add" onClick={openNew}>＋ เพิ่มสคริปต์</button>
      </div>

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
          const idx = list.findIndex((x) => x.id === s.id)
          return (
            <li key={s.id} id={`us-${s.id}`} className={`us-card${on ? ' us-card--on' : ''}`}>
              {editId === s.id ? formView : (
                <>
                  <div className="us-card__head">
                    <h2 className="us-card__title">{s.title}</h2>
                    {s.tag && <span className="badge">{s.tag}</span>}
                  </div>
                  <p className="us-card__body">{s.body}</p>
                  {delId === s.id ? (
                    <div className="duty__btns duty__btns--warn">
                      <span>ลบสคริปต์นี้?</span>
                      <button type="button" className="btn btn--danger" onClick={() => del(s.id)}>ลบ</button>
                      <button type="button" className="btn btn--ghost" onClick={() => setDelId(null)}>ไม่ลบ</button>
                    </div>
                  ) : (
                    <div className="duty__btns us-card__btns">
                      {tts.supported && (on
                        ? <button type="button" className="btn us-listen" onClick={tts.stop}>⏹ หยุด</button>
                        : <button type="button" className="btn btn--gold us-listen" onClick={() => play([s])} aria-label={`ฟัง ${s.title}`}>▶ ฟัง</button>)}
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

      <p className="source-note">เมื่อเชื่อมออนไลน์ (ตั้งค่า › รหัสเข้าใช้ร่วม) ทุกเครื่องที่ใส่รหัสเดียวกัน ทั้งของท่านและคู่ผู้ปกครอง จะเห็น ฟัง และแก้ไขสคริปต์ชุดเดียวกัน · ใช้เสียงอ่านเดียวกับส่วนอื่นของแอป</p>
    </>
  )
}
