import { useEffect, useMemo, useRef, useState } from 'react'
import { eraTitle, filterPeople, type PeopleDoc } from '../data/people'

/**
 * หน้าต่างเลือกรายชื่อ (ป๊อปอัพ) — เรียงจากปฐมกาลด้านบนถึงคริสตจักรยุคแรกด้านล่าง
 * มีช่องค้นหาชื่อ และแถบยุคให้กระโดดไปได้เร็ว
 */
export default function PeoplePicker({
  doc,
  onPick,
  onClose,
}: {
  doc: PeopleDoc
  onPick: (id: string) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const list = useMemo(() => filterPeople(doc, q), [doc, q])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const jump = (eraId: string) => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-era="${eraId}"]`)
    if (el && listRef.current) listRef.current.scrollTop = el.offsetTop // .sheet__list เป็น position: relative
  }

  const eraCounts = new Map(doc.eras.map((e) => [e.id, list.filter((x) => x.era === e.id).length]))

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="เลือกบุคคลในพระคัมภีร์"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet__head">
          <div className="sheet__title">
            <strong>เลือกบุคคล</strong>
            <span>{list.length} คน · ปฐมกาล → คริสตจักรยุคแรก</span>
          </div>
          <button type="button" className="sheet__close" onClick={onClose}>ปิด</button>
        </div>
        <input
          id="people-picker-q"
          className="sheet__search"
          type="search"
          placeholder="พิมพ์ชื่อ เช่น ดาวิด, รูธ"
          aria-label="ค้นหาชื่อ"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {!q && (
          <div className="sheet__eras" aria-label="ไปยังยุค">
            {doc.testaments.map((t) => (
              <div key={t.id} className="sheet__era-group">
                <span className="sheet__testament-tag">{t.title}</span>
                {doc.eras.filter((e) => e.testament === t.id).map((e) => (
                  <button key={e.id} type="button" onClick={() => jump(e.id)}>{e.short}</button>
                ))}
              </div>
            ))}
          </div>
        )}
        <div className="sheet__list" ref={listRef}>
          {doc.testaments.map((t) => {
            const eras = doc.eras.filter((e) => e.testament === t.id && (eraCounts.get(e.id) ?? 0) > 0)
            if (!eras.length) return null
            return (
              <div key={t.id} className="sheet__testament">
                <h2 className="testament-head">
                  <span>{t.title}</span>
                  <small>{t.span}</small>
                </h2>
                {eras.map((e) => (
              <section key={e.id} data-era={e.id}>
                <h3 className="sheet__era">{eraTitle(e)} <small>{eraCounts.get(e.id)} คน</small></h3>
                <ul>
                  {list.filter((x) => x.era === e.id).map((x) => (
                    <li key={x.id}>
                      <button type="button" className="pick" onClick={() => onPick(x.id)}>
                        <span className="pick__no">{x.order}</span>
                        <span className="pick__body">
                          <span className="pick__name">{x.th}</span>
                          <span className="pick__role">{x.role}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
                ))}
              </div>
            )
          })}
          {list.length === 0 && <p className="empty">ไม่พบชื่อ “{q}”</p>}
        </div>
      </div>
    </div>
  )
}
