/**
 * ชั้น AI ของคู่มือผู้ปกครองคริสตจักร
 *
 * หน้าจอเรียกผ่าน getAiProvider() เท่านั้น ไม่ผูกกับผู้ให้บริการ AI รายใด
 * - ตอนนี้ (พรีวิว): ใช้ Claude ผ่านบัญชี Claude ของผู้เปิดดู (capability "sample")
 * - อนาคต (ใช้งานจริง): Supabase Edge Function เรียก Claude API พร้อมส่งเนื้อหาที่อนุมัติแล้ว
 *   และธรรมนูญที่เกี่ยวข้องเข้าไปด้วย (Constitution First) — เปลี่ยนเฉพาะไฟล์นี้
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

export type AiErrorKind = 'unavailable' | 'declined' | 'busy' | 'refused' | 'failed' | 'cancelled'
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

function claudeSampleProvider(sample: SampleFn): AiProvider {
  const json = async (prompt: string, { signal, onProgress, cacheHours = 24 }: AiCallOptions) => {
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
  }
  return {
    json,
    async generateKit(topic, opts, roster) {
      return normalize(await json(buildKitPrompt(topic, roster), opts), topic)
    },
  }
}

let providerPromise: Promise<AiProvider | null> | null = null

/** คืนค่า null เมื่อไม่มี AI ให้ใช้ในหน้าจอนี้ (เช่น เปิดไฟล์ตรง ๆ นอก Claude) */
export function getAiProvider(): Promise<AiProvider | null> {
  if (!providerPromise) {
    providerPromise = (async () => {
      const use = window.claude?.use
      if (typeof use !== 'function') return null
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
