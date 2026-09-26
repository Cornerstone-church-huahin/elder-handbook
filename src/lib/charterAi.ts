/**
 * AI สำหรับธรรมนูญ — หลัก "Constitution First"
 * AI ตอบจาก "ข้อความทางการ" ที่แอปค้นมาให้เท่านั้น ต้องอ้างเลขข้อทุกครั้ง
 * และคำอธิบายของ AI ต้องแสดงแยกจากข้อความทางการเสมอ
 */
import type { CharterArticle, CharterDoc } from '../data/charter'
import { chapterLabel } from '../data/charter'
import type { AiCallOptions, AiProvider } from './ai'
import { AiError } from './ai'

const MAX_CONTEXT_CHARS = 16000 // ประมาณ 48KB ต่ำกว่าเพดาน 64KB ของการเรียก AI

function contextBlock(doc: CharterDoc, articles: CharterArticle[]): string {
  let out = ''
  for (const a of articles) {
    const block = `<article no="${a.no}" section="${chapterLabel(doc, a)}" page="${a.page_start}">\n${a.text}\n</article>\n`
    if (out.length + block.length > MAX_CONTEXT_CHARS) break
    out += block
  }
  return out
}

export interface CharterAnswer {
  found: boolean
  answer: string
  steps: string[]
  cited: number[]
  note: string
}

export async function askCharter(
  ai: AiProvider,
  doc: CharterDoc,
  question: string,
  candidates: CharterArticle[],
  opts: AiCallOptions,
): Promise<CharterAnswer> {
  const q = question.replace(/\s+/g, ' ').trim().slice(0, 400)
  const prompt = `คุณช่วยผู้ปกครองคริสตจักร (อายุ 60 ปีขึ้นไป) ค้นคำตอบจาก "${doc.title} ${doc.version}"

คำถาม: """${q}"""

ด้านล่างคือข้อจากระเบียบปฏิบัติฯ ที่ระบบค้นมาว่าอาจเกี่ยวข้อง (ข้อความทางการ):
${contextBlock(doc, candidates)}
กฎที่ต้องทำตามเคร่งครัด:
1. ตอบจากข้อที่ให้มาข้างบนเท่านั้น ห้ามใช้ความรู้ทั่วไปหรือเดาเนื้อหาที่ไม่มีในข้อเหล่านี้
2. ทุกประเด็นในคำตอบต้องระบุเลขข้อที่ใช้ เช่น (ข้อ 25) และใส่เลขข้อทั้งหมดที่ใช้ใน "cited"
3. ถ้าข้อที่ให้มาไม่ได้ตอบคำถามนี้ ให้ found เป็น false และบอกใน note ว่าไม่พบในระเบียบปฏิบัติฯ ที่มีอยู่ (หลายเรื่องระเบียบปฏิบัติฯ ให้เป็นไปตาม "ธรรมนูญคริสตจักรภาค 7" หรือ "ธรรมนูญแห่งสภาคริสตจักรในประเทศไทย" ซึ่งยังไม่มีในแอป ถ้าข้อที่ให้มาบอกเช่นนั้นให้แจ้งด้วย)
4. ใช้ภาษาไทยง่าย ประโยคสั้น สุภาพ อธิบายเหมือนเล่าให้ผู้สูงอายุฟัง ห้ามคัดลอกข้อความทางการยาว ๆ มาเป็นคำตอบ
5. ห้ามเขียนให้คำอธิบายดูเหมือนเป็นข้อความต้นฉบับของระเบียบปฏิบัติฯ

ตอบเป็น JSON อย่างเดียว:
{
  "found": true,
  "answer": "คำตอบ 2-5 ประโยค พร้อมอ้างเลขข้อในวงเล็บ",
  "steps": ["ถ้าเป็นเรื่องขั้นตอน ให้สรุปขั้นตอนที่ต้องทำตามลำดับ ถ้าไม่ใช่ให้เป็น []"],
  "cited": [25],
  "note": "ข้อควรระวังหรือสิ่งที่ควรตรวจสอบเพิ่ม (ถ้าไม่มีให้เป็นข้อความว่าง)"
}`
  const raw = (await ai.json(prompt, opts)) as Record<string, unknown> | null
  if (!raw || typeof raw !== 'object') throw new AiError('failed', 'bad answer')
  const allowed = new Set(candidates.map((a) => a.no))
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const cited = (Array.isArray(raw.cited) ? raw.cited : [])
    .map((n) => Number(n))
    .filter((n) => allowed.has(n)) // อ้างได้เฉพาะข้อที่ส่งให้ AI จริง
  const answer = str(raw.answer)
  if (!answer && raw.found !== false) throw new AiError('failed', 'empty answer')
  return {
    found: raw.found !== false && cited.length > 0,
    answer,
    steps: (Array.isArray(raw.steps) ? raw.steps : []).map(str).filter(Boolean),
    cited: [...new Set(cited)],
    note: str(raw.note),
  }
}

export interface ArticleExplain {
  simple: string
  steps: string[]
  watch: string
}

export async function explainArticle(
  ai: AiProvider,
  doc: CharterDoc,
  a: CharterArticle,
  opts: AiCallOptions,
): Promise<ArticleExplain> {
  const prompt = `อธิบาย ข้อ ${a.no} ของ "${doc.title} ${doc.version}" (${chapterLabel(doc, a)}) ให้ผู้ปกครองคริสตจักรอายุ 60 ปีขึ้นไปเข้าใจง่าย

ข้อความทางการ:
"""
${a.text}
"""

กฎ: อธิบายจากข้อความนี้เท่านั้น ห้ามเพิ่มเนื้อหาที่ไม่มีในข้อความ ถ้าข้อนี้อ้างไปยังธรรมนูญหรือข้ออื่น ให้บอกว่าต้องดูที่นั่น ภาษาไทยง่าย ประโยคสั้น

ตอบเป็น JSON อย่างเดียว:
{
  "simple": "สรุปใจความ 2-4 ประโยค",
  "steps": ["ถ้าต้องนำไปปฏิบัติ ให้เขียนเป็นขั้นตอนสั้น ๆ ถ้าไม่มีให้เป็น []"],
  "watch": "ข้อควรระวัง 1 ประโยค หรือข้อความว่าง"
}`
  const raw = (await ai.json(prompt, { ...opts, cacheHours: 24 })) as Record<string, unknown> | null
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const simple = str(raw?.simple)
  if (!simple) throw new AiError('failed', 'empty explain')
  return {
    simple,
    steps: (Array.isArray(raw?.steps) ? (raw!.steps as unknown[]) : []).map(str).filter(Boolean),
    watch: str(raw?.watch),
  }
}
