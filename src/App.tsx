import { HashRouter, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import Home from './pages/Home'
import Search from './pages/Search'
import Settings from './pages/Settings'
import { ComingSoon, KitPage } from './pages/Placeholders'

// HashRouter: ใช้ได้บนทุก Static Hosting โดยไม่ต้องตั้งค่า rewrite
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path="search" element={<Search />} />
          <Route path="settings" element={<Settings />} />
          <Route path="kit/:slug" element={<KitPage />} />
          <Route path="members" element={<ComingSoon icon="👤" title="สมาชิก" note="รายชื่อสมาชิกและประวัติการอภิบาลจะเปิดใช้หลังระบบเข้าสู่ระบบพร้อม" />} />
          <Route path="followups" element={<ComingSoon icon="📅" title="สิ่งที่ต้องติดตาม" note="ยังไม่มีรายการติดตาม" />} />
          <Route path="prayer" element={<ComingSoon icon="🙏" title="อธิษฐานเผื่อ" />} />
          <Route path="sermon" element={<ComingSoon icon="📖" title="เตรียมพระคำ" />} />
          <Route path="service" element={<ComingSoon icon="⛪" title="เตรียมพิธี" />} />
          <Route path="constitution" element={<ComingSoon icon="📜" title="ธรรมนูญและระเบียบคริสตจักร" note="จะเปิดใช้หลังได้รับไฟล์ธรรมนูญคริสตจักรภาค 7 และตรวจทานข้อความครบถ้วน" />} />
          <Route path="*" element={<ComingSoon icon="🔍" title="ไม่พบหน้านี้" note="กดปุ่มหน้าแรกด้านล่างเพื่อกลับ" />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
