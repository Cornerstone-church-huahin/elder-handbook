import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { loadCharter, searchCharter, type CharterArticle, type CharterDoc } from '../data/charter'
import { loadManagement, matchTopics, type MgmtDoc, type MgmtNote, type MgmtTopic } from '../data/management'
import { AiError, getAiProvider } from '../lib/ai'
import { askManagement, type MgmtAnswer } from '../lib/managementAi'
import { IconSearch } from '../components/Icons'
import { OfficialText } from './Charter'

function useDocs() {
  const [docs, setDocs] = useState<{ m: MgmtDoc; c: CharterDoc } | null>(null)
  const [failed, setFailed] = useState(false)
  const load = useCallback(() => {
    setFailed(false)
    Promise.all([loadManagement(), loadCharter()])
      .then(([m, c]) => setDocs({ m, c }))
      .catch(() => setFailed(true))
  }, [])
  useEffect(() => {
    load()
  }, [load])
  return { docs, failed, retry: load }
}

function Loading({ failed, retry }: { failed: boolean; retry: () => void }) {
  if (!failed) return <p className="empty">กำลังเปิดหมวดการบริหาร…</p>
  return (
    <div className="card">
      <p>เปิดข้อมูลไม่สำเร็จ กรุณาตรวจการเชื่อมต่ออินเทอร์เน็ต</p>
      <button type="button" className="btn" onClick={retry}>ลองอีกครั้ง</button>
    </div>
  )
}

function SourceKey({ m }: { m: MgmtDoc }) {
  return (
    <div className="source-key">
      <div><span className="src src--bylaws">📜 ทางการ</span> {m.sources.bylaws.title} {m.sources.bylaws.version}</div>
      <div><span className="src src--lesson">🎓 บทเรียน</span> {m.sources.lesson.title} · {m.sources.lesson.org} · {m.sources.lesson.date} ({m.sources.lesson.kind})</div>
      <div><span className="src src--note">🔎 เทียบ / ✅ นำไปใช้</span> สรุปโดยผู้จัดทำแอป จากสองแหล่งข้างต้น</div>
    </div>
  )
}

// ---------- หน้าหลัก ----------
export function ManagementHome() {
  const { docs, failed, retry } = useDocs()
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  if (!docs) return <Loading failed={failed} retry={retry} />
  const { m } = docs
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (q.trim()) navigate(`/manage/ask?q=${encodeURIComponent(q.trim())}`)
  }
  return (
    <>
      <div className="page-head">
        <span className="page-icon" aria-hidden="true">🏛️</span>
        <h1>การบริหารจัดการคริสตจักร</h1>
        <p>ประมวลจากบทเรียนการบริหารคริสตจักร ร่วมกับระเบียบปฏิบัติของธรรมนูญคริสตจักรภาค 7</p>
      </div>

      <section className="section">
        <label htmlFor="manage-q" className="section__title">ถามเรื่องการบริหาร</label>
        <form className="search" onSubmit={submit}>
          <IconSearch />
          <input
            id="manage-q"
            type="search"
            enterKeyHint="search"
            placeholder="เช่น เลือกตั้งผู้ปกครองทำอย่างไร"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="submit">ถาม</button>
        </form>
        <div className="search-hints">
          {['ต้องแจ้งประชุมสัปปุรุษล่วงหน้ากี่วัน', 'เหรัญญิกมีหน้าที่อะไร', 'สมาชิกไม่มาโบสถ์นานต้องทำอย่างไร'].map((ex) => (
            <button key={ex} type="button" className="chip" onClick={() => navigate(`/manage/ask?q=${encodeURIComponent(ex)}`)}>{ex}</button>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">หัวข้อ {m.topics.length} เรื่อง</h2>
        <ul className="topic-grid">
          {m.topics.map((t, i) => (
            <li key={t.id}>
              <Link to={`/manage/${t.id}`} className="topic-card">
                <span className="topic-card__top">
                  <span className="topic-card__icon" aria-hidden="true">{t.icon}</span>
                  <span className="topic-card__no">{i + 1}</span>
                </span>
                <span className="topic-card__title">{t.title}</span>
                <span className="topic-card__sum">{t.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <SourceKey m={m} />
      <Link to="/constitution" className="btn btn--ghost">📜 เปิดระเบียบปฏิบัติฯ ทั้งฉบับ</Link>
    </>
  )
}

// ---------- ผังโครงสร้าง ----------
function OrgChart() {
  return (
    <figure className="org" aria-label="ผังโครงสร้างการบริหารคริสตจักรท้องถิ่น">
      <div className="org__box org__box--top">พระเยซูคริสต์ ทรงเป็นศีรษะและเจ้าของคริสตจักร</div>
      <div className="org__line" />
      <div className="org__box">ที่ประชุมสัปปุรุษ<small>สมาชิกสมบูรณ์ออกเสียงได้ (ข้อ 90.4) · ประชุมอย่างน้อยปีละครั้ง (82.14)</small></div>
      <div className="org__line" />
      <div className="org__row">
        <div className="org__box org__box--main">คณะธรรมกิจ<small>ศิษยาภิบาล ผู้ปกครองประจำการ มัคนายกประจำการ (ข้อ 81)<br />ประธาน · รองประธาน · เลขานุการ · เหรัญญิก</small></div>
        <div className="org__box org__box--side">คณะผู้ปกครอง<small>ดูแลฝ่ายจิตวิญญาณ รับโอนย้ายสมาชิก (ข้อ 79–80)</small></div>
      </div>
      <div className="org__line" />
      <div className="org__units">
        {['คริสเตียนศึกษา', 'ประกาศ–ติดตามผล', 'อบรมสร้างสาวก', 'นมัสการ', 'การเงิน–ทรัพย์สิน', 'เยี่ยมเยียน–สงเคราะห์'].map((u) => (
          <span key={u}>{u}</span>
        ))}
      </div>
      <figcaption>ฝ่ายงานเป็นตัวอย่างจากบทเรียน คริสตจักรจัดตามความเหมาะสมได้ (ข้อ 81.5) · ผู้แทนเข้าประชุมธรรมกิจคริสตจักรภาค 7 (ข้อ 82.16)</figcaption>
    </figure>
  )
}

const NOTE_LABEL: Record<MgmtNote['kind'], string> = { match: '✅ ตรงกัน', diff: '⚖️ ต่างกัน / เพิ่มเติม', gap: '❓ ต้องตรวจสอบ' }

function BylawItem({ doc, no, focus, note }: { doc: CharterDoc; no: number; focus: string; note: string }) {
  const a = doc.articles.find((x) => x.no === no)
  if (!a) return null
  return (
    <details className="bylaw">
      <summary>
        <span className="art-no">ข้อ {no}</span>
        <span className="bylaw__body">
          {focus && <span className="bylaw__focus">{focus}</span>}
          <span>{note || a.text.split('\n')[0].replace(/^(ข้อ|ช้อ)\s*\d+\s*/, '')}</span>
        </span>
      </summary>
      <OfficialText a={a} doc={doc} compact />
    </details>
  )
}

// ---------- หน้าหัวข้อ ----------
export function ManagementTopic() {
  const { id = '' } = useParams()
  const { docs, failed, retry } = useDocs()
  if (!docs) return <Loading failed={failed} retry={retry} />
  const { m, c } = docs
  const i = m.topics.findIndex((t) => t.id === id)
  const t = m.topics[i]
  if (!t) return <p className="empty">ไม่พบหัวข้อนี้</p>
  const prev = m.topics[i - 1]
  const next = m.topics[i + 1]
  return (
    <>
      <div className="page-head">
        <p className="eyebrow">การบริหารจัดการ · หัวข้อ {i + 1} จาก {m.topics.length}</p>
        <span className="page-icon" aria-hidden="true">{t.icon}</span>
        <h1>{t.title}</h1>
        <p>{t.summary}</p>
      </div>

      {t.id === 'structure' && <OrgChart />}

      <section className="src-block src-block--bylaws">
        <h2><span className="src src--bylaws">📜 ทางการ</span> ระเบียบปฏิบัติฯ ภาค 7 ที่เกี่ยวข้อง</h2>
        <p className="source-note">กดแต่ละข้อเพื่ออ่านข้อความทางการ</p>
        <div className="bylaw-list">
          {t.bylaws.map((b) => <BylawItem key={`${b.article}-${b.focus}`} doc={c} no={b.article} focus={b.focus} note={b.note} />)}
        </div>
      </section>

      <section className="src-block src-block--lesson">
        <h2><span className="src src--lesson">🎓 บทเรียน</span> {m.sources.lesson.title}</h2>
        <p className="source-note">{m.sources.lesson.org} · {m.sources.lesson.date} · {m.sources.lesson.kind}</p>
        {t.lesson.map((b) => (
          <div key={b.heading} className="lesson-block">
            <h3>{b.heading}</h3>
            <ul className="plain-list">{b.points.map((p, k) => <li key={k}>{p}</li>)}</ul>
          </div>
        ))}
        {t.refs.length > 0 && <p className="source-note">📖 พระคัมภีร์ที่บทเรียนอ้างถึง: {t.refs.join(' · ')}</p>}
      </section>

      <section className="src-block src-block--note">
        <h2><span className="src src--note">🔎 เทียบสองแหล่ง</span></h2>
        <ul className="note-list">
          {t.notes.map((n, k) => (
            <li key={k} className={`note note--${n.kind}`}>
              <span className="note__kind">{NOTE_LABEL[n.kind]}</span>
              <p>{n.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="src-block src-block--practice">
        <h2><span className="src src--note">✅ นำไปใช้</span></h2>
        <ol className="practice-list">{t.practice.map((p, k) => <li key={k}>{p}</li>)}</ol>
      </section>

      <nav className="pager" aria-label="หัวข้อก่อนหน้าและถัดไป">
        {prev ? <Link to={`/manage/${prev.id}`} className="btn btn--ghost">‹ {prev.icon}</Link> : <span />}
        <Link to="/manage" className="btn btn--ghost">ทุกหัวข้อ</Link>
        {next ? <Link to={`/manage/${next.id}`} className="btn btn--ghost">{next.icon} ›</Link> : <span />}
      </nav>
    </>
  )
}

// ---------- ถาม AI ----------
const AI_ERR: Record<AiError['kind'], string> = {
  unavailable: 'ยังใช้ผู้ช่วย AI ในหน้านี้ไม่ได้',
  declined: 'ยังไม่ได้อนุญาตให้ใช้ผู้ช่วย AI',
  locked: 'ต้องใส่รหัสเข้าใช้ผู้ช่วย AI ก่อน ไปที่ ⚙️ ตั้งค่า › รหัสเข้าใช้ผู้ช่วย AI แล้วกลับมากดลองอีกครั้ง',
  busy: 'ผู้ช่วย AI ใช้งานมากเกินไปในขณะนี้ กรุณาลองใหม่อีกสักครู่',
  refused: 'ผู้ช่วย AI ตอบเรื่องนี้ไม่ได้ ลองถามด้วยคำอื่น',
  failed: 'การเชื่อมต่อขัดข้อง กรุณาลองใหม่',
  cancelled: 'หยุดแล้ว',
}

function gather(m: MgmtDoc, c: CharterDoc, q: string): { topics: MgmtTopic[]; articles: CharterArticle[] } {
  const topics = matchTopics(m, q, 2)
  const seen = new Set<number>()
  const articles: CharterArticle[] = []
  const add = (n: number) => {
    const a = c.articles.find((x) => x.no === n)
    if (a && !seen.has(n)) {
      seen.add(n)
      articles.push(a)
    }
  }
  topics.forEach((t) => t.bylaws.forEach((b) => add(b.article)))
  searchCharter(c, q, 8).forEach((h) => add(h.article.no))
  return { topics, articles: articles.slice(0, 14) }
}

export function ManagementAsk() {
  const [params] = useSearchParams()
  const q = (params.get('q') ?? '').trim()
  const { docs, failed, retry } = useDocs()
  const [state, setState] = useState<'loading' | 'no-ai' | { err: AiError['kind'] } | MgmtAnswer>('loading')
  const ctl = useRef<AbortController | null>(null)

  const run = useCallback(async () => {
    if (!docs || !q) return
    const ai = await getAiProvider()
    if (!ai) return setState('no-ai')
    ctl.current?.abort()
    const c = new AbortController()
    ctl.current = c
    setState('loading')
    try {
      const g = gather(docs.m, docs.c, q)
      const r = await askManagement(ai, docs.m, docs.c, q, g.topics, g.articles, { signal: c.signal })
      if (!c.signal.aborted) setState(r)
    } catch (e) {
      if (!c.signal.aborted) setState({ err: e instanceof AiError ? e.kind : 'failed' })
    }
  }, [docs, q])

  useEffect(() => {
    run()
    return () => ctl.current?.abort()
  }, [run])

  if (!docs) return <Loading failed={failed} retry={retry} />
  if (!q) return <p className="empty">ยังไม่ได้พิมพ์คำถาม</p>
  const { topics } = gather(docs.m, docs.c, q)
  const cited = typeof state === 'object' && 'cited' in state
    ? state.cited.map((n) => docs.c.articles.find((a) => a.no === n)).filter((a): a is CharterArticle => !!a)
    : []

  return (
    <>
      <div className="page-head">
        <span className="page-icon" aria-hidden="true">🏛️</span>
        <h1>{q}</h1>
        <p>คำตอบจากระเบียบปฏิบัติฯ ภาค 7 และบทเรียนการบริหารคริสตจักร</p>
      </div>

      {state === 'loading' && (
        <div className="card ai-loading" role="status">
          <div className="ai-loading__row"><span className="spinner" aria-hidden="true" /><p><strong>กำลังอ่านทั้งสองแหล่ง…</strong></p></div>
          <button type="button" className="btn btn--ghost" onClick={() => ctl.current?.abort()}>หยุด</button>
        </div>
      )}
      {state === 'no-ai' && <p className="empty">ผู้ช่วย AI ใช้ได้เมื่อเปิดแอปผ่านลิงก์ของ Claude — ดูหัวข้อที่เกี่ยวข้องด้านล่าง</p>}
      {typeof state === 'object' && 'err' in state && (
        <div className="card">
          <p>{AI_ERR[state.err]}</p>
          {state.err !== 'declined' && <button type="button" className="btn" onClick={run}>ลองอีกครั้ง</button>}
        </div>
      )}
      {typeof state === 'object' && 'answer' in state && (
        <section className="ai-explain">
          <header>
            <span className="badge">🤖 คำอธิบายจาก AI · ไม่ใช่ข้อความทางการ</span>
            {state.used_lesson && <span className="badge">ใช้ข้อมูลจากบทเรียนด้วย</span>}
          </header>
          <h2>💡 คำตอบ</h2>
          <p>{state.answer}</p>
          {state.steps.length > 0 && (
            <>
              <h2>🛠️ ขั้นตอน</h2>
              <ol>{state.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </>
          )}
          {state.differences && (
            <div className="note note--diff">
              <span className="note__kind">⚖️ ความต่างระหว่างสองแหล่ง</span>
              <p>{state.differences}</p>
            </div>
          )}
          {state.note && <p className="ai-explain__watch">⚠️ {state.note}</p>}
        </section>
      )}

      {cited.length > 0 && (
        <section className="section">
          <h2 className="section__title">📜 ข้อความทางการที่อ้างอิง</h2>
          {cited.map((a) => <OfficialText key={a.no} a={a} doc={docs.c} compact />)}
        </section>
      )}

      {topics.length > 0 && (
        <section className="section">
          <h2 className="section__title">อ่านหัวข้อที่เกี่ยวข้อง</h2>
          <ul className="results">
            {topics.map((t) => (
              <li key={t.id}>
                <Link to={`/manage/${t.id}`} className="result">
                  <span className="result__icon" aria-hidden="true">{t.icon}</span>
                  <span className="result__body">
                    <span className="result__title">{t.title}</span>
                    <span className="art-where">{t.summary}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
