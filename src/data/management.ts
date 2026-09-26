/**
 * หมวดการบริหารจัดการ (public/data/church-management.json สร้างด้วย scripts/build_management.py)
 * ประมวลจาก 2 แหล่ง: 🎓 บทเรียนการบริหารคริสตจักร (เอกสารประกอบการสอน) และ 📜 ระเบียบปฏิบัติฯ ภาค 7 (ทางการ)
 */
export interface LessonBlock { heading: string; points: string[] }
export interface BylawRef { article: number; focus: string; note: string }
export interface MgmtNote { kind: 'match' | 'diff' | 'gap'; text: string }
export interface MgmtTopic {
  id: string
  icon: string
  title: string
  summary: string
  lesson: LessonBlock[]
  refs: string[]
  bylaws: BylawRef[]
  notes: MgmtNote[]
  practice: string[]
}
export interface MgmtDoc {
  title: string
  sources: {
    lesson: { title: string; org: string; date: string; kind: string }
    bylaws: { title: string; version: string }
  }
  topics: MgmtTopic[]
}

let p: Promise<MgmtDoc> | null = null
export function loadManagement(): Promise<MgmtDoc> {
  if (!p) {
    p = fetch('./data/church-management.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<MgmtDoc>
      })
      .catch((e) => {
        p = null
        throw e
      })
  }
  return p
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')
const grams = (s: string) => {
  const t = norm(s)
  const out = new Set<string>()
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3))
  return out
}

export function topicText(t: MgmtTopic): string {
  return [t.title, t.summary, ...t.lesson.flatMap((b) => [b.heading, ...b.points]), ...t.notes.map((n) => n.text), ...t.practice].join(' ')
}

/** หัวข้อที่ตรงกับคำถามมากที่สุด (ใช้ส่งบริบทให้ AI และแนะนำหัวข้อ) */
export function matchTopics(doc: MgmtDoc, q: string, limit = 2): MgmtTopic[] {
  const qg = grams(q)
  if (!qg.size) return []
  return doc.topics
    .map((t) => {
      const g = grams(topicText(t))
      const head = grams(t.title)
      let s = 0
      for (const x of qg) {
        if (g.has(x)) s += 1
        if (head.has(x)) s += 2
      }
      return { t, s: s / qg.size }
    })
    .filter((r) => r.s > 0.3)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((r) => r.t)
}
