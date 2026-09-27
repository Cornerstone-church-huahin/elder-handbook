import { useState } from 'react'
import { AI_APPS, openAiApp, type AiAppId } from '../lib/gemini'

/** ปุ่มส่งเข้าแอป AI ที่สมัครไว้ 3 ปุ่ม: Gemini · ChatGPT · Claude (ไม่ใช้ API) */
export default function AiApps({ text, title }: { text?: string; title?: string }) {
  const [sent, setSent] = useState<AiAppId | null>(null)
  const app = AI_APPS.find((a) => a.id === sent)
  return (
    <div className="ai-apps">
      {title && <p className="ai-apps__title">{title}</p>}
      <div className="ai-apps__row">
        {AI_APPS.map((a) => (
          <button key={a.id} type="button" className={`ai-app ai-app--${a.id}`} onClick={() => { openAiApp(a.id, text); setSent(a.id) }}>
            <span aria-hidden="true">{a.icon}</span> {a.name}
          </button>
        ))}
      </div>
      <p className="ai-apps__hint">เข้าสู่ระบบในแต่ละ AI ครั้งเดียว ครั้งต่อไปจะเข้าได้เลย · กลับมาแอปนี้: กด ✕ มุมซ้ายบน หรือปุ่มย้อนกลับ ◁ ของมือถือ</p>
      {text && app && (
        <p className="source-note">
          {app.prefill ? `ใส่คำถามในช่องพิมพ์ของ ${app.name} ให้แล้ว (คัดลอกไว้ด้วย)` : `คัดลอก “${text}” แล้ว · กดค้างในช่องพิมพ์ของ ${app.name} แล้วเลือก “วาง”`} · อย่าใส่ชื่อจริงของสมาชิก
        </p>
      )}
    </div>
  )
}
