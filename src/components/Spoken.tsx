import { useCallback, useEffect, useRef, useState } from 'react'
import { useTextHighlights } from '../lib/textHighlights'

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

/** เปิดป๊อปอัพแก้คำอ่าน (PronEditor ใน AppShell) */
export const PRON_EVENT = 'khatha-pron-edit'
export type PronEditDetail = { text: string; start: number; end: number }
export const openPronEditor = (d: PronEditDetail) => window.dispatchEvent(new CustomEvent<PronEditDetail>(PRON_EVENT, { detail: d }))
/** กดค้างที่ข้อความ → แถบเครื่องมือ (TextTools ใน AppShell): ฟังจากตรงนี้ · คัดลอก · แชร์ · แก้คำอ่าน */
export const TOOLS_EVENT = 'khatha-text-tools'
/** ข้อพระคัมภีร์ (ถ้าข้อความนี้คือพระคำ) → ภาษาอังกฤษใช้ฉบับ WEB */
export type VerseInfo = { book: number; ch: number; verses: number[] }
export type ToolsDetail = PronEditDetail & { read?: () => void; verse?: VerseInfo }

/**
 * ให้ไฮไลต์ที่กำลังอ่านอยู่ในจอเสมอ: ถ้าเลื่อนลงไปใกล้ขอบล่าง (หรือถูกแถบล่างบัง) หรือหลุดขึ้นไปด้านบน
 * → เลื่อนหน้าให้บรรทัดที่กำลังอ่านขึ้นมาอยู่ด้านบนของจอ แล้วอ่านไล่ลงไปใหม่
 */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 4) return p
  }
  return null
}
/** ขอบบนที่มองเห็นได้จริง: แถบบน + แถบ/หัวที่ติดอยู่ด้านบน (ช่องค้นหาสมุดคำอธิษฐาน, ชื่อบทพระคัมภีร์) */
function visibleTop(): number {
  let top = (document.querySelector('.topbar') as HTMLElement | null)?.getBoundingClientRect().bottom ?? 60
  for (const sel of ['.bible-head', '.nb-bar']) {
    const r = (document.querySelector(sel) as HTMLElement | null)?.getBoundingClientRect()
    if (r && r.height > 0 && r.top <= top + 4 && r.bottom > top) top = r.bottom
  }
  return top
}
function keepInView(mark: HTMLElement) {
  const r = mark.getBoundingClientRect()
  const top = visibleTop()
  const nav = (document.querySelector('.bottomnav') as HTMLElement | null)?.getBoundingClientRect().top ?? window.innerHeight
  const bar = (document.querySelector('.bible-selbar') as HTMLElement | null)?.getBoundingClientRect().top
  const bottom = Math.min(nav, window.innerHeight, bar ?? nav) - 32
  const box = scrollParent(mark)
  if (box) {
    // กล่องที่เลื่อนได้ในตัว (เช่นการ์ดคำอธิษฐาน): ให้หัวกล่องอยู่ใต้แถบค้นหาก่อน แล้วเลื่อนในกล่อง
    const b = box.getBoundingClientRect()
    if (b.top < top - 1 || (b.top > top + 40 && b.bottom > bottom)) window.scrollTo({ top: window.scrollY + b.top - top - 8, behavior: 'smooth' })
    const shift = b.top < top || (b.top > top + 40 && b.bottom > bottom) ? top + 8 - b.top : 0
    const bTop = b.top + shift
    const bBottom = Math.min(b.bottom + shift - 16, bottom)
    const rt = r.top + shift
    if (r.bottom + shift > bBottom || rt < bTop + 4) box.scrollTo({ top: box.scrollTop + rt - bTop - 12, behavior: 'smooth' })
    return
  }
  if (r.bottom > bottom || r.top < top + 4) window.scrollTo({ top: window.scrollY + r.top - top - 16, behavior: 'smooth' })
}

export function Spoken({ text, id, follow, word = false, onTap, onPress, verse }: { text: string; id: string; follow: Follow; word?: boolean; onTap?: (id: string, at: number) => void; onPress?: () => void; verse?: VerseInfo }) {
  const thl = useTextHighlights()
  const hlColor = onPress || word ? undefined : thl?.colorOf(text)
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
          const w = wordAt(text, charAt(box.current, x, y, text)) ?? { index: 0, segment: text.slice(0, 1) }
          longDone.current = true
          window.setTimeout(() => { longDone.current = false }, 900) // กันเฉพาะการแตะที่ตามมาทันที
          window.getSelection()?.removeAllRanges()
          if (onPress) return onPress()
          const detail: ToolsDetail = { text, start: w.index, end: w.index + w.segment.length, read: onTap ? () => onTap(id, w.index) : undefined, verse }
          window.dispatchEvent(new CustomEvent<ToolsDetail>(TOOLS_EVENT, { detail }))
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
  const cls = `spoken${onTap ? ' spoken--tap' : ''}${word ? '' : ' spoken--press'}${hlColor ? ` hl--${hlColor}` : ''}`
  const on = !!follow && follow.id === id
  useEffect(() => {
    if (on && ref.current) keepInView(ref.current)
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
