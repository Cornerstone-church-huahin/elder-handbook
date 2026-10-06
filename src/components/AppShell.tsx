import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { READONLY_EVENT } from '../lib/access'
import { useMembership, useRole } from '../lib/members'
import PronEditor from './PronEditor'
import { useNotes } from '../lib/notes'
import TextTools from './TextTools'
import { TextHlContext, useTextHighlightsStore } from '../lib/textHighlights'
import { IconBack, IconCalendarCheck, IconHome, IconPeople, IconNote, IconSearch, IconSettings, StaffMark } from './Icons'

const TABS = [
  { to: '/', label: 'หน้าแรก', Icon: IconHome, end: true },
  { to: '/members', label: 'สมาชิก', Icon: IconPeople, end: false },
  { to: '/followups', label: 'ติดตาม', Icon: IconCalendarCheck, end: false },
  { to: '/notes', label: 'โน้ต', Icon: IconNote, end: false },
  { to: '/search', label: 'ค้นหา', Icon: IconSearch, end: false },
]
const TAB_ROOTS = TABS.map((t) => t.to)

export default function AppShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const isTabRoot = TAB_ROOTS.includes(pathname)
  const textHl = useTextHighlightsStore()
  const notes = useNotes()
  const role = useRole()
  const ms = useMembership()
  const [roToast, setRoToast] = useState(false)
  useEffect(() => {
    document.documentElement.dataset.role = role
  }, [role])
  useEffect(() => {
    let t = 0
    const on = () => { setRoToast(true); window.clearTimeout(t); t = window.setTimeout(() => setRoToast(false), 3500) }
    window.addEventListener(READONLY_EVENT, on)
    return () => { window.removeEventListener(READONLY_EVENT, on); window.clearTimeout(t) }
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <TextHlContext.Provider value={textHl}>
    <div className="app">
      <header className="topbar">
        {isTabRoot ? (
          <Link to="/" className="topbar__brand" aria-label="คู่มือผู้ปกครองคริสตจักร หน้าแรก">
            <StaffMark />
            <span className="topbar__names">
              <span className="topbar__name">คู่มือผู้ปกครองคริสตจักร</span>
              <span className="topbar__en">Church Elder's Handbook</span>
            </span>
          </Link>
        ) : (
          <div className="topbar__brand">
            <button type="button" className="topbar__back" onClick={() => navigate(-1)}>
              <IconBack /> ย้อนกลับ
            </button>
          </div>
        )}
        <div id="topbar-slot" className="topbar__slot" />
        <Link to="/settings" className="icon-btn" aria-label="ตั้งค่า">
          <IconSettings />
        </Link>
      </header>

      {role === 'viewer' && <p className="role-bar" role="status">👁️ สิทธิ์ของท่าน: <b>ดูและฟังอย่างเดียว</b> — ส่วนที่ใช้ร่วมกันเพิ่ม แก้ไข ลบไม่ได้ (ขอแอดมินปรับสิทธิ์ได้)</p>}
      {ms.needAdmin && (
        <section className="card role-first" role="alertdialog" aria-label="ตั้งแอดมินคนแรก">
          <h2>ยังไม่มีแอดมินของการใช้ร่วมกัน</h2>
          <p>เครื่องนี้คือ <b>เจ้าของ/แอดมินคนแรก</b> ใช่ไหม? แอดมินเชิญคนเข้ามา กำหนดสิทธิ์ และลบคนได้ (แอดมินร่วมเพิ่มได้ภายหลังที่ตั้งค่า)</p>
          <div className="duty__btns">
            <button type="button" className="btn btn--gold" onClick={ms.becomeAdmin}>✓ ใช่ ฉันเป็นแอดมิน</button>
            <button type="button" className="btn btn--ghost" onClick={ms.joinAsMember}>ไม่ใช่ ฉันเป็นผู้ใช้ร่วม</button>
          </div>
        </section>
      )}
      {ms.removed && (
        <section className="card role-first" role="alert">
          <h2>ท่านถูกนำออกจากการใช้ร่วมกันแล้ว</h2>
          <p>เครื่องนี้หยุดใช้ร่วมกับคนอื่น ข้อมูลที่อยู่ในเครื่องนี้ยังอยู่ ถ้าต้องการกลับมา ให้ขอลิงก์เชิญใหม่จากแอดมิน</p>
          <button type="button" className="btn btn--ghost" onClick={ms.dismissRemoved}>รับทราบ</button>
        </section>
      )}
      {roToast && <p className="role-toast" role="alert">👁️ สิทธิ์ของท่านดูและฟังอย่างเดียว — เพิ่ม แก้ไข หรือลบไม่ได้</p>}

      <main className="main">
        <Outlet />
      </main>

      <PronEditor />
      <TextTools />

      <nav className="bottomnav" aria-label="เมนูหลัก">
        <ul>
          {TABS.map(({ to, label, Icon, end }) => (
            <li key={to}>
              <NavLink to={to} end={end}>
                <Icon />
                <span>{label}</span>
                {to === '/notes' && notes.dueToday > 0 && <b className="nav-badge" aria-label={`วันนี้ ${notes.dueToday} เรื่อง`}>{notes.dueToday}</b>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
    </TextHlContext.Provider>
  )
}
