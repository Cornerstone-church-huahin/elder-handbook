import { useEffect, useState } from 'react'
import { getMe, INVITE_FOR_KEY, INVITE_ROLE_KEY, MEMBERS_KEY, myRole, ROLE_EVENT, type AccessRole, type Member, type Role } from './access'
import { useSharedStore } from './sharedStore'
import { getSync, saveSync, SYNC_EVENT } from './sync'

/** สิทธิ์ของเครื่องนี้ (อัปเดตอัตโนมัติเมื่อรายชื่อผู้ใช้ร่วมเปลี่ยน) */
export function useRole(): AccessRole {
  const [role, setRole] = useState<AccessRole>(myRole)
  useEffect(() => {
    const on = () => setRole(myRole())
    window.addEventListener('khatha-store', on)
    window.addEventListener(SYNC_EVENT, on)
    window.addEventListener(ROLE_EVENT, on)
    on()
    return () => {
      window.removeEventListener('khatha-store', on)
      window.removeEventListener(SYNC_EVENT, on)
      window.removeEventListener(ROLE_EVENT, on)
    }
  }, [])
  return role
}

/** รายชื่อผู้ใช้ร่วม (members.json) + การจัดการโดยแอดมิน */
export function useMembers() {
  const store = useSharedStore<Member>({ localKey: MEMBERS_KEY, file: 'members.json', label: 'ผู้ใช้ร่วม', scope: 'members' })
  const me = getMe()
  const isAdmin = myRole() === 'admin'
  const everyone = store.items
  const pending = everyone.filter((m) => m.status === 'pending')
  const active = everyone.filter((m) => m.status !== 'pending')
  const adminCount = active.filter((m) => m.role === 'admin').length
  const announce = () => window.dispatchEvent(new Event(ROLE_EVENT))
  return {
    members: [...active].sort((a, b) => (a.joined ?? 0) - (b.joined ?? 0)),
    pending: [...pending].sort((a, b) => (a.joined ?? 0) - (b.joined ?? 0)),
    /** แอดมินอนุมัติคำขอ: กำหนดสิทธิ์ให้ */
    approve: (id: string, role: Role) => {
      if (!isAdmin) return false
      const m = pending.find((x) => x.id === id)
      if (!m) return false
      store.put([{ ...m, status: 'active', role }])
      announce()
      return true
    },
    /** แอดมินไม่อนุมัติ: คำขอถูกปฏิเสธ (เครื่องผู้ขอจะแจ้งและหยุดเชื่อมต่อ) */
    reject: (id: string) => {
      if (!isAdmin) return false
      const m = pending.find((x) => x.id === id)
      if (!m) return false
      store.put([{ ...m, deleted: true }])
      announce()
      return true
    },
    all: store.all,
    sync: store.sync,
    syncNow: store.syncNow,
    meId: me?.id ?? '',
    isAdmin,
    adminCount,
    /** แอดมินคนแรกลงทะเบียนเอง (active) หรือผู้ใช้ขอร่วม (pending รออนุมัติ) */
    register: (role: Role, status: 'active' | 'pending' = 'active', invitedFor = '') => {
      const cfg = getSync()
      if (!me || !cfg) return
      store.put([{ id: me.id, name: cfg.name.trim(), role, joined: Date.now(), status, ...(invitedFor ? { invitedFor } : {}), updated: 0 }])
      announce()
    },
    rename: (name: string) => {
      const mine = store.all.find((m) => m.id === me?.id)
      if (mine && mine.name !== name) store.put([{ ...mine, name }])
    },
    /** แอดมินเปลี่ยนสิทธิ์: ห้ามลดแอดมินคนสุดท้าย */
    setRole: (id: string, role: Role) => {
      if (!isAdmin) return false
      const m = active.find((x) => x.id === id)
      if (!m) return false
      if (m.role === 'admin' && role !== 'admin' && adminCount <= 1) return false
      store.put([{ ...m, role }])
      announce()
      return true
    },
    /** แอดมินลบคน: ห้ามลบแอดมินคนสุดท้าย (เครื่องของคนที่ถูกลบจะหยุดใช้ร่วมเมื่อซิงก์ครั้งถัดไป) */
    removeMember: (id: string) => {
      if (!isAdmin) return false
      const m = active.find((x) => x.id === id)
      if (!m) return false
      if (m.role === 'admin' && adminCount <= 1) return false
      store.put([{ ...m, deleted: true }])
      announce()
      return true
    },
  }
}

/** ใช้ครั้งเดียวที่ AppShell: ลงทะเบียนเครื่องนี้เข้ารายชื่อ · ตรวจว่าถูกลบหรือไม่ · ถามแอดมินคนแรก */
export function useMembership() {
  const m = useMembers()
  const [needAdmin, setNeedAdmin] = useState(false)
  const [removed, setRemoved] = useState(() => localStorage.getItem('khatha.removed') === '1')
  const cfg = getSync()
  const mine = m.all.find((x) => x.id === m.meId)
  useEffect(() => {
    if (!cfg || m.sync.state !== 'ok' || !m.meId) return
    if (mine?.deleted && localStorage.getItem('khatha.rejoin') === '1') {
      // เปิดลิงก์เชิญใหม่โดยตั้งใจ: กลับเข้าเป็นสมาชิกอีกครั้ง
      try { localStorage.removeItem('khatha.rejoin') } catch { /* ignore */ }
      m.register(localStorage.getItem(INVITE_ROLE_KEY) === 'viewer' ? 'viewer' : 'editor', 'pending', localStorage.getItem(INVITE_FOR_KEY) ?? '')
      return
    }
    if (mine?.deleted) {
      saveSync(null) // ถูกแอดมินลบ: หยุดใช้ร่วมบนเครื่องนี้ (ข้อมูลในเครื่องยังอยู่)
      try { localStorage.setItem('khatha.removed', '1') } catch { /* ignore */ }
      setRemoved(true)
      return
    }
    if (mine) {
      try { localStorage.removeItem('khatha.rejoin') } catch { /* ignore */ } // ส่งคำขอ/ลงทะเบียนแล้ว: เปิดลิงก์เดิมซ้ำไม่ส่งคำขอใหม่โดยอัตโนมัติ
      setNeedAdmin(false)
      m.rename(cfg.name.trim())
      return
    }
    if (m.members.length === 0) return setNeedAdmin(true) // ยังไม่มีใครเป็นแอดมิน
    setNeedAdmin(false)
    // ไม่เคยลงทะเบียน: ส่งคำขอให้แอดมินอนุมัติ (ไม่เข้าใช้ได้เองอีกต่อไป)
    m.register(localStorage.getItem(INVITE_ROLE_KEY) === 'viewer' ? 'viewer' : 'editor', 'pending', localStorage.getItem(INVITE_FOR_KEY) ?? '')
  }, [m.sync.state, m.all.length, m.meId, mine?.deleted, mine?.name, cfg?.name]) // eslint-disable-line react-hooks/exhaustive-deps
  return {
    needAdmin,
    removed,
    becomeAdmin: () => { m.register('admin'); setNeedAdmin(false) },
    joinAsMember: () => { m.register('editor', 'pending'); setNeedAdmin(false) },
    pendingCount: m.pending.length,
    cancelRequest: () => { saveSync(null) },
    isAdmin: m.isAdmin,
    syncNow: m.syncNow,
    myName: cfg?.name ?? '',
    dismissRemoved: () => { try { localStorage.removeItem('khatha.removed') } catch { /* ignore */ } setRemoved(false) },
  }
}
