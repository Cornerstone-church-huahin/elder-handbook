/**
 * ถามเรื่องการบริหาร — ประมวล 2 แหล่งโดยแยกที่มา
 * ลำดับความสำคัญ: 📜 ระเบียบปฏิบัติฯ ภาค 7 (ทางการ) มาก่อน 🎓 บทเรียน (เอกสารประกอบการสอน)
 * ถ้าสองแหล่งต่างกัน ต้องบอกความต่าง และถือระเบียบปฏิบัติฯ เป็นหลัก
 */
import type { CharterArticle, CharterDoc } from '../data/charter'
import { chapterLabel } from '../data/charter'
import type { MgmtDoc, MgmtTopic } from '../data/management'
import type { AiCallOptions, AiProvider } from './ai'
import { AiError } from './ai'

export interface MgmtAnswer {
  answer: string
  steps: string[]
  cited: number[]
  used_lesson: boolean
  differences: string
  note: string
}

export async function askManagement(
  ai: AiProvider,
  mgmt: MgmtDoc,
  charter: CharterDoc,
  question: string,
  topics: MgmtTopic[],
  articles: CharterArticle[],
  opts: AiCallOptions,
): Promise<MgmtAnswer> {
  const q = question.replace(/\s+/g, ' ').trim().slice(0, 400)
  const lessonCtx = topics
    .map((t) => `<lesson topic="${t.title}">\n${t.lesson.map((b) => `${b.heading}:\n- ${b.points.join('\n- ')}`).join('\n')}\n</lesson>`)
    .join('\n')
    .slice(0, 6000)
  let artCtx = ''
  for (const a of articles) {
    const block = `<article no="${a.no}" section="${chapterLabel(charter, a)}">\n${a.text}\n</article>\n`
    if (artCtx.length + block.length > 11000) break
    artCtx += block
  }
  const prompt = `คุณช่วยผู้ปกครองคริสตจักร (อายุ 60 ปีขึ้นไป) เข้าใจระบบการบริหารคริสตจักร

คำถาม: """${q}"""

แหล่งที่ 1 (ทางการ): "${charter.title} ${charter.version}"
${artCtx || '(ไม่มีข้อที่เกี่ยวข้อง)'}
แหล่งที่ 2 (เอกสารประกอบการสอน ไม่ใช่ข้อบังคับ): "${mgmt.sources.lesson.title}" ${mgmt.sources.lesson.org} ${mgmt.sources.lesson.date}
${lessonCtx || '(ไม่มีเนื้อหาที่เกี่ยวข้อง)'}

กฎที่ต้องทำตามเคร่งครัด:
1. ตอบจากสองแหล่งข้างบนเท่านั้น ห้ามใช้ความรู้ทั่วไปมาเป็นกฎหรือข้อบังคับ
2. ถ้าเป็นเรื่องกฎหรือขั้นตอนทางการ ให้ใช้แหล่งที่ 1 เป็นหลักและอ้างเลขข้อในวงเล็บ เช่น (ข้อ 82.14) ใส่เลขข้อหลักที่ใช้ใน "cited"
3. เนื้อหาจากแหล่งที่ 2 ให้ระบุว่า "ตามบทเรียน" ทุกครั้ง และตั้ง used_lesson เป็น true
4. ถ้าสองแหล่งพูดไม่ตรงกัน หรือแหล่งที่ 2 มีเรื่องที่แหล่งที่ 1 ไม่ได้กำหนด ให้อธิบายใน "differences" และถือแหล่งที่ 1 เป็นหลัก
5. ถ้าทั้งสองแหล่งไม่ได้ตอบคำถาม ให้บอกตรง ๆ ใน answer ว่าไม่พบ และแนะนำว่าอาจอยู่ในธรรมนูญคริสตจักรภาค 7 หรือธรรมนูญของสภาคริสตจักรในประเทศไทย ซึ่งยังไม่มีในแอป
6. ภาษาไทยง่าย ประโยคสั้น สุภาพ

ตอบเป็น JSON อย่างเดียว:
{"answer": "คำตอบ 3-6 ประโยค", "steps": ["ขั้นตอนที่ต้องทำ ถ้ามี ไม่มีให้เป็น []"], "cited": [82], "used_lesson": true, "differences": "ความต่างระหว่างสองแหล่ง หรือข้อความว่าง", "note": "ข้อควรตรวจสอบเพิ่ม หรือข้อความว่าง"}`
  const raw = (await ai.json(prompt, { ...opts, cacheHours: 6 })) as Record<string, unknown> | null
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const answer = str(raw?.answer)
  if (!answer) throw new AiError('failed', 'empty answer')
  const allowed = new Set(articles.map((a) => a.no))
  return {
    answer,
    steps: (Array.isArray(raw?.steps) ? (raw!.steps as unknown[]) : []).map(str).filter(Boolean),
    cited: [...new Set((Array.isArray(raw?.cited) ? (raw!.cited as unknown[]) : []).map((n) => Math.trunc(Number(n))).filter((n) => allowed.has(n)))],
    used_lesson: raw?.used_lesson === true,
    differences: str(raw?.differences),
    note: str(raw?.note),
  }
}
