import { Link } from 'react-router-dom'
import { FONT_SCALES, useFontScale } from '../lib/prefs'
import { useElderDuties } from '../lib/elderDuties'
import { useState } from 'react'
import { getAccessCode, isStandaloneSite, setAccessCode } from '../lib/ai'

export default function Settings() {
  const { scale, setScale } = useFontScale()
  const { list } = useElderDuties()
  const [code, setCode] = useState(getAccessCode)
  const [savedCode, setSavedCode] = useState(false)

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

      <Link to="/settings/duties" className="result settings-row">
        <span className="result__icon" aria-hidden="true">📋</span>
        <span className="result__body">
          <span className="result__title">หน้าที่ผู้ปกครอง</span>
          <span className="art-where">{list.length} ข้อ · เพิ่ม แก้ไข ลบ หรือเลื่อนลำดับ</span>
        </span>
        <span aria-hidden="true" className="settings-row__go">›</span>
      </Link>

      {isStandaloneSite() && (
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault()
            setAccessCode(code)
            setSavedCode(true)
          }}
        >
          <label htmlFor="ai-code" style={{ fontSize: '1.2rem', fontWeight: 700 }}>🔑 รหัสเข้าใช้ผู้ช่วย AI</label>
          <p style={{ color: 'var(--ink-soft)' }}>ใส่ครั้งเดียวต่อเครื่อง ขอรหัสจากผู้ดูแลระบบของคริสตจักร</p>
          <input
            id="ai-code"
            className="code-input"
            type="password"
            autoComplete="off"
            value={code}
            onChange={(e) => {
              setCode(e.target.value)
              setSavedCode(false)
            }}
          />
          <button type="submit" className="btn">บันทึกรหัส</button>
          {savedCode && <p className="source-note">บันทึกแล้ว ใช้ผู้ช่วย AI ได้ทุกหน้า</p>}
        </form>
      )}

      <section className="card">
        <h2 style={{ fontSize: '1.2rem' }}>บัญชีผู้ใช้</h2>
        <p style={{ color: 'var(--ink-soft)' }}>การเข้าสู่ระบบและพื้นที่ทำงานร่วมกันของคู่ผู้ปกครองจะเปิดใช้ในรุ่นถัดไป</p>
      </section>

      <p className="disclaimer">คู่มือผู้ปกครองคริสตจักร (Church Elder's Handbook) รุ่น 0.1 (ทดลอง)</p>
    </>
  )
}
