/**
 * โลโก้ต้นแบบ: เก็บโลโก้หลายอัน พร้อมการปรับพอดีวง (ซูม/เลื่อน/รูปทรง/พื้นหลัง/สว่าง-สี-คม) และตำแหน่ง+ขนาดที่วางไว้บนการ์ด
 * เลือกครั้งเดียวได้ทุกอย่างกลับมา (ตำแหน่งเริ่มต้นตามที่บันทึก แต่ยังลากเลื่อนได้) · เก็บในเครื่องนี้ (IndexedDB)
 */
import type { ShareStyle } from './shareVerse'

export type LogoFit = Pick<ShareStyle, 'logoZoom' | 'logoOX' | 'logoOY' | 'logoShape' | 'logoBg' | 'logoBrightness' | 'logoSaturation' | 'logoSharpness' | 'logoScale' | 'logoX' | 'logoY' | 'footer'>
export const FIT_KEYS: (keyof LogoFit)[] = ['logoZoom', 'logoOX', 'logoOY', 'logoShape', 'logoBg', 'logoBrightness', 'logoSaturation', 'logoSharpness', 'logoScale', 'logoX', 'logoY', 'footer']
export interface LogoPreset { id: string; name: string; at: number; img: string; thumb: string; fit: LogoFit }
export const fitOf = (st: ShareStyle): LogoFit => Object.fromEntries(FIT_KEYS.map((k) => [k, st[k]])) as unknown as LogoFit

const DB = 'khatha-share-logos'
const STORE = 'logos'
let mem: LogoPreset[] = []
let dbp: Promise<IDBDatabase | null> | null = null
function open(): Promise<IDBDatabase | null> {
  if (!dbp) {
    dbp = new Promise((res) => {
      try {
        const rq = indexedDB.open(DB, 1)
        rq.onupgradeneeded = () => rq.result.createObjectStore(STORE, { keyPath: 'id' })
        rq.onsuccess = () => res(rq.result)
        rq.onerror = () => res(null)
        rq.onblocked = () => res(null)
      } catch { res(null) }
    })
  }
  return dbp
}
const done = (t: IDBTransaction) => new Promise<void>((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error) })

export async function listLogos(): Promise<LogoPreset[]> {
  const db = await open()
  if (!db) return [...mem].sort((a, b) => a.at - b.at)
  return await new Promise((res) => {
    const rq = db.transaction(STORE).objectStore(STORE).getAll()
    rq.onsuccess = () => res((rq.result as LogoPreset[]).sort((a, b) => a.at - b.at))
    rq.onerror = () => res([])
  })
}
export async function saveLogo(p: LogoPreset): Promise<void> {
  const db = await open()
  if (!db) { mem = [...mem.filter((x) => x.id !== p.id), p]; return }
  const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).put(p); await done(t)
}
export async function deleteLogo(id: string): Promise<void> {
  const db = await open()
  if (!db) { mem = mem.filter((x) => x.id !== id); return }
  const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).delete(id); await done(t)
}
