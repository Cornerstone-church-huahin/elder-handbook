import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { parseRef } from '../data/bible'
import { scoreNote, usePrayerNotebook, type NotePrayer } from '../lib/prayerNotebook'
import { PrayerMode, VerseCard, useVerseTexts } from './Prayer'

type Draft = { title: string; category: string; ref: string; text: string }
const EMPTY: Draft = { title: '', category: '', ref: '', text: '' }

/** อธิษฐานเผื่อ — สมุดคำอธิษฐาน: ค้นหา · เปิดอ่าน · เพิ่ม · แก้ไข · ลบ (บันทึกในเครื่องนี้) */
export default function PrayerNotebookPage() {
  const [params, setParams] = useSearchParams()
  const { list, saved, add, update, remove, restoreDefaults } = usePrayerNotebook()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [open, setOpen] = useState<string | null>(params.get('open'))
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [big, setBig] = useState<NotePrayer | null>(null)
  const refs = useRef(new Map<string, HTMLElement>())

  const query = q.trim()
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
    if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }))
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
    setDraft({ title: p.title, category: p.category, ref: p.ref, text: p.text })
    setConfirmDel(null)
  }
  const cancel = () => {
    setEditing(null)
    setDraft(EMPTY)
  }
  const save = () => {
    const d = { title: draft.title.trim(), category: draft.category.trim(), ref: draft.ref.trim(), text: draft.text.trim() }
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
      <div className="page-head">
        <span className="page-icon" aria-hidden="true">🙏</span>
        <h1>อธิษฐานเผื่อ</h1>
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
          {query && <p className="source-note">พบ {shown.length} คำอธิษฐาน</p>}
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
              />
            ),
          )}
        </div>
      )}

      {list && !query && (
        <button type="button" className="btn btn--ghost nb-restore" onClick={() => restoreDefaults()}>↺ นำคำอธิษฐานตั้งต้นที่ลบไปกลับมา</button>
      )}
      <p className="source-note">บันทึกไว้ในเครื่องนี้ ใช้ได้แม้ไม่มีอินเทอร์เน็ต เมื่อมีระบบเข้าสู่ระบบแล้ว สมุดจะใช้ร่วมกันได้ทั้งสองเครื่อง</p>

      {big && <PrayerMode steps={paras(big.text).map((t, i, a) => ({ h: `${big.title} ${i + 1}/${a.length}`, t }))} onClose={() => setBig(null)} />}
    </>
  )
}

const paras = (t: string) => t.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean)

function NoteCard({
  p, open, flash, elRef, onToggle, onEdit, onBig, confirming, onAskDelete, onCancelDelete, onDelete,
}: {
  p: NotePrayer; open: boolean; flash: boolean; elRef: (el: HTMLElement | null) => void; onToggle: () => void; onEdit: () => void; onBig: () => void
  confirming: boolean; onAskDelete: () => void; onCancelDelete: () => void; onDelete: () => void
}) {
  const verses = useVerseTexts(open && p.ref ? [p.ref] : [])
  const [copied, setCopied] = useState('')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`🙏 ${p.title}\n\n${p.text}`)
      setCopied('คัดลอกแล้ว วางในแชต Line ได้เลย')
    } catch {
      setCopied('คัดลอกไม่ได้ กดค้างที่ข้อความเพื่อคัดลอกเอง')
    }
  }
  const preview = p.text.replace(/\s+/g, ' ').slice(0, 70)
  return (
    <article ref={elRef} className={`nb-card${open ? ' nb-card--open' : ''}${flash ? ' nb-card--flash' : ''}`}>
      <button type="button" className="nb-card__head" onClick={onToggle} aria-expanded={open}>
        <span className="nb-card__icon" aria-hidden="true">{p.icon}</span>
        <span className="nb-card__main">
          <span className="nb-card__title">{p.title}</span>
          {!open && <span className="nb-card__sub">{p.category ? `${p.category} · ` : ''}{preview}…</span>}
          {open && p.category && <span className="nb-card__sub">{p.category}</span>}
        </span>
        <span className="nb-card__chev" aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="nb-card__body">
          {p.ref && parseRef(p.ref) && <VerseCard label={p.ref} v={verses[p.ref]} />}
          <div className="nb-card__text">
            {paras(p.text).map((x, i) => <p key={i}>{x}</p>)}
          </div>
          <div className="nb-card__actions">
            <button type="button" className="btn btn--gold" onClick={onBig}>🔠 ตัวใหญ่</button>
            <button type="button" className="btn btn--ghost" onClick={copy}>📋 คัดลอก</button>
            <button type="button" className="btn btn--ghost" onClick={onEdit}>✏️ แก้ไข</button>
            <button type="button" className="btn btn--ghost" onClick={onAskDelete}>🗑️ ลบ</button>
          </div>
          {copied && <p className="source-note">{copied}</p>}
          {confirming && (
            <div className="duty__btns duty__btns--warn">
              <span>ลบคำอธิษฐานนี้?</span>
              <button type="button" className="btn btn--danger" onClick={onDelete}>ลบ</button>
              <button type="button" className="btn btn--ghost" onClick={onCancelDelete}>ไม่ลบ</button>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

function Editor({
  draft, setDraft, categories, onSave, onCancel, isNew = false,
}: { draft: Draft; setDraft: (d: Draft) => void; categories: string[]; onSave: () => void; onCancel: () => void; isNew?: boolean }) {
  const ta = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (isNew) ta.current?.focus()
  }, [isNew])
  const refOk = !draft.ref.trim() || !!parseRef(draft.ref)
  return (
    <form className="nb-editor" onSubmit={(e) => { e.preventDefault(); onSave() }}>
      <h2 className="nb-editor__h">{isNew ? '＋ คำอธิษฐานใหม่' : '✏️ แก้ไขคำอธิษฐาน'}</h2>
      <label>
        หัวข้อ
        <input id="nb-title" type="text" placeholder="เช่น อธิษฐานเผื่อผู้ป่วยก่อนผ่าตัด" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      </label>
      <div className="nb-editor__row">
        <label>
          หมวด
          <input id="nb-cat" type="text" list="nb-cats" placeholder="เช่น เจ็บป่วย" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
          <datalist id="nb-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
        <label>
          ข้อพระคำ (ถ้ามี)
          <input id="nb-ref" type="text" placeholder="เช่น ยอห์น 11:25" value={draft.ref} onChange={(e) => setDraft({ ...draft, ref: e.target.value })} />
        </label>
      </div>
      {!refOk && <p className="ai-keys__err">ไม่พบข้อพระคำนี้ ลองเขียนแบบ “ชื่อเล่ม บท:ข้อ” เช่น สดุดี 23:1</p>}
      <label className="nb-editor__text">
        คำอธิษฐาน
        <textarea id="nb-text" ref={ta} placeholder="พิมพ์หรือวางคำอธิษฐานที่นี่ เว้นบรรทัดว่างเพื่อแบ่งย่อหน้า" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
      </label>
      <div className="nb-editor__btns">
        <button type="submit" className="btn btn--gold" disabled={!draft.text.trim()}>💾 บันทึก</button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>ยกเลิก</button>
      </div>
    </form>
  )
}
