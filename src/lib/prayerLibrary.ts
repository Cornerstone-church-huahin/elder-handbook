/**
 * คลังคำอธิษฐานของคริสตจักร (public/data/prayer-library.json, สร้างโดย scripts/build_prayer_library.py)
 * เมื่อเรื่องที่พิมพ์ตรงกับหัวข้อ (ถวายทรัพย์ · ขอบคุณอาหาร · การเงิน):
 * - ไม่มี AI: ใช้คำอธิษฐานต้นฉบับนี้โดยตรง
 * - มี AI: ส่งเป็นแนวทางสำนวนให้ AI ปรับให้ตรงเรื่อง และยังแสดงต้นฉบับให้เลือกได้
 */
export interface LibraryVersion { label: string; text: string }
export interface LibraryEntry { id: 'offering' | 'meal' | 'finance'; title: string; match: string; invite?: string; versions: LibraryVersion[] }
export interface PrayerLibrary { entries: LibraryEntry[] }

let p: Promise<PrayerLibrary | null> | null = null
export function loadPrayerLibrary(): Promise<PrayerLibrary | null> {
  if (!p) {
    p = fetch('./data/prayer-library.json')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => {
        p = null
        return null
      })
  }
  return p
}

/** หัวข้อพิธี (ถวาย/อาหาร) ตรวจก่อน แล้วจึงการเงิน */
export function matchLibrary(lib: PrayerLibrary | null, text: string): LibraryEntry | null {
  if (!lib) return null
  const order = ['offering', 'meal', 'finance']
  for (const id of order) {
    const e = lib.entries.find((x) => x.id === id)
    if (e && new RegExp(e.match, 'i').test(text)) return e
  }
  return null
}
