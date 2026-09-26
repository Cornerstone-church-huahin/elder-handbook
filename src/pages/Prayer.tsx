import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { loadPeople, peopleForText, type PeopleDoc } from '../data/people'
import { getVerses, parseRef, refUrl, type VerseRef, type VerseText } from '../data/bible'
import { search } from '../data/contentRepo'
import type { SearchResult } from '../data/types'
import { AiError, getAiProvider } from '../lib/ai'
import { buildLocalPrayer } from '../lib/prayerLocal'
import { generatePrayer, withName, type PrayerSet } from '../lib/prayerAi'
import SafetyNote from '../components/SafetyNote'
import { loadSavedPrayers, matchSavedPrayers, type SavedPrayersDoc } from '../data/savedPrayers'


type Opening = 'situation' | 'scripture' | 'person'
const OPENINGS: { id: Opening; label: string }[] = [
  { id: 'situation', label: '💬 สถานการณ์' },
  { id: 'scripture', label: '📖 พระคำ' },
  { id: 'person', label: '👤 บุคคล' },
]

const AI_ERR: Record<AiError['kind'], string> = {
  unavailable: 'ยังไม่ได้ใส่คีย์ผู้ช่วย AI (ใส่ได้ที่ ตั้งค่า)',
  declined: 'ยังไม่ได้อนุญาตให้ใช้ผู้ช่วย AI',
  locked: 'ต้องใส่รหัสเข้าใช้ผู้ช่วย AI ก่อน ไปที่ ⚙️ ตั้งค่า › รหัสเข้าใช้ผู้ช่วย AI แล้วกลับมากดลองอีกครั้ง',
  busy: 'ผู้ช่วย AI ใช้งานมากเกินไปในขณะนี้ กรุณาลองใหม่อีกสักครู่',
  refused: 'ผู้ช่วย AI เตรียมคำอธิษฐานเรื่องนี้ไม่ได้ ลองเล่าด้วยคำอื่น',
  failed: 'การเชื่อมต่อขัดข้อง กรุณาลองใหม่',
  cancelled: 'หยุดแล้ว',
}

type State = { s: 'idle' } | { s: 'loading'; chars: number } | { s: 'error'; kind: AiError['kind'] } | { s: 'done'; set: PrayerSet; local?: boolean; why?: string }

export default function PrayerPage() {
  const [params, setParams] = useSearchParams()
  const q = (params.get('q') ?? '').trim()
  const [text, setText] = useState(q)
  const name = '' // ไม่มีช่องชื่อแล้ว (ตามที่ผู้ใช้ขอ) คำอธิษฐานใช้คำว่า "พี่น้อง"
  const [state, setState] = useState<State>({ s: 'idle' })
  const [people, setPeople] = useState<PeopleDoc | null>(null)
  const ctl = useRef<AbortController | null>(null)
  const [saved, setSaved] = useState<SavedPrayersDoc | null>(null)
  useEffect(() => {
    loadSavedPrayers().then(setSaved).catch(() => {})
  }, [])
  const savedHits = saved && q ? matchSavedPrayers(saved, q) : []

  useEffect(() => {
    loadPeople().then(setPeople).catch(() => {})
  }, [])

  const run = useCallback(
    async (request: string, fresh = false) => {
      if (!request) return
      ctl.current?.abort()
      const pdoc = await loadPeople().catch(() => null)
      const local = (why?: string) => setState({ s: 'done', set: buildLocalPrayer(request, pdoc), local: true, why })
      const ai = await getAiProvider()
      if (!ai) return local() // ไม่มี AI → สร้างจากข้อมูลในแอปทันที ไม่เด้งกลับ
      const c = new AbortController()
      ctl.current = c
      setState({ s: 'loading', chars: 0 })
      try {
        const hints = pdoc ? peopleForText(pdoc, request, 5) : []
        const set = await generatePrayer(ai, pdoc, request, hints, {
          signal: c.signal,
          cacheHours: fresh ? 0 : 24,
          onProgress: (chars) => !c.signal.aborted && setState({ s: 'loading', chars }),
        })
        if (!c.signal.aborted) setState({ s: 'done', set })
      } catch (e) {
        if (c.signal.aborted) return
        const kind = e instanceof AiError ? e.kind : 'failed'
        if (kind === 'cancelled') return setState({ s: 'idle' })
        local(AI_ERR[kind]) // AI ขัดข้อง → ใช้คำอธิษฐานจากข้อมูลในแอปแทน
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
        <button type="submit" className="btn btn--gold prayer-form__go">🙏 สร้างคำอธิษฐาน</button>
      </form>

      {savedHits.length > 0 && state.s !== 'idle' && <SavedList title="📜 คำอธิษฐานที่บันทึกไว้สำหรับเรื่องนี้" doc={saved!} items={savedHits} />}


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
      {state.s === 'error' && (
        <div className="card">
          <p>{AI_ERR[state.kind]}</p>
          {state.kind !== 'declined' && <button type="button" className="btn" onClick={() => run(q || text.trim())}>ลองอีกครั้ง</button>}
        </div>
      )}
      {state.s === 'done' && (
        <PrayerResult key={q} set={state.set} name={name} people={people} request={q || text} onRegenerate={() => run(q || text.trim(), true)} />
      )}

      {state.s === 'idle' && saved && <SavedList title="📜 คำอธิษฐานที่บันทึกไว้" doc={saved} items={saved.prayers} grouped />}

      <SafetyNote />
    </>
  )
}

/** รายการคำอธิษฐานที่บันทึกไว้ — แตะเพื่อเปิดอ่านเต็ม (ใช้ได้ออฟไลน์) */
function SavedList({ title, doc, items, grouped = false }: { title: string; doc: SavedPrayersDoc; items: SavedPrayersDoc['prayers']; grouped?: boolean }) {
  const cats = grouped ? doc.categories.filter((c) => items.some((p) => p.category === c.id)) : [null]
  return (
    <section className="section saved-list">
      <h2 className="section__title">{title}</h2>
      {cats.map((c) => (
        <div key={c?.id ?? 'all'} className="saved-list__group">
          {c && <h3 className="saved-list__cat">{c.icon} {c.title}</h3>}
          {items
            .filter((p) => !c || p.category === c.id)
            .map((p) => (
              <Link key={p.id} to={`/prayer/saved/${p.id}`} className="result">
                <span className="result__icon" aria-hidden="true">{doc.categories.find((x) => x.id === p.category)?.icon ?? '🙏'}</span>
                <span className="result__body">
                  <span className="result__title">{p.title}</span>
                  <span className="art-where">{p.subtitle} · {p.use}</span>
                </span>
              </Link>
            ))}
        </div>
      ))}
    </section>
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

  const verses = useVerseTexts(set.scriptures.map((x) => x.ref))
  const anchor = set.scriptures[0]
  const anchorV = anchor ? verses[anchor.ref] : undefined
  const pp = set.people.find((x) => x.id === anchor?.person) ?? set.people[0]
  const person = pp && people ? people.people.find((x) => x.id === pp.id) : undefined
  const personRef = set.scriptures.find((x) => x.person === pp?.id)?.ref ?? person?.refs[0] ?? ''
  const explain = n(set.intercede.before_scripture)
  const compare = n(set.intercede.before_person || pp?.bridge || '')
  const who = name.trim() || 'พี่น้อง'

  const verseLine = (ref: string) => {
    const v = verses[ref]
    const label = v?.ref?.label ?? ref
    return v?.verses.length ? `${label} (ฉบับ 1971)\n${v.verses.map((x) => x.text).join(' ')}` : `${label} (ฉบับ 1971)`
  }
  const openingText =
    opening === 'situation'
      ? n(set.intercede.situation)
      : opening === 'scripture'
        ? [anchor ? verseLine(anchor.ref) : '', explain].filter(Boolean).join('\n\n')
        : [person ? `${person.th}: ${n(pp.story)}` : '', compare].filter(Boolean).join('\n\n')
  const steps = tab === 'intercede'
    ? [
        { h: 'ก่อนอธิษฐาน', t: openingText },
        { h: 'อธิษฐานเผื่อ', t: n(set.intercede.prayer) },
        { h: 'หลังอธิษฐาน', t: n(set.intercede.after) },
      ]
    : [
        { h: 'เตือนใจตนเอง', t: [anchor ? verseLine(anchor.ref) : '', set.self.before].filter(Boolean).join('\n\n') },
        { h: 'อธิษฐานเพื่อตนเอง', t: n(set.self.prayer) },
        { h: 'ภาวนาระหว่างวัน', t: n(set.self.breath) },
      ]

  const copyText = [
    tab === 'intercede' ? '🙏 อธิษฐานเผื่อพี่น้อง' : '🧎 อธิษฐานเพื่อตนเอง',
    ...steps.filter((s) => s.t).map((s) => `${s.h}\n${s.t}`),
  ].join('\n\n')

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
              {opening === 'situation' && <p className="say">{n(set.intercede.situation) || '—'}</p>}
              {opening === 'scripture' && (anchor ? <VerseCard label={anchor.ref} v={anchorV} explain={explain} /> : <p className="say">{explain || '—'}</p>)}
              {opening === 'person' && (
                <div className="person-open">
                  {person && (
                    <p className="person-open__head">
                      <Link to={`/people/${person.id}`}>👤 {person.th} ›</Link>
                      {personRef && <span>{parseRef(personRef)?.label ?? personRef}</span>}
                    </p>
                  )}
                  {pp?.story && <p className="person-open__story">{n(pp.story)}</p>}
                  {compare && (
                    <>
                      <h4 className="verse-card__h">เชื่อมกับเรื่องของ{who}</h4>
                      <p className="say">{compare}</p>
                    </>
                  )}
                  {!person && !compare && <p className="say">—</p>}
                </div>
              )}
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
              <div className="prayer-step__body">
                <h3>เตือนใจตนเอง</h3>
                {anchor && <VerseCard label={anchor.ref} v={anchorV} />}
                <p className="say">{set.self.before}</p>
              </div>
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

      {set.scriptures.length > 1 && (
        <section className="section">
          <h2 className="section__title">📖 พระคำเพิ่มเติม</h2>
          {set.scriptures.slice(1).map((x) => (
            <VerseCard key={x.ref} label={x.ref} v={verses[x.ref]} gist={x.gist} />
          ))}
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

      {big && <PrayerMode steps={steps} onClose={() => setBig(false)} />}
    </>
  )
}

/** โหมดตัวอักษรใหญ่ ใช้ขณะอธิษฐานต่อหน้าพี่น้องหรือทางโทรศัพท์ */
export function PrayerMode({ steps, onClose }: { steps: { h: string; t: string }[]; onClose: () => void }) {
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
        <h2>{s?.h}</h2>
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

export type VerseState = { ref: VerseRef | null; verses: VerseText[] }

/** ดึงข้อความพระคัมภีร์จริง (ฉบับ 1971) ของทุกข้ออ้างอิงในชุดคำอธิษฐาน */
export function useVerseTexts(refs: string[]): Record<string, VerseState | undefined> {
  const [map, setMap] = useState<Record<string, VerseState>>({})
  const key = refs.join('|')
  useEffect(() => {
    let alive = true
    Promise.all(
      refs.map(async (r) => {
        const ref = parseRef(r)
        return [r, { ref, verses: ref ? await getVerses(ref) : [] }] as const
      }),
    ).then((all) => alive && setMap(Object.fromEntries(all)))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return map
}

/** การ์ดพระคำ: ข้ออ้างอิง + ข้อความจริงจากฉบับ 1971 (ไม่ใช่ข้อความที่ AI เขียน) + คำอธิบาย */
export function VerseCard({ label, v, explain, gist }: { label: string; v?: VerseState; explain?: string; gist?: string }) {
  const ref = v?.ref ?? null
  return (
    <div className="verse-card">
      <p className="verse-card__ref">
        <span>📖 {ref?.label ?? label}</span>
        <small>ฉบับ 1971</small>
      </p>
      {v === undefined ? (
        <p className="verse-card__text verse-card__text--wait">กำลังเปิดพระคัมภีร์…</p>
      ) : v.verses.length ? (
        <blockquote className="verse-card__text">
          {v.verses.map((x) => (
            <span key={x.n}>
              {v.verses.length > 1 && <sup>{x.n}</sup>}
              {x.text}{' '}
            </span>
          ))}
        </blockquote>
      ) : null}
      {gist && <p className="verse-card__gist">{gist}</p>}
      {ref && (
        <a className="verse-card__link" href={refUrl(ref)} target="_blank" rel="noreferrer">
          อ่านทั้งตอน ›
        </a>
      )}
      {explain && (
        <>
          <h4 className="verse-card__h">ความหมายสำหรับเรื่องนี้</h4>
          <p className="say">{explain}</p>
        </>
      )}
    </div>
  )
}
