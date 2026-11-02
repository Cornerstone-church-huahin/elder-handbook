/**
 * ตีความข้อพระคัมภีร์ด้วย AI ตามหลักไวยากรณ์–ประวัติศาสตร์ (grammatical-historical) ซึ่งเป็นหลักตีความกระแสหลักของศาสนศาสตร์คริสต์:
 * สังเกต → บริบท → ความหมายเดิมของผู้เขียนต่อผู้อ่านสมัยนั้น → หลักความจริงที่ใช้ได้ทุกยุค → ประยุกต์กับวันนี้
 * AI ไม่เขียนข้อความพระคัมภีร์ซ้ำ (ข้อความแสดงจากฉบับ 1971 ในแอป) · ผลเก็บไว้กับการ์ด (ใช้ซ้ำได้ ไม่ต้องเรียก AI ซ้ำ)
 */
import { BIBLE_BOOKS, loadBook, parseRef } from '../data/bible'
import { BOOK_INTROS } from '../data/bookIntros'
import type { AiProvider } from './ai'
import { AiError } from './ai'

export interface Interpretation {
  interp: 1
  at: number
  context: string
  meaning: string
  keywords: { word: string; note: string }[]
  truth: string
  today: string
  apply: { life: string; thought: string; action: string }
  caution: string
  related: string[]
}

export interface VerseContext {
  book: string
  chapter: number
  intro?: { writer: string; readers: string; theme: string }
  before: { n: number; t: string }[]
  after: { n: number; t: string }[]
}

/** บริบทจากพระคัมภีร์ 1971 ในแอป: ข้อก่อนหน้า/ถัดไป + ภาพรวมของเล่ม (ใช้ได้โดยไม่ต้องมี AI) */
export async function verseContext(label: string): Promise<VerseContext | null> {
  const r = parseRef(label)
  if (!r || !r.verses.length) return null
  const c = await loadBook(r.book)
  const ch = c?.[r.chapter - 1]
  const first = Math.min(...r.verses), last = Math.max(...r.verses)
  const pick = (from: number, to: number) => (ch ? Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i).filter((n) => n >= 1 && n <= ch.length).map((n) => ({ n, t: ch[n - 1] })) : [])
  return { book: BIBLE_BOOKS[r.book - 1].name, chapter: r.chapter, intro: BOOK_INTROS[r.book - 1], before: pick(first - 3, first - 1), after: pick(last + 1, last + 3) }
}

const RULES = `คุณเป็นผู้ช่วยสอนพระคัมภีร์ ตีความตามหลักไวยากรณ์–ประวัติศาสตร์ (grammatical-historical) ซึ่งเป็นหลักตีความกระแสหลักของศาสนศาสตร์คริสต์ โดยทำตามลำดับ:
1) สังเกต: ข้อนี้พูดอะไร ใครพูดกับใคร ใช้คำสำคัญอะไร
2) บริบท: ประโยค ย่อหน้า บท และเล่ม รวมภูมิหลังวัฒนธรรมและประวัติศาสตร์
3) ความหมายเดิม: ผู้เขียนต้องการสื่ออะไรกับผู้อ่านดั้งเดิม ก่อนข้ามมาถึงปัจจุบัน
4) พระคัมภีร์ตีความพระคัมภีร์: ต้องสอดคล้องกับภาพรวมของพระคัมภีร์ทั้งเล่ม
5) หลักความจริงที่ใช้ได้ทุกยุค แล้วจึงประยุกต์สู่ชีวิตวันนี้

กฎที่ต้องทำตามเคร่งครัด:
- ห้ามคัดลอกหรือเขียนข้อความพระคัมภีร์ซ้ำ ใช้ถ้อยคำของคุณเองเท่านั้น (ข้อความที่ให้ไว้เป็นข้อมูลอ้างอิง)
- ห้ามดึงข้อเดี่ยวตัดบริบท ห้ามตีความเชิงเปรียบเทียบเกินที่ข้อความรองรับ ห้ามสร้างหลักคำสอนจากข้อนี้ข้อเดียว
- แยกให้ชัดว่า "ข้อนี้บอกอะไร" กับ "เราประยุกต์อย่างไร" ถ้าข้อนี้มีหลายทัศนะที่ยอมรับได้ ให้บอกสั้น ๆ และไม่ตัดสินนิกาย
- ถ้าไม่มั่นใจเรื่องภาษาเดิม ผู้เขียน หรือภูมิหลัง ให้พูดว่าไม่แน่ใจ ห้ามเดา ห้ามแต่งข้ออ้างอิง ใส่เฉพาะข้อที่มั่นใจว่ามีจริงและเกี่ยวข้อง
- เขียนเป็นภาษาไทยปัจจุบัน ร่วมสมัย อบอุ่น ประโยคสั้น เข้าใจง่ายทั้งผู้ใหญ่และคนรุ่นใหม่ ศัพท์เทคนิคต้องอธิบายในประโยคเดียวกัน
- การประยุกต์ต้องเป็นรูปธรรม: ชีวิตประจำวัน การคิด และการกระทำ`

const SHAPE = `ตอบเป็น JSON อย่างเดียว (ทุกช่องเป็นข้อความภาษาไทย):
{"context":"บริบทของข้อนี้ (ผู้เขียน ผู้อ่าน สถานการณ์ ก่อน–หลังข้อนี้) 2–3 ประโยค",
"meaning":"ความหมายเดิมที่ผู้เขียนสื่อกับผู้อ่านสมัยนั้น 2–4 ประโยค",
"keywords":[{"word":"คำสำคัญ","note":"ความหมาย/ภาษาเดิมถ้ามั่นใจ"}],
"truth":"หลักความจริงที่ใช้ได้ทุกยุค 1–2 ประโยค",
"today":"อธิบายด้วยภาษาปัจจุบันว่าข้อนี้หมายความว่าอะไรสำหรับเราวันนี้ 3–5 ประโยค",
"apply":{"life":"นำไปใช้ในการดำเนินชีวิต 1–2 ประโยค","thought":"นำไปใช้กับวิธีคิด 1–2 ประโยค","action":"สิ่งที่ลงมือทำได้จริงสัปดาห์นี้ 1–2 ประโยค"},
"caution":"ข้อควรระวังไม่ให้เข้าใจผิด (ถ้าไม่มีให้เป็นข้อความว่าง)",
"related":["ข้ออ้างอิงที่ช่วยอ่านประกอบ เช่น ยอห์น 3:16 (ไม่เกิน 3 ข้อ ถ้าไม่มั่นใจให้เว้นว่าง)"]}
keywords ไม่เกิน 3 คำ`

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
function parse(raw: unknown): Interpretation {
  const o = (raw ?? {}) as Record<string, unknown>
  const ap = (o.apply ?? {}) as Record<string, unknown>
  const kw = (Array.isArray(o.keywords) ? o.keywords : []).map((k) => ({ word: str((k as Record<string, unknown>)?.word), note: str((k as Record<string, unknown>)?.note) })).filter((k) => k.word).slice(0, 3)
  const out: Interpretation = {
    interp: 1, at: Date.now(), context: str(o.context), meaning: str(o.meaning), keywords: kw, truth: str(o.truth), today: str(o.today),
    apply: { life: str(ap.life), thought: str(ap.thought), action: str(ap.action) }, caution: str(o.caution),
    related: (Array.isArray(o.related) ? o.related : []).map(str).filter((r) => r && parseRef(r)).slice(0, 3),
  }
  if (!out.meaning && !out.today) throw new AiError('failed', 'empty interpretation')
  return out
}

export async function interpretVerse(ai: AiProvider, o: { label: string; lines: { n: number; t: string }[]; ctx: VerseContext | null; again?: number; signal: AbortSignal }): Promise<Interpretation> {
  const text = o.lines.map((l) => `${l.n} ${l.t}`).join(' ')
  const near = o.ctx ? [...o.ctx.before.map((v) => `${v.n} ${v.t}`), '[ข้อที่ขอตีความอยู่ตรงนี้]', ...o.ctx.after.map((v) => `${v.n} ${v.t}`)].join('\n') : ''
  const intro = o.ctx?.intro ? `ภาพรวมของเล่ม ${o.ctx.book}: ผู้เขียน${o.ctx.intro.writer} · ผู้อ่าน${o.ctx.intro.readers} · ใจความ${o.ctx.intro.theme}` : ''
  const prompt = `ข้อที่ขอตีความ: ${o.label} (พระคัมภีร์ไทยฉบับ 1971)
ข้อความ (เป็นข้อมูลอ้างอิงเท่านั้น ห้ามนำมาเขียนซ้ำ): ${text}
${intro}
ข้อความรอบข้อนี้ (เป็นข้อมูลอ้างอิงเท่านั้น):
${near}
${o.again ? `\nครั้งนี้เป็นการขอตีความซ้ำครั้งที่ ${o.again + 1}: ให้ลำดับความคิดและตัวอย่างการประยุกต์ต่างจากเดิม แต่ความหมายเดิมของข้อต้องไม่เปลี่ยน\n` : ''}
${RULES}

${SHAPE}`
  return parse(await ai.json(prompt, { signal: o.signal, cacheHours: 0 }))
}

/** เก็บผลลงช่อง story ของการ์ด (ซิงก์ไปกับการ์ด) · อ่านกลับ */
export const packInterp = (i: Interpretation) => JSON.stringify(i)
export function readInterp(story: string): Interpretation | null {
  try {
    const v = JSON.parse(story || 'null') as Interpretation | null
    return v && v.interp === 1 ? v : null
  } catch { return null }
}
