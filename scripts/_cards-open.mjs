// เทสต์ส่วนใหญ่ตรวจปุ่ม/ข้อความบนการ์ด → ตั้งให้การ์ดขยายเป็นค่าเริ่มต้นในเทสต์ (ผู้ใช้จริงจะเห็นแบบย่อ · พฤติกรรมแบบย่อทดสอบใน test-verse-cards.mjs)
export function cardsOpenByDefault(browser) {
  const o = browser.newContext.bind(browser)
  browser.newContext = async (...a) => { const c = await o(...a); await c.addInitScript(() => { try { localStorage.setItem('khatha.sm.cards', 'open') } catch { /* ignore */ } }); return c }
}
