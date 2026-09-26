import { seedSituations } from './seed/situations'
import { seedHomeActions } from './seed/homeActions'
import type { HomeAction, SearchResult, Situation } from './types'

/**
 * จุดเดียวที่หน้าจอใช้ดึง "เนื้อหาอ้างอิง"
 * Step A1: อ่านจาก seed ในเครื่อง
 * Step A2: เปลี่ยนภายในไฟล์นี้ให้อ่านจาก Supabase — หน้าจอไม่ต้องแก้
 * ทุกฟังก์ชันเป็น async อยู่แล้วเพื่อรองรับการเปลี่ยนนี้
 */

export async function listSituations(): Promise<Situation[]> {
  return [...seedSituations].sort((a, b) => a.sort_order - b.sort_order)
}

export async function getSituation(slug: string): Promise<Situation | undefined> {
  return seedSituations.find((s) => s.slug === slug)
}

export async function listHomeActions(): Promise<HomeAction[]> {
  return seedHomeActions
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')

/**
 * ค้นหาเบื้องต้น: จับคู่คำบางส่วนกับชื่อและคำค้นของสถานการณ์
 * (Phase B จะแทนด้วย pg_trgm + ตารางคำพ้อง และรวมทุกแหล่งพร้อม Source Badge)
 */
export async function search(query: string): Promise<SearchResult[]> {
  const q = norm(query)
  if (!q) return []
  const scored = seedSituations
    .map((s) => {
      const terms = [s.title, ...s.keywords].map(norm)
      let score = 0
      for (const t of terms) {
        if (t === q) score = Math.max(score, 3)
        else if (q.includes(t)) score = Math.max(score, 2 + t.length / 100)
        else if (t.includes(q)) score = Math.max(score, 1)
      }
      return { s, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
  return scored.map(({ s }) => ({
    type: 'situation' as const,
    id: s.id,
    title: s.title,
    icon: s.icon,
    href: `/kit/${s.slug}`,
  }))
}
