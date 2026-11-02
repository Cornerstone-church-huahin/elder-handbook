/**
 * ค้นรูปฟรีจากอินเทอร์เน็ต: Wikimedia Commons (คลังรูปของมูลนิธิวิกิมีเดีย) ไม่ต้องใช้คีย์
 * คัดเฉพาะรูปที่เป็นสาธารณสมบัติ (Public domain) หรือ CC0 — ใช้ได้โดยไม่ต้องให้เครดิต ไม่ติดเงื่อนไขแชร์ต่อ
 * ต้องมีอินเทอร์เน็ตตอนค้น · รูปที่เลือกถูกดาวน์โหลดมาใช้ในเครื่อง (ย่อไม่เกิน 1600px)
 */
import { fileToPhoto } from './shareVerse'

export interface CommonsHit { title: string; thumb: string; w: number; h: number; license: string; page: string }
export const COMMONS_TOPICS: { id: string; label: string; q: string }[] = [
  { id: 'sunrise', label: '🌅 พระอาทิตย์ขึ้น', q: 'sunrise' }, { id: 'sunset', label: '🌇 อาทิตย์ตก', q: 'sunset' }, { id: 'clouds', label: '☁️ ท้องฟ้า เมฆ', q: 'clouds sky' },
  { id: 'mountain', label: '⛰️ ภูเขา', q: 'mountain landscape' }, { id: 'forest', label: '🌲 ป่าไม้', q: 'forest trees' }, { id: 'sea', label: '🌊 ทะเล', q: 'sea waves' },
  { id: 'beach', label: '🏖️ ชายหาด', q: 'beach' }, { id: 'field', label: '🌾 ทุ่งนา', q: 'wheat field' }, { id: 'stars', label: '✨ ดวงดาว', q: 'night sky stars' },
  { id: 'flowers', label: '🌸 ดอกไม้', q: 'flowers' }, { id: 'waterfall', label: '💧 น้ำตก', q: 'waterfall' }, { id: 'lake', label: '🏞️ ทะเลสาบ', q: 'lake reflection' },
  { id: 'snow', label: '❄️ หิมะ', q: 'snow landscape' }, { id: 'desert', label: '🏜️ ทะเลทราย', q: 'desert dunes' }, { id: 'garden', label: '🌿 สวน', q: 'garden' },
  { id: 'rainbow', label: '🌈 รุ้ง', q: 'rainbow' }, { id: 'fog', label: '🌫️ หมอก', q: 'fog morning' }, { id: 'river', label: '🏞️ แม่น้ำ', q: 'river' },
  { id: 'autumn', label: '🍂 ใบไม้ร่วง', q: 'autumn leaves' }, { id: 'meadow', label: '🌼 ทุ่งหญ้า', q: 'meadow' },
]

const API = 'https://commons.wikimedia.org/w/api.php'
const FREE = /^(public domain|cc0|pd[\s-]|no restrictions|cc[\s-]?zero)/i
const cleanLic = (s: string) => s.replace(/<[^>]+>/g, '').trim()

interface ApiPage { title: string; index?: number; imageinfo?: { thumburl?: string; width?: number; height?: number; descriptionurl?: string; extmetadata?: { LicenseShortName?: { value?: string } } }[] }

/** ค้นรูป (คืนเฉพาะที่เป็นสาธารณสมบัติ/CC0 และไม่เล็กเกินไป) · next = ตำแหน่งสำหรับ "โหลดเพิ่ม" */
export async function searchCommons(q: string, offset = 0, signal?: AbortSignal): Promise<{ hits: CommonsHit[]; next: number | null }> {
  const u = new URL(API)
  const params: Record<string, string> = {
    action: 'query', format: 'json', origin: '*', generator: 'search', gsrnamespace: '6', gsrsearch: `${q} filetype:bitmap`, gsrlimit: '50', gsroffset: String(offset),
    prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '300', iiextmetadatafilter: 'LicenseShortName',
  }
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v))
  const r = await fetch(u.toString(), { signal }).catch(() => { throw new Error('ไม่มีอินเทอร์เน็ต หรือเชื่อมต่อ Wikimedia Commons ไม่ได้') })
  if (!r.ok) throw new Error(`Wikimedia Commons ตอบกลับผิดพลาด (${r.status})`)
  const j = await r.json() as { query?: { pages?: Record<string, ApiPage> }; continue?: { gsroffset?: number } }
  const pages = Object.values(j.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
  const hits: CommonsHit[] = []
  for (const p of pages) {
    const ii = p.imageinfo?.[0]
    const lic = cleanLic(ii?.extmetadata?.LicenseShortName?.value ?? '')
    if (!ii?.thumburl || !FREE.test(lic) || (ii.width ?? 0) < 1000 || (ii.height ?? 0) < 700) continue
    hits.push({ title: p.title, thumb: ii.thumburl, w: ii.width ?? 0, h: ii.height ?? 0, license: lic, page: ii.descriptionurl ?? '' })
  }
  return { hits, next: j.continue?.gsroffset ?? null }
}

/** ดาวน์โหลดรูปที่เลือก (ขนาดไม่เกิน 1600px) เป็น data URL เพื่อใช้เป็นพื้นหลัง */
export async function fetchCommonsPhoto(title: string, signal?: AbortSignal): Promise<string> {
  const u = new URL(API)
  const params: Record<string, string> = { action: 'query', format: 'json', origin: '*', titles: title, prop: 'imageinfo', iiprop: 'url', iiurlwidth: '1600' }
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v))
  const r = await fetch(u.toString(), { signal }).catch(() => { throw new Error('ไม่มีอินเทอร์เน็ต หรือเชื่อมต่อ Wikimedia Commons ไม่ได้') })
  const j = await r.json() as { query?: { pages?: Record<string, ApiPage> } }
  const url = Object.values(j.query?.pages ?? {})[0]?.imageinfo?.[0]?.thumburl
  if (!url) throw new Error('หาไฟล์รูปไม่พบ')
  const img = await fetch(url, { signal, mode: 'cors' }).catch(() => { throw new Error('ดาวน์โหลดรูปไม่ได้') })
  if (!img.ok) throw new Error(`ดาวน์โหลดรูปไม่ได้ (${img.status})`)
  const blob = await img.blob()
  return await fileToPhoto(new File([blob], 'commons.jpg', { type: blob.type || 'image/jpeg' }))
}
