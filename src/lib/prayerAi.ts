/**
 * ผู้ช่วยอธิษฐานเผื่อ — สร้างคำอธิษฐาน 2 ส่วน (เผื่อผู้อื่น / เพื่อตนเอง)
 * พร้อมพระคำ (ข้ออ้างอิง + ใจความ) และบุคคลในพระคัมภีร์จากรายชื่อ 100 คนในแอป
 *
 * ความเป็นส่วนตัว: ไม่ส่งชื่อพี่น้องให้ AI — AI เขียน "(ชื่อ)" แล้วแอปแทนชื่อในเครื่อง
 */
import type { PeopleDoc, Person } from '../data/people'
import type { AiCallOptions, AiProvider } from './ai'
import { AiError } from './ai'
import { parseRef } from '../data/bible'

export interface PrayerScripture { ref: string; gist: string; person?: string }
export interface PrayerPerson { id: string; story: string; bridge: string }
export interface PrayerSet {
  title: string
  keys: string[] // คำสำคัญ 3 คำ ช่วยจำโครงคำอธิษฐาน
  scriptures: PrayerScripture[]
  people: PrayerPerson[]
  intercede: { situation: string; before_scripture: string; before_person: string; prayer: string; after: string; breath: string }
  self: { before: string; prayer: string; breath: string }
  followup: string
  safety: { level: 'none' | 'refer' | 'urgent'; note: string }
}

export async function generatePrayer(
  ai: AiProvider,
  people: PeopleDoc | null,
  request: string,
  hints: Person[],
  opts: AiCallOptions,
): Promise<PrayerSet> {
  const req = request.replace(/\s+/g, ' ').trim().slice(0, 500)
  const roster = people ? people.people.map((x) => `${x.id}: ${x.th} — ${x.themes.join(', ')}`).join('\n') : ''
  const prompt = `คุณช่วยผู้ปกครองคริสตจักร (สามีภรรยา อายุ 60 ปีขึ้นไป) เตรียมคำอธิษฐาน สำหรับคริสตจักรโปรเตสแตนต์ในประเทศไทย

เรื่องที่พี่น้องเผชิญหรือขอให้อธิษฐานเผื่อ: """${req}"""

สร้างคำอธิษฐาน 2 ส่วน:
ส่วนที่ 1 อธิษฐานเผื่อ: ผู้ปกครองอธิษฐานเผื่อพี่น้อง ใช้ "(ชื่อ)" แทนชื่อพี่น้องทุกที่ (ห้ามตั้งชื่อเอง) พร้อมสิ่งที่พูดก่อนอธิษฐาน 3 แบบให้เลือก (เล่าสถานการณ์ / อธิบายพระคำ / เปรียบเทียบกับบุคคลในพระคัมภีร์) และคำพูดหลังอธิษฐาน
ส่วนที่ 2 อธิษฐานเพื่อตนเอง: กรณีผู้ปกครองเผชิญเรื่องนี้เอง ใช้สรรพนาม "ข้าพระองค์"

หลักการเขียนคำอธิษฐาน:
- สั้น จำง่าย พูดออกเสียงได้เป็นธรรมชาติ คำอธิษฐานแต่ละบท 4-6 ประโยคสั้น ไม่เกิน 90 คำ
- มีโครง 3 ขั้นตามคำสำคัญ 3 คำใน "keys" เช่น ขอบพระคุณ → ทูลขอ → มอบไว้ แต่ให้คำสำคัญเฉพาะกับเรื่องนี้ (คำละ 1-2 คำ)
- เริ่มด้วย "ข้าแต่พระบิดาเจ้า" จบด้วย "ในพระนามพระเยซูคริสต์ อาเมน"
- อ่อนโยน ไม่ตัดสิน ไม่สัญญาผลลัพธ์แทนพระเจ้า (เช่น ห้ามบอกว่าจะหายแน่นอน) แต่วางใจในความรักและการทรงนำของพระองค์
- เชื่อมพระคำหรือบุคคลในพระคัมภีร์เข้ากับคำอธิษฐานอย่างเป็นธรรมชาติ 1 ครั้ง เพื่อให้คำอธิษฐานมีที่มาและเห็นภาพ

กฎพระคัมภีร์ (สำคัญมาก):
- ห้ามยกหรือเขียนข้อความพระคัมภีร์ ไม่ว่าจะแปลเองหรือจำมา ห้ามใส่เครื่องหมายคำพูดครอบถ้อยคำพระคัมภีร์ แอปจะแสดงข้อความจริงจากพระคัมภีร์ไทยฉบับ 1971 ให้เองตามข้ออ้างอิง
- "scriptures" ใส่ข้ออ้างอิงภาษาไทยรูปแบบ "ชื่อเล่ม บท:ข้อ" หรือ "ชื่อเล่ม บท:ข้อ–ข้อ" (ไม่เกิน 3 ข้อ) ที่มั่นใจว่ามีอยู่จริงและตรงเรื่อง พร้อม "gist" ใจความสั้น ๆ ด้วยคำของคุณเอง
- พระคำข้อแรก (พระคำหลัก) ต้องเป็นข้อที่อยู่ในเรื่องราวของบุคคลในพระคัมภีร์ที่เผชิญสถานการณ์คล้ายกับเรื่องนี้ ใส่ "person" เป็น id ของบุคคลนั้น และบุคคลนั้นต้องเป็น people[0]
- "before_scripture" = คำอธิบายพระคำหลัก 2-3 ประโยค: ข้อนี้เกิดขึ้นในเรื่องของใคร หมายความว่าอะไร และตรงกับเรื่องของ (ชื่อ) อย่างไร (ห้ามขึ้นต้นว่า "ขอเปิดอ่าน" เพราะแอปแสดงข้อพระคัมภีร์ไว้ด้านบนแล้ว)
- "before_person" = เปรียบเทียบสถานการณ์ของบุคคลนั้นกับ (ชื่อ) ให้เห็นภาพ 2-3 ประโยค เพื่อหนุนใจก่อนอธิษฐาน

บุคคลในพระคัมภีร์: เลือก 1-2 คนจากรายชื่อนี้เท่านั้น (รูปแบบ id: ชื่อ — หัวข้อ)
${roster}
${hints.length ? `ระบบคาดว่าน่าจะเกี่ยวข้อง (พิจารณาก่อน): ${hints.map((h) => h.id).join(', ')}` : ''}
เล่าเรื่องตามที่พระคัมภีร์บันทึก ห้ามแต่งรายละเอียดเพิ่ม

ความปลอดภัย: ถ้าเรื่องมีความเสี่ยงต่อชีวิตหรือความปลอดภัย (คิดทำร้ายตนเอง ความรุนแรงในบ้าน เด็กไม่ปลอดภัย การล่วงละเมิด ภาวะฉุกเฉินทางการแพทย์) ให้ safety.level เป็น "urgent" และบอกใน note ว่าต้องทำอะไรทันที (1669 เหตุฉุกเฉิน, 1323 สายด่วนสุขภาพจิต, 1300 ศูนย์ช่วยเหลือสังคม, 191 ตำรวจ) ถ้าควรพบผู้เชี่ยวชาญให้เป็น "refer" ไม่มีความเสี่ยงให้เป็น "none" และ note ว่าง การอธิษฐานต้องไม่แทนการรักษาหรือความช่วยเหลือเร่งด่วน

ตอบเป็น JSON อย่างเดียว:
{
  "title": "หัวข้อสั้น ไม่เกิน 6 คำ",
  "keys": ["คำสำคัญ 1", "คำสำคัญ 2", "คำสำคัญ 3"],
  "scriptures": [{"ref": "ชื่อเล่ม บท:ข้อ", "gist": "ใจความ 1 ประโยค", "person": "id ของบุคคลในข้อนี้"}, {"ref": "พระคำเพิ่มเติม", "gist": "ใจความ"}],
  "people": [{"id": "id เดียวกับ person ของพระคำหลัก", "story": "เล่าเรื่องของบุคคลนี้ตามที่พระคัมภีร์บันทึก 2-3 ประโยค", "bridge": "เชื่อมกับเรื่องของ (ชื่อ) 1 ประโยค"}],
  "intercede": {
    "situation": "พูดก่อนอธิษฐานแบบเล่าสถานการณ์ 2 ประโยค สื่อว่าเราเข้าใจและพระเจ้าทรงเห็น",
    "before_scripture": "อธิบายพระคำหลักกับเรื่องนี้ 2-3 ประโยค",
    "before_person": "เปรียบเทียบบุคคลในพระคำหลักกับ (ชื่อ) 2-3 ประโยค",
    "prayer": "คำอธิษฐานเผื่อ 4-6 ประโยค",
    "after": "พูดหลังอธิษฐาน หนุนใจหรืออวยพร 1-2 ประโยค",
    "breath": "คำอธิษฐานประโยคเดียวสำหรับให้พี่น้องท่องจำระหว่างวัน"
  },
  "self": {
    "before": "เตือนใจตนเองก่อนอธิษฐาน 1-2 ประโยค (ยกพระคำหรือบุคคล)",
    "prayer": "คำอธิษฐานเพื่อตนเอง 4-6 ประโยค",
    "breath": "คำอธิษฐานประโยคเดียวสำหรับภาวนาระหว่างวัน"
  },
  "followup": "ข้อแนะนำการติดตามพี่น้อง 1 ประโยค",
  "safety": {"level": "none", "note": ""}
}`
  const raw = (await ai.json(prompt, opts)) as Record<string, unknown> | null
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const obj = (v: unknown) => ((v && typeof v === 'object' ? v : {}) as Record<string, unknown>)
  const arr = (v: unknown) => (Array.isArray(v) ? v : [])
  const ic = obj(raw?.intercede)
  const sf = obj(raw?.self)
  const sa = obj(raw?.safety)
  const ids = new Set(people?.people.map((x) => x.id) ?? [])
  const set: PrayerSet = {
    title: str(raw?.title) || req.slice(0, 40),
    keys: arr(raw?.keys).map(str).filter(Boolean).slice(0, 3),
    scriptures: arr(raw?.scriptures)
      .map((s) => ({ ref: str(obj(s).ref), gist: str(obj(s).gist), person: str(obj(s).person) || undefined }))
      .filter((s) => s.ref && parseRef(s.ref)) // เฉพาะข้ออ้างอิงที่เปิดหาในพระคัมภีร์ได้
      .slice(0, 3),
    people: arr(raw?.people)
      .map((p) => ({ id: str(obj(p).id), story: str(obj(p).story), bridge: str(obj(p).bridge) }))
      .filter((p) => ids.has(p.id)) // เฉพาะบุคคลในรายชื่อ 100 คน
      .slice(0, 2),
    intercede: {
      situation: str(ic.situation), before_scripture: str(ic.before_scripture), before_person: str(ic.before_person),
      prayer: str(ic.prayer), after: str(ic.after), breath: str(ic.breath),
    },
    self: { before: str(sf.before), prayer: str(sf.prayer), breath: str(sf.breath) },
    followup: str(raw?.followup),
    safety: {
      level: (['none', 'refer', 'urgent'].includes(str(sa.level)) ? str(sa.level) : 'none') as PrayerSet['safety']['level'],
      note: str(sa.note),
    },
  }
  if (!set.intercede.prayer && !set.self.prayer) throw new AiError('failed', 'empty prayer')
  return set
}

/** แทน "(ชื่อ)" ด้วยชื่อจริงในเครื่องของผู้ใช้เท่านั้น */
export function withName(text: string, name: string): string {
  const n = name.trim() || 'พี่น้อง' // ไม่ได้ใส่ชื่อ → ใช้คำว่า "พี่น้อง"
  return text.replace(/\s*(?:\(ชื่อ\)|（ชื่อ）|\[ชื่อ\])\s*/g, (m) => `${/^\s/.test(m) ? ' ' : ''}${n}${/\s$/.test(m) ? ' ' : ''}`)
}
