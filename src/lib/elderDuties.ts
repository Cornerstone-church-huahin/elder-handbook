import { useSharedStore } from './sharedStore'

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

type DutyItem = Duty & { pos: number; updated: number; deleted?: boolean; by?: string }

function legacy(): DutyItem[] {
  // รายการเดิมที่เคยแก้ไว้ในเครื่อง (รุ่นก่อนใช้ร่วมกัน) หรือรายการตั้งต้น
  let list = DEFAULT_DUTIES
  let touched = false
  try {
    const raw = localStorage.getItem(KEY)
    const v = raw ? JSON.parse(raw) : null
    if (Array.isArray(v)) {
      list = v.filter((d) => d && typeof d.text === 'string').map((d) => ({ id: String(d.id), text: d.text, source: String(d.source ?? '') }))
      touched = true
    }
  } catch {
    /* ignore */
  }
  const now = touched ? Date.now() : 0
  const items: DutyItem[] = list.map((d, i) => ({ ...d, pos: i, updated: now }))
  if (touched) for (const d of DEFAULT_DUTIES) if (!list.some((x) => x.id === d.id)) items.push({ ...d, pos: 999, updated: now, deleted: true })
  return items
}

/** หน้าที่ผู้ปกครอง — ใช้ร่วมกันออนไลน์ (แก้ที่เครื่องไหน อีกเครื่องเห็นด้วย) */
export function useElderDuties() {
  const store = useSharedStore<DutyItem>({ localKey: 'khatha.elderDuties.v2', file: 'duties.json', label: 'หน้าที่ผู้ปกครอง', seed: legacy })
  const sorted = [...store.items].sort((a, b) => a.pos - b.pos)
  const list: Duty[] = sorted.map(({ id, text, source }) => ({ id, text, source }))
  const renumber = (arr: DutyItem[]) => arr.map((d, i) => ({ ...d, pos: i }))
  return {
    list,
    saved: true,
    sync: store.sync,
    add: (text: string) => store.put([{ id: `u${Date.now().toString(36)}`, text: text.trim(), source: 'เพิ่มเอง', pos: sorted.length, updated: 0 }]),
    update: (id: string, text: string) => {
      const d = sorted.find((x) => x.id === id)
      if (!d) return
      const source = d.source && !d.source.includes('(แก้ไข)') && d.source !== 'เพิ่มเอง' ? `${d.source} (แก้ไข)` : d.source
      store.put([{ ...d, text: text.trim(), source }])
    },
    remove: (id: string) => store.remove(id),
    move: (id: string, dir: -1 | 1) => {
      const i = sorted.findIndex((d) => d.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= sorted.length) return
      const next = [...sorted]
      ;[next[i], next[j]] = [next[j], next[i]]
      store.put(renumber(next))
    },
    reset: () => {
      const keep = new Set(DEFAULT_DUTIES.map((d) => d.id))
      store.put([
        ...sorted.filter((d) => !keep.has(d.id)).map((d) => ({ ...d, deleted: true })),
        ...DEFAULT_DUTIES.map((d, i) => ({ ...d, pos: i, updated: 0, deleted: false })),
      ])
    },
  }
}
