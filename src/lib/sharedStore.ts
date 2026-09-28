import { useCallback, useEffect, useRef, useState } from 'react'
import { getSync, mergeItems, SYNC_EVENT, pullFile, pushFile, type SharedItem, type SyncStatus } from './sync'

/**
 * ที่เก็บข้อมูลที่ใช้ร่วมกัน: บันทึกในเครื่องทันที แล้วซิงก์ขึ้น GitHub (repo ส่วนตัว) อัตโนมัติ
 * ทุกเครื่องที่ใส่รหัสเข้าใช้ร่วมจะเห็นและแก้ไขข้อมูลชุดเดียวกัน (ใหม่กว่าชนะ รายการที่ลบถูกจำไว้)
 */
export function useSharedStore<T extends SharedItem>(opts: { localKey: string; file: string; label: string; seed?: () => T[] }) {
  const { localKey, file, label } = opts
  const read = (): T[] | null => {
    try {
      const v = JSON.parse(localStorage.getItem(localKey) ?? 'null')
      return Array.isArray(v) ? v : null
    } catch {
      return null
    }
  }
  const [all, setAll] = useState<T[]>(() => read() ?? opts.seed?.() ?? [])
  const [sync, setSync] = useState<SyncStatus>(getSync() ? { state: 'idle' } : { state: 'off' })
  const latest = useRef(all)
  latest.current = all
  const timer = useRef<number | undefined>(undefined)
  const [me] = useState(() => Symbol('store'))

  const setLocal = useCallback(
    (next: T[]) => {
      latest.current = next
      setAll(next)
      try {
        localStorage.setItem(localKey, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      // ส่วนอื่นของแอปที่ใช้ข้อมูลชุดเดียวกัน (เช่นตัวเลขแจ้งเตือนที่แถบเมนู) อัปเดตตามทันที
      window.dispatchEvent(new CustomEvent('khatha-store', { detail: { key: localKey, from: me } }))
    },
    [localKey, me],
  )
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ key: string; from: symbol }>).detail
      if (d.key !== localKey || d.from === me) return
      const v = read()
      if (v) {
        latest.current = v
        setAll(v)
      }
    }
    window.addEventListener('khatha-store', on)
    return () => window.removeEventListener('khatha-store', on)
  }, [localKey, me]) // eslint-disable-line react-hooks/exhaustive-deps

  const syncNow = useCallback(async () => {
    const cfg = getSync()
    if (!cfg) return setSync({ state: 'off' })
    setSync({ state: 'syncing' })
    try {
      const remote = await pullFile<T>(cfg, file)
      const merged = mergeItems(latest.current, remote.items)
      setLocal(merged)
      const localNewer = merged.some((x) => {
        const r = remote.items.find((y) => y.id === x.id)
        return !r || x.updated > r.updated
      })
      if (localNewer) await pushFile(cfg, file, label, merged, remote.sha)
      setSync({ state: 'ok', at: Date.now() })
    } catch (e) {
      setSync({ state: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }, [file, label, setLocal])

  useEffect(() => {
    syncNow()
    const onVis = () => document.visibilityState === 'visible' && syncNow()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener(SYNC_EVENT, syncNow)
    const t = window.setInterval(syncNow, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener(SYNC_EVENT, syncNow)
      window.clearInterval(t)
    }
  }, [syncNow])

  /** บันทึกรายการ (เพิ่ม/แก้ไข) แล้วส่งขึ้นออนไลน์ทันที */
  const put = useCallback(
    (items: T[]) => {
      const by = getSync()?.name
      const now = Date.now()
      const stamped = items.map((x, i) => ({ ...x, updated: now + i, by: by ?? x.by }))
      const ids = new Set(stamped.map((x) => x.id))
      setLocal([...latest.current.filter((x) => !ids.has(x.id)), ...stamped])
      if (getSync()) {
        setSync({ state: 'syncing' })
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(syncNow, 600)
      }
    },
    [setLocal, syncNow],
  )

  return {
    items: all.filter((x) => !x.deleted),
    all,
    sync,
    put,
    remove: (id: string) => {
      const x = latest.current.find((y) => y.id === id)
      if (x) put([{ ...x, deleted: true }])
    },
  }
}
