import { createContext, useContext, useMemo } from 'react'
import { useSharedStore } from './sharedStore'
import { getSync } from './sync'

/**
 * ไฮไลต์ข้อความทั่วไป (เรื่องเล่า คำอธิษฐาน เนื้อหาบุคคล ฯลฯ) ของแต่ละคน — ไฮไลต์ทั้งย่อหน้า
 * จำด้วยลายนิ้วมือของข้อความ (ย่อหน้าเดียวกันอยู่ที่ไหนก็ไฮไลต์) · เก็บออนไลน์ แต่แสดงเฉพาะของผู้ใช้เครื่องนี้
 */
export interface TextHl { id: string; owner: string; h: string; color: string; snippet: string; updated: number; deleted?: boolean; by?: string }

export function textKey(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return `${text.length}.${(h >>> 0).toString(36)}`
}

export function useTextHighlightsStore() {
  const store = useSharedStore<TextHl>({ localKey: 'khatha.textHighlights.v1', file: 'text-highlights.json', label: 'ไฮไลต์ข้อความ' })
  const me = getSync()?.name.trim() || 'me'
  const map = useMemo(() => {
    const m = new Map<string, string>()
    for (const x of store.items) if (x.owner === me) m.set(x.h, x.color)
    return m
  }, [store.items, me])
  const paint = (text: string, color: string | null) => {
    const h = textKey(text)
    const id = `${me}|${h}`
    if (color === null) {
      const x = store.items.find((y) => y.id === id)
      if (x) store.remove(id)
      return
    }
    store.put([{ id, owner: me, h, color, snippet: text.slice(0, 60), updated: 0 }])
  }
  return { colorOf: (text: string) => map.get(textKey(text)), paint }
}

export type TextHighlights = ReturnType<typeof useTextHighlightsStore>
export const TextHlContext = createContext<TextHighlights | null>(null)
export const useTextHighlights = () => useContext(TextHlContext)
