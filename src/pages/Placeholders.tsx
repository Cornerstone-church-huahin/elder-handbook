import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getSituation } from '../data/contentRepo'
import type { Situation } from '../data/types'
import AiKitPanel from '../components/AiKitPanel'
import SafetyNote from '../components/SafetyNote'
import { RelatedPeople } from './People'

/**
 * หน้า Pastoral Kit ของสถานการณ์
 * ตอนนี้: ยังไม่มีเนื้อหาที่อนุมัติ จึงให้ AI ร่าง (ติดป้าย "ร่างโดย AI")
 * Step A3: แสดง Kit ที่อนุมัติจากฐานข้อมูลก่อน แล้วใช้ AI เป็นตัวเสริม
 */
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
      <Link to={`/prayer?q=${encodeURIComponent(s.title)}`} className="btn btn--gold">🙏 หาคำอธิษฐานเรื่องนี้</Link>
      <RelatedPeople situation={s.slug} />
      <AiKitPanel key={s.slug} topic={`${s.title} — ${s.summary}`} />
      <SafetyNote />
    </>
  )
}

/** ถาม AI จากข้อความที่ผู้ใช้พิมพ์เอง เช่น "สมาชิกกลัวการผ่าตัด" */
export function AskPage() {
  const [params] = useSearchParams()
  const q = (params.get('q') ?? '').trim()
  if (!q) return <ComingSoon title="ยังไม่ได้พิมพ์เรื่อง" icon="🔍" note="กลับไปหน้าค้นหาแล้วพิมพ์สถานการณ์ที่พบ" />
  return (
    <>
      <div className="page-head">
        <span className="page-icon" aria-hidden="true">🤖</span>
        <h1>{q}</h1>
        <p>คู่มือที่ผู้ช่วย AI เตรียมให้จากเรื่องที่คุณพิมพ์</p>
      </div>
      <Link to={`/prayer?q=${encodeURIComponent(q)}`} className="btn btn--gold">🙏 หาคำอธิษฐานเรื่องนี้</Link>
      <RelatedPeople text={q} />
      <AiKitPanel key={q} topic={q} />
      <SafetyNote />
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
