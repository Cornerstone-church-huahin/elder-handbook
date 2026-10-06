import { Link } from 'react-router-dom'
import type { SharedItem, SyncStatus } from '../lib/sync'

/** เวลาแบบสั้น: วันนี้ → 06:16 น. · วันอื่น → 26 ก.ย. 16:16 น. */
function when(t: number) {
  const d = new Date(t)
  const hm = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  return d.toDateString() === new Date().toDateString() ? `${hm} น.` : `${d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} ${hm} น.`
}

/** บรรทัดบอกสถานะออนไลน์ของข้อมูลที่ใช้ร่วมกัน (สคริปต์เร่งด่วน / ถามตอบ) — ให้เห็นชัดว่าอีกเครื่องเห็นข้อมูลนี้หรือยัง */
export default function SharedSyncLine({ sync, items, onRetry }: { sync: SyncStatus; items: (SharedItem & { title?: string; q?: string })[]; onRetry: () => void }) {
  const last = items.filter((x) => x.by && x.updated > 0).sort((a, b) => b.updated - a.updated)[0]
  if (sync.state === 'off')
    return (
      <p className="nb-sync nb-sync--off" role="status">
        📱 <b>ข้อมูลนี้อยู่เฉพาะเครื่องนี้</b> — ยังไม่ได้เชื่อมออนไลน์ อีกเครื่องจะไม่เห็น · <Link to="/settings">ใส่รหัสเข้าใช้ร่วมที่ตั้งค่า ›</Link>
      </p>
    )
  if (sync.state === 'error')
    return (
      <p className="nb-sync nb-sync--err" role="alert">
        ⚠️ {sync.message} (ข้อมูลยังอยู่ในเครื่องนี้) <button type="button" onClick={onRetry}>ลองอีกครั้ง</button>
      </p>
    )
  if (sync.state === 'ok')
    return (
      <p className="nb-sync nb-sync--ok" role="status">
        ☁️ ใช้ร่วมกันออนไลน์แล้ว · ซิงก์ล่าสุด {when(sync.at)}
        {last && <> · แก้ไขล่าสุดโดย <b>{last.by}</b></>} <button type="button" onClick={onRetry}>🔄 ซิงก์ตอนนี้</button>
      </p>
    )
  return <p className="nb-sync" role="status">☁️ กำลังซิงก์ออนไลน์…</p>
}
