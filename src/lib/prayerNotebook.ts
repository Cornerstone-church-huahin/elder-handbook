import { useCallback, useEffect, useState } from 'react'
import { loadSavedPrayers } from '../data/savedPrayers'

/**
 * สมุดคำอธิษฐาน — ผู้ปกครองเพิ่ม แก้ไข ลบได้เอง
 * ตั้งต้นจากคำอธิษฐานที่ให้มา (public/data/saved-prayers.json) แล้วเก็บทุกการแก้ไขในเครื่องนี้ (localStorage)
 * Step A4: ย้ายไปเก็บใน workspace ให้คู่ผู้ปกครองเห็นสมุดเล่มเดียวกันทั้งสองเครื่อง
 */
export interface NotePrayer {
  id: string
  title: string
  category: string // ชื่อหมวด (พิมพ์เองได้)
  icon: string
  ref: string // ข้อพระคำประกอบ (ไม่บังคับ) เช่น "ยอห์น 11:25"
  text: string
  keywords: string[]
  updated: number
}

const KEY = 'khatha.prayerbook.v1'

function read(): NotePrayer[] | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x) => x && typeof x.text === 'string') : null
  } catch {
    return null
  }
}
function write(list: NotePrayer[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
    return true
  } catch {
    return false
  }
}

async function seed(): Promise<NotePrayer[]> {
  try {
    const d = await loadSavedPrayers()
    const cat = new Map(d.categories.map((c) => [c.id, c]))
    return d.prayers.map((p) => ({
      id: p.id,
      title: p.subtitle ? `${p.title} · ${p.subtitle}` : p.title,
      category: cat.get(p.category)?.title ?? '',
      icon: cat.get(p.category)?.icon ?? '🙏',
      ref: p.ref ?? '',
      text: p.text,
      keywords: p.keywords,
      updated: 0,
    }))
  } catch {
    return []
  }
}

/** อ่านสมุด (ครั้งแรกใช้คำอธิษฐานตั้งต้น) — ใช้ได้ทั้งในหน้าอธิษฐาน หน้าค้นหา และหน้าเปิดอ่าน */
export async function loadNotebook(): Promise<NotePrayer[]> {
  return read() ?? (await seed())
}

const ICONS: [RegExp, string][] = [
  [/ถวาย|ทรัพย์|ทศางค์/, '💰'], [/อาหาร|ข้าว|มื้อ/, '🍞'], [/เงิน|หนี้|งาน/, '🔓'], [/ป่วย|ผ่าตัด|รักษา|โรงพยาบาล/, '🏥'],
  [/เสียชีวิต|ศพ|สูญเสีย/, '🕊️'], [/ครอบครัว|ลูก|สามี|ภรรยา|แต่งงาน/, '👨‍👩‍👧'], [/เด็ก|อวยพร/, '🙌'], [/นมัสการ|ประชุม|เปิด|ปิด/, '⛪'],
]
export const iconFor = (s: string) => ICONS.find(([re]) => re.test(s))?.[1] ?? '🙏'

/** คะแนนความตรงกับคำค้น: ชื่อ > คำสำคัญ > หมวด > เนื้อความ (ภาษาไทยไม่เว้นวรรค จึงเทียบแบบมีอยู่ในข้อความ) */
export function scoreNote(p: NotePrayer, query: string): number {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return 0
  const title = p.title.toLowerCase()
  const cat = p.category.toLowerCase()
  const kw = p.keywords.join(' ').toLowerCase()
  const body = p.text.toLowerCase()
  let score = 0
  for (const t of terms) {
    let s = 0
    if (title.includes(t)) s += 6
    if (kw.includes(t) || p.keywords.some((k) => t.includes(k.toLowerCase()))) s += 4
    if (cat.includes(t)) s += 3
    if (body.includes(t)) s += 1
    score += s
  }
  return score
}

export function usePrayerNotebook() {
  const [list, setList] = useState<NotePrayer[] | null>(read)
  const [saved, setSaved] = useState(true)
  useEffect(() => {
    if (!list) seed().then(setList)
  }, [list])
  const commit = useCallback((next: NotePrayer[]) => {
    setList(next)
    setSaved(write(next))
  }, [])
  const all = list ?? []
  return {
    list,
    saved,
    add: (p: Omit<NotePrayer, 'id' | 'updated' | 'keywords' | 'icon'>) => {
      const item: NotePrayer = { ...p, id: `u${Date.now().toString(36)}`, icon: iconFor(`${p.category} ${p.title}`), keywords: [], updated: Date.now() }
      commit([item, ...all])
      return item.id
    },
    update: (id: string, p: Partial<NotePrayer>) =>
      commit(all.map((x) => (x.id === id ? { ...x, ...p, icon: p.category !== undefined || p.title !== undefined ? iconFor(`${p.category ?? x.category} ${p.title ?? x.title}`) : x.icon, updated: Date.now() } : x))),
    remove: (id: string) => commit(all.filter((x) => x.id !== id)),
    /** นำคำอธิษฐานตั้งต้นที่เคยลบกลับมา (ไม่แตะของที่เพิ่มหรือแก้ไขเอง) */
    restoreDefaults: async () => {
      const s = await seed()
      const have = new Set(all.map((x) => x.id))
      commit([...all, ...s.filter((x) => !have.has(x.id))])
    },
  }
}
