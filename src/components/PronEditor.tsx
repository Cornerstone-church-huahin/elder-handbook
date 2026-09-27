import { useEffect, useState } from 'react'
import { PRON_EVENT, words, type PronEditDetail } from './Spoken'
import { BUILTIN_PRON, PRON_KEY, type Pron } from '../lib/voicePrefs'
import { useSharedStore } from '../lib/sharedStore'
import { useSpeech } from '../lib/speech'

/**
 * ป๊อปอัพแก้คำอ่าน: กดค้างที่คำในข้อความที่อ่านออกเสียงได้ → ฟังว่าเครื่องอ่านอย่างไร → พิมพ์คำอ่านที่ถูก → บันทึก
 * บันทึกแล้วใช้ทุกหน้าทันที และใช้ร่วมกันออนไลน์ (pronounce.json)
 */
export default function PronEditor() {
  const [d, setD] = useState<PronEditDetail | null>(null)
  const [range, setRange] = useState<[number, number]>([0, 0])
  const [say, setSay] = useState('')
  const [saved, setSaved] = useState(false)
  const [anchor, setAnchor] = useState(false) // แตะคำแรกแล้ว → แตะคำถัดไปเพื่อรวมเป็นช่วง
  const store = useSharedStore<Pron>({ localKey: PRON_KEY, file: 'pronounce.json', label: 'คำอ่าน' })
  const tts = useSpeech()

  useEffect(() => {
    const on = (e: Event) => {
      const det = (e as CustomEvent<PronEditDetail>).detail
      setD(det)
      setRange([det.start, det.end])
      setAnchor(false)
      setSaved(false)
    }
    window.addEventListener(PRON_EVENT, on)
    return () => window.removeEventListener(PRON_EVENT, on)
  }, [])

  const word = d ? d.text.slice(range[0], range[1]).trim() : ''
  const mine = store.items.find((x) => x.word === word)
  const builtin = BUILTIN_PRON.find(([w]) => w === word)?.[1]
  useEffect(() => {
    if (d) setSay(mine?.say ?? builtin ?? word)
  }, [word]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!d) return null
  const segs = words(d.text)
  const i0 = segs.findIndex((s) => s.index === range[0])
  const i1 = segs.findIndex((s) => s.index + s.segment.length === range[1])
  const grow = (dir: -1 | 1) => {
    if (dir < 0 && i0 > 0) setRange([segs[i0 - 1].index, range[1]])
    if (dir > 0 && i1 >= 0 && i1 < segs.length - 1) setRange([range[0], segs[i1 + 1].index + segs[i1 + 1].segment.length])
  }
  const shrink = (dir: -1 | 1) => {
    if (i1 <= i0) return
    if (dir < 0) setRange([segs[i0 + 1].index, range[1]])
    else setRange([range[0], segs[i1 - 1].index + segs[i1 - 1].segment.length])
  }
  const close = () => { tts.stop(); setD(null) }
  const save = () => {
    const w = word
    const s2 = say.trim()
    if (!w || !s2) return
    store.put([{ id: `p:${w}`, word: w, say: s2, updated: 0 }])
    setSaved(true)
    window.setTimeout(close, 700)
  }
  // ช่วงข้อความที่แสดงให้แตะเลือกคำ (ประมาณ 1–2 บรรทัดรอบคำที่เลือก)
  const from = Math.max(0, range[0] - 70)
  const to = Math.min(d.text.length, range[1] + 70)
  const view = segs.filter((sg) => sg.index + sg.segment.length > from && sg.index < to)
  const pick = (sg: { index: number; segment: string }) => {
    const a = sg.index
    const b = a + sg.segment.length
    // เลือกไว้คำเดียว แล้วแตะอีกคำ → รวมเป็นช่วงเดียวกัน · นอกนั้นเลือกคำที่แตะใหม่
    if (anchor && a !== range[0]) {
      setRange([Math.min(a, range[0]), Math.max(b, range[1])])
      setAnchor(false)
    } else {
      setRange([a, b])
      setAnchor(true)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={close}>
      <div className="sheet sheet--short pron-sheet" role="dialog" aria-modal="true" aria-label="แก้คำอ่าน" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <div className="sheet__title"><strong>🔤 แก้คำอ่าน</strong><span>ข้อความบนจอไม่เปลี่ยน · ใช้ทุกหน้า ทุกเครื่อง</span></div>
          <button type="button" className="sheet__close" onClick={close}>ปิด</button>
        </div>
        <p className="source-note">แตะคำที่ต้องการแก้ · แตะอีกคำเพื่อเลือกหลายคำติดกัน</p>
        <p className="pron-ctx pron-pick">
          {view.map((sg) => {
            const inSel = sg.index >= range[0] && sg.index + sg.segment.length <= range[1]
            return sg.segment.trim()
              ? <button key={sg.index} type="button" className={`pron-w${inSel ? ' is-on' : ''}`} onClick={() => pick(sg)}>{sg.segment}</button>
              : <span key={sg.index}>{sg.segment}</span>
          })}
        </p>
        <div className="pron-word">
          <button type="button" className="mini" onClick={() => grow(-1)} aria-label="เพิ่มคำหน้า">＋◀</button>
          <button type="button" className="mini" onClick={() => shrink(-1)} aria-label="ตัดคำหน้า">▶</button>
          <strong id="pron-edit-word">{word}</strong>
          <button type="button" className="mini" onClick={() => shrink(1)} aria-label="ตัดคำหลัง">◀</button>
          <button type="button" className="mini" onClick={() => grow(1)} aria-label="เพิ่มคำหลัง">▶＋</button>
        </div>
        <button type="button" className="btn btn--ghost" onClick={() => tts.speak(word)}>▶️ ฟังที่เครื่องอ่านตอนนี้</button>
        <label className="voice-row">
          <span>ให้อ่านว่า (เขียนตามเสียง เช่น เอโนก)</span>
          <input id="pron-edit-say" value={say} onChange={(e) => { setSay(e.target.value); setSaved(false) }} />
        </label>
        <div className="pron-actions">
          <button type="button" className="btn btn--ghost" disabled={!say.trim()} onClick={() => tts.speak(say)}>▶️ ฟังคำอ่านใหม่</button>
          <button type="button" className="btn btn--gold" disabled={!say.trim() || say.trim() === word} onClick={save}>{saved ? '✓ บันทึกแล้ว' : '💾 บันทึก'}</button>
        </div>
        {mine && <button type="button" className="linkish" onClick={() => { store.remove(mine.id); close() }}>🗑️ ลบคำอ่านที่แก้ไว้ ({mine.word} → {mine.say})</button>}
      </div>
    </div>
  )
}
