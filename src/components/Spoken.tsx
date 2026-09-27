import { useCallback, useEffect, useRef, useState } from 'react'

/** ตำแหน่งที่กำลังอ่านออกเสียง: ส่วน (id) + ช่วงตัวอักษร [at, end) ของวลี/คำที่กำลังอ่าน */
export type Follow = { id: string; at: number; end: number } | null

/** เก็บตำแหน่งการอ่าน — ส่ง onWord เข้า tts.speakSections(…, onSection, onWord) */
export function useFollow(active: boolean) {
  const [follow, setFollow] = useState<Follow>(null)
  const onWord = useCallback((id: string, at: number, end: number) => setFollow({ id, at, end }), [])
  return { follow: active ? follow : null, onWord, clear: () => setFollow(null) }
}

/**
 * ข้อความที่มีไฮไลต์วิ่งตามเสียงอ่าน: คำ/วลีที่กำลังอ่านเป็นสีทอง ส่วนที่อ่านแล้วจางลงเล็กน้อย
 * และเลื่อนหน้าจอตามให้เห็นเสมอ
 */
export function Spoken({ text, id, follow, word = false }: { text: string; id: string; follow: Follow; word?: boolean }) {
  const ref = useRef<HTMLElement>(null)
  const on = !!follow && follow.id === id
  useEffect(() => {
    if (on) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [on, follow?.at]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!on) return <>{text}</>
  const at = Math.max(0, Math.min(follow.at, text.length))
  // เสียงอังกฤษบอกตำแหน่งคำได้ → ไฮไลต์ทีละคำ · เสียงไทยส่วนใหญ่ไม่บอก → ไฮไลต์ทั้งวลีที่กำลังอ่าน
  const sp = text.slice(at).search(/\s/)
  const wordEnd = sp < 0 ? text.length : at + sp
  const end = Math.max(at + 1, word ? Math.min(follow.end, wordEnd) : follow.end)
  return (
    <>
      <span className="spoken-done">{text.slice(0, at)}</span>
      <mark ref={ref} className="spoken-now">{text.slice(at, end)}</mark>
      {text.slice(end)}
    </>
  )
}
