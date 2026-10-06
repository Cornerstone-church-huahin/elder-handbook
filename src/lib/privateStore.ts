import { useMemo } from 'react'
import { getMe } from './access'
import { useSharedStore } from './sharedStore'
import { getSync, type SharedItem } from './sync'

export type OwnedItem = SharedItem & { ownerId?: string; owner?: string }

/**
 * ข้อมูลส่วนตัวรายคน (โน้ต สคริปต์ด่วน ถามตอบ): เก็บในโฟลเดอร์ของตัวเองบน GitHub (private/<รหัสคน>/…)
 * เครื่องของคนอื่นไม่ดาวน์โหลดและไม่แสดง · เครื่องของตัวเองทุกเครื่อง (ใช้ชื่อเดิม) เห็นชุดเดียวกัน
 * ข้อมูลเดิมที่เคยเก็บรวมกัน: นำเฉพาะของตัวเองมาเป็นส่วนตัว (คัดลอก ไม่ลบไฟล์เดิม)
 * หมายเหตุ: เป็นการกันในแอป — คนที่มีรหัสและรู้วิธีเทคนิคยังเปิดไฟล์ใน repo ตรง ๆ ได้
 */
export function usePrivateStore<T extends OwnedItem>(o: { key: string; name: string; label: string; legacyFile?: string; legacyMine?: (x: T, name: string) => boolean }) {
  const me = getMe()
  const myId = me?.id ?? ''
  const myName = getSync()?.name.trim() ?? ''
  const legacyMine = o.legacyMine ?? ((x: T, name: string) => !!name && (x as { by?: string }).by === name)
  // ข้อมูลในเครื่องที่ยังไม่มีเจ้าของ (สร้างตอนยังไม่เชื่อมออนไลน์) = ของเจ้าของเครื่อง
  const adapt = (xs: T[]) =>
    xs.flatMap((x) => {
      if (x.ownerId) return x.ownerId === myId ? [x] : []
      return !(x as { by?: string }).by || legacyMine(x, myName) ? [myId ? { ...x, ownerId: myId } : x] : []
    })
  const adaptLegacy = (xs: T[]) => xs.filter((x) => !x.ownerId && legacyMine(x, myName)).map((x) => ({ ...x, ownerId: myId }))
  const store = useSharedStore<T>({
    localKey: o.key,
    file: myId ? `private/${myId}/${o.name}.json` : `${o.name}.private.json`,
    label: o.label,
    scope: 'private',
    adapt,
    legacyFile: myId ? o.legacyFile : undefined,
    adaptLegacy,
  })
  const put = (items: T[]) => store.put(items.map((x) => ({ ...x, ...(myId ? { ownerId: myId } : {}) })))
  return useMemo(() => ({ ...store, put }), [store.items, store.sync, store.syncNow]) // eslint-disable-line react-hooks/exhaustive-deps
}
