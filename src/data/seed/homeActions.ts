import type { HomeAction } from '../types'

// การ์ดหน้าแรก — การ์ดสถานการณ์ 6 ใบถูกนำออกตามที่เจ้าของโครงการขอ (26 ก.ย. 2026)
// เพราะพิมพ์เรื่องในช่องอธิษฐานเผื่อ/ค้นหาแล้วระบบดึงคู่มือสถานการณ์ขึ้นมาเอง
export const seedHomeActions: HomeAction[] = [
  { id: 'a07', kind: 'route', to: '/prayer', icon: '🙏', label: 'เตรียมคำอธิษฐาน' },
  { id: 'a08', kind: 'route', to: '/bible', icon: '📖', label: 'พระคัมภีร์' },
  { id: 'a13', kind: 'route', to: '/people', icon: '👥', label: 'บุคคลในพระคัมภีร์' },
  { id: 'a09', kind: 'route', to: '/service', icon: '⛪', label: 'เตรียมพิธี' },
  { id: 'a10', kind: 'route', to: '/members', icon: '👤', label: 'สมาชิกและการติดตาม' },
  { id: 'a15', kind: 'route', to: '/occasions', icon: '📅', label: 'วันสำคัญ' },
  { id: 'a11', kind: 'route', to: '/constitution', icon: '📜', label: 'ธรรมนูญและระเบียบ' },
  { id: 'a14', kind: 'route', to: '/manage', icon: '🏛️', label: 'การบริหารจัดการ' },
]
