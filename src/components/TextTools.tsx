import { useEffect, useRef, useState } from 'react'
import { openPronEditor, Spoken, TOOLS_EVENT, type ToolsDetail } from './Spoken'
import { HL_COLORS } from '../lib/highlights'
import { useTextHighlights } from '../lib/textHighlights'
import { EN_BOOKS, loadBookEn } from '../data/bible'
import { getAiProvider } from '../lib/ai'
import { useSpeech } from '../lib/speech'

/**
 * แถบเครื่องมือเมื่อกดค้างที่ข้อความ (ทุกหน้าที่อ่านออกเสียงได้) — ชุดเดียวกับแถบในหน้าพระคัมภีร์
 * ไฮไลต์ · คัดลอก · แชร์ · อังกฤษ · คำอ่าน · ฟังต่อ
 */
export default function TextTools() {
  const [d, setD] = useState<ToolsDetail | null>(null)
  const [msg, setMsg] = useState('')
  const [palette, setPalette] = useState(false)
  const [en, setEn] = useState<ToolsDetail | null>(null)
  const hl = useTextHighlights()
  useEffect(() => {
    const on = (e: Event) => { setD((e as CustomEvent<ToolsDetail>).detail); setMsg(''); setPalette(false) }
    const close = () => setD(null)
    window.addEventListener(TOOLS_EVENT, on)
    window.addEventListener('hashchange', close)
    return () => { window.removeEventListener(TOOLS_EVENT, on); window.removeEventListener('hashchange', close) }
  }, [])
  const word = d ? d.text.slice(d.start, d.end) : ''
  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(''), 1600) }
  const copy = async () => {
    if (!d) return
    try { await navigator.clipboard.writeText(d.text); flash('คัดลอกแล้ว วางในแชต Line ได้เลย') } catch { flash('คัดลอกไม่ได้') }
  }
  const share = async () => {
    if (!d) return
    if (navigator.share) { try { await navigator.share({ text: d.text }) } catch { /* ยกเลิก */ } return }
    copy()
  }
  const paint = (c: string | null) => { if (d && hl) hl.paint(d.text, c); setPalette(false); setD(null) }
  return (
    <>
      {d && (
        <div className="bible-selbar text-tools" role="toolbar" aria-label="เครื่องมือข้อความ">
          {palette && (
            <div className="bible-colors" role="group" aria-label="เลือกสีไฮไลต์">
              {HL_COLORS.map((c) => <button key={c.id} type="button" className={`hl-dot hl--${c.id}`} onClick={() => paint(c.id)} aria-label={`ไฮไลต์สี${c.label}`} />)}
              <button type="button" className="hl-dot hl-dot--clear" onClick={() => paint(null)} aria-label="ลบไฮไลต์">✕</button>
            </div>
          )}
          <div className="bible-selbar__top">
            <span className="bible-selbar__ref">{msg || `“${word}” · ${d.text.slice(0, 36)}${d.text.length > 36 ? '…' : ''}`}</span>
            <button type="button" className="bible-selbar__x" onClick={() => setD(null)} aria-label="ปิดเครื่องมือ">✕</button>
          </div>
          <div className="bible-selbar__btns">
            <button type="button" onClick={() => setPalette(!palette)} aria-pressed={palette} aria-label="ไฮไลต์"><span>🖍️</span>ไฮไลต์</button>
            <button type="button" onClick={copy} aria-label="คัดลอกข้อความ"><span>📋</span>คัดลอก</button>
            <button type="button" onClick={share} aria-label="แชร์ข้อความ"><span>📤</span>แชร์</button>
            <button type="button" onClick={() => { setEn(d); setD(null) }} aria-label="แปลอังกฤษ"><span>🌐</span>อังกฤษ</button>
            <button type="button" onClick={() => { openPronEditor({ text: d.text, start: d.start, end: d.end }); setD(null) }} aria-label="แก้คำอ่าน"><span>🔤</span>คำอ่าน</button>
            <button type="button" disabled={!d.read} onClick={() => { d.read?.(); setD(null) }} aria-label="ฟังจากตรงนี้"><span>🔊</span>ฟังต่อ</button>
          </div>
        </div>
      )}
      {en && <EnglishPopup d={en} onClose={() => setEn(null)} />}
    </>
  )
}

type EnState = { kind: 'loading' } | { kind: 'ok'; label: string; source: string; lines: { n?: number; t: string }[] } | { kind: 'none' }

/**
 * ภาษาอังกฤษ: ข้อพระคัมภีร์ใช้ฉบับ World English Bible (ไม่ให้ AI แปลพระคัมภีร์)
 * ข้อความทั่วไป (เรื่องเล่า คำอธิษฐาน) ใช้ผู้ช่วย AI ที่ใส่คีย์ไว้ · ไม่มีคีย์ → เปิด Google แปลภาษา
 */
function EnglishPopup({ d, onClose }: { d: ToolsDetail; onClose: () => void }) {
  const [st, setSt] = useState<EnState>({ kind: 'loading' })
  const tts = useSpeech('en-US')
  const [at, setAt] = useState<{ i: number; c: number; e: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const ctl = useRef<AbortController | null>(null)
  useEffect(() => {
    let alive = true
    ;(async () => {
      if (d.verse) {
        const c = await loadBookEn(d.verse.book)
        const lines = d.verse.verses.map((n) => ({ n, t: c?.[d.verse!.ch - 1]?.[n - 1] ?? '' })).filter((x) => x.t)
        const vs = d.verse.verses
        if (alive) setSt(lines.length ? { kind: 'ok', label: `${EN_BOOKS[d.verse.book - 1]} ${d.verse.ch}:${vs[0]}${vs.length > 1 ? `–${vs[vs.length - 1]}` : ''}`, source: 'World English Bible (ฉบับภาษาอังกฤษ สาธารณสมบัติ)', lines } : { kind: 'none' })
        return
      }
      const provider = await getAiProvider()
      if (!provider) return alive && setSt({ kind: 'none' })
      const c = new AbortController()
      ctl.current = c
      try {
        const r = (await provider.json(
          `Translate this Thai text into natural, warm English for a church setting. If it quotes the Bible, keep the meaning but do not invent verse text. Reply as JSON {"en": "..."} only.\n\n${d.text}`,
          { signal: c.signal, cacheHours: 24 * 30 },
        )) as { en?: string }
        const t = typeof r?.en === 'string' ? r.en.trim() : ''
        if (alive) setSt(t ? { kind: 'ok', label: 'English', source: 'แปลโดยผู้ช่วย AI · ตรวจความถูกต้องก่อนใช้', lines: t.split(/\n+/).map((x) => ({ t: x })) } : { kind: 'none' })
      } catch {
        if (alive) setSt({ kind: 'none' })
      }
    })()
    return () => { alive = false; ctl.current?.abort() }
  }, [d])
  const close = () => { tts.stop(); onClose() }
  const ok = st.kind === 'ok' ? st : null
  const play = (from?: { id: string; at: number }) => {
    if (!ok) return
    tts.speakSections(
      ok.lines.map((x, i) => ({ id: String(i), text: x.t })),
      (id) => setAt({ i: Number(id), c: 0, e: 0 }),
      (id, c, e) => setAt({ i: Number(id), c, e }),
      from,
    )
  }
  const active = (tts.speaking || tts.paused) && at
  const gt = `https://translate.google.com/?sl=th&tl=en&op=translate&text=${encodeURIComponent(d.text)}`
  return (
    <div className="sheet-backdrop" onClick={close}>
      <div className="sheet sheet--short en-sheet" role="dialog" aria-modal="true" aria-label="ภาษาอังกฤษ" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__head">
          <div className="sheet__title"><strong>🌐 {ok?.label ?? 'English'}</strong><span>{ok?.source ?? 'ภาษาอังกฤษ'}</span></div>
          <button type="button" className="sheet__close" onClick={close}>ปิด</button>
        </div>
        <div className="en-sheet__text" lang="en">
          {st.kind === 'loading' && <p className="empty">กำลังแปล…</p>}
          {st.kind === 'none' && (
            <div className="empty">
              <p>ยังแปลในแอปไม่ได้ (ต้องใส่คีย์ผู้ช่วย AI ในหน้าตั้งค่า)</p>
              <a className="btn btn--gold" href={gt} target="_blank" rel="noopener noreferrer">เปิด Google แปลภาษา ↗</a>
            </div>
          )}
          {ok && ok.lines.map((x, i) => (
            <p key={i} className={`bv${active && at.i === i ? ' bv--now' : ''}`}>
              {x.n && <sup>{x.n}</sup>}
              <Spoken text={x.t} id={String(i)} follow={active ? { id: String(at.i), at: at.c, end: at.e } : null} word onTap={(id, c) => play({ id, at: c })} />
            </p>
          ))}
        </div>
        {ok && tts.supported && (
          <div className="en-sheet__controls">
            {tts.speaking ? (
              <button type="button" className="btn btn--gold" onClick={tts.pause} aria-label="Pause">⏸ หยุด</button>
            ) : tts.paused ? (
              <button type="button" className="btn btn--gold" onClick={tts.resume} aria-label="Resume">▶ ฟังต่อ</button>
            ) : (
              <button type="button" className="btn btn--gold" onClick={() => play()} aria-label="Read aloud">🔊 อ่านออกเสียง</button>
            )}
            <button type="button" className="btn btn--ghost" onClick={() => play()} aria-label="Replay">↺ เล่นซ้ำ</button>
            <button type="button" className={`btn ${tts.looping ? 'btn--navy' : 'btn--ghost'}`} aria-pressed={tts.looping} onClick={() => tts.setLoop(!tts.looping)} aria-label="Loop">🔁 วน{tts.looping ? ' (เปิด)' : ''}</button>
            <button type="button" className="btn btn--ghost" onClick={async () => { try { await navigator.clipboard.writeText(ok.lines.map((x) => (x.n ? `${x.n} ${x.t}` : x.t)).join('\n')); setCopied(true); window.setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ } }}>{copied ? '✓ คัดลอกแล้ว' : '📋 คัดลอก'}</button>
          </div>
        )}
      </div>
    </div>
  )
}
