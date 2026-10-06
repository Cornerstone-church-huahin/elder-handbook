import { useCallback, useEffect, useRef, useState } from 'react'
import { blockIfViewer, MEMBERS_KEY, myRole } from './access'
import { getSync, mergeItems, SYNC_EVENT, pullFile, pushFile, type SharedItem, type SyncStatus } from './sync'

/**
 * ที่เก็บข้อมูลที่ใช้ร่วมกัน: บันทึกในเครื่องทันที แล้วซิงก์ขึ้น GitHub (repo ส่วนตัว) อัตโนมัติ
 * ทุกเครื่องที่ใส่รหัสเข้าใช้ร่วมจะเห็นและแก้ไขข้อมูลชุดเดียวกัน (ใหม่กว่าชนะ รายการที่ลบถูกจำไว้)
 */
export function useSharedStore<T extends SharedItem>(opts: {
  localKey: string
  file: string
  label: string
  seed?: () => T[]
  /** shared (ค่าเริ่มต้น) = ทุกคนเห็น ผู้ที่ดูอย่างเดียวแก้ไม่ได้ · private = เฉพาะเจ้าของ · members = รายชื่อผู้ใช้ร่วม */
  scope?: 'shared' | 'private' | 'members'
  /** กรอง/แปลงรายการทุกครั้งที่อ่านหรือรวมข้อมูล (ใช้กับข้อมูลส่วนตัว: คงไว้เฉพาะของตัวเอง) */
  adapt?: (items: T[]) => T[]
  /** ไฟล์เดิมที่เคยเก็บรวมกัน: อ่านอย่างเดียว แล้วนำเฉพาะของตัวเองมาเป็นของส่วนตัว (ไม่ลบ ไม่แก้ไฟล์เดิม) */
  legacyFile?: string
  adaptLegacy?: (items: T[]) => T[]
}) {
  const { localKey, file, label } = opts
  const scope = opts.scope ?? 'shared'
  const adaptRef = useRef(opts.adapt)
  adaptRef.current = opts.adapt
  const fix = (xs: T[]) => (adaptRef.current ? adaptRef.current(xs) : xs)
  const read = (): T[] | null => {
    try {
      const v = JSON.parse(localStorage.getItem(localKey) ?? 'null')
      return Array.isArray(v) ? v : null
    } catch {
      return null
    }
  }
  const [all, setAll] = useState<T[]>(() => fix(read() ?? opts.seed?.() ?? []))
  const [sync, setSync] = useState<SyncStatus>(getSync() ? { state: 'idle' } : { state: 'off' })
  const syncNowRef = useRef<() => void>(() => undefined)
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
      if (scope !== 'members' && d.key === MEMBERS_KEY) { syncNowRef.current() ; return } // รายชื่อ/สิทธิ์เปลี่ยน (เช่น เพิ่งได้รับอนุมัติ): ซิงก์ข้อมูลทันที
      if (d.key !== localKey || d.from === me) return
      const v = read()
      if (v) {
        const f = fix(v)
        latest.current = f
        setAll(f)
      }
    }
    window.addEventListener('khatha-store', on)
    return () => window.removeEventListener('khatha-store', on)
  }, [localKey, me]) // eslint-disable-line react-hooks/exhaustive-deps

  const syncNow = useCallback(async () => {
    const cfg = getSync()
    if (!cfg) return setSync({ state: 'off' })
    // ยังไม่รู้สิทธิ์ (รายชื่อผู้ใช้ร่วมยังไม่เคยซิงก์) หรือรออนุมัติ: ยังไม่ดึง/ส่งข้อมูลที่ใช้ร่วมกันและส่วนตัว
    if (scope !== 'members' && (localStorage.getItem(MEMBERS_KEY) === null || myRole() === 'pending')) return setSync({ state: 'idle' })
    setSync({ state: 'syncing' })
    try {
      const remote = await pullFile<T>(cfg, file)
      let legacy: T[] = []
      if (opts.legacyFile) {
        try { legacy = (opts.adaptLegacy ? opts.adaptLegacy((await pullFile<T>(cfg, opts.legacyFile)).items) : []) } catch { /* ไฟล์เดิมไม่มี/อ่านไม่ได้ ไม่เป็นไร */ }
      }
      const merged = fix(mergeItems(mergeItems(latest.current, remote.items), legacy))
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

  syncNowRef.current = syncNow
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
      if (scope === 'shared' && blockIfViewer()) return
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
    [setLocal, syncNow, scope],
  )

  return {
    items: all.filter((x) => !x.deleted),
    all,
    sync,
    syncNow,
    put,
    remove: (id: string) => {
      const x = latest.current.find((y) => y.id === id)
      if (x) put([{ ...x, deleted: true }])
    },
  }
}
