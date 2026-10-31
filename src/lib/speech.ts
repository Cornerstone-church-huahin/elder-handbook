import { useCallback, useEffect, useRef, useState } from 'react'
import { applyPron, getVoicePrefs } from './voicePrefs'
import { cloudAvailable, markCloudFailed, synthesize } from './cloudVoice'

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

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const vs = window.speechSynthesis.getVoices()
  const want = getVoicePrefs()[lang.startsWith('th') ? 'th' : 'en'] // เสียงที่เลือกไว้ในหน้าตั้งค่า
  const chosen = want && vs.find((v) => v.voiceURI === want)
  if (chosen) return chosen
  const re = new RegExp(`^${lang.slice(0, 2)}(-|_|$)`, 'i')
  const exact = new RegExp(`^${lang.replace('-', '[-_]')}$`, 'i')
  return vs.find((v) => exact.test(v.lang) && /google/i.test(v.name)) ?? vs.find((v) => exact.test(v.lang)) ?? vs.find((v) => re.test(v.lang)) ?? null
}

/** "ยอห์น 11:25–26" → "ยอห์น บทที่ 11 ข้อ 25 ถึง 26" ให้ฟังเป็นธรรมชาติ */
export function speakableRef(ref: string): string {
  return ref.replace(/(\d+)\s*:\s*(\d+)(?:\s*[–—-]\s*(\d+))?/g, (_, c, a, b) => `บทที่ ${c} ข้อ ${a}${b ? ` ถึง ${b}` : ''}`)
}

/**
 * ข้อความที่ส่งให้เครื่องอ่านอาจไม่ตรงกับที่แสดงบนจอ (ข้ออ้างอิง "28:19" → "บทที่ 28 ข้อ 19", คำอ่านที่แก้ไว้)
 * จับคู่ตัวอักษรของสองข้อความ (LCS) เพื่อแปลงตำแหน่งคำที่เครื่องกำลังอ่าน กลับเป็นตำแหน่งบนจอ ให้ไฮไลต์วิ่งตรงคำ
 */
export function alignMap(shown: string, said: string): number[] {
  const n = shown.length, m = said.length
  if (shown === said) return Array.from({ length: m + 1 }, (_, i) => i)
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = shown[i] === said[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const map = new Array<number>(m + 1).fill(-1)
  let i = 0, j = 0
  while (i < n && j < m) {
    if (shown[i] === said[j]) { map[j] = i; i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++
    else { map[j] = i; j++ } // ตัวอักษรที่เพิ่มเข้ามาตอนอ่าน → ชี้ไปที่ตำแหน่งบนจอที่กำลังจะถึง
  }
  for (; j <= m; j++) map[j] = Math.min(i, n)
  return map.map((x) => Math.max(0, Math.min(x, Math.max(0, n - 1))))
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


/**
 * เล่นต่อเมื่อพับจอ/ปิดหน้าจอ (ลองทำให้ดีที่สุด): เบราว์เซอร์มือถือมักหยุดเสียงอ่านเมื่อแอปไปอยู่เบื้องหลัง
 * จึงเปิดเสียงเงียบวนไว้ + แจ้งระบบว่า "กำลังเล่นสื่อ" (Media Session) เพื่อไม่ให้ระบบพักแอป
 */
let keep: HTMLAudioElement | null = null
let lock: { release: () => Promise<void> } | null = null
let lockWanted = false
/** กันจอดับระหว่างฟัง (เครื่องที่รองรับ) · ถ้าผู้ใช้กดล็อกเครื่องเอง ระบบปล่อยล็อกให้ แล้วเสียงเงียบ+Media Session ทำหน้าที่ต่อ */
function wakeLock(on: boolean) {
  lockWanted = on
  const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
  if (!on) {
    lock?.release().catch(() => {})
    lock = null
    return
  }
  if (lock || !nav.wakeLock) return
  nav.wakeLock.request('screen').then((l) => (lock = l)).catch(() => {})
}
// กลับมาที่แอป: ขอ Wake Lock ใหม่ (ระบบปล่อยทุกครั้งที่จอดับ) · ออกไปเบื้องหลัง: ตรวจว่าเสียงเงียบยังเล่นอยู่
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!lockWanted) return
    if (document.visibilityState === 'visible') {
      lock = null
      wakeLock(true)
    }
    if (keep?.paused) void keep.play().catch(() => {})
  })
}
function keepAlive(on: boolean, ctl?: { pause: () => void; resume: () => void; stop: () => void }) {
  try {
    wakeLock(on)
    if (!on) {
      keep?.pause()
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none'
      return
    }
    if (!keep) {
      const n = 8000, buf = new DataView(new ArrayBuffer(44 + n * 2))
      const w = (o: number, t: string) => [...t].forEach((c, i) => buf.setUint8(o + i, c.charCodeAt(0)))
      w(0, 'RIFF'); buf.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); buf.setUint32(16, 16, true); buf.setUint16(20, 1, true)
      buf.setUint16(22, 1, true); buf.setUint32(24, 8000, true); buf.setUint32(28, 16000, true); buf.setUint16(32, 2, true); buf.setUint16(34, 16, true)
      w(36, 'data'); buf.setUint32(40, n * 2, true)
      // เสียงต่ำ 25 Hz เบามาก (ใต้ระดับที่หูได้ยิน แต่ระบบนับว่า "มีเสียงเล่นอยู่" ต่างจากค่าศูนย์/±1 ที่ Chrome ถือว่าเงียบแล้วพักแอปตอนจอดับ)
      for (let i = 0; i < n; i++) buf.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * 25 * i) / 8000) * 400), true)
      keep = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })))
      keep.loop = true
      keep.volume = 0.05 // ลดระดับลงอีก (หูไม่ได้ยิน)
    }
    void keep.play().catch(() => {})
    if ('mediaSession' in navigator) {
      const ms = navigator.mediaSession
      ms.metadata = new MediaMetadata({ title: 'กำลังอ่านออกเสียง', artist: 'คู่มือผู้ปกครอง' })
      ms.playbackState = 'playing'
      if (ctl) {
        ms.setActionHandler('pause', ctl.pause)
        ms.setActionHandler('play', ctl.resume)
        ms.setActionHandler('stop', ctl.stop)
      }
    }
  } catch { /* ignore */ }
}


/** ตัวเล่นไฟล์เสียง (ใช้ element เดียวตลอด เพื่อให้ระบบนับเป็น "กำลังเล่นสื่อ" ต่อเนื่องแม้จอดับ) */
let cloudEl: HTMLAudioElement | null = null
let cloudUrl = ''
const cloudAudio = () => (cloudEl ??= new Audio())
function playClip(blob: Blob, rate: number, onTime: (frac: number) => void, onCancel: (cancel: () => void) => void): Promise<'end' | 'stop' | 'error'> {
  const a = cloudAudio()
  if (cloudUrl) URL.revokeObjectURL(cloudUrl)
  cloudUrl = URL.createObjectURL(blob)
  a.src = cloudUrl
  a.playbackRate = Math.max(0.5, rate) // ต่ำกว่า 0.5 บางเครื่องไม่มีเสียง
  a.preservesPitch = true
  return new Promise((res) => {
    const done = (r: 'end' | 'stop' | 'error') => {
      a.onended = a.onerror = a.ontimeupdate = null
      res(r)
    }
    a.onended = () => done('end')
    a.onerror = () => done('error')
    a.ontimeupdate = () => a.duration > 0 && onTime(a.currentTime / a.duration)
    onCancel(() => done('stop'))
    a.play().catch(() => done('error'))
  })
}

type Item = { text: string; section: string; first: boolean; base: number; say?: (s: string) => string }
export type SpeechSection = { id: string; text: string; say?: (s: string) => string }

/** lang: 'th-TH' (ค่าเริ่มต้น) หรือ 'en-US' สำหรับฉบับภาษาอังกฤษ */
export function useSpeech(lang = 'th-TH') {
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
  const q = useRef<{ items: Item[]; pos: number; offset: number; onSection?: (id: string) => void; onWord?: (id: string, at: number, end: number) => void } | null>(null)

  const pauseRef = useRef<() => void>(() => {})
  const playRef = useRef<() => void>(() => {})
  const stopRef = useRef<() => void>(() => {})
  const watch = useRef<number | undefined>(undefined)
  const [me0] = useState(() => Symbol('speech'))
  const loop = useRef(false)
  const cloud = useRef<{ paused: boolean; cancel?: () => void } | null>(null) // เล่นแบบไฟล์เสียงอยู่
  const [looping, setLoopState] = useState(false)
  const setLoop = (v: boolean) => {
    loop.current = v
    setLoopState(v)
  }

  const stopCloud = () => {
    if (!cloud.current) return
    cloudEl?.pause()
    cloud.current.cancel?.()
    cloud.current = null
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none'
  }

  /** หยุดทั้งหมด (ล้างตำแหน่ง) */
  const stop = useCallback(() => {
    run.current++
    q.current = null
    window.clearInterval(watch.current)
    if (canSpeak()) window.speechSynthesis.cancel()
    keepAlive(false)
    stopCloud()
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
    if (!cur) return
    // ฟังต่อหลังหยุดชั่วคราว (แบบไฟล์เสียง): เล่นต่อจากวินาทีเดิม
    if (cloud.current?.paused) {
      cloud.current.paused = false
      void cloudEl?.play().catch(() => {})
      setSpeaking(true)
      setPaused(false)
      return
    }
    if (cloudAvailable() && !cloud.current) {
      window.dispatchEvent(new CustomEvent('khatha-speech', { detail: me0 }))
      const id = ++run.current
      stopCloud()
      cloud.current = { paused: false }
      setNoVoice(false)
      setSpeaking(true)
      setPaused(false)
      if ('mediaSession' in navigator) {
        const ms = navigator.mediaSession
        ms.metadata = new MediaMetadata({ title: 'กำลังอ่านออกเสียง', artist: 'คู่มือผู้ปกครอง' })
        ms.playbackState = 'playing'
        ms.setActionHandler('pause', () => pauseRef.current())
        ms.setActionHandler('play', () => playRef.current())
        ms.setActionHandler('stop', () => stopRef.current())
      }
      void (async () => {
        const GROUP = 220 // รวมวลีสั้น ๆ เป็นก้อนละไม่เกิน ~220 ตัวอักษร (เรียก Gemini น้อยครั้ง ไหลลื่นกว่า)
        const group = (c: NonNullable<typeof q.current>, pos: number) => {
          const its: Item[] = []
          let len = 0
          for (let k = pos; k < c.items.length; k++) {
            const it = c.items[k]
            if (its.length && (it.section !== its[0].section || len + it.text.length > GROUP)) break
            its.push(it)
            len += it.text.length
          }
          const parts = its.map((it, k) => {
            const rest = k === 0 && c.offset > 0 ? it.text.slice(Math.min(c.offset, it.text.length - 1)) : it.text
            const said0 = it.say ? it.say(rest) : rest
            return lang.startsWith('th') ? applyPron(said0) : said0
          })
          return { its, text: parts.join(' '), lens: its.map((it) => it.text.length), len }
        }
        try {
          let c = q.current
          let pending: { pos: number; text: string; p: Promise<Blob> } | null = null
          while (id === run.current && c) {
            if (c.pos >= c.items.length && loop.current) {
              c.pos = 0
              c.offset = 0
            }
            if (c.pos >= c.items.length) break
            const g = group(c, c.pos)
            const mine = pending && pending.pos === c.pos && pending.text === g.text ? pending.p : synthesize(g.text)
            const after = c.pos + g.its.length
            const ng = after < c.items.length ? group({ ...c, offset: 0 }, after) : null
            pending = ng ? { pos: after, text: ng.text, p: synthesize(ng.text) } : null // โหลดก้อนถัดไปล่วงหน้า ระหว่างฟังก้อนนี้
            pending?.p.catch(() => {})
            if (g.its[0].first && c.offset === 0) c.onSection?.(g.its[0].section)
            const blob = await mine
            if (id !== run.current) return
            const total = g.lens.reduce((a, b) => a + b, 0) || 1
            const r = await playClip(blob, rate, (frac) => {
              // ไฮไลต์ตามเวลาโดยประมาณ: เสียงก้อนนี้อ่านไปกี่ส่วน → ตรงกับวลีไหน/ตำแหน่งไหน
              let at = frac * total
              for (let k = 0; k < g.its.length; k++) {
                if (at <= g.lens[k] || k === g.its.length - 1) {
                  const it = g.its[k]
                  c!.onWord?.(it.section, it.base + Math.min(it.text.length - 1, Math.floor(Math.max(0, at))), it.base + it.text.length)
                  break
                }
                at -= g.lens[k]
              }
            }, (cancel) => {
              if (cloud.current) cloud.current.cancel = cancel
            })
            if (id !== run.current || r === 'stop') return
            if (r === 'error') throw new Error('เล่นไฟล์เสียงไม่ได้')
            c.pos = after
            c.offset = 0
            c = q.current
          }
          if (id === run.current) {
            q.current = null
            stopCloud()
            setSpeaking(false)
          }
        } catch (e) {
          if (id !== run.current) return
          // เรียก Gemini ไม่ได้ (คีย์ผิด โควต้าหมด ไม่มีเน็ต) → ใช้เสียงอ่านของมือถือต่อจากจุดเดิม
          markCloudFailed(e instanceof Error ? e.message : String(e))
          stopCloud()
          playRef.current()
        }
      })()
      return
    }
    if (!canSpeak()) return
    const synth = window.speechSynthesis
    window.dispatchEvent(new CustomEvent('khatha-speech', { detail: me0 })) // ให้ปุ่มฟังอื่นในหน้าหยุดก่อน (อ่านทีละแหล่ง)
    const id = ++run.current
    const voice = pickVoice(lang)
    setNoVoice(!voice && synth.getVoices().length > 0)
    setSpeaking(true)
    setPaused(false)
    keepAlive(true, { pause: () => pauseRef.current(), resume: () => playRef.current(), stop: () => stopRef.current() })
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
      if (c.pos >= c.items.length && loop.current) {
        c.pos = 0 // เล่นวนซ้ำ
        c.offset = 0
      }
      if (c.pos >= c.items.length) {
        q.current = null
        window.clearInterval(watch.current)
        keepAlive(false)
        return setSpeaking(false)
      }
      const it = c.items[c.pos]
      if (it.first && c.offset === 0) c.onSection?.(it.section)
      const start = Math.min(c.offset, it.text.length - 1) // อ่านต่อจากคำที่หยุดไว้ในวลีนี้
      const endAt = it.base + it.text.length
      c.onWord?.(it.section, it.base + Math.max(0, start), endAt) // ไฮไลต์วลีที่กำลังอ่าน
      const rest = it.text.slice(Math.max(0, start))
      const said0 = it.say ? it.say(rest) : rest
      const said = lang.startsWith('th') ? applyPron(said0) : said0 // แก้คำที่เครื่องอ่านผิด
      const toShown = alignMap(rest, said) // ตำแหน่งในเสียง → ตำแหน่งบนจอ
      const u = new SpeechSynthesisUtterance(said)
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
        const ci = Math.max(0, Math.min(e.charIndex ?? 0, said.length))
        c.offset = Math.min(it.text.length - 1, Math.max(0, start) + (toShown[ci] ?? 0))
        c.onWord?.(it.section, it.base + c.offset, endAt) // ไฮไลต์คำที่กำลังอ่าน (เครื่องที่รองรับ)
      }
      u.lang = lang
      if (voice) u.voice = voice
      u.rate = rate
      u.pitch = getVoicePrefs().pitch
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
  }, [rate, me0, lang])

  /** หยุดชั่วคราว: จำคำที่กำลังอ่านไว้ กดฟังต่อจะอ่านต่อจากตรงนั้น */
  const pause = useCallback(() => {
    if (!q.current) return
    if (cloud.current) {
      cloud.current.paused = true
      cloudEl?.pause()
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused'
      setSpeaking(false)
      setPaused(true)
      return
    }
    run.current++
    window.clearInterval(watch.current)
    if (canSpeak()) window.speechSynthesis.cancel()
    keepAlive(false)
    setSpeaking(false)
    setPaused(true)
  }, [])
  const resume = useCallback(() => play(), [play])
  pauseRef.current = pause
  playRef.current = resume
  stopRef.current = stop

  /** อ่านหลายส่วนต่อเนื่อง (เช่น พระคำ → เรื่องราว → คำอธิษฐาน) · onSection แจ้งเมื่อเริ่มส่วนใหม่ */
  const speakSections = useCallback(
    (sections: SpeechSection[], onSection?: (id: string) => void, onWord?: (id: string, at: number, end: number) => void, from?: { id: string; at: number }) => {
      if (!canSpeak()) return setNoVoice(true)
      stop()
      const items = sections.flatMap((sec) => {
        let cur = 0
        return chunks(sec.text).map((text, k) => {
          const at = sec.text.indexOf(text, cur)
          const base = at >= 0 ? at : cur
          cur = base + text.length
          return { text, section: sec.id, first: k === 0, base, say: sec.say }
        })
      })
      if (!items.length) return
      // เริ่มจากจุดที่แตะ: หาวลีที่มีตำแหน่งนั้น แล้วอ่านต่อจากตรงนั้น
      let pos = 0
      let offset = 0
      if (from) {
        const k = items.findIndex((x) => x.section === from.id && x.base + x.text.length > from.at)
        if (k >= 0) {
          pos = k
          offset = Math.max(0, from.at - items[k].base)
          if (offset > 0) onSection?.(items[k].section)
        }
      }
      q.current = { items, pos, offset, onSection, onWord }
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
      stopCloud()
      setSpeaking(false)
      setPaused(false)
    }
    window.addEventListener('khatha-speech', other)
    if (canSpeak()) window.speechSynthesis.getVoices()
    return () => {
      window.removeEventListener('khatha-speech', other)
      run.current++
      if (q.current && canSpeak()) window.speechSynthesis.cancel()
      if (q.current) keepAlive(false)
      stopCloud()
    }
  }, [me0])

  return { speak, speakSections, stop, pause, resume, speaking, paused, rate, setRate, noVoice, supported: canSpeak(), looping, setLoop }
}
