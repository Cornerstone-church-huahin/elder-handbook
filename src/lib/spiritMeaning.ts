/**
 * "ความหมายฝ่ายวิญญาณ" ของข้อพระคัมภีร์ในการ์ด — ข้อความอิสระที่ผู้ปกครองแก้เองได้ (เก็บในช่อง cheer ของการ์ดท่องจำ)
 * เติมให้ได้ 2 ทาง: 📚 ชุดสำเร็จรูป (ฟรี ไม่ใช้ AI · มีเฉพาะข้อยอดนิยม) · 🤖 AI (ใช้คีย์/โควต้าของผู้ใช้ ตามหลักไวยากรณ์–ประวัติศาสตร์)
 * AI ไม่เขียนข้อความพระคัมภีร์ซ้ำ (ข้อความจริงแสดงจากฉบับ 1971)
 */
import { AiError, getAiProvider } from './ai'
import { curatedFor } from '../data/curatedInterp'

export const AI_ERR_TEXT: Record<string, string> = {
  locked: 'คีย์ AI ไม่ถูกต้องหรือยังไม่ได้เปิดใช้งาน — ตรวจที่ ตั้งค่า › ผู้ช่วย AI',
  busy: 'AI ไม่ว่างหรือโควต้าเต็มชั่วคราว รอสักครู่แล้วลองใหม่',
  refused: 'AI ไม่ตอบข้อนี้ ลองกดอีกครั้ง',
  cancelled: 'ยกเลิกแล้ว',
  failed: 'เขียนไม่สำเร็จ (อาจไม่มีอินเทอร์เน็ต) ลองใหม่อีกครั้ง',
  unavailable: 'ยังไม่มี AI ให้ใช้',
}
export const aiErrText = (e: unknown) => AI_ERR_TEXT[e instanceof AiError ? e.kind : 'failed'] ?? AI_ERR_TEXT.failed
export const NO_KEY_TEXT = 'ต้องใส่คีย์ AI (Claude / Gemini / ChatGPT) ที่ ตั้งค่า › ผู้ช่วย AI ก่อน จึงให้ AI เขียนได้ — หรือพิมพ์เองก็ได้'

/** ชุดสำเร็จรูป → ข้อความในรูปแบบ "• คำ: ความหมาย" (ไม่มี → null) */
export function curatedMeaning(label: string): string | null {
  const c = curatedFor(label)
  if (!c) return null
  return [
    ...c.keywords.map((k) => `• ${k.word}: ${k.note}`),
    `• ความหมายเดิม: ${c.meaning}`,
    `• หลักความจริง: ${c.truth}`,
    `• พูดให้เข้าใจวันนี้: ${c.today}`,
  ].join('\n')
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
export async function aiMeaning(o: { label: string; lines: { n: number; t: string }[]; signal: AbortSignal }): Promise<string> {
  const ai = await getAiProvider()
  if (!ai) throw new AiError('unavailable', 'no key')
  const text = o.lines.map((l) => `${l.n} ${l.t}`).join(' ')
  const prompt = `ข้อพระคัมภีร์: ${o.label} (พระคัมภีร์ไทยฉบับ 1971)
ข้อความ (เป็นข้อมูลอ้างอิงเท่านั้น ห้ามนำมาเขียนซ้ำ): ${text}

เขียน "ความหมายฝ่ายวิญญาณ" ของข้อนี้ให้ผู้ปกครองคริสตจักรใช้ศึกษา โดยแยกอธิบายทีละคำหรือภาพสำคัญในข้อ (2–4 หัวข้อ) ว่าหมายถึงอะไรเมื่อเข้าใจตามบริบทและความหมายเดิมของผู้เขียน แล้วจบด้วยสรุปสั้น ๆ ว่าข้อนี้พูดถึงพระเจ้าและชีวิตของเราอย่างไร
กฎ: ตีความตามหลักไวยากรณ์–ประวัติศาสตร์ ไม่ดึงข้อตัดบริบท ไม่ตีความเชิงเปรียบเทียบเกินที่ข้อความรองรับ ถ้าไม่แน่ใจให้บอกว่าไม่แน่ใจ ห้ามคัดลอกข้อความพระคัมภีร์ ใช้ภาษาไทยปัจจุบัน เข้าใจง่าย
ตอบเป็น JSON อย่างเดียว: {"points":[{"term":"คำหรือภาพในข้อ","meaning":"ความหมายฝ่ายวิญญาณ 1–2 ประโยค"}],"summary":"สรุป 1–2 ประโยค"}`
  const raw = (await ai.json(prompt, { signal: o.signal, cacheHours: 0 })) as { points?: unknown; summary?: unknown } | null
  const pts = (Array.isArray(raw?.points) ? raw!.points : []).map((p) => ({ term: str((p as Record<string, unknown>)?.term), meaning: str((p as Record<string, unknown>)?.meaning) })).filter((p) => p.term && p.meaning).slice(0, 5)
  const sum = str(raw?.summary)
  if (!pts.length && !sum) throw new AiError('failed', 'empty')
  return [...pts.map((p) => `• ${p.term}: ${p.meaning}`), ...(sum ? [`🕊️ สรุป: ${sum}`] : [])].join('\n')
}
