// ชนิดข้อมูลตรงกับตารางในฐานข้อมูล (Step A2) เพื่อย้ายจาก seed ไป Supabase ได้โดยไม่แก้หน้าจอ

export type SafetyClass =
  | 'none'
  | 'mental_health'
  | 'self_harm'
  | 'domestic_violence'
  | 'child_safety'
  | 'abuse'
  | 'medical_emergency'

export type ReviewStatus = 'draft' | 'approved'

export interface Situation {
  id: string
  slug: string
  title: string
  icon: string
  summary: string
  safety_class: SafetyClass
  keywords: string[] // ตาราง situation_keywords
  sort_order: number
}

/** การ์ดบนหน้าแรก ชี้ไปที่สถานการณ์ (Pastoral Kit) หรือไปที่ส่วนอื่นของแอป */
export type HomeAction =
  | { id: string; kind: 'situation'; situation_slug: string; label: string; icon: string }
  | { id: string; kind: 'route'; to: string; label: string; icon: string }

export type SourceType = 'situation' | 'scripture' | 'prayer' | 'constitution' | 'member' | 'management' | 'saved-prayer'

export interface SearchResult {
  type: SourceType
  id: string
  title: string
  icon: string
  href: string
}
