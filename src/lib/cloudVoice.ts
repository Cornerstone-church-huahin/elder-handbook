/**
 * เสียงอ่านแบบ "ไฟล์เสียงจริง" ผ่าน Gemini TTS — เล่นด้วย <audio> จึงฟังต่อเนื่องได้แม้จอดับ/ล็อกเครื่อง (เหมือน YouTube)
 * ต่างจาก Web Speech ของมือถือที่ระบบหยุดเมื่อจอดับ · ใช้คีย์ Gemini ที่ใส่ไว้ใน ตั้งค่า › ผู้ช่วย AI (เก็บในเครื่องเท่านั้น)
 * ถ้าไม่มีคีย์ ปิดโหมดนี้ หรือเรียก Gemini ไม่ได้ → ใช้เสียงอ่านของมือถือเหมือนเดิม
 */
import { getAiSettings } from './ai'

const PREF_KEY = 'khatha.cloudVoice.v1'
export const CLOUD_VOICES = [
  { id: 'Kore', label: 'เสียงผู้หญิง (Kore)' },
  { id: 'Aoede', label: 'เสียงผู้หญิง นุ่ม (Aoede)' },
  { id: 'Puck', label: 'เสียงผู้ชาย (Puck)' },
  { id: 'Charon', label: 'เสียงผู้ชาย ทุ้ม (Charon)' },
] as const
export const CLOUD_MODEL = 'gemini-2.5-flash-preview-tts'

type Prefs = { on: boolean; voice: string; model?: string }
export function getCloudPrefs(): Prefs {
  try {
    const v = JSON.parse(localStorage.getItem(PREF_KEY) ?? 'null')
    return { on: true, voice: 'Kore', ...(v ?? {}) }
  } catch {
    return { on: true, voice: 'Kore' }
  }
}
export function setCloudPrefs(p: Partial<Prefs>) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify({ ...getCloudPrefs(), ...p }))
  } catch {
    /* ignore */
  }
}

const geminiKey = () => getAiSettings().keys.gemini?.trim() || ''
/** ใช้เสียงไฟล์ได้เมื่อ: เปิดโหมดไว้ + มีคีย์ Gemini + ยังไม่เคยล้มเหลวในรอบนี้ */
let failedAt = 0
export const cloudAvailable = () => getCloudPrefs().on && !!geminiKey() && typeof Audio !== 'undefined' && Date.now() - failedAt > 60_000
export const hasGeminiKey = () => !!geminiKey()
export function markCloudFailed(msg: string) {
  failedAt = Date.now() // พักโหมดนี้ 1 นาที ใช้เสียงมือถือแทน (กันเรียกซ้ำ ๆ เมื่อคีย์ผิด/โควต้าหมด)
  try {
    localStorage.setItem('khatha.cloudVoice.lastError', msg)
  } catch {
    /* ignore */
  }
}
export const lastCloudError = () => {
  try {
    return localStorage.getItem('khatha.cloudVoice.lastError') ?? ''
  } catch {
    return ''
  }
}

function hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36) + s.length.toString(36)
}

/** PCM 16 บิต โมโน → ไฟล์ WAV */
export function pcmToWav(pcm: Uint8Array<ArrayBuffer>, sampleRate = 24000): Blob {
  const h = new DataView(new ArrayBuffer(44))
  const w = (o: number, t: string) => [...t].forEach((c, i) => h.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF'); h.setUint32(4, 36 + pcm.length, true); w(8, 'WAVEfmt '); h.setUint32(16, 16, true); h.setUint16(20, 1, true)
  h.setUint16(22, 1, true); h.setUint32(24, sampleRate, true); h.setUint32(28, sampleRate * 2, true); h.setUint16(32, 2, true); h.setUint16(34, 16, true)
  w(36, 'data'); h.setUint32(40, pcm.length, true)
  return new Blob([h, pcm], { type: 'audio/wav' })
}

const inflight = new Map<string, Promise<Blob>>()

/** ข้อความ → ไฟล์เสียง (เก็บไว้ในเครื่อง ข้อความเดิมไม่เรียก Gemini ซ้ำ) */
export function synthesize(text: string, signal?: AbortSignal): Promise<Blob> {
  const prefs = getCloudPrefs()
  const model = prefs.model || CLOUD_MODEL
  const key = `https://tts.local/${hash(`${model}|${prefs.voice}|${text}`)}`
  const hit = inflight.get(key)
  if (hit) return hit
  const p = (async () => {
    try {
      const cache = 'caches' in globalThis ? await caches.open('khatha-tts-v1') : null
      const cached = await cache?.match(key)
      if (cached) return await cached.blob()
    } catch {
      /* ไม่มี cache ก็เรียกใหม่ */
    }
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey() },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: prefs.voice } } } },
      }),
      signal,
    })
    if (!r.ok) {
      const d = await r.json().then((j) => j?.error?.message).catch(() => '')
      throw new Error(`Gemini ${r.status}${d ? `: ${String(d).slice(0, 120)}` : ''}`)
    }
    const j = await r.json()
    const b64: string | undefined = j?.candidates?.[0]?.content?.parts?.find((x: { inlineData?: unknown }) => x.inlineData)?.inlineData?.data
    if (!b64) throw new Error('Gemini ไม่ส่งเสียงกลับมา')
    const bin = atob(b64)
    const pcm = new Uint8Array(new ArrayBuffer(bin.length))
    for (let i = 0; i < bin.length; i++) pcm[i] = bin.charCodeAt(i)
    const blob = pcmToWav(pcm)
    try {
      const cache = 'caches' in globalThis ? await caches.open('khatha-tts-v1') : null
      await cache?.put(key, new Response(blob, { headers: { 'content-type': 'audio/wav' } }))
    } catch {
      /* ignore */
    }
    return blob
  })()
  inflight.set(key, p)
  p.catch(() => inflight.delete(key))
  p.then(() => setTimeout(() => inflight.delete(key), 60_000)).catch(() => {})
  return p
}
