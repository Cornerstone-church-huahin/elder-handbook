import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { parseRef, refUrl } from '../data/bible'
import { scoreNote, usePrayerNotebook, type NotePrayer } from '../lib/prayerNotebook'
import type { SyncStatus } from '../lib/sync'
import { speakableRef, useSpeech } from '../lib/speech'
import { PrayerMode, useVerseTexts } from './Prayer'

type Draft = { title: string; category: string; ref1: string; ref2: string; story: string; text: string; notes: string }
const EMPTY: Draft = { title: '', category: '', ref1: '', ref2: '', story: '', text: '', notes: '' }

/** เตรียมคำอธิษฐาน — สมุดคำอธิษฐาน: ค้นหา · เปิดอ่าน · เพิ่ม · แก้ไข · ลบ (บันทึกในเครื่องนี้) */
export default function PrayerNotebookPage() {
  const [params, setParams] = useSearchParams()
  const { list, saved, sync, syncNow, add, update, remove, restoreDefaults } = usePrayerNotebook()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [open, setOpen] = useState<string | null>(params.get('open'))
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [big, setBig] = useState<NotePrayer | null>(null)
  const refs = useRef(new Map<string, HTMLElement>())

  const query = q.trim()
  // โหมดอ่าน: กางการ์ดหรือกำลังเขียน → ซ่อนหัวข้อหน้าและเมนูล่าง ได้พื้นที่อ่านมากขึ้น
  const reading = !!open || !!editing
  useEffect(() => {
    document.body.classList.toggle('reading', reading)
    return () => document.body.classList.remove('reading')
  }, [reading])
  const shown = useMemo(() => {
    const all = list ?? []
    if (!query) return all
    return all
      .map((p) => ({ p, s: scoreNote(p, query) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.p)
  }, [list, query])

  // ค้นหา: การ์ดที่ตรงที่สุดขึ้นมาบนสุดและกางออก
  useEffect(() => {
    if (!query) return
    const top = shown[0]
    setOpen(top?.id ?? null)
  }, [query]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const id = flash ?? (query ? open : params.get('open'))
    if (!id) return
    const el = refs.current.get(id)
    if (!el) return
    // การ์ดแรกของรายการ: เลื่อนขึ้นบนสุด (เห็นหัวข้อหน้าและช่องค้นหาครบ) · การ์ดอื่น: เลื่อนให้การ์ดอยู่บนสุด
    const first = el.parentElement?.querySelector('.nb-card') === el
    requestAnimationFrame(() => (first ? window.scrollTo({ top: 0, behavior: 'smooth' }) : el.scrollIntoView({ behavior: 'smooth', block: 'start' })))
  }, [open, flash, list]) // eslint-disable-line react-hooks/exhaustive-deps

  const onSearch = (v: string) => {
    setQ(v)
    setConfirmDel(null)
    const next = new URLSearchParams(params)
    if (v.trim()) next.set('q', v)
    else next.delete('q')
    next.delete('open')
    setParams(next, { replace: true })
  }

  const startNew = () => {
    setEditing('new')
    setDraft({ ...EMPTY, title: query })
    setOpen(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const startEdit = (p: NotePrayer) => {
    setEditing(p.id)
    setDraft({ title: p.title, category: p.category, ref1: p.refs[0] ?? '', ref2: p.refs[1] ?? '', story: p.story, text: p.text, notes: p.notes })
    setConfirmDel(null)
  }
  const cancel = () => {
    setEditing(null)
    setDraft(EMPTY)
  }
  const save = () => {
    const d = {
      title: draft.title.trim(), category: draft.category.trim(), refs: [draft.ref1.trim(), draft.ref2.trim()].filter(Boolean),
      story: draft.story.trim(), text: draft.text.trim(), notes: draft.notes.trim(),
    }
    if (!d.text) return
    if (!d.title) d.title = d.text.split('\n')[0].slice(0, 40)
    let id: string
    if (editing === 'new') id = add(d)
    else {
      id = editing as string
      update(id, d)
    }
    setEditing(null)
    setDraft(EMPTY)
    setOpen(null) // บันทึกแล้วพับเก็บเป็นการ์ดเล็ก
    setFlash(id)
    setTimeout(() => setFlash(null), 1800)
  }

  const categories = Array.from(new Set((list ?? []).map((p) => p.category).filter(Boolean)))

  return (
    <>
      <div className="page-head nb-page-head">
        <span className="page-icon" aria-hidden="true">🙏</span>
        <h1>เตรียมคำอธิษฐาน</h1>
      </div>

      <div className="nb-bar">
        <label className="nb-search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          <input id="nb-q" type="search" placeholder="ค้นหาคำอธิษฐาน เช่น ถวาย อาหาร ป่วย" value={q} onChange={(e) => onSearch(e.target.value)} aria-label="ค้นหาคำอธิษฐาน" />
          {q && <button type="button" className="nb-search__clear" aria-label="ล้างคำค้น" onClick={() => onSearch('')}>✕</button>}
        </label>
        {editing !== 'new' && <button type="button" className="btn btn--gold nb-add" onClick={startNew}>＋ เพิ่ม</button>}
      </div>

      {!saved && <p className="empty">เครื่องนี้บันทึกข้อมูลไม่ได้ (อาจเปิดแบบส่วนตัว) สิ่งที่แก้ไขจะหายเมื่อปิดหน้า</p>}

      {editing === 'new' && (
        <Editor draft={draft} setDraft={setDraft} categories={categories} onSave={save} onCancel={cancel} isNew />
      )}

      {list === null ? (
        <p className="empty">กำลังเปิดสมุดคำอธิษฐาน…</p>
      ) : shown.length === 0 ? (
        <div className="card nb-empty">
          <p>{query ? `ยังไม่มีคำอธิษฐานเรื่อง “${query}”` : 'ยังไม่มีคำอธิษฐานในสมุด'}</p>
          {editing !== 'new' && <button type="button" className="btn btn--gold" onClick={startNew}>＋ เพิ่มคำอธิษฐาน{query ? 'เรื่องนี้' : ''}</button>}
        </div>
      ) : (
        <div className="nb-list">
          {shown.map((p) =>
            editing === p.id ? (
              <div key={p.id} ref={(el) => { if (el) refs.current.set(p.id, el) }}>
                <Editor draft={draft} setDraft={setDraft} categories={categories} onSave={save} onCancel={cancel} />
              </div>
            ) : (
              <NoteCard
                key={p.id}
                p={p}
                open={open === p.id}
                flash={flash === p.id}
                elRef={(el) => { if (el) refs.current.set(p.id, el) }}
                onToggle={() => { setOpen(open === p.id ? null : p.id); setConfirmDel(null) }}
                onEdit={() => startEdit(p)}
                onBig={() => setBig(p)}
                confirming={confirmDel === p.id}
                onAskDelete={() => setConfirmDel(p.id)}
                onCancelDelete={() => setConfirmDel(null)}
                onDelete={() => { remove(p.id); setConfirmDel(null); setOpen(null) }}
                onSaveNotes={(notes) => update(p.id, { notes })}
              />
            ),
          )}
        </div>
      )}

      <SyncLine sync={sync} onRetry={syncNow} list={list ?? []} />

      {list && !query && (
        <button type="button" className="btn btn--ghost nb-restore" onClick={() => restoreDefaults()}>↺ นำคำอธิษฐานตั้งต้นที่ลบไปกลับมา</button>
      )}

      {big && <PrayerMode steps={paras(big.text).map((t, i, a) => ({ h: `${big.title} ${i + 1}/${a.length}`, t }))} onClose={() => setBig(null)} />}
    </>
  )
}

const paras = (t: string) => t.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean)

type Tab = 'verses' | 'story' | 'prayer' | 'notes'
const TABS: { id: Tab; label: string }[] = [
  { id: 'verses', label: '📖 พระคำ' },
  { id: 'story', label: '👤 เรื่องราว' },
  { id: 'prayer', label: '🙏 อธิษฐาน' },
  { id: 'notes', label: '📝 บันทึก' },
]

/** เวลาแบบสั้น: วันนี้ → 06:16 น. · วันอื่น → 26 ก.ย. 16:16 น. */
function when(t: number) {
  const d = new Date(t)
  const hm = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  return d.toDateString() === new Date().toDateString() ? `${hm} น.` : `${d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} ${hm} น.`
}

function SyncLine({ sync, onRetry, list }: { sync: SyncStatus; onRetry: () => void; list: NotePrayer[] }) {
  // ใครแก้ไขล่าสุด (จากทุกเครื่องที่ใช้ร่วมกัน)
  const last = list.filter((x) => x.by && x.updated > 0).sort((a, b) => b.updated - a.updated)[0]
  if (sync.state === 'off')
    return <p className="nb-sync">📱 บันทึกในเครื่องนี้ · <Link to="/settings">ตั้งค่าใช้ร่วมกันออนไลน์ ›</Link></p>
  if (sync.state === 'error')
    return (
      <p className="nb-sync nb-sync--err">
        ⚠️ {sync.message} <button type="button" onClick={onRetry}>ลองอีกครั้ง</button>
      </p>
    )
  if (sync.state === 'ok')
    return (
      <p className="nb-sync nb-sync--ok">
        ☁️ ใช้ร่วมกันออนไลน์
        {last ? <> · แก้ไขล่าสุดโดย <b>{last.by}</b> {when(last.updated)} · “{last.title.slice(0, 24)}{last.title.length > 24 ? '…' : ''}”</> : <> · อัปเดตแล้ว {when(sync.at)}</>}
      </p>
    )
  return <p className="nb-sync">☁️ กำลังบันทึกออนไลน์…</p>
}

function NoteCard({
  p, open, flash, elRef, onToggle, onEdit, onBig, confirming, onAskDelete, onCancelDelete, onDelete, onSaveNotes,
}: {
  p: NotePrayer; open: boolean; flash: boolean; elRef: (el: HTMLElement | null) => void; onToggle: () => void; onEdit: () => void; onBig: () => void
  confirming: boolean; onAskDelete: () => void; onCancelDelete: () => void; onDelete: () => void; onSaveNotes: (notes: string) => void
}) {
  const [tab, setTab] = useState<Tab>('verses')
  const tabRef = useRef<Tab>('verses')
  tabRef.current = tab
  const refs = p.refs.filter((r) => parseRef(r))
  const verses = useVerseTexts(open ? refs : [])
  const [copied, setCopied] = useState('')
  const [notes, setNotes] = useState(p.notes)
  const [notesSaved, setNotesSaved] = useState(false)
  useEffect(() => setNotes(p.notes), [p.notes])
  const tts = useSpeech()
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => setSlot(document.getElementById('topbar-slot')), [])
  const { stop } = tts
  const autoTab = useRef(false)
  useEffect(() => {
    if (autoTab.current) return void (autoTab.current = false) // แท็บเปลี่ยนเพราะการฟังต่อเนื่อง → อ่านต่อ
    stop()
  }, [tab, open, stop]) // ผู้ใช้เปลี่ยนแท็บหรือพับการ์ด → หยุดอ่าน
  const versesText = () =>
    refs
        .map((r) => {
          const v = verses[r]
          const label = speakableRef(v?.ref?.label ?? r)
          return `${label}. ${v?.verses.map((x) => x.text).join(' ') ?? ''}`
        })
        .join('\n')
  const listenText = (): string => {
    if (tab === 'verses') return versesText()
    if (tab === 'story') return p.story
    if (tab === 'prayer') return p.text
    return notes
  }
  const listenAll = () => {
    const secs = [
      { id: 'verses', text: refs.length ? `พระคำ. ${versesText()}` : '' },
      { id: 'story', text: p.story ? `เรื่องราว. ${p.story}` : '' },
      { id: 'prayer', text: p.text ? `คำอธิษฐาน. ${p.text}` : '' },
    ].filter((x) => x.text)
    tts.speakSections(secs, (id) => {
      // เทียบกับแท็บที่แสดงอยู่ "ตอนนี้" (ไม่ใช่ตอนกดปุ่ม) — เดิมถ้าเริ่มจากแท็บอธิษฐาน เสียงจะหยุดก่อนถึงคำอธิษฐาน
      if (id !== tabRef.current) {
        autoTab.current = true
        tabRef.current = id as Tab
        setTab(id as Tab)
      }
    })
  }
  const copy = async () => {
    const vs = refs.map((r) => `📖 ${parseRef(r)?.label ?? r}`).join('\n')
    try {
      await navigator.clipboard.writeText(`🙏 ${p.title}\n\n${vs ? vs + '\n\n' : ''}${p.text}`)
      setCopied('คัดลอกแล้ว วางในแชต Line ได้เลย')
      setTimeout(() => { setCopied(''); setMenu(false) }, 1500)
    } catch {
      setCopied('คัดลอกไม่ได้ กดค้างที่ข้อความเพื่อคัดลอกเอง')
    }
  }
  const [menu, setMenu] = useState(false)
  // ความสูงเนื้อหาให้พอดีจอพอดี (ทุกขนาดตัวอักษร ทุกขนาดจอ): จอ − แถบบน − แถบค้นหา − หัวการ์ด
  const topRef = useRef<HTMLDivElement>(null)
  const [bodyH, setBodyH] = useState<number | undefined>(undefined)
  useLayoutEffect(() => {
    if (!open) return
    const fit = () => {
      const bar = (document.querySelector('.topbar') as HTMLElement | null)?.offsetHeight ?? 56
      const search = (document.querySelector('.nb-bar') as HTMLElement | null)?.offsetHeight ?? 50
      const head = topRef.current?.offsetHeight ?? 50
      setBodyH(Math.max(260, window.innerHeight - bar - search - head - 12 - 1.5 * parseFloat(getComputedStyle(document.documentElement).fontSize)))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [open, p.title])
  useEffect(() => { if (!open) setMenu(false) }, [open])
  const preview = p.text.replace(/\s+/g, ' ').slice(0, 70)
  return (
    <article ref={elRef} className={`nb-card${open ? ' nb-card--open' : ''}${flash ? ' nb-card--flash' : ''}`}>
      <div className="nb-card__top" ref={topRef}>
        <button type="button" className="nb-card__head" onClick={onToggle} aria-expanded={open}>
          <span className="nb-card__icon" aria-hidden="true">{p.icon}</span>
          <span className="nb-card__main">
            <span className="nb-card__title">{p.title}</span>
            {!open && <span className="nb-card__sub">{p.category ? `${p.category} · ` : ''}{preview}…</span>}
          </span>
          {!open && <span className="nb-card__chev" aria-hidden="true">▼</span>}
        </button>
        {open && (
          <button type="button" className="nb-card__more" aria-label="เมนู ตัวใหญ่ คัดลอก แก้ไข ลบ" aria-expanded={menu} onClick={() => { setMenu(!menu); onCancelDelete() }}>⋯</button>
        )}
        {open && menu && (
          <div className="nb-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => { setMenu(false); onBig() }}>🔠 ตัวอักษรใหญ่</button>
            <button type="button" role="menuitem" onClick={copy}>📋 คัดลอกไปส่ง Line</button>
            <button type="button" role="menuitem" onClick={() => { setMenu(false); onEdit() }}>✏️ แก้ไข</button>
            <button type="button" role="menuitem" className="nb-menu__danger" onClick={onAskDelete}>🗑️ ลบ</button>
            <button type="button" role="menuitem" onClick={() => { setMenu(false); onToggle() }}>▲ พับการ์ด</button>
            {copied && <p className="nb-menu__note">{copied}</p>}
            {confirming && (
              <div className="duty__btns duty__btns--warn">
                <span>ลบคำอธิษฐานนี้?</span>
                <button type="button" className="btn btn--danger" onClick={() => { setMenu(false); onDelete() }}>ลบ</button>
                <button type="button" className="btn btn--ghost" onClick={onCancelDelete}>ไม่ลบ</button>
              </div>
            )}
          </div>
        )}
      </div>
      {open && (
        <div className="nb-card__body" style={bodyH ? { height: bodyH } : undefined}>
          <div className="nb-tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>

          {tts.noVoice && (
            <p className="nb-none">
              มือถือเครื่องนี้ยังไม่มีเสียงภาษาไทย · Android: ตั้งค่า › การจัดการทั่วไป › การอ่านออกเสียง (Text-to-speech) › Google › ติดตั้งข้อมูลเสียง › ไทย · iPhone: ตั้งค่า › การช่วยการเข้าถึง › เนื้อหาที่ถูกพูด › เสียง › ไทย
            </p>
          )}

          <div className="nb-panel" role="tabpanel">
            {tab === 'verses' &&
              (refs.length ? (
                refs.map((r) => {
                  const v = verses[r]
                  const ref = v?.ref ?? parseRef(r)
                  return (
                    <a key={r} className="nb-verse" href={ref ? refUrl(ref) : undefined} target="_blank" rel="noreferrer">
                      <span className="nb-verse__ref">📖 {ref?.label ?? r} <small>ฉบับ 1971 ↗</small></span>
                      <span className="nb-verse__text">
                        {v === undefined ? 'กำลังเปิดพระคัมภีร์…' : v.verses.length ? v.verses.map((x) => x.text).join(' ') : 'แตะเพื่อเปิดอ่านข้อนี้'}
                      </span>
                    </a>
                  )
                })
              ) : (
                <p className="nb-none">ยังไม่ได้ใส่ข้อพระคำ · กด ✏️ แก้ไข เพื่อเพิ่มได้ 2 ข้อ</p>
              ))}
            {tab === 'story' && (p.story ? <div className="nb-prose">{paras(p.story).map((x, i) => <p key={i}>{x}</p>)}</div> : <p className="nb-none">ยังไม่มีเรื่องราว · กด ✏️ แก้ไข เพื่อเขียนเรื่องของบุคคลในพระคัมภีร์ที่เกี่ยวข้อง</p>)}
            {tab === 'prayer' && <div className="nb-card__text">{paras(p.text).map((x, i) => <p key={i}>{x}</p>)}</div>}
            {tab === 'notes' && (
              <div className="nb-notes">
                <textarea
                  id={`nb-notes-${p.id}`}
                  placeholder="บันทึกของท่าน เช่น ใช้เมื่อไร กับใคร คำตอบของคำอธิษฐาน"
                  value={notes}
                  onChange={(e) => { setNotes(e.target.value); setNotesSaved(false) }}
                />
                <button type="button" className="btn btn--gold" disabled={notes === p.notes} onClick={() => { onSaveNotes(notes.trim()); setNotesSaved(true) }}>💾 บันทึก</button>
                {notesSaved && notes === p.notes && <p className="source-note">บันทึกแล้ว</p>}
              </div>
            )}
            {p.updated > 0 && (
              <p className="nb-by">แก้ไขล่าสุด{p.by ? `โดย ${p.by}` : ''} · {new Date(p.updated).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })} {new Date(p.updated).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</p>
            )}
          </div>

          {tts.supported && slot && createPortal(
            <div className="nb-fab" role="group" aria-label="ฟังเสียงอ่าน">
              {tts.speaking ? (
                <button type="button" className="nb-fab__btn nb-fab__btn--stop" onClick={tts.pause} aria-label="หยุดชั่วคราว">⏸ หยุด</button>
              ) : tts.paused ? (
                <>
                  <button type="button" className="nb-fab__btn" onClick={tts.resume} aria-label="ฟังต่อ">▶ ฟังต่อ</button>
                  <button type="button" className="nb-fab__btn" onClick={tts.stop} aria-label="เริ่มใหม่">↺</button>
                </>
              ) : (
                <>
                  <button type="button" className="nb-fab__btn" disabled={!listenText().trim()} onClick={() => tts.speak(listenText())} aria-label="ฟังหน้านี้">🔊 หน้านี้</button>
                  <button type="button" className="nb-fab__btn" onClick={listenAll} aria-label="ฟังต่อเนื่อง พระคำ เรื่องราว อธิษฐาน">▶ ต่อเนื่อง</button>
                </>
              )}
            </div>,
            slot,
          )}

        </div>
      )}
    </article>
  )
}

function Editor({
  draft, setDraft, categories, onSave, onCancel, isNew = false,
}: { draft: Draft; setDraft: (d: Draft) => void; categories: string[]; onSave: () => void; onCancel: () => void; isNew?: boolean }) {
  const first = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (isNew) first.current?.focus()
  }, [isNew])
  const bad = [draft.ref1, draft.ref2].filter((r) => r.trim() && !parseRef(r))
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setDraft({ ...draft, [k]: e.target.value })
  return (
    <form className="nb-editor" onSubmit={(e) => { e.preventDefault(); onSave() }}>
      <h2 className="nb-editor__h">{isNew ? '＋ คำอธิษฐานใหม่' : '✏️ แก้ไขคำอธิษฐาน'}</h2>
      <label>
        หัวข้อ
        <input id="nb-title" ref={first} type="text" placeholder="เช่น อธิษฐานเผื่อผู้ป่วยก่อนผ่าตัด" value={draft.title} onChange={set('title')} />
      </label>
      <label>
        หมวด
        <input id="nb-cat" type="text" list="nb-cats" placeholder="เช่น เจ็บป่วย" value={draft.category} onChange={set('category')} />
        <datalist id="nb-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      </label>
      <div className="nb-editor__row">
        <label>
          📖 พระคำข้อที่ 1
          <input id="nb-ref1" type="text" placeholder="เช่น ยอห์น 11:25" value={draft.ref1} onChange={set('ref1')} />
        </label>
        <label>
          📖 พระคำข้อที่ 2
          <input id="nb-ref2" type="text" placeholder="เช่น สดุดี 34:18" value={draft.ref2} onChange={set('ref2')} />
        </label>
      </div>
      {bad.length > 0 && <p className="ai-keys__err">ไม่พบ “{bad.join('”, “')}” ลองเขียนแบบ “ชื่อเล่ม บท:ข้อ” เช่น สดุดี 23:1</p>}
      <label>
        👤 เรื่องราวบุคคลที่เกี่ยวข้อง
        <textarea id="nb-story" rows={4} placeholder="เช่น เฮเซคียาห์ป่วยหนัก ร้องไห้อธิษฐาน และพระเจ้าทรงได้ยิน… เชื่อมกับเรื่องของพี่น้องอย่างไร" value={draft.story} onChange={set('story')} />
      </label>
      <label className="nb-editor__text">
        🙏 คำอธิษฐาน
        <textarea id="nb-text" placeholder="พิมพ์หรือวางคำอธิษฐานที่นี่ เว้นบรรทัดว่างเพื่อแบ่งย่อหน้า" value={draft.text} onChange={set('text')} />
      </label>
      <label>
        📝 บันทึก (ไม่บังคับ)
        <textarea id="nb-notes" rows={2} placeholder="เช่น ใช้ในการนมัสการวันอาทิตย์" value={draft.notes} onChange={set('notes')} />
      </label>
      <div className="nb-editor__btns">
        <button type="submit" className="btn btn--gold" disabled={!draft.text.trim()}>💾 บันทึก</button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>ยกเลิก</button>
      </div>
    </form>
  )
}
