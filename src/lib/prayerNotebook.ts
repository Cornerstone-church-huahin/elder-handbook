import { topicRefs } from '../data/bibleTopics'
import { parseRef } from '../data/bible'
import { useCallback, useEffect, useRef, useState } from 'react'
import { loadSavedPrayers } from '../data/savedPrayers'
import { blockIfViewer } from './access'
import { getSync, pullRemote, pushRemote, type SyncStatus } from './sync'
import { autoTags, tagsForQuery } from './autoTags'

/**
 * สมุดคำอธิษฐาน — ผู้ปกครองเพิ่ม แก้ไข ลบได้เอง
 * แต่ละคำอธิษฐานมี 4 ส่วน: พระคำ (4 ข้อ) · เรื่องราวบุคคล · คำอธิษฐาน · หนุนใจ (+ บันทึก)
 * เก็บในเครื่องเสมอ (ใช้ออฟไลน์ได้) และถ้าตั้งค่า "ใช้ร่วมกันออนไลน์" ไว้ จะซิงก์กับ repo ส่วนตัวบน GitHub ทันทีที่บันทึก
 */
export interface NotePrayer {
  id: string
  title: string
  category: string
  icon: string
  refs: string[] // ข้อพระคำ 0–4 ข้อ เช่น ["ยอห์น 11:25", "สดุดี 34:18"]
  story: string // เรื่องราวบุคคลในพระคัมภีร์ที่เกี่ยวข้อง
  text: string // คำอธิษฐาน
  notes: string // บันทึกของผู้ปกครอง
  cheer: string // คำหนุนใจท้ายคำอธิษฐาน (ว่าง = สร้างให้อัตโนมัติ)
  keywords: string[]
  updated: number
  by?: string
  deleted?: boolean // ลบแล้ว (เก็บไว้เพื่อให้เครื่องอื่นรู้ว่าถูกลบ)
}
export type NoteInput = Pick<NotePrayer, 'title' | 'category' | 'refs' | 'story' | 'text' | 'notes'> & { cheer?: string }

const KEY = 'khatha.prayerbook.v2'
const OLD_KEY = 'khatha.prayerbook.v1'

/** แปลงข้อมูลเก่า/จากเครื่องอื่นให้ครบทุกช่อง */
export function normalize(x: Partial<NotePrayer> & { ref?: string }): NotePrayer {
  return {
    id: String(x.id),
    title: x.title ?? '',
    category: x.category ?? '',
    icon: x.icon ?? '🙏',
    refs: (Array.isArray(x.refs) ? x.refs : x.ref ? [x.ref] : []).filter(Boolean).slice(0, 4),
    story: x.story ?? '',
    text: x.text ?? '',
    notes: x.notes ?? '',
    cheer: x.cheer ?? '',
    keywords: Array.isArray(x.keywords) ? x.keywords : [],
    updated: Number(x.updated) || 0,
    by: x.by,
    deleted: !!x.deleted,
  }
}

function read(): NotePrayer[] | null {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY)
    if (!raw) return null
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x) => x && typeof x.text === 'string').map(normalize) : null
  } catch {
    return null
  }
}
function write(list: NotePrayer[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
    localStorage.removeItem(OLD_KEY)
    return true
  } catch {
    return false
  }
}

// พระคำข้อที่ 2 และเรื่องราวบุคคล สำหรับคำอธิษฐานตั้งต้น (ถ้อยคำของผู้จัดทำ — ข้อความพระคัมภีร์แสดงจากฉบับ 1971)
const SEED_EXTRA: Record<string, { refs: string[]; story: string }> = {
  offering: {
    refs: ['1 พงศาวดาร 29:14', '2 โครินธ์ 9:7', 'มาลาคี 3:10', 'สุภาษิต 3:9–10'],
    story:
      'ดาวิดกับการถวายเพื่อสร้างพระวิหาร (1 พงศาวดาร 29)\n\nในบั้นปลายชีวิต ดาวิดเตรียมการสร้างพระวิหารให้พระเจ้า ท่านถวายทรัพย์ส่วนตัวก่อน แล้วบรรดาผู้นำและประชาชนก็พากันถวายด้วยใจยินดี ดาวิดจึงยืนขึ้นสรรเสริญพระเจ้าต่อหน้าที่ประชุม และยอมรับว่าทุกสิ่งที่ถวายล้วนมาจากพระหัตถ์ของพระองค์\n\nเชื่อมกับวันนี้: เหมือนประชาชนในสมัยดาวิด เราถวายด้วยความเต็มใจ ไม่ว่ามากหรือน้อย เพราะเรากำลังถวายคืนสิ่งที่เป็นของพระองค์อยู่แล้ว และพระเจ้าทรงรักผู้ที่ให้ด้วยใจยินดี',
  },
  meal: {
    refs: ['ยอห์น 6:11', '1 ทิโมธี 4:4–5', 'มัทธิว 6:11', 'สดุดี 145:15–16'],
    story:
      'พระเยซูทรงเลี้ยงคนห้าพันคน (ยอห์น 6:1–13)\n\nฝูงชนติดตามพระเยซูมาในที่เปลี่ยว มีเด็กคนหนึ่งมีขนมปังห้าก้อนกับปลาสองตัว พระเยซูทรงรับไว้ โมทนาพระคุณ แล้วแจกจนทุกคนอิ่ม และยังเหลืออีกสิบสองกระบุง\n\nเชื่อมกับวันนี้: ทุกคนที่อยู่รอบโต๊ะนี้ได้รับการเลี้ยงดูจากพระเยซูองค์เดียวกัน เราจึงขอบพระคุณก่อนรับประทาน เหมือนที่พระองค์ทรงโมทนาพระคุณก่อนแจกอาหาร และอาหารที่รับด้วยการขอบพระคุณก็ถูกชำระโดยพระวจนะและคำอธิษฐาน',
  },
  finance: {
    refs: ['ฟีลิปปี 4:19', 'มัทธิว 6:33', 'สุภาษิต 3:5–6', 'ฮีบรู 13:5'],
    story:
      'หญิงม่ายที่ศาเรฟัทกับเอลียาห์ (1 พงศ์กษัตริย์ 17:8–16)\n\nในยามกันดารอาหาร หญิงม่ายเหลือแป้งเพียงกำมือเดียวกับน้ำมันนิดหน่อย เอลียาห์ขอให้เธอทำขนมให้ท่านก่อน เธอเชื่อฟังพระวจนะ และแป้งในหม้อกับน้ำมันในไหก็ไม่หมดจนผ่านพ้นความแห้งแล้ง\n\nเชื่อมกับวันนี้: เมื่อเรานำภาระการเงินมาวางต่อพระเจ้าและให้พระองค์เป็นที่หนึ่ง พระองค์ทรงสัตย์ซื่อที่จะจัดเตรียมสิ่งจำเป็นให้ทีละวัน เหมือนที่ทรงเลี้ยงดูครอบครัวของหญิงม่ายทุกวัน',
  },
}

async function seed(): Promise<NotePrayer[]> {
  try {
    const d = await loadSavedPrayers()
    const cat = new Map(d.categories.map((c) => [c.id, c]))
    return d.prayers.map((p) =>
      normalize({
        id: p.id,
        title: p.subtitle ? `${p.title} · ${p.subtitle}` : p.title,
        category: cat.get(p.category)?.title ?? '',
        icon: cat.get(p.category)?.icon ?? '🙏',
        refs: SEED_EXTRA[p.category]?.refs ?? (p.ref ? [p.ref] : []),
        story: SEED_EXTRA[p.category]?.story ?? '',
        text: p.text,
        keywords: [],
        updated: 0,
      }),
    ).map((x, i) => ({ ...x, keywords: [...new Set([...autoTags(x), ...d.prayers[i].keywords])].slice(0, 10) }))
  } catch {
    return []
  }
}

/** รวมรายการจากสองแหล่ง: ตาม id ใหม่กว่าชนะ (รวมการลบ) */
export function mergeLists(a: NotePrayer[], b: NotePrayer[]): NotePrayer[] {
  const m = new Map<string, NotePrayer>()
  for (const x of [...a, ...b]) {
    const cur = m.get(x.id)
    if (!cur || x.updated > cur.updated) m.set(x.id, x)
  }
  return [...m.values()].sort((x, y) => y.updated - x.updated)
}

/** อ่านสมุด (ครั้งแรกใช้คำอธิษฐานตั้งต้น) — ใช้ในหน้าค้นหา */
export async function loadNotebook(): Promise<NotePrayer[]> {
  return ((read() ?? (await seed())) as NotePrayer[]).filter((x) => !x.deleted)
}

const ICONS: [RegExp, string][] = [
  [/ถวาย|ทรัพย์|ทศางค์/, '💰'], [/อาหาร|ข้าว|มื้อ/, '🍞'], [/เงิน|หนี้|งาน/, '🔓'], [/ป่วย|ผ่าตัด|รักษา|โรงพยาบาล/, '🏥'],
  [/เสียชีวิต|ศพ|สูญเสีย/, '🕊️'], [/ครอบครัว|ลูก|สามี|ภรรยา|แต่งงาน/, '👨‍👩‍👧'], [/เด็ก|อวยพร/, '🙌'], [/นมัสการ|ประชุม|เปิด|ปิด/, '⛪'],
]
export const iconFor = (s: string) => ICONS.find(([re]) => re.test(s))?.[1] ?? '🙏'

/** คะแนนความตรงกับคำค้น: ชื่อ > คำสำคัญ > หมวด > ข้อพระคำ/เรื่องราว/เนื้อความ/บันทึก */
export function scoreNote(p: NotePrayer, query: string): number {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return 0
  const title = p.title.toLowerCase()
  const cat = p.category.toLowerCase()
  const kw = p.keywords.join(' ').toLowerCase()
  const body = [p.refs.join(' '), p.story, p.text, p.notes].join(' ').toLowerCase()
  let score = 0
  for (const t of terms) {
    if (title.includes(t)) score += 6
    if (kw.includes(t) || p.keywords.some((k) => t.includes(k.toLowerCase())) || tagsForQuery(t).some((g) => p.keywords.includes(g))) score += 4
    if (cat.includes(t)) score += 3
    if (body.includes(t)) score += 1
  }
  return score
}

export function usePrayerNotebook() {
  const [all, setAll] = useState<NotePrayer[] | null>(read)
  const [saved, setSaved] = useState(true)
  const [sync, setSync] = useState<SyncStatus>(getSync() ? { state: 'idle' } : { state: 'off' })
  const latest = useRef<NotePrayer[] | null>(all)
  latest.current = all
  const pushTimer = useRef<number | undefined>(undefined)

  const setLocal = useCallback((next: NotePrayer[]) => {
    latest.current = next
    setAll(next)
    setSaved(write(next))
  }, [])

  /** ดึงจากออนไลน์แล้วรวมกับในเครื่อง ถ้าในเครื่องมีของใหม่กว่าก็ส่งขึ้นไป */
  const syncNow = useCallback(async () => {
    const cfg = getSync()
    if (!cfg) return setSync({ state: 'off' })
    setSync({ state: 'syncing' })
    try {
      const local = latest.current ?? (await seed())
      const remote = await pullRemote(cfg)
      const merged = mergeLists(local, remote.items)
      setLocal(merged)
      const localNewer = merged.some((x) => {
        const r = remote.items.find((y) => y.id === x.id)
        return !r || x.updated > r.updated
      })
      if (localNewer || !remote.exists) await pushRemote(cfg, merged, remote.sha)
      setSync({ state: 'ok', at: Date.now() })
    } catch (e) {
      setSync({ state: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }, [setLocal])

  useEffect(() => {
    // ครั้งแรกใช้คำอธิษฐานตั้งต้น · ของเดิมจากรุ่นก่อนเติมพระคำข้อ 2 และเรื่องราวให้ (เฉพาะช่องที่ยังว่าง)
    seed().then((s) => {
      const cur = latest.current
      if (!cur) return setLocal(s)
      const byId = new Map(s.map((x) => [x.id, x]))
      let changed = false
      const next = cur.map((x) => {
        const d = byId.get(x.id)
        if (!d) {
          if (x.keywords.length) return x
          changed = true
          return { ...x, keywords: autoTags(x) } // ของที่เพิ่มเองในรุ่นก่อน: เติมแท็ก
        }
        if (x.updated === 0) {
          // ยังไม่เคยแก้ไข: ใช้ฉบับตั้งต้นล่าสุด (แท็กที่ปรับปรุงแล้ว)
          if (JSON.stringify(x.keywords) === JSON.stringify(d.keywords) && x.story === d.story) return x
          changed = true
          return d
        }
        if (x.story && x.refs.length >= 4 && x.keywords.length) return x
        changed = true
        const up = { ...x, story: x.story || d.story, refs: x.refs.length >= 4 ? x.refs : [...new Set([...x.refs, ...d.refs])].slice(0, 4) }
        return { ...up, keywords: [...new Set([...autoTags(up), ...x.keywords])].slice(0, 10) }
      })
      if (changed) setLocal(next)
    })
    syncNow()
    const onFocus = () => document.visibilityState === 'visible' && syncNow()
    document.addEventListener('visibilitychange', onFocus)
    const t = window.setInterval(syncNow, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.clearInterval(t)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const commit = useCallback(
    (next: NotePrayer[]) => {
      if (blockIfViewer()) return // ดูและฟังอย่างเดียว: เพิ่ม/แก้/ลบไม่ได้
      setLocal(next)
      if (getSync()) {
        setSync({ state: 'syncing' })
        window.clearTimeout(pushTimer.current)
        pushTimer.current = window.setTimeout(syncNow, 600) // ส่งขึ้นออนไลน์ทันทีหลังบันทึก
      }
    },
    [setLocal, syncNow],
  )

  const base = all ?? []
  const who = getSync()?.name
  return {
    list: all ? all.filter((x) => !x.deleted) : null,
    saved,
    sync,
    syncNow,
    add: (p: NoteInput) => {
      const item = normalize({ ...p, keywords: autoTags(p), id: `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, icon: iconFor(`${p.category} ${p.title}`), updated: Date.now(), by: who })
      commit([item, ...base])
      return item.id
    },
    update: (id: string, p: Partial<NoteInput>) =>
      commit(base.map((x) => (x.id === id ? normalize({ ...x, ...p, keywords: autoTags({ ...x, ...p }), icon: iconFor(`${p.category ?? x.category} ${p.title ?? x.title}`) === '🙏' ? x.icon : iconFor(`${p.category ?? x.category} ${p.title ?? x.title}`), updated: Date.now(), by: who }) : x))),
    remove: (id: string) => commit(base.map((x) => (x.id === id ? { ...x, deleted: true, updated: Date.now(), by: who } : x))),
    /** นำคำอธิษฐานตั้งต้นที่เคยลบกลับมา */
    restoreDefaults: async () => {
      const s = await seed()
      const ids = new Set(s.map((x) => x.id))
      const have = new Map(base.map((x) => [x.id, x]))
      const back = s.filter((x) => !have.get(x.id) || have.get(x.id)!.deleted).map((x) => ({ ...x, updated: Date.now() }))
      commit([...base.filter((x) => !(ids.has(x.id) && x.deleted)), ...back])
    },
  }
}

/** ตัดคำนำหน้า "[เรื่องราว: …]" ออก (แท็บชื่อ "เรื่องราว" อยู่แล้ว ไม่ต้องอ่านซ้ำ) → เหลือชื่อเรื่อง เช่น "องค์พระเยซูคริสต์กับการอธิษฐานแต่เช้ามืด" */
export function cleanStory(t: string): string {
  return (t ?? '').replace(/^\s*\[?\s*เรื่องราว\s*[:：]\s*([^\]\n]*?)\s*\]?\s*(\n|$)/, (_m, title: string, nl: string) => (title ? title + nl : ''))
}

/**
 * พระคำครบ 4 ข้อ: ข้อที่ผู้ใช้ใส่เอง + ข้อที่นิยมใช้และเกี่ยวข้องที่สุด (คัดไว้ตามหัวข้อ ตรวจกับฉบับ 1971 แล้ว)
 * เลือกเฉพาะข้อสั้น (ไม่เกิน 3 ข้อต่อตอน) เพื่อใช้ในคำอธิษฐาน
 */
export function refsWithSuggest(p: Pick<NotePrayer, 'refs' | 'title' | 'category' | 'story' | 'text'>, max = 4): { refs: string[]; suggested: string[] } {
  const own = p.refs.filter((r) => parseRef(r)).slice(0, max)
  if (own.length >= max) return { refs: own, suggested: [] }
  const key = (r: string) => parseRef(r)?.label ?? r
  const have = new Set(own.map(key))
  const short = (r: string) => {
    const x = parseRef(r)
    return !!x && x.verses.length > 0 && x.verses.length <= 3
  }
  const pick: string[] = []
  // หัวข้อและหมวดสำคัญกว่าเนื้อความ
  for (const text of [`${p.title} ${p.category}`, `${p.title} ${p.category} ${p.story} ${p.text}`]) {
    for (const r of topicRefs(text, 30)) {
      if (own.length + pick.length >= max) break
      if (short(r) && !have.has(key(r))) { have.add(key(r)); pick.push(r) }
    }
  }
  return { refs: [...own, ...pick], suggested: pick }
}
