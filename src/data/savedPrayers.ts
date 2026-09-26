/**
 * คำอธิษฐานที่บันทึกไว้ (ของผู้ปกครองเอง) — public/data/saved-prayers.json
 * ใช้ได้ออฟไลน์ (ไฟล์ถูกเก็บในเครื่องโดย service worker) ข้อความแสดงตามต้นฉบับ ไม่ผ่าน AI
 */
export interface SavedPrayer {
  id: string
  category: string
  title: string
  subtitle: string
  use: string
  ref?: string
  keywords: string[]
  text: string
}
export interface SavedCategory { id: string; title: string; icon: string }
export interface SavedPrayersDoc { title: string; note: string; categories: SavedCategory[]; prayers: SavedPrayer[] }

let cached: Promise<SavedPrayersDoc> | null = null
export function loadSavedPrayers(): Promise<SavedPrayersDoc> {
  if (!cached) {
    cached = fetch('./data/saved-prayers.json')
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json()
      })
      .catch((e) => {
        cached = null
        throw e
      })
  }
  return cached
}

/** หาคำอธิษฐานที่ตรงกับข้อความที่พิมพ์ (ดูจากคำสำคัญ ชื่อ และหมวด) เรียงจากตรงมากไปน้อย */
export function matchSavedPrayers(doc: SavedPrayersDoc, text: string, limit = 3): SavedPrayer[] {
  const t = text.replace(/\s+/g, '').toLowerCase()
  if (!t) return []
  const cat = new Map(doc.categories.map((c) => [c.id, c.title]))
  return doc.prayers
    .map((p) => {
      let score = 0
      for (const k of p.keywords) if (t.includes(k.replace(/\s+/g, ''))) score += k.length
      const words = [p.title, p.subtitle, cat.get(p.category) ?? ''].join(' ').replace(/\s+/g, '')
      if (t.length >= 3 && words.includes(t)) score += 10
      return { p, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p)
}
