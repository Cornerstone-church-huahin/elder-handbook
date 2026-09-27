import { useEffect, useState } from 'react'
import { openPronEditor, TOOLS_EVENT, type ToolsDetail } from './Spoken'

/**
 * แถบเครื่องมือเมื่อกดค้างที่ข้อความ (ทุกหน้าที่อ่านออกเสียงได้) — แบบเดียวกับแถบในหน้าพระคัมภีร์
 * ฟังจากตรงนี้ · คัดลอก · แชร์ · แก้คำอ่าน
 */
export default function TextTools() {
  const [d, setD] = useState<ToolsDetail | null>(null)
  const [msg, setMsg] = useState('')
  useEffect(() => {
    const on = (e: Event) => { setD((e as CustomEvent<ToolsDetail>).detail); setMsg('') }
    window.addEventListener(TOOLS_EVENT, on)
    return () => window.removeEventListener(TOOLS_EVENT, on)
  }, [])
  useEffect(() => {
    const close = () => setD(null)
    window.addEventListener('hashchange', close)
    return () => window.removeEventListener('hashchange', close)
  }, [])
  if (!d) return null
  const word = d.text.slice(d.start, d.end)
  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(''), 1600) }
  const copy = async () => {
    try { await navigator.clipboard.writeText(d.text); flash('คัดลอกแล้ว') } catch { flash('คัดลอกไม่ได้') }
  }
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ text: d.text }) } catch { /* ยกเลิก */ } return }
    copy()
  }
  return (
    <div className="bible-selbar text-tools" role="toolbar" aria-label="เครื่องมือข้อความ">
      <div className="bible-selbar__top">
        <span className="bible-selbar__ref">{msg || `“${word}” · ${d.text.slice(0, 40)}${d.text.length > 40 ? '…' : ''}`}</span>
        <button type="button" className="bible-selbar__x" onClick={() => setD(null)} aria-label="ปิดเครื่องมือ">✕</button>
      </div>
      <div className="bible-selbar__btns">
        {d.read && <button type="button" onClick={() => { d.read!(); setD(null) }} aria-label="ฟังจากตรงนี้"><span>🔊</span>ฟังจากนี้</button>}
        <button type="button" onClick={copy} aria-label="คัดลอกข้อความ"><span>📋</span>คัดลอก</button>
        <button type="button" onClick={share} aria-label="แชร์ข้อความ"><span>📤</span>แชร์</button>
        <button type="button" onClick={() => { openPronEditor({ text: d.text, start: d.start, end: d.end }); setD(null) }} aria-label="แก้คำอ่าน"><span>🔤</span>แก้คำอ่าน</button>
      </div>
    </div>
  )
}
