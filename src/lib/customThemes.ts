import { useCallback, useState } from 'react'
import type { PeopleDoc } from '../data/people'

/** หัวข้อที่ผู้ปกครองสร้างเอง (เช่น "การรับใช้") พร้อมบุคคลที่เลือกไว้ — เก็บในเครื่องนี้ */
export interface CustomTheme { id: string; name: string; people: string[] }
const KEY = 'khatha.customThemes.v1'

function read(): CustomTheme[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => x && x.name && Array.isArray(x.people)) : []
  } catch {
    return []
  }
}

export function useCustomThemes() {
  const [list, setList] = useState<CustomTheme[]>(read)
  const commit = useCallback((next: CustomTheme[]) => {
    setList(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }, [])
  return {
    list,
    save: (t: Omit<CustomTheme, 'id'> & { id?: string }) => {
      const id = t.id ?? `c${Date.now().toString(36)}`
      commit([...list.filter((x) => x.id !== id), { id, name: t.name.trim(), people: t.people }])
      return id
    },
    remove: (id: string) => commit(list.filter((x) => x.id !== id)),
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
