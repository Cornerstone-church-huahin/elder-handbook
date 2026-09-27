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
/** ตำแหน่งตัวอักษรที่แตะ (นับจากต้นข้อความ) · ปัดไปต้นคำ */
function tapOffset(root: HTMLElement, x: number, y: number, text: string): number {
  let node: Node | null = null
  let off = 0
  const d = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null }
  if (d.caretPositionFromPoint) {
    const p = d.caretPositionFromPoint(x, y)
    if (p) { node = p.offsetNode; off = p.offset }
  } else if (document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(x, y)
    if (r) { node = r.startContainer; off = r.startOffset }
  }
  if (!node || !root.contains(node)) return 0
  const range = document.createRange()
  range.setStart(root, 0)
  range.setEnd(node, off)
  const at = Math.min(text.length, range.toString().length)
  // ต้นคำ (ภาษาไทยไม่มีช่องว่าง ใช้ตัวตัดคำของเครื่อง)
  const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => { segment: (s: string) => Iterable<{ index: number; segment: string }> } }).Segmenter
  if (Seg) {
    for (const s of new Seg('th', { granularity: 'word' }).segment(text)) if (s.index <= at && at < s.index + s.segment.length) return s.index
  }
  const sp = text.lastIndexOf(' ', at)
  return sp < 0 ? 0 : sp + 1
}

export function Spoken({ text, id, follow, word = false, onTap }: { text: string; id: string; follow: Follow; word?: boolean; onTap?: (id: string, at: number) => void }) {
  const ref = useRef<HTMLElement>(null)
  const box = useRef<HTMLSpanElement>(null)
  const tap = onTap
    ? (e: React.MouseEvent) => {
        if (!box.current || window.getSelection()?.toString()) return
        e.stopPropagation()
        e.preventDefault()
        onTap(id, tapOffset(box.current, e.clientX, e.clientY, text))
      }
    : undefined
  const on = !!follow && follow.id === id
  useEffect(() => {
    if (on) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [on, follow?.at]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!on) return tap ? <span ref={box} className="spoken spoken--tap" onClick={tap}>{text}</span> : <>{text}</>
  const at = Math.max(0, Math.min(follow.at, text.length))
  // เสียงอังกฤษบอกตำแหน่งคำได้ → ไฮไลต์ทีละคำ · เสียงไทยส่วนใหญ่ไม่บอก → ไฮไลต์ทั้งวลีที่กำลังอ่าน
  const sp = text.slice(at).search(/\s/)
  const wordEnd = sp < 0 ? text.length : at + sp
  const end = Math.max(at + 1, word ? Math.min(follow.end, wordEnd) : follow.end)
  return (
    <span ref={box} className={`spoken${tap ? ' spoken--tap' : ''}`} onClick={tap}>
      <span className="spoken-done">{text.slice(0, at)}</span>
      <mark ref={ref} className="spoken-now">{text.slice(at, end)}</mark>
      {text.slice(end)}
    </span>
  )
}
