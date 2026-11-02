import { useEffect, useRef, useState } from 'react'
import { getAiProvider, AiError } from '../lib/ai'
import { interpretVerse, packInterp, readInterp, verseContext, type Interpretation, type VerseContext } from '../lib/interpret'

const ERR: Record<string, string> = {
  locked: 'คีย์ AI ไม่ถูกต้องหรือยังไม่ได้เปิดใช้งาน — ตรวจที่ ตั้งค่า › ผู้ช่วย AI',
  busy: 'AI ไม่ว่างหรือโควต้าเต็มชั่วคราว รอสักครู่แล้วลองใหม่',
  refused: 'AI ไม่ตอบข้อนี้ ลองกดสร้างใหม่อีกครั้ง',
  cancelled: 'ยกเลิกแล้ว',
  failed: 'ตีความไม่สำเร็จ (อาจไม่มีอินเทอร์เน็ต) ลองใหม่อีกครั้ง',
  unavailable: 'ยังไม่มี AI ให้ใช้',
}

/**
 * แผงตีความข้อพระคัมภีร์ในการ์ด (พับ/ขยาย/ปิดได้):
 *  📍 บริบท (ใช้ได้เสมอ ไม่ต้องมี AI): ภาพรวมเล่ม + ข้อก่อน–หลังจากฉบับ 1971
 *  ✨ คำตีความโดย AI ตามหลักไวยากรณ์–ประวัติศาสตร์ → ความหมายเดิม → หลักความจริง → พูดให้เข้าใจวันนี้ → นำไปใช้ (ชีวิต/คิด/ลงมือ)
 */
export default function VerseInterpret({ title, lines, story, canEdit, onSave, onClose }: {
  title: string
  lines: { n: number; t: string }[]
  story: string
  canEdit: boolean
  onSave: (packed: string) => void
  onClose: () => void
}) {
  const saved = readInterp(story)
  const [folded, setFolded] = useState(false)
  const [ctx, setCtx] = useState<VerseContext | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [near, setNear] = useState(false)
  const ctl = useRef<AbortController | null>(null)
  useEffect(() => { let alive = true; void verseContext(title).then((c) => alive && setCtx(c)); return () => { alive = false; ctl.current?.abort() } }, [title])

  const run = async (again = 0) => {
    setErr('')
    const ai = await getAiProvider()
    if (!ai) { setErr('ต้องใส่คีย์ AI (Claude / Gemini / ChatGPT) ที่ ตั้งค่า › ผู้ช่วย AI ก่อน จึงจะให้ AI ช่วยตีความได้ — ส่วนบริบทด้านบนใช้ได้เลยโดยไม่ต้องมีคีย์'); return }
    ctl.current?.abort()
    const c = new AbortController(); ctl.current = c
    setBusy(true)
    try {
      const r = await interpretVerse(ai, { label: title, lines, ctx, again, signal: c.signal })
      if (!c.signal.aborted) onSave(packInterp(r))
    } catch (e) {
      if (!c.signal.aborted) setErr(ERR[e instanceof AiError ? e.kind : 'failed'] ?? ERR.failed)
    } finally { setBusy(false) }
  }
  const dis = (i: Interpretation) => (
    <div className="vi-ai">
      <Sec h="📜 ความหมายเดิมในสมัยนั้น" t={i.meaning} />
      {i.context && <Sec h="📍 บริบทของข้อ" t={i.context} />}
      {i.keywords.length > 0 && <div className="vi-sec"><h4>🔑 คำสำคัญ</h4><ul>{i.keywords.map((k, n) => <li key={n}><b>{k.word}</b>{k.note ? ` — ${k.note}` : ''}</li>)}</ul></div>}
      <Sec h="🧭 หลักความจริงที่ใช้ได้ทุกยุค" t={i.truth} />
      <Sec h="💬 พูดให้เข้าใจวันนี้" t={i.today} hi />
      <div className="vi-sec"><h4>🌱 นำไปใช้</h4>
        <ul>
          {i.apply.life && <li><b>ในการดำเนินชีวิต:</b> {i.apply.life}</li>}
          {i.apply.thought && <li><b>ในวิธีคิด:</b> {i.apply.thought}</li>}
          {i.apply.action && <li><b>ลงมือทำสัปดาห์นี้:</b> {i.apply.action}</li>}
        </ul></div>
      {i.caution && <Sec h="⚠️ ข้อควรระวัง" t={i.caution} />}
      {i.related.length > 0 && <p className="vi-rel">อ่านประกอบ: {i.related.join(' · ')}</p>}
    </div>
  )

  return (
    <section className="vi" aria-label={`ตีความ ${title}`}>
      <div className="vi-head">
        <b>💡 ตีความ {title}</b>
        <span className="vi-head__btns">
          <button type="button" className="mini" aria-expanded={!folded} aria-label={folded ? 'ขยายคำตีความ' : 'พับคำตีความ'} onClick={() => setFolded(!folded)}>{folded ? '▾ ขยาย' : '▴ พับ'}</button>
          <button type="button" className="mini" aria-label="ปิดคำตีความ" onClick={onClose}>✕</button>
        </span>
      </div>
      {!folded && (
        <div className="vi-body">
          {ctx?.intro && <div className="vi-sec"><h4>📍 บริบทของเล่ม {ctx.book}</h4>
            <p>ผู้เขียน: {ctx.intro.writer} · ผู้อ่านดั้งเดิม: {ctx.intro.readers} · ใจความหลัก: {ctx.intro.theme}</p>
            {(ctx.before.length > 0 || ctx.after.length > 0) && <button type="button" className="mini" aria-expanded={near} id="vi-near" onClick={() => setNear(!near)}>{near ? '▴ ซ่อนข้อก่อน–หลัง' : '▾ อ่านข้อก่อน–หลัง (ฉบับ 1971)'}</button>}
            {near && <div className="vi-near">{ctx.before.map((v) => <p key={v.n}><sup>{v.n}</sup>{v.t}</p>)}<p className="vi-here">— ข้อที่ตีความ —</p>{ctx.after.map((v) => <p key={v.n}><sup>{v.n}</sup>{v.t}</p>)}</div>}
          </div>}
          {saved ? dis(saved) : (
            <p className="source-note">ยังไม่มีคำตีความ — กดปุ่มด้านล่างให้ AI ตีความตามหลักไวยากรณ์–ประวัติศาสตร์ (ผลจะเก็บไว้กับการ์ด)</p>
          )}
          {busy && <p className="source-note" role="status">⏳ AI กำลังตีความ…</p>}
          {err && <p className="ai-keys__err" role="alert">{err}</p>}
          <div className="sv-row edit-only">
            {canEdit && (saved
              ? <button type="button" className="btn btn--ghost" id="vi-again" disabled={busy} onClick={() => void run(1 + Math.floor((Date.now() / 1000) % 5))}>🔄 สร้างคำตีความใหม่</button>
              : <button type="button" className="btn btn--gold" id="vi-run" disabled={busy} onClick={() => void run(0)}>✨ ให้ AI ช่วยตีความ</button>)}
            {canEdit && saved && <button type="button" className="btn btn--ghost" id="vi-del" onClick={() => onSave('')}>🗑️ ลบคำตีความ</button>}
          </div>
          <p className="source-note">คำตีความโดย AI เป็นตัวช่วยศึกษา ไม่ใช่คำสอนทางการ — ควรเทียบกับพระคัมภีร์ฉบับเต็มและปรึกษาผู้ปกครอง/ศิษยาภิบาลก่อนนำไปสอน · ภาพรวมเล่มเป็นข้อมูลตามธรรมเนียมที่ยอมรับทั่วไป</p>
        </div>
      )}
    </section>
  )
}
function Sec({ h, t, hi }: { h: string; t: string; hi?: boolean }) {
  return t ? <div className={`vi-sec${hi ? ' vi-sec--hi' : ''}`}><h4>{h}</h4><p>{t}</p></div> : null
}
