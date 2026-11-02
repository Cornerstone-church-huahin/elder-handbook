import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import BiblePicker, { type PickedPassage } from '../components/BiblePicker'
import BibleSearchPanel from '../components/BibleSearchPanel'
import ShareVerseSheet from '../components/ShareVerseSheet'
import ListenSettings, { PickBox, useListenPicks } from '../components/ListenSettings'
import NotebookCategoryBar, { ALL, NONE } from '../components/NotebookCategoryBar'
import { spaceOf } from '../lib/notebookSpaces'
import { useNotebookCategories, type NotebookApi, type NotePrayer } from '../lib/prayerNotebook'
import { speakableRef, useSpeech } from '../lib/speech'
import { openPronEditor, words } from '../components/Spoken'
import { parseRef } from '../data/bible'
import MdLite from '../components/MdLite'
import { speakMeaning } from '../lib/mdLite'
import SpiritField from '../components/SpiritField'
import VerseInterpret from '../components/VerseInterpret'

/** บรรทัดที่เก็บ → เลขข้อ + ข้อความ (รุ่นแรกเก็บเฉพาะข้อความ ใช้ notes เป็นเลขข้อแรก) */
const parseLines = (p: NotePrayer) => p.text.split('\n').map((l, i) => {
  const m = l.match(/^(\d+)\t([\s\S]*)$/)
  return m ? { n: +m[1], t: m[2] } : { n: (Number(p.notes) || 1) + i, t: l }
})
import { SyncLine } from './PrayerNotebook'

/**
 * ท่องจำคัมภีร์:
 *  1) ⚙️ สร้างหมวด (ไม่ต้องมีเนื้อหา) → ขึ้นเป็นการ์ดหมวดทันที · เลือกดูทีละหมวดจากช่องเลือกด้านบน
 *  2) แตะการ์ดหมวด → ใส่ข้อพระคัมภีร์ (ส่วนที่ 1: เลือกเล่ม/บท/ข้อ) → ข้อความจากฉบับ 1971 ขึ้นในส่วนที่ 2 เรียงตามข้อ → บันทึก
 *  3) ติ๊กข้อที่ต้องการแล้วกดฟัง → วนเล่นเฉพาะข้อที่ติ๊กไปเรื่อย ๆ (ไม่ติ๊ก = ทุกข้อในหมวด)
 * เก็บข้อพระคัมภีร์ 1 ข้อ/ช่วง = 1 รายการ (หัวข้อ = ข้ออ้างอิง · เนื้อหา = ข้อความแต่ละข้อขึ้นบรรทัดใหม่ · แต่ละบรรทัด = "เลขข้อ⇥ข้อความ" เลือกข้อติดกันหรือเว้นข้อได้ · ข้อมูลรุ่นแรกที่ไม่มีเลขข้อนับต่อจาก notes)
 */
export default function ScriptureMemorize({ nb, n }: { nb: NotebookApi; n: number }) {
  const cats = useNotebookCategories(n)
  const tts = useSpeech('th-TH')
  const picks = useListenPicks(`scripture${n}`)
  const [sel, setSel] = useState(ALL)
  const [openId, setOpenId] = useState<string | null>(null) // หมวดที่เปิดอยู่
  const [tab, setTab] = useState<'search' | 'cats' | 'three'>('cats') // แถบเล็กด้านบน: ค้นหาข้อพระคัมภีร์ · หมวด · 3
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  useEffect(() => setSlot(document.getElementById('topbar-slot')), [])
  useEffect(() => { tts.setLoop(true) }, []) // eslint-disable-line react-hooks/exhaustive-deps — ท่องจำ: วนซ้ำเป็นค่าตั้งต้น (ปิดได้)

  const list = nb.list ?? []
  const counts: Record<string, number> = {}
  for (const p of list) if (p.category) counts[p.category] = (counts[p.category] ?? 0) + 1
  const noneCount = list.filter((p) => !p.category).length
  const open = openId === NONE ? { id: NONE, name: '' } : cats.cats.find((c) => c.id === openId) ?? null

  const rename = (id: string, old: string, name: string) => {
    if (!cats.rename(id, name)) return false
    list.filter((p) => p.category === old).forEach((p) => nb.update(p.id, { category: name.trim() }))
    if (sel === old) setSel(name.trim())
    return true
  }
  const removeCat = (id: string, name: string) => {
    list.filter((p) => p.category === name).forEach((p) => nb.update(p.id, { category: '' }))
    cats.remove(id)
    if (sel === name) setSel(ALL)
    if (openId === id) setOpenId(null)
  }

  if (open) return <CategoryView nb={nb} cat={open.name} catNames={cats.cats.map((c) => c.name)} tts={tts} picks={picks} slot={slot} onBack={() => { tts.stop(); setOpenId(null) }} />

  const visible = cats.cats.filter((c) => sel === ALL || sel === c.name)
  return (
    <>
      {slot && createPortal(
        <div className="sm-tabs" role="tablist" aria-label="เมนูท่องจำคัมภีร์">
          <button type="button" role="tab" aria-selected={tab === 'search'} className={`sm-tab sm-tab--wide${tab === 'search' ? ' sm-tab--on' : ''}`} onClick={() => setTab('search')}>🔎 ค้นหาข้อพระคัมภีร์</button>
          <button type="button" role="tab" aria-selected={tab === 'cats'} className={`sm-tab${tab === 'cats' ? ' sm-tab--on' : ''}`} onClick={() => setTab('cats')}>📖 หมวด</button>
          <button type="button" role="tab" aria-selected={tab === 'three'} className={`sm-tab${tab === 'three' ? ' sm-tab--on' : ''}`} onClick={() => setTab('three')}>3</button>
        </div>, slot)}
      <div hidden={tab !== 'search'}>
        <BibleSearchPanel
          categories={cats.cats.map((c) => c.name)}
          onSave={(category, label, verses) => {
            if (list.some((p) => p.category === category && p.title === label)) return false
            nb.add({ title: label, category, refs: [], story: '', text: verses.map((v) => `${v.n}\t${v.text}`).join('\n'), notes: '' })
            return true
          }}
        />
      </div>
      {tab === 'three' && <p className="source-note sm-empty">แถบ 3 ยังว่างอยู่ — บอกได้ว่าอยากให้เป็นอะไร</p>}
      <div hidden={tab !== 'cats'}>
      <NotebookCategoryBar
        icon={spaceOf(n)?.icon ?? '📖'}
        cats={cats.cats}
        counts={counts}
        noneCount={noneCount}
        total={list.length}
        value={sel}
        onChange={setSel}
        onAdd={cats.add}
        onRename={(c, name) => rename(c.id, c.name, name)}
        onRemove={(c) => removeCat(c.id, c.name)}
      />
      <ul className="sm-cats">
        {visible.map((c) => (
          <li key={c.id}>
            <button type="button" className="sm-cat" onClick={() => setOpenId(c.id)} aria-label={`เปิดหมวด ${c.name}`}>
              <span className="sm-cat__icon" aria-hidden="true">📖</span>
              <span className="sm-cat__t"><b>{c.name}</b><small>{counts[c.name] ? `${counts[c.name]} ข้อ` : 'ยังไม่มีข้อ'}</small></span>
              <span aria-hidden="true">›</span>
            </button>
          </li>
        ))}
        {noneCount > 0 && sel === ALL && (
          <li>
            <button type="button" className="sm-cat" onClick={() => setOpenId(NONE)} aria-label="ข้อที่ไม่มีหมวด">
              <span className="sm-cat__icon" aria-hidden="true">🗂️</span>
              <span className="sm-cat__t"><b>ไม่มีหมวด</b><small>{noneCount} ข้อ</small></span>
            </button>
          </li>
        )}
      </ul>
      <SyncLine sync={nb.sync} onRetry={nb.syncNow} list={list} />
      </div>
    </>
  )
}

function CategoryView({ nb, cat, catNames, tts, picks, slot, onBack }: { nb: NotebookApi; cat: string; catNames: string[]; tts: ReturnType<typeof useSpeech>; picks: ReturnType<typeof useListenPicks>; slot: HTMLElement | null; onBack: () => void }) {
  const [passage, setPassage] = useState<PickedPassage | null>(null)
  const [spirit, setSpirit] = useState('') // ความหมายฝ่ายวิญญาณของข้อที่กำลังจะบันทึก
  const [spiritPlay, setSpiritPlay] = useState<string | null>(null) // การ์ดที่กำลังเล่นเฉพาะความหมายฝ่ายวิญญาณ (วนซ้ำจนกว่าจะกดหยุด)
  const [spiritEdit, setSpiritEdit] = useState<{ id: string; text: string } | null>(null) // แก้ความหมายบนการ์ดที่บันทึกแล้ว
  // ---- โครงหน้า: โซน 1 (ฟอร์มบันทึก) เป็นการ์ดเล็กที่คลายออกได้ · โซน 2 (ข้อที่บันทึกแล้ว) เป็นการ์ดย่อ/ขยายได้ ----
  const [addOpen, setAddOpen] = useState(() => (nb.list ?? []).filter((x) => x.category === cat).length === 0)
  const [allOpen, setAllOpen] = useState(() => { try { return localStorage.getItem('khatha.sm.cards') === 'open' } catch { return false } }) // ค่าตั้งต้นของการ์ด: ย่อ
  const [flip, setFlip] = useState<Set<string>>(new Set()) // การ์ดที่สลับสถานะต่างจากค่าตั้งต้น
  const isOpen = (id: string) => (allOpen ? !flip.has(id) : flip.has(id))
  const toggleCard = (id: string) => setFlip((f) => { const n = new Set(f); if (n.has(id)) n.delete(id); else n.add(id); return n })
  // ---- โหมดฟัง: เฉพาะข้อพระคัมภีร์ · ข้อพระคัมภีร์ + ความหมายฝ่ายวิญญาณ ----
  const [mode, setModeState] = useState<'verse' | 'both'>(() => { try { return localStorage.getItem('khatha.sm.mode.v1') === 'verse' ? 'verse' : 'both' } catch { return 'both' } })
  const setMode = (m: 'verse' | 'both') => { setModeState(m); try { localStorage.setItem('khatha.sm.mode.v1', m) } catch { /* ignore */ } }
  const [saveCat, setSaveCat] = useState(cat) // หมวดที่จะบันทึกเข้า (ตั้งต้น = หมวดที่เปิดอยู่)
  useEffect(() => setSaveCat(cat), [cat])
  const [manual, setManual] = useState('')
  // ---- ✍️ เขียนเอง: พิมพ์/วางข้ออ้างอิงและข้อความเอง (เช่น ตามพระคัมภีร์เล่มที่ใช้อยู่) ----
  const [custom, setCustom] = useState(false)
  const [cLabel, setCLabel] = useState('')
  const [cText, setCText] = useState('')
  const cLines = cText.split('\n').map((x) => x.trim()).filter(Boolean)
  const saveCustom = () => {
    const title = cLabel.trim()
    if (!title || !cLines.length) return
    const r = parseRef(title)
    const first = r?.verses[0] ?? 1
    const nums = r && r.verses.length === cLines.length ? r.verses : cLines.map((_, i) => first + i)
    nb.add({ title, category: saveCat, refs: [], story: '', cheer: spirit.trim(), text: cLines.map((t, i) => `${nums[i]}\t${t}`).join('\n'), notes: '' })
    setCLabel(''); setCText(''); setSpirit(''); setCustom(false)
    setNote(saveCat === cat ? '' : `✅ บันทึกแล้วในหมวด “${saveCat || 'ไม่มีหมวด'}”`)
  }
  const [delId, setDelId] = useState<string | null>(null)
  const [cur, setCur] = useState<string | null>(null)
  const [pickerKey, setPickerKey] = useState(0)
  const [sharing, setSharing] = useState<NotePrayer | null>(null)
  const [interp, setInterp] = useState<string | null>(null) // การ์ดที่เปิดแผงตีความอยู่
  // ---- แก้ไขการ์ด: เปลี่ยนข้อ/บท · แก้ข้อความแต่ละข้อ · ย้ายหมวด ----
  const [editId, setEditId] = useState<string | null>(null)
  const [editPassage, setEditPassage] = useState<PickedPassage | null>(null)
  const [edited, setEdited] = useState<Record<number, string>>({}) // ข้อความที่แก้เอง (เลขข้อ → ข้อความ)
  const [editCat, setEditCat] = useState('')
  const [note, setNote] = useState('')
  const startEdit = (p: NotePrayer) => {
    setEditId(p.id); setEditPassage(null); setEditCat(p.category); setNote('')
    setEdited(Object.fromEntries(parseLines(p).map((l) => [l.n, l.t])))
  }
  const editRows = (p: NotePrayer) => editPassage
    ? editPassage.verses.map((n, i) => ({ n, t: edited[n] ?? editPassage.lines[i] ?? '' }))
    : parseLines(p).map((l) => ({ n: l.n, t: edited[l.n] ?? l.t }))
  const saveEdit = (p: NotePrayer) => {
    const rows = editRows(p).filter((r) => r.t.trim())
    if (!rows.length) return
    nb.update(p.id, { title: editPassage?.label ?? p.title, category: editCat, text: rows.map((r) => `${r.n}\t${r.t.trim()}`).join('\n'), notes: '' })
    setNote(editCat !== p.category ? `ย้าย “${editPassage?.label ?? p.title}” ไปหมวด ${editCat || 'ไม่มีหมวด'} แล้ว` : `แก้ไข “${editPassage?.label ?? p.title}” แล้ว`)
    setEditId(null); setEditPassage(null)
  }
  const initialOf = (p: NotePrayer) => { const r = parseRef(p.title); return r && r.verses.length ? { book: r.book, ch: r.chapter, verses: r.verses } : undefined }
  const items = useMemo(() => (nb.list ?? []).filter((p) => p.category === cat).sort((a, b) => a.id.localeCompare(b.id)), [nb.list, cat])
  const active = tts.speaking || tts.paused

  const content = passage ? (passage.lines.length ? passage.lines : manual.split('\n').map((x) => x.trim()).filter(Boolean)) : []
  const save = () => {
    if (!passage || !content.length) return
    nb.add({ title: passage.label, category: saveCat, refs: [], story: '', cheer: spirit.trim(), text: (passage.lines.length ? passage.lines.map((t, i) => `${passage.verses[i]}\t${t}`) : content.map((t, i) => `${passage.verses[i] ?? passage.verses[0] + i}\t${t}`)).join('\n'), notes: '' })
    setPassage(null)
    setSpirit('')
    setManual('')
    setPickerKey(pickerKey + 1) // ล้างช่องเลือก เตรียมใส่ข้อถัดไป
    setNote(saveCat === cat ? '' : `✅ บันทึกแล้วในหมวด “${saveCat || 'ไม่มีหมวด'}”`)
  }

  // 🔁 ฟังวนซ้ำ: ข้ออ้างอิง → เนื้อข้อพระคัมภีร์ → ความหมายฝ่ายวิญญาณ → (วนกลับไปเริ่มที่ข้อพระคัมภีร์ใหม่) จนกว่าจะกดหยุด
  const playSpirit = (p: NotePrayer) => {
    const meaning = speakMeaning(p.cheer)
    if (!tts.supported || !meaning) return
    setCur(p.id); setSpiritPlay(p.id)
    tts.setLoop(true)
    tts.speakSections([
      { id: `${p.id}|r`, text: speakableRef(p.title) },
      { id: `${p.id}|t`, text: parseLines(p).map((l) => l.t).join(' ') },
      { id: `${p.id}|s`, text: meaning },
    ], (sid) => setCur(String(sid).split('|')[0]))
  }
  const pool = picks.count ? items.filter((x) => picks.has(x.id)) : items
  const sectionsOf = (x: NotePrayer) => {
    const meaning = mode === 'both' ? speakMeaning(x.cheer) : ''
    return [
      { id: `${x.id}|r`, text: speakableRef(x.title) },
      { id: `${x.id}|t`, text: parseLines(x).map((l) => l.t).join(' ') },
      ...(meaning ? [{ id: `${x.id}|s`, text: meaning }] : []),
    ]
  }
  const play = (xs: NotePrayer[]) => {
    if (!tts.supported || !xs.length) return
    setSpiritPlay(null)
    setCur(xs[0].id)
    tts.speakSections(xs.flatMap(sectionsOf), (sid) => setCur(String(sid).split('|')[0]))
  }
  const curIdx = pool.findIndex((x) => x.id === cur)
  const stepTo = (d: number) => { const i = curIdx < 0 ? 0 : curIdx + d; if (i >= 0 && i < pool.length) play(pool.slice(i)) }

  return (
    <>
      <div className="sm-head">
        <button type="button" className="btn btn--ghost" onClick={onBack} aria-label="กลับไปหมวดทั้งหมด">‹ หมวดทั้งหมด</button>
        <h1 className="sm-head__t">{cat ? `📖 ${cat}` : '🗂️ ไม่มีหมวด'}</h1>
      </div>

      {items.length > 0 && tts.supported && slot && createPortal(
        <div className="nb-fab" role="group" aria-label="ฟังข้อพระคัมภีร์">
          {active ? (
            <>
              {tts.speaking
                ? <button type="button" className="nb-fab__btn nb-fab__btn--stop" onClick={tts.pause} aria-label="หยุดชั่วคราว">⏸ หยุด</button>
                : <button type="button" className="nb-fab__btn" onClick={tts.resume} aria-label="ฟังต่อ">▶ ต่อ</button>}
              <button type="button" className="nb-fab__btn" disabled={curIdx <= 0} onClick={() => stepTo(-1)} aria-label="ข้อก่อนหน้า">⏮</button>
              <button type="button" className="nb-fab__btn" disabled={curIdx < 0 || curIdx >= pool.length - 1} onClick={() => stepTo(1)} aria-label="ข้อถัดไป">⏭</button>
              <button type="button" className="nb-fab__btn" onClick={tts.stop} aria-label="หยุดเลย">⏹</button>
            </>
          ) : (
            <button type="button" className="nb-fab__btn" disabled={!pool.length} onClick={() => play(pool)} aria-label="ฟังทั้งหมดต่อเนื่อง">{picks.count ? `▶ ฟังที่เลือก (${pool.length})` : '▶ ฟังทั้งหมด'}</button>
          )}
        </div>, slot)}

      {cat && <section className="card sm-add edit-only" aria-label="เพิ่มข้อพระคัมภีร์">
        <button type="button" className="sm-add__head" id="sm-add-toggle" aria-expanded={addOpen} onClick={() => setAddOpen(!addOpen)}>
          <b>➕ เพิ่มข้อพระคัมภีร์</b><span>{addOpen ? '▴ ย่อ' : '▾ คลายออกเพื่อบันทึก'}</span>
        </button>
        {addOpen && <div className="sm-add__body">
        <div className="sv-row">
          <button type="button" className={`btn ${custom ? 'btn--gold' : 'btn--ghost'}`} id="sm-custom-toggle" aria-pressed={custom} onClick={() => setCustom(!custom)}>✍️ เขียนเอง / วางข้อความเอง</button>
        </div>
        {custom ? (
          <div className="sm-custom">
            <p className="source-note">พิมพ์หรือวางข้อความเองได้ทุกข้อ (เช่น ตามพระคัมภีร์เล่มที่ใช้อยู่ หรือข้อความที่ไม่มีในฉบับ 1971) — แยกแต่ละข้อขึ้นบรรทัดใหม่</p>
            {passage?.lines.length ? <button type="button" className="btn btn--ghost" id="sm-custom-fill" onClick={() => { setCLabel(passage.label); setCText(passage.lines.join('\n')) }}>📋 ใช้ข้อที่เลือกไว้ด้านล่างเป็นต้นแบบ แล้วแก้ไขเอง</button> : null}
            <label>ข้ออ้างอิง / หัวข้อ
              <input id="sm-custom-label" type="text" value={cLabel} onChange={(e) => setCLabel(e.target.value)} placeholder="เช่น สดุดี 127:1" />
            </label>
            <label>ข้อความ
              <textarea id="sm-custom-text" rows={5} value={cText} onChange={(e) => setCText(e.target.value)} placeholder="พิมพ์หรือวางข้อความที่นี่ (หลายข้อ: บรรทัดละข้อ)" />
            </label>
            <SpiritField label={cLabel.trim()} lines={cLines.map((t, i) => ({ n: i + 1, t }))} value={spirit} onChange={setSpirit} idPrefix="spc" />
          <label className="sm-savecat">💾 บันทึกเข้าหมวด
          <select id="sm-savecat" aria-label="บันทึกเข้าหมวด" value={saveCat} onChange={(e) => setSaveCat(e.target.value)}>
            <option value="">ไม่มีหมวด</option>
            {[...catNames, ...(saveCat && !catNames.includes(saveCat) ? [saveCat] : [])].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
            <button type="button" className="btn btn--gold" id="sm-custom-save" disabled={!cLabel.trim() || !cLines.length} onClick={saveCustom}>💾 บันทึกข้อนี้</button>
          </div>
        ) : null}
        <BiblePicker key={pickerKey} onChange={setPassage} />
        <div className="sm-content" aria-live="polite">
          <p className="sm-content__h">เนื้อหา</p>
          {!passage ? <p className="source-note">เลือกเล่ม บท และแตะเลขข้อ เนื้อหาจะขึ้นที่นี่</p>
            : passage.lines.length ? (
              <ol className="sm-verses">
                {passage.lines.map((t, i) => <li key={i} value={passage.verses[i]}>{t}</li>)}
              </ol>
            ) : (
              <label className="sm-manual">
                <span className="source-note">โหลดข้อความจากพระคัมภีร์ไม่ได้ (อาจไม่มีอินเทอร์เน็ต) — พิมพ์ข้อความเอง แยกแต่ละข้อขึ้นบรรทัดใหม่</span>
                <textarea id="sm-manual" rows={4} value={manual} onChange={(e) => setManual(e.target.value)} />
              </label>
            )}
        </div>
        {!custom && <>
            <SpiritField label={passage?.label ?? ''} lines={(passage?.lines ?? []).map((t, i) => ({ n: passage!.verses[i], t }))} value={spirit} onChange={setSpirit} autoFill idPrefix="sp" />
          <label className="sm-savecat">💾 บันทึกเข้าหมวด
          <select id="sm-savecat" aria-label="บันทึกเข้าหมวด" value={saveCat} onChange={(e) => setSaveCat(e.target.value)}>
            <option value="">ไม่มีหมวด</option>
            {[...catNames, ...(saveCat && !catNames.includes(saveCat) ? [saveCat] : [])].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <button type="button" className="btn btn--gold" disabled={!passage || !content.length} onClick={save}>💾 บันทึกข้อนี้</button></>}
        </div>}
      </section>}

      {note && <p className="nb-sync nb-sync--ok" role="status">{note}</p>}
      {items.length === 0 && <p className="source-note sm-empty">{cat ? 'หมวดนี้ยังไม่มีข้อพระคัมภีร์' : 'ไม่มีข้อที่อยู่นอกหมวด'}</p>}
      {items.length > 0 && <div className="sm-bar" role="group" aria-label="ตัวเลือกการฟังและการแสดงผล">
        {tts.supported && <fieldset className="sm-mode"><legend>🔊 ฟังแบบ</legend>
          <label><input type="radio" name="sm-mode" id="sm-mode-verse" checked={mode === 'verse'} onChange={() => setMode('verse')} /> เฉพาะข้อพระคัมภีร์ของแต่ละการ์ด</label>
          <label><input type="radio" name="sm-mode" id="sm-mode-both" checked={mode === 'both'} onChange={() => setMode('both')} /> ข้อพระคัมภีร์ + ความหมายฝ่ายวิญญาณของแต่ละการ์ด (เรียง · วนซ้ำ)</label>
        </fieldset>}
        <div className="sv-row">
          <button type="button" className="mini" id="sm-expand-all" onClick={() => { setAllOpen(true); setFlip(new Set()) }}>▾ ขยายทั้งหมด</button>
          <button type="button" className="mini" id="sm-collapse-all" onClick={() => { setAllOpen(false); setFlip(new Set()) }}>▴ ย่อทั้งหมด</button>
        </div>
      </div>}
      <ul className="sm-list">
        {items.map((p) => {
          const on = active && cur === p.id
          const lines = parseLines(p)
          return (
            <li key={p.id} className={`sm-item${on ? ' sm-item--on' : ''}${editId === p.id ? ' sm-item--edit' : ''}`}>
              {editId === p.id ? (
                <div className="sm-edit">
                  <p className="sm-edit__h">✏️ แก้ไข {p.title}</p>
                  <BiblePicker initial={initialOf(p)} onChange={setEditPassage} />
                  <label className="sm-edit__cat">ย้ายไปหมวด
                    <select aria-label="ย้ายไปหมวด" value={editCat} onChange={(e) => setEditCat(e.target.value)}>
                      <option value="">ไม่มีหมวด</option>
                      {[...catNames, ...(editCat && !catNames.includes(editCat) ? [editCat] : [])].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <p className="sv-h">ข้อความแต่ละข้อ (แก้ได้)</p>
                  {editRows(p).map((r) => (
                    <label key={r.n} className="sm-edit__row"><b>ข้อ {r.n}</b>
                      <textarea aria-label={`ข้อความข้อ ${r.n}`} rows={3} value={r.t} onChange={(e) => setEdited({ ...edited, [r.n]: e.target.value })} />
                    </label>
                  ))}
                  <div className="sv-row">
                    <button type="button" className="btn btn--gold" id="sm-edit-save" onClick={() => saveEdit(p)}>💾 บันทึกการแก้ไข</button>
                    <button type="button" className="btn btn--ghost" onClick={() => setEdited({})}>↺ ใช้ข้อความ 1971 ตามต้นฉบับ</button>
                    <button type="button" className="btn btn--ghost" id="sm-edit-cancel" onClick={() => { setEditId(null); setEditPassage(null) }}>ยกเลิก</button>
                  </div>
                </div>
              ) : !isOpen(p.id) && interp !== p.id && spiritEdit?.id !== p.id ? (
                <>
                  {tts.supported && <PickBox picks={picks} id={p.id} label={p.title} />}
                  <button type="button" className="sm-item__toggle" aria-expanded={false} aria-label={`ขยาย ${p.title}`} onClick={() => toggleCard(p.id)}>
                    <span><b>📖 {p.title}</b>{p.cheer.trim() ? <small title="มีความหมายฝ่ายวิญญาณ"> 🕊️</small> : null}</span>
                    <span className="sm-item__prev">{lines.map((l) => l.t).join(' ')}</span>
                  </button>
                  {tts.supported && (on
                    ? <button type="button" className="us-play us-play--on" onClick={tts.stop} aria-label="หยุดอ่าน">⏹</button>
                    : <button type="button" className="us-play" onClick={() => play([p])} aria-label={`ฟัง ${p.title}`}>▶</button>)}
                  <button type="button" className="mini" aria-label={`ขยายการ์ด ${p.title}`} onClick={() => toggleCard(p.id)}>▾</button>
                </>
              ) : (
                <>
                  {tts.supported && <PickBox picks={picks} id={p.id} label={p.title} />}
                  <div className="sm-item__body">
                    <button type="button" className="sm-item__toggle sm-item__toggle--open" aria-expanded={true} aria-label={`ย่อ ${p.title}`} onClick={() => toggleCard(p.id)}><b>📖 {p.title}</b> <small>▴ ย่อ</small></button>
                    <p>{lines.map((l, i) => <span key={i}>{<sup>{l.n}</sup>}{l.t} </span>)}</p>
                  </div>
                  <div className="sm-item__btns">
                    {tts.supported && (on
                      ? <button type="button" className="us-play us-play--on" onClick={tts.stop} aria-label="หยุดอ่าน">⏹</button>
                      : <button type="button" className="us-play" onClick={() => play([p])} aria-label={`ฟัง ${p.title}`}>▶</button>)}
                    <button type="button" className="mini edit-only sm-editbtn" aria-label={`แก้ไข ${p.title}`} onClick={() => startEdit(p)}>✏️</button>
                    <button type="button" className="mini edit-only" aria-label={`แก้คำอ่าน ${p.title}`} title="แก้คำอ่าน (เสียงอ่านผิด) — มีผลทั้งแอป" onClick={() => { const t = `${speakableRef(p.title)}. ${lines.map((l) => l.t).join(' ')}`; const w = words(t).find((x) => x.segment.trim()); openPronEditor({ text: t, start: w?.index ?? 0, end: (w?.index ?? 0) + (w?.segment.length ?? 0), full: true }) }}>🔤</button>
                    <button type="button" className={`mini${interp === p.id ? ' mini--on' : ''}`} aria-label={`ตีความ ${p.title}`} aria-expanded={interp === p.id} title="ตีความข้อนี้" onClick={() => setInterp(interp === p.id ? null : p.id)}>💡</button>
                    <button type="button" className="mini" aria-label={`แชร์ ${p.title}`} onClick={() => setSharing(p)}>📤</button>
                    {delId === p.id
                      ? <span className="edit-only"><button type="button" className="btn btn--danger" onClick={() => { if (cur === p.id) tts.stop(); nb.remove(p.id); setDelId(null) }}>ลบ</button> <button type="button" className="btn btn--ghost" onClick={() => setDelId(null)}>ไม่ลบ</button></span>
                      : <button type="button" className="mini edit-only" aria-label={`ลบ ${p.title}`} onClick={() => setDelId(p.id)}>🗑️</button>}
                  </div>
                  {(p.cheer.trim() || spiritEdit?.id === p.id) && (
                    <div className="sm-spirit">
                      <p className="sm-spirit__h">🕊️ ความหมายฝ่ายวิญญาณ</p>
                      {spiritEdit?.id === p.id ? (
                        <>
                          <SpiritField label={p.title} lines={lines} value={spiritEdit.text} onChange={(v) => setSpiritEdit({ id: p.id, text: v })} idPrefix="spe" />
                          <div className="sv-row">
                            <button type="button" className="btn btn--gold" id="spe-save" onClick={() => { nb.update(p.id, { cheer: spiritEdit.text.trim() }); setSpiritEdit(null) }}>💾 บันทึกความหมาย</button>
                            <button type="button" className="btn btn--ghost" id="spe-cancel" onClick={() => setSpiritEdit(null)}>ยกเลิก</button>
                          </div>
                        </>
                      ) : (
                        <>
                          <MdLite className="sm-spirit__t" text={p.cheer} />
                          <div className="sv-row">
                            {tts.supported && (spiritPlay === p.id && active && cur === p.id
                              ? <button type="button" className="btn btn--gold" aria-label={`หยุดฟังความหมาย ${p.title}`} onClick={() => { tts.stop(); setSpiritPlay(null) }}>⏹ หยุด (กำลังเล่นวนซ้ำ)</button>
                              : <button type="button" className="btn btn--ghost" aria-label={`ฟังความหมายฝ่ายวิญญาณ ${p.title}`} title="อ่านข้อพระคัมภีร์ แล้วต่อด้วยความหมายฝ่ายวิญญาณ วนซ้ำจนกว่าจะกดหยุด" onClick={() => playSpirit(p)}>🔁 ฟังวนซ้ำ (ข้อ + ความหมาย)</button>)}
                          </div>
                          <div className="sv-row edit-only"><button type="button" className="mini" aria-label={`แก้ความหมายฝ่ายวิญญาณ ${p.title}`} onClick={() => setSpiritEdit({ id: p.id, text: p.cheer })}>✏️ แก้ความหมาย</button></div>
                        </>
                      )}
                    </div>
                  )}
                  {!p.cheer.trim() && spiritEdit?.id !== p.id && <button type="button" className="mini edit-only sm-spirit__add" aria-label={`เพิ่มความหมายฝ่ายวิญญาณ ${p.title}`} onClick={() => setSpiritEdit({ id: p.id, text: '' })}>➕ ความหมายฝ่ายวิญญาณ</button>}
                  {interp === p.id && <VerseInterpret title={p.title} lines={lines} story={p.story} canEdit onSave={(v) => nb.update(p.id, { story: v })} onClose={() => setInterp(null)} />}
                </>
              )}
            </li>
          )
        })}
      </ul>

      {items.length > 0 && tts.supported && <ListenSettings tts={tts} picks={picks} ids={items.map((x) => x.id)} />}
      {sharing && <ShareVerseSheet refLabel={sharing.title} lines={parseLines(sharing).map((l) => ({ n: l.n, t: l.t }))} onClose={() => setSharing(null)} />}
    </>
  )
}
