/**
 * AI สำหรับบุคคลในพระคัมภีร์ — ปุ่มเนื้อหาสำหรับสอนและอภิบาล
 * กติกา: ห้ามยกข้อความพระคัมภีร์ ให้เฉพาะข้ออ้างอิง, อ้างถึงบุคคลได้เฉพาะในรายชื่อ 100 คน (โหมดเปรียบเทียบ)
 */
import type { PeopleDoc, Person } from '../data/people'
import type { AiCallOptions, AiProvider } from './ai'
import { AiError } from './ai'

export interface AiSection { heading: string; text: string; items: string[] }

export type TeachMode = 'story' | 'lessons' | 'teach' | 'pastoral' | 'questions'

export const TEACH_MODES: { id: TeachMode; icon: string; label: string; ask: string }[] = [
  { id: 'story', icon: '📖', label: 'เรื่องราวชีวิต', ask: 'เล่าเรื่องชีวิตตามลำดับเหตุการณ์ 5-8 ประโยค แล้วแยกช่วงเหตุการณ์สำคัญ 4-6 ช่วง แต่ละช่วงมีข้ออ้างอิงกำกับ' },
  { id: 'lessons', icon: '🌟', label: 'จุดเด่นและบทเรียน', ask: 'จุดเด่นด้านความเชื่อและอุปนิสัยที่น่าเอาอย่าง (มุมที่ดี) 3-4 ข้อ, ความผิดพลาดที่เป็นบทเรียน 1-3 ข้อ (เล่าอย่างให้เกียรติ), และสิ่งที่พระเจ้าทรงกระทำในชีวิตของบุคคลนี้ 2-3 ข้อ' },
  { id: 'teach', icon: '🎓', label: 'โครงบทเรียนสำหรับสอน', ask: 'โครงบทเรียน 20-30 นาทีสำหรับชั้นรวีวารศึกษาผู้ใหญ่หรือกลุ่มเซลล์: ชื่อบทเรียน, ใจความหลัก 1 ประโยค, ข้อพระคัมภีร์ที่ให้อ่าน (อ้างอิง), ประเด็นสอน 3 ข้อ (แต่ละข้อมีข้ออ้างอิง), คำถามอภิปราย 4 ข้อ, การนำไปใช้ในสัปดาห์นี้ 2 ข้อ' },
  { id: 'pastoral', icon: '🤝', label: 'ใช้ในการอภิบาล', ask: 'สถานการณ์ในชีวิตสมาชิกที่เรื่องของบุคคลนี้ช่วยได้ 3-5 สถานการณ์, วิธีเล่าเรื่องนี้สั้น ๆ ต่อหน้าสมาชิก (ข้อความพูดได้ทันที 3-4 ประโยค), ประโยคเชื่อมจากเรื่องนี้ไปสู่ชีวิตของสมาชิก 2 ประโยค, และข้อควรระวังเวลาใช้เรื่องนี้ 1-2 ข้อ' },
  { id: 'questions', icon: '❓', label: 'คำถามชวนคิด', ask: 'คำถามชวนคิดสำหรับการใคร่ครวญส่วนตัวหรือกลุ่มเล็ก 6-8 ข้อ จากง่ายไปลึก แต่ละข้อสั้น ตอบได้จากประสบการณ์ชีวิต' },
]

const RULES = `กฎที่ต้องทำตามเคร่งครัด:
1. ห้ามยกหรือเขียนข้อความพระคัมภีร์ (ไม่ว่าจะแปลเองหรือจำมา) ให้ใส่เฉพาะข้ออ้างอิงเป็นภาษาไทย เช่น (ปฐมกาล 22:1-14) และใช้เฉพาะข้ออ้างอิงที่มั่นใจว่าถูกต้อง
2. แยกให้ชัดระหว่างสิ่งที่พระคัมภีร์บันทึกไว้ กับการตีความหรือการประยุกต์ ห้ามแต่งรายละเอียดที่พระคัมภีร์ไม่ได้บันทึกให้ดูเหมือนข้อเท็จจริง
3. ภาษาไทยสุภาพ อบอุ่น ประโยคสั้น เหมาะกับผู้ปกครองคริสตจักรอายุ 60 ปีขึ้นไป ใช้คำเรียกตามพระคริสตธรรมคัมภีร์ภาษาไทยฉบับ 1971
4. การอภิบาลไม่ใช่สิ่งทดแทนการแพทย์หรือผู้เชี่ยวชาญ`

const SHAPE = `ตอบเป็น JSON อย่างเดียว:
{"sections": [{"heading": "หัวข้อ", "text": "ย่อหน้า (ถ้าไม่มีให้เป็นข้อความว่าง)", "items": ["รายการ (ถ้าไม่มีให้เป็น [])"]}]}`

function parseSections(raw: unknown): AiSection[] {
  const arr = (raw as { sections?: unknown })?.sections
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const out = (Array.isArray(arr) ? arr : [])
    .map((s) => {
      const o = (s ?? {}) as Record<string, unknown>
      return {
        heading: str(o.heading),
        text: str(o.text),
        items: (Array.isArray(o.items) ? o.items : []).map(str).filter(Boolean),
      }
    })
    .filter((s) => s.heading || s.text || s.items.length)
  if (!out.length) throw new AiError('failed', 'empty sections')
  return out
}

export async function teachPerson(ai: AiProvider, p: Person, mode: TeachMode, opts: AiCallOptions): Promise<AiSection[]> {
  const m = TEACH_MODES.find((x) => x.id === mode)!
  const prompt = `บุคคลในพระคัมภีร์: ${p.th} (${p.en})
บทบาท: ${p.role}
ข้ออ้างอิงหลัก: ${p.refs.join('; ')}

งาน: ${m.label} — ${m.ask}

${RULES}

${SHAPE}`
  return parseSections(await ai.json(prompt, { ...opts, cacheHours: 24 }))
}

export interface Comparison { id: string; why: string; lesson: string; refs: string[] }

/** เปรียบเทียบสถานการณ์ที่ผู้ใช้พิมพ์กับบุคคลในรายชื่อ 100 คน — AI เลือกได้เฉพาะคนในรายชื่อ */
export async function comparePeople(
  ai: AiProvider,
  doc: PeopleDoc,
  situation: string,
  hints: Person[],
  opts: AiCallOptions,
): Promise<Comparison[]> {
  const s = situation.replace(/\s+/g, ' ').trim().slice(0, 300)
  const roster = doc.people.map((x) => `${x.id}: ${x.th} — ${x.themes.join(', ')}`).join('\n')
  const prompt = `ผู้ปกครองคริสตจักรกำลังเผชิญสถานการณ์นี้: """${s}"""

เลือกบุคคลในพระคัมภีร์ 3 คนที่ประสบการณ์ใกล้เคียงสถานการณ์นี้ที่สุด เพื่อใช้หนุนใจหรือสอน โดยเลือกจากรายชื่อนี้เท่านั้น (รูปแบบ id: ชื่อ — หัวข้อ):
${roster}
${hints.length ? `\nระบบคาดว่าบุคคลเหล่านี้น่าจะเกี่ยวข้อง (พิจารณาก่อน แต่เลือกคนอื่นได้): ${hints.map((h) => h.id).join(', ')}\n` : ''}
${RULES}

ตอบเป็น JSON อย่างเดียว:
{"matches": [{"id": "id จากรายชื่อ", "why": "เหตุใดเรื่องของบุคคลนี้ใกล้เคียงสถานการณ์ 1-2 ประโยค", "lesson": "สิ่งที่ผู้ปกครองนำไปหนุนใจได้ 1-2 ประโยค", "refs": ["ข้ออ้างอิง 1-2 ข้อ"]}]}`
  const raw = (await ai.json(prompt, { ...opts, cacheHours: 6 })) as { matches?: unknown } | null
  const ids = new Set(doc.people.map((x) => x.id))
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const out = (Array.isArray(raw?.matches) ? raw!.matches : [])
    .map((m) => {
      const o = (m ?? {}) as Record<string, unknown>
      return { id: str(o.id), why: str(o.why), lesson: str(o.lesson), refs: (Array.isArray(o.refs) ? o.refs : []).map(str).filter(Boolean) }
    })
    .filter((m) => ids.has(m.id)) // ต้องเป็นคนในรายชื่อเท่านั้น
  if (!out.length) throw new AiError('failed', 'no matches')
  return out.slice(0, 4)
}
