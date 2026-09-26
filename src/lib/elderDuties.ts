import { useCallback, useState } from 'react'

/**
 * หน้าที่ผู้ปกครอง — รายการที่ผู้ใช้แก้ไข เพิ่ม ลบ และเรียงลำดับเองได้ (เมนูตั้งค่า)
 * ตอนนี้: บันทึกในเครื่อง (localStorage)
 * Step A4: ย้ายไปเก็บใน workspace เพื่อให้คู่ผู้ปกครองเห็นรายการเดียวกันทั้งสองเครื่อง
 */
export interface Duty { id: string; text: string; source: string }

const KEY = 'khatha.elderDuties.v1'

export const DEFAULT_DUTIES: Duty[] = [
  { id: 'd01', text: 'ดูแลและเป็นต้นแบบชีวิตฝ่ายจิตวิญญาณของสมาชิก', source: 'ระเบียบปฏิบัติฯ ข้อ 80.2' },
  { id: 'd02', text: 'ดูแลและให้ข้อเสนอแนะในพันธกิจที่เกี่ยวข้องกับชีวิตฝ่ายจิตวิญญาณ', source: 'ระเบียบปฏิบัติฯ ข้อ 80.3' },
  { id: 'd03', text: 'อภิบาลดูแลและเยี่ยมเยียนสมาชิก โดยเฉพาะผู้ป่วย ผู้สูญเสีย และผู้ที่ห่างหาย', source: 'บทเรียนการบริหารคริสตจักร' },
  { id: 'd04', text: 'อธิษฐานเผื่อสมาชิกและศิษยาภิบาลเป็นประจำ', source: 'บทเรียนการบริหารคริสตจักร' },
  { id: 'd05', text: 'ดูแลการนมัสการ การเทศนา การศึกษาพระวจนะ และการฝึกอบรม', source: 'บทเรียนการบริหารคริสตจักร' },
  { id: 'd06', text: 'ประกอบศาสนพิธีในขอบเขตที่คริสตจักรภาค 7 อนุมัติ', source: 'ระเบียบปฏิบัติฯ ข้อ 24.1, 25' },
  { id: 'd07', text: 'ส่งเสริมการประกาศพระกิตติคุณและการสร้างสาวก', source: 'บทเรียนการบริหารคริสตจักร' },
  { id: 'd08', text: 'พิจารณาการรับ การโอน และการโยกย้ายสมาชิกของคริสตจักร', source: 'ระเบียบปฏิบัติฯ ข้อ 80.1' },
  { id: 'd09', text: 'พิจารณาและตัดสินปัญหาด้านความเชื่อและการประพฤติของสมาชิก ด้วยความรักและเพื่อการฟื้นฟู', source: 'ระเบียบปฏิบัติฯ ข้อ 80.6' },
  { id: 'd10', text: 'ปกป้องความเชื่อจากคำสอนผิด และกำหนดการสอนหลักข้อเชื่อและการอบรมผู้นำ', source: 'ระเบียบปฏิบัติฯ ข้อ 80.7' },
  { id: 'd11', text: 'พิจารณาเบื้องต้นเรื่องการเชิญศาสนาจารย์ ศิษยาภิบาล และครูศาสนา', source: 'ระเบียบปฏิบัติฯ ข้อ 80.4' },
  { id: 'd12', text: 'สนับสนุน ให้เกียรติ และร่วมปกครองคริสตจักรกับศิษยาภิบาล', source: 'บทเรียนการบริหารคริสตจักร' },
  { id: 'd13', text: 'เข้าประชุมคณะธรรมกิจทุกครั้ง (ขาดติดต่อกัน 3 ครั้งโดยไม่แจ้งเหตุผล พ้นจากวาระประจำการ)', source: 'ระเบียบปฏิบัติฯ ข้อ 26.5' },
]

function read(): Duty[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_DUTIES
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((d) => d && typeof d.text === 'string').map((d) => ({ id: String(d.id), text: d.text, source: String(d.source ?? '') })) : DEFAULT_DUTIES
  } catch {
    return DEFAULT_DUTIES
  }
}

function write(list: Duty[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
    return true
  } catch {
    return false // โหมดส่วนตัวของเบราว์เซอร์: ใช้ได้ระหว่างเปิดหน้านี้ แต่ไม่ถูกเก็บ
  }
}

export function useElderDuties() {
  const [list, setList] = useState<Duty[]>(read)
  const [saved, setSaved] = useState(true)
  const commit = useCallback((next: Duty[]) => {
    setList(next)
    setSaved(write(next))
  }, [])
  return {
    list,
    saved,
    add: (text: string) => commit([...list, { id: `u${Date.now().toString(36)}`, text: text.trim(), source: 'เพิ่มเอง' }]),
    update: (id: string, text: string) =>
      commit(list.map((d) => (d.id === id ? { ...d, text: text.trim(), source: d.source && !d.source.includes('(แก้ไข)') && d.source !== 'เพิ่มเอง' ? `${d.source} (แก้ไข)` : d.source } : d))),
    remove: (id: string) => commit(list.filter((d) => d.id !== id)),
    move: (id: string, dir: -1 | 1) => {
      const i = list.findIndex((d) => d.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= list.length) return
      const next = [...list]
      ;[next[i], next[j]] = [next[j], next[i]]
      commit(next)
    },
    reset: () => commit(DEFAULT_DUTIES),
  }
}
