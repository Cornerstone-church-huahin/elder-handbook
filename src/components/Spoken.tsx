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
type Seg = { index: number; segment: string }
const Segmenter = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => { segment: (s: string) => Iterable<Seg> } }).Segmenter
/** ตัดคำภาษาไทย (ใช้ตัวตัดคำของเครื่อง · ไม่มีก็ตัดที่ช่องว่าง) */
export function words(text: string): Seg[] {
  if (Segmenter) return [...new Segmenter('th', { granularity: 'word' }).segment(text)]
  const out: Seg[] = []
  text.replace(/\S+|\s+/g, (m, i: number) => { out.push({ index: i, segment: m }); return m })
  return out
}

/** ตำแหน่งตัวอักษรใต้นิ้ว (นับจากต้นข้อความ) */
function charAt(root: HTMLElement, x: number, y: number, text: string): number {
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
  return Math.min(text.length, range.toString().length)
}
/** คำที่อยู่ตำแหน่งนั้น */
function wordAt(text: string, at: number): Seg | null {
  return words(text).find((s) => s.index <= at && at < s.index + s.segment.length && s.segment.trim()) ?? null
}

/** กดค้างที่คำ → เปิดป๊อปอัพแก้คำอ่าน (PronEditor ใน AppShell รับเหตุการณ์นี้) */
export const PRON_EVENT = 'khatha-pron-edit'
export type PronEditDetail = { text: string; start: number; end: number }

export function Spoken({ text, id, follow, word = false, onTap }: { text: string; id: string; follow: Follow; word?: boolean; onTap?: (id: string, at: number) => void }) {
  const ref = useRef<HTMLElement>(null)
  const box = useRef<HTMLSpanElement>(null)
  const press = useRef<{ x: number; y: number; t: number } | null>(null)
  const longDone = useRef(false)
  const tap = (e: React.MouseEvent) => {
    if (longDone.current) {
      // เพิ่งกดค้าง → ไม่นับเป็นการแตะ
      longDone.current = false
      e.stopPropagation()
      e.preventDefault()
      return
    }
    if (!onTap || !box.current || window.getSelection()?.toString()) return
    e.stopPropagation()
    e.preventDefault()
    const at = charAt(box.current, e.clientX, e.clientY, text)
    onTap(id, wordAt(text, at)?.index ?? at)
  }
  // กดค้าง ~0.6 วินาที = แก้คำอ่าน (ภาษาไทยเท่านั้น)
  const down = word
    ? undefined
    : (e: React.PointerEvent) => {
        if (e.button > 0) return
        const x = e.clientX
        const y = e.clientY
        const t = window.setTimeout(() => {
          press.current = null
          if (!box.current) return
          const w = wordAt(text, charAt(box.current, x, y, text))
          if (!w) return
          longDone.current = true
          window.setTimeout(() => { longDone.current = false }, 900) // กันเฉพาะการแตะที่ตามมาทันที
          window.getSelection()?.removeAllRanges()
          window.dispatchEvent(new CustomEvent<PronEditDetail>(PRON_EVENT, { detail: { text, start: w.index, end: w.index + w.segment.length } }))
        }, 600)
        press.current = { x, y, t }
      }
  const cancel = () => {
    if (press.current) window.clearTimeout(press.current.t)
    press.current = null
  }
  const move = (e: React.PointerEvent) => {
    if (press.current && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) > 10) cancel()
  }
  const handlers = {
    onClick: tap,
    onPointerDown: down,
    onPointerMove: move,
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu: word ? undefined : (e: React.MouseEvent) => e.preventDefault(),
  }
  const cls = `spoken${onTap ? ' spoken--tap' : ''}${word ? '' : ' spoken--press'}`
  const on = !!follow && follow.id === id
  useEffect(() => {
    if (on) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [on, follow?.at]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!on) return <span ref={box} className={cls} {...handlers}>{text}</span>
  const at = Math.max(0, Math.min(follow.at, text.length))
  // เสียงอังกฤษบอกตำแหน่งคำได้ → ไฮไลต์ทีละคำ · เสียงไทยส่วนใหญ่ไม่บอก → ไฮไลต์ทั้งวลีที่กำลังอ่าน
  const sp = text.slice(at).search(/\s/)
  const wordEnd = sp < 0 ? text.length : at + sp
  const end = Math.max(at + 1, word ? Math.min(follow.end, wordEnd) : follow.end)
  return (
    <span ref={box} className={cls} {...handlers}>
      <span className="spoken-done">{text.slice(0, at)}</span>
      <mark ref={ref} className="spoken-now">{text.slice(at, end)}</mark>
      {text.slice(end)}
    </span>
  )
}
