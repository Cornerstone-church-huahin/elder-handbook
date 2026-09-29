import { HashRouter, MemoryRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import AppShell from './components/AppShell'
import Home from './pages/Home'
import Search from './pages/Search'
import NotesPage from './pages/Notes'
import { OccasionPage, OccasionsHome } from './pages/Occasions'
import Settings from './pages/Settings'
import { AskPage, ComingSoon, KitPage } from './pages/Placeholders'
import { CharterArticlePage, CharterAsk, CharterHome } from './pages/Charter'
import { PeopleCompare, PeopleHome, PersonPage } from './pages/People'
import PersonStory from './pages/PersonStory'
import { ManagementAsk, ManagementHome, ManagementTopic } from './pages/Management'
import PrayerAiPage from './pages/Prayer'
import PrayerNotebookPage from './pages/PrayerNotebook'
import JoinPage from './pages/Join'
import ElderDutiesPage from './pages/ElderDuties'
import { BibleBookPage, BibleChapterPage, BibleHome } from './pages/Bible'

// HashRouter: ใช้ได้บนทุก Static Hosting โดยไม่ต้องตั้งค่า rewrite
// MemoryRouter: ใช้เฉพาะไฟล์พรีวิว (npm run build:preview) ที่เปิดในกรอบซึ่งไม่มี URL จริง
const Router = import.meta.env.VITE_EMBED ? MemoryRouter : HashRouter

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path="search" element={<Search />} />
          <Route path="notes" element={<NotesPage />} />
          <Route path="occasions" element={<OccasionsHome />} />
          <Route path="occasions/:id" element={<OccasionPage />} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/duties" element={<ElderDutiesPage />} />
          <Route path="kit/:slug" element={<KitPage />} />
          <Route path="ask" element={<AskPage />} />
          <Route path="members" element={<ComingSoon icon="👤" title="สมาชิก" note="รายชื่อสมาชิกและประวัติการอภิบาลจะเปิดใช้หลังระบบเข้าสู่ระบบพร้อม" />} />
          <Route path="followups" element={<ComingSoon icon="📅" title="สิ่งที่ต้องติดตาม" note="ยังไม่มีรายการติดตาม" />} />
          <Route path="prayer" element={<PrayerNotebookPage />} />
          <Route path="prayer/ai" element={<PrayerAiPage />} />
          <Route path="join" element={<JoinPage />} />
          <Route path="prayer/saved/:id" element={<SavedRedirect />} />
          <Route path="sermon" element={<Navigate to="/bible" replace />} />
          <Route path="bible" element={<BibleHome />} />
          <Route path="bible/:book" element={<BibleBookPage />} />
          <Route path="bible/:book/:ch" element={<BibleChapterPage />} />
          <Route path="service" element={<ComingSoon icon="⛪" title="เตรียมพิธี" />} />
          <Route path="people" element={<PeopleHome />} />
          <Route path="people/compare" element={<PeopleCompare />} />
          <Route path="people/:id" element={<PersonPage />} />
          <Route path="people/:id/story" element={<PersonStory />} />
          <Route path="manage" element={<ManagementHome />} />
          <Route path="manage/ask" element={<ManagementAsk />} />
          <Route path="manage/:id" element={<ManagementTopic />} />
          <Route path="constitution" element={<CharterHome />} />
          <Route path="constitution/a/:no" element={<CharterArticlePage />} />
          <Route path="constitution/ask" element={<CharterAsk />} />
          <Route path="*" element={<ComingSoon icon="🔍" title="ไม่พบหน้านี้" note="กดปุ่มหน้าแรกด้านล่างเพื่อกลับ" />} />
        </Route>
      </Routes>
    </Router>
  )
}

/** ลิงก์เก่า /prayer/saved/:id → เปิดการ์ดนั้นในสมุดคำอธิษฐาน */
function SavedRedirect() {
  const { id } = useParams()
  return <Navigate to={`/prayer?open=${encodeURIComponent(id ?? '')}`} replace />
}
