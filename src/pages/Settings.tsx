import { FONT_SCALES, useFontScale } from '../lib/prefs'

export default function Settings() {
  const { scale, setScale } = useFontScale()

  return (
    <>
      <div className="page-head">
        <h1>ตั้งค่า</h1>
      </div>

      <section className="card" aria-labelledby="font-title">
        <h2 id="font-title" style={{ fontSize: '1.2rem' }}>ขนาดตัวอักษร</h2>
        <p style={{ color: 'var(--ink-soft)' }}>เลือกขนาดที่อ่านสบายตาที่สุด ทั้งแอปจะขยายตาม</p>
        <div className="scale-options" role="group" aria-label="ขนาดตัวอักษร">
          {FONT_SCALES.map((s) => (
            <button
              key={s}
              id={`scale-${s}`}
              type="button"
              className="scale-option"
              aria-pressed={scale === s}
              onClick={() => setScale(s)}
            >
              <span className="scale-option__sample" style={{ fontSize: `${s / 100}em` }}>ก</span>
              <span className="scale-option__pct">{s === 100 ? 'ปกติ' : s === 125 ? 'ใหญ่' : 'ใหญ่มาก'} {s}%</span>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 style={{ fontSize: '1.2rem' }}>บัญชีผู้ใช้</h2>
        <p style={{ color: 'var(--ink-soft)' }}>การเข้าสู่ระบบและพื้นที่ทำงานร่วมกันของคู่ผู้ปกครองจะเปิดใช้ในรุ่นถัดไป</p>
      </section>

      <p className="disclaimer">คทาผู้เลี้ยง รุ่น 0.1 (ทดลอง)</p>
    </>
  )
}
