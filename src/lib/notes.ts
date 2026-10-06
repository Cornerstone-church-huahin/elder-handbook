import { useMemo } from 'react'
import { usePrivateStore } from './privateStore'
import { getSync } from './sync'

/**
 * โน้ต: นัดหมาย/ตารางเวลา (มีวันที่ เวลา) และบันทึกย่อเตือนความจำ — บันทึกออนไลน์ (notes.json)
 * ส่วนตัวรายคน: คนอื่นไม่เห็น · ตัวเองเห็นชุดเดียวกันทุกเครื่อง (ใช้ชื่อเดิม)
 */
export interface Note {
  id: string
  title: string
  body: string
  date: string // YYYY-MM-DD หรือ '' = บันทึกย่อ
  time: string // HH:MM หรือ ''
  done: boolean
  private: boolean
  owner: string
  ownerId?: string
  updated: number
  deleted?: boolean
  by?: string
}

export const todayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function useNotes() {
  // โน้ตเดิมที่เคยเก็บรวมใน notes.json: นำเฉพาะของตัวเอง (ชื่อผู้บันทึกตรงกัน) มาเป็นส่วนตัว — คัดลอก ไม่ลบไฟล์เดิม
  const store = usePrivateStore<Note>({ key: 'khatha.notes.v1', name: 'notes', label: 'โน้ต', legacyFile: 'notes.json', legacyMine: (x, name) => !!name && (x.owner === name || x.by === name) })
  const me = getSync()?.name.trim() || 'me'
  const items = useMemo(() => store.items, [store.items])
  const save = (n: Partial<Note> & { title: string }) => {
    const id = n.id ?? `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    const old = store.items.find((x) => x.id === id)
    store.put([{ body: '', date: '', time: '', done: false, private: false, owner: me, ...old, ...n, id, updated: 0 } as Note])
  }
  const today = todayStr()
  const dueToday = items.filter((n) => !n.done && n.date && n.date <= today).length
  return { items, save, remove: store.remove, sync: store.sync, dueToday, me }
}
