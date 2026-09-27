import { keyWords } from './bible'
/**
 * บุคคลสำคัญในพระคัมภีร์ 100 คน (public/data/bible-people.json สร้างด้วย scripts/build_people.py)
 * เรียงตามลำดับเวลา จากปฐมกาลถึงคริสตจักรยุคแรก
 */

export interface Testament { id: 'old' | 'new'; title: string; span: string }
export interface Era { id: string; title: string; short: string; testament: 'old' | 'new' }

/** ชื่อยุคแบบเต็มสำหรับแสดงผล (ตัดคำนำหน้า "พันธสัญญาใหม่:" เพราะแสดงหัวพันธสัญญาแยกอยู่แล้ว) */
export const eraTitle = (e: Era) => e.title.replace(/^พันธสัญญาใหม่:\s*/, '')
export interface Person {
  id: string
  order: number
  th: string
  en: string
  role: string
  era: string
  refs: string[]
  themes: string[]
  lesson: string
  review_status: 'draft' | 'approved'
}
export interface PeopleDoc {
  title: string
  source: string
  testaments: Testament[]
  eras: Era[]
  themes: string[]
  situation_themes: Record<string, string[]>
  theme_words: Record<string, string[]>
  people: Person[]
}

let p: Promise<PeopleDoc> | null = null
export function loadPeople(): Promise<PeopleDoc> {
  if (!p) {
    p = fetch('./data/bible-people.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<PeopleDoc>
      })
      .catch((e) => {
        p = null
        throw e
      })
  }
  return p
}

const norm = (s: string) => s.toLowerCase().replace(/[\s/,()&.-]+/g, '')

/** ค้นชื่อ (ไทย/อังกฤษ) และบทบาท — ใช้ในหน้าต่างเลือกรายชื่อ */
export function filterPeople(doc: PeopleDoc, q: string): Person[] {
  const n = norm(q)
  if (!n) return doc.people
  // ถ้าตรงกับชื่อ แสดงเฉพาะชื่อ; ถ้าไม่ตรงชื่อเลย ค่อยค้นในบทบาท (เช่น "กษัตริย์", "ผู้เผยพระวจนะ")
  const byName = doc.people.filter((x) => norm(x.th).includes(n) || norm(x.en).includes(n))
  return byName.length ? byName : doc.people.filter((x) => norm(x.role).includes(n))
}

/** หัวข้อที่ตรงกับข้อความที่ผู้ใช้พิมพ์ เช่น "สามีเสียชีวิต" → สูญเสีย, หม้าย */
export function themesInText(doc: PeopleDoc, text: string): string[] {
  const t = norm(text)
  const found = new Set<string>()
  for (const [theme, words] of Object.entries(doc.theme_words)) {
    if (words.some((w) => t.includes(norm(w)))) found.add(theme)
  }
  for (const theme of doc.themes) if (t.includes(norm(theme))) found.add(theme)
  return [...found]
}

/** บุคคลที่เกี่ยวข้องกับชุดหัวข้อ เรียงตามจำนวนหัวข้อที่ตรง (แล้วตามลำดับเวลา) */
export function peopleForThemes(doc: PeopleDoc, themes: string[], limit = 6): Person[] {
  if (!themes.length) return []
  const set = new Set(themes)
  return doc.people
    .map((x) => ({ x, s: x.themes.filter((t) => set.has(t)).length }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.x.order - b.x.order)
    .slice(0, limit)
    .map((r) => r.x)
}

/** บุคคลที่เกี่ยวข้องกับข้อความ: ชื่อที่พิมพ์ตรง ๆ มาก่อน แล้วตามหัวข้อ */
// คำค้นที่มีบุคคลตัวอย่างชัดเจน (มาก่อนผลจากหัวข้อ)
const PREFERRED: [RegExp, string[]][] = [
  [/ผู้ปกครอง|ผู้ดูแล|ศิษยาภิบาล|ผู้เลี้ยง|ผู้อาวุโส|มัคนายก/, ['moses', 'jethro', 'samuel', 'nehemiah', 'peter', 'paul', 'barnabas']],
]
export function peopleForText(doc: PeopleDoc, text: string, limit = 6): Person[] {
  const n = norm(text)
  // คำบรรยายตรงกัน เช่น "พ่อตาโมเสส" → เยโธร (พ่อตาของโมเสส)
  const words = keyWords(text)
  const byRole = words.length >= 2 ? doc.people.filter((x) => words.every((w) => norm(`${x.th} ${x.role} ${x.lesson}`).includes(norm(w)))) : []
  const pref = PREFERRED.filter(([re]) => re.test(text)).flatMap(([, ids]) => ids.map((id) => doc.people.find((x) => x.id === id)).filter((x): x is Person => !!x))
  const byName = n.length >= 2 ? doc.people.filter((x) => n.includes(norm(x.th)) || norm(x.th).includes(n)) : []
  const byTheme = peopleForThemes(doc, themesInText(doc, text), limit)
  const seen = new Set<string>()
  return [...byRole, ...byName, ...pref, ...byTheme].filter((x) => !seen.has(x.id) && seen.add(x.id)).slice(0, limit)
}

/** หาบุคคลจากชื่อที่ AI เขียนมา (เช่น "เฮเซคียาห์") เพื่อทำลิงก์ */
export function findPersonByName(doc: PeopleDoc, name: string): Person | undefined {
  const n = norm(name)
  if (!n) return undefined
  return doc.people.find((x) => norm(x.th) === n) ?? doc.people.find((x) => n.includes(norm(x.th)) && norm(x.th).length >= 3)
}
