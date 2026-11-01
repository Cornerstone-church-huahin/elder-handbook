import { useState } from 'react'
import { RATES } from '../lib/speech'

/**
 * ตั้งค่าเสียงอ่านชุดเดียวกันทุกหน้า (สคริปต์ด่วน · ถามตอบ · การประชุม ฯลฯ)
 * · ความเร็วเก็บในเครื่องค่าเดียว (เหมือนหน้าตั้งค่าและสมุดคำอธิษฐาน) ปรับที่ไหนก็ใช้ทั้งแอป
 * · ติ๊กการ์ดที่ต้องการแล้ว "ฟังที่เลือก" จะเล่นเฉพาะที่ติ๊ก (ไม่ติ๊กเลย = เล่นทั้งหมด) · ติ๊ก 🔁 วนอ่านซ้ำ ให้เล่นวนจนกดหยุด
 */
export type ListenPicks = { has: (id: string) => boolean; toggle: (id: string) => void; setAll: (ids: string[]) => void; clear: () => void; count: number }

/** รายการที่ติ๊กไว้ — จำไว้ในเครื่อง ต่อหน้า */
export function useListenPicks(page: string): ListenPicks {
  const key = `khatha.listenPicks.${page}`
  const [ids, setIds] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(key) ?? '[]')
      return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
    } catch {
      return []
    }
  })
  const save = (next: string[]) => {
    setIds(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }
  return {
    has: (id) => ids.includes(id),
    toggle: (id) => save(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]),
    setAll: (all) => save(all),
    clear: () => save([]),
    count: ids.length,
  }
}

/** ช่องติ๊กหน้าการ์ด: เลือกการ์ดที่จะเล่นวน */
export function PickBox({ picks, id, label }: { picks: ListenPicks; id: string; label: string }) {
  return (
    <label className="us-pick">
      <input type="checkbox" checked={picks.has(id)} onChange={() => picks.toggle(id)} aria-label={`เลือกฟัง: ${label}`} />
    </label>
  )
}

type Tts = { looping: boolean; setLoop: (v: boolean) => void; rate: number; setRate: (r: (typeof RATES)[number]['rate']) => void; stop: () => void; noVoice: boolean }
export default function ListenSettings({ tts, picks, ids }: { tts: Tts; picks: ListenPicks; /** id ของการ์ดที่แสดงอยู่ ใช้ปุ่มเลือกทั้งหมด */ ids: string[] }) {
  const rateIdx = Math.max(0, RATES.findIndex((x) => x.rate === tts.rate))
  return (
    <section className="card us-settings" aria-label="ตั้งค่าเสียงอ่าน">
      <h2 className="section__title">⚙️ ตั้งค่าเสียงอ่าน</h2>
      <p className="us-pickbar">
        <span>ติ๊กช่อง ☑ หน้าการ์ดเพื่อเลือกที่จะฟัง{picks.count ? ` · เลือกแล้ว ${picks.count}` : ' · ไม่ติ๊กเลย = ฟังทั้งหมด'}</span>
        <button type="button" className="mini" onClick={() => picks.setAll(ids)}>เลือกทั้งหมด</button>
        <button type="button" className="mini" disabled={!picks.count} onClick={picks.clear}>ล้างที่เลือก</button>
      </p>
      <label className="us-loop">
        <input type="checkbox" checked={!!tts.looping} onChange={(e) => tts.setLoop(e.target.checked)} /> 🔁 วนอ่านซ้ำเมื่อจบ
      </label>
      <label className="nb-speed">
        <span className="nb-speed__label">ความเร็วเสียง: <b>{RATES[rateIdx].label}</b></span>
        <input type="range" min={0} max={RATES.length - 1} step={1} value={rateIdx} aria-valuetext={RATES[rateIdx].label}
          onChange={(e) => { tts.setRate(RATES[+e.target.value].rate); tts.stop() }} />
        <span className="nb-speed__ends" aria-hidden="true"><span>🐢 ช้าที่สุด</span><span>ปกติ</span></span>
      </label>
      <p className="source-note">ความเร็วนี้ใช้ร่วมกับทั้งแอป (สมุดคำอธิษฐาน พระคัมภีร์ ฯลฯ) และเก็บไว้ในเครื่องนี้</p>
      {tts.noVoice && <p className="ai-keys__err">เครื่องนี้ยังไม่มีเสียงภาษาไทย · Android: ตั้งค่า › การจัดการทั่วไป › การอ่านออกเสียง › Google › ติดตั้งข้อมูลเสียงภาษาไทย</p>}
    </section>
  )
}
