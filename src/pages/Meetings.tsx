import { useState, type FormEvent, type ReactNode } from 'react'
import { IconSearch } from '../components/Icons'
import SharedSyncLine from '../components/SharedSyncLine'
import { useRole } from '../lib/members'
import { extractText, MAX_FILE_MB, safeName, sizeLabel } from '../lib/meetingFiles'
import { useSharedStore } from '../lib/sharedStore'
import { getBinary, getSync, putBinary, type SharedItem } from '../lib/sync'

/**
 * มติที่ประชุม — บันทึกการประชุมและมติทุกครั้ง · แนบ PDF/Word ได้
 * ข้อความในไฟล์ถูกดึงมาเก็บเป็นตัวอักษรตอนอัปโหลดครั้งเดียว ค้นหาได้ทันทีโดยไม่ต้องเปิดไฟล์ใหม่
 * ทุกคนในกลุ่มเห็นและดาวน์โหลดได้ · เพิ่ม/แก้ไข/ลบ: แอดมินและผู้ที่มีสิทธิ์ “แก้ไขได้”
 */
interface Resolution { id: string; topic: string; decision: string }
interface MFile { id: string; name: string; size: number; path: string; text: string }
interface Meeting extends SharedItem { date: string; no?: string; docNo?: string; keywords?: string; title: string; attendees: string; resolutions: Resolution[]; notes: string; files: MFile[]; created: number }
interface Draft { id: string; date: string; no: string; docNo: string; keywords: string; title: string; attendees: string; resolutions: Resolution[]; notes: string; files: MFile[] }
interface Pending { key: string; file: File; text: string; note: string }

const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const thaiDate = (s: string) => { const d = new Date(`${s}T00:00:00`); return isNaN(+d) ? s : d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) }
const emptyDraft = (): Draft => ({ id: uid('mt_'), date: today(), no: '', docNo: '', keywords: '', title: '', attendees: '', resolutions: [{ id: uid('r_'), topic: '', decision: '' }], notes: '', files: [] })

const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
/** ทุกรูปแบบที่พิมพ์ค้นหาวันที่ได้: 7 ตุลาคม 2569 · 7 ต.ค. 69 · 7/10/2569 · 07/10/2026 · 2026-10-07 · ตุลาคม · 2569 */
function dateForms(s: string): string {
  const [y, mo, d] = s.split('-').map(Number)
  if (!y || !mo || !d) return s
  const be = y + 543, dd = String(d).padStart(2, '0'), mm = String(mo).padStart(2, '0')
  return [s, `${d}/${mo}/${be}`, `${dd}/${mm}/${be}`, `${d}/${mo}/${y}`, `${dd}/${mm}/${y}`, `${d}-${mo}-${be}`, `${d} ${MONTHS[mo - 1]} ${be}`, `${d} ${SHORT[mo - 1]} ${be}`, `${d} ${SHORT[mo - 1]} ${String(be).slice(2)}`, `${MONTHS[mo - 1]} ${be}`, `${MONTHS[mo - 1]} ${y}`, `${d} ${MONTHS[mo - 1]} ${y}`, `${be}`, `${y}`].join('\n')
}
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
function hi(text: string, words: string[]): ReactNode {
  if (!words.length) return text
  const re = new RegExp(`(${words.map(esc).join('|')})`, 'gi')
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))
}
function snippet(text: string, words: string[]): string {
  const low = text.toLowerCase()
  const hit = words.map((w) => low.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0]
  if (hit === undefined) return ''
  const a = Math.max(0, hit - 60)
  return `${a > 0 ? '… ' : ''}${text.slice(a, hit + 160).replace(/\s+/g, ' ')} …`
}

export default function MeetingsPage() {
  const role = useRole()
  const canEdit = role === 'admin' || role === 'editor'
  const store = useSharedStore<Meeting>({ localKey: 'khatha.meetings.v1', file: 'meetings.json', label: 'มติที่ประชุม' })
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [draft, setDraft] = useState<Draft | null>(null)
  const [isNew, setIsNew] = useState(true)
  const [pending, setPending] = useState<Pending[]>([])
  const [reading, setReading] = useState(false)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [delId, setDelId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [busyFile, setBusyFile] = useState('')
  const cfg = getSync()

  const list = [...store.items].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created ?? 0) - (a.created ?? 0))
  const words = q.trim().toLowerCase().replace(/(ครั้งที่|เลขที่)\s+/g, '$1\u0001').split(/\s+/).filter(Boolean).map((w) => w.replace(/\u0001/g, ' '))
  const searching = words.length > 0
  const hay = (m: Meeting) =>
    [m.title, dateForms(m.date), m.no ? `ครั้งที่ ${m.no} ที่ ${m.no} ${m.no}` : '', m.docNo ? `เลขที่ ${m.docNo} ${m.docNo}` : '', m.keywords, m.attendees, m.notes, ...m.resolutions.flatMap((r) => [r.topic, r.decision]), ...m.files.flatMap((f) => [f.name, f.text])].join('\n').toLowerCase()
  const shown = searching ? list.filter((m) => words.every((w) => hay(m).includes(w))) : list

  const flash = (t: string) => { setMsg(t); window.setTimeout(() => setMsg(''), 3500) }
  const openNew = () => { setDraft(emptyDraft()); setIsNew(true); setPending([]); setErr(''); setDelId(null) }
  const openEdit = (m: Meeting) => { setDraft({ id: m.id, date: m.date, no: m.no || '', docNo: m.docNo || '', keywords: m.keywords || '', title: m.title, attendees: m.attendees || '', resolutions: m.resolutions.length ? m.resolutions.map((r) => ({ ...r })) : [{ id: uid('r_'), topic: '', decision: '' }], notes: m.notes || '', files: [...m.files] }); setIsNew(false); setPending([]); setErr(''); setDelId(null) }
  const cancel = () => { setDraft(null); setPending([]); setErr('') }

  const setRes = (id: string, patch: Partial<Resolution>) => draft && setDraft({ ...draft, resolutions: draft.resolutions.map((r) => (r.id === id ? { ...r, ...patch } : r)) })

  const pick = async (files: FileList | null) => {
    if (!files || !draft) return
    setErr('')
    setReading(true)
    const add: Pending[] = []
    for (const f of [...files]) {
      if (f.size > MAX_FILE_MB * 1048576) { setErr(`“${f.name}” ใหญ่เกิน ${MAX_FILE_MB} MB`); continue }
      const x = await extractText(f)
      add.push({ key: uid('f_'), file: f, text: x.text, note: x.note })
    }
    setPending((p) => [...p, ...add])
    setReading(false)
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    const title = draft.title.trim()
    const resolutions = draft.resolutions.map((r) => ({ ...r, topic: r.topic.trim(), decision: r.decision.trim() })).filter((r) => r.topic || r.decision)
    if (!title) return setErr('ใส่ชื่อการประชุมก่อน เช่น “ประชุมผู้ปกครอง ครั้งที่ 5”')
    if (!draft.date) return setErr('เลือกวันที่ประชุมก่อน')
    if (!resolutions.length && !draft.notes.trim() && !draft.files.length && !pending.length) return setErr('ใส่มติ บันทึก หรือแนบไฟล์อย่างน้อยหนึ่งอย่าง')
    setSaving(true)
    setErr('')
    try {
      const newFiles: MFile[] = []
      if (pending.length) {
        if (!cfg) throw new Error('ต้องเชื่อมออนไลน์ก่อน (ตั้งค่า › ใช้ร่วมกันออนไลน์) จึงแนบไฟล์ได้ — หรือกด ✕ เอาไฟล์ออกแล้วบันทึกเฉพาะข้อความ')
        for (const p of pending) {
          const path = `meetings/files/${draft.id}-${Date.now().toString(36)}-${safeName(p.file.name)}`
          await putBinary(cfg, path, await p.file.arrayBuffer(), p.file.name)
          newFiles.push({ id: p.key, name: p.file.name, size: p.file.size, path, text: p.text })
        }
      }
      const item: Meeting = { id: draft.id, date: draft.date, no: draft.no.trim(), docNo: draft.docNo.trim(), keywords: draft.keywords.trim(), title, attendees: draft.attendees.trim(), resolutions, notes: draft.notes.trim(), files: [...draft.files, ...newFiles], created: Date.now(), updated: 0 }
      if (!isNew) item.created = store.items.find((x) => x.id === draft.id)?.created ?? item.created
      store.put([item])
      setOpen((o) => ({ ...o, [item.id]: true }))
      cancel()
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'บันทึกไม่สำเร็จ')
    }
    setSaving(false)
  }

  const del = (id: string) => { store.remove(id); setDelId(null) }

  const openFile = async (f: MFile, download: boolean) => {
    if (!cfg) return flash('ต้องเชื่อมออนไลน์ก่อนจึงเปิดไฟล์ได้')
    setBusyFile(f.id)
    try {
      const blob = await getBinary(cfg, f.path)
      const url = URL.createObjectURL(new Blob([blob], { type: f.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : blob.type }))
      const a = document.createElement('a')
      a.href = url
      if (download) a.download = f.name
      else a.target = '_blank'
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (e2) {
      flash(e2 instanceof Error ? e2.message : 'เปิดไฟล์ไม่สำเร็จ')
    }
    setBusyFile('')
  }

  const form = draft && (
    <form className="card us-form" onSubmit={save}>
      <h2 className="section__title">{isNew ? 'บันทึกการประชุมใหม่' : 'แก้ไขบันทึกการประชุม'}</h2>
      <div className="mt-row">
        <label className="prayer-form__name">วันที่ประชุม
          <input className="us-input" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
        </label>
        <label className="prayer-form__name">ชื่อการประชุม
          <input className="us-input" type="text" value={draft.title} maxLength={140} placeholder="เช่น ประชุมผู้ปกครอง ครั้งที่ 5" autoFocus onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </label>
      </div>
      <div className="mt-row mt-row--2">
        <label className="prayer-form__name">ครั้งที่ (ไม่ใส่ก็ได้)
          <input className="us-input" type="text" value={draft.no} maxLength={20} placeholder="เช่น 5 หรือ 3/2569" onChange={(e) => setDraft({ ...draft, no: e.target.value })} />
        </label>
        <label className="prayer-form__name">เลขที่เอกสาร (ไม่ใส่ก็ได้)
          <input className="us-input" type="text" value={draft.docNo} maxLength={40} placeholder="เช่น คศ.012/2569" onChange={(e) => setDraft({ ...draft, docNo: e.target.value })} />
        </label>
      </div>
      <label className="prayer-form__name">คำสำคัญสำหรับค้นหา (ไม่ใส่ก็ได้)
        <input className="us-input" type="text" value={draft.keywords} maxLength={200} placeholder="เช่น งบประมาณ, ซ่อมอาคาร, เลือกตั้ง" onChange={(e) => setDraft({ ...draft, keywords: e.target.value })} />
      </label>
      <label className="prayer-form__name">ผู้เข้าร่วม (ไม่ใส่ก็ได้)
        <input className="us-input" type="text" value={draft.attendees} maxLength={300} placeholder="เช่น ผู้ปกครองทุกท่าน 8 คน" onChange={(e) => setDraft({ ...draft, attendees: e.target.value })} />
      </label>

      <div className="mt-res">
        <p className="members__h">มติ / เรื่องที่ตกลงกัน</p>
        {draft.resolutions.map((r, i) => (
          <div key={r.id} className="mt-res__row">
            <span className="mt-res__n">{i + 1}</span>
            <div className="mt-res__f">
              <input className="us-input" type="text" value={r.topic} maxLength={160} placeholder="หัวข้อ เช่น งบประมาณซ่อมอาคาร" onChange={(e) => setRes(r.id, { topic: e.target.value })} aria-label={`หัวข้อมติที่ ${i + 1}`} />
              <textarea className="us-input" rows={2} value={r.decision} placeholder="มติ / สิ่งที่ตกลง เช่น อนุมัติ 50,000 บาท มอบหมายให้…" onChange={(e) => setRes(r.id, { decision: e.target.value })} aria-label={`มติที่ ${i + 1}`} />
            </div>
            <button type="button" className="mini" aria-label={`เอามติที่ ${i + 1} ออก`} disabled={draft.resolutions.length === 1 && !r.topic && !r.decision} onClick={() => setDraft({ ...draft, resolutions: draft.resolutions.length > 1 ? draft.resolutions.filter((x) => x.id !== r.id) : [{ id: uid('r_'), topic: '', decision: '' }] })}>✕</button>
          </div>
        ))}
        <button type="button" className="btn btn--ghost" onClick={() => setDraft({ ...draft, resolutions: [...draft.resolutions, { id: uid('r_'), topic: '', decision: '' }] })}>＋ เพิ่มมติอีกข้อ</button>
      </div>

      <label className="prayer-form__name">บันทึกเพิ่มเติม (ไม่ใส่ก็ได้)
        <textarea className="us-input" rows={4} value={draft.notes} placeholder="สรุปการพูดคุย สิ่งที่ต้องติดตาม ฯลฯ" onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
      </label>

      <div className="mt-files">
        <p className="members__h">📎 ไฟล์ประกอบ (PDF / Word)</p>
        <p className="source-note">เมื่อเลือกไฟล์ ระบบดึงข้อความในไฟล์มาเก็บเป็นตัวอักษรไว้ให้ค้นหาได้ทันที · ไฟล์ละไม่เกิน {MAX_FILE_MB} MB · ไฟล์สแกนเป็นรูปดึงข้อความไม่ได้</p>
        {draft.files.map((f) => (
          <p key={f.id} className="mt-file">📄 <span>{f.name} <small>({sizeLabel(f.size)})</small></span>
            <button type="button" className="mini" onClick={() => setDraft({ ...draft, files: draft.files.filter((x) => x.id !== f.id) })} aria-label={`เอา ${f.name} ออก`}>✕</button></p>
        ))}
        {pending.map((p) => (
          <div key={p.key} className="mt-file mt-file--new">
            <p>🆕 <span>{p.file.name} <small>({sizeLabel(p.file.size)})</small></span>
              <button type="button" className="mini" onClick={() => setPending(pending.filter((x) => x.key !== p.key))} aria-label={`เอา ${p.file.name} ออก`}>✕</button></p>
            <small className={p.text ? 'mt-ok' : 'mt-warn'}>{p.note}</small>
            {p.text && <button type="button" className="mini" onClick={() => setDraft({ ...draft, notes: `${draft.notes.trim() ? `${draft.notes.trim()}\n\n` : ''}${p.text.slice(0, 4000)}` })}>➕ ใส่ข้อความนี้ลงในบันทึก</button>}
          </div>
        ))}
        <label className="btn btn--ghost mt-pick">
          {reading ? '⏳ กำลังอ่านไฟล์…' : '＋ เลือกไฟล์'}
          <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword" multiple hidden disabled={reading} onChange={(e) => { void pick(e.target.files); e.target.value = '' }} />
        </label>
      </div>

      {err && <p className="ai-keys__err" role="alert">{err}</p>}
      <div className="duty__btns">
        <button type="submit" className="btn btn--gold" disabled={saving || reading}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button>
        <button type="button" className="btn btn--ghost" onClick={cancel} disabled={saving}>ยกเลิก</button>
      </div>
    </form>
  )

  return (
    <>
      <div className="page-head">
        <span className="page-icon" aria-hidden="true">📝</span>
        <h1>มติที่ประชุม</h1>
        <p>{list.length} ครั้ง · เก็บมติและไฟล์ประกอบทุกการประชุม ค้นหาได้จากครั้งที่ วันที่ เลขที่ หัวข้อ มติ คำสำคัญ หรือเนื้อหาในไฟล์</p>
      </div>

      <div className="nb-bar us-tools">
        <label className="nb-search">
          <span className="sr-only">ค้นหามติที่ประชุม</span>
          <IconSearch />
          <input type="search" value={q} placeholder="ค้นหา: ครั้งที่ · วันที่ · เลขที่ · มติ · คำในไฟล์" onChange={(e) => setQ(e.target.value)} />
        </label>
        {canEdit && <button type="button" className="btn btn--gold nb-add edit-only" onClick={openNew}>＋ บันทึกประชุม</button>}
      </div>

      {list.length > 1 && !searching && (
        <p className="us-fold">
          <button type="button" className="mini" onClick={() => setOpen(Object.fromEntries(list.map((x) => [x.id, true])))}>▾ ขยายทั้งหมด</button>
          <button type="button" className="mini" onClick={() => setOpen({})}>▴ พับทั้งหมด</button>
        </p>
      )}
      {msg && <p className="nb-sync nb-sync--ok" role="status">{msg}</p>}
      {draft && isNew && form}

      {list.length === 0 && !draft && (
        <div className="empty us-empty"><p>ยังไม่มีบันทึกการประชุม{canEdit ? ' กด “＋ บันทึกประชุม” เพื่อเพิ่มมติและแนบไฟล์ PDF/Word ของการประชุมครั้งแรก' : ''}</p></div>
      )}
      {searching && <p className="source-note" role="status">{shown.length === 0 ? 'ไม่พบมติหรือไฟล์ที่ตรงกับคำค้น' : `พบ ${shown.length} การประชุม`}</p>}

      <ul className="us-list">
        {shown.map((m) => {
          const isOpen = searching || !!open[m.id] || draft?.id === m.id
          const matchRes = (r: Resolution) => searching && words.some((w) => `${r.topic}\n${r.decision}`.toLowerCase().includes(w))
          return (
            <li key={m.id} id={`mt-${m.id}`} className={`us-card${isOpen ? '' : ' us-card--fold'}`}>
              {draft?.id === m.id && !isNew ? form : (
                <>
                  <button type="button" className="qa-q" aria-expanded={isOpen} onClick={() => setOpen({ ...open, [m.id]: !open[m.id] })}>
                    <span className="qa-q__t">{m.title}</span>
                    <span className="badge">{thaiDate(m.date)}</span>
                    {m.files.length > 0 && <span aria-label={`${m.files.length} ไฟล์`}>📎{m.files.length}</span>}
                    <span className="qa-q__chev" aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
                  </button>
                  {isOpen && (
                    <>
                      {(m.no || m.docNo || m.keywords) && <p className="mt-meta">{m.no && <>ครั้งที่ {hi(m.no, words)} </>}{m.docNo && <>· เลขที่ {hi(m.docNo, words)} </>}{m.keywords && <>· 🏷 {hi(m.keywords, words)}</>}</p>}
                      {m.attendees && <p className="mt-meta">👥 {m.attendees}</p>}
                      {m.resolutions.length > 0 && (
                        <ol className="mt-list">
                          {m.resolutions.map((r) => (
                            <li key={r.id} className={matchRes(r) ? 'mt-hit' : ''}>
                              {r.topic && <b>{hi(r.topic, words)}</b>}
                              {r.decision && <p>{hi(r.decision, words)}</p>}
                            </li>
                          ))}
                        </ol>
                      )}
                      {m.notes && <p className="us-card__body">{hi(m.notes, words)}</p>}
                      {m.files.length > 0 && (
                        <div className="mt-files">
                          {m.files.map((f) => {
                            const sn = searching ? snippet(f.text, words) : ''
                            return (
                              <div key={f.id} className="mt-file mt-file--card">
                                <p>📄 <span>{hi(f.name, words)} <small>({sizeLabel(f.size)})</small></span></p>
                                {sn && <p className="mt-snip">{hi(sn, words)}</p>}
                                <div className="duty__btns">
                                  {f.name.toLowerCase().endsWith('.pdf') && <button type="button" className="mini" disabled={busyFile === f.id} onClick={() => void openFile(f, false)}>👁 เปิดดู</button>}
                                  <button type="button" className="mini" disabled={busyFile === f.id} onClick={() => void openFile(f, true)}>{busyFile === f.id ? '⏳ กำลังโหลด…' : '⬇ ดาวน์โหลด'}</button>
                                  {f.text && <button type="button" className="mini" onClick={() => setOpen({ ...open, [`t${f.id}`]: !open[`t${f.id}`] })}>{open[`t${f.id}`] ? '▴ ซ่อนข้อความในไฟล์' : '▾ ข้อความในไฟล์'}</button>}
                                </div>
                                {f.text && open[`t${f.id}`] && <p className="us-card__body mt-text">{hi(f.text, words)}</p>}
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {delId === m.id ? (
                        <div className="duty__btns duty__btns--warn">
                          <span>ลบบันทึกการประชุมนี้?</span>
                          <button type="button" className="btn btn--danger" onClick={() => del(m.id)}>ลบ</button>
                          <button type="button" className="btn btn--ghost" onClick={() => setDelId(null)}>ไม่ลบ</button>
                        </div>
                      ) : canEdit && (
                        <div className="duty__btns us-card__btns edit-only">
                          <button type="button" className="mini" onClick={() => openEdit(m)}>✏️ แก้ไข</button>
                          <button type="button" className="mini" onClick={() => { setDelId(m.id); setDraft(null) }}>🗑️ ลบ</button>
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

      <SharedSyncLine sync={store.sync} items={list} onRetry={store.syncNow} />
      <p className="source-note">ทุกคนในกลุ่มเห็นและดาวน์โหลดได้ · เพิ่ม/แก้ไข/ลบ: แอดมินและผู้ที่มีสิทธิ์ “แก้ไขได้” · ไฟล์เก็บใน repo ข้อมูลส่วนตัวของกลุ่ม (ไม่ใช่ที่สาธารณะ) · ลบการประชุมแล้ว ไฟล์ใน repo ยังอยู่ (ลบเองได้ที่ GitHub ถ้าต้องการ)</p>
    </>
  )
}
