import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconSearch } from '../components/Icons'
import SharedSyncLine from '../components/SharedSyncLine'
import { useRole } from '../lib/members'
import { cleanName, extractText, MAX_FILE_MB, safeName, sizeLabel } from '../lib/meetingFiles'
import { useSharedStore } from '../lib/sharedStore'
import { useSpeech } from '../lib/speech'
import { getBinary, getSync, putBinary, type SharedItem } from '../lib/sync'

/**
 * มติที่ประชุม — บันทึกการประชุมและมติทุกครั้ง · แนบ PDF/Word ได้
 * ข้อความในไฟล์ถูกดึงมาเก็บเป็นตัวอักษรตอนอัปโหลดครั้งเดียว ค้นหาได้ทันทีโดยไม่ต้องเปิดไฟล์ใหม่
 * ทุกคนในกลุ่มเห็นและดาวน์โหลดได้ · เพิ่ม/แก้ไข/ลบ: แอดมินและผู้ที่มีสิทธิ์ “แก้ไขได้”
 */
interface Resolution { id: string; topic: string; decision: string }
interface MFile { id: string; name: string; label?: string; size: number; path: string; text: string; edited?: boolean }
interface Meeting extends SharedItem { date: string; no?: string; docNo?: string; keywords?: string; title: string; attendees: string; resolutions: Resolution[]; notes: string; files: MFile[]; created: number }
interface Draft { id: string; date: string; no: string; docNo: string; keywords: string; title: string; attendees: string; resolutions: Resolution[]; notes: string; files: MFile[] }
interface Pending { key: string; label: string; file: File; text: string; note: string }

const disp = (f: MFile) => f.label?.trim() || cleanName(f.name)
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
/** เทียบแบบไม่สนช่องว่าง/ตัวพิมพ์ — PDF และ OCR มักแทรกช่องว่างกลางคำไทย */
const norm = (s: string) => s.toLowerCase().normalize('NFC').replace(/[\s\u200b-\u200d\ufeff]+/g, '')
const termRe = (w: string) => [...norm(w)].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\u200b-\\u200d]*')
function hi(text: string, words: string[]): ReactNode {
  if (!words.length) return text
  const re = new RegExp(`(${words.map(termRe).join('|')})`, 'gi')
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part))
}
function snippet(text: string, words: string[]): string {
  const hit = words.map((w) => text.search(new RegExp(termRe(w), 'i'))).filter((i) => i >= 0).sort((a, b) => a - b)[0]
  if (hit === undefined) return ''
  const a = Math.max(0, hit - 60)
  return `${a > 0 ? '… ' : ''}${text.slice(a, hit + 160).replace(/\s+/g, ' ')} …`
}

/** แท็บย่อยที่พับ/ขยายได้ — ไม่แสดงเนื้อหายาวจนกว่าจะกดอ่าน */
function Sub({ title, open, item, children }: { title: string; open?: boolean; item?: boolean; children: ReactNode }) {
  return (
    <details className={`mt-sub${item ? ' mt-sub--item' : ''}`} open={open || undefined}>
      <summary>{title}</summary>
      <div className="mt-sub__body">{children}</div>
    </details>
  )
}

export default function MinutesPage() {
  const role = useRole()
  const canEdit = role === 'admin' || role === 'editor'
  const store = useSharedStore<Meeting>({ localKey: 'khatha.meetings.v1', file: 'meetings.json', label: 'มติที่ประชุม' })
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [draft, setDraft] = useState<Draft | null>(null)
  const [isNew, setIsNew] = useState(true)
  const [pending, setPending] = useState<Pending[]>([])
  const [reading, setReading] = useState(false)
  const [prog, setProg] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [delId, setDelId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [busyFile, setBusyFile] = useState('')
  const [tx, setTx] = useState<Record<string, string>>({}) // ข้อความไฟล์ที่กำลังแก้ (ยังไม่บันทึก)
  const cfg = getSync()
  const tts = useSpeech('th-TH')
  const [cur, setCur] = useState<string | null>(null)
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => setSlot(document.getElementById('topbar-slot')), [])

  const list = [...store.items].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.created ?? 0) - (a.created ?? 0))
  const words = q.trim().toLowerCase().replace(/(ครั้งที่|เลขที่)\s+/g, '$1\u0001').split(/\s+/).filter(Boolean).map((w) => w.replace(/\u0001/g, ' '))
  const searching = words.length > 0
  const hay = (m: Meeting) =>
    [m.title, dateForms(m.date), m.no ? `ครั้งที่ ${m.no} ที่ ${m.no} ${m.no}` : '', m.docNo ? `เลขที่ ${m.docNo} ${m.docNo}` : '', m.keywords, m.attendees, m.notes, ...m.resolutions.flatMap((r) => [r.topic, r.decision]), ...m.files.flatMap((f) => [f.name, disp(f), f.text])].join('\n').toLowerCase()
  const shown = searching ? list.filter((m) => { const h = norm(hay(m)); return words.every((w) => h.includes(norm(w))) }) : list

  const active = tts.speaking || tts.paused
  /** อ่านทั้งการประชุม: ชื่อ/ครั้งที่/วันที่ → มติทีละข้อ → บันทึก → ข้อความจากไฟล์ */
  const secs = (m: Meeting) => {
    const out: { id: string; text: string }[] = []
    const add = (k: string, text: string) => text.trim() && out.push({ id: `${m.id}|${k}`, text })
    add('h', `การประชุม ${m.no ? `ครั้งที่ ${m.no} ` : ''}${m.title} วันที่ ${thaiDate(m.date)}.${m.docNo ? ` เลขที่เอกสาร ${m.docNo}.` : ''}${m.attendees ? ` ผู้เข้าร่วม ${m.attendees}.` : ''}`)
    m.resolutions.forEach((r, i) => add(`r${i}`, `มติข้อที่ ${i + 1}${r.topic ? ` ${r.topic}` : ''}.\n${r.decision}`))
    if (m.notes) add('n', `บันทึกเพิ่มเติม.\n${m.notes}`)
    m.files.forEach((f, i) => f.text && add(`f${i}`, `ข้อความจากไฟล์ ${disp(f)}.\n${f.text}`))
    return out
  }
  const playFrom = (i: number) => {
    const ms = shown.slice(Math.max(0, i))
    if (!tts.supported || !ms.length) return
    setCur(ms[0].id)
    tts.speakSections(ms.flatMap(secs), (sid) => setCur(String(sid).split('|')[0]))
  }
  const curIdx = shown.findIndex((m) => m.id === cur)
  const stepTo = (d: number) => { const i = curIdx < 0 ? 0 : curIdx + d; if (i >= 0 && i < shown.length) playFrom(i) }
  useEffect(() => {
    if (!active || !cur) return
    document.getElementById(`mt-${cur}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [cur, active])
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
      const x = await extractText(f, (t) => setProg(`${f.name}: ${t}`))
      add.push({ key: uid('f_'), label: cleanName(f.name), file: f, text: x.text, note: x.note })
    }
    setPending((p) => [...p, ...add])
    setProg('')
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
          newFiles.push({ id: p.key, name: p.file.name, label: p.label.trim() || cleanName(p.file.name), size: p.file.size, path, text: p.text.slice(0, 120000), edited: undefined })
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

  const rescan = async (m: Meeting, f: MFile) => {
    if (!cfg) return flash('ต้องเชื่อมออนไลน์ก่อน')
    setBusyFile(f.id)
    try {
      const blob = await getBinary(cfg, f.path)
      const x = await extractText(new File([blob], f.name, { type: f.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : blob.type }), (t) => setProg(t))
      store.put([{ ...m, files: m.files.map((y) => (y.id === f.id ? { ...y, text: x.text } : y)) }])
      flash(`${disp(f)}: ${x.note}`)
    } catch (e2) {
      flash(e2 instanceof Error ? e2.message : 'อ่านไฟล์ไม่สำเร็จ')
    }
    setProg('')
    setBusyFile('')
  }
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
        <p className="source-note">เมื่อเลือกไฟล์ ระบบดึงข้อความในไฟล์มาเก็บเป็นตัวอักษรไว้ให้ค้นหาได้ทันที · ไฟล์ละไม่เกิน {MAX_FILE_MB} MB · ไฟล์สแกนเป็นรูปจะอ่านจากภาพให้อัตโนมัติ (ช้ากว่าปกติ)</p>
        {draft.files.map((f) => (
          <div key={f.id} className="mt-file mt-file--new">
            <input className="us-input" type="text" value={disp(f)} maxLength={160} aria-label={`ชื่อไฟล์ที่แสดง ${f.name}`} onChange={(e) => setDraft({ ...draft, files: draft.files.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)) })} />
            <p><small>{sizeLabel(f.size)} · ไฟล์เดิม: {f.name}</small>
              <button type="button" className="mini" onClick={() => setDraft({ ...draft, files: draft.files.filter((x) => x.id !== f.id) })} aria-label={`เอา ${disp(f)} ออก`}>✕ เอาไฟล์ออก</button></p>
          </div>
        ))}
        {pending.map((p) => (
          <div key={p.key} className="mt-file mt-file--new">
            <input className="us-input" type="text" value={p.label} maxLength={160} aria-label={`ชื่อที่แสดงของ ${p.file.name}`} onChange={(e) => setPending(pending.map((x) => (x.key === p.key ? { ...x, label: e.target.value } : x)))} />
            <p>🆕 <span><small>{sizeLabel(p.file.size)} · ไฟล์เดิม: {p.file.name}</small></span>
              <button type="button" className="mini" onClick={() => setPending(pending.filter((x) => x.key !== p.key))} aria-label={`เอา ${p.file.name} ออก`}>✕</button></p>
            <small className={p.text ? 'mt-ok' : 'mt-warn'}>{p.note}</small>
            <details className="fold__sub"><summary>ดู/แก้ไขข้อความที่อ่านได้ (ใช้สำหรับค้นหา)</summary>
              <textarea className="us-input mt-edit__ta" rows={8} value={p.text} placeholder="ยังไม่มีข้อความ — พิมพ์เองได้" onChange={(e) => setPending(pending.map((x) => (x.key === p.key ? { ...x, text: e.target.value } : x)))} aria-label={`ข้อความของไฟล์ ${p.file.name}`} />
            </details>
            {p.text && <button type="button" className="mini" onClick={() => setDraft({ ...draft, notes: `${draft.notes.trim() ? `${draft.notes.trim()}\n\n` : ''}${p.text.slice(0, 4000)}` })}>➕ ใส่ข้อความนี้ลงในบันทึก</button>}
          </div>
        ))}
        {reading && prog && <p className="source-note" role="status">{prog}</p>}
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

      {shown.length > 0 && tts.supported && slot && createPortal(
        <div className="nb-fab" role="group" aria-label="ฟังมติที่ประชุมต่อเนื่อง">
          {active ? (
            <>
              {tts.speaking
                ? <button type="button" className="nb-fab__btn nb-fab__btn--stop" onClick={tts.pause} aria-label="หยุดชั่วคราว">⏸ หยุด</button>
                : <button type="button" className="nb-fab__btn" onClick={tts.resume} aria-label="ฟังต่อ">▶ ต่อ</button>}
              <button type="button" className="nb-fab__btn" disabled={curIdx <= 0} onClick={() => stepTo(-1)} aria-label="การประชุมก่อนหน้า">⏮</button>
              <button type="button" className="nb-fab__btn" disabled={curIdx < 0 || curIdx >= shown.length - 1} onClick={() => stepTo(1)} aria-label="การประชุมถัดไป">⏭</button>
              <button type="button" className="nb-fab__btn" onClick={tts.stop} aria-label="หยุดเลย">⏹</button>
            </>
          ) : (
            <button type="button" className="nb-fab__btn" onClick={() => playFrom(0)} aria-label="ฟังทั้งหมดต่อเนื่อง">▶ ฟังทั้งหมด</button>
          )}
        </div>, slot)}

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
          const matchRes = (r: Resolution) => searching && words.some((w) => norm(`${r.topic}\n${r.decision}`).includes(norm(w)))
          return (
            <li key={m.id} id={`mt-${m.id}`} className={`us-card${active && cur === m.id ? ' us-card--on' : ''}${isOpen ? '' : ' us-card--fold'}`}>
              {draft?.id === m.id && !isNew ? form : (
                <>
<div className="us-head">
                  <button type="button" className="qa-q" aria-expanded={isOpen} onClick={() => setOpen({ ...open, [m.id]: !open[m.id] })}>
                    <span className="qa-q__t">{m.title}</span>
                    <span className="badge">{thaiDate(m.date)}</span>
                    {m.files.length > 0 && <span aria-label={`${m.files.length} ไฟล์`}>📎{m.files.length}</span>}
                    <span className="qa-q__chev" aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
                  </button>
                    {tts.supported && (active && cur === m.id
                      ? <button type="button" className="us-play us-play--on" onClick={tts.stop} aria-label="หยุดอ่าน">⏹ หยุด</button>
                      : <button type="button" className="us-play" onClick={() => playFrom(shown.findIndex((x) => x.id === m.id))} aria-label={`ฟังต่อเนื่องตั้งแต่ ${m.title}`}>▶ ฟัง</button>)}
                  </div>
                  {isOpen && (
                    <>
                      {(m.no || m.docNo || m.keywords) && <p className="mt-meta">{m.no && <>ครั้งที่ {hi(m.no, words)} </>}{m.docNo && <>· เลขที่ {hi(m.docNo, words)} </>}{m.keywords && <>· 🏷 {hi(m.keywords, words)}</>}</p>}
                      {m.attendees && <p className="mt-meta">👥 {m.attendees}</p>}
                      {m.resolutions.length > 0 && (
                        <Sub key={`r${searching}`} title={`📋 มติที่ประชุม (${m.resolutions.length} ข้อ)`} open={m.resolutions.some(matchRes)}>
                          {m.resolutions.map((r, i) => (
                            <Sub key={`${r.id}${searching}`} item title={`${i + 1}. ${r.topic || r.decision.slice(0, 40)}`} open={matchRes(r)}>
                              {r.topic && r.decision && <p className="mt-dec">{hi(r.decision, words)}</p>}
                              {!r.topic && <p className="mt-dec">{hi(r.decision, words)}</p>}
                              {r.topic && !r.decision && <p className="source-note">ไม่มีรายละเอียด</p>}
                            </Sub>
                          ))}
                        </Sub>
                      )}
                      {m.notes && (
                        <Sub key={`n${searching}`} title="🗒 บันทึกเพิ่มเติม" open={searching && norm(m.notes).includes(norm(words.join('')))}>
                          <p className="us-card__body mt-text">{hi(m.notes, words)}</p>
                        </Sub>
                      )}
                      {m.files.map((f) => {
                        const sn = searching ? snippet(f.text, words) : ''
                        return (
                          <Sub key={`${f.id}${searching}`} title={`📄 ${disp(f)}`} open={!!sn}>
                            <div className="mt-file mt-file--card">
                              <small className="mt-meta">{sizeLabel(f.size)} · ไฟล์เดิม: {hi(f.name, words)}</small>
                                {!f.text && <p className="mt-warn">⚠️ ยังไม่มีข้อความของไฟล์นี้ ค้นหาจากเนื้อไฟล์ไม่เจอ{canEdit ? ' — กด “อ่านข้อความจากไฟล์”' : ''}</p>}
                                {busyFile === f.id && prog && <p className="source-note" role="status">{prog}</p>}
                                {sn && <p className="mt-snip">{hi(sn, words)}</p>}
                                <div className="duty__btns">
                                  {f.name.toLowerCase().endsWith('.pdf') && <button type="button" className="mini" disabled={busyFile === f.id} onClick={() => void openFile(f, false)}>👁 เปิดดู</button>}
                                  <button type="button" className="mini" disabled={busyFile === f.id} onClick={() => void openFile(f, true)}>{busyFile === f.id ? '⏳ กำลังโหลด…' : '⬇ ดาวน์โหลด'}</button>
                                  {canEdit && <button type="button" className="mini edit-only" disabled={busyFile === f.id} onClick={() => void rescan(m, f)}>{busyFile === f.id && prog ? '⏳' : '🔄'} {f.edited ? 'อ่านจากไฟล์ใหม่ (ทับที่แก้ไว้)' : f.text ? 'อ่านข้อความใหม่' : 'อ่านข้อความจากไฟล์'}</button>}
                                  {(f.text || canEdit) && <button type="button" className="mini" onClick={() => setOpen({ ...open, [`t${f.id}`]: !open[`t${f.id}`] })}>{open[`t${f.id}`] ? '▴ ซ่อนข้อความในไฟล์' : '▾ ข้อความในไฟล์'}</button>}
                                </div>
                                {open[`t${f.id}`] && (tx[f.id] === undefined ? (
                                  <>
                                    {f.text ? <p className="us-card__body mt-text">{hi(f.text, words)}</p> : <p className="source-note">ยังไม่มีข้อความ</p>}
                                    {canEdit && <button type="button" className="mini edit-only" onClick={() => setTx({ ...tx, [f.id]: f.text })}>✏️ แก้ไขข้อความ</button>}
                                  </>
                                ) : (
                                  <div className="mt-edit">
                                    <p className="source-note">ข้อความนี้ใช้สำหรับค้นหาเท่านั้น (ไฟล์ต้นฉบับไม่เปลี่ยน) · แก้ตัวอักษรที่ผิด ลบส่วนที่ไม่ต้องการ หรือเพิ่มคำสำคัญได้ตรงนี้</p>
                                    <textarea className="us-input mt-edit__ta" rows={12} value={tx[f.id]} onChange={(e) => setTx({ ...tx, [f.id]: e.target.value })} aria-label={`ข้อความของไฟล์ ${disp(f)}`} />
                                    <div className="duty__btns">
                                      <button type="button" className="btn btn--gold" disabled={tx[f.id] === f.text} onClick={() => { store.put([{ ...m, files: m.files.map((y) => (y.id === f.id ? { ...y, text: tx[f.id].slice(0, 120000), edited: true } : y)) }]); const n = { ...tx }; delete n[f.id]; setTx(n); flash('บันทึกข้อความของไฟล์แล้ว') }}>💾 บันทึกข้อความ</button>
                                      <button type="button" className="btn btn--ghost" onClick={() => { const n = { ...tx }; delete n[f.id]; setTx(n) }}>ยกเลิก</button>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </Sub>
                        )
                      })}
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
