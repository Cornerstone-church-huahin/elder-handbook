import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listHomeActions } from '../data/contentRepo'
import type { HomeAction } from '../data/types'
import { IconSearch } from '../components/Icons'
import SafetyNote from '../components/SafetyNote'


export default function Home() {
  const [actions, setActions] = useState<HomeAction[]>([])
  const [q, setQ] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    listHomeActions().then(setActions)
  }, [])

  const go = (text: string) => {
    const t = text.trim()
    if (t) navigate(`/search?q=${encodeURIComponent(t)}`)
  }
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    go(q)
  }

  const today = new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <>
      <div className="greeting">
        <p className="greeting__date">{today}</p>
        <h1>วันนี้คุณต้องการทำอะไร?</h1>
      </div>

      <section className="section">
        <label htmlFor="home-search" className="section__title">วันนี้กำลังเผชิญเรื่องอะไร?</label>
        <form className="search" role="search" onSubmit={onSubmit}>
          <IconSearch />
          <input
            id="home-search"
            type="search"
            enterKeyHint="search"
            placeholder="พิมพ์เรื่องที่พบ เช่น ป่วย"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="submit">ค้นหา</button>
        </form>
      </section>

      <section className="section">
        <h2 className="section__title">เมนู</h2>
        <ul className="actions">
          {actions.map((a) => (
            <li key={a.id}>
              <Link
                to={a.kind === 'situation' ? `/kit/${a.situation_slug}` : a.to}
                className="action"
              >
                <span className="action__icon" aria-hidden="true">{a.icon}</span>
                <span className="action__label">{a.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <SafetyNote />
    </>
  )
}
