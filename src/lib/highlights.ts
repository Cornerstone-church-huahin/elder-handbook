import { useEffect, useMemo } from 'react'
import { useSharedStore } from './sharedStore'
import { getSync } from './sync'

/**
 * ไฮไลต์พระคัมภีร์ "ของแต่ละคน" — เก็บออนไลน์ (highlights.json) แต่แสดงเฉพาะของผู้ใช้ที่ตั้งชื่อไว้ในเครื่องนี้
 * เจ็ทเห็นของเจ็ท ปิ่นเห็นของปิ่น (ใช้ได้หลายเครื่องต่อคน) · ยังไม่เชื่อมต่อออนไลน์ = เก็บในเครื่อง
 */
export const HL_COLORS = [
  { id: 'yellow', label: 'เหลือง' },
  { id: 'green', label: 'เขียว' },
  { id: 'blue', label: 'ฟ้า' },
  { id: 'pink', label: 'ชมพู' },
  { id: 'orange', label: 'ส้ม' },
] as const

export interface Highlight { id: string; owner: string; book: number; ch: number; v: number; color: string; updated: number; deleted?: boolean; by?: string }

export function useHighlights() {
  const store = useSharedStore<Highlight>({ localKey: 'khatha.highlights.v1', file: 'highlights.json', label: 'ไฮไลต์พระคัมภีร์' })
  const me = getSync()?.name.trim() || 'me'
  const mine = useMemo(() => store.items.filter((x) => x.owner === me), [store.items, me])
  // ไฮไลต์ที่ทำก่อนเชื่อมต่อออนไลน์ (ยังไม่มีชื่อ) → ย้ายเป็นของผู้ใช้เครื่องนี้
  const { put } = store
  useEffect(() => {
    if (me === 'me') return
    const old = store.items.filter((x) => x.owner === 'me')
    if (old.length) put([...old.map((x) => ({ ...x, deleted: true })), ...old.map((x) => ({ ...x, id: `${me}|${x.book}.${x.ch}.${x.v}`, owner: me }))])
  }, [me, store.items, put])
  const paint = (book: number, ch: number, verses: number[], color: string | null) => {
    if (color === null) {
      store.put(mine.filter((x) => x.book === book && x.ch === ch && verses.includes(x.v)).map((x) => ({ ...x, deleted: true })))
      return
    }
    store.put(verses.map((v) => ({ id: `${me}|${book}.${ch}.${v}`, owner: me, book, ch, v, color, updated: 0 })))
  }
  return { mine, paint }
}
