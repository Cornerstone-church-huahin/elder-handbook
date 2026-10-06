import { useState } from 'react'
import { ROLE_LABEL, type Role } from '../lib/access'
import { useMembers } from '../lib/members'
import { DEFAULT_REPO, getSync } from '../lib/sync'

const fmt = (t: number) => (t ? new Date(t).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '')

/** ผู้ใช้ร่วม: ทุกคนดูรายชื่อได้ · แอดมินเปลี่ยนสิทธิ์/ลบคน/ส่งลิงก์เชิญได้ */
export default function MembersPanel() {
  const m = useMembers()
  const [delId, setDelId] = useState<string | null>(null)
  const [inviteRoles, setInviteRoles] = useState<Record<string, Role>>({})
  const [msg, setMsg] = useState('')
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor')
  const [inviteFor, setInviteFor] = useState('')
  const cfg = getSync()
  if (!cfg) return null
  const flash = (t: string) => { setMsg(t); window.setTimeout(() => setMsg(''), 3000) }
  const link = `${location.origin}${location.pathname}#/join?t=${encodeURIComponent(cfg.token)}${cfg.repo !== DEFAULT_REPO ? `&r=${encodeURIComponent(cfg.repo)}` : ''}&role=${inviteRole}${inviteFor.trim() ? `&for=${encodeURIComponent(inviteFor.trim())}` : ''}`
  const share = async () => {
    const text = `ขอเชิญร่วมใช้แอปคู่มือผู้ปกครองคริสตจักร${inviteFor.trim() ? ` (ถึง ${inviteFor.trim()})` : ''} — เปิดลิงก์นี้ แล้วพิมพ์ชื่อของท่านเพื่อส่งคำขอ แอดมินอนุมัติแล้วจึงใช้ได้:\n${link}`
    try {
      if (navigator.share) await navigator.share({ title: 'เข้าร่วมแอปคู่มือผู้ปกครองคริสตจักร', text })
      else { await navigator.clipboard.writeText(text); flash('คัดลอกลิงก์แล้ว วางในแชตส่วนตัวได้เลย (อย่าโพสต์ในกลุ่ม)') }
    } catch { /* ผู้ใช้ปิดหน้าต่างแชร์ */ }
  }
  return (
    <section className="card members" aria-label="บัญชีผู้ใช้">
      <h2 style={{ fontSize: '1.2rem' }}>👤 บัญชีผู้ใช้</h2>

      {m.isAdmin && (
        <div className="invite">
          <h3 className="members__h">① ส่งลิงก์เชิญ</h3>
          <label className="ai-keys__label" htmlFor="invite-for">ส่งให้ใคร (ชื่อ — ไว้เทียบตอนอนุมัติ)</label>
          <input id="invite-for" className="us-input" type="text" value={inviteFor} maxLength={40} placeholder="เช่น น้องสาว" onChange={(e) => setInviteFor(e.target.value)} />
          <label className="ai-keys__label" htmlFor="invite-role">สิทธิ์ที่ตั้งใจให้ (เปลี่ยนได้ตอนอนุมัติ)</label>
          <select id="invite-role" className="us-input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}>
            <option value="editor">{ROLE_LABEL.editor}</option>
            <option value="viewer">{ROLE_LABEL.viewer}</option>
          </select>
          <button type="button" className="btn btn--gold" onClick={share}>📤 ส่งลิงก์ทาง Line หรืออื่น ๆ</button>
          <p className="source-note">ผู้รับเปิดลิงก์ → พิมพ์ชื่อ → ส่งคำขอ → <b>คุณเห็นคำขอที่นี่และกดอนุมัติ</b> ผู้รับยังใช้แอปไม่ได้จนกว่าจะอนุมัติ · ส่งเฉพาะแชตส่วนตัว อย่าโพสต์ในกลุ่ม</p>
        </div>
      )}

      {m.isAdmin && (
        <div className="members__pending" aria-live="polite">
          <h3 className="members__h">② คำขอร่วมใช้ที่รออนุมัติ ({m.pending.length})</h3>
          {m.pending.length === 0 && <p className="source-note">ยังไม่มีคำขอ <button type="button" className="mini" onClick={m.syncNow}>🔄 ตรวจคำขอใหม่</button></p>}
          <ul className="members__list">
            {m.pending.map((x) => {
              const want = inviteRoles[x.id] ?? x.role
              const matches = !x.invitedFor || x.invitedFor.trim().toLowerCase() === x.name.trim().toLowerCase()
              return (
                <li key={x.id} className="members__row members__row--pending">
                  <div className="members__who">
                    <b>{x.name}</b>
                    <small>{x.invitedFor ? (matches ? `✓ ตรงกับชื่อที่ส่งลิงก์ให้ (${x.invitedFor})` : `⚠️ ลิงก์นี้ส่งให้ “${x.invitedFor}” แต่ผู้ขอใช้ชื่อ “${x.name}” — ตรวจให้แน่ใจก่อนอนุมัติ`) : 'ลิงก์ไม่ได้ระบุชื่อผู้รับ — ตรวจว่าเป็นคนที่คุณส่งไปหรือไม่'}</small>
                  </div>
                  <div className="members__ctl">
                    <label className="sr-only" htmlFor={`ap-${x.id}`}>สิทธิ์ที่จะให้ {x.name}</label>
                    <select id={`ap-${x.id}`} className="us-input members__sel" value={want} onChange={(e) => setInviteRoles({ ...inviteRoles, [x.id]: e.target.value as Role })}>
                      {(['admin', 'editor', 'viewer'] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                    <button type="button" className="btn btn--gold" onClick={() => { m.approve(x.id, want); flash(`อนุมัติ ${x.name} แล้ว (${ROLE_LABEL[want]})`) }}>✓ อนุมัติ</button>
                    <button type="button" className="btn btn--ghost" onClick={() => { m.reject(x.id); flash(`ไม่อนุมัติ ${x.name}`) }}>✕ ไม่อนุมัติ</button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <h3 className="members__h">{m.isAdmin ? '③ ' : ''}ผู้ใช้ร่วม ({m.members.length} คน)</h3>
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
      {!m.isAdmin && <p className="source-note">เฉพาะแอดมินส่งลิงก์เชิญ อนุมัติคำขอ เปลี่ยนสิทธิ์ หรือลบคน · อยากให้ภรรยาเป็นแอดมินร่วม: ให้เธอขอร่วมใช้ แล้วเลือกสิทธิ์ “แอดมิน” ตอนอนุมัติ</p>}
      <p className="source-note">โน้ต สคริปต์เร่งด่วน และถามตอบ เป็นส่วนตัวรายคน คนอื่น (รวมแอดมิน) ไม่เห็นในแอป · แอป AI และคีย์ AI เป็นของแต่ละเครื่อง · สิทธิ์และความเป็นส่วนตัวเป็นการกันในแอป ไม่ใช่การล็อกระดับ GitHub — ลบคนแล้วควรเปลี่ยนรหัสเข้าใช้ร่วมใหม่ถ้าต้องการตัดขาดจริง</p>
    </section>
  )
}
