# คทาผู้เลี้ยง (The Shepherd's Staff) — V0.1

PWA ผู้ช่วยงานอภิบาลสำหรับผู้ปกครองคริสตจักร

## คำสั่ง
```bash
npm install
npm run dev       # เปิดทดสอบในเครื่อง
npm run build     # สร้างไฟล์สำหรับขึ้นเว็บ (โฟลเดอร์ dist)
npm run preview   # เปิดไฟล์ที่ build แล้ว (พอร์ต 4173)
node scripts/smoke-test.mjs   # ทดสอบหน้าจอมือถือ 360/390/768px × ตัวอักษร 100/125/150%
```

## Deploy (Cloudflare Pages)
- Build command: `npm run build`
- Output directory: `dist`

## โครงสร้าง
- `src/styles/tokens.css` — Design System (สี, ฟอนต์, ขนาดตัวอักษร 100/125/150%, ธีมมืด)
- `src/data/contentRepo.ts` — จุดเดียวที่หน้าจอดึงเนื้อหา (A1 อ่าน seed, A2 เปลี่ยนเป็น Supabase)
- `src/data/seed/` — ข้อมูลตั้งต้น 10 สถานการณ์ + การ์ดหน้าแรก (ย้ายเข้า DB ใน Step A2)
- `src/pages/` — หน้าจอ

## กติกาสำคัญ
- ห้ามฝังเนื้อหาอภิบาลลงในหน้าจอ ให้ผ่าน `contentRepo` เสมอ
- Service Worker cache เฉพาะตัวแอปและฟอนต์ ห้าม cache ข้อมูลสมาชิก/การเยี่ยม
- ห้ามใส่ข้อความพระคัมภีร์หรือธรรมนูญที่ AI แต่ง

## ความคืบหน้า
- [x] A1 Project setup, Design System, App shell, หน้าแรก, ตั้งค่าขนาดตัวอักษร
- [ ] A2 Database + seed 10 สถานการณ์
- [~] A3 Pastoral Kit + Field Mode (มีแล้วแบบร่างโดย AI; รอเนื้อหาที่อนุมัติจาก DB)
- [x] ทดลอง AI: src/lib/ai.ts (ตอนนี้ใช้ Claude ของผู้เปิดดูในพรีวิว, อนาคตเปลี่ยนเป็น Supabase Edge Function)
- [x] ระเบียบปฏิบัติของธรรมนูญภาค 7 (2021): 210 ข้อ, สารบัญ, ค้นหา, ถาม AI แบบอ้างเลขข้อ
  - สร้างข้อมูลใหม่: `python3 scripts/parse_charter.py <pdf> public/data/charter-bylaws-2021.json`
  - ข้อความดึงอัตโนมัติ ต้องตรวจทานกับฉบับพิมพ์
- [ ] A4 Login + Workspace
- [ ] A5–A8
