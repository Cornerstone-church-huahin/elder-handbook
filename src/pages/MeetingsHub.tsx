import { Link } from 'react-router-dom'

/** การประชุม — ศูนย์รวม 3 เครื่องมือ: มติที่ประชุม · ตารางการประชุม · การเตรียมงาน */
const ITEMS = [
  { to: '/meetings/minutes', icon: '📝', title: 'มติที่ประชุม', note: 'บันทึกมติ แนบ PDF/Word ค้นหาได้', cls: 'meet-card--gold' },
  { to: '/meetings/schedule', icon: '🗓️', title: 'ตารางการประชุม', note: 'นัดหมาย วัน เวลา สถานที่ วาระ', cls: '' },
  { to: '/meetings/prep', icon: '✅', title: 'การเตรียมงาน', note: 'รายการสิ่งที่ต้องเตรียม ติ๊กเมื่อเสร็จ', cls: '' },
]

export default function MeetingsHub() {
  return (
    <>
      <div className="page-head">
        <span className="page-icon" aria-hidden="true">🗂️</span>
        <h1>การประชุม</h1>
        <p>เลือกสิ่งที่ต้องการใช้</p>
      </div>
      <div className="meet-grid">
        {ITEMS.map((x) => (
          <Link key={x.to} to={x.to} className={`meet-card ${x.cls}`}>
            <span className="meet-card__i" aria-hidden="true">{x.icon}</span>
            <span className="meet-card__t">{x.title}</span>
            <span className="meet-card__n">{x.note}</span>
          </Link>
        ))}
      </div>
    </>
  )
}
