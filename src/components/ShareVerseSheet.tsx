import { useEffect, useRef, useState } from 'react'
import { fileToLogo, getSharePrefs, renderVerseImage, setSharePrefs, SHARE_THEMES, shareText, type ShareLine, type SharePrefs } from '../lib/shareVerse'

/**
 * แชร์ข้อพระคัมภีร์ 2 แบบ: ข้อความ (ไลน์/แอปอื่น/คัดลอก) หรือภาพการ์ดมีพื้นหลังและโลโก้ (เลือกธีม เปลี่ยนโลโก้ ข้อความท้ายภาพได้)
 */
export default function ShareVerseSheet({ refLabel, lines, onClose }: { refLabel: string; lines: ShareLine[]; onClose: () => void }) {
  const [prefs, setPrefs] = useState<SharePrefs>(getSharePrefs)
  const [img, setImg] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const blob = useRef<Blob | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(''), 2500) }
  const update = (p: Partial<SharePrefs>) => { setSharePrefs(p); setPrefs(getSharePrefs()) }

  const linesKey = JSON.stringify(lines)
  useEffect(() => {
    let alive = true
    let url = ''
    const t = window.setTimeout(async () => {
      try {
        const b = await renderVerseImage({ ref: refLabel, lines, prefs })
        if (!alive) return
        blob.current = b
        url = URL.createObjectURL(b)
        setImg((old) => { if (old) URL.revokeObjectURL(old); return url })
      } catch {
        if (alive) flash('สร้างภาพไม่ได้ในเครื่องนี้')
      }
    }, 120)
    return () => { alive = false; window.clearTimeout(t) }
  }, [refLabel, linesKey, prefs]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { setImg((old) => { if (old) URL.revokeObjectURL(old); return '' }) }, [])

  const text = shareText(refLabel, lines, prefs.footer)
  const shareTextNow = async () => {
    if (navigator.share) { try { await navigator.share({ text }) } catch { /* ยกเลิก */ } return }
    copy()
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); flash('คัดลอกข้อความแล้ว วางส่งได้เลย') } catch { flash('คัดลอกไม่ได้ กดค้างที่ข้อความเพื่อคัดลอกเอง') }
  }
  const fname = `${refLabel.replace(/[^\wก-๙]+/g, '-')}.jpg`
  const download = () => {
    if (!blob.current) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob.current); a.download = fname; a.click()
    window.setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    flash('บันทึกภาพแล้ว')
  }
  const shareImage = async () => {
    if (!blob.current) return
    setBusy(true)
    try {
      const f = new File([blob.current], fname, { type: 'image/jpeg' })
      if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], text }); return }
      download()
    } catch { /* ยกเลิก */ } finally { setBusy(false) }
  }
  const pickLogo = async (f?: File) => {
    if (!f) return
    try { update({ logo: await fileToLogo(f), showLogo: true }) } catch { flash('เปิดรูปนี้ไม่ได้ ลองรูปอื่น') }
  }

  return (
    <div className="sv-modal" role="dialog" aria-modal="true" aria-label="แชร์ข้อพระคัมภีร์" onClick={onClose}>
      <div className="sv-card" onClick={(e) => e.stopPropagation()}>
        <div className="sv-head"><b>📤 แชร์ {refLabel}</b><button type="button" className="mini" onClick={onClose} aria-label="ปิด">✕</button></div>

        <p className="sv-h">1) แชร์เป็นข้อความ</p>
        <pre className="sv-text">{text}</pre>
        <div className="sv-row">
          <button type="button" className="btn btn--gold" onClick={shareTextNow}>📤 แชร์ข้อความ</button>
          <a className="btn btn--ghost" href={`https://line.me/R/msg/text/?${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">💬 ส่งไลน์</a>
          <button type="button" className="btn btn--ghost" onClick={copy}>📋 คัดลอก</button>
        </div>

        <p className="sv-h">2) แชร์เป็นภาพ (มีพื้นหลังและโลโก้)</p>
        <div className="sv-themes" role="group" aria-label="พื้นหลัง">
          {SHARE_THEMES.map((t) => (
            <button key={t.id} type="button" aria-pressed={prefs.theme === t.id} className={`sv-theme${prefs.theme === t.id ? ' sv-theme--on' : ''}`} style={{ background: `linear-gradient(135deg, ${t.bg[0]}, ${t.bg[2]})`, color: t.text }} onClick={() => update({ theme: t.id })}>{t.label}</button>
          ))}
        </div>
        {img ? <img className="sv-img" src={img} alt={`ตัวอย่างภาพ ${refLabel}`} /> : <p className="source-note">กำลังสร้างภาพ…</p>}
        <label className="sv-chk"><input type="checkbox" checked={prefs.showLogo} onChange={(e) => update({ showLogo: e.target.checked })} /> แสดงโลโก้</label>
        <div className="sv-row">
          <button type="button" className="btn btn--ghost" onClick={() => file.current?.click()}>🖼️ เปลี่ยนโลโก้</button>
          {prefs.logo && <button type="button" className="btn btn--ghost" onClick={() => update({ logo: undefined })}>↺ ใช้โลโก้มาตรฐาน</button>}
          <input ref={file} type="file" accept="image/*" hidden aria-label="เลือกรูปโลโก้" onChange={(e) => { void pickLogo(e.target.files?.[0]); e.target.value = '' }} />
        </div>
        <label className="sv-foot">ข้อความท้ายภาพ
          <input value={prefs.footer} maxLength={40} onChange={(e) => update({ footer: e.target.value })} />
        </label>
        <div className="sv-row">
          <button type="button" className="btn btn--gold" disabled={!img || busy} onClick={shareImage}>📤 แชร์ภาพ</button>
          <button type="button" className="btn btn--ghost" disabled={!img} onClick={download}>💾 บันทึกภาพ</button>
        </div>
        {msg && <p className="nb-sync nb-sync--ok" role="status">{msg}</p>}
        <p className="source-note">โลโก้และธีมที่เลือกจำไว้ในเครื่องนี้ · ภาพสร้างในเครื่อง ไม่ส่งข้อมูลไปที่ไหน</p>
      </div>
    </div>
  )
}
