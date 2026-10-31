import { useCallback, useEffect, useState } from 'react'
import { RATES, type useSpeech } from '../lib/speech'

type Tts = ReturnType<typeof useSpeech>

/** รหัสรายการที่ติ๊กเลือกไว้ (เก็บในเครื่องนี้) */
export function useChecked(key: string) {
  const [ids, setIds] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(key) ?? '[]')
      return Array.isArray(v) ? v.map(String) : []
    } catch {
      return []
    }
  })
  const save = useCallback((next: string[]) => {
    setIds(next)
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* ignore */ }
  }, [key])
  return {
    ids,
    has: (id: string) => ids.includes(id),
    toggle: (id: string) => save(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]),
    set: save,
  }
}

/** วนเล่นซ้ำ: ค่าเริ่มต้น "เปิด" (จำค่าที่เลือกไว้ในเครื่องนี้) */
export function useLoopPref(tts: Tts, key: string) {
  const { setLoop } = tts
  const [on, setOn] = useState(() => {
    try { return localStorage.getItem(key) !== '0' } catch { return true }
  })
  useEffect(() => setLoop(on), [on, setLoop])
  return [on, (v: boolean) => { setOn(v); try { localStorage.setItem(key, v ? '1' : '0') } catch { /* ignore */ } }] as const
}

/**
 * แผงควบคุมเสียงอ่านของ "ฟังบทความ" และ "ท่องจำพระคัมภีร์" — ใช้เสียงอ่าน/ความเร็ว/วนซ้ำชุดเดียวกับเมนูอื่นของแอป
 * เล่นเฉพาะรายการที่ติ๊กไว้ ตามลำดับในรายการ แล้ววนกลับข้อแรกจนกดหยุด
 */
export default function ListenControls({ tts, total, selected, loop, onLoop, onPlay, onSelectAll, onClear, label }: {
  tts: Tts; total: number; selected: number; loop: boolean; onLoop: (v: boolean) => void
  onPlay: () => void; onSelectAll: () => void; onClear: () => void; label: string
}) {
  const active = tts.speaking || tts.paused
  const idx = Math.max(0, RATES.findIndex((x) => x.rate === tts.rate))
  if (!tts.supported) return <p className="ai-keys__err">เบราว์เซอร์นี้ไม่รองรับเสียงอ่าน — ยังอ่านและแก้ไขได้ตามปกติ</p>
  return (
    <section className="card lc" aria-label={`ควบคุมเสียง${label}`}>
      <div className="lc__row">
        {active ? (
          <>
            {tts.speaking
              ? <button type="button" className="btn btn--gold" onClick={tts.pause}>⏸ หยุดชั่วคราว</button>
              : <button type="button" className="btn btn--gold" onClick={tts.resume}>▶ ฟังต่อ</button>}
            <button type="button" className="btn btn--ghost" onClick={tts.stop}>⏹ หยุดเลย</button>
          </>
        ) : (
          <button type="button" className="btn btn--gold lc__play" disabled={!selected} onClick={onPlay}>
            ▶ ฟังที่เลือก {selected > 0 ? `(${selected})` : ''}
          </button>
        )}
      </div>
      {!active && !selected && total > 0 && <p className="lc__hint">ติ๊ก ☑ หน้าการ์ดที่ต้องการฟัง แล้วกดปุ่มฟัง</p>}
      <div className="lc__row lc__row--tools">
        <label className="us-loop">
          <input type="checkbox" checked={loop} onChange={(e) => onLoop(e.target.checked)} /> 🔁 วนอ่านซ้ำ
        </label>
        <button type="button" className="mini" onClick={onSelectAll} disabled={!total}>เลือกทั้งหมด</button>
        <button type="button" className="mini" onClick={onClear} disabled={!selected}>ล้างที่เลือก</button>
      </div>
      <label className="nb-speed">
        <span className="nb-speed__label">ความเร็วเสียง: <b>{RATES[idx].label}</b></span>
        <input type="range" min={0} max={RATES.length - 1} step={1} value={idx} aria-valuetext={RATES[idx].label}
          onChange={(e) => { tts.setRate(RATES[+e.target.value].rate); tts.stop() }} />
        <span className="nb-speed__ends" aria-hidden="true"><span>🐢 ช้าที่สุด</span><span>ปกติ</span></span>
      </label>
      {tts.noVoice && <p className="ai-keys__err">เครื่องนี้ยังไม่มีเสียงภาษาไทย · Android: ตั้งค่า › การจัดการทั่วไป › การอ่านออกเสียง › Google › ติดตั้งข้อมูลเสียงภาษาไทย</p>}
    </section>
  )
}
