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
      if ((cur + w).length > 160 && cur.trim()) {
        out.push(cur.trim())
        cur = ''
      }
      cur += w
    }
    if (cur.trim()) out.push(cur.trim())
  }
  return out
}

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false)
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

  const stop = useCallback(() => {
    run.current++
    if (canSpeak()) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  /** อ่านหลายส่วนต่อเนื่อง (เช่น พระคำ → เรื่องราว → คำอธิษฐาน) · onSection แจ้งเมื่อเริ่มส่วนใหม่ */
  const speakSections = useCallback(
    (sections: { id: string; text: string }[], onSection?: (id: string) => void) => {
      if (!canSpeak()) return setNoVoice(true)
      stop()
      const id = ++run.current
      const queue = sections.flatMap((sec) => chunks(sec.text).map((text, k) => ({ text, section: sec.id, first: k === 0 })))
      if (!queue.length) return
      const voice = thaiVoice()
      setNoVoice(!voice && window.speechSynthesis.getVoices().length > 0)
      setSpeaking(true)
      let i = 0
      const next = () => {
        if (id !== run.current) return
        if (i >= queue.length) return setSpeaking(false)
        const q = queue[i++]
        if (q.first) onSection?.(q.section)
        const u = new SpeechSynthesisUtterance(q.text)
        u.lang = 'th-TH'
        if (voice) u.voice = voice
        u.rate = rate
        u.onend = next
        u.onerror = () => id === run.current && setSpeaking(false)
        window.speechSynthesis.speak(u)
      }
      next()
    },
    [rate, stop],
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

  return { speak, speakSections, stop, speaking, rate, setRate, noVoice, supported: canSpeak() }
}
