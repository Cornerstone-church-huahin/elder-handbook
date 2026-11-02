import { useEffect, useRef, useState } from 'react'
import { AiError } from '../lib/ai'
import { aiErrText, aiMeaning, curatedMeaning, NO_KEY_TEXT } from '../lib/spiritMeaning'

const AUTO_KEY = 'khatha.spiritAutoAi.v1'
const readAuto = () => { try { return localStorage.getItem(AUTO_KEY) === '1' } catch { return false } }

/**
 * ช่อง "🕊️ ความหมายฝ่ายวิญญาณ": พิมพ์/วางเองได้ · 📚 เติมจากชุดสำเร็จรูป (ฟรี) · 🤖 ให้ AI เขียน/เขียนใหม่ · ล้างแล้วใส่ของเราเองได้
 * autoFill: เมื่อเลือกข้อใหม่และช่องยังว่าง/ยังไม่ได้แก้เอง → เติมจากชุดสำเร็จรูปให้เองทันที (ติ๊ก "ให้ AI เติมให้เองด้วย" = ถ้าไม่มีชุดสำเร็จรูปก็เรียก AI)
 */
export default function SpiritField({ label, lines, value, onChange, autoFill, idPrefix = 'sp' }: {
  label: string
  lines: { n: number; t: string }[]
  value: string
  onChange: (v: string) => void
  autoFill?: boolean
  idPrefix?: string
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [auto, setAuto] = useState(readAuto)
  const touched = useRef(false)
  const ctl = useRef<AbortController | null>(null)
  const filledFor = useRef('')
  useEffect(() => () => ctl.current?.abort(), [])

  const runAi = async () => {
    setErr(''); ctl.current?.abort()
    const c = new AbortController(); ctl.current = c
    setBusy(true)
    try { const t = await aiMeaning({ label, lines, signal: c.signal }); if (!c.signal.aborted) { onChange(t); touched.current = true } }
    catch (e) { if (!c.signal.aborted) setErr(e instanceof AiError && e.kind === 'unavailable' ? NO_KEY_TEXT : aiErrText(e)) }
    finally { setBusy(false) }
  }
  const fillFree = () => { const t = curatedMeaning(label); if (t) { onChange(t); touched.current = true; setErr('') } else setErr('ข้อนี้ยังไม่มีชุดสำเร็จรูป — กด “🤖 ให้ AI เขียน” หรือพิมพ์เอง') }

  useEffect(() => {
    if (!autoFill || !label || !lines.length || touched.current || value.trim() || filledFor.current === label) return
    filledFor.current = label
    const t = curatedMeaning(label)
    if (t) onChange(t)
    else if (auto) void runAi()
  }) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!label) { touched.current = false; filledFor.current = '' } }, [label])
  useEffect(() => { if (!value) touched.current = false }, [value])

  const has = !!curatedMeaning(label)
  return (
    <div className="sm-spirit-field">
      <label className="sm-spirit-field__l">🕊️ ความหมายฝ่ายวิญญาณ <small>(ไม่บังคับ · แก้เองได้)</small>
        <textarea id={`${idPrefix}-text`} rows={5} value={value} placeholder={'เช่น\n• ไม้อ้อช้ำ: คนที่อ่อนแอและเจ็บปวด\n• ไส้ตะเกียงริบหรี่: ความเชื่อที่เหลือน้อยนิด'} onChange={(e) => { touched.current = true; onChange(e.target.value) }} />
      </label>
      <div className="sv-row">
        {has && <button type="button" className="btn btn--ghost" id={`${idPrefix}-free`} disabled={busy || !label} onClick={fillFree}>📚 เติมจากชุดสำเร็จรูป (ฟรี)</button>}
        <button type="button" className="btn btn--ghost" id={`${idPrefix}-ai`} disabled={busy || !label} onClick={() => void runAi()}>{busy ? '⏳ AI กำลังเขียน…' : value.trim() ? '🤖 ให้ AI เขียนใหม่' : '🤖 ให้ AI เขียน'}</button>
        {value && <button type="button" className="btn btn--ghost" id={`${idPrefix}-clear`} onClick={() => { onChange(''); touched.current = true }}>ล้าง</button>}
      </div>
      {autoFill && (
        <label className="sm-spirit-field__auto"><input type="checkbox" id={`${idPrefix}-auto`} checked={auto} onChange={(e) => { setAuto(e.target.checked); try { localStorage.setItem(AUTO_KEY, e.target.checked ? '1' : '0') } catch { /* ignore */ } }} /> ให้ AI เติมให้เองทุกครั้งที่เลือกข้อ (ใช้โควต้า AI · ข้อที่มีชุดสำเร็จรูปจะเติมฟรีเสมอ)</label>
      )}
      {err && <p className="ai-keys__err" role="alert">{err}</p>}
      <p className="source-note">AI เป็นตัวช่วยศึกษา ไม่ใช่คำสอนทางการ — ถ้าไม่ชอบ ล้างแล้วพิมพ์/วางความหมายของเราเองแทนได้ แล้วกดบันทึก</p>
    </div>
  )
}
