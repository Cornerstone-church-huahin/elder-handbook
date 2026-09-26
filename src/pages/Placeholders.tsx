import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getSituation } from '../data/contentRepo'
import type { Situation } from '../data/types'

/** หน้าชั่วคราวของ Step A1 — จะถูกแทนด้วย Pastoral Kit จริงใน Step A3 */
export function KitPage() {
  const { slug = '' } = useParams()
  const [s, setS] = useState<Situation | null | undefined>(undefined)

  useEffect(() => {
    getSituation(slug).then((x) => setS(x ?? null))
  }, [slug])

  if (s === undefined) return null
  if (s === null) return <ComingSoon title="ไม่พบสถานการณ์นี้" icon="🔍" />

  return (
    <>
      <div className="page-head">
        <span className="page-icon" aria-hidden="true">{s.icon}</span>
        <h1>{s.title}</h1>
        <p>{s.summary}</p>
      </div>
      <div className="card">
        <p>คู่มืออภิบาลของสถานการณ์นี้กำลังจัดทำ และจะผ่านการตรวจทานจากผู้ปกครองก่อนเปิดใช้</p>
        <Link to="/" className="btn btn--ghost">กลับหน้าแรก</Link>
      </div>
    </>
  )
}

export function ComingSoon({ title, icon, note }: { title: string; icon: string; note?: string }) {
  return (
    <>
      <div className="page-head">
        <span className="page-icon" aria-hidden="true">{icon}</span>
        <h1>{title}</h1>
      </div>
      <p className="empty">{note ?? 'ส่วนนี้จะเปิดใช้ในรุ่นถัดไป'}</p>
    </>
  )
}
