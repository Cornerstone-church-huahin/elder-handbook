import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  chapterLabel,
  citation,
  loadCharter,
  searchCharter,
  splitArticleRefs,
  type CharterArticle,
  type CharterDoc,
} from '../data/charter'
import { AiError, getAiProvider } from '../lib/ai'
import { askCharter, explainArticle, type ArticleExplain, type CharterAnswer } from '../lib/charterAi'
import { IconSearch } from '../components/Icons'

// ---------- โหลดเอกสาร ----------
function useCharter() {
  const [doc, setDoc] = useState<CharterDoc | null>(null)
  const [failed, setFailed] = useState(false)
  const load = useCallback(() => {
    setFailed(false)
    loadCharter().then(setDoc).catch(() => setFailed(true))
  }, [])
  useEffect(() => {
    load()
  }, [load])
  return { doc, failed, retry: load }
}

function Loading({ failed, retry }: { failed: boolean; retry: () => void }) {
  if (!failed) return <p className="empty">กำลังเปิดระเบียบปฏิบัติฯ…</p>
  return (
    <div className="card">
      <p>เปิดข้อมูลระเบียบปฏิบัติฯ ไม่สำเร็จ กรุณาตรวจการเชื่อมต่ออินเทอร์เน็ต</p>
      <button type="button" className="btn" onClick={retry}>ลองอีกครั้ง</button>
    </div>
  )
}

const firstLine = (a: CharterArticle) => a.text.split('\n')[0].replace(/^(ข้อ|ช้อ)\s*\d+\s*/, '')

function ArticleLink({ a, doc }: { a: CharterArticle; doc: CharterDoc }) {
  return (
    <Link to={`/constitution/a/${a.no}`} className="result">
      <span className="art-no">ข้อ {a.no}</span>
      <span className="result__body">
        <span className="art-line">{firstLine(a)}</span>
        <span className="art-where">{chapterLabel(doc, a)} · หน้า {a.page_start}</span>
      </span>
    </Link>
  )
}

function SearchBox({ initial, onSearch }: { initial: string; onSearch: (q: string) => void }) {
  const [q, setQ] = useState(initial)
  useEffect(() => {
    setQ(initial)
  }, [initial])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSearch(q.trim())
  }
  return (
    <form className="search" role="search" onSubmit={submit}>
      <IconSearch />
      <input
        id="charter-q"
        type="search"
        enterKeyHint="search"
        placeholder="เช่น คุณสมบัติผู้ปกครอง, องค์ประชุม"
        aria-label="ค้นหาหรือถามเรื่องระเบียบปฏิบัติ"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <button type="submit">ค้นหา</button>
    </form>
  )
}

function OfficialBadge({ doc }: { doc: CharterDoc }) {
  return (
    <div className="official">
      <strong>📜 {doc.title}</strong>
      <span>{doc.version} · {doc.effective}</span>
      <span className="official__warn">ข้อความดึงจากไฟล์ PDF อัตโนมัติ ยังไม่ได้ตรวจทานทีละข้อ ถ้าจะใช้อ้างอิงอย่างเป็นทางการ ควรเทียบกับฉบับพิมพ์</span>
    </div>
  )
}

// ---------- หน้าหลักธรรมนูญ ----------
export function CharterHome() {
  const { doc, failed, retry } = useCharter()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const navigate = useNavigate()

  if (!doc) return <Loading failed={failed} retry={retry} />
  const hits = q ? searchCharter(doc, q, 12) : []

  return (
    <>
      <div className="page-head">
        <span className="page-icon" aria-hidden="true">📜</span>
        <h1>ธรรมนูญและระเบียบคริสตจักร</h1>
        <p>พิมพ์คำถามหรือคำที่ต้องการ หรือเลือกอ่านตามหมวด</p>
      </div>

      <SearchBox initial={q} onSearch={(v) => setParams(v ? { q: v } : {})} />

      {q && (
        <button type="button" className="ask-ai" onClick={() => navigate(`/constitution/ask?q=${encodeURIComponent(q)}`)}>
          <span className="ask-ai__icon" aria-hidden="true">🤖</span>
          <span className="result__body">
            <span className="result__title">ถาม AI จากระเบียบปฏิบัติฯ</span>
            <span className="ask-ai__q">“{q}”</span>
          </span>
          <span aria-hidden="true" className="ask-ai__go">›</span>
        </button>
      )}

      {q && (
        <section className="section" aria-live="polite">
          <h2 className="section__title">{hits.length ? `ข้อที่เกี่ยวข้อง ${hits.length} ข้อ` : 'ไม่พบข้อที่ตรงกับคำค้น'}</h2>
          {hits.length > 0 ? (
            <ul className="results">
              {hits.map((h) => (
                <li key={h.article.no}><ArticleLink a={h.article} doc={doc} /></li>
              ))}
            </ul>
          ) : (
            <p className="empty">ลองใช้คำอื่น หรือกด “ถาม AI” ด้านบนเพื่อให้ช่วยหา</p>
          )}
        </section>
      )}

      {!q && <OfficialBadge doc={doc} />}

      {!q && (
        <section className="section">
          <h2 className="section__title">สารบัญ</h2>
          <div className="toc">
            {doc.chapters.map((ch) => {
              const arts = doc.articles.filter((a) => a.chapter === ch.no)
              const first = arts[0]?.no
              const last = arts[arts.length - 1]?.no
              return (
                <details key={ch.no} className="toc__chapter">
                  <summary>
                    <span className="toc__label">{ch.no === 'transitional' ? ch.title : `หมวด ${ch.no}`}</span>
                    <span className="toc__title">{ch.no === 'transitional' ? '' : ch.title}</span>
                    <span className="toc__range">ข้อ {first}{last !== first ? `–${last}` : ''}</span>
                  </summary>
                  {ch.parts.length > 0
                    ? ch.parts.map((p) => (
                        <div key={p.no} className="toc__part">
                          <h3>ส่วนที่ {p.no} {p.title}</h3>
                          <ul className="results">
                            {arts.filter((a) => a.part === p.no).map((a) => (
                              <li key={a.no}><TocItem a={a} /></li>
                            ))}
                          </ul>
                        </div>
                      ))
                    : (
                      <ul className="results">
                        {arts.map((a) => <li key={a.no}><TocItem a={a} /></li>)}
                      </ul>
                    )}
                </details>
              )
            })}
          </div>
          <p className="source-note">{doc.appendix_note}</p>
        </section>
      )}
    </>
  )
}

function TocItem({ a }: { a: CharterArticle }) {
  return (
    <Link to={`/constitution/a/${a.no}`} className="toc__item">
      <span className="art-no">ข้อ {a.no}</span>
      <span className="art-line">{firstLine(a)}</span>
    </Link>
  )
}

// ---------- ข้อความทางการ 1 ข้อ ----------
function OfficialText({ a, doc, compact }: { a: CharterArticle; doc: CharterDoc; compact?: boolean }) {
  return (
    <article className="official-text">
      <header>
        <span className="official-text__tag">📜 ข้อความทางการ</span>
        {compact && <Link to={`/constitution/a/${a.no}`} className="official-text__open">เปิดข้อ {a.no} ›</Link>}
      </header>
      <div className="official-text__body">
        {a.text.split('\n').map((line, i) => (
          <p key={i} className={i > 0 ? 'sub' : undefined}>
            {splitArticleRefs(line).map((part, k) =>
              typeof part === 'string' ? part : (
                <Link key={k} to={`/constitution/a/${part.no}`}>{part.label}</Link>
              ),
            )}
          </p>
        ))}
      </div>
      <footer>📄 {citation(a)} · {chapterLabel(doc, a)}</footer>
    </article>
  )
}

export function CharterArticlePage() {
  const { no = '' } = useParams()
  const { doc, failed, retry } = useCharter()
  if (!doc) return <Loading failed={failed} retry={retry} />
  const n = Number(no)
  const a = doc.articles.find((x) => x.no === n)
  if (!a) return <p className="empty">ไม่พบข้อ {no}</p>
  const prev = doc.articles.find((x) => x.no === n - 1)
  const next = doc.articles.find((x) => x.no === n + 1)
  return (
    <>
      <div className="page-head">
        <p className="eyebrow">{chapterLabel(doc, a)}</p>
        <h1>ข้อ {a.no}</h1>
      </div>
      <OfficialText a={a} doc={doc} />
      <ExplainPanel key={a.no} a={a} doc={doc} />
      <nav className="pager" aria-label="ข้อก่อนหน้าและถัดไป">
        {prev ? <Link to={`/constitution/a/${prev.no}`} className="btn btn--ghost">‹ ข้อ {prev.no}</Link> : <span />}
        <Link to="/constitution" className="btn btn--ghost">สารบัญ</Link>
        {next ? <Link to={`/constitution/a/${next.no}`} className="btn btn--ghost">ข้อ {next.no} ›</Link> : <span />}
      </nav>
    </>
  )
}

const AI_ERR: Record<AiError['kind'], string> = {
  unavailable: 'ยังใช้ผู้ช่วย AI ในหน้านี้ไม่ได้',
  declined: 'ยังไม่ได้อนุญาตให้ใช้ผู้ช่วย AI',
  busy: 'ผู้ช่วย AI ใช้งานมากเกินไปในขณะนี้ กรุณาลองใหม่อีกสักครู่',
  refused: 'ผู้ช่วย AI ตอบเรื่องนี้ไม่ได้ ลองถามด้วยคำอื่น',
  failed: 'การเชื่อมต่อขัดข้อง กรุณาลองใหม่',
  cancelled: 'หยุดแล้ว',
}

function ExplainPanel({ a, doc }: { a: CharterArticle; doc: CharterDoc }) {
  const [state, setState] = useState<'idle' | 'loading' | 'no-ai' | { err: AiError['kind'] } | ArticleExplain>('idle')
  const ctl = useRef<AbortController | null>(null)
  useEffect(() => () => ctl.current?.abort(), [])
  const run = async () => {
    const ai = await getAiProvider()
    if (!ai) return setState('no-ai')
    ctl.current?.abort()
    const c = new AbortController()
    ctl.current = c
    setState('loading')
    try {
      const r = await explainArticle(ai, doc, a, { signal: c.signal })
      if (!c.signal.aborted) setState(r)
    } catch (e) {
      if (!c.signal.aborted) setState({ err: e instanceof AiError ? e.kind : 'failed' })
    }
  }
  if (state === 'idle')
    return (
      <button type="button" className="btn btn--gold" onClick={run}>
        💡 ให้ AI อธิบายข้อนี้ให้อ่านง่าย
      </button>
    )
  if (state === 'no-ai') return <p className="empty">ผู้ช่วย AI ใช้ได้เมื่อเปิดแอปผ่านลิงก์ของ Claude</p>
  if (state === 'loading')
    return (
      <div className="card ai-loading" role="status">
        <div className="ai-loading__row"><span className="spinner" aria-hidden="true" /><p><strong>กำลังอธิบาย…</strong></p></div>
      </div>
    )
  if ('err' in state)
    return (
      <div className="card">
        <p>{AI_ERR[state.err]}</p>
        {state.err !== 'declined' && <button type="button" className="btn" onClick={run}>ลองอีกครั้ง</button>}
      </div>
    )
  return (
    <section className="ai-explain">
      <header><span className="badge">🤖 คำอธิบายจาก AI · ไม่ใช่ข้อความทางการ</span></header>
      <h2>💡 อธิบายให้อ่านง่าย</h2>
      <p>{state.simple}</p>
      {state.steps.length > 0 && (
        <>
          <h2>🛠️ นำไปปฏิบัติ</h2>
          <ol>{state.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </>
      )}
      {state.watch && <p className="ai-explain__watch">⚠️ {state.watch}</p>}
    </section>
  )
}

// ---------- ถาม AI (Constitution First) ----------
export function CharterAsk() {
  const [params] = useSearchParams()
  const q = (params.get('q') ?? '').trim()
  const { doc, failed, retry } = useCharter()
  const [state, setState] = useState<'loading' | 'no-ai' | { err: AiError['kind'] } | CharterAnswer>('loading')
  const [chars, setChars] = useState(0)
  const ctl = useRef<AbortController | null>(null)

  const candidates = doc && q ? searchCharter(doc, q, 12).map((h) => h.article) : []

  const run = useCallback(async () => {
    if (!doc || !q) return
    const ai = await getAiProvider()
    if (!ai) return setState('no-ai')
    ctl.current?.abort()
    const c = new AbortController()
    ctl.current = c
    setState('loading')
    setChars(0)
    try {
      const cands = searchCharter(doc, q, 12).map((h) => h.article)
      const r = await askCharter(ai, doc, q, cands, { signal: c.signal, onProgress: setChars, cacheHours: 6 })
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
  if (!q) return <p className="empty">ยังไม่ได้พิมพ์คำถาม</p>

  const cited = typeof state === 'object' && 'cited' in state
    ? state.cited.map((n) => doc.articles.find((a) => a.no === n)).filter((a): a is CharterArticle => !!a)
    : []

  return (
    <>
      <div className="page-head">
        <span className="page-icon" aria-hidden="true">📜</span>
        <h1>{q}</h1>
        <p>คำตอบจากระเบียบปฏิบัติของธรรมนูญคริสตจักรภาค 7 (2021)</p>
      </div>

      {state === 'loading' && (
        <div className="card ai-loading" role="status" aria-live="polite">
          <div className="ai-loading__row">
            <span className="spinner" aria-hidden="true" />
            <p><strong>{chars > 0 ? 'กำลังเขียนคำตอบ…' : `กำลังอ่าน ${candidates.length} ข้อที่เกี่ยวข้อง…`}</strong></p>
          </div>
          <button type="button" className="btn btn--ghost" onClick={() => ctl.current?.abort()}>หยุด</button>
        </div>
      )}

      {state === 'no-ai' && <p className="empty">ผู้ช่วย AI ใช้ได้เมื่อเปิดแอปผ่านลิงก์ของ Claude — ด้านล่างคือข้อที่ค้นพบ</p>}

      {typeof state === 'object' && 'err' in state && (
        <div className="card">
          <p>{AI_ERR[state.err]}</p>
          {state.err !== 'declined' && <button type="button" className="btn" onClick={run}>ลองอีกครั้ง</button>}
        </div>
      )}

      {typeof state === 'object' && 'answer' in state && (
        <section className="ai-explain">
          <header><span className="badge">🤖 คำอธิบายจาก AI · ไม่ใช่ข้อความทางการ</span></header>
          {state.found ? (
            <>
              <h2>💡 คำตอบ</h2>
              <p>{state.answer}</p>
              {state.steps.length > 0 && (
                <>
                  <h2>🛠️ ขั้นตอน</h2>
                  <ol>{state.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                </>
              )}
            </>
          ) : (
            <>
              <h2>ไม่พบคำตอบในระเบียบปฏิบัติฯ</h2>
              <p>{state.answer || state.note}</p>
            </>
          )}
          {state.note && state.found && <p className="ai-explain__watch">⚠️ {state.note}</p>}
        </section>
      )}

      {cited.length > 0 && (
        <section className="section">
          <h2 className="section__title">ข้อความทางการที่ AI อ้างอิง</h2>
          {cited.map((a) => <OfficialText key={a.no} a={a} doc={doc} compact />)}
        </section>
      )}

      {(state === 'no-ai' || (typeof state === 'object' && ('err' in state || ('found' in state && !state.found)))) && candidates.length > 0 && (
        <section className="section">
          <h2 className="section__title">ข้อที่ค้นพบ</h2>
          <ul className="results">
            {candidates.map((a) => <li key={a.no}><ArticleLink a={a} doc={doc} /></li>)}
          </ul>
        </section>
      )}
    </>
  )
}
