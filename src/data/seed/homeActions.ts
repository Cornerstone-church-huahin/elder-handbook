import type { HomeAction } from '../types'

// การ์ดหน้าแรกตาม Blueprint ข้อ 4 — ย้ายเข้าฐานข้อมูลได้ภายหลังโดยไม่ต้องแก้หน้าจอ
export const seedHomeActions: HomeAction[] = [
  { id: 'a01', kind: 'situation', situation_slug: 'hospital', icon: '🏥', label: 'เยี่ยมผู้ป่วย' },
  { id: 'a02', kind: 'situation', situation_slug: 'grief', icon: '💔', label: 'ปลอบใจผู้สูญเสีย' },
  { id: 'a03', kind: 'situation', situation_slug: 'anxiety', icon: '😟', label: 'ความกังวลและความกลัว' },
  { id: 'a04', kind: 'situation', situation_slug: 'family', icon: '👨‍👩‍👧', label: 'ปัญหาครอบครัว' },
  { id: 'a05', kind: 'situation', situation_slug: 'finance', icon: '💰', label: 'การเงิน / หนี้สิน / ถูกเอาเปรียบ' },
  { id: 'a06', kind: 'situation', situation_slug: 'conflict', icon: '🤝', label: 'ความขัดแย้ง / การให้อภัย' },
  { id: 'a07', kind: 'route', to: '/prayer', icon: '🙏', label: 'อธิษฐานเผื่อ' },
  { id: 'a08', kind: 'route', to: '/sermon', icon: '📖', label: 'เตรียมพระคำ' },
  { id: 'a13', kind: 'route', to: '/people', icon: '👥', label: 'บุคคลในพระคัมภีร์ 100 คน' },
  { id: 'a09', kind: 'route', to: '/service', icon: '⛪', label: 'เตรียมพิธี' },
  { id: 'a10', kind: 'route', to: '/members', icon: '👤', label: 'สมาชิกและการติดตาม' },
  { id: 'a11', kind: 'route', to: '/constitution', icon: '📜', label: 'ธรรมนูญและระเบียบคริสตจักร' },
  { id: 'a14', kind: 'route', to: '/manage', icon: '🏛️', label: 'การบริหารจัดการคริสตจักร' },
  { id: 'a12', kind: 'route', to: '/search', icon: '🔍', label: 'ค้นหาทุกอย่าง' },
]
