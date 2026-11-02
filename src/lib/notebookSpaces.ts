/** สมุดเพิ่มเติมบนหน้าแรก (ชื่อ ไอคอน สี · cats = มีแถบเลือกหมวดและเฟืองจัดการหมวด) — แก้ชื่อ/ไอคอนที่นี่ที่เดียว (ที่เก็บข้อมูลผูกกับเลข 1–3 ไม่เปลี่ยนตามชื่อ) */
export const NOTEBOOK_SPACES = [
  { n: 1, name: 'ท่องจำคัมภีร์', icon: '📖', cls: 'nbk-btn--1', cats: true },
  { n: 2, name: 'สมุด 2', icon: '📘', cls: 'nbk-btn--2', cats: false },
  { n: 3, name: 'สมุด 3', icon: '📙', cls: 'nbk-btn--3', cats: false },
] as const
export const spaceOf = (n: number) => NOTEBOOK_SPACES.find((s) => s.n === n)
