/**
 * สต็อกพื้นหลังของฉัน: พื้นหลังที่สร้างเพิ่ม (สุ่มในเครื่อง หรือ AI สร้าง) เก็บไว้ในเครื่องนี้ (IndexedDB) ดึงมาใช้ได้ทุกเมื่อ
 * ไม่ส่งไปที่ไหน · เก็บได้สูงสุด 300 รูป (เกินแล้วลบรูปเก่าสุดให้อัตโนมัติ)
 */
export interface StockItem { id: string; at: number; kind: 'art' | 'ai'; label: string; thumb: string; full: Blob }
export const STOCK_MAX = 300
const DB = 'khatha-share-stock'
const STORE = 'imgs'

let mem: StockItem[] = [] // ใช้เมื่อเครื่อง/โหมดส่วนตัวไม่มี IndexedDB (หายเมื่อปิดแอป)
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

export async function listStock(): Promise<StockItem[]> {
  const db = await open()
  if (!db) return [...mem].sort((a, b) => b.at - a.at)
  return await new Promise((res) => {
    const rq = db.transaction(STORE).objectStore(STORE).getAll()
    rq.onsuccess = () => res((rq.result as StockItem[]).sort((a, b) => b.at - a.at))
    rq.onerror = () => res([])
  })
}
export async function addStock(items: StockItem[]): Promise<void> {
  const db = await open()
  if (!db) { mem = [...items, ...mem].slice(0, STOCK_MAX); return }
  const t = db.transaction(STORE, 'readwrite'); const s = t.objectStore(STORE)
  items.forEach((x) => s.put(x))
  await done(t)
  const all = await listStock()
  if (all.length > STOCK_MAX) { const t2 = db.transaction(STORE, 'readwrite'); all.slice(STOCK_MAX).forEach((x) => t2.objectStore(STORE).delete(x.id)); await done(t2) }
}
export async function removeStock(id: string): Promise<void> {
  const db = await open()
  if (!db) { mem = mem.filter((x) => x.id !== id); return }
  const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).delete(id); await done(t)
}
export async function clearStock(): Promise<void> {
  const db = await open()
  if (!db) { mem = []; return }
  const t = db.transaction(STORE, 'readwrite'); t.objectStore(STORE).clear(); await done(t)
}
export const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const f = new FileReader(); f.onload = () => res(String(f.result)); f.onerror = () => rej(f.error); f.readAsDataURL(b) })
export const dataUrlToBlob = async (u: string) => await (await fetch(u)).blob()

/** ย่อรูป (data URL) ให้ด้านยาวไม่เกิน max แล้วคืนเป็น Blob JPEG */
export async function shrinkToBlob(dataUrl: string, max: number, q = 0.88): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('อ่านรูปไม่ได้')); i.src = dataUrl })
  const k = Math.min(1, max / Math.max(img.width, img.height))
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k))
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('ย่อรูปไม่ได้'))), 'image/jpeg', q))
}
