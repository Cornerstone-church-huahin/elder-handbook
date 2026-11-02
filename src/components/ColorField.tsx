import { useEffect, useState } from 'react'
import { hexToHsl, hslToHex, isHex } from '../lib/shareVerse'

const SWATCHES = ['#ffffff', '#fdf6e3', '#e0b84c', '#ff6b6b', '#c9e265', '#3282b8', '#14213d', '#000000']

/**
 * เลือกสี: วงสีของเครื่อง · พิมพ์รหัสสี (#RRGGBB) · เลื่อนไล่เฉดสี/ความสว่าง (แสดงรหัสสีที่ได้ทันที) · สีสำเร็จรูป
 */
export default function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  const [hex, setHex] = useState(value)
  const [h, s, l] = hexToHsl(value)
  useEffect(() => setHex(value), [value])
  const commit = (v: string) => { setHex(v); if (isHex(v)) onChange(v.toLowerCase()) }
  return (
    <div className="cf">
      <div className="cf__top">
        <span className="cf__label">{label}</span>
        <input type="color" className="cf__pick" aria-label={`${label}: เลือกสี`} value={isHex(value) ? value : '#000000'} onChange={(e) => commit(e.target.value)} />
        <input className="cf__hex" aria-label={`${label}: รหัสสี`} value={hex} maxLength={7} spellCheck={false} onChange={(e) => commit(e.target.value.startsWith('#') ? e.target.value : '#' + e.target.value)} />
      </div>
      <input type="range" className="cf__hue" aria-label={`${label}: เลื่อนเฉดสี`} min={0} max={360} value={h} onChange={(e) => onChange(hslToHex(+e.target.value, Math.max(s, 55), l < 15 || l > 90 ? 50 : l))} />
      <input type="range" className="cf__lum" aria-label={`${label}: ความสว่าง`} min={5} max={95} value={l} style={{ background: `linear-gradient(90deg,#000,${hslToHex(h, Math.max(s, 55), 50)},#fff)` }} onChange={(e) => onChange(hslToHex(h, s, +e.target.value))} />
      <div className="cf__sw" role="group" aria-label={`${label}: สีสำเร็จรูป`}>
        {SWATCHES.map((c) => <button key={c} type="button" aria-label={c} className="cf__dot" style={{ background: c }} onClick={() => onChange(c)} />)}
      </div>
    </div>
  )
}
