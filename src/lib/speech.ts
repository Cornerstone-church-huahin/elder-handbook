import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * อ่านออกเสียงภาษาไทยด้วยระบบของมือถือเอง (Web Speech API) — ฟรี ไม่ใช้บริการอื่น
 * Android: เสียง Google ภาษาไทย · iPhone/iPad: เสียงภาษาไทยของ Apple
 */
/** ความเร็ว 5 ระดับ (ไม่มีเร็ว) — ระดับ 1 ช้ามากเป็นพิเศษสำหรับผู้สูงอายุ */
export const RATES = [
  { rate: 0.4, label: 'ช้าที่สุด' },
  { rate: 0.55, label: 'ช้ามาก' },
  { rate: 0.75, label: 'ช้า' },
  { rate: 0.9, label: 'ช้าเล็กน้อย' },
  { rate: 1, label: 'ปกติ' },
] as const
export type Rate = (typeof RATES)[number]['rate']
const RATE_KEY = 'khatha.speechRate'

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

function thaiVoice(): SpeechSynthesisVoice | null {
  const vs = window.speechSynthesis.getVoices()
  return vs.find((v) => /^th(-|_|$)/i.test(v.lang) && /google/i.test(v.name)) ?? vs.find((v) => /^th(-|_|$)/i.test(v.lang)) ?? null
}

/** "ยอห์น 11:25–26" → "ยอห์น บทที่ 11 ข้อ 25 ถึง 26" ให้ฟังเป็นธรรมชาติ */
export function speakableRef(ref: string): string {
  return ref.replace(/(\d+)\s*:\s*(\d+)(?:\s*[–—-]\s*(\d+))?/g, (_, c, a, b) => `บทที่ ${c} ข้อ ${a}${b ? ` ถึง ${b}` : ''}`)
}

/** แบ่งข้อความยาวเป็นท่อน (~160 ตัวอักษร) เพราะบางเครื่องหยุดอ่านเองเมื่อข้อความยาวเกิน */
function chunks(text: string): string[] {
  const out: string[] = []
  for (const para of text.split(/\n+/).map((x) => x.trim()).filter(Boolean)) {
    let cur = ''
    for (const w of para.split(/(\s+)/)) {
      if ((cur + w).length > 120 && cur.trim()) {
        out.push(cur.trim())
        cur = ''
      }
      cur += w
    }
    if (cur.trim()) out.push(cur.trim())
  }
  return out
}

type Item = { text: string; section: string; first: boolean }

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false)
  const [paused, setPaused] = useState(false)
  const [rate, setRateState] = useState<Rate>(() => {
    try {
      const v = Number(localStorage.getItem(RATE_KEY))
      return (RATES.find((r) => r.rate === v)?.rate ?? (v > 1 ? 1 : 0.75)) as Rate
    } catch {
      return 1
    }
  })
  const [noVoice, setNoVoice] = useState(false)
  const run = useRef(0)
  // คิวที่กำลังอ่าน + ตำแหน่ง (เพื่อหยุดชั่วคราวแล้วอ่านต่อจากจุดเดิม)
  const q = useRef<{ items: Item[]; pos: number; onSection?: (id: string) => void } | null>(null)

  /** หยุดทั้งหมด (ล้างตำแหน่ง) */
  const stop = useCallback(() => {
    run.current++
    q.current = null
    if (canSpeak()) window.speechSynthesis.cancel()
    setSpeaking(false)
    setPaused(false)
  }, [])

  const play = useCallback(() => {
    const cur = q.current
    if (!cur || !canSpeak()) return
    const id = ++run.current
    const voice = thaiVoice()
    setNoVoice(!voice && window.speechSynthesis.getVoices().length > 0)
    setSpeaking(true)
    setPaused(false)
    const next = () => {
      if (id !== run.current || !q.current) return
      const c = q.current
      if (c.pos >= c.items.length) {
        q.current = null
        return setSpeaking(false)
      }
      const it = c.items[c.pos]
      if (it.first) c.onSection?.(it.section)
      const u = new SpeechSynthesisUtterance(it.text)
      u.lang = 'th-TH'
      if (voice) u.voice = voice
      u.rate = rate
      u.onend = () => {
        if (id !== run.current) return
        c.pos++
        next()
      }
      u.onerror = () => id === run.current && setSpeaking(false)
      window.speechSynthesis.speak(u)
    }
    next()
  }, [rate])

  /** หยุดชั่วคราว: จำท่อนที่กำลังอ่านไว้ กดฟังต่อจะอ่านต่อจากท่อนนั้น */
  const pause = useCallback(() => {
    if (!q.current) return
    run.current++
    if (canSpeak()) window.speechSynthesis.cancel()
    setSpeaking(false)
    setPaused(true)
  }, [])
  const resume = useCallback(() => play(), [play])

  /** อ่านหลายส่วนต่อเนื่อง (เช่น พระคำ → เรื่องราว → คำอธิษฐาน) · onSection แจ้งเมื่อเริ่มส่วนใหม่ */
  const speakSections = useCallback(
    (sections: { id: string; text: string }[], onSection?: (id: string) => void) => {
      if (!canSpeak()) return setNoVoice(true)
      stop()
      const items = sections.flatMap((sec) => chunks(sec.text).map((text, k) => ({ text, section: sec.id, first: k === 0 })))
      if (!items.length) return
      q.current = { items, pos: 0, onSection }
      play()
    },
    [play, stop],
  )
  const speak = useCallback((text: string) => speakSections([{ id: '', text }]), [speakSections])

  const setRate = (r: Rate) => {
    setRateState(r)
    try {
      localStorage.setItem(RATE_KEY, String(r))
    } catch {
      /* ignore */
    }
  }

  // โหลดรายชื่อเสียงล่วงหน้า (บางเครื่องโหลดช้า) และหยุดอ่านเมื่อออกจากหน้า
  useEffect(() => {
    if (canSpeak()) window.speechSynthesis.getVoices()
    return () => {
      run.current++
      if (canSpeak()) window.speechSynthesis.cancel()
    }
  }, [])

  return { speak, speakSections, stop, pause, resume, speaking, paused, rate, setRate, noVoice, supported: canSpeak() }
}
