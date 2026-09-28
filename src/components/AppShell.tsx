import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
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
