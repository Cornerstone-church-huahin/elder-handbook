import { useEffect, useState } from 'react'
import type { AiKit } from '../lib/ai'

/** Pastoral Field Mode — ใช้ต่อหน้าสมาชิก: 5 ส่วน ตัวอักษรใหญ่มาก ไม่มีเมนูอื่น */
export default function FieldMode({ kit, onClose }: { kit: AiKit; onClose: () => void }) {
  const pages = [
    {
      title: 'พระคำ',
      body: (
        <ul className="fm-list">
          {kit.scripture_refs.map((r, i) => (
            <li key={i}>
              <strong>{r.ref}</strong>
              <span>{r.theme}</span>
            </li>
          ))}
        </ul>
      ),
    },
    { title: 'คำหนุนใจ', body: <p>{kit.encouragement || kit.openers[0]}</p> },
    { title: 'คำถาม', body: <ul className="fm-list">{kit.questions.map((q, i) => <li key={i}>{q}</li>)}</ul> },
    { title: 'คำอธิษฐาน', body: <p>{kit.prayers.short}</p> },
    { title: 'ถัดไป', body: <ul className="fm-list">{kit.next_steps.map((q, i) => <li key={i}>{q}</li>)}</ul> },
  ]
  const [i, setI] = useState(0)

  // กันจอดับระหว่างเยี่ยม (ถ้าเครื่องรองรับ)
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {})
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      lock?.release().catch(() => {})
      document.body.style.overflow = prevOverflow
    }
  }, [])

  const page = pages[i]
  return (
    <div className="fieldmode" role="dialog" aria-modal="true" aria-label="โหมดเยี่ยม">
      <div className="fieldmode__top">
        <div className="fieldmode__tabs" role="tablist">
          {pages.map((p, k) => (
            <button key={p.title} type="button" role="tab" aria-selected={k === i} onClick={() => setI(k)}>
              {p.title}
            </button>
          ))}
        </div>
        <button type="button" className="fieldmode__close" onClick={onClose}>ปิด</button>
      </div>
      <div className="fieldmode__body">
        <h2>{page.title}</h2>
        {page.body}
      </div>
      <div className="fieldmode__nav">
        <button type="button" disabled={i === 0} onClick={() => setI(i - 1)}>‹ ก่อนหน้า</button>
        {i < pages.length - 1 ? (
          <button type="button" className="primary" onClick={() => setI(i + 1)}>ถัดไป ›</button>
        ) : (
          <button type="button" className="primary" onClick={onClose}>เสร็จ</button>
        )}
      </div>
    </div>
  )
}
