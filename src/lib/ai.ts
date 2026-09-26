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

// ---------- เว็บจริง (GitHub Pages): เรียก AI โดยตรงด้วยคีย์ที่ผู้ใช้ใส่เองในเครื่อง ----------
// รองรับ Claude · Gemini · ChatGPT — คีย์ไม่ได้อยู่ในโค้ดหรือบน GitHub เก็บใน localStorage ของเครื่องที่ใส่เท่านั้น
export type AiVendor = 'claude' | 'gemini' | 'openai'
export const VENDORS: { id: AiVendor; label: string; model: string; hint: string; keyUrl: string }[] = [
  { id: 'claude', label: 'Claude', model: 'claude-sonnet-5', hint: 'sk-ant-...', keyUrl: 'https://platform.claude.com/settings/keys' },
  { id: 'gemini', label: 'Gemini (Google)', model: 'gemini-3.8-flash', hint: 'AIza...', keyUrl: 'https://aistudio.google.com/apikey' },
  { id: 'openai', label: 'ChatGPT (OpenAI)', model: 'gpt-6-astra', hint: 'sk-...', keyUrl: 'https://platform.openai.com/api-keys' },
]
export interface AiSettings {
  vendor: AiVendor
  keys: Partial<Record<AiVendor, string>>
  models: Partial<Record<AiVendor, string>>
}
const SETTINGS_STORE = 'khatha.aiSettings.v1'
export function getAiSettings(): AiSettings {
  const empty: AiSettings = { vendor: 'claude', keys: {}, models: {} }
  try {
    const v = JSON.parse(localStorage.getItem(SETTINGS_STORE) ?? 'null') as AiSettings | null
    if (v && VENDORS.some((x) => x.id === v.vendor)) return { vendor: v.vendor, keys: v.keys ?? {}, models: v.models ?? {} }
    const old = localStorage.getItem('khatha.anthropicKey') // รุ่นก่อนเก็บเฉพาะคีย์ Claude
    return old ? { ...empty, keys: { claude: old } } : empty
  } catch {
    return empty
  }
}
export function saveAiSettings(v: AiSettings) {
  const clean: AiSettings = {
    vendor: v.vendor,
    keys: Object.fromEntries(Object.entries(v.keys).map(([k, x]) => [k, (x ?? '').trim()]).filter(([, x]) => x)),
    models: Object.fromEntries(Object.entries(v.models).map(([k, x]) => [k, (x ?? '').trim()]).filter(([, x]) => x)),
  }
  try {
    localStorage.setItem(SETTINGS_STORE, JSON.stringify(clean))
    localStorage.removeItem('khatha.anthropicKey')
  } catch {
    /* ignore */
  }
  providerPromise = null // ให้เลือกผู้ให้บริการใหม่ตามค่าล่าสุด
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

const SYSTEM = 'Reply with exactly one JSON value and nothing else. The reply will be machine-parsed.'

/** ส่งคำขอไปยังผู้ให้บริการที่เลือก แล้วคืนข้อความคำตอบ */
async function callVendor(vendor: AiVendor, key: string, model: string, prompt: string, signal: AbortSignal): Promise<string> {
  const req: { url: string; headers: Record<string, string>; body: unknown } =
    vendor === 'claude'
      ? {
          url: 'https://api.anthropic.com/v1/messages',
          headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
          body: { model, max_tokens: 4096, system: SYSTEM, messages: [{ role: 'user', content: prompt }] },
        }
      : vendor === 'gemini'
        ? {
            url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
            headers: { 'x-goog-api-key': key },
            body: {
              systemInstruction: { parts: [{ text: SYSTEM }] },
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8192 },
            },
          }
        : {
            url: 'https://api.openai.com/v1/chat/completions',
            headers: { authorization: `Bearer ${key}` },
            body: { model, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }] },
          }
  let r: Response
  try {
    r = await fetch(req.url, { method: 'POST', headers: { 'content-type': 'application/json', ...req.headers }, body: JSON.stringify(req.body), signal })
  } catch (e) {
    if (signal.aborted) throw new AiError('cancelled')
    throw new AiError('failed', String(e))
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = await r.json().catch(() => ({}))
  const detail = body?.error?.message ?? body?.error?.type ?? body?.error?.status
  if (r.status === 401 || r.status === 403 || (r.status === 400 && /api.?key/i.test(String(detail)))) throw new AiError('locked', detail ? String(detail) : undefined)
  if (r.status === 429 || r.status === 529 || r.status === 503) throw new AiError('busy', detail ? String(detail) : undefined)
  if (!r.ok) throw new AiError('failed', detail ? String(detail) : `HTTP ${r.status}`)
  let text = ''
  if (vendor === 'claude') {
    if (body.stop_reason === 'refusal') throw new AiError('refused')
    text = (body.content ?? []).filter((c: { type: string }) => c.type === 'text').map((c: { text?: string }) => c.text ?? '').join('')
  } else if (vendor === 'gemini') {
    const cand = body.candidates?.[0]
    if (!cand || cand.finishReason === 'SAFETY' || body.promptFeedback?.blockReason) throw new AiError('refused')
    text = (cand.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('')
  } else {
    const msg = body.choices?.[0]?.message
    if (msg?.refusal) throw new AiError('refused')
    text = msg?.content ?? ''
  }
  if (!text.trim()) throw new AiError('refused', 'empty')
  return text
}

function directProvider(vendor: AiVendor, apiKey: string, model: string): AiProvider {
  return makeProvider(async (prompt, { signal, onProgress, cacheHours = 24 }) => {
    const ck = `khatha.ai.${hash(vendor + model + prompt)}`
    if (cacheHours > 0) {
      try {
        const hit = JSON.parse(localStorage.getItem(ck) ?? 'null') as { at: number; text: string } | null
        if (hit && Date.now() - hit.at < cacheHours * 3600_000) return parseJsonLoose(hit.text)
      } catch {
        /* no cache */
      }
    }
    const text = await callVendor(vendor, apiKey, model, prompt, signal)
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

/** ทดสอบคีย์จากหน้าตั้งค่า: คืน '' ถ้าใช้ได้ หรือข้อความสาเหตุ */
export async function testAiKey(vendor: AiVendor, key: string, model: string): Promise<string> {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), 30000)
  try {
    const text = await callVendor(vendor, key.trim(), model.trim(), 'Reply with {"ok":true}', c.signal)
    parseJsonLoose(text)
    return ''
  } catch (e) {
    if (e instanceof AiError) {
      if (e.kind === 'locked') return 'คีย์ไม่ถูกต้อง หรือยังไม่ได้เปิดใช้งาน'
      if (e.kind === 'busy') return 'ใช้งานเกินโควตาหรือระบบไม่ว่าง (ตรวจเครดิต/การชำระเงินของบัญชี)'
      if (e.kind === 'cancelled') return 'หมดเวลารอ'
      return `เรียกไม่สำเร็จ${e.message && e.message !== e.kind ? ` (${e.message.slice(0, 120)})` : ''}`
    }
    return 'เรียกไม่สำเร็จ'
  } finally {
    clearTimeout(t)
  }
}

let providerPromise: Promise<AiProvider | null> | null = null

/** คืนค่า null เมื่อไม่มี AI ให้ใช้ในหน้าจอนี้ (เช่น เปิดไฟล์ตรง ๆ นอก Claude) */
export function getAiProvider(): Promise<AiProvider | null> {
  if (!providerPromise) {
    providerPromise = (async () => {
      const use = window.claude?.use
      if (typeof use !== 'function') {
        const st = getAiSettings()
        const v = VENDORS.find((x) => x.id === st.vendor)!
        const key = st.keys[st.vendor]
        return key ? directProvider(st.vendor, key, st.models[st.vendor] || v.model) : null
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
