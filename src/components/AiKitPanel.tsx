import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AiError, getAiProvider, type AiKit, type AiProvider } from '../lib/ai'
import FieldMode from './FieldMode'
import { Link } from 'react-router-dom'
import { findPersonByName, loadPeople, type PeopleDoc } from '../data/people'

type State =
  | { s: 'checking' }
  | { s: 'no-ai' }
  | { s: 'loading'; chars: number }
  | { s: 'done'; kit: AiKit }
  | { s: 'error'; kind: AiError['kind'] }

const ERROR_COPY: Record<AiError['kind'], string> = {
  unavailable: 'ยังใช้ผู้ช่วย AI ในหน้านี้ไม่ได้',
  declined: 'ยังไม่ได้อนุญาตให้ใช้ผู้ช่วย AI จึงแสดงคู่มือไม่ได้ในตอนนี้',
  busy: 'ผู้ช่วย AI ใช้งานมากเกินไปในขณะนี้ กรุณาลองใหม่อีกสักครู่',
  refused: 'ผู้ช่วย AI เตรียมคู่มือเรื่องนี้ไม่ได้ ลองพิมพ์อธิบายสถานการณ์ด้วยคำอื่น',
  failed: 'การเชื่อมต่อขัดข้อง กรุณาลองใหม่',
  cancelled: 'หยุดการเตรียมคู่มือแล้ว',
}

export default function AiKitPanel({ topic }: { topic: string }) {
  const [state, setState] = useState<State>({ s: 'checking' })
  const [field, setField] = useState(false)
  const [peopleDoc, setPeopleDoc] = useState<PeopleDoc | null>(null)
  useEffect(() => {
    loadPeople().then(setPeopleDoc).catch(() => {})
  }, [])
  const providerRef = useRef<AiProvider | null>(null)
  const ctlRef = useRef<AbortController | null>(null)

  const run = useCallback(async () => {
    const provider = providerRef.current
    if (!provider) return
    ctlRef.current?.abort()
    const ctl = new AbortController()
    ctlRef.current = ctl
    setState({ s: 'loading', chars: 0 })
    try {
      // ให้ AI เลือกบุคคลจากรายชื่อ 100 คนเป็นหลัก เพื่อกดต่อไปดูประวัติได้
      const people = await loadPeople().catch(() => null)
      const kit = await provider.generateKit(
        topic,
        {
          signal: ctl.signal,
          onProgress: (chars) => !ctl.signal.aborted && setState({ s: 'loading', chars }),
        },
        people ? people.people.map((x) => x.th) : undefined,
      )
      if (!ctl.signal.aborted) setState({ s: 'done', kit })
    } catch (e) {
      if (ctl.signal.aborted && ctlRef.current !== ctl) return // ถูกแทนที่ด้วยคำขอใหม่
      setState({ s: 'error', kind: e instanceof AiError ? e.kind : 'failed' })
    }
  }, [topic])

  useEffect(() => {
    let alive = true
    getAiProvider().then((p) => {
      if (!alive) return
      providerRef.current = p
      if (p) run()
      else setState({ s: 'no-ai' })
    })
    return () => {
      alive = false
      ctlRef.current?.abort()
    }
  }, [run])

  if (state.s === 'checking') return <p className="empty">กำลังเชื่อมต่อผู้ช่วย AI…</p>

  if (state.s === 'no-ai')
    return (
      <div className="card">
        <p><strong>ผู้ช่วย AI ใช้ได้เมื่อเปิดแอปผ่านลิงก์ของ Claude</strong></p>
        <p style={{ color: 'var(--ink-soft)' }}>
          หน้านี้เปิดจากไฟล์โดยตรง จึงยังเชื่อมต่อ AI ไม่ได้ กรุณาเปิดจากการ์ด “คู่มือผู้ปกครองคริสตจักร” ในแชต
        </p>
      </div>
    )

  if (state.s === 'loading')
    return (
      <div className="card ai-loading" role="status" aria-live="polite">
        <div className="ai-loading__row">
          <span className="spinner" aria-hidden="true" />
          <p><strong>{state.chars > 0 ? 'กำลังเขียนคู่มือ…' : 'กำลังเตรียมคู่มือ…'}</strong></p>
        </div>
        <p style={{ color: 'var(--ink-soft)' }}>
          ผู้ช่วย AI กำลังเตรียมคำเปิดสนทนา คำถาม ข้อพระคัมภีร์ และคำอธิษฐาน ใช้เวลาประมาณ 20–60 วินาที
        </p>
        <button type="button" className="btn btn--ghost" onClick={() => ctlRef.current?.abort()}>
          หยุด
        </button>
      </div>
    )

  if (state.s === 'error')
    return (
      <div className="card">
        <p>{ERROR_COPY[state.kind]}</p>
        {state.kind !== 'declined' && (
          <button type="button" className="btn" onClick={run}>ลองอีกครั้ง</button>
        )}
      </div>
    )

  const { kit } = state
  return (
    <>
      {kit.safety.level !== 'none' && kit.safety.note && (
        <div className={`safety safety--${kit.safety.level}`} role="alert">
          <strong>{kit.safety.level === 'urgent' ? '⚠️ ต้องดูแลความปลอดภัยก่อน' : 'ควรแนะนำผู้เชี่ยวชาญ'}</strong>
          <p>{kit.safety.note}</p>
        </div>
      )}

      <div className="ai-note">
        <span className="badge">🤖 ร่างโดย AI</span>
        <span>ยังไม่ผ่านการตรวจทานของผู้ปกครอง โปรดใช้วิจารณญาณ</span>
      </div>

      <div className="kit-actions">
        <button type="button" className="btn btn--gold" onClick={() => setField(true)}>
          เข้าโหมดเยี่ยม
        </button>
        <button type="button" className="btn btn--ghost" disabled title="เปิดใช้เมื่อมีระบบเข้าสู่ระบบ">
          บันทึกการเยี่ยม (เร็ว ๆ นี้)
        </button>
      </div>

      <KitSection n={1} title="เข้าใจสถานการณ์">
        <p>{kit.understanding}</p>
      </KitSection>

      <KitSection n={2} title="ควรเริ่มสนทนาอย่างไร">
        <ul className="quote-list">{kit.openers.map((t, i) => <li key={i}>{t}</li>)}</ul>
      </KitSection>

      <KitSection n={3} title="คำถามที่ควรถาม">
        <ul className="plain-list">{kit.questions.map((t, i) => <li key={i}>{t}</li>)}</ul>
      </KitSection>

      <KitSection n={4} title="สิ่งที่ไม่ควรพูด">
        <ul className="avoid-list">
          {kit.avoid_saying.map((a, i) => (
            <li key={i}>
              <span className="avoid-list__say">✕ {a.say}</span>
              {a.why && <span className="avoid-list__why">{a.why}</span>}
            </li>
          ))}
        </ul>
      </KitSection>

      <KitSection n={5} title="พระคำที่เกี่ยวข้อง">
        <ul className="ref-list">
          {kit.scripture_refs.map((r, i) => (
            <li key={i}>
              <span className="ref-list__ref">📖 {r.ref}</span>
              <span className="ref-list__theme">{r.theme}</span>
            </li>
          ))}
        </ul>
        <p className="source-note">
          แสดงเฉพาะข้ออ้างอิง กรุณาเปิดอ่านข้อความจากพระคริสตธรรมคัมภีร์ฉบับ 1971 และตรวจว่าตรงกับเนื้อหา
        </p>
      </KitSection>

      {kit.bible_characters.length > 0 && (
        <KitSection n={6} title="บุคคลในพระคัมภีร์ที่เกี่ยวข้อง">
          <ul className="plain-list">
            {kit.bible_characters.map((c, i) => {
              const p = peopleDoc ? findPersonByName(peopleDoc, c.name) : undefined
              return (
                <li key={i}>
                  {p ? <Link to={`/people/${p.id}`}><strong>{c.name}</strong> ›</Link> : <strong>{c.name}</strong>} — {c.connection}
                </li>
              )
            })}
          </ul>
        </KitSection>
      )}

      <KitSection n={7} title="คำอธิษฐาน">
        <Prayer label="คำอธิษฐานสั้น" text={kit.prayers.short} open />
        <Prayer label="คำอธิษฐานเต็ม" text={kit.prayers.full} />
        <Prayer label="ผู้ปกครองอธิษฐานเผื่อสมาชิก" text={kit.prayers.intercession} />
      </KitSection>

      <KitSection n={8} title="สิ่งที่ควรทำต่อ">
        <ul className="plain-list">{kit.next_steps.map((t, i) => <li key={i}>{t}</li>)}</ul>
      </KitSection>

      <button type="button" className="btn btn--ghost" onClick={run}>
        ขอให้ AI ร่างใหม่
      </button>

      {field && <FieldMode kit={kit} onClose={() => setField(false)} />}
    </>
  )
}

function KitSection({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="kit-section">
      <h2 className="kit-section__title">
        <span className="kit-section__n">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Prayer({ label, text, open }: { label: string; text: string; open?: boolean }) {
  if (!text) return null
  return (
    <details className="prayer" open={open}>
      <summary>🙏 {label}</summary>
      <p>{text}</p>
    </details>
  )
}
