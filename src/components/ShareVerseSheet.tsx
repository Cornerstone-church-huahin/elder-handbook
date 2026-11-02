import { useEffect, useRef, useState } from 'react'
import ColorField from './ColorField'
import {
  FILTERS, FRAMES, PATTERNS, STYLE_PRESETS, TONES, autoAdjust, fileToLogo, fileToPhoto, getSharePrefs, renderVerseImage, setSharePrefs, shareText,
  type ShareLine, type ShareStyle,
} from '../lib/shareVerse'
import { AI_GOALS, aiEditPhoto, hasGeminiKeyForPhoto } from '../lib/aiPhoto'

type Main = 'text' | 'image'
type Sub = 'photo' | 'style' | 'color' | 'logo'

const SUBS: { id: Sub; label: string }[] = [
  { id: 'photo', label: '📷 ภาพ' }, { id: 'style', label: '🎨 สไตล์' }, { id: 'color', label: '🌈 สี' }, { id: 'logo', label: '🏷️ โลโก้' },
]

function Chips<T extends string>({ items, value, onPick, label }: { items: { id: T; label: string }[]; value: T; onPick: (v: T) => void; label: string }) {
  return (
    <div className="sv-chips" role="group" aria-label={label}>
      {items.map((x) => <button key={x.id} type="button" aria-pressed={value === x.id} className={`sv-chip${value === x.id ? ' sv-chip--on' : ''}`} onClick={() => onPick(x.id)}>{x.label}</button>)}
    </div>
  )
}
function Slider({ label, value, min, max, step = 1, onChange, unit = '' }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <label className="sv-sl"><span>{label} <b>{Math.round(value * 100) / 100}{unit}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} /></label>
  )
}
/**
 * แชร์ข้อพระคัมภีร์ 2 แบบ
 *  1) ข้อความ — แชร์เข้าแอปอื่น / ส่งไลน์ / คัดลอก
 *  2) ภาพการ์ด — ตกแต่งแบบแอปออกแบบ: ภาพจากเครื่อง + ปรับภาพ/ฟิลเตอร์ · สไตล์สำเร็จรูป ลวดลาย กรอบ · สีและรหัสสี · โลโก้ (เปลี่ยนเองได้)
 */
export default function ShareVerseSheet({ refLabel, lines, onClose }: { refLabel: string; lines: ShareLine[]; onClose: () => void }) {
  const init = useRef(getSharePrefs()).current
  const [style, setStyle] = useState<ShareStyle>(init.style)
  const [logo, setLogo] = useState<string | undefined>(init.logo)
  const [orig, setOrig] = useState<string | undefined>() // รูปต้นฉบับจากเครื่อง (ใช้ระหว่างตกแต่ง ไม่เก็บถาวร)
  const [versions, setVersions] = useState<string[]>([]) // รูปที่ AI แต่งให้ (แต่ละครั้งที่สร้าง)
  const [vi, setVi] = useState(-1) // รูปที่ใช้อยู่: -1 = ต้นฉบับ
  const [goals, setGoals] = useState<string[]>(['wires', 'evening'])
  const [note, setNote] = useState('')
  const [consent, setConsent] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiErr, setAiErr] = useState('')
  const abort = useRef<AbortController | null>(null)
  const photo = vi >= 0 ? versions[vi] : orig
  const [main, setMain] = useState<Main>('text')
  const [sub, setSub] = useState<Sub>('photo')
  const [img, setImg] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const logoIn = useRef<HTMLInputElement>(null)
  const photoIn = useRef<HTMLInputElement>(null)
  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(''), 2600) }
  const upd = (p: Partial<ShareStyle>) => setStyle((s) => ({ ...s, ...p }))

  useEffect(() => { setSharePrefs({ style, logo }) }, [style, logo])

  const linesKey = JSON.stringify(lines)
  useEffect(() => {
    if (main !== 'image') return
    let alive = true
    const t = window.setTimeout(async () => {
      try {
        const b = await renderVerseImage({ ref: refLabel, lines, style, logo, photo, scale: 0.5 })
        if (!alive) return
        const url = URL.createObjectURL(b)
        setImg((old) => { if (old) URL.revokeObjectURL(old); return url })
      } catch {
        if (alive) flash('สร้างภาพไม่ได้ในเครื่องนี้')
      }
    }, 120)
    return () => { alive = false; window.clearTimeout(t) }
  }, [main, refLabel, linesKey, style, logo, photo]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { setImg((old) => { if (old) URL.revokeObjectURL(old); return '' }) }, [])

  const text = shareText(refLabel, lines, style.footer)
  const shareTextNow = async () => {
    if (navigator.share) { try { await navigator.share({ text }) } catch { /* ยกเลิก */ } return }
    copy()
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); flash('คัดลอกข้อความแล้ว วางส่งได้เลย') } catch { flash('คัดลอกไม่ได้ กดค้างที่ข้อความเพื่อคัดลอกเอง') }
  }
  const full = () => renderVerseImage({ ref: refLabel, lines, style, logo, photo, scale: 1 })
  const fname = `${refLabel.replace(/[^\wก-๙]+/g, '-')}.jpg`
  const download = async () => {
    setBusy(true)
    try {
      const b = await full()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b); a.download = fname; a.click()
      window.setTimeout(() => URL.revokeObjectURL(a.href), 4000)
      flash('บันทึกภาพแล้ว')
    } finally { setBusy(false) }
  }
  const shareImage = async () => {
    setBusy(true)
    try {
      const b = await full()
      const f = new File([b], fname, { type: 'image/jpeg' })
      if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], text }); return }
      await download()
    } catch { /* ยกเลิก */ } finally { setBusy(false) }
  }
  const pickPhoto = async (f?: File) => {
    if (!f) return
    try { setOrig(await fileToPhoto(f)); setVersions([]); setVi(-1); setAiErr(''); upd({ photoZoom: 1, photoX: 0, photoY: 0 }) } catch { flash('เปิดรูปนี้ไม่ได้ ลองรูปอื่น') }
  }
  const autoFix = async () => {
    if (!photo) return
    upd(await autoAdjust(photo))
    flash('ปรับสว่าง คอนทราสต์ ความสดสี ให้อัตโนมัติแล้ว — ปรับต่อเองได้')
  }
  const generate = async () => {
    if (!orig || aiBusy) return
    setAiErr(''); setAiBusy(true)
    const c = new AbortController(); abort.current = c
    try {
      // แต่งจากรูปต้นฉบับเสมอ: แต่ละครั้งได้ผลต่างกัน เลือกอันที่ชอบจากภาพย่อได้
      const out = await aiEditPhoto({ photo: orig, goals, note, variant: versions.length, signal: c.signal })
      setVersions((v) => { const n = [...v, out].slice(-6); setVi(n.length - 1); return n })
    } catch (e) {
      if (!c.signal.aborted) setAiErr(e instanceof Error ? e.message : 'แต่งรูปไม่สำเร็จ')
    } finally { setAiBusy(false) }
  }
  useEffect(() => () => abort.current?.abort(), [])
  const pickLogo = async (f?: File) => {
    if (!f) return
    try { setLogo(await fileToLogo(f)); upd({ showLogo: true }) } catch { flash('เปิดรูปนี้ไม่ได้ ลองรูปอื่น') }
  }

  return (
    <div className="sv-modal" role="dialog" aria-modal="true" aria-label="แชร์ข้อพระคัมภีร์" onClick={onClose}>
      <div className="sv-card" onClick={(e) => e.stopPropagation()}>
        <div className="sv-head"><b>📤 แชร์ {refLabel}</b><button type="button" className="mini" onClick={onClose} aria-label="ปิด">✕</button></div>
        <div className="sv-main" role="tablist" aria-label="รูปแบบการแชร์">
          <button type="button" role="tab" aria-selected={main === 'text'} className={`sv-mainbtn${main === 'text' ? ' sv-mainbtn--on' : ''}`} onClick={() => setMain('text')}>📝 แชร์เป็นข้อความ</button>
          <button type="button" role="tab" aria-selected={main === 'image'} className={`sv-mainbtn${main === 'image' ? ' sv-mainbtn--on' : ''}`} onClick={() => setMain('image')}>🖼️ แชร์เป็นภาพ</button>
        </div>

        {main === 'text' && (
          <div className="sv-pane">
            <pre className="sv-text" aria-label="ข้อความที่จะแชร์">{text}</pre>
            <div className="sv-row">
              <button type="button" className="btn btn--gold" onClick={shareTextNow}>📤 แชร์ข้อความ</button>
              <a className="btn btn--ghost" href={`https://line.me/R/msg/text/?${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">💬 ส่งไลน์</a>
              <button type="button" className="btn btn--ghost" onClick={copy}>📋 คัดลอก</button>
            </div>
          </div>
        )}

        {main === 'image' && (
          <div className="sv-pane">
            <div className="sv-sticky">
              <div className="sv-preview">
                {img ? <img className="sv-img" src={img} alt={`ตัวอย่างภาพ ${refLabel}`} /> : <p className="source-note">กำลังสร้างภาพ…</p>}
              </div>
              <div className="sv-subs" role="tablist" aria-label="เครื่องมือตกแต่ง">
                {SUBS.map((x) => <button key={x.id} type="button" role="tab" aria-selected={sub === x.id} className={`sv-sub${sub === x.id ? ' sv-sub--on' : ''}`} onClick={() => setSub(x.id)}>{x.label}</button>)}
              </div>
            </div>

            {sub === 'photo' && (
              <div className="sv-tools">
                <div className="sv-row">
                  <button type="button" className="btn btn--gold" onClick={() => photoIn.current?.click()}>📷 เลือกรูปจากเครื่อง</button>
                  {photo && <button type="button" className="btn btn--ghost" onClick={() => { setOrig(undefined); setVersions([]); setVi(-1) }}>✕ เอารูปออก</button>}
                  <input ref={photoIn} type="file" accept="image/*" hidden aria-label="เลือกรูปพื้นหลัง" onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = '' }} />
                </div>
                {!photo ? <p className="source-note">ยังไม่ได้เลือกรูป — ตอนนี้ใช้พื้นหลังสี เลือกรูปจากเครื่องแล้วจะปรับภาพ ใส่ฟิลเตอร์ ซูม เลื่อนตำแหน่งได้ที่นี่</p> : (
                  <>
                    <p className="sv-h">✨ แต่งอัตโนมัติ (ในเครื่อง ฟรี)</p>
                    <div className="sv-row"><button type="button" className="btn btn--gold" id="sv-auto" onClick={autoFix}>🪄 ปรับสว่าง/สี อัตโนมัติ</button></div>
                    <Chips label="โทนสีตามช่วงเวลา" items={TONES} value={style.tone} onPick={(v) => upd({ tone: v })} />
                    {style.tone !== 'none' && <Slider label="ความแรงของโทน" value={style.toneStrength} min={0.1} max={1} step={0.05} onChange={(v) => upd({ toneStrength: v })} />}

                    <p className="sv-h">🤖 AI แต่งรูป (Gemini) — ตัดสายไฟ/ของรก เปลี่ยนโทนแสง สร้างซ้ำได้จนพอใจ</p>
                    {!hasGeminiKeyForPhoto() ? <p className="ai-keys__err">ต้องใส่คีย์ Gemini ที่ ตั้งค่า › ผู้ช่วย AI ก่อน จึงจะใช้ AI แต่งรูปได้ (ส่วนปรับอัตโนมัติด้านบนใช้ได้เลยโดยไม่ต้องมีคีย์)</p> : (
                      <>
                        <div className="sv-goals" role="group" aria-label="สิ่งที่ให้ AI ทำ">
                          {AI_GOALS.map((g) => (
                            <label key={g.id} className="sv-chk"><input type="checkbox" checked={goals.includes(g.id)} onChange={(e) => setGoals(e.target.checked ? [...goals, g.id] : goals.filter((x) => x !== g.id))} /> {g.label}</label>
                          ))}
                        </div>
                        <label className="sv-foot">สั่งเพิ่มเติม (ไม่บังคับ)
                          <input value={note} maxLength={120} placeholder="เช่น ตัดเสาไฟด้านซ้ายออกด้วย" onChange={(e) => setNote(e.target.value)} />
                        </label>
                        <label className="sv-chk sv-consent"><input type="checkbox" id="sv-consent" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> ยินยอมส่งรูปนี้ไปให้ Google Gemini ประมวลผล (รูปออกจากเครื่องนี้ และใช้โควต้า Gemini ของคุณ)</label>
                        <div className="sv-row">
                          <button type="button" className="btn btn--gold" id="sv-ai" disabled={!consent || !goals.length && !note.trim() || aiBusy} onClick={generate}>{aiBusy ? '⏳ AI กำลังแต่ง…' : versions.length ? `🔁 สร้างใหม่ (แบบอื่น) · ครั้งที่ ${versions.length + 1}` : '✨ ให้ AI แต่งรูป'}</button>
                          {aiBusy && <button type="button" className="btn btn--ghost" onClick={() => abort.current?.abort()}>ยกเลิก</button>}
                        </div>
                        {aiErr && <p className="ai-keys__err" role="alert">{aiErr}</p>}
                        {versions.length > 0 && (
                          <div className="sv-vers" role="group" aria-label="รูปที่ AI แต่งให้">
                            <button type="button" aria-pressed={vi === -1} className={`sv-ver${vi === -1 ? ' sv-ver--on' : ''}`} onClick={() => setVi(-1)}><img src={orig} alt="รูปต้นฉบับ" /><span>ต้นฉบับ</span></button>
                            {versions.map((v, i) => (
                              <button key={i} type="button" aria-pressed={vi === i} className={`sv-ver${vi === i ? ' sv-ver--on' : ''}`} onClick={() => setVi(i)}><img src={v} alt={`ผลที่ ${i + 1}`} /><span>ครั้งที่ {i + 1}</span></button>
                            ))}
                          </div>
                        )}
                        <p className="source-note">AI ตัดสายไฟ/ของรกได้ในหลายภาพ แต่ไม่การันตีว่าสะอาดทุกภาพ — ไม่พอใจก็กด “สร้างใหม่” ได้เรื่อยๆ (เก็บ 6 ครั้งล่าสุด) และกดภาพย่อเพื่อเลือกอันที่ชอบหรือกลับต้นฉบับ</p>
                      </>
                    )}

                    <p className="sv-h">ฟิลเตอร์</p>
                    <Chips label="ฟิลเตอร์" items={FILTERS} value={style.filter} onPick={(v) => upd({ filter: v })} />
                    <p className="sv-h">ปรับภาพ</p>
                    <Slider label="สว่าง" value={style.brightness} min={-50} max={50} onChange={(v) => upd({ brightness: v })} />
                    <Slider label="คอนทราสต์" value={style.contrast} min={-50} max={50} onChange={(v) => upd({ contrast: v })} />
                    <Slider label="ความสดของสี" value={style.saturation} min={-100} max={100} onChange={(v) => upd({ saturation: v })} />
                    <Slider label="เบลอ" value={style.blur} min={0} max={12} onChange={(v) => upd({ blur: v })} />
                    <p className="sv-h">ตำแหน่งรูป</p>
                    <Slider label="ซูม" value={style.photoZoom} min={1} max={3} step={0.05} unit="×" onChange={(v) => upd({ photoZoom: v })} />
                    <Slider label="เลื่อนซ้าย-ขวา" value={style.photoX} min={-1} max={1} step={0.05} onChange={(v) => upd({ photoX: v })} />
                    <Slider label="เลื่อนขึ้น-ลง" value={style.photoY} min={-1} max={1} step={0.05} onChange={(v) => upd({ photoY: v })} />
                    <p className="sv-h">ฟิล์มสีทับรูป (ให้ตัวอักษรอ่านง่าย)</p>
                    <Chips label="รูปแบบฟิล์ม" items={[{ id: 'bottom', label: 'ไล่จากล่าง' }, { id: 'solid', label: 'ทึบทั้งภาพ' }, { id: 'vignette', label: 'ขอบมืด' }]} value={style.overlayMode} onPick={(v) => upd({ overlayMode: v })} />
                    <Slider label="ความเข้ม" value={style.overlayOpacity} min={0} max={0.9} step={0.05} onChange={(v) => upd({ overlayOpacity: v })} />
                    <ColorField label="สีฟิล์ม" value={style.overlay} onChange={(v) => upd({ overlay: v })} />
                  </>
                )}
              </div>
            )}

            {sub === 'style' && (
              <div className="sv-tools">
                <p className="sv-h">สไตล์สำเร็จรูป (แตะแล้วปรับต่อได้)</p>
                <Chips label="สไตล์สำเร็จรูป" items={STYLE_PRESETS} value={style.preset} onPick={(v) => upd({ ...(STYLE_PRESETS.find((x) => x.id === v)?.patch ?? {}), preset: v })} />
                <p className="sv-h">ลวดลายพื้นหลัง</p>
                <Chips label="ลวดลาย" items={PATTERNS} value={style.pattern} onPick={(v) => upd({ pattern: v })} />
                <p className="sv-h">กรอบ</p>
                <Chips label="กรอบ" items={FRAMES} value={style.frame} onPick={(v) => upd({ frame: v })} />
                <p className="sv-h">ตัวอักษร</p>
                <Chips label="ตำแหน่งข้อความ" items={[{ id: 'center', label: 'กึ่งกลาง' }, { id: 'left', label: 'ชิดซ้าย' }]} value={style.align} onPick={(v) => upd({ align: v })} />
                <Chips label="แบบอักษร" items={[{ id: 'sans', label: 'ทั่วไป' }, { id: 'serif', label: 'มีหัว (เซอริฟ)' }]} value={style.font} onPick={(v) => upd({ font: v })} />
                <Chips label="กล่องหลังข้อความ" items={[{ id: 'none', label: 'ไม่มีกล่อง' }, { id: 'glass', label: 'โปร่งใส' }, { id: 'solid', label: 'ทึบ' }]} value={style.box} onPick={(v) => upd({ box: v })} />
                <Slider label="ขนาดตัวอักษร" value={style.fontScale} min={0.7} max={1.3} step={0.05} unit="×" onChange={(v) => upd({ fontScale: v })} />
                <label className="sv-chk"><input type="checkbox" checked={style.quote} onChange={(e) => upd({ quote: e.target.checked })} /> เครื่องหมายคำพูดตกแต่ง “</label>
              </div>
            )}

            {sub === 'color' && (
              <div className="sv-tools">
                <p className="source-note">เลือกจากวงสี พิมพ์รหัสสี (#RRGGBB) หรือเลื่อนแถบเฉดสี — รหัสสีที่ได้แสดงด้านขวา</p>
                <ColorField label="สีตัวอักษร" value={style.text} onChange={(v) => upd({ text: v })} />
                <ColorField label="สีเน้น (ชื่อข้อ · เครื่องหมาย)" value={style.accent} onChange={(v) => upd({ accent: v })} />
                <ColorField label="สีกรอบ" value={style.frameColor} onChange={(v) => upd({ frameColor: v })} />
                <p className="sv-h">สีพื้นหลัง (ไล่ 3 สี — ใช้เมื่อไม่ได้เลือกรูป)</p>
                <ColorField label="พื้นหลัง 1" value={style.bg1} onChange={(v) => upd({ bg1: v })} />
                <ColorField label="พื้นหลัง 2" value={style.bg2} onChange={(v) => upd({ bg2: v })} />
                <ColorField label="พื้นหลัง 3" value={style.bg3} onChange={(v) => upd({ bg3: v })} />
              </div>
            )}

            {sub === 'logo' && (
              <div className="sv-tools">
                <label className="sv-chk"><input type="checkbox" checked={style.showLogo} onChange={(e) => upd({ showLogo: e.target.checked })} /> แสดงโลโก้</label>
                <div className="sv-row">
                  <button type="button" className="btn btn--ghost" onClick={() => logoIn.current?.click()}>🖼️ เปลี่ยนโลโก้</button>
                  {logo && <button type="button" className="btn btn--ghost" onClick={() => setLogo(undefined)}>↺ ใช้โลโก้มาตรฐาน</button>}
                  <input ref={logoIn} type="file" accept="image/*" hidden aria-label="เลือกรูปโลโก้" onChange={(e) => { void pickLogo(e.target.files?.[0]); e.target.value = '' }} />
                </div>
                <label className="sv-foot">ข้อความท้ายภาพ
                  <input value={style.footer} maxLength={40} onChange={(e) => upd({ footer: e.target.value })} />
                </label>
                <p className="source-note">โลโก้ สไตล์ และสีที่เลือกจำไว้ในเครื่องนี้ (รูปพื้นหลังไม่ถูกเก็บ) · ภาพสร้างในเครื่อง ไม่ส่งข้อมูลไปที่ไหน</p>
              </div>
            )}

            <div className="sv-actions">
              <button type="button" className="btn btn--gold" disabled={!img || busy} onClick={shareImage}>📤 แชร์ภาพ</button>
              <button type="button" className="btn btn--ghost" disabled={!img || busy} onClick={download}>💾 บันทึกภาพ</button>
            </div>
          </div>
        )}
        {msg && <p className="nb-sync nb-sync--ok" role="status">{msg}</p>}
      </div>
    </div>
  )
}
