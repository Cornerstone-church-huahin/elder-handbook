import { useState } from 'react'
import { ROLE_LABEL, type Role } from '../lib/access'
import { useMembers } from '../lib/members'
import { DEFAULT_REPO, getSync } from '../lib/sync'

const fmt = (t: number) => (t ? new Date(t).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '')

/** ผู้ใช้ร่วม: ทุกคนดูรายชื่อได้ · แอดมินเปลี่ยนสิทธิ์/ลบคน/ส่งลิงก์เชิญได้ */
export default function MembersPanel() {
  const m = useMembers()
  const [delId, setDelId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor')
  const cfg = getSync()
  if (!cfg) return null
  const flash = (t: string) => { setMsg(t); window.setTimeout(() => setMsg(''), 3000) }
  const link = `${location.origin}${location.pathname}#/join?t=${encodeURIComponent(cfg.token)}${cfg.repo !== DEFAULT_REPO ? `&r=${encodeURIComponent(cfg.repo)}` : ''}&role=${inviteRole}`
  const share = async () => {
    const text = `ลิงก์เข้าร่วมแอปคู่มือผู้ปกครองคริสตจักร (สิทธิ์: ${ROLE_LABEL[inviteRole]}) เปิดครั้งเดียวบนมือถือของท่านแล้วพิมพ์ชื่อ:\n${link}`
    try {
      if (navigator.share) await navigator.share({ title: 'เข้าร่วมแอปคู่มือผู้ปกครองคริสตจักร', text })
      else { await navigator.clipboard.writeText(text); flash('คัดลอกลิงก์แล้ว วางในแชตส่วนตัวได้เลย (อย่าโพสต์ในกลุ่ม)') }
    } catch { /* ผู้ใช้ปิดหน้าต่างแชร์ */ }
  }
  return (
    <section className="card members" aria-label="ผู้ใช้ร่วม">
      <h2 style={{ fontSize: '1.1rem' }}>👥 ผู้ใช้ร่วม ({m.members.length} คน)</h2>
      {m.sync.state === 'off' && <p className="source-note">ยังไม่ได้เชื่อมออนไลน์</p>}
      {m.members.length === 0 && <p className="source-note">ยังไม่มีรายชื่อ — จะขึ้นเมื่อซิงก์ครั้งแรกเสร็จ <button type="button" className="mini" onClick={m.syncNow}>🔄 ซิงก์ตอนนี้</button></p>}
      <ul className="members__list">
        {m.members.map((x) => {
          const isMe = x.id === m.meId
          const lastAdmin = x.role === 'admin' && m.adminCount <= 1
          return (
            <li key={x.id} className="members__row">
              <div className="members__who">
                <b>{x.name}</b>{isMe && <span className="badge">คุณ</span>}
                <small>เข้าร่วม {fmt(x.joined)}</small>
              </div>
              {m.isAdmin ? (
                <div className="members__ctl">
                  <label className="sr-only" htmlFor={`role-${x.id}`}>สิทธิ์ของ {x.name}</label>
                  <select id={`role-${x.id}`} className="us-input members__sel" value={x.role} disabled={lastAdmin}
                    onChange={(e) => { if (!m.setRole(x.id, e.target.value as Role)) flash('ต้องมีแอดมินอย่างน้อย 1 คน') }}>
                    {(['admin', 'editor', 'viewer'] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                  {delId === x.id ? (
                    <span className="members__del">
                      <button type="button" className="btn btn--danger" onClick={() => { if (!m.removeMember(x.id)) flash('ลบแอดมินคนสุดท้ายไม่ได้'); setDelId(null) }}>ลบ {x.name}</button>
                      <button type="button" className="btn btn--ghost" onClick={() => setDelId(null)}>ไม่ลบ</button>
                    </span>
                  ) : (
                    <button type="button" className="mini" disabled={lastAdmin} onClick={() => setDelId(x.id)} aria-label={`ลบ ${x.name}`}>🗑️ ลบ</button>
                  )}
                </div>
              ) : (
                <span className="badge">{ROLE_LABEL[x.role]}</span>
              )}
            </li>
          )
        })}
      </ul>
      {msg && <p className="ai-keys__ok" role="status">{msg}</p>}
      {m.isAdmin ? (
        <div className="invite">
          <label className="ai-keys__label" htmlFor="invite-role">เชิญคนเพิ่ม — สิทธิ์เริ่มต้นของผู้ที่เปิดลิงก์</label>
          <select id="invite-role" className="us-input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}>
            <option value="editor">{ROLE_LABEL.editor}</option>
            <option value="viewer">{ROLE_LABEL.viewer}</option>
          </select>
          <button type="button" className="btn btn--ghost" onClick={share}>📤 ส่งลิงก์เชิญ</button>
          <p className="source-note">ผู้รับเปิดลิงก์ครั้งเดียว พิมพ์ชื่อ แล้วเข้าใช้ร่วมได้ · อยากให้ภรรยาเป็นแอดมินร่วม: ให้เธอเข้าร่วมก่อน แล้วเปลี่ยนสิทธิ์เธอเป็น "แอดมิน" ในรายชื่อนี้</p>
        </div>
      ) : (
        <p className="source-note">เฉพาะแอดมินเปลี่ยนสิทธิ์ ลบคน หรือส่งลิงก์เชิญได้</p>
      )}
      <p className="source-note">โน้ต สคริปต์เร่งด่วน และถามตอบ เป็นส่วนตัวรายคน คนอื่น (รวมแอดมิน) ไม่เห็นในแอป · แอป AI และคีย์ AI เป็นของแต่ละเครื่อง · สิทธิ์และความเป็นส่วนตัวเป็นการกันในแอป ไม่ใช่การล็อกระดับ GitHub — ลบคนแล้วควรเปลี่ยนรหัสเข้าใช้ร่วมใหม่ถ้าต้องการตัดขาดจริง</p>
    </section>
  )
}
