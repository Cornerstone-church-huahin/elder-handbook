import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { search } from '../data/contentRepo'
import type { SearchResult, SourceType } from '../data/types'
import { IconSearch } from '../components/Icons'

// Source Badge ตาม Blueprint ข้อ 16 — ผู้ใช้ต้องรู้เสมอว่าผลลัพธ์มาจากแหล่งใด
const BADGE: Record<SourceType, string> = {
  situation: '🤝 คู่มืออภิบาล',
  scripture: '📖 พระคัมภีร์',
  prayer: '🙏 คำอธิษฐาน',
  constitution: '📜 ธรรมนูญ',
  member: '👤 สมาชิก',
}

export default function Search() {
  const [params, setParams] = useSearchParams()
  const initial = params.get('q') ?? ''
  const [q, setQ] = useState(initial)
  const [results, setResults] = useState<SearchResult[]>([])

  useEffect(() => {
    setQ(initial)
    search(initial).then(setResults)
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
        <section className="section" aria-live="polite">
          {results.length > 0 ? (
            <>
              <h2 className="section__title">พบ {results.length} รายการ</h2>
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
            <p className="empty">ไม่พบเรื่อง “{initial}” ลองใช้คำอื่น เช่น ป่วย เสียชีวิต หนี้ ครอบครัว</p>
          )}
        </section>
      )}
    </>
  )
}
