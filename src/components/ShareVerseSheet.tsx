import { useCallback, useEffect, useRef, useState } from 'react'
import ColorField from './ColorField'
import {
  FILTERS, FRAMES, PATTERNS, STYLE_PRESETS, TONES, autoAdjust, DEFAULT_STYLE, STANDARD_LOGO, drawVerse, fileToLogo, handleOf, loadLogoImage, paintLogo, fileToPhoto, getSharePrefs, renderVerseImage, setSharePrefs, shareText,
  type Boxes, type ShareLine, type ShareStyle,
} from '../lib/shareVerse'
import { AI_GOALS, aiEditPhoto, aiGenerateBackground, hasGeminiKeyForPhoto } from '../lib/aiPhoto'
import { ARTS, SCENES, makeArt, makeRandomArt } from '../lib/shareBackgrounds'
import { FIT_KEYS, deleteLogo, fitOf, listLogos, saveLogo, type LogoPreset } from '../lib/shareLogos'
import { addStock, blobToDataUrl, clearStock, listStock, removeStock, shrinkToBlob, type StockItem } from '../lib/shareStock'
import { COMMONS_TOPICS, fetchCommonsPhoto, searchCommons, type CommonsHit } from '../lib/commonsPhotos'

type Main = 'text' | 'image'
type Sub = 'photo' | 'style' | 'layout' | 'color' | 'logo'
type Pick = 'text' | 'logo' | null

const SUBS: { id: Sub; label: string }[] = [
  { id: 'photo', label: '📷 ภาพ' }, { id: 'style', label: '🎨 สไตล์' }, { id: 'layout', label: '✋ จัดวาง' }, { id: 'color', label: '🌈 สี' }, { id: 'logo', label: '🏷️ โลโก้' },
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
 * ซูมรูปพื้นหลัง: จุดกึ่งกลางแถบ = 1× (พอดีเต็มการ์ด) · ซ้าย = ซูมออก (ลงไปถึง 0.5×) · ขวา = ซูมเข้า (ถึง 3×)
 * แตะกลางแถบหรือกดปุ่ม "กลับ 1×" เพื่อคืนค่า · ลากผ่านกลางจะดูดเข้า 1× ให้เอง
 */
const zoomToPos = (z: number) => (z >= 1 ? (z - 1) / 2 : (z - 1) / 0.5)
const posToZoom = (t: number) => (Math.abs(t) < 0.04 ? 1 : Math.round((t >= 0 ? 1 + 2 * t : 1 + 0.5 * t) * 100) / 100)
function ZoomSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="sv-sl sv-zoom">
      <span className="sv-zoom__head"><i>ซูม <b>{Math.round(value * 100) / 100}×</b></i>{Math.abs(value - 1) > 0.001 && <button type="button" className="mini" id="sv-zoom-reset" onClick={() => onChange(1)}>↺ กลับ 1×</button>}</span>
      <input type="range" id="sv-zoom" aria-label="ซูมรูป (กลางแถบ = 1×)" aria-valuetext={`${Math.round(value * 100) / 100} เท่า`} min={-1} max={1} step={0.01} value={zoomToPos(value)} onChange={(e) => onChange(posToZoom(+e.target.value))} />
      <span className="sv-zoom__ends" aria-hidden="true"><span>🔍− ซูมออก</span><span>1× พอดี</span><span>ซูมเข้า 🔍+</span></span>
    </div>
  )
}
/** รูปที่เลือกไว้ + ผล AI: จำไว้ตลอดที่เปิดแอป (ปิดหน้าต่างแล้วเปิดข้ออื่นยังใช้รูปเดิมได้ · ไม่เก็บถาวร) */
const kept: { orig?: string; versions: string[]; vi: number } = { versions: [], vi: -1 }
const thumbCache: Record<string, string> = {}
const PHOTO_KEYS: (keyof ShareStyle)[] = ['filter', 'brightness', 'contrast', 'saturation', 'blur', 'sharpness', 'tone', 'toneStrength', 'photoZoom', 'photoX', 'photoY', 'overlay', 'overlayOpacity', 'overlayMode']
const STYLE_KEYS: (keyof ShareStyle)[] = ['preset', 'pattern', 'frame', 'align', 'font', 'fontScale', 'box', 'quote', 'bg1', 'bg2', 'bg3', 'text', 'accent', 'frameColor']
const COLOR_KEYS: (keyof ShareStyle)[] = ['bg1', 'bg2', 'bg3', 'text', 'accent', 'frameColor']
const LOGO_KEYS: (keyof ShareStyle)[] = ['logoBrightness', 'logoSaturation', 'logoSharpness', 'logoScale', 'logoX', 'logoY', 'showLogo', 'logoZoom', 'logoOX', 'logoOY', 'logoShape', 'logoBg']
const CORNERS: { id: string; label: string; x: number; y: number }[] = [
  { id: 'tl', label: 'ซ้ายบน', x: 0.14, y: 0.09 }, { id: 'tc', label: 'กลางบน', x: 0.5, y: 0.09 }, { id: 'tr', label: 'ขวาบน', x: 0.86, y: 0.09 },
  { id: 'bl', label: 'ซ้ายล่าง', x: 0.14, y: 0.91 }, { id: 'bc', label: 'กลางล่าง', x: 0.5, y: 0.86 }, { id: 'br', label: 'ขวาล่าง', x: 0.86, y: 0.91 },
]
const LOGO_BGS: { id: string; label: string }[] = [{ id: '#ffffff', label: 'พื้นขาว' }, { id: 'transparent', label: 'โปร่งใส' }, { id: '#111111', label: 'พื้นดำ' }, { id: '#e0b84c', label: 'พื้นทอง' }]
const LOGO_SHAPES: { id: 'circle' | 'rounded' | 'none'; label: string }[] = [{ id: 'circle', label: '⭕ วงกลม' }, { id: 'rounded', label: '▢ มุมมน' }, { id: 'none', label: 'ไม่มีกรอบ' }]
const STD_ID = 'std'

/**
 * แชร์ข้อพระคัมภีร์ 2 แบบ
 *  1) ข้อความ — แชร์เข้าแอปอื่น / ส่งไลน์ / คัดลอก
 *  2) ภาพการ์ด — ตกแต่งแบบแอปออกแบบ: ภาพจากเครื่อง + ปรับภาพ/ฟิลเตอร์ · สไตล์สำเร็จรูป ลวดลาย กรอบ · สีและรหัสสี · โลโก้ (เปลี่ยนเองได้)
 */
export default function ShareVerseSheet({ refLabel, lines, onClose }: { refLabel: string; lines: ShareLine[]; onClose: () => void }) {
  const init = useRef(getSharePrefs()).current
  const [style, setStyle] = useState<ShareStyle>(init.style)
  const [logo, setLogo] = useState<string | undefined>(init.logo)
  const [logoId, setLogoId] = useState<string | undefined>(init.logoId) // ต้นแบบโลโก้ที่ใช้อยู่
  const [orig, setOrig] = useState<string | undefined>(kept.orig) // รูปต้นฉบับจากเครื่อง (ใช้ระหว่างตกแต่ง ไม่เก็บถาวร)
  const [versions, setVersions] = useState<string[]>(kept.versions) // รูปที่ AI แต่งให้ (แต่ละครั้งที่สร้าง)
  const [vi, setVi] = useState(kept.vi) // รูปที่ใช้อยู่: -1 = ต้นฉบับ
  useEffect(() => { kept.orig = orig; kept.versions = versions; kept.vi = vi }, [orig, versions, vi])
  const [goals, setGoals] = useState<string[]>(['wires', 'evening'])
  const [note, setNote] = useState('')
  const [consent, setConsent] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiErr, setAiErr] = useState('')
  const abort = useRef<AbortController | null>(null)
  const photo = vi >= 0 ? versions[vi] : orig
  const [main, setMain] = useState<Main>('text')
  const [sub, setSub] = useState<Sub>('photo')
  const [sel, setSel] = useState<Pick>('text') // กลุ่มที่เลือกบนภาพตัวอย่าง (ข้อความ/โลโก้)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const logoIn = useRef<HTMLInputElement>(null)
  const photoIn = useRef<HTMLInputElement>(null)
  const flash = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(''), 2600) }
  const upd = (p: Partial<ShareStyle>) => setStyle((s) => ({ ...s, ...p }))
  const resetKeys = (keys: (keyof ShareStyle)[]) => upd(Object.fromEntries(keys.map((k) => [k, DEFAULT_STYLE[k]])) as Partial<ShareStyle>)
  const [confirmReset, setConfirmReset] = useState(false)
  const [thumbs, setThumbs] = useState<Record<string, string>>(thumbCache)
  const [scene, setScene] = useState('all') // หมวดของพื้นหลังสำเร็จรูป
  const [artMax, setArtMax] = useState(12) // แสดงกี่แบบ (ดูเพิ่มทีละ 12)
  const artsAll = ARTS.filter((a) => scene === 'all' || a.scene === scene)
  const artsShown = artsAll.slice(0, artMax)
  useEffect(() => {
    // ภาพย่อสร้างเฉพาะที่แสดงอยู่ แล้วจำไว้ (120 แบบ สร้างทั้งหมดใช้เวลาไม่ถึงวินาที)
    if (main !== 'image' || sub !== 'photo') return
    const need = artsShown.filter((a) => !thumbCache[a.id])
    if (!need.length) return
    const t = window.setTimeout(() => { for (const a of need) thumbCache[a.id] ??= makeArt(a.id, 216); setThumbs({ ...thumbCache }) }, 20)
    return () => window.clearTimeout(t)
  }, [main, sub, scene, artMax]) // eslint-disable-line react-hooks/exhaustive-deps
  // ---------- สต็อกพื้นหลังของฉัน (สร้างเพิ่มทีละ 5–10 รูป เก็บในเครื่อง) ----------
  const [stock, setStock] = useState<StockItem[]>([])
  const [stockMax, setStockMax] = useState(12)
  const [gen, setGen] = useState<{ done: number; total: number } | null>(null)
  const [stockErr, setStockErr] = useState('')
  const [stockClear, setStockClear] = useState(false)
  const refreshStock = async () => setStock(await listStock())
  useEffect(() => { if (main === 'image' && sub === 'photo') void refreshStock() }, [main, sub])
  const thumbOf = async (dataUrl: string) => blobToDataUrl(await shrinkToBlob(dataUrl, 216, 0.8))
  const genStock = async (n: number, ai = false) => {
    if (gen) return
    setStockErr(''); setGen({ done: 0, total: n })
    const made: StockItem[] = []
    try {
      for (let i = 0; i < n; i++) {
        let dataUrl: string, label: string
        if (ai) ({ dataUrl, label } = await aiGenerateBackground(i))
        else { const seed = Date.now() + i * 7919 + Math.floor(Math.random() * 1e6); ({ dataUrl, label } = makeRandomArt(seed, 1080)) }
        const full = await shrinkToBlob(dataUrl, 1600, 0.88)
        made.push({ id: `s${Date.now().toString(36)}${i}${Math.random().toString(36).slice(2, 6)}`, at: Date.now() + i, kind: ai ? 'ai' : 'art', label, thumb: await thumbOf(dataUrl), full })
        setGen({ done: i + 1, total: n })
        await new Promise((r) => window.setTimeout(r, 0)) // ให้จอไม่ค้างระหว่างสร้าง
      }
    } catch (e) {
      setStockErr(e instanceof Error ? e.message : 'สร้างไม่สำเร็จ')
    } finally {
      if (made.length) await addStock(made).catch(() => setStockErr('เก็บลงสต็อกไม่ได้ (พื้นที่เครื่องอาจเต็ม)'))
      setGen(null); await refreshStock()
    }
  }
  const useStockItem = async (it: StockItem) => {
    try { setOrig(await blobToDataUrl(it.full)); setVersions([]); setVi(-1); setAiErr(''); upd({ photoZoom: 1, photoX: 0, photoY: 0 }) } catch { flash('เปิดรูปนี้ไม่ได้') }
  }
  const delStock = async (id: string) => { await removeStock(id); await refreshStock() }
  const wipeStock = async () => { await clearStock(); setStockClear(false); await refreshStock(); setStockMax(12) }

  // ---------- โลโก้ต้นแบบ: ปรับพอดีวง + บันทึกหลายอัน (เก็บตำแหน่งที่วางไว้ด้วย) ----------
  const [presets, setPresets] = useState<LogoPreset[]>([])
  const [logoName, setLogoName] = useState('')
  const [logoImgEl, setLogoImgEl] = useState<HTMLImageElement | null>(null)
  const [stdThumb, setStdThumb] = useState('')
  const [logoDel, setLogoDel] = useState<string | null>(null)
  const edCv = useRef<HTMLCanvasElement>(null)
  const refreshLogos = async () => setPresets(await listLogos())
  useEffect(() => { if (main === 'image' && sub === 'logo') void refreshLogos() }, [main, sub])
  useEffect(() => { let alive = true; void loadLogoImage(logo || STANDARD_LOGO).then((i) => alive && setLogoImgEl(i)); return () => { alive = false } }, [logo])
  const logoThumb = (img: HTMLImageElement, st: ShareStyle) => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128
    const x = c.getContext('2d')!; x.translate(64, 64); x.scale(128 / 124, 128 / 124); paintLogo(x, img, st, 112)
    return c.toDataURL('image/png')
  }
  useEffect(() => {
    if (main !== 'image' || sub !== 'logo' || stdThumb) return
    void loadLogoImage(STANDARD_LOGO).then((i) => { if (i) setStdThumb(logoThumb(i, DEFAULT_STYLE)) })
  }, [main, sub]) // eslint-disable-line react-hooks/exhaustive-deps
  // ช่องปรับโลโก้ (ลากเลื่อนรูปในวง · บีบนิ้วซูม)
  const ED = 360, F = 2.8
  useEffect(() => {
    const c = edCv.current
    if (!c || sub !== 'logo' || main !== 'image') return
    const x = c.getContext('2d')!
    x.clearRect(0, 0, ED, ED)
    for (let i = 0; i < ED; i += 20) for (let j = 0; j < ED; j += 20) { x.fillStyle = ((i + j) / 20) % 2 ? '#d9d9d9' : '#f4f4f4'; x.fillRect(i, j, 20, 20) }
    if (logoImgEl) { x.save(); x.translate(ED / 2, ED / 2); x.scale(F, F); paintLogo(x, logoImgEl, style, 112); x.restore() }
  }, [main, sub, logoImgEl, style.logoZoom, style.logoOX, style.logoOY, style.logoShape, style.logoBg, style.logoBrightness, style.logoSaturation, style.logoSharpness]) // eslint-disable-line react-hooks/exhaustive-deps
  const edPts = useRef(new Map<number, { x: number; y: number }>())
  const edDrag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const edPinch = useRef<{ d0: number; z0: number } | null>(null)
  const edDown = (e: React.PointerEvent) => {
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* ignore */ }
    e.preventDefault()
    edPts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (edPts.current.size === 2) { const [a, b] = [...edPts.current.values()]; edPinch.current = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: style.logoZoom }; edDrag.current = null }
    else edDrag.current = { x: e.clientX, y: e.clientY, ox: style.logoOX, oy: style.logoOY }
  }
  const edMove = (e: React.PointerEvent) => {
    if (!edPts.current.has(e.pointerId)) return
    edPts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (edPinch.current && edPts.current.size >= 2) { const [a, b] = [...edPts.current.values()]; upd({ logoZoom: Math.max(0.5, Math.min(4, edPinch.current.z0 * ((Math.hypot(a.x - b.x, a.y - b.y) || 1) / edPinch.current.d0))) }); return }
    const d = edDrag.current; const c = edCv.current
    if (!d || !c) return
    const unit = (c.getBoundingClientRect().width / ED) * F * 56 // พิกเซลหน้าจอต่อ 1 หน่วยเลื่อน
    upd({ logoOX: Math.max(-1.5, Math.min(1.5, d.ox + (e.clientX - d.x) / unit)), logoOY: Math.max(-1.5, Math.min(1.5, d.oy + (e.clientY - d.y) / unit)) })
  }
  const edUp = (e: React.PointerEvent) => { edPts.current.delete(e.pointerId); if (edPts.current.size < 2) edPinch.current = null; if (!edPts.current.size) edDrag.current = null }
  const fillCircle = () => { if (!logoImgEl) return; const r = Math.max(logoImgEl.width, logoImgEl.height) / Math.min(logoImgEl.width, logoImgEl.height); upd({ logoZoom: Math.min(4, Math.round(r * 100) / 100), logoOX: 0, logoOY: 0 }) }
  const applyPreset = (pr: LogoPreset | 'std') => {
    if (pr === 'std') { setLogo(undefined); setLogoId(STD_ID); setLogoName('มาตรฐาน'); upd({ showLogo: true, ...Object.fromEntries(FIT_KEYS.filter((k) => k !== 'footer').map((k) => [k, DEFAULT_STYLE[k]])) }); return }
    setLogo(pr.img === STANDARD_LOGO ? undefined : pr.img); setLogoId(pr.id); setLogoName(pr.name); upd({ showLogo: true, ...pr.fit })
  }
  const savePreset = async (asNew: boolean) => {
    const img = logoImgEl
    if (!img) return
    const id = !asNew && logoId && logoId !== STD_ID ? logoId : `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
    const name = logoName.trim() || `โลโก้ ${presets.length + 1}`
    const old = presets.find((x) => x.id === id)
    const pr: LogoPreset = { id, name, at: old?.at ?? Date.now(), img: logo ?? STANDARD_LOGO, thumb: logoThumb(img, style), fit: fitOf(style) }
    await saveLogo(pr); setLogoId(id); setLogoName(name); await refreshLogos()
    flash(asNew || !old ? `บันทึกโลโก้ “${name}” เป็นต้นแบบแล้ว` : `อัปเดตต้นแบบ “${name}” แล้ว`)
  }
  const removePreset = async (id: string) => { await deleteLogo(id); if (logoId === id) setLogoId(undefined); setLogoDel(null); await refreshLogos() }

  // ---------- ค้นรูปฟรีจากอินเทอร์เน็ต (Wikimedia Commons · สาธารณสมบัติ/CC0) ----------
  const [web, setWeb] = useState(false)
  const [webQ, setWebQ] = useState('sunrise')
  const [webHits, setWebHits] = useState<CommonsHit[]>([])
  const [webNext, setWebNext] = useState<number | null>(null)
  const [webBusy, setWebBusy] = useState(false)
  const [webErr, setWebErr] = useState('')
  const [webCredit, setWebCredit] = useState('')
  const webSearch = async (q: string, offset = 0) => {
    if (!q.trim()) return
    setWebBusy(true); setWebErr('')
    try {
      const r = await searchCommons(q.trim(), offset)
      setWebHits((h) => (offset ? [...h, ...r.hits] : r.hits)); setWebNext(r.next)
      if (!r.hits.length && !offset) setWebErr('ไม่พบรูปสาธารณสมบัติ/CC0 ที่ตรงกับคำนี้ ลองคำอื่น (คำภาษาอังกฤษจะได้ผลมากกว่า)')
    } catch (e) { setWebErr(e instanceof Error ? e.message : 'ค้นไม่สำเร็จ') } finally { setWebBusy(false) }
  }
  const webPick = async (h: CommonsHit) => {
    setWebBusy(true); setWebErr('')
    try {
      const data = await fetchCommonsPhoto(h.title)
      setOrig(data); setVersions([]); setVi(-1); setAiErr(''); upd({ photoZoom: 1, photoX: 0, photoY: 0 })
      setWebCredit(`${h.title.replace(/^File:/, '')} · ${h.license} · Wikimedia Commons`)
    } catch (e) { setWebErr(e instanceof Error ? e.message : 'โหลดรูปไม่สำเร็จ') } finally { setWebBusy(false) }
  }
  const pickArt = (id: string) => { setOrig(makeArt(id, 1080)); setVersions([]); setVi(-1); setAiErr(''); upd({ photoZoom: 1, photoX: 0, photoY: 0 }) }
  const resetAll = () => { setStyle({ ...DEFAULT_STYLE }); setLogo(undefined); setConfirmReset(false); flash('รีเซ็ตทุกอย่างเป็นค่าเริ่มต้นแล้ว (รูปที่เลือกยังอยู่)') }

  useEffect(() => { setSharePrefs({ style, logo, logoId }) }, [style, logo, logoId])

  // ---------- ภาพตัวอย่างสด (canvas) + ลาก/ย่อขยายข้อความและโลโก้ด้วยนิ้ว ----------
  const cv = useRef<HTMLCanvasElement>(null)
  const boxes = useRef<Boxes | null>(null)
  const latest = useRef({ refLabel, lines, style, logo, photo, sel })
  latest.current = { refLabel, lines, style, logo, photo, sel }
  const running = useRef(false)
  const again = useRef(false)
  const redraw = useCallback(async () => {
    if (!cv.current) return
    if (running.current) { again.current = true; return }
    running.current = true
    try {
      const l = latest.current
      const off = document.createElement('canvas')
      const b = await drawVerse(off, { ref: l.refLabel, lines: l.lines, style: l.style, logo: l.logo, photo: l.photo, K: 0.5, ui: { selected: l.sel } })
      const v = cv.current
      if (v) { v.width = off.width; v.height = off.height; v.getContext('2d')!.drawImage(off, 0, 0); boxes.current = b; v.dataset.boxes = JSON.stringify(b) }
    } catch {
      flash('สร้างภาพไม่ได้ในเครื่องนี้')
    } finally {
      running.current = false
      if (again.current) { again.current = false; void redraw() }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const linesKey = JSON.stringify(lines)
  useEffect(() => { if (main === 'image') void redraw() }, [main, refLabel, linesKey, style, logo, photo, sel, redraw])

  const pts = useRef(new Map<number, { x: number; y: number }>())
  const drag = useRef<{ mode: 'move' | 'resize'; target: 'text' | 'logo'; sx: number; sy: number; ox: number; oy: number; os: number; cx: number; cy: number } | null>(null)
  const pinch = useRef<{ target: 'text' | 'logo'; d0: number; s0: number } | null>(null)
  const W = 1080, H = 1350
  const toLogical = (e: React.PointerEvent) => { const r = cv.current!.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H } }
  const hit = (b: { x: number; y: number; w: number; h: number } | null, p: { x: number; y: number }, pad = 0) => !!b && p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad
  const setScale = (t: 'text' | 'logo', v: number) => upd(t === 'text' ? { textScale: Math.max(0.3, Math.min(2.5, v)) } : { logoScale: Math.max(0.3, Math.min(4, v)) })
  const onDown = (e: React.PointerEvent) => {
    if (!cv.current || (e.target as HTMLElement).closest('button')) return // ปุ่ม เปลี่ยนรูป/รีเซ็ต ทำงานของมันเอง
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* บางเครื่องไม่รองรับ ใช้ต่อได้ */ }
    e.preventDefault()
    const p = toLogical(e)
    pts.current.set(e.pointerId, p)
    const st = latest.current.style
    if (pts.current.size === 2 && latest.current.sel) {
      const [a, b] = [...pts.current.values()]
      pinch.current = { target: latest.current.sel, d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: latest.current.sel === 'text' ? st.textScale : st.logoScale }
      drag.current = null
      return
    }
    const bx = boxes.current
    if (!bx) return
    const cur = latest.current.sel
    const curBox = cur === 'text' ? bx.text : cur === 'logo' ? bx.logo : null
    const hd = curBox ? handleOf(curBox) : null
    if (curBox && hd && Math.hypot(p.x - hd.x, p.y - hd.y) <= 48) {
      // จับมุมทอง → ย่อ/ขยาย
      const cx = curBox.x + curBox.w / 2, cy = curBox.y + curBox.h / 2
      drag.current = { mode: 'resize', target: cur!, sx: p.x, sy: p.y, ox: 0, oy: 0, os: cur === 'text' ? st.textScale : st.logoScale, cx, cy }
      return
    }
    const target: 'text' | 'logo' | null = hit(bx.logo, p, 10) ? 'logo' : hit(bx.text, p, 10) ? 'text' : null
    setSel(target)
    if (target) drag.current = { mode: 'move', target, sx: p.x, sy: p.y, ox: target === 'text' ? st.textX : st.logoX, oy: target === 'text' ? st.textY : st.logoY, os: 0, cx: 0, cy: 0 }
  }
  const onMove = (e: React.PointerEvent) => {
    if (!pts.current.has(e.pointerId)) return
    const p = toLogical(e)
    pts.current.set(e.pointerId, p)
    if (pinch.current && pts.current.size >= 2) {
      const [a, b] = [...pts.current.values()]
      setScale(pinch.current.target, pinch.current.s0 * ((Math.hypot(a.x - b.x, a.y - b.y) || 1) / pinch.current.d0))
      return
    }
    const d = drag.current
    if (!d) return
    if (d.mode === 'move') {
      const nx = Math.max(0, Math.min(1, d.ox + (p.x - d.sx) / W)), ny = Math.max(0, Math.min(1, d.oy + (p.y - d.sy) / H))
      upd(d.target === 'text' ? { textX: nx, textY: ny } : { logoX: nx, logoY: ny })
    } else {
      const d0 = Math.hypot(d.sx - d.cx, d.sy - d.cy) || 1
      setScale(d.target, d.os * (Math.hypot(p.x - d.cx, p.y - d.cy) / d0))
    }
  }
  const onUp = (e: React.PointerEvent) => {
    pts.current.delete(e.pointerId)
    if (pts.current.size < 2) pinch.current = null
    if (pts.current.size === 0) drag.current = null
  }

  // ---------- ย้อนกลับทีละหน้า (ไม่ออกจากหน้าต่าง/ไม่เริ่มใหม่) ----------
  const stepNow = useRef({ main, sub, onClose })
  stepNow.current = { main, sub, onClose }
  const order: Sub[] = ['photo', 'style', 'layout', 'color', 'logo']
  const goBack = (): boolean => {
    const { main: m, sub: sb } = stepNow.current
    if (m === 'image') {
      const k = order.indexOf(sb)
      if (k > 0) setSub(order[k - 1])
      else setMain('text')
      return true
    }
    return false // หน้าแรกของหน้าต่าง → ปิดหน้าต่าง
  }
  const goNext = () => {
    if (main === 'text') { setMain('image'); return }
    const k = order.indexOf(sub)
    if (k < order.length - 1) setSub(order[k + 1])
  }
  useEffect(() => {
    // ปุ่มย้อนกลับของมือถือ/เบราว์เซอร์ = ย้อนทีละหน้าในหน้าต่างนี้ ถ้าอยู่หน้าแรกจึงปิดหน้าต่าง (ไม่ออกจากหน้าที่กำลังดู)
    const push = () => window.history.pushState({ ...(window.history.state ?? {}), sv: 1 }, '')
    push()
    let closed = false
    const onPop = () => {
      if (closed) return
      if (goBack()) { push(); return }
      closed = true
      stepNow.current.onClose()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      if (!closed && window.history.state?.sv) { closed = true; window.history.back() }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    try { setLogo(await fileToLogo(f)); setLogoId(undefined); setLogoName(''); upd({ showLogo: true, logoZoom: 1, logoOX: 0, logoOY: 0 }) } catch { flash('เปิดรูปนี้ไม่ได้ ลองรูปอื่น') }
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
              <button type="button" className="btn btn--ghost" onClick={goNext}>🖼️ ทำเป็นภาพ ▶</button>
            </div>
          </div>
        )}

        {main === 'image' && (
          <div className="sv-pane">
            <input ref={photoIn} type="file" accept="image/*" hidden aria-label="เลือกรูปพื้นหลัง" onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = '' }} />
            <div className="sv-sticky">
              {/* รับสัมผัสทั้งแถบ (กว้างกว่าภาพ) เพื่อให้บีบนิ้วได้แม้นิ้วหนึ่งอยู่นอกขอบภาพ */}
              <div className="sv-preview" style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
                onContextMenu={(e) => e.preventDefault()} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onLostPointerCapture={onUp}>
                <canvas ref={cv} className="sv-canvas" width={540} height={675} aria-label={`ตัวอย่างภาพ ${refLabel} — ลากข้อความหรือโลโก้เพื่อย้าย บีบนิ้วเพื่อย่อขยาย`} />
                <button type="button" className="sv-reset" aria-label="รีเซ็ตทั้งหมดเป็นค่าเริ่มต้น" onClick={() => setConfirmReset(true)}>↺ รีเซ็ต</button>
                <button type="button" className="sv-swap" aria-label="เปลี่ยนรูปพื้นหลัง" onClick={() => photoIn.current?.click()}>📷 {photo ? 'เปลี่ยนรูป' : 'เลือกรูป'}</button>
              </div>
              {confirmReset && (
                <div className="sv-confirm" role="alertdialog" aria-label="ยืนยันรีเซ็ต">
                  <span>รีเซ็ตสไตล์ ตำแหน่ง สี ฟิลเตอร์ และโลโก้ กลับเป็นค่าเริ่มต้น? (รูปที่เลือกยังอยู่)</span>
                  <button type="button" className="btn btn--danger" id="sv-reset-all" onClick={resetAll}>รีเซ็ต</button>
                  <button type="button" className="btn btn--ghost" onClick={() => setConfirmReset(false)}>ยกเลิก</button>
                </div>
              )}
              <p className="sv-hint">👆 แตะข้อความหรือโลโก้บนภาพ แล้วลากเพื่อย้าย · บีบนิ้ว หรือลากจุดทองที่มุมเพื่อย่อ/ขยาย</p>
              <div className="sv-subs" role="tablist" aria-label="เครื่องมือตกแต่ง">
                {SUBS.map((x) => <button key={x.id} type="button" role="tab" aria-selected={sub === x.id} className={`sv-sub${sub === x.id ? ' sv-sub--on' : ''}`} onClick={() => setSub(x.id)}>{x.label}</button>)}
              </div>
            </div>

            {sub === 'photo' && (
              <div className="sv-tools">
                <div className="sv-row">
                  <button type="button" className="btn btn--gold" onClick={() => photoIn.current?.click()}>📷 เลือกรูปจากเครื่อง</button>
                  {photo && <button type="button" className="btn btn--ghost" onClick={() => { setOrig(undefined); setVersions([]); setVi(-1) }}>✕ เอารูปออก</button>}
                </div>
                <p className="sv-h">🖼️ พื้นหลังสำเร็จรูป {ARTS.length} แบบ (ฟรี วาดขึ้นในแอป ไม่มีลิขสิทธิ์)</p>
                <div className="sv-chips" role="group" aria-label="หมวดพื้นหลัง">
                  <button type="button" aria-pressed={scene === 'all'} className={`sv-chip${scene === 'all' ? ' sv-chip--on' : ''}`} onClick={() => { setScene('all'); setArtMax(12) }}>ทั้งหมด ({ARTS.length})</button>
                  {SCENES.map((x) => <button key={x.id} type="button" aria-pressed={scene === x.id} className={`sv-chip${scene === x.id ? ' sv-chip--on' : ''}`} onClick={() => { setScene(x.id); setArtMax(12) }}>{x.label}</button>)}
                </div>
                <div className="sv-arts" role="group" aria-label="พื้นหลังสำเร็จรูป">
                  {artsShown.map((a) => (
                    <button key={a.id} type="button" className="sv-art" aria-label={`พื้นหลัง ${a.label}`} onClick={() => pickArt(a.id)}>
                      {thumbs[a.id] ? <img src={thumbs[a.id]} alt="" /> : <span className="sv-art__ph" />}<span>{a.label}</span>
                    </button>
                  ))}
                </div>
                {artsAll.length > artMax && <div className="sv-row"><button type="button" className="btn btn--ghost" id="sv-more-arts" onClick={() => setArtMax(artMax + 12)}>▾ ดูเพิ่ม (แสดง {artMax} จาก {artsAll.length})</button></div>}
                <p className="sv-h">📦 สต็อกพื้นหลังของฉัน ({stock.length} รูป) — สร้างเพิ่มทีละ 5–10 รูป เก็บไว้ใช้ภายหลัง</p>
                <div className="sv-row">
                  <button type="button" className="btn btn--gold" id="sv-gen5" disabled={!!gen} onClick={() => void genStock(5)}>🎲 สร้างเพิ่ม 5 รูป</button>
                  <button type="button" className="btn btn--gold" id="sv-gen10" disabled={!!gen} onClick={() => void genStock(10)}>🎲 สร้างเพิ่ม 10 รูป</button>
                  {hasGeminiKeyForPhoto() && <button type="button" className="btn btn--ghost" id="sv-genai" disabled={!!gen} onClick={() => void genStock(5, true)}>✨ ให้ AI สร้าง 5 รูป</button>}
                </div>
                {gen && <p className="source-note" role="status">กำลังสร้าง {gen.done}/{gen.total}…</p>}
                {stockErr && <p className="ai-keys__err" role="alert">{stockErr}</p>}
                {stock.length === 0 && !gen && <p className="source-note">ยังไม่มีรูปในสต็อก — กด “สร้างเพิ่ม” แบบสุ่มในเครื่อง (ฟรี ไม่จำกัด) หรือ “ให้ AI สร้าง” (ใช้โควต้า Gemini ของคุณ ต้องมีคีย์) รูปที่สร้างเก็บไว้ในเครื่องนี้ ปิดแอปแล้วยังอยู่</p>}
                <div className="sv-arts" role="group" aria-label="สต็อกพื้นหลังของฉัน">
                  {stock.slice(0, stockMax).map((it) => (
                    <div key={it.id} className="sv-stockitem">
                      <button type="button" className="sv-art" aria-label={`ใช้พื้นหลัง ${it.label}`} onClick={() => void useStockItem(it)}>
                        <img src={it.thumb} alt="" /><span>{it.kind === 'ai' ? '✨ ' : ''}{it.label}</span>
                      </button>
                      <button type="button" className="sv-stockx" aria-label={`ลบ ${it.label} ออกจากสต็อก`} onClick={() => void delStock(it.id)}>✕</button>
                    </div>
                  ))}
                </div>
                {stock.length > stockMax && <div className="sv-row"><button type="button" className="btn btn--ghost" id="sv-stock-more" onClick={() => setStockMax(stockMax + 12)}>▾ ดูเพิ่ม (แสดง {stockMax} จาก {stock.length})</button></div>}
                {stock.length > 0 && (stockClear
                  ? <div className="sv-confirm" role="alertdialog" aria-label="ยืนยันล้างสต็อก"><span>ลบรูปในสต็อกทั้งหมด {stock.length} รูป?</span><button type="button" className="btn btn--danger" id="sv-stock-clear-yes" onClick={() => void wipeStock()}>ลบทั้งหมด</button><button type="button" className="btn btn--ghost" onClick={() => setStockClear(false)}>ยกเลิก</button></div>
                  : <div className="sv-row"><button type="button" className="btn btn--ghost" id="sv-stock-clear" onClick={() => setStockClear(true)}>🗑️ ล้างสต็อกทั้งหมด</button></div>)}

                <p className="sv-h">🌐 รูปถ่ายฟรีจากอินเทอร์เน็ต (Wikimedia Commons — เฉพาะสาธารณสมบัติ/CC0 ไม่ต้องให้เครดิต)</p>
                <div className="sv-row"><button type="button" className="btn btn--ghost" id="sv-web-toggle" aria-expanded={web} onClick={() => { setWeb(!web); if (!web && !webHits.length) void webSearch(webQ) }}>{web ? '▴ ซ่อนการค้นรูปจากเน็ต' : '🌐 ค้นรูปฟรีจากเน็ต (หลายพันรูป)'}</button></div>
                {web && (
                  <div className="sv-web">
                    <div className="sv-chips" role="group" aria-label="หัวข้อรูป">
                      {COMMONS_TOPICS.map((t) => <button key={t.id} type="button" aria-pressed={webQ === t.q} className={`sv-chip${webQ === t.q ? ' sv-chip--on' : ''}`} onClick={() => { setWebQ(t.q); void webSearch(t.q) }}>{t.label}</button>)}
                    </div>
                    <div className="sv-row">
                      <input className="sv-webq" aria-label="คำค้นรูป" value={webQ} placeholder="คำค้น เช่น sunrise, mountain, ทะเล" onChange={(e) => setWebQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void webSearch(webQ)} />
                      <button type="button" className="btn btn--gold" id="sv-web-go" disabled={webBusy} onClick={() => void webSearch(webQ)}>{webBusy ? '⏳' : '🔎 ค้น'}</button>
                    </div>
                    {webErr && <p className="ai-keys__err" role="alert">{webErr}</p>}
                    <div className="sv-arts sv-arts--web" role="group" aria-label="ผลค้นรูปฟรี">
                      {webHits.map((h) => (
                        <button key={h.title} type="button" className="sv-art" aria-label={`เลือกรูป ${h.title.replace(/^File:/, '')}`} disabled={webBusy} onClick={() => void webPick(h)}>
                          <img src={h.thumb} alt="" loading="lazy" /><span>{h.license}</span>
                        </button>
                      ))}
                    </div>
                    {webNext !== null && webHits.length > 0 && <div className="sv-row"><button type="button" className="btn btn--ghost" id="sv-web-more" disabled={webBusy} onClick={() => void webSearch(webQ, webNext)}>▾ โหลดรูปเพิ่ม</button></div>}
                    {webCredit && <p className="source-note" role="status">ใช้รูป: {webCredit}</p>}
                    <p className="source-note">ต้องมีอินเทอร์เน็ต · ค้นจาก commons.wikimedia.org (ไม่ส่งข้อมูลส่วนตัวของคุณ) · คัดเฉพาะรูปที่สาธารณสมบัติหรือ CC0 และขนาดไม่เล็กเกินไป · ภาษาอังกฤษได้ผลมากกว่าไทย</p>
                  </div>
                )}
                {!photo ? <p className="source-note">ยังไม่ได้เลือกรูป — ตอนนี้ใช้พื้นหลังสี เลือกรูปจากเครื่องแล้วจะปรับภาพ ใส่ฟิลเตอร์ ซูม เลื่อนตำแหน่งได้ที่นี่</p> : (
                  <>
                    <div className="sv-row"><button type="button" className="btn btn--ghost" id="sv-reset-photo" onClick={() => resetKeys(PHOTO_KEYS)}>↺ รีเซ็ตการปรับรูปเป็นค่าเริ่มต้น</button></div>
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
                    <Slider label="ความคมชัด" value={style.sharpness} min={0} max={100} onChange={(v) => upd({ sharpness: v })} />
                    <Slider label="เบลอ" value={style.blur} min={0} max={12} onChange={(v) => upd({ blur: v })} />
                    <p className="sv-h">ตำแหน่งรูป</p>
                    <ZoomSlider value={style.photoZoom} onChange={(v) => upd({ photoZoom: v })} />
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
                <div className="sv-row"><button type="button" className="btn btn--ghost" onClick={() => resetKeys(STYLE_KEYS)}>↺ รีเซ็ตสไตล์เป็นค่าเริ่มต้น</button></div>
              </div>
            )}

            {sub === 'layout' && (
              <div className="sv-tools">
                <p className="source-note">ลากข้อความหรือโลโก้บนภาพได้เลย หรือใช้แถบเลื่อนด้านล่างเพื่อจัดตำแหน่งละเอียด</p>
                <p className="sv-h">📝 ข้อความ</p>
                <Slider label="ซ้าย–ขวา" value={style.textX} min={0} max={1} step={0.01} onChange={(v) => upd({ textX: v })} />
                <Slider label="บน–ล่าง" value={style.textY} min={0} max={1} step={0.01} onChange={(v) => upd({ textY: v })} />
                <Slider label="ขนาดกรอบ" value={style.textScale} min={0.3} max={2.5} step={0.05} unit="×" onChange={(v) => upd({ textScale: v })} />
                <p className="sv-h">🏷️ โลโก้</p>
                <Slider label="ซ้าย–ขวา" value={style.logoX} min={0} max={1} step={0.01} onChange={(v) => upd({ logoX: v })} />
                <Slider label="บน–ล่าง" value={style.logoY} min={0} max={1} step={0.01} onChange={(v) => upd({ logoY: v })} />
                <Slider label="ขนาดโลโก้" value={style.logoScale} min={0.3} max={4} step={0.05} unit="×" onChange={(v) => upd({ logoScale: v })} />
                <div className="sv-row">
                  <button type="button" className="btn btn--ghost" onClick={() => upd({ textX: 0.5 })}>↔ ข้อความกึ่งกลาง</button>
                  <button type="button" className="btn btn--ghost" onClick={() => upd({ logoX: 0.5 })}>↔ โลโก้กึ่งกลาง</button>
                  <button type="button" className="btn btn--ghost" id="sv-reset-layout" onClick={() => upd({ textX: 0.5, textY: 0.47, textScale: 1, logoX: 0.5, logoY: 0.86, logoScale: 1 })}>↺ จัดตำแหน่งใหม่ทั้งหมด</button>
                </div>
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
                <div className="sv-row"><button type="button" className="btn btn--ghost" onClick={() => resetKeys(COLOR_KEYS)}>↺ รีเซ็ตสีเป็นค่าเริ่มต้น</button></div>
              </div>
            )}

            {sub === 'logo' && (
              <div className="sv-tools">
                <label className="sv-chk"><input type="checkbox" checked={style.showLogo} onChange={(e) => upd({ showLogo: e.target.checked })} /> แสดงโลโก้</label>
                <p className="sv-h">📚 โลโก้ของฉัน — แตะเพื่อใช้ (ตำแหน่งที่บันทึกไว้กลับมาด้วย ยังลากเลื่อนได้)</p>
                <div className="sv-logos" role="group" aria-label="โลโก้ของฉัน">
                  <div className="sv-logoitem">
                    <button type="button" className={`sv-logotile${logoId === STD_ID || (!logoId && !logo) ? ' sv-logotile--on' : ''}`} aria-label="ใช้โลโก้ มาตรฐาน" aria-pressed={logoId === STD_ID} onClick={() => applyPreset('std')}>
                      {stdThumb ? <img src={stdThumb} alt="" /> : <span className="sv-art__ph" />}<span>มาตรฐาน</span>
                    </button>
                  </div>
                  {presets.map((pr) => (
                    <div key={pr.id} className="sv-logoitem">
                      <button type="button" className={`sv-logotile${logoId === pr.id ? ' sv-logotile--on' : ''}`} aria-label={`ใช้โลโก้ ${pr.name}`} aria-pressed={logoId === pr.id} onClick={() => applyPreset(pr)}>
                        <img src={pr.thumb} alt="" /><span>{pr.name}</span>
                      </button>
                      <button type="button" className="sv-stockx" aria-label={`ลบโลโก้ ${pr.name}`} onClick={() => setLogoDel(pr.id)}>✕</button>
                    </div>
                  ))}
                </div>
                {logoDel && (
                  <div className="sv-confirm" role="alertdialog" aria-label="ยืนยันลบโลโก้"><span>ลบต้นแบบโลโก้ “{presets.find((x) => x.id === logoDel)?.name}”?</span>
                    <button type="button" className="btn btn--danger" id="sv-logo-del-yes" onClick={() => void removePreset(logoDel)}>ลบ</button>
                    <button type="button" className="btn btn--ghost" onClick={() => setLogoDel(null)}>ยกเลิก</button></div>
                )}
                <div className="sv-row">
                  <button type="button" className="btn btn--gold" id="sv-logo-new" onClick={() => logoIn.current?.click()}>＋ เพิ่มโลโก้ใหม่</button>
                  {logo && <button type="button" className="btn btn--ghost" onClick={() => { setLogo(undefined); setLogoId(STD_ID) }}>↺ ใช้โลโก้มาตรฐาน</button>}
                  <input ref={logoIn} type="file" accept="image/*" hidden aria-label="เลือกรูปโลโก้" onChange={(e) => { void pickLogo(e.target.files?.[0]); e.target.value = '' }} />
                </div>

                <p className="sv-h">✂️ ปรับโลโก้ให้พอดีวง — ลากรูปเพื่อเลื่อน บีบนิ้ว/แถบเลื่อนเพื่อซูม</p>
                <div className="sv-edwrap">
                  <canvas ref={edCv} className="sv-logoed" width={ED} height={ED} aria-label="ปรับโลโก้ในวง: ลากเพื่อเลื่อน บีบนิ้วเพื่อซูม"
                    style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
                    onPointerDown={edDown} onPointerMove={edMove} onPointerUp={edUp} onPointerCancel={edUp} onLostPointerCapture={edUp} />
                </div>
                <div className="sv-row">
                  <button type="button" className="btn btn--ghost" id="sv-logo-fill" onClick={fillCircle}>⭕ ขยายเต็มวง</button>
                  <button type="button" className="btn btn--ghost" id="sv-logo-fit" onClick={() => upd({ logoZoom: 1, logoOX: 0, logoOY: 0 })}>▢ พอดีรูป (ตั้งต้น)</button>
                </div>
                <Slider label="ซูมรูปในวง" value={style.logoZoom} min={0.5} max={4} step={0.05} unit="×" onChange={(v) => upd({ logoZoom: v })} />
                <Slider label="เลื่อนซ้าย–ขวา" value={style.logoOX} min={-1.5} max={1.5} step={0.02} onChange={(v) => upd({ logoOX: v })} />
                <Slider label="เลื่อนขึ้น–ลง" value={style.logoOY} min={-1.5} max={1.5} step={0.02} onChange={(v) => upd({ logoOY: v })} />
                <Chips label="รูปทรงกรอบโลโก้" items={LOGO_SHAPES} value={style.logoShape} onPick={(v) => upd({ logoShape: v })} />
                <Chips label="สีพื้นหลังโลโก้" items={LOGO_BGS} value={LOGO_BGS.some((b2) => b2.id === style.logoBg) ? style.logoBg : '#ffffff'} onPick={(v) => upd({ logoBg: v })} />

                <p className="sv-h">📍 ตำแหน่งบนการ์ด (ลากบนภาพเพื่อเลื่อนเองได้)</p>
                <div className="sv-chips" role="group" aria-label="ตำแหน่งโลโก้">
                  {CORNERS.map((c) => <button key={c.id} type="button" className="sv-chip" aria-label={`วางโลโก้ ${c.label}`} onClick={() => upd({ logoX: c.x, logoY: c.y })}>{c.label}</button>)}
                </div>
                <Slider label="ขนาดโลโก้บนการ์ด" value={style.logoScale} min={0.3} max={4} step={0.05} unit="×" onChange={(v) => upd({ logoScale: v })} />

                <p className="sv-h">ปรับสี/ความคมชัดของโลโก้</p>
                <Slider label="ความสว่าง" value={style.logoBrightness} min={-60} max={60} onChange={(v) => upd({ logoBrightness: v })} />
                <Slider label="สี (เพิ่ม/ลด)" value={style.logoSaturation} min={-100} max={100} onChange={(v) => upd({ logoSaturation: v })} />
                <Slider label="ความคมชัด" value={style.logoSharpness} min={0} max={100} onChange={(v) => upd({ logoSharpness: v })} />
                <label className="sv-foot">ข้อความท้ายภาพ
                  <input value={style.footer} maxLength={40} onChange={(e) => upd({ footer: e.target.value })} />
                </label>

                <p className="sv-h">💾 บันทึกเป็นต้นแบบ (เก็บรูป การปรับพอดีวง ตำแหน่ง ขนาด ข้อความท้ายภาพ)</p>
                <label className="sv-foot">ชื่อต้นแบบ
                  <input id="sv-logo-name" value={logoName} maxLength={30} placeholder="เช่น โลโก้คริสตจักร มุมซ้ายบน" onChange={(e) => setLogoName(e.target.value)} />
                </label>
                <div className="sv-row">
                  <button type="button" className="btn btn--gold" id="sv-logo-save-new" onClick={() => void savePreset(true)}>💾 บันทึกเป็นต้นแบบใหม่</button>
                  {logoId && logoId !== STD_ID && presets.some((x) => x.id === logoId) && <button type="button" className="btn btn--ghost" id="sv-logo-save-upd" onClick={() => void savePreset(false)}>💾 อัปเดตต้นแบบนี้</button>}
                </div>
                <div className="sv-row"><button type="button" className="btn btn--ghost" onClick={() => { resetKeys(LOGO_KEYS); setLogo(undefined); setLogoId(STD_ID) }}>↺ รีเซ็ตโลโก้เป็นค่าเริ่มต้น</button></div>
                <p className="source-note">ต้นแบบโลโก้เก็บในเครื่องนี้ · ภาพสร้างในเครื่อง ไม่ส่งข้อมูลไปที่ไหน</p>
              </div>
            )}

            <div className="sv-actions">
              <button type="button" className="btn btn--ghost sv-nav" aria-label="ย้อนกลับ" onClick={() => { goBack() }}>◀</button>
              <button type="button" className="btn btn--gold" disabled={busy} onClick={shareImage}>📤 แชร์ภาพ</button>
              <button type="button" className="btn btn--ghost" disabled={busy} onClick={download}>💾 บันทึก</button>
              <button type="button" className="btn btn--ghost sv-nav" aria-label="ถัดไป" disabled={sub === 'logo'} onClick={goNext}>▶</button>
            </div>
          </div>
        )}
        {msg && <p className="nb-sync nb-sync--ok" role="status">{msg}</p>}
      </div>
    </div>
  )
}
