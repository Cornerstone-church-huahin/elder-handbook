import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { loadPeople, peopleForText, type PeopleDoc } from '../data/people'
import { search } from '../data/contentRepo'
import type { SearchResult } from '../data/types'
import { AiError, getAiProvider } from '../lib/ai'
import { generatePrayer, withName, type PrayerSet } from '../lib/prayerAi'
import SafetyNote from '../components/SafetyNote'

const EXAMPLES = [
  'คุณแม่ของพี่น้องป่วยหนัก อยู่ ICU',
  'ตกงาน มีหนี้ และเครียดมาก',
  'ลูกวัยรุ่นไม่ยอมไปโบสถ์',
  'สามีเพิ่งเสียชีวิต',
  'สามีภรรยาทะเลาะกันบ่อย',
  'กำลังจะผ่าตัดสัปดาห์หน้า',
]

type Opening = 'situation' | 'scripture' | 'person'
const OPENINGS: { id: Opening; label: string }[] = [
  { id: 'situation', label: '💬 สถานการณ์' },
  { id: 'scripture', label: '📖 พระคำ' },
  { id: 'person', label: '👤 บุคคล' },
]

const AI_ERR: Record<AiError['kind'], string> = {
  unavailable: 'ยังใช้ผู้ช่วย AI ในหน้านี้ไม่ได้',
  declined: 'ยังไม่ได้อนุญาตให้ใช้ผู้ช่วย AI',
  busy: 'ผู้ช่วย AI ใช้งานมากเกินไปในขณะนี้ กรุณาลองใหม่อีกสักครู่',
  refused: 'ผู้ช่วย AI เตรียมคำอธิษฐานเรื่องนี้ไม่ได้ ลองเล่าด้วยคำอื่น',
  failed: 'การเชื่อมต่อขัดข้อง กรุณาลองใหม่',
  cancelled: 'หยุดแล้ว',
}

type State = { s: 'idle' } | { s: 'loading'; chars: number } | { s: 'no-ai' } | { s: 'error'; kind: AiError['kind'] } | { s: 'done'; set: PrayerSet }

export default function PrayerPage() {
  const [params, setParams] = useSearchParams()
  const q = (params.get('q') ?? '').trim()
  const [text, setText] = useState(q)
  const [name, setName] = useState('') // เก็บในเครื่องเท่านั้น ไม่ส่งให้ AI
  const [state, setState] = useState<State>({ s: 'idle' })
  const [people, setPeople] = useState<PeopleDoc | null>(null)
  const ctl = useRef<AbortController | null>(null)

  useEffect(() => {
    loadPeople().then(setPeople).catch(() => {})
  }, [])

  const run = useCallback(
    async (request: string, fresh = false) => {
      if (!request) return
      const ai = await getAiProvider()
      if (!ai) return setState({ s: 'no-ai' })
      ctl.current?.abort()
      const c = new AbortController()
      ctl.current = c
      setState({ s: 'loading', chars: 0 })
      try {
        const pdoc = await loadPeople().catch(() => null)
        const hints = pdoc ? peopleForText(pdoc, request, 5) : []
        const set = await generatePrayer(ai, pdoc, request, hints, {
          signal: c.signal,
          cacheHours: fresh ? 0 : 24,
          onProgress: (chars) => !c.signal.aborted && setState({ s: 'loading', chars }),
        })
        if (!c.signal.aborted) setState({ s: 'done', set })
      } catch (e) {
        if (!c.signal.aborted) setState({ s: 'error', kind: e instanceof AiError ? e.kind : 'failed' })
      }
    },
    [],
  )

  // เปิดจากลิงก์ที่มีเรื่องอยู่แล้ว (เช่นจากหน้าคู่มืออภิบาล) ให้เริ่มทันที
  useEffect(() => {
    setText(q)
    if (q) run(q)
    return () => ctl.current?.abort()
  }, [q, run])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    if (t === q) run(t)
    else setParams({ q: t })
  }

  return (
    <>
      <div className="page-head">
        <span className="page-icon" aria-hidden="true">🙏</span>
        <h1>อธิษฐานเผื่อ</h1>
        <p>เล่าเรื่องที่พี่น้องเผชิญ แล้วรับคำอธิษฐานพร้อมพระคำและบุคคลในพระคัมภีร์</p>
      </div>

      <form className="prayer-form" onSubmit={submit}>
        <label htmlFor="prayer-q" className="section__title">พี่น้องกำลังเผชิญอะไร หรือขอให้อธิษฐานเผื่อเรื่องอะไร?</label>
        <textarea
          id="prayer-q"
          rows={3}
          placeholder="เช่น คุณแม่ของพี่น้องป่วยหนัก ครอบครัวกังวลมาก"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <label htmlFor="prayer-name" className="prayer-form__name">
          ชื่อพี่น้อง (ไม่ต้องใส่ก็ได้)
          <input id="prayer-name" type="text" placeholder="เช่น คุณสมศรี" value={name} onChange={(e) => setName(e.target.value)} />
          <small>ชื่อจะใส่ลงในคำอธิษฐานบนเครื่องนี้เท่านั้น ไม่ถูกส่งไปที่ AI</small>
        </label>
        <button type="submit" className="btn btn--gold prayer-form__go">🙏 สร้างคำอธิษฐาน</button>
      </form>

      {state.s === 'idle' && (
        <div className="search-hints">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="chip" onClick={() => setParams({ q: ex })}>{ex}</button>
          ))}
        </div>
      )}

      {state.s === 'loading' && (
        <div className="card ai-loading" role="status" aria-live="polite">
          <div className="ai-loading__row">
            <span className="spinner" aria-hidden="true" />
            <p><strong>{state.chars > 0 ? 'กำลังเขียนคำอธิษฐาน…' : 'กำลังเตรียมพระคำและบุคคลในพระคัมภีร์…'}</strong></p>
          </div>
          <p style={{ color: 'var(--ink-soft)' }}>ระหว่างรอ ลองนิ่งสงบและมอบเรื่องนี้ไว้กับพระเจ้าก่อนสักครู่</p>
          <button type="button" className="btn btn--ghost" onClick={() => ctl.current?.abort()}>หยุด</button>
        </div>
      )}
      {state.s === 'no-ai' && <p className="empty">ผู้ช่วย AI ใช้ได้เมื่อเปิดแอปผ่านลิงก์ของ Claude</p>}
      {state.s === 'error' && (
        <div className="card">
          <p>{AI_ERR[state.kind]}</p>
          {state.kind !== 'declined' && <button type="button" className="btn" onClick={() => run(q || text.trim())}>ลองอีกครั้ง</button>}
        </div>
      )}
      {state.s === 'done' && (
        <PrayerResult key={q} set={state.set} name={name} people={people} request={q || text} onRegenerate={() => run(q || text.trim(), true)} />
      )}

      <SafetyNote />
    </>
  )
}

function PrayerResult({
  set, name, people, request, onRegenerate,
}: { set: PrayerSet; name: string; people: PeopleDoc | null; request: string; onRegenerate: () => void }) {
  const [tab, setTab] = useState<'intercede' | 'self'>('intercede')
  const [opening, setOpening] = useState<Opening>(set.people.length ? 'person' : 'scripture')
  const [big, setBig] = useState(false)
  const [copied, setCopied] = useState<'' | 'ok' | 'manual'>('')
  const [kits, setKits] = useState<SearchResult[]>([])
  const n = (t: string) => withName(t, name)

  useEffect(() => {
    search(request).then((r) => setKits(r.slice(0, 3)))
  }, [request])

  const openingText = opening === 'situation' ? set.intercede.situation : opening === 'scripture' ? set.intercede.before_scripture : set.intercede.before_person
  const steps = tab === 'intercede'
    ? [
        { h: 'ก่อนอธิษฐาน', t: n(openingText) },
        { h: 'อธิษฐานเผื่อ', t: n(set.intercede.prayer) },
        { h: 'หลังอธิษฐาน', t: n(set.intercede.after) },
      ]
    : [
        { h: 'เตือนใจตนเอง', t: n(set.self.before) },
        { h: 'อธิษฐานเพื่อตนเอง', t: n(set.self.prayer) },
        { h: 'ภาวนาระหว่างวัน', t: n(set.self.breath) },
      ]

  const copyText = [
    `🙏 ${set.title}`,
    ...steps.filter((s) => s.t).map((s) => `${s.h}\n${s.t}`),
    set.scriptures.length ? `📖 ${set.scriptures.map((s) => s.ref).join(' · ')}` : '',
  ].filter(Boolean).join('\n\n')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyText)
      setCopied('ok')
    } catch {
      setCopied('manual')
    }
  }

  return (
    <>
      {set.safety.level !== 'none' && set.safety.note && (
        <div className={`safety safety--${set.safety.level}`} role="alert">
          <strong>{set.safety.level === 'urgent' ? '⚠️ ต้องดูแลความปลอดภัยก่อน' : 'ควรแนะนำผู้เชี่ยวชาญ'}</strong>
          <p>{set.safety.note}</p>
        </div>
      )}

      <section className="prayer-head">
        <p className="eyebrow">🤖 ร่างโดย AI · ใช้เป็นแนวทาง อธิษฐานด้วยถ้อยคำของท่านเองได้เสมอ</p>
        <h2>{set.title}</h2>
        {set.keys.length > 0 && (
          <div className="prayer-keys" aria-label="คำสำคัญช่วยจำ">
            <span className="prayer-keys__label">จำง่าย</span>
            {set.keys.map((k, i) => (
              <span key={i} className="prayer-key"><b>{i + 1}</b>{k}</span>
            ))}
          </div>
        )}
      </section>

      <div className="prayer-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'intercede'} onClick={() => setTab('intercede')}>🙏 เผื่อพี่น้อง</button>
        <button type="button" role="tab" aria-selected={tab === 'self'} onClick={() => setTab('self')}>🧎 เพื่อตนเอง</button>
      </div>

      {tab === 'intercede' ? (
        <div className="prayer-flow">
          <div className="prayer-step">
            <span className="prayer-step__no">1</span>
            <div className="prayer-step__body">
              <h3>ก่อนอธิษฐาน — เลือกเปิดด้วย</h3>
              <div className="seg" role="radiogroup" aria-label="เลือกสิ่งที่จะพูดก่อน">
                {OPENINGS.map((o) => (
                  <button key={o.id} type="button" role="radio" aria-checked={opening === o.id} onClick={() => setOpening(o.id)}>{o.label}</button>
                ))}
              </div>
              <p className="say">{n(openingText) || '—'}</p>
            </div>
          </div>
          <div className="prayer-step prayer-step--main">
            <span className="prayer-step__no">2</span>
            <div className="prayer-step__body">
              <h3>อธิษฐานเผื่อ</h3>
              <p className="prayer-text">{n(set.intercede.prayer)}</p>
            </div>
          </div>
          <div className="prayer-step">
            <span className="prayer-step__no">3</span>
            <div className="prayer-step__body">
              <h3>หลังอธิษฐาน</h3>
              <p className="say">{n(set.intercede.after)}</p>
            </div>
          </div>
          {set.intercede.breath && (
            <div className="breath"><span>ให้พี่น้องท่องจำระหว่างวัน</span><p>{n(set.intercede.breath)}</p></div>
          )}
        </div>
      ) : (
        <div className="prayer-flow">
          {set.self.before && (
            <div className="prayer-step">
              <span className="prayer-step__no">1</span>
              <div className="prayer-step__body"><h3>เตือนใจตนเอง</h3><p className="say">{set.self.before}</p></div>
            </div>
          )}
          <div className="prayer-step prayer-step--main">
            <span className="prayer-step__no">2</span>
            <div className="prayer-step__body"><h3>อธิษฐานเพื่อตนเอง</h3><p className="prayer-text">{set.self.prayer}</p></div>
          </div>
          {set.self.breath && (
            <div className="breath"><span>ภาวนาระหว่างวัน</span><p>{set.self.breath}</p></div>
          )}
        </div>
      )}

      <div className="prayer-actions">
        <button type="button" className="btn btn--gold" onClick={() => setBig(true)}>🔠 เปิดตัวอักษรใหญ่เพื่ออธิษฐาน</button>
        <button type="button" className="btn btn--ghost" onClick={copy}>📋 คัดลอกไปส่งทาง Line</button>
      </div>
      {copied === 'ok' && <p className="source-note">คัดลอกแล้ว วางในแชต Line ได้เลย</p>}
      {copied === 'manual' && (
        <textarea className="copy-fallback" readOnly value={copyText} rows={8} onFocus={(e) => e.currentTarget.select()} aria-label="ข้อความสำหรับคัดลอก" />
      )}

      {set.scriptures.length > 0 && (
        <section className="section">
          <h2 className="section__title">📖 พระคำที่ใช้</h2>
          <ul className="ref-list">
            {set.scriptures.map((s) => (
              <li key={s.ref}><span className="ref-list__ref">{s.ref}</span><span className="ref-list__theme">ใจความ: {s.gist}</span></li>
            ))}
          </ul>
          <p className="source-note">เปิดอ่านข้อความจริงจากพระคริสตธรรมคัมภีร์ฉบับ 1971 ก่อนใช้</p>
        </section>
      )}

      {set.people.length > 0 && people && (
        <section className="section">
          <h2 className="section__title">👤 เรื่องของบุคคลที่ใช้ประกอบ</h2>
          {set.people.map((p) => {
            const person = people.people.find((x) => x.id === p.id)!
            return (
              <article key={p.id} className="compare-card">
                <Link to={`/people/${p.id}`} className="compare-card__name">{person.th} ›</Link>
                <p>{n(p.story)}</p>
                {p.bridge && <p className="compare-card__lesson">🔗 {n(p.bridge)}</p>}
                <p className="source-note">📖 {person.refs.slice(0, 2).join(' · ')}</p>
              </article>
            )
          })}
        </section>
      )}

      {kits.length > 0 && (
        <section className="section">
          <h2 className="section__title">🤝 คู่มืออภิบาลที่เกี่ยวข้อง</h2>
          <div className="person-chips">
            {kits.map((k) => (
              <Link key={k.id} to={k.href} className="person-chip">
                <span className="person-chip__name">{k.icon} {k.title}</span>
                <span className="person-chip__role">คำเปิดสนทนา คำถาม และสิ่งที่ไม่ควรพูด</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {set.followup && <p className="lesson-card"><strong>📅 ติดตามต่อ</strong> {n(set.followup)}</p>}

      <button type="button" className="btn btn--ghost" onClick={onRegenerate}>🔄 ขอคำอธิษฐานแบบใหม่</button>

      {big && <PrayerMode title={set.title} steps={steps} keys={set.keys} onClose={() => setBig(false)} />}
    </>
  )
}

/** โหมดตัวอักษรใหญ่ ใช้ขณะอธิษฐานต่อหน้าพี่น้องหรือทางโทรศัพท์ */
function PrayerMode({ title, steps, keys, onClose }: { title: string; steps: { h: string; t: string }[]; keys: string[]; onClose: () => void }) {
  const list = steps.filter((s) => s.t)
  const [i, setI] = useState(0)
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {})
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      lock?.release().catch(() => {})
      document.body.style.overflow = prev
    }
  }, [])
  const s = list[i]
  return (
    <div className="fieldmode" role="dialog" aria-modal="true" aria-label="อธิษฐาน ตัวอักษรใหญ่">
      <div className="fieldmode__top">
        <div className="fieldmode__tabs" role="tablist">
          {list.map((x, k) => (
            <button key={x.h} type="button" role="tab" aria-selected={k === i} onClick={() => setI(k)}>{x.h}</button>
          ))}
        </div>
        <button type="button" className="fieldmode__close" onClick={onClose}>ปิด</button>
      </div>
      <div className="fieldmode__body">
        <h2>{title}{keys.length ? ` · ${keys.join(' → ')}` : ''}</h2>
        <p className="prayer-big">{s?.t}</p>
      </div>
      <div className="fieldmode__nav">
        <button type="button" disabled={i === 0} onClick={() => setI(i - 1)}>‹ ก่อนหน้า</button>
        {i < list.length - 1 ? (
          <button type="button" className="primary" onClick={() => setI(i + 1)}>ถัดไป ›</button>
        ) : (
          <button type="button" className="primary" onClick={onClose}>อาเมน</button>
        )}
      </div>
    </div>
  )
}
