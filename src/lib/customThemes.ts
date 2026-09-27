import { useSharedStore } from './sharedStore'
import type { PeopleDoc } from '../data/people'

/** หัวข้อที่ผู้ปกครองสร้างเอง (เช่น "การรับใช้") พร้อมบุคคลที่เลือกไว้ — ใช้ร่วมกันออนไลน์ */
export interface CustomTheme { id: string; name: string; people: string[]; updated: number; deleted?: boolean; by?: string }

export function useCustomThemes() {
  const store = useSharedStore<CustomTheme>({
    localKey: 'khatha.customThemes.v2',
    file: 'themes.json',
    label: 'หัวข้อบุคคล',
    seed: () => {
      // ย้ายของเดิม (รุ่นที่เก็บในเครื่องอย่างเดียว)
      try {
        const v = JSON.parse(localStorage.getItem('khatha.customThemes.v1') ?? '[]')
        return Array.isArray(v) ? v.map((x) => ({ ...x, updated: Date.now() })) : []
      } catch {
        return []
      }
    },
  })
  return {
    list: store.items,
    save: (t: { id?: string; name: string; people: string[] }) => {
      const id = t.id ?? `c${Date.now().toString(36)}`
      store.put([{ id, name: t.name.trim(), people: t.people, updated: 0 }])
      return id
    },
    remove: (id: string) => store.remove(id),
  }
}

/** แนะนำบุคคลที่น่าจะเข้ากับหัวข้อใหม่ จากชื่อ บทบาท บทเรียน และหัวข้อเดิม */
export function suggestPeople(doc: PeopleDoc, name: string): string[] {
  const words = name.toLowerCase().replace(/^การ|^ความ/, '').split(/\s+/).filter((w) => w.length >= 2)
  if (!words.length) return []
  return doc.people
    .filter((p) => {
      const hay = [p.th, p.role, p.lesson, p.themes.join(' ')].join(' ').toLowerCase()
      return words.some((w) => hay.includes(w))
    })
    .map((p) => p.id)
}
