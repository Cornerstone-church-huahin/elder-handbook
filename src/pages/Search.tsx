import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { loadPeople, peopleForText } from '../data/people'
import { Link, useSearchParams } from 'react-router-dom'
import { search } from '../data/contentRepo'
import { loadCharter, searchCharter } from '../data/charter'
import { loadManagement, matchTopics } from '../data/management'
import { loadNotebook, scoreNote } from '../lib/prayerNotebook'
import type { SearchResult, SourceType } from '../data/types'
import { IconSearch } from '../components/Icons'
import AiApps from '../components/AiApps'
import { RelatedPeople } from './People'
import ScriptureResults, { scriptureCount, useScriptureSearch } from '../components/ScriptureResults'

// Source Badge ตาม Blueprint ข้อ 16 — ผู้ใช้ต้องรู้เสมอว่าผลลัพธ์มาจากแหล่งใด
const BADGE: Record<SourceType, string> = {
  situation: '🤝 คู่มืออภิบาล',
  scripture: '📖 พระคัมภีร์',
  prayer: '🙏 คำอธิษฐาน',
  constitution: '📜 ธรรมนูญ',
  member: '👤 สมาชิก',
  management: '🏛️ การบริหาร',
  'saved-prayer': '📜 คำอธิษฐานที่บันทึกไว้',
}

/** แท็บพับ/ขยาย (เปิดทีละแท็บ) */
function SearchAcc({ icon, title, count, unit, children, id }: { icon: string; title: string; count: number | null; unit: string; children: ReactNode; id?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <details className="acc sacc" name="search-acc" id={id} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="acc__bar sacc__bar">
        <span className="acc__title"><span aria-hidden="true">{icon}</span> {title}</span>
        <small>{count === null ? 'กำลังค้น…' : count ? `${count} ${unit}` : 'ไม่พบ'}</small>
        <span className="acc__chev" aria-hidden="true">▾</span>
      </summary>
      {open && <div className="sacc__body">{children}</div>}
    </details>
  )
}

export default function Search() {
  const [params, setParams] = useSearchParams()
  const initial = params.get('q') ?? ''
  const [q, setQ] = useState(initial)
  const [results, setResults] = useState<SearchResult[]>([])
  const [peopleCount, setPeopleCount] = useState<number | null>(null)
  const scripture = useScriptureSearch(initial)
  const verseCount = scriptureCount(scripture)
  useEffect(() => {
    setPeopleCount(null)
    loadPeople().then((doc) => setPeopleCount(peopleForText(doc, initial, 6).length)).catch(() => setPeopleCount(0))
  }, [initial])

  useEffect(() => {
    setQ(initial)
    let alive = true
    // รวมผลจากคู่มืออภิบาลและระเบียบปฏิบัติฯ โดยแยก Source Badge ชัดเจน
    Promise.all([
      search(initial),
      loadCharter()
        .then((doc) =>
          searchCharter(doc, initial, 5).map((h): SearchResult => ({
            type: 'constitution',
            id: String(h.article.no),
            title: `ข้อ ${h.article.no} ${h.article.text.split('\n')[0].replace(/^(ข้อ|ช้อ)\s*\d+\s*/, '').slice(0, 80)}`,
            icon: '📜',
            href: `/constitution/a/${h.article.no}`,
          })),
        )
        .catch(() => [] as SearchResult[]),
      loadManagement()
        .then((m) =>
          matchTopics(m, initial, 2).map((t): SearchResult => ({
            type: 'management', id: t.id, title: t.title, icon: t.icon, href: `/manage/${t.id}`,
          })),
        )
        .catch(() => [] as SearchResult[]),
      loadNotebook()
        .then((list) =>
          list
            .map((x) => ({ x, s: scoreNote(x, initial) }))
            .filter((r) => r.s >= 3)
            .sort((a, b) => b.s - a.s)
            .slice(0, 3)
            .map(({ x }): SearchResult => ({
              type: 'saved-prayer', id: x.id, title: x.title, icon: x.icon, href: `/prayer?open=${encodeURIComponent(x.id)}`,
            })),
        )
        .catch(() => [] as SearchResult[]),
    ]).then(([a, b, c, d]) => alive && setResults([...a, ...d, ...c, ...b]))
    return () => {
      alive = false
    }
  }, [initial])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setParams(q.trim() ? { q: q.trim() } : {})
  }

  return (
    <>
      <div className="page-head">
        <h1>ค้นหา</h1>
        <p>พิมพ์เรื่องที่กำลังเผชิญด้วยภาษาธรรมดา</p>
      </div>

      <form className="search" role="search" onSubmit={onSubmit}>
        <IconSearch />
        <input
          id="search-q"
          type="search"
          enterKeyHint="search"
          placeholder="เช่น สามีเสียชีวิต"
          aria-label="คำค้นหา"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit">ค้นหา</button>
      </form>

      {initial && (
        <Link to={`/ask?q=${encodeURIComponent(initial)}`} className="ask-ai">
          <span className="ask-ai__icon" aria-hidden="true">🤖</span>
          <span className="result__body">
            <span className="result__title">ให้ AI เตรียมคู่มือเรื่องนี้</span>
            <span className="ask-ai__q">“{initial}”</span>
          </span>
          <span aria-hidden="true" className="ask-ai__go">›</span>
        </Link>
      )}

      {initial && (
        <Link to={`/prayer?q=${encodeURIComponent(initial)}`} className="btn btn--gold">🙏 หาคำอธิษฐานเรื่องนี้</Link>
      )}

      {initial && <AiApps text={initial} title="ถามเรื่องนี้กับแอป AI ที่สมัครไว้" />}

      {initial && (
        <div className="search-accs" key={initial}>
          <SearchAcc icon="👥" title="บุคคลในพระคัมภีร์ที่เกี่ยวข้อง" count={peopleCount} unit="คน">
            <RelatedPeople text={initial} bare />
          </SearchAcc>
          <SearchAcc icon="📖" title="ข้อพระคัมภีร์ที่เกี่ยวข้อง" count={verseCount} unit="ข้อ" id="acc-scripture">
            <ScriptureResults text={initial} data={scripture} />
          </SearchAcc>
          <SearchAcc icon="📜" title="ธรรมนูญ ระเบียบ และคู่มือ" count={results.length} unit="รายการ">
            {results.length > 0 ? (
              <ul className="results acc__inner" aria-live="polite">
                {results.map((r) => (
                  <li key={`${r.type}-${r.id}`}>
                    <Link to={r.href} className="result">
                      <span className="result__icon" aria-hidden="true">{r.icon}</span>
                      <span className="result__body">
                        <span className="result__title">{r.title}</span>
                        <span className="badge">{BADGE[r.type]}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">ไม่พบคู่มือที่ตรงกับ “{initial}” กดปุ่มด้านบนเพื่อให้ AI ช่วยเตรียม</p>
            )}
          </SearchAcc>
        </div>
      )}
    </>
  )
}
