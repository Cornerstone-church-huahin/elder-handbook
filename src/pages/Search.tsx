import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { search } from '../data/contentRepo'
import { loadCharter, searchCharter } from '../data/charter'
import { loadManagement, matchTopics } from '../data/management'
import type { SearchResult, SourceType } from '../data/types'
import { IconSearch } from '../components/Icons'
import { RelatedPeople } from './People'

// Source Badge ตาม Blueprint ข้อ 16 — ผู้ใช้ต้องรู้เสมอว่าผลลัพธ์มาจากแหล่งใด
const BADGE: Record<SourceType, string> = {
  situation: '🤝 คู่มืออภิบาล',
  scripture: '📖 พระคัมภีร์',
  prayer: '🙏 คำอธิษฐาน',
  constitution: '📜 ธรรมนูญ',
  member: '👤 สมาชิก',
  management: '🏛️ การบริหาร',
}

export default function Search() {
  const [params, setParams] = useSearchParams()
  const initial = params.get('q') ?? ''
  const [q, setQ] = useState(initial)
  const [results, setResults] = useState<SearchResult[]>([])

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
    ]).then(([a, b, c]) => alive && setResults([...a, ...c, ...b]))
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
        <section className="section" aria-live="polite">
          {results.length > 0 ? (
            <>
              <h2 className="section__title">ผลการค้นหา</h2>
              <ul className="results">
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
            </>
          ) : (
            <p className="empty">ไม่พบคู่มือที่ตรงกับ “{initial}” กดปุ่มด้านบนเพื่อให้ AI ช่วยเตรียม</p>
          )}
        </section>
      )}

      {initial && <RelatedPeople text={initial} />}
    </>
  )
}
