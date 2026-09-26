/**
 * ใช้ร่วมกันออนไลน์ผ่าน GitHub เท่านั้น (ไม่ใช้บริการอื่น)
 * ข้อมูลเก็บเป็นไฟล์ prayers.json ใน repo ส่วนตัว (private) ของคริสตจักร เช่น Cornerstone-church-huahin/elder-handbook-data
 * แต่ละเครื่องใส่ "รหัสเข้าใช้ร่วม" (GitHub fine-grained token ที่แก้ไขได้เฉพาะ repo นั้น) ครั้งเดียวในหน้าตั้งค่า
 * รหัสเก็บในเครื่องนั้นเท่านั้น — ห้ามใส่ในโค้ดหรือ repo ของแอป (repo แอปเป็นสาธารณะ)
 */
import { normalize, type NotePrayer } from './prayerNotebook'

export interface SyncConfig { repo: string; token: string; name: string }
export type SyncStatus =
  | { state: 'off' }
  | { state: 'idle' }
  | { state: 'syncing' }
  | { state: 'ok'; at: number }
  | { state: 'error'; message: string }

const STORE = 'khatha.sync.v1'
const FILE = 'prayers.json'
export const DEFAULT_REPO = 'Cornerstone-church-huahin/elder-handbook-data'

export function getSync(): SyncConfig | null {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? 'null') as SyncConfig | null
    return v && v.token && v.repo ? v : null
  } catch {
    return null
  }
}
export function saveSync(v: SyncConfig | null) {
  try {
    if (v && v.token.trim()) localStorage.setItem(STORE, JSON.stringify({ repo: v.repo.trim() || DEFAULT_REPO, token: v.token.trim(), name: v.name.trim() }))
    else localStorage.removeItem(STORE)
  } catch {
    /* ignore */
  }
}

const b64encode = (s: string) => {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
const b64decode = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), (c) => c.charCodeAt(0)))

function api(cfg: SyncConfig, path: string, init: RequestInit = {}) {
  return fetch(`https://api.github.com/repos/${cfg.repo}${path ? `/${path}` : ""}`, {
    ...init,
    cache: 'no-store',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${cfg.token}`,
      'x-github-api-version': '2022-11-28',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
    },
  })
}

function explain(status: number): string {
  if (status === 401) return 'รหัสเข้าใช้ร่วมไม่ถูกต้องหรือหมดอายุ'
  if (status === 403) return 'รหัสนี้ไม่มีสิทธิ์แก้ไขข้อมูล (ตรวจสิทธิ์ Contents: Read and write)'
  if (status === 404) return 'ไม่พบ repo ข้อมูล หรือรหัสนี้ไม่ได้รับสิทธิ์ใน repo นั้น'
  return `เชื่อมต่อไม่สำเร็จ (${status})`
}

export async function pullRemote(cfg: SyncConfig): Promise<{ items: NotePrayer[]; sha?: string; exists: boolean }> {
  let r: Response
  try {
    r = await api(cfg, `contents/${FILE}`)
  } catch {
    throw new Error('ไม่มีอินเทอร์เน็ต — บันทึกไว้ในเครื่องก่อน จะส่งขึ้นเมื่อเชื่อมต่อได้')
  }
  if (r.status === 404) {
    // repo มีอยู่แต่ยังไม่มีไฟล์ = ครั้งแรก · repo ไม่มี/ไม่มีสิทธิ์ = ผิดพลาด
    const repo = await api(cfg, '').catch(() => null)
    if (repo?.ok) return { items: [], exists: false }
    throw new Error(explain(repo?.status ?? 404))
  }
  if (!r.ok) throw new Error(explain(r.status))
  const body = (await r.json()) as { content?: string; sha: string; encoding?: string; download_url?: string }
  let text = body.content && body.encoding === 'base64' ? b64decode(body.content) : ''
  if (!text) {
    // ไฟล์ใหญ่เกิน 1MB API ไม่ส่งเนื้อหามา → อ่านแบบ raw
    const raw = await api(cfg, `contents/${FILE}`, { headers: { accept: 'application/vnd.github.raw' } } as RequestInit)
    text = raw.ok ? await raw.text() : ''
  }
  const data = JSON.parse(text || '{"items":[]}') as { items?: unknown[] }
  return { items: (data.items ?? []).map((x) => normalize(x as NotePrayer)), sha: body.sha, exists: true }
}

export async function pushRemote(cfg: SyncConfig, items: NotePrayer[], sha?: string, retry = true): Promise<void> {
  const content = JSON.stringify({ app: 'church-elder-handbook', version: 1, saved: new Date().toISOString(), items }, null, 1)
  const r = await api(cfg, `contents/${FILE}`, {
    method: 'PUT',
    body: JSON.stringify({ message: `อัปเดตสมุดคำอธิษฐาน${cfg.name ? ` โดย ${cfg.name}` : ''}`, content: b64encode(content), ...(sha ? { sha } : {}) }),
  }).catch(() => null)
  if (!r) throw new Error('ไม่มีอินเทอร์เน็ต — บันทึกไว้ในเครื่องก่อน จะส่งขึ้นเมื่อเชื่อมต่อได้')
  if ((r.status === 409 || r.status === 422) && retry) {
    // อีกเครื่องเพิ่งบันทึก → ดึงของล่าสุดมารวมแล้วส่งใหม่
    const { mergeLists } = await import('./prayerNotebook')
    const remote = await pullRemote(cfg)
    return pushRemote(cfg, mergeLists(items, remote.items), remote.sha, false)
  }
  if (!r.ok) throw new Error(explain(r.status))
}

/** ทดสอบการเชื่อมต่อจากหน้าตั้งค่า: '' = ใช้ได้ */
export async function testSync(cfg: SyncConfig): Promise<string> {
  try {
    const r = await api(cfg, '')
    if (!r.ok) return explain(r.status)
    const j = (await r.json()) as { private?: boolean; permissions?: { push?: boolean } }
    if (j.permissions && !j.permissions.push) return 'รหัสนี้อ่านได้อย่างเดียว ต้องให้สิทธิ์ Contents: Read and write'
    if (j.private === false) return 'repo ข้อมูลนี้เป็นสาธารณะ — ต้องตั้งเป็น Private เพื่อไม่ให้คนนอกเห็นบันทึก'
    return ''
  } catch {
    return 'ไม่มีอินเทอร์เน็ต'
  }
}
