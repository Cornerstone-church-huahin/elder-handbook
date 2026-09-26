import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * อ่านออกเสียงภาษาไทยด้วยระบบของมือถือเอง (Web Speech API) — ฟรี ไม่ใช้บริการอื่น
 * Android: เสียง Google ภาษาไทย · iPhone/iPad: เสียงภาษาไทยของ Apple
 */
export type Rate = 0.75 | 1 | 1.25
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
      return v === 0.75 || v === 1.25 ? v : 1
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

  const speak = useCallback(
    (text: string) => {
      if (!canSpeak()) return setNoVoice(true)
      stop()
      const id = ++run.current
      const parts = chunks(text)
      const voice = thaiVoice()
      setNoVoice(!voice && window.speechSynthesis.getVoices().length > 0)
      setSpeaking(true)
      let i = 0
      const next = () => {
        if (id !== run.current) return
        if (i >= parts.length) return setSpeaking(false)
        const u = new SpeechSynthesisUtterance(parts[i++])
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

  return { speak, stop, speaking, rate, setRate, noVoice, supported: canSpeak() }
}
