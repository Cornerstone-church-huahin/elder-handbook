import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { loadSavedPrayers, type SavedPrayersDoc } from '../data/savedPrayers'
import { PrayerMode, VerseCard, useVerseTexts } from './Prayer'

/** เปิดอ่านคำอธิษฐานที่บันทึกไว้ — ข้อความตามต้นฉบับ ใช้ได้ออฟไลน์ */
export default function SavedPrayerPage() {
  const { id } = useParams()
  const [doc, setDoc] = useState<SavedPrayersDoc | null>(null)
  const [err, setErr] = useState(false)
  const [big, setBig] = useState(false)
  const [copied, setCopied] = useState<'' | 'ok' | 'manual'>('')
  useEffect(() => {
    loadSavedPrayers().then(setDoc).catch(() => setErr(true))
  }, [])
  const p = doc?.prayers.find((x) => x.id === id)
  const verses = useVerseTexts(p?.ref ? [p.ref] : [])

  if (err) return <p className="empty">เปิดคำอธิษฐานไม่ได้ ลองเชื่อมต่ออินเทอร์เน็ตแล้วเปิดใหม่อีกครั้ง</p>
  if (!doc) return <p className="empty">กำลังเปิด…</p>
  if (!p) return <p className="empty">ไม่พบคำอธิษฐานนี้</p>
  const cat = doc.categories.find((c) => c.id === p.category)
  const paras = p.text.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`🙏 ${p.title}\n\n${p.text}`)
      setCopied('ok')
    } catch {
      setCopied('manual')
    }
  }

  return (
    <>
      <div className="page-head">
        <span className="page-icon" aria-hidden="true">{cat?.icon ?? '🙏'}</span>
        <h1>{p.title}</h1>
        <p>{p.subtitle} · {p.use}</p>
      </div>

      {p.ref && <VerseCard label={p.ref} v={verses[p.ref]} />}

      <article className="saved-text">
        {paras.map((x, i) => (
          <p key={i}>{x}</p>
        ))}
      </article>

      <div className="prayer-actions">
        <button type="button" className="btn btn--gold" onClick={() => setBig(true)}>🔠 เปิดตัวอักษรใหญ่เพื่ออธิษฐาน</button>
        <button type="button" className="btn btn--ghost" onClick={copy}>📋 คัดลอกไปส่งทาง Line</button>
      </div>
      {copied === 'ok' && <p className="source-note">คัดลอกแล้ว วางในแชต Line ได้เลย</p>}
      {copied === 'manual' && (
        <textarea className="copy-fallback" readOnly value={p.text} rows={8} onFocus={(e) => e.currentTarget.select()} aria-label="ข้อความสำหรับคัดลอก" />
      )}

      {big && <PrayerMode steps={paras.map((t, i) => ({ h: `${i + 1}/${paras.length}`, t }))} onClose={() => setBig(false)} />}
    </>
  )
}
