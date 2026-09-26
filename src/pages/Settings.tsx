import { Link } from 'react-router-dom'
import { FONT_SCALES, useFontScale } from '../lib/prefs'
import { useElderDuties } from '../lib/elderDuties'
import { useState } from 'react'
import { DEFAULT_REPO, getSync, saveSync, testSync } from '../lib/sync'
import { getAiSettings, isStandaloneSite, saveAiSettings, testAiKey, VENDORS, type AiSettings, type AiVendor } from '../lib/ai'

export default function Settings() {
  const { scale, setScale } = useFontScale()
  const { list } = useElderDuties()

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

      {isStandaloneSite() && <SyncSettings />}
      {isStandaloneSite() && <AiKeySettings />}

      <section className="card">
        <h2 style={{ fontSize: '1.2rem' }}>บัญชีผู้ใช้</h2>
        <p style={{ color: 'var(--ink-soft)' }}>การเข้าสู่ระบบและพื้นที่ทำงานร่วมกันของคู่ผู้ปกครองจะเปิดใช้ในรุ่นถัดไป</p>
      </section>

      <p className="disclaimer">คู่มือผู้ปกครองคริสตจักร (Church Elder's Handbook) รุ่น 0.1 (ทดลอง)</p>
    </>
  )
}

/** ตั้งค่าคีย์ AI: เลือกได้ Claude · Gemini · ChatGPT เก็บคีย์ในเครื่องนี้เท่านั้น */
function AiKeySettings() {
  const [st, setSt] = useState<AiSettings>(getAiSettings)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const v = VENDORS.find((x) => x.id === st.vendor)!
  const key = st.keys[st.vendor] ?? ''
  const model = st.models[st.vendor] ?? ''
  const edit = (patch: Partial<AiSettings>) => {
    setSt((s) => ({ ...s, ...patch }))
    setMsg(null)
  }
  const pick = (id: AiVendor) => edit({ vendor: id })
  const save = () => {
    saveAiSettings(st)
    setMsg({ ok: true, text: key.trim() ? `บันทึกแล้ว ใช้ ${v.label} ทุกหน้า` : 'บันทึกแล้ว (ไม่มีคีย์ — ใช้ข้อมูลในแอป)' })
  }
  const test = async () => {
    if (!key.trim()) return setMsg({ ok: false, text: 'ใส่คีย์ก่อน' })
    setTesting(true)
    setMsg(null)
    const err = await testAiKey(st.vendor, key, model || v.model)
    setTesting(false)
    if (err) return setMsg({ ok: false, text: err })
    saveAiSettings(st)
    setMsg({ ok: true, text: `ใช้ได้ ✓ บันทึกแล้ว ใช้ ${v.label} ทุกหน้า` })
  }

  return (
    <form className="card ai-keys" onSubmit={(e) => { e.preventDefault(); save() }}>
      <h2 style={{ fontSize: '1.1rem' }}>🔑 ผู้ช่วย AI (ไม่บังคับ)</h2>
      <p className="source-note">ใส่คีย์แล้วใช้ผู้ช่วย AI ได้ในหน้าคู่มืออภิบาล ธรรมนูญ การบริหาร และบุคคลในพระคัมภีร์ คีย์เก็บในเครื่องนี้เท่านั้น ไม่ขึ้นไปที่ GitHub</p>

      <div className="ai-vendors" role="radiogroup" aria-label="เลือกผู้ให้บริการ AI">
        {VENDORS.map((x) => (
          <button key={x.id} type="button" role="radio" aria-checked={st.vendor === x.id} className="ai-vendor" onClick={() => pick(x.id)}>
            <span className="ai-vendor__name">{x.label}</span>
            <span className="ai-vendor__state">{st.keys[x.id] ? '● มีคีย์' : '○ ยังไม่มี'}</span>
          </button>
        ))}
      </div>

      <label htmlFor="ai-key" className="ai-keys__label">คีย์ {v.label}</label>
      <input
        id="ai-key"
        className="code-input"
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder={v.hint}
        value={key}
        onChange={(e) => edit({ keys: { ...st.keys, [st.vendor]: e.target.value } })}
      />
      <a className="source-note" href={v.keyUrl} target="_blank" rel="noreferrer">ขอคีย์ {v.label} ได้ที่นี่ ›</a>

      <details className="ai-keys__adv">
        <summary>ขั้นสูง: ชื่อรุ่น AI</summary>
        <input
          id="ai-model"
          className="code-input"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder={v.model}
          value={model}
          onChange={(e) => edit({ models: { ...st.models, [st.vendor]: e.target.value } })}
        />
        <p className="source-note">เว้นว่างเพื่อใช้ค่าตั้งต้น ({v.model})</p>
      </details>

      <div className="ai-keys__btns">
        <button type="button" className="btn btn--gold" onClick={test} disabled={testing}>{testing ? 'กำลังทดสอบ…' : 'ทดสอบและบันทึก'}</button>
        <button type="submit" className="btn btn--ghost">บันทึก</button>
      </div>
      {msg && <p className={msg.ok ? 'ai-keys__ok' : 'ai-keys__err'} role="status">{msg.text}</p>}
    </form>
  )
}

/** ใช้ร่วมกันออนไลน์: สมุดคำอธิษฐานซิงก์ผ่าน repo ส่วนตัวบน GitHub */
function SyncSettings() {
  const cur = getSync()
  const [name, setName] = useState(cur?.name ?? '')
  const [token, setToken] = useState(cur?.token ?? '')
  const [repo, setRepo] = useState(cur?.repo ?? DEFAULT_REPO)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const connect = async () => {
    if (!token.trim()) {
      saveSync(null)
      return setMsg({ ok: true, text: 'ปิดการใช้ร่วมกันแล้ว สมุดบันทึกในเครื่องนี้อย่างเดียว' })
    }
    setBusy(true)
    setMsg(null)
    const cfg = { name: name.trim(), token: token.trim(), repo: repo.trim() || DEFAULT_REPO }
    const err = await testSync(cfg)
    setBusy(false)
    if (err) return setMsg({ ok: false, text: err })
    saveSync(cfg)
    setMsg({ ok: true, text: 'เชื่อมต่อแล้ว ✓ สมุดคำอธิษฐานจะบันทึกออนไลน์และเห็นร่วมกันทุกเครื่องที่ใส่รหัสนี้' })
  }
  return (
    <form className="card ai-keys" onSubmit={(e) => { e.preventDefault(); connect() }}>
      <h2 style={{ fontSize: '1.1rem' }}>☁️ ใช้ร่วมกันออนไลน์</h2>
      <p className="source-note">ใส่รหัสเข้าใช้ร่วมครั้งเดียวต่อเครื่อง แล้วสมุดคำอธิษฐานจะบันทึกขึ้น GitHub ของคริสตจักร (repo ส่วนตัว) ทุกคนที่ใส่รหัสเดียวกันจะเห็นและแก้ไขได้</p>
      <label htmlFor="sync-name" className="ai-keys__label">ชื่อของท่าน (แสดงว่าใครแก้ไข)</label>
      <input id="sync-name" className="code-input" type="text" placeholder="เช่น เจ็ท" value={name} onChange={(e) => { setName(e.target.value); setMsg(null) }} />
      <label htmlFor="sync-token" className="ai-keys__label">รหัสเข้าใช้ร่วม</label>
      <input id="sync-token" className="code-input" type="password" autoComplete="off" spellCheck={false} placeholder="github_pat_..." value={token} onChange={(e) => { setToken(e.target.value); setMsg(null) }} />
      <details className="ai-keys__adv">
        <summary>ขั้นสูง: ที่เก็บข้อมูล</summary>
        <input id="sync-repo" className="code-input" type="text" spellCheck={false} value={repo} onChange={(e) => { setRepo(e.target.value); setMsg(null) }} />
      </details>
      <div className="ai-keys__btns">
        <button type="submit" className="btn btn--gold" disabled={busy}>{busy ? 'กำลังตรวจ…' : 'เชื่อมต่อและบันทึก'}</button>
      </div>
      {msg && <p className={msg.ok ? 'ai-keys__ok' : 'ai-keys__err'} role="status">{msg.text}</p>}
    </form>
  )
}
