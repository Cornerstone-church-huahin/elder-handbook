# นำขึ้นเว็บ (Cloudflare Pages + GitHub)

Repo: `Cornerstone-church-huahin/elder-handbook`

## Cloudflare Pages
- Framework preset: None · Build command: `npm run build` · Build output directory: `dist`
- Environment variable (Build): `NODE_VERSION = 22`
- ลิงก์: `https://elder-handbook.pages.dev`

## ผู้ช่วย AI บนเว็บจริง (functions/api/ai.ts)
ตั้งใน Settings › Variables and Secrets (ชนิด Secret):
- `ANTHROPIC_API_KEY` — คีย์จาก console.anthropic.com (คิดค่าใช้จ่ายตามการใช้งาน)
- `ACCESS_CODE` — รหัสเข้าใช้ที่แจกเฉพาะผู้ปกครอง แล้วใส่ใน แอป › ⚙️ ตั้งค่า › รหัสเข้าใช้ผู้ช่วย AI
- `AI_MODEL` (ไม่บังคับ) — ค่าเริ่มต้น `claude-sonnet-5`
