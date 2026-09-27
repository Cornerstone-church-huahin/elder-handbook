import type { AiSection, TeachMode } from '../lib/peopleAi'
import { useSharedStore } from '../lib/sharedStore'

/** เนื้อหาบุคคลในพระคัมภีร์ 5 หมวด (public/data/people-content.json) + ส่วนที่ผู้ปกครองแก้ไข (ใช้ร่วมกันออนไลน์) */
export type PersonContent = Partial<Record<TeachMode, AiSection[]>>
let p: Promise<Record<string, PersonContent>> | null = null
export function loadPeopleContent(): Promise<Record<string, PersonContent>> {
  if (!p) {
    p = fetch('./data/people-content.json')
      .then((r) => (r.ok ? r.json() : { people: {} }))
      .then((d) => d.people ?? {})
      .catch(() => {
        p = null
        return {}
      })
  }
  return p
}

export interface PersonEdit { id: string; sections: AiSection[]; updated: number; deleted?: boolean; by?: string }
export function usePeopleEdits() {
  return useSharedStore<PersonEdit>({ localKey: 'khatha.peopleEdits.v1', file: 'people-edits.json', label: 'เนื้อหาบุคคลในพระคัมภีร์' })
}

/** แปลงหมวดเป็นข้อความสำหรับแก้ไข: "## หัวข้อ" · ย่อหน้า · "- รายการ" */
export function sectionsToText(ss: AiSection[]): string {
  return ss
    .map((s) => [s.heading ? `## ${s.heading}` : '', s.text, ...s.items.map((i) => `- ${i}`)].filter(Boolean).join('\n'))
    .join('\n\n')
}
export function textToSections(t: string): AiSection[] {
  const out: AiSection[] = []
  let cur: AiSection | null = null
  for (const raw of t.split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('##')) {
      cur = { heading: line.replace(/^#+\s*/, ''), text: '', items: [] }
      out.push(cur)
      continue
    }
    if (!cur) {
      cur = { heading: '', text: '', items: [] }
      out.push(cur)
    }
    if (/^[-•*]\s+/.test(line)) cur.items.push(line.replace(/^[-•*]\s+/, ''))
    else cur.text = cur.text ? `${cur.text}\n${line}` : line
  }
  return out.filter((s) => s.heading || s.text || s.items.length)
}
