import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { IconBack, IconCalendarCheck, IconHome, IconPeople, IconSearch, IconSettings, StaffMark } from './Icons'

const TABS = [
  { to: '/', label: 'หน้าแรก', Icon: IconHome, end: true },
  { to: '/members', label: 'สมาชิก', Icon: IconPeople, end: false },
  { to: '/followups', label: 'ติดตาม', Icon: IconCalendarCheck, end: false },
  { to: '/search', label: 'ค้นหา', Icon: IconSearch, end: false },
]
const TAB_ROOTS = TABS.map((t) => t.to)

export default function AppShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const isTabRoot = TAB_ROOTS.includes(pathname)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="app">
      <header className="topbar">
        {isTabRoot ? (
          <Link to="/" className="topbar__brand" aria-label="คทาผู้เลี้ยง หน้าแรก">
            <StaffMark />
            <span className="topbar__name">คทาผู้เลี้ยง</span>
          </Link>
        ) : (
          <div className="topbar__brand">
            <button type="button" className="topbar__back" onClick={() => navigate(-1)}>
              <IconBack /> ย้อนกลับ
            </button>
          </div>
        )}
        <Link to="/settings" className="icon-btn" aria-label="ตั้งค่า">
          <IconSettings />
        </Link>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <nav className="bottomnav" aria-label="เมนูหลัก">
        <ul>
          {TABS.map(({ to, label, Icon, end }) => (
            <li key={to}>
              <NavLink to={to} end={end}>
                <Icon />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
