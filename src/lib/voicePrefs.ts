/**
 * ตั้งค่าเสียงอ่าน (เครื่องนี้): เลือกเสียงจากที่มีในมือถือ · ระดับเสียงทุ้ม/แหลม
 * + คำอ่านที่แก้ไว้ (ใช้ร่วมกันออนไลน์): คำที่เครื่องอ่านผิด → เขียนแบบที่อ่านถูก
 */
const VOICE_KEY = 'khatha.voice.v1' // { th?: voiceURI, en?: voiceURI, pitch: number }
export const PRON_KEY = 'khatha.pronounce.v1' // ที่เก็บของ useSharedStore

export const PITCHES = [
  { v: 0.6, label: 'ทุ้มมาก' },
  { v: 0.8, label: 'ทุ้ม' },
  { v: 1, label: 'ปกติ' },
  { v: 1.2, label: 'แหลม' },
  { v: 1.4, label: 'แหลมมาก' },
] as const

type VoicePrefs = { th?: string; en?: string; pitch: number }
export function getVoicePrefs(): VoicePrefs {
  try {
    const v = JSON.parse(localStorage.getItem(VOICE_KEY) ?? 'null')
    return { pitch: 1, ...(v ?? {}) }
  } catch {
    return { pitch: 1 }
  }
}
export function setVoicePrefs(p: Partial<VoicePrefs>) {
  try {
    localStorage.setItem(VOICE_KEY, JSON.stringify({ ...getVoicePrefs(), ...p }))
  } catch {
    /* ignore */
  }
}

/** คำอ่านตั้งต้น (ชื่อในพระคัมภีร์ที่เสียงไทยมักอ่านผิด) — ผู้ใช้เพิ่ม/แก้ได้ในหน้าตั้งค่า */
export const BUILTIN_PRON: [string, string][] = [
  // ตัวสะกด ค ท้ายชื่อ เสียงอ่านมักอ่านเป็น "คอ" → เขียนเป็น ก
  ['เมลคีเซเดค', 'เมนคีเซเดก'],
  ['เอลีเมเลค', 'เอลีเมเลก'],
  ['เอโนค', 'เอโนก'],
  ['อิสอัค', 'อิดสะอัก'],
  ['ลาเมค', 'ลาเมก'],
  ['บาราค', 'บาราก'],
  ['ชัดรัค', 'ชัดรัก'],
  ['ชาดรัค', 'ชาดรัก'],
  ['เมชาค', 'เมชาก'],
  ['เมชัค', 'เมชัก'],
  ['โมเลค', 'โมเลก'],
  ['นิสโรค', 'นิสโรก'],
]

export interface Pron { id: string; word: string; say: string; updated: number; deleted?: boolean; by?: string }
function userPron(): Pron[] {
  try {
    const v = JSON.parse(localStorage.getItem(PRON_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x: Pron) => !x.deleted && x.word) : []
  } catch {
    return []
  }
}
/** แทนคำที่อ่านผิดด้วยคำอ่านที่ถูก (คำยาวก่อน) — ใช้กับเสียงภาษาไทยเท่านั้น ไม่เปลี่ยนข้อความบนจอ */
export function applyPron(text: string): string {
  const map = new Map<string, string>(BUILTIN_PRON)
  for (const p of userPron()) map.set(p.word.trim(), p.say.trim())
  const words = [...map.keys()].filter(Boolean).sort((a, b) => b.length - a.length)
  let out = text
  for (const w of words) out = out.split(w).join(map.get(w)!)
  return out
}
