import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { INVITE_ROLE_KEY } from '../lib/access'
import { DEFAULT_REPO, getSync, saveSync, testSync } from '../lib/sync'

/**
 * ลิงก์เข้าร่วม: เปิดครั้งเดียวบนเครื่องใหม่ → เชื่อมต่อสมุดคำอธิษฐานออนไลน์อัตโนมัติ (ไม่ต้องพิมพ์รหัส)
 * รหัสอยู่หลังเครื่องหมาย # จึงไม่ถูกส่งไปที่เซิร์ฟเวอร์ใด และถูกลบออกจากแถบที่อยู่ทันทีที่เปิด
 */
export default function JoinPage() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [token] = useState(params.get('t') ?? '')
  const [repo] = useState(params.get('r') || DEFAULT_REPO)
  const [role] = useState(params.get('role') === 'viewer' ? 'viewer' : 'editor') // ลิงก์เชิญให้ได้เฉพาะ แก้ไขได้/ดูอย่างเดียว (แอดมินตั้งเพิ่มที่ตั้งค่าเท่านั้น)
  const [name, setName] = useState(getSync()?.name ?? '')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // ลบรหัสออกจากแถบที่อยู่/ประวัติของเบราว์เซอร์
    history.replaceState(null, '', `${location.pathname}#/join`)
  }, [])

  const join = async () => {
    if (!token) return setMsg({ ok: false, text: 'ลิงก์นี้ไม่มีรหัส ขอลิงก์ใหม่จากผู้ดูแล' })
    if (!name.trim()) return setMsg({ ok: false, text: 'ใส่ชื่อของท่านก่อน เพื่อให้รู้ว่าใครบันทึก' })
    setBusy(true)
    const cfg = { token, repo, name: name.trim() }
    const err = await testSync(cfg)
    setBusy(false)
    if (err) return setMsg({ ok: false, text: err })
    try {
      localStorage.setItem(INVITE_ROLE_KEY, role)
      localStorage.setItem('khatha.rejoin', '1')
      localStorage.removeItem('khatha.me.v1') // ตัวตนใหม่คำนวณจากชื่อที่ใส่ตอนเข้าร่วม
    } catch { /* ignore */ }
    saveSync(cfg)
    setMsg({ ok: true, text: 'เชื่อมต่อแล้ว ✓' })
    setTimeout(() => nav('/prayer', { replace: true }), 800)
  }

  return (
    <>
      <div className="page-head">
        <span className="page-icon" aria-hidden="true">☁️</span>
        <h1>เข้าร่วมใช้แอปด้วยกัน</h1>
      </div>
      <form className="card ai-keys" onSubmit={(e) => { e.preventDefault(); join() }}>
        <p>เครื่องนี้จะเข้าใช้แอปร่วมกับครอบครัว/ผู้ปกครองท่านอื่น{role === 'viewer' ? ' (สิทธิ์: ดูและฟังอย่างเดียว)' : ''} · โน้ต สคริปต์เร่งด่วน และถามตอบของท่านเป็นส่วนตัว คนอื่นไม่เห็น · ถ้าเคยใช้แอปนี้จากเครื่องอื่น ให้ใส่ชื่อเดิมของท่าน</p>
        <label htmlFor="join-name" className="ai-keys__label">ชื่อของท่าน</label>
        <input id="join-name" className="code-input" type="text" placeholder="เช่น แม่ลำเจียก" value={name} onChange={(e) => { setName(e.target.value); setMsg(null) }} autoFocus />
        <button type="submit" className="btn btn--gold" disabled={busy || !token}>{busy ? 'กำลังเชื่อมต่อ…' : '✓ เริ่มใช้ร่วมกัน'}</button>
        {!token && <p className="ai-keys__err">ลิงก์นี้ใช้แล้วหรือไม่มีรหัส ขอลิงก์ใหม่จากผู้ดูแล</p>}
        {msg && <p className={msg.ok ? 'ai-keys__ok' : 'ai-keys__err'} role="status">{msg.text}</p>}
      </form>
    </>
  )
}
