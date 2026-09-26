# การเผยแพร่ (GitHub Pages)

- push ขึ้น `main` → GitHub Actions (`.github/workflows/pages.yml`) build และเผยแพร่อัตโนมัติ
- ที่อยู่เว็บ: https://cornerstone-church-huahin.github.io/elder-handbook/

## ผู้ช่วย AI (ไม่บังคับ)
- ไม่มีคีย์: หน้าอธิษฐานสร้างคำอธิษฐานจากข้อมูลในแอป (`src/lib/prayerLocal.ts`) ได้ทันที
- มีคีย์: เลือก Claude, Gemini หรือ ChatGPT แล้วใส่คีย์ที่ **ตั้งค่า › ผู้ช่วย AI** (ชื่อรุ่นแก้ได้ในส่วนขั้นสูง) — เก็บใน localStorage ของเครื่องนั้นเท่านั้น
- ห้ามใส่คีย์ลงในโค้ดหรือ repo นี้ (repo เป็นสาธารณะ)
