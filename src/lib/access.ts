import { getSync, type SharedItem } from './sync'

/**
 * ผู้ใช้ร่วมและระดับสิทธิ์ (กันที่ระดับแอป — ไม่ใช่การล็อกระดับ GitHub)
 * - แอดมิน: ทำได้ทุกอย่างและจัดการผู้ใช้ร่วม · แก้ไขได้: เพิ่ม/แก้/ลบได้ · ดูและฟังอย่างเดียว: ส่วนที่ใช้ร่วมกันแก้ไม่ได้
 * - ตัวตน = ชื่อที่ใช้ครั้งแรกบนเครื่องนั้น (ใส่ชื่อเดิมเมื่อเข้าจากเครื่องอื่น ก็เป็นคนเดิม)
 */
export type Role = 'admin' | 'editor' | 'viewer'
export const ROLE_LABEL: Record<Role, string> = { admin: 'แอดมิน', editor: 'แก้ไขได้', viewer: 'ดูและฟังอย่างเดียว' }
export interface Member extends SharedItem { name: string; role: Role; joined: number }

export const ME_KEY = 'khatha.me.v1'
export const MEMBERS_KEY = 'khatha.members.v1'
export const INVITE_ROLE_KEY = 'khatha.inviteRole'
export const READONLY_EVENT = 'khatha-readonly'
export const ROLE_EVENT = 'khatha-role'

/** รหัสสั้นคงที่จากชื่อ (ไม่ใช่ความลับ) ใช้ตั้งชื่อโฟลเดอร์ส่วนตัวและแยกคน */
export function personIdOf(name: string): string {
  const s = name.trim().toLowerCase().normalize('NFC')
  let h1 = 0xdeadbeef ^ s.length, h2 = 0x41c6ce57 ^ s.length
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return `p${(h2 >>> 0).toString(36)}${(h1 >>> 0).toString(36)}`
}

/** ตัวตนของเครื่องนี้: ตั้งครั้งแรกจากชื่อที่ใช้เชื่อมต่อ แล้วคงที่ (เปลี่ยนชื่อที่แสดงภายหลังก็ไม่เสียข้อมูลส่วนตัว) */
export function getMe(): { id: string; name: string } | null {
  const cfg = getSync()
  let saved: { id: string } | null = null
  try { saved = JSON.parse(localStorage.getItem(ME_KEY) ?? 'null') } catch { /* ignore */ }
  if (saved?.id) return { id: saved.id, name: cfg?.name.trim() || '' }
  if (!cfg || !cfg.name.trim()) return null
  const id = personIdOf(cfg.name)
  try { localStorage.setItem(ME_KEY, JSON.stringify({ id })) } catch { /* ignore */ }
  return { id, name: cfg.name.trim() }
}

export function readAllMembers(): Member[] {
  try {
    const v = JSON.parse(localStorage.getItem(MEMBERS_KEY) ?? 'null')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

/** สิทธิ์ของเครื่องนี้ · ยังไม่เชื่อมออนไลน์ = ใช้คนเดียว (ทำได้ทุกอย่าง) · ยังไม่ลงทะเบียน = แก้ไขได้ชั่วคราว */
export function myRole(): Role {
  if (!getSync()) return 'admin'
  const me = getMe()
  const mine = me && readAllMembers().find((m) => m.id === me.id)
  if (mine) return mine.deleted ? 'viewer' : mine.role
  return 'editor'
}

/** ใช้ก่อนเขียนข้อมูลที่ใช้ร่วมกัน: true = ถูกกัน (ดูอย่างเดียว) */
export function blockIfViewer(): boolean {
  if (myRole() !== 'viewer') return false
  window.dispatchEvent(new Event(READONLY_EVENT))
  return true
}
