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

/** แบ่งเป็นวลีสั้น ๆ (~60 ตัวอักษร ตัดที่ช่องว่าง) — หยุดแล้วฟังต่อจะย้อนไม่เกินหนึ่งวลี และบางเครื่องหยุดอ่านเองเมื่อข้อความยาวเกิน */
function chunks(text: string): string[] {
  const out: string[] = []
  for (const para of text.split(/\n+/).map((x) => x.trim()).filter(Boolean)) {
    let cur = ''
    for (const w of para.split(/(\s+)/)) {
      if ((cur + w).length > 60 && cur.trim()) {
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
  const q = useRef<{ items: Item[]; pos: number; offset: number; onSection?: (id: string) => void } | null>(null)

  const watch = useRef<number | undefined>(undefined)
  const [me0] = useState(() => Symbol('speech'))

  /** หยุดทั้งหมด (ล้างตำแหน่ง) */
  const stop = useCallback(() => {
    run.current++
    q.current = null
    window.clearInterval(watch.current)
    if (canSpeak()) window.speechSynthesis.cancel()
    setSpeaking(false)
    setPaused(false)
  }, [])

  /**
   * อ่านคิวต่อจากตำแหน่งปัจจุบัน — กันปัญหาของมือถือบางรุ่น:
   * · ไม่ส่งสัญญาณ "อ่านจบ" → มีตัวตรวจทุก 0.4 วินาที ถ้าเครื่องเงียบแล้วให้ไปวลีถัดไปเอง
   * · อ่านวลีใดไม่ได้ (error) → ข้ามไปวลีถัดไป ไม่หยุดทั้งหมด
   * · สั่งอ่านทันทีหลังหยุดแล้วเครื่องไม่อ่าน → เว้น 150 มิลลิวินาทีก่อนเริ่ม
   */
  const play = useCallback(() => {
    const cur = q.current
    if (!cur || !canSpeak()) return
    const synth = window.speechSynthesis
    window.dispatchEvent(new CustomEvent('khatha-speech', { detail: me0 })) // ให้ปุ่มฟังอื่นในหน้าหยุดก่อน (อ่านทีละแหล่ง)
    const id = ++run.current
    const voice = thaiVoice()
    setNoVoice(!voice && synth.getVoices().length > 0)
    setSpeaking(true)
    setPaused(false)
    window.clearInterval(watch.current)
    let active: { done: boolean; startedAt: number } | null = null

    const advance = () => {
      if (id !== run.current || !q.current) return
      q.current.pos++
      q.current.offset = 0
      next()
    }
    const next = () => {
      if (id !== run.current || !q.current) return
      const c = q.current
      if (c.pos >= c.items.length) {
        q.current = null
        window.clearInterval(watch.current)
        return setSpeaking(false)
      }
      const it = c.items[c.pos]
      if (it.first && c.offset === 0) c.onSection?.(it.section)
      const start = Math.min(c.offset, it.text.length - 1) // อ่านต่อจากคำที่หยุดไว้ในวลีนี้
      const u = new SpeechSynthesisUtterance(it.text.slice(Math.max(0, start)))
      const me = { done: false, startedAt: Date.now() }
      active = me
      const finish = () => {
        if (me.done || id !== run.current) return
        me.done = true
        advance()
      }
      // จำตำแหน่งคำที่กำลังอ่าน (เครื่องที่รองรับ) เพื่อฟังต่อได้ตรงคำ
      u.onboundary = (e) => {
        if (id !== run.current || me.done) return
        c.offset = Math.max(0, start) + (e.charIndex ?? 0)
      }
      u.lang = 'th-TH'
      if (voice) u.voice = voice
      u.rate = rate
      u.onend = finish
      u.onerror = (e) => {
        if (id !== run.current) return
        if (e.error === 'interrupted' || e.error === 'canceled') return
        finish() // อ่านวลีนี้ไม่ได้ → ข้ามไปวลีถัดไป
      }
      synth.speak(u)
    }
    // ตัวตรวจ: เครื่องเงียบไปแล้วแต่ไม่แจ้งว่าอ่านจบ → ไปต่อเอง
    watch.current = window.setInterval(() => {
      if (id !== run.current) return window.clearInterval(watch.current)
      if (active && !active.done && Date.now() - active.startedAt > 700 && !synth.speaking && !synth.pending) {
        active.done = true
        advance()
      }
    }, 400)
    synth.cancel()
    window.setTimeout(next, 150)
  }, [rate, me0])

  /** หยุดชั่วคราว: จำคำที่กำลังอ่านไว้ กดฟังต่อจะอ่านต่อจากตรงนั้น */
  const pause = useCallback(() => {
    if (!q.current) return
    run.current++
    window.clearInterval(watch.current)
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
      q.current = { items, pos: 0, offset: 0, onSection }
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
    const other = (e: Event) => {
      if ((e as CustomEvent).detail === me0 || !q.current) return
      run.current++
      q.current = null
      window.clearInterval(watch.current)
      setSpeaking(false)
      setPaused(false)
    }
    window.addEventListener('khatha-speech', other)
    if (canSpeak()) window.speechSynthesis.getVoices()
    return () => {
      window.removeEventListener('khatha-speech', other)
      run.current++
      if (q.current && canSpeak()) window.speechSynthesis.cancel()
    }
  }, [me0])

  return { speak, speakSections, stop, pause, resume, speaking, paused, rate, setRate, noVoice, supported: canSpeak() }
}
