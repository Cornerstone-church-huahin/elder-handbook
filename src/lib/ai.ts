/**
 * ชั้น AI ของคู่มือผู้ปกครองคริสตจักร
 *
 * หน้าจอเรียกผ่าน getAiProvider() เท่านั้น ไม่ผูกกับผู้ให้บริการ AI รายใด
 * - เปิดผ่าน Claude (พรีวิว): ใช้ Claude ของผู้เปิดดู (capability "sample")
 * - เว็บจริง: เรียก /api/ai (functions/api/ai.ts บน Cloudflare Pages) พร้อมรหัสเข้าใช้
 *   Step A4: เปลี่ยนรหัสเข้าใช้เป็นการตรวจ Login
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

// ---------- เว็บจริง: /api/ai ----------
const CODE_KEY = 'khatha.aiAccessCode'
export function getAccessCode(): string {
  try {
    return localStorage.getItem(CODE_KEY) ?? ''
  } catch {
    return ''
  }
}
export function setAccessCode(code: string) {
  try {
    localStorage.setItem(CODE_KEY, code.trim())
  } catch {
    /* ignore */
  }
}
/** true เมื่อแอปเปิดเป็นเว็บจริง (ไม่ได้เปิดผ่าน Claude) — ใช้ตัดสินว่าจะแสดงช่องรหัสเข้าใช้หรือไม่ */
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

function serverProvider(): AiProvider {
  return makeProvider(async (prompt, { signal, onProgress, cacheHours = 24 }) => {
    const key = `khatha.ai.${hash(prompt)}`
    if (cacheHours > 0) {
      try {
        const hit = JSON.parse(localStorage.getItem(key) ?? 'null') as { at: number; text: string } | null
        if (hit && Date.now() - hit.at < cacheHours * 3600_000) return parseJsonLoose(hit.text)
      } catch {
        /* no cache */
      }
    }
    let r: Response
    try {
      r = await fetch('./api/ai', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-access-code': getAccessCode() },
        body: JSON.stringify({ prompt }),
        signal,
      })
    } catch (e) {
      if (signal.aborted) throw new AiError('cancelled')
      throw new AiError('failed', String(e))
    }
    const body = (await r.json().catch(() => ({}))) as { text?: string; code?: string }
    if (r.status === 401) throw new AiError('locked')
    if (r.status === 404 || r.status === 503) throw new AiError('unavailable', body.code)
    if (r.status === 429) throw new AiError('busy')
    if (body.code === 'refused') throw new AiError('refused')
    if (!r.ok || !body.text) throw new AiError('failed', body.code ?? `HTTP ${r.status}`)
    onProgress?.(body.text.length)
    const value = parseJsonLoose(body.text)
    if (cacheHours > 0) {
      try {
        localStorage.setItem(key, JSON.stringify({ at: Date.now(), text: body.text }))
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
      if (typeof use !== 'function') return isStandaloneSite() ? serverProvider() : null
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
