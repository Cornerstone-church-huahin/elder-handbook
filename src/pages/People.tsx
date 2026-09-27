import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { eraTitle, loadPeople, peopleForText, peopleForThemes, type PeopleDoc, type Person } from '../data/people'
import { AiError, getAiProvider } from '../lib/ai'
import { comparePeople, teachPerson, TEACH_MODES, type AiSection, type Comparison, type TeachMode } from '../lib/peopleAi'
import PeoplePicker from '../components/PeoplePicker'
import { loadPeopleContent, sectionsToText, textToSections, usePeopleEdits, type PersonContent } from '../data/peopleContent'
import { IconSearch } from '../components/Icons'
import { suggestPeople, useCustomThemes, type CustomTheme } from '../lib/customThemes'

export function usePeople() {
  const [doc, setDoc] = useState<PeopleDoc | null>(null)
  const [failed, setFailed] = useState(false)
  const load = useCallback(() => {
    setFailed(false)
    loadPeople().then(setDoc).catch(() => setFailed(true))
  }, [])
  useEffect(() => {
    load()
  }, [load])
  return { doc, failed, retry: load }
}

function Loading({ failed, retry }: { failed: boolean; retry: () => void }) {
  if (!failed) return <p className="empty">กำลังเปิดรายชื่อ…</p>
  return (
    <div className="card">
      <p>เปิดรายชื่อไม่สำเร็จ กรุณาตรวจการเชื่อมต่ออินเทอร์เน็ต</p>
      <button type="button" className="btn" onClick={retry}>ลองอีกครั้ง</button>
    </div>
  )
}

const AI_ERR: Record<AiError['kind'], string> = {
  unavailable: 'ยังไม่ได้ใส่คีย์ผู้ช่วย AI (ใส่ได้ที่ ตั้งค่า)',
  declined: 'ยังไม่ได้อนุญาตให้ใช้ผู้ช่วย AI',
  locked: 'ต้องใส่รหัสเข้าใช้ผู้ช่วย AI ก่อน ไปที่ ⚙️ ตั้งค่า › รหัสเข้าใช้ผู้ช่วย AI แล้วกลับมากดลองอีกครั้ง',
  busy: 'ผู้ช่วย AI ใช้งานมากเกินไปในขณะนี้ กรุณาลองใหม่อีกสักครู่',
  refused: 'ผู้ช่วย AI ตอบเรื่องนี้ไม่ได้ ลองใช้คำอื่น',
  failed: 'การเชื่อมต่อขัดข้อง กรุณาลองใหม่',
  cancelled: 'หยุดแล้ว',
}

/** ป้ายชื่อบุคคลแบบกดได้ ใช้ทั้งในหน้านี้ หน้า Kit และหน้าค้นหา */
export function PersonChip({ p }: { p: Person }) {
  return (
    <Link to={`/people/${p.id}`} className="person-chip">
      <span className="person-chip__name">{p.th}</span>
      <span className="person-chip__role">{p.role}</span>
    </Link>
  )
}

/** บุคคลที่เกี่ยวข้องกับข้อความหรือสถานการณ์ — แสดงได้ทันทีโดยไม่ต้องใช้ AI */
export function RelatedPeople({ text, situation, title = 'บุคคลในพระคัมภีร์ที่เกี่ยวข้อง' }: { text?: string; situation?: string; title?: string }) {
  const [doc, setDoc] = useState<PeopleDoc | null>(null)
  useEffect(() => {
    loadPeople().then(setDoc).catch(() => {})
  }, [])
  if (!doc) return null
  const list = situation
    ? peopleForThemes(doc, doc.situation_themes[situation] ?? [], 6)
    : peopleForText(doc, text ?? '', 6)
  if (!list.length) return null
  return (
    <section className="section">
      <h2 className="section__title">👥 {title}</h2>
      <div className="person-chips">{list.map((p) => <PersonChip key={p.id} p={p} />)}</div>
      {text && (
        <Link to={`/people/compare?q=${encodeURIComponent(text)}`} className="btn btn--ghost">
          🤖 ให้ AI เทียบสถานการณ์นี้กับบุคคลในพระคัมภีร์
        </Link>
      )}
    </section>
  )
}

// ---------- หน้ารายชื่อ ----------
export function PeopleHome() {
  const { doc, failed, retry } = usePeople()
  const [open, setOpen] = useState(false)
  const [params, setParams] = useSearchParams()
  const theme = params.get('theme') ?? ''
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const themes = useCustomThemes()
  const [pickTheme, setPickTheme] = useState(false)

  if (!doc) return <Loading failed={failed} retry={retry} />
  const custom = themes.list.find((c) => c.name === theme)
  const shown = custom ? doc.people.filter((x) => custom.people.includes(x.id)) : theme ? doc.people.filter((x) => x.themes.includes(theme)) : doc.people
  const builtIn = Object.values(doc.situation_themes).flat().filter((t, i, a) => a.indexOf(t) === i)

  const onCompare = (e: FormEvent) => {
    e.preventDefault()
    if (q.trim()) navigate(`/people/compare?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <>
      <div className="page-head">
        <span className="page-icon" aria-hidden="true">👥</span>
        <h1>บุคคลในพระคัมภีร์</h1>
        <p>100 บุคคลสำคัญ เรียงจากปฐมกาลถึงคริสตจักรยุคแรก</p>
      </div>

      <button type="button" className="btn btn--gold picker-open" onClick={() => setOpen(true)}>
        📜 เลือกดูรายชื่อทั้ง 100 คน
      </button>

      <section className="section">
        <label htmlFor="compare-q" className="section__title">เทียบกับสถานการณ์ที่พบ</label>
        <form className="search" onSubmit={onCompare}>
          <IconSearch />
          <input
            id="compare-q"
            type="search"
            enterKeyHint="search"
            placeholder="เช่น ลูกไม่ยอมไปโบสถ์"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="submit">เทียบ</button>
        </form>
      </section>

      <div className="theme-pick-row">
        <button type="button" className="theme-pick" onClick={() => setPickTheme(true)} aria-haspopup="dialog">
          <span>🏷 {theme ? theme : 'เลือกตามหัวข้อ'}</span>
          <span aria-hidden="true">▾</span>
        </button>
        {theme && <button type="button" className="theme-pick__clear" aria-label="ล้างหัวข้อ" onClick={() => setParams({})}>✕</button>}
      </div>
      {pickTheme && (
        <ThemeSheet
          doc={doc}
          builtIn={builtIn}
          custom={themes.list}
          current={theme}
          onPick={(t) => { setPickTheme(false); setParams(t ? { theme: t } : {}) }}
          onSave={(t) => { themes.save(t); setPickTheme(false); setParams({ theme: t.name.trim() }) }}
          onRemove={(id) => { if (themes.list.find((c) => c.id === id)?.name === theme) setParams({}); themes.remove(id) }}
          onClose={() => setPickTheme(false)}
        />
      )}

      <section className="section">
        <h2 className="section__title">{theme ? `หัวข้อ “${theme}” ${shown.length} คน` : 'รายชื่อตามลำดับเวลา'}</h2>
        {doc.testaments.map((t) => {
          const eras = doc.eras.filter((e) => e.testament === t.id && shown.some((x) => x.era === e.id))
          if (!eras.length) return null
          return (
            <details key={t.id} className={`acc acc--testament acc--${t.id}`} open={!!theme}>
              <summary className="acc__bar acc__bar--testament">
                <span className="acc__title">{t.title}</span>
                <small>{t.span} · {shown.filter((x) => eras.some((e) => e.id === x.era)).length} คน</small>
                <span className="acc__chev" aria-hidden="true">▾</span>
              </summary>
              <div className="acc__body">
                {eras.map((era) => {
                  const people = shown.filter((x) => x.era === era.id)
                  return (
                    <details key={era.id} className="acc acc--era" open={!!theme}>
                      <summary className="acc__bar acc__bar--era">
                        <span className="acc__title">{eraTitle(era)}</span>
                        <small>ลำดับ {people[0].order}{people.length > 1 ? `–${people[people.length - 1].order}` : ''} · {people.length} คน</small>
                        <span className="acc__chev" aria-hidden="true">▾</span>
                      </summary>
                      <ul className="results acc__list">
                        {people.map((p) => (
                          <li key={p.id}>
                            <Link to={`/people/${p.id}`} className="result">
                              <span className="art-no">{p.order}</span>
                              <span className="result__body">
                                <span className="result__title">{p.th}</span>
                                <span className="art-where">{p.role}</span>
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )
                })}
              </div>
            </details>
          )
        })}
      </section>

      {open && (
        <PeoplePicker
          doc={doc}
          onClose={() => setOpen(false)}
          onPick={(id) => {
            setOpen(false)
            navigate(`/people/${id}`)
          }}
        />
      )}
    </>
  )
}

// ---------- หน้ารายละเอียดบุคคล ----------
export function PersonPage() {
  const { id = '' } = useParams()
  const { doc, failed, retry } = usePeople()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  if (!doc) return <Loading failed={failed} retry={retry} />
  const p = doc.people.find((x) => x.id === id)
  if (!p) return <p className="empty">ไม่พบบุคคลนี้</p>
  const era = doc.eras.find((e) => e.id === p.era)
  const testament = doc.testaments.find((t) => t.id === era?.testament)
  const prev = doc.people.find((x) => x.order === p.order - 1)
  const next = doc.people.find((x) => x.order === p.order + 1)
  const similar = peopleForThemes(doc, p.themes, 7).filter((x) => x.id !== p.id).slice(0, 4)
  const situations = Object.entries(doc.situation_themes)
    .filter(([, ts]) => ts.some((t) => p.themes.includes(t)))
    .map(([slug]) => slug)

  return (
    <>
      <div className="person-head">
        <p className="timeline-tag">
          <span className={`timeline-tag__t timeline-tag__t--${era?.testament}`}>{testament?.title}</span>
          <span>{era ? eraTitle(era) : ''}</span>
        </p>
        <p className="eyebrow">ลำดับที่ {p.order} จาก 100</p>
        <h1>{p.th}</h1>
        <p className="person-head__en">{p.en}</p>
        <p className="person-head__role">{p.role}</p>
        <button type="button" className="btn btn--ghost" onClick={() => setOpen(true)}>📜 เลือกบุคคลอื่น</button>
      </div>

      <section className="lesson-card">
        <h2>🌟 บทเรียนหลัก</h2>
        <p>{p.lesson}</p>
      </section>

      <section className="section">
        <h2 className="section__title">📖 อ่านเรื่องราวได้ที่</h2>
        <ul className="ref-list">
          {p.refs.map((r) => <li key={r}><span className="ref-list__ref">{r}</span></li>)}
        </ul>
        <p className="source-note">เปิดอ่านจากพระคริสตธรรมคัมภีร์ฉบับ 1971</p>
      </section>

      <section className="section">
        <h2 className="section__title">หัวข้อที่เกี่ยวข้อง</h2>
        <div className="theme-chips">
          {p.themes.map((t) => (
            <Link key={t} to={`/people?theme=${encodeURIComponent(t)}`} className="chip">{t}</Link>
          ))}
        </div>
        {situations.length > 0 && (
          <p className="source-note">ใช้หนุนใจได้ในสถานการณ์: {situations.map((s, i) => (
            <span key={s}>{i > 0 && ', '}<Link to={`/kit/${s}`}>{SITUATION_LABEL[s] ?? s}</Link></span>
          ))}</p>
        )}
      </section>

      <section className="section">
        <h2 className="section__title">🎓 เนื้อหาสำหรับสอนและอภิบาล</h2>
        <p className="source-note">กดหัวข้อที่ต้องการ ผู้ช่วย AI จะเตรียมเนื้อหาให้ (ร่างโดย AI โปรดตรวจกับพระคัมภีร์)</p>
        <TeachPanel key={p.id} p={p} />
      </section>

      {similar.length > 0 && (
        <section className="section">
          <h2 className="section__title">👥 บุคคลที่มีประสบการณ์คล้ายกัน</h2>
          <div className="person-chips">{similar.map((x) => <PersonChip key={x.id} p={x} />)}</div>
        </section>
      )}

      <nav className="pager" aria-label="บุคคลก่อนหน้าและถัดไป">
        {prev ? <Link to={`/people/${prev.id}`} className="btn btn--ghost">‹ {prev.th}</Link> : <span />}
        <Link to="/people" className="btn btn--ghost">ทั้งหมด</Link>
        {next ? <Link to={`/people/${next.id}`} className="btn btn--ghost">{next.th} ›</Link> : <span />}
      </nav>

      {open && (
        <PeoplePicker
          doc={doc}
          onClose={() => setOpen(false)}
          onPick={(pid) => {
            setOpen(false)
            navigate(`/people/${pid}`)
          }}
        />
      )}
    </>
  )
}

const SITUATION_LABEL: Record<string, string> = {
  hospital: 'ผู้ป่วย',
  'before-surgery': 'ก่อนผ่าตัด',
  grief: 'สูญเสีย',
  anxiety: 'ความกังวล',
  family: 'ครอบครัว',
  conflict: 'ความขัดแย้ง',
  finance: 'การเงิน',
  injustice: 'ถูกเอาเปรียบ',
  'spiritual-dryness': 'หมดกำลังใจ',
  'new-beginning': 'เริ่มต้นใหม่',
}

function Sections({ sections, badge = '🤖 ร่างโดย AI · ตรวจกับพระคัมภีร์ก่อนใช้' }: { sections: AiSection[]; badge?: string }) {
  return (
    <div className="ai-explain">
      {badge && <header><span className="badge">{badge}</span></header>}
      {sections.map((s, i) => (
        <div key={i} className="ai-sec">
          {s.heading && <h3>{s.heading}</h3>}
          {s.text && <p>{s.text}</p>}
          {s.items.length > 0 && <ul>{s.items.map((it, k) => <li key={k}>{it}</li>)}</ul>}
        </div>
      ))}
    </div>
  )
}

/** เนื้อหาสอนและอภิบาล: มีเนื้อหาพร้อมทุกคน แก้ไขได้ (ใช้ร่วมกันออนไลน์) และให้ AI ช่วยเขียนใหม่ได้ถ้าใส่คีย์ไว้ */
function TeachPanel({ p }: { p: Person }) {
  const [mode, setMode] = useState<TeachMode>('story')
  const [base, setBase] = useState<PersonContent | null>(null)
  const edits = usePeopleEdits()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [ai, setAi] = useState<{ status: 'loading' } | { status: 'done'; sections: AiSection[] } | { status: 'error'; kind: AiError['kind'] } | { status: 'no-ai' } | null>(null)
  const ctl = useRef<AbortController | null>(null)
  useEffect(() => {
    loadPeopleContent().then((all) => setBase(all[p.id] ?? {}))
    return () => ctl.current?.abort()
  }, [p.id])
  useEffect(() => {
    setEditing(false)
    setAi(null)
    ctl.current?.abort()
  }, [mode])

  const key = `${p.id}:${mode}`
  const edit = edits.items.find((x) => x.id === key)
  const sections = edit?.sections ?? base?.[mode] ?? []
  const label = TEACH_MODES.find((m) => m.id === mode)!.label

  const startEdit = (from = sections) => {
    setDraft(sectionsToText(from))
    setEditing(true)
  }
  const save = () => {
    edits.put([{ id: key, sections: textToSections(draft), updated: 0 }])
    setEditing(false)
    setAi(null)
  }
  const runAi = async () => {
    const provider = await getAiProvider()
    if (!provider) return setAi({ status: 'no-ai' })
    ctl.current?.abort()
    const c = new AbortController()
    ctl.current = c
    setAi({ status: 'loading' })
    try {
      const s = await teachPerson(provider, p, mode, { signal: c.signal })
      if (!c.signal.aborted) setAi({ status: 'done', sections: s })
    } catch (e) {
      if (!c.signal.aborted) setAi({ status: 'error', kind: e instanceof AiError ? e.kind : 'failed' })
    }
  }

  return (
    <>
      <div className="teach-buttons">
        {TEACH_MODES.map((m) => (
          <button key={m.id} type="button" className="teach-btn" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
            <span aria-hidden="true">{m.icon}</span> {m.label}
          </button>
        ))}
      </div>

      {editing ? (
        <div className="teach-edit">
          <p className="source-note">พิมพ์ “## ” นำหน้าหัวข้อ · พิมพ์ “- ” นำหน้ารายการ · เว้นบรรทัดระหว่างหัวข้อ</p>
          <textarea id="teach-edit" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="teach-edit__btns">
            <button type="button" className="btn btn--gold" onClick={save} disabled={!draft.trim()}>💾 บันทึก</button>
            <button type="button" className="btn btn--ghost" onClick={() => setEditing(false)}>ยกเลิก</button>
          </div>
        </div>
      ) : base === null ? (
        <p className="empty">กำลังเปิดเนื้อหา…</p>
      ) : sections.length ? (
        <Sections sections={sections} badge={edit ? `✏️ แก้ไขโดย ${edit.by ?? 'ผู้ปกครอง'}` : ''} />
      ) : (
        <p className="empty">ยังไม่มีเนื้อหา{label} · กด ✏️ เพื่อเขียนเอง</p>
      )}

      {!editing && (
        <div className="teach-tools">
          <button type="button" className="mini" onClick={() => startEdit()}>✏️ แก้ไข / เพิ่มเติม</button>
          {edit && <button type="button" className="mini" onClick={() => edits.remove(key)}>↺ ใช้ฉบับเดิม</button>}
          <button type="button" className="mini" onClick={runAi}>✨ ให้ AI เขียนเพิ่ม</button>
        </div>
      )}

      {ai?.status === 'loading' && (
        <div className="card ai-loading" role="status">
          <div className="ai-loading__row"><span className="spinner" aria-hidden="true" /><p><strong>กำลังเตรียม{label}…</strong></p></div>
          <button type="button" className="btn btn--ghost" onClick={() => { ctl.current?.abort(); setAi(null) }}>หยุด</button>
        </div>
      )}
      {ai?.status === 'no-ai' && <p className="empty">ผู้ช่วย AI ใช้ได้เมื่อใส่คีย์ในหน้าตั้งค่า</p>}
      {ai?.status === 'error' && <p className="empty">{AI_ERR[ai.kind]}</p>}
      {ai?.status === 'done' && (
        <>
          <Sections sections={ai.sections} />
          <div className="teach-tools">
            <button type="button" className="mini" onClick={() => startEdit([...sections, ...ai.sections])}>➕ รวมเข้ากับเนื้อหาเดิม แล้วแก้ไข</button>
            <button type="button" className="mini" onClick={() => startEdit(ai.sections)}>✏️ ใช้ฉบับ AI แทน แล้วแก้ไข</button>
          </div>
        </>
      )}
    </>
  )
}

// ---------- เทียบสถานการณ์กับบุคคล ----------
export function PeopleCompare() {
  const [params] = useSearchParams()
  const q = (params.get('q') ?? '').trim()
  const { doc, failed, retry } = usePeople()
  const [state, setState] = useState<'loading' | 'no-ai' | { err: AiError['kind'] } | Comparison[]>('loading')
  const ctl = useRef<AbortController | null>(null)

  const run = useCallback(async () => {
    if (!doc || !q) return
    const ai = await getAiProvider()
    if (!ai) return setState('no-ai')
    ctl.current?.abort()
    const c = new AbortController()
    ctl.current = c
    setState('loading')
    try {
      const r = await comparePeople(ai, doc, q, peopleForText(doc, q, 6), { signal: c.signal })
      if (!c.signal.aborted) setState(r)
    } catch (e) {
      if (!c.signal.aborted) setState({ err: e instanceof AiError ? e.kind : 'failed' })
    }
  }, [doc, q])

  useEffect(() => {
    run()
    return () => ctl.current?.abort()
  }, [run])

  if (!doc) return <Loading failed={failed} retry={retry} />
  if (!q) return <p className="empty">ยังไม่ได้พิมพ์สถานการณ์</p>
  const quick = peopleForText(doc, q, 6)

  return (
    <>
      <div className="page-head">
        <span className="page-icon" aria-hidden="true">👥</span>
        <h1>{q}</h1>
        <p>บุคคลในพระคัมภีร์ที่เคยผ่านเรื่องคล้ายกัน</p>
      </div>

      {state === 'loading' && (
        <div className="card ai-loading" role="status">
          <div className="ai-loading__row"><span className="spinner" aria-hidden="true" /><p><strong>ผู้ช่วย AI กำลังเทียบกับ 100 บุคคล…</strong></p></div>
          <button type="button" className="btn btn--ghost" onClick={() => ctl.current?.abort()}>หยุด</button>
        </div>
      )}
      {state === 'no-ai' && <p className="empty">ผู้ช่วย AI ใช้ได้เมื่อใส่คีย์ในหน้าตั้งค่า — ด้านล่างคือบุคคลที่ระบบเลือกจากหัวข้อ</p>}
      {typeof state === 'object' && 'err' in state && (
        <div className="card">
          <p>{AI_ERR[state.err]}</p>
          {state.err !== 'declined' && <button type="button" className="btn" onClick={run}>ลองอีกครั้ง</button>}
        </div>
      )}
      {Array.isArray(state) && (
        <div className="compare-list">
          <span className="badge">🤖 ร่างโดย AI · เลือกจากรายชื่อ 100 คนเท่านั้น</span>
          {state.map((m) => {
            const p = doc.people.find((x) => x.id === m.id)!
            return (
              <article key={m.id} className="compare-card">
                <Link to={`/people/${p.id}`} className="compare-card__name">{p.th} ›</Link>
                <p>{m.why}</p>
                {m.lesson && <p className="compare-card__lesson">🌟 {m.lesson}</p>}
                {m.refs.length > 0 && <p className="source-note">📖 {m.refs.join(' · ')}</p>}
              </article>
            )
          })}
        </div>
      )}

      {(!Array.isArray(state)) && quick.length > 0 && (
        <section className="section">
          <h2 className="section__title">บุคคลที่ตรงกับหัวข้อ</h2>
          <div className="person-chips">{quick.map((p) => <PersonChip key={p.id} p={p} />)}</div>
        </section>
      )}
    </>
  )
}

/** เลือกหัวข้อ (ตั้งต้น + ที่สร้างเอง) และสร้างหัวข้อใหม่พร้อมเลือกบุคคล */
function ThemeSheet({
  doc, builtIn, custom, current, onPick, onSave, onRemove, onClose,
}: {
  doc: PeopleDoc; builtIn: string[]; custom: CustomTheme[]; current: string
  onPick: (t: string) => void; onSave: (t: { id?: string; name: string; people: string[] }) => void; onRemove: (id: string) => void; onClose: () => void
}) {
  const [mode, setMode] = useState<'pick' | 'new'>('pick')
  const [f, setF] = useState('')
  const [name, setName] = useState('')
  const [editId, setEditId] = useState<string | undefined>(undefined)
  const [sel, setSel] = useState<string[]>([])
  const [pf, setPf] = useState('')
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const match = (t: string) => !f.trim() || t.toLowerCase().includes(f.trim().toLowerCase())
  const startNew = (preset = '') => {
    setMode('new'); setEditId(undefined); setName(preset); setSel(preset ? suggestPeople(doc, preset) : []); setPf('')
  }
  const startEdit = (c: CustomTheme) => {
    setMode('new'); setEditId(c.id); setName(c.name); setSel(c.people); setPf('')
  }
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  const people = doc.people.filter((p) => !pf.trim() || [p.th, p.role].join(' ').includes(pf.trim()))
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="เลือกหัวข้อ" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <div className="sheet__title"><strong>{mode === 'pick' ? '🏷 เลือกหัวข้อ' : editId ? '✏️ แก้ไขหัวข้อ' : '＋ หัวข้อใหม่'}</strong></div>
          <button type="button" className="sheet__close" onClick={mode === 'pick' ? onClose : () => setMode('pick')}>{mode === 'pick' ? 'ปิด' : '‹ กลับ'}</button>
        </div>
        {mode === 'pick' ? (
          <>
            <input className="sheet__search" type="search" placeholder="ค้นหาหัวข้อ เช่น การรับใช้" value={f} onChange={(e) => setF(e.target.value)} />
            <div className="sheet__list">
              <button type="button" className="btn btn--gold" onClick={() => startNew(f.trim())}>＋ สร้างหัวข้อใหม่{f.trim() ? ` “${f.trim()}”` : ''}</button>
              {custom.filter((c) => match(c.name)).length > 0 && (
                <section>
                  <h3 className="theme-group">หัวข้อของฉัน</h3>
                  <ul className="theme-list">
                    {custom.filter((c) => match(c.name)).map((c) => (
                      <li key={c.id} className="theme-row">
                        <button type="button" className={`theme-item${current === c.name ? ' theme-item--on' : ''}`} onClick={() => onPick(c.name)}>{c.name} <small>{c.people.length} คน</small></button>
                        {confirmDel === c.id ? (
                          <>
                            <button type="button" className="mini mini--danger" onClick={() => { onRemove(c.id); setConfirmDel(null) }}>ลบ</button>
                            <button type="button" className="mini" onClick={() => setConfirmDel(null)}>ไม่</button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="mini" aria-label={`แก้ไข ${c.name}`} onClick={() => startEdit(c)}>✏️</button>
                            <button type="button" className="mini" aria-label={`ลบ ${c.name}`} onClick={() => setConfirmDel(c.id)}>🗑️</button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section>
                <h3 className="theme-group">หัวข้อตั้งต้น</h3>
                <ul className="theme-list theme-list--grid">
                  {builtIn.filter(match).map((t) => (
                    <li key={t}><button type="button" className={`theme-item${current === t ? ' theme-item--on' : ''}`} onClick={() => onPick(t)}>{t}</button></li>
                  ))}
                </ul>
              </section>
            </div>
          </>
        ) : (
          <form className="theme-new" onSubmit={(e) => { e.preventDefault(); if (name.trim() && sel.length) onSave({ id: editId, name, people: sel }) }}>
            <label className="ai-keys__label" htmlFor="theme-name">ชื่อหัวข้อ</label>
            <input id="theme-name" className="sheet__search" type="text" placeholder="เช่น การรับใช้" value={name} onChange={(e) => setName(e.target.value)} />
            <button type="button" className="mini" onClick={() => setSel([...new Set([...sel, ...suggestPeople(doc, name)])])} disabled={!name.trim()}>✨ เลือกบุคคลที่เกี่ยวข้องให้อัตโนมัติ</button>
            <input className="sheet__search" type="search" placeholder="ค้นหาชื่อบุคคล" value={pf} onChange={(e) => setPf(e.target.value)} />
            <p className="source-note">เลือกแล้ว {sel.length} คน · แตะเพื่อเลือกหรือเอาออก</p>
            <ul className="theme-people">
              {people.map((p) => (
                <li key={p.id}>
                  <label className={`theme-person${sel.includes(p.id) ? ' theme-person--on' : ''}`}>
                    <input type="checkbox" checked={sel.includes(p.id)} onChange={() => toggle(p.id)} />
                    <span><b>{p.th}</b> <small>{p.role}</small></span>
                  </label>
                </li>
              ))}
            </ul>
            <button type="submit" className="btn btn--gold" disabled={!name.trim() || !sel.length}>💾 บันทึกหัวข้อ</button>
          </form>
        )}
      </div>
    </div>
  )
}
