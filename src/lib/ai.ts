/**
 * ชั้น AI ของคู่มือผู้ปกครองคริสตจักร
 *
 * หน้าจอเรียกผ่าน getAiProvider() เท่านั้น ไม่ผูกกับผู้ให้บริการ AI รายใด
 * - เปิดผ่าน Claude (พรีวิว): ใช้ Claude ของผู้เปิดดู (capability "sample")
 * - เว็บจริง (GitHub Pages): เรียก Claude API โดยตรง ด้วยคีย์ที่ผู้ใช้ใส่ในหน้าตั้งค่า (เก็บในเครื่อง)
 * - ไม่มี AI: หน้าอธิษฐานใช้ prayerLocal.ts สร้างคำอธิษฐานจากข้อมูลในแอปแทน
 */
import { buildKitPrompt } from './aiPrompt'

export interface AiKit {
  title: string
  understanding: string
  openers: string[]
  questions: string[]
  avoid_saying: { say: string; why: string }[]
  scripture_refs: { ref: string; theme: string }[]
  bible_characters: { name: string; connection: string }[]
  prayers: { short: string; full: string; intercession: string }
  next_steps: string[]
  encouragement: string
  safety: { level: 'none' | 'refer' | 'urgent'; note: string }
}

export interface AiCallOptions {
  signal: AbortSignal
  onProgress?: (chars: number) => void
  /** เก็บคำตอบเดิมไว้ใช้ซ้ำกี่ชั่วโมง (0 = ถามใหม่ทุกครั้ง) */
  cacheHours?: number
}

export interface AiProvider {
  generateKit(topic: string, opts: AiCallOptions, roster?: string[]): Promise<AiKit>
  /** ถาม AI แล้วรับคำตอบเป็น JSON — ผู้เรียกต้องตรวจโครงสร้างเอง */
  json(prompt: string, opts: AiCallOptions): Promise<unknown>
}

export type AiErrorKind = 'unavailable' | 'declined' | 'locked' | 'busy' | 'refused' | 'failed' | 'cancelled'
export class AiError extends Error {
  constructor(public kind: AiErrorKind, message: string = kind) {
    super(message)
  }
}

// ---- ชนิดข้อมูลขั้นต่ำของ window.claude (runtime contract 0.2.x) ----
type SampleJson = <T>(
  input: string,
  opts?: { signal?: AbortSignal; onText?: (u: { text: string }) => void; modelTier?: string; cache?: boolean | { gcTime: number } },
) => Promise<T>
type SampleFn = { json: SampleJson }
declare global {
  interface Window {
    claude?: { use?: (name: string) => Promise<unknown> }
  }
}

function mapError(e: unknown): AiError {
  const code = (e as { code?: string })?.code
  switch (code) {
    case 'cancelled':
      return new AiError('cancelled')
    case 'not_granted':
    case 'sampling_disabled':
    case 'not_declared':
    case 'capability_disabled':
    case 'capability_removed':
      return new AiError('declined', code)
    case 'rate_limited':
    case 'session_expired':
      return new AiError('busy', code)
    case 'refused':
    case 'empty_completion':
      return new AiError('refused', code)
    default:
      return new AiError('failed', code ?? String(e))
  }
}

/** ตรวจโครงสร้างคำตอบ แล้วเติมค่าว่างให้ส่วนที่ขาด เพื่อไม่ให้หน้าจอพัง */
function normalize(raw: unknown, topic: string): AiKit {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const strs = (v: unknown) => (Array.isArray(v) ? v.map(str).filter(Boolean) : [])
  const objs = <K extends string>(v: unknown, keys: K[]) =>
    (Array.isArray(v) ? v : [])
      .map((x) => Object.fromEntries(keys.map((k) => [k, str((x as Record<string, unknown>)?.[k])])) as Record<K, string>)
      .filter((x) => str(x[keys[0]]))
  const p = (o.prayers ?? {}) as Record<string, unknown>
  const s = (o.safety ?? {}) as Record<string, unknown>
  const level = ['none', 'refer', 'urgent'].includes(str(s.level)) ? (str(s.level) as AiKit['safety']['level']) : 'none'
  const kit: AiKit = {
    title: str(o.title) || topic,
    understanding: str(o.understanding),
    openers: strs(o.openers),
    questions: strs(o.questions),
    avoid_saying: objs(o.avoid_saying, ['say', 'why']),
    scripture_refs: objs(o.scripture_refs, ['ref', 'theme']),
    bible_characters: objs(o.bible_characters, ['name', 'connection']),
    prayers: { short: str(p.short), full: str(p.full), intercession: str(p.intercession) },
    next_steps: strs(o.next_steps),
    encouragement: str(o.encouragement),
    safety: { level, note: str(s.note) },
  }
  if (!kit.understanding && kit.openers.length === 0) throw new AiError('failed', 'empty kit')
  return kit
}

function makeProvider(json: AiProvider['json']): AiProvider {
  return {
    json,
    async generateKit(topic, opts, roster) {
      return normalize(await json(buildKitPrompt(topic, roster), opts), topic)
    },
  }
}

function claudeSampleProvider(sample: SampleFn): AiProvider {
  return makeProvider(async (prompt, { signal, onProgress, cacheHours = 24 }) => {
    try {
      return await sample.json<unknown>(prompt, {
        signal,
        modelTier: 'default',
        // คำถามเดิมภายในเวลาที่กำหนด ไม่ต้องเรียก AI ซ้ำ
        cache: cacheHours > 0 ? { gcTime: cacheHours * 60 * 60 * 1000 } : false,
        onText: ({ text }) => onProgress?.(text.length),
      })
    } catch (e) {
      throw e instanceof AiError ? e : mapError(e)
    }
  })
}

// ---------- เว็บจริง (GitHub Pages): เรียก Claude API โดยตรงด้วยคีย์ที่ผู้ใช้ใส่เองในเครื่อง ----------
// คีย์ไม่ได้อยู่ในโค้ดหรือบน GitHub — เก็บใน localStorage ของเครื่องที่ใส่เท่านั้น
const KEY_STORE = 'khatha.anthropicKey'
const MODEL = 'claude-sonnet-5'
export function getApiKey(): string {
  try {
    return localStorage.getItem(KEY_STORE) ?? ''
  } catch {
    return ''
  }
}
export function setApiKey(key: string) {
  try {
    if (key.trim()) localStorage.setItem(KEY_STORE, key.trim())
    else localStorage.removeItem(KEY_STORE)
  } catch {
    /* ignore */
  }
  providerPromise = null // ให้เลือกผู้ให้บริการใหม่ตามคีย์ล่าสุด
}
/** true เมื่อแอปเปิดเป็นเว็บจริง (ไม่ได้เปิดผ่าน Claude) — ใช้ตัดสินว่าจะแสดงช่องใส่คีย์หรือไม่ */
export const isStandaloneSite = () => typeof window.claude?.use !== 'function' && /^https?:$/.test(location.protocol)

/** อ่าน JSON จากคำตอบแบบผ่อนปรน: ทั้งก้อน → ในบล็อกโค้ด → ตั้งแต่ { หรือ [ แรกถึงตัวปิดสุดท้าย */
export function parseJsonLoose(text: string): unknown {
  const t = text.trim()
  const tries = [t]
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) tries.push(fence[1])
  const a = Math.min(...['{', '['].map((c) => (t.indexOf(c) < 0 ? Infinity : t.indexOf(c))))
  const b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'))
  if (a !== Infinity && b > a) tries.push(t.slice(a, b + 1))
  for (const x of tries) {
    try {
      return JSON.parse(x)
    } catch {
      /* try next */
    }
  }
  throw new AiError('failed', 'invalid_json')
}

function hash(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36) + s.length.toString(36)
}

function directProvider(apiKey: string): AiProvider {
  return makeProvider(async (prompt, { signal, onProgress, cacheHours = 24 }) => {
    const ck = `khatha.ai.${hash(prompt)}`
    if (cacheHours > 0) {
      try {
        const hit = JSON.parse(localStorage.getItem(ck) ?? 'null') as { at: number; text: string } | null
        if (hit && Date.now() - hit.at < cacheHours * 3600_000) return parseJsonLoose(hit.text)
      } catch {
        /* no cache */
      }
    }
    let r: Response
    try {
      r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 4096,
          system: 'Reply with exactly one JSON value and nothing else. The reply will be machine-parsed.',
          messages: [{ role: 'user', content: prompt }],
        }),
        signal,
      })
    } catch (e) {
      if (signal.aborted) throw new AiError('cancelled')
      throw new AiError('failed', String(e))
    }
    const body = (await r.json().catch(() => ({}))) as { content?: { type: string; text?: string }[]; stop_reason?: string; error?: { type?: string } }
    if (r.status === 401 || r.status === 403) throw new AiError('locked', body.error?.type)
    if (r.status === 429 || r.status === 529) throw new AiError('busy')
    if (!r.ok) throw new AiError('failed', body.error?.type ?? `HTTP ${r.status}`)
    if (body.stop_reason === 'refusal') throw new AiError('refused')
    const text = (body.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('')
    if (!text.trim()) throw new AiError('refused', 'empty')
    onProgress?.(text.length)
    const value = parseJsonLoose(text)
    if (cacheHours > 0) {
      try {
        localStorage.setItem(ck, JSON.stringify({ at: Date.now(), text }))
      } catch {
        /* ignore */
      }
    }
    return value
  })
}

let providerPromise: Promise<AiProvider | null> | null = null

/** คืนค่า null เมื่อไม่มี AI ให้ใช้ในหน้าจอนี้ (เช่น เปิดไฟล์ตรง ๆ นอก Claude) */
export function getAiProvider(): Promise<AiProvider | null> {
  if (!providerPromise) {
    providerPromise = (async () => {
      const use = window.claude?.use
      if (typeof use !== 'function') {
        const key = getApiKey()
        return key ? directProvider(key) : null
      }
      try {
        const sample = (await use.call(window.claude, 'sample')) as SampleFn | null
        return sample && typeof sample.json === 'function' ? claudeSampleProvider(sample) : null
      } catch {
        return null
      }
    })()
  }
  return providerPromise
}
