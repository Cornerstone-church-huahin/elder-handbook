import { useMemo } from 'react'
import { useSharedStore } from './sharedStore'
import { getSync } from './sync'

/**
 * โน้ต: นัดหมาย/ตารางเวลา (มีวันที่ เวลา) และบันทึกย่อเตือนความจำ — บันทึกออนไลน์ (notes.json)
 * ใช้ร่วมกันทุกเครื่อง · ติ๊ก "เห็นเฉพาะฉัน" ได้
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
  updated: number
  deleted?: boolean
  by?: string
}

export const todayStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function useNotes() {
  const store = useSharedStore<Note>({ localKey: 'khatha.notes.v1', file: 'notes.json', label: 'โน้ต' })
  const me = getSync()?.name.trim() || 'me'
  const items = useMemo(() => store.items.filter((n) => !n.private || n.owner === me), [store.items, me])
  const save = (n: Partial<Note> & { title: string }) => {
    const id = n.id ?? `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    const old = store.items.find((x) => x.id === id)
    store.put([{ body: '', date: '', time: '', done: false, private: false, owner: me, ...old, ...n, id, updated: 0 } as Note])
  }
  const today = todayStr()
  const dueToday = items.filter((n) => !n.done && n.date && n.date <= today).length
  return { items, save, remove: store.remove, sync: store.sync, dueToday, me }
}
