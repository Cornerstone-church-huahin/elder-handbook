/**
 * แชร์ข้อพระคัมภีร์: (1) เป็นข้อความ (ไลน์/แอปอื่น) (2) เป็นภาพการ์ดที่ตกแต่งได้แบบแอปออกแบบ
 * (ภาพจากเครื่อง · ฟิลเตอร์/ปรับภาพ · ลวดลาย · กรอบ · สีและรหัสสี · โลโก้) วาดด้วย canvas ในเครื่อง ไม่ส่งข้อมูลไปที่ไหน
 * ข้อความพระคัมภีร์มาจากฉบับ 1971 เท่านั้น
 */
export interface ShareLine { n?: number; t: string }

export type Pattern = 'none' | 'rays' | 'dots' | 'grid' | 'crosses' | 'waves' | 'sparkles'
export type Frame = 'none' | 'thin' | 'double' | 'rounded' | 'corners' | 'polaroid'
export type Filter = 'none' | 'warm' | 'cool' | 'mono' | 'vivid' | 'vintage' | 'dream'
export type OverlayMode = 'solid' | 'bottom' | 'vignette'
export type Tone = 'none' | 'morning' | 'golden' | 'evening' | 'night' | 'cool'

export interface ShareStyle {
  preset: string
  bg1: string; bg2: string; bg3: string // สีพื้นหลังไล่สี (เมื่อไม่ใช้ภาพ)
  text: string; accent: string
  pattern: Pattern
  frame: Frame; frameColor: string
  photoZoom: number; photoX: number; photoY: number // ตำแหน่งภาพ (ซูม 1–3 · เลื่อน -1..1)
  filter: Filter; brightness: number; contrast: number; saturation: number; blur: number // ปรับภาพ (-50..50 · -100..100 · 0..12)
  tone: Tone; toneStrength: number // โทนสีตามช่วงเวลา (เช้า/เย็น ฯลฯ) ความแรง 0–1
  overlay: string; overlayOpacity: number; overlayMode: OverlayMode // ฟิล์มสีทับภาพให้อ่านง่าย
  align: 'center' | 'left'
  font: 'sans' | 'serif'
  fontScale: number
  box: 'none' | 'glass' | 'solid'
  quote: boolean
  showLogo: boolean
  footer: string
}

const BASE: ShareStyle = {
  preset: 'navy', bg1: '#14213d', bg2: '#1d3557', bg3: '#0b132b', text: '#fdf6e3', accent: '#e0b84c', pattern: 'rays', frame: 'double', frameColor: '#e0b84c',
  photoZoom: 1, photoX: 0, photoY: 0, filter: 'none', brightness: 0, contrast: 0, saturation: 0, blur: 0, tone: 'none', toneStrength: 0.6,
  overlay: '#000000', overlayOpacity: 0.45, overlayMode: 'bottom', align: 'center', font: 'sans', fontScale: 1, box: 'none', quote: true, showLogo: true, footer: 'คริสตจักรศิลาเอก',
}

/** สไตล์สำเร็จรูป: แตะครั้งเดียวได้ทั้งชุด (สี ลวดลาย กรอบ ฟิลเตอร์) แล้วปรับต่อเองได้ */
export const STYLE_PRESETS: { id: string; label: string; patch: Partial<ShareStyle> }[] = [
  { id: 'navy', label: 'กรมท่า-ทอง', patch: { bg1: '#14213d', bg2: '#1d3557', bg3: '#0b132b', text: '#fdf6e3', accent: '#e0b84c', frameColor: '#e0b84c', pattern: 'rays', frame: 'double', box: 'none', font: 'sans', align: 'center', filter: 'none' } },
  { id: 'dawn', label: 'รุ่งอรุณ', patch: { bg1: '#ff9a6b', bg2: '#f7b267', bg3: '#fdd9a0', text: '#3b1d0e', accent: '#8a3b12', frameColor: '#8a3b12', pattern: 'rays', frame: 'double', box: 'none', font: 'sans', align: 'center' } },
  { id: 'forest', label: 'ป่าเขียว', patch: { bg1: '#0f3d2e', bg2: '#1f6f50', bg3: '#0a2a20', text: '#f1fff6', accent: '#c9e265', frameColor: '#c9e265', pattern: 'sparkles', frame: 'rounded', box: 'none', font: 'sans', align: 'center' } },
  { id: 'parchment', label: 'กระดาษเก่า', patch: { bg1: '#f6ecd3', bg2: '#efe0b8', bg3: '#fbf5e4', text: '#2b2113', accent: '#9a6b1b', frameColor: '#9a6b1b', pattern: 'crosses', frame: 'corners', box: 'none', font: 'serif', align: 'center' } },
  { id: 'midnight', label: 'โมเดิร์นดำ', patch: { bg1: '#0a0a0f', bg2: '#16161f', bg3: '#050507', text: '#ffffff', accent: '#ff6b6b', frameColor: '#ff6b6b', pattern: 'grid', frame: 'thin', box: 'none', font: 'sans', align: 'left' } },
  { id: 'minimal', label: 'มินิมอลขาว', patch: { bg1: '#ffffff', bg2: '#f7f7f5', bg3: '#ececE8', text: '#1f2937', accent: '#0f766e', frameColor: '#0f766e', pattern: 'none', frame: 'polaroid', box: 'none', font: 'serif', align: 'center' } },
  { id: 'sunset', label: 'ซันเซ็ต', patch: { bg1: '#3a1c71', bg2: '#d76d77', bg3: '#ffaf7b', text: '#fffaf0', accent: '#ffe29f', frameColor: '#ffe29f', pattern: 'waves', frame: 'rounded', box: 'glass', font: 'sans', align: 'center' } },
  { id: 'sea', label: 'ทะเลสงบ', patch: { bg1: '#0f4c75', bg2: '#3282b8', bg3: '#bbe1fa', text: '#ffffff', accent: '#fdf2c2', frameColor: '#fdf2c2', pattern: 'waves', frame: 'thin', box: 'glass', font: 'sans', align: 'center' } },
]

export const FILTERS: { id: Filter; label: string; css: string }[] = [
  { id: 'none', label: 'ปกติ', css: '' },
  { id: 'warm', label: 'อบอุ่น', css: 'sepia(.3) saturate(1.25) hue-rotate(-8deg)' },
  { id: 'cool', label: 'เย็นสบาย', css: 'saturate(1.1) hue-rotate(14deg) brightness(1.03)' },
  { id: 'mono', label: 'ขาวดำ', css: 'grayscale(1) contrast(1.05)' },
  { id: 'vivid', label: 'สดใส', css: 'saturate(1.6) contrast(1.1)' },
  { id: 'vintage', label: 'วินเทจ', css: 'sepia(.55) contrast(.95) brightness(1.05)' },
  { id: 'dream', label: 'ฝันหวาน', css: 'brightness(1.08) saturate(1.2) blur(1.5px)' },
]
export const TONES: { id: Tone; label: string }[] = [
  { id: 'none', label: 'ธรรมชาติ' }, { id: 'morning', label: '🌅 ยามเช้า' }, { id: 'golden', label: '✨ ชั่วโมงทอง' },
  { id: 'evening', label: '🌇 ยามเย็น' }, { id: 'night', label: '🌙 กลางคืน' }, { id: 'cool', label: '❄️ เย็นสบาย' },
]
export const PATTERNS: { id: Pattern; label: string }[] = [
  { id: 'none', label: 'ไม่มี' }, { id: 'rays', label: 'ลำแสง' }, { id: 'dots', label: 'จุด' }, { id: 'grid', label: 'ตาราง' },
  { id: 'crosses', label: 'กางเขน' }, { id: 'waves', label: 'คลื่น' }, { id: 'sparkles', label: 'ประกาย' },
]
export const FRAMES: { id: Frame; label: string }[] = [
  { id: 'none', label: 'ไม่มี' }, { id: 'thin', label: 'เส้นบาง' }, { id: 'double', label: 'เส้นคู่' }, { id: 'rounded', label: 'มุมมน' },
  { id: 'corners', label: 'มุมประดับ' }, { id: 'polaroid', label: 'โพลารอยด์' },
]

export interface SharePrefs { style: ShareStyle; logo?: string }
const KEY = 'khatha.share.v2'
export function getSharePrefs(): SharePrefs {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { style?: Partial<ShareStyle>; logo?: string } | null
    return { style: { ...BASE, ...(v?.style ?? {}) }, logo: v?.logo }
  } catch {
    return { style: { ...BASE } }
  }
}
export function setSharePrefs(p: SharePrefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

const imgFromFile = (file: File, max: number): Promise<string> => new Promise((res, rej) => {
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => {
    const k = Math.min(1, max / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(img.width * k))
    c.height = Math.max(1, Math.round(img.height * k))
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    URL.revokeObjectURL(url)
    res(c.toDataURL(max > 400 ? 'image/jpeg' : 'image/png', 0.9))
  }
  img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('เปิดรูปไม่ได้')) }
  img.src = url
})
/** รูปโลโก้ → ย่อไม่เกิน 256px เก็บในเครื่อง */
export const fileToLogo = (f: File) => imgFromFile(f, 256)
/** รูปพื้นหลังจากเครื่อง → ย่อไม่เกิน 1600px (ไม่เก็บถาวร ใช้ระหว่างตกแต่ง) */
export const fileToPhoto = (f: File) => imgFromFile(f, 1600)

// ---------- สี ----------
export function hexToHsl(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return [0, 0, 50]
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2
  const d = max - min
  let h = 0, s = 0
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1))
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
    h = Math.round(h * 60 + 360) % 360
  }
  return [h, Math.round(s * 100), Math.round(l * 100)]
}
export function hslToHex(h: number, s: number, l: number): string {
  const S = s / 100, L = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = S * Math.min(L, 1 - L)
  const f = (n: number) => Math.round(255 * (L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))))
  return '#' + [f(0), f(8), f(4)].map((x) => x.toString(16).padStart(2, '0')).join('')
}
export const isHex = (s: string) => /^#[0-9a-f]{6}$/i.test(s.trim())
const lum = (hex: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return 0.5
  const n = parseInt(m[1], 16)
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
}
const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.replace('#', ''), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

// ---------- ข้อความ ----------
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
const sup = (n: number) => String(n).replace(/\d/g, (d) => SUP[+d])
export const verseBody = (lines: ShareLine[], numbers = true) => lines.map((l) => (numbers && lines.length > 1 && l.n ? `${l.n} ` : '') + l.t).join(' ').replace(/\s+/g, ' ').trim()

/** ข้อความสำหรับส่งไลน์/แอปอื่น */
export function shareText(ref: string, lines: ShareLine[], footer = getSharePrefs().style.footer): string {
  return `“${verseBody(lines)}”\n— ${ref} (พระคัมภีร์ไทย ฉบับ 1971)${footer ? `\n${footer}` : ''}`
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  let words: string[]
  try {
    const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter
    words = Seg ? [...new Seg('th', { granularity: 'word' }).segment(text)].map((x) => x.segment) : [...text]
  } catch {
    words = [...text]
  }
  const out: string[] = []
  let cur = ''
  for (const w of words) {
    const t = cur + w
    if (ctx.measureText(t).width > maxW && cur.trim()) {
      out.push(cur.trim())
      cur = w.trimStart()
    } else cur = t
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

/** สี่เหลี่ยมมุมมน (เครื่องเก่าที่ไม่มี roundRect ใช้ arcTo แทน) */
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') return ctx.roundRect(x, y, w, h, r)
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}

const cache = new Map<string, Promise<HTMLImageElement | null>>()
const loadImg = (src: string) => {
  if (!cache.has(src)) {
    cache.set(src, new Promise((res) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => res(null)
      i.src = src
    }))
    if (cache.size > 8) cache.delete(cache.keys().next().value as string)
  }
  return cache.get(src)!
}

// ลวดลายแบบสุ่มคงที่ (ภาพไม่กระโดดเมื่อปรับค่าอื่น)
const rng = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647

function drawPattern(ctx: CanvasRenderingContext2D, W: number, H: number, kind: Pattern, color: string) {
  if (kind === 'none') return
  ctx.save()
  ctx.fillStyle = color; ctx.strokeStyle = color
  if (kind === 'rays') {
    ctx.globalAlpha = 0.08
    for (const dx of [-340, -170, 0, 170, 340]) { ctx.beginPath(); ctx.moveTo(W / 2, 140); ctx.lineTo(W / 2 + dx - 70, H); ctx.lineTo(W / 2 + dx + 70, H); ctx.closePath(); ctx.fill() }
  } else if (kind === 'dots') {
    ctx.globalAlpha = 0.12
    for (let y = 60; y < H; y += 54) for (let x = 60 + ((y / 54) % 2 ? 27 : 0); x < W; x += 54) { ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill() }
  } else if (kind === 'grid') {
    ctx.globalAlpha = 0.09; ctx.lineWidth = 2
    for (let x = 0; x <= W; x += 90) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
    for (let y = 0; y <= H; y += 90) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
  } else if (kind === 'crosses') {
    ctx.globalAlpha = 0.1
    for (let y = 90; y < H; y += 150) for (let x = 90 + ((y / 150) % 2 ? 75 : 0); x < W; x += 150) { ctx.fillRect(x - 3, y - 20, 6, 40); ctx.fillRect(x - 14, y - 9, 28, 6) }
  } else if (kind === 'waves') {
    ctx.globalAlpha = 0.13; ctx.lineWidth = 4
    for (let y = 120; y < H + 80; y += 70) { ctx.beginPath(); for (let x = 0; x <= W; x += 12) ctx.lineTo(x, y + Math.sin(x / 90 + y / 40) * 18); ctx.stroke() }
  } else if (kind === 'sparkles') {
    const r = rng(42)
    ctx.globalAlpha = 0.5
    for (let i = 0; i < 46; i++) { const x = r() * W, y = r() * H, s = 4 + r() * 12; ctx.globalAlpha = 0.15 + r() * 0.5; ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s / 3, y - s / 3); ctx.lineTo(x + s, y); ctx.lineTo(x + s / 3, y + s / 3); ctx.lineTo(x, y + s); ctx.lineTo(x - s / 3, y + s / 3); ctx.lineTo(x - s, y); ctx.lineTo(x - s / 3, y - s / 3); ctx.closePath(); ctx.fill() }
  }
  ctx.restore()
}

function drawFrame(ctx: CanvasRenderingContext2D, W: number, H: number, kind: Frame, color: string) {
  if (kind === 'none') return
  ctx.save()
  ctx.strokeStyle = color; ctx.fillStyle = color
  if (kind === 'thin') { ctx.lineWidth = 3; ctx.globalAlpha = 0.8; ctx.strokeRect(44, 44, W - 88, H - 88) }
  else if (kind === 'double') { ctx.lineWidth = 3; ctx.globalAlpha = 0.6; ctx.strokeRect(40, 40, W - 80, H - 80); ctx.strokeRect(54, 54, W - 108, H - 108) }
  else if (kind === 'rounded') { ctx.lineWidth = 7; ctx.globalAlpha = 0.75; rrect(ctx, 46, 46, W - 92, H - 92, 56); ctx.stroke() }
  else if (kind === 'corners') {
    ctx.lineWidth = 6; ctx.globalAlpha = 0.85
    const L = 150, m = 56
    for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]] as const) {
      ctx.beginPath(); ctx.moveTo(x, y + sy * L); ctx.lineTo(x, y); ctx.lineTo(x + sx * L, y); ctx.stroke()
      ctx.beginPath(); ctx.arc(x + sx * 28, y + sy * 28, 9, 0, 7); ctx.fill()
    }
  } else if (kind === 'polaroid') {
    ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 1
    const t = 46
    ctx.fillRect(0, 0, W, t); ctx.fillRect(0, H - t, W, t); ctx.fillRect(0, 0, t, H); ctx.fillRect(W - t, 0, t, H)
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 2; ctx.strokeRect(t, t, W - 2 * t, H - 2 * t)
  }
  ctx.restore()
}

/** วาดการ์ดข้อพระคัมภีร์เป็นภาพ JPEG (ขนาดเต็ม 1080×1350 · scale ใช้ทำภาพตัวอย่างเล็ก) */
export async function renderVerseImage(o: { ref: string; lines: ShareLine[]; style?: ShareStyle; logo?: string; photo?: string; scale?: number }): Promise<Blob> {
  const st = o.style ?? getSharePrefs().style
  const K = o.scale ?? 1
  const W = 1080, H = 1350
  const c = document.createElement('canvas')
  c.width = Math.round(W * K); c.height = Math.round(H * K)
  const ctx = c.getContext('2d')!
  ctx.scale(K, K)
  try { await document.fonts?.ready } catch { /* ignore */ }
  const body = getComputedStyle(document.body).fontFamily || 'sans-serif'
  const family = st.font === 'serif' ? `"Noto Serif Thai","Sarabun","Tahoma",Georgia,serif` : body

  const photo = o.photo ? await loadImg(o.photo) : null
  if (photo) {
    // ภาพจากเครื่อง: เต็มการ์ด ซูม/เลื่อนได้ + ปรับภาพ/ฟิลเตอร์
    const k = Math.max(W / photo.width, H / photo.height) * st.photoZoom
    const w = photo.width * k, h = photo.height * k
    const dx = (W - w) / 2 + st.photoX * Math.max(0, (w - W) / 2), dy = (H - h) / 2 + st.photoY * Math.max(0, (h - H) / 2)
    const f = FILTERS.find((x) => x.id === st.filter)?.css ?? ''
    const adj = `${f} brightness(${1 + st.brightness / 100}) contrast(${1 + st.contrast / 100}) saturate(${1 + st.saturation / 100})${st.blur ? ` blur(${st.blur}px)` : ''}`.trim()
    if ('filter' in ctx) ctx.filter = adj
    ctx.drawImage(photo, dx, dy, w, h)
    if ('filter' in ctx) ctx.filter = 'none'
    // โทนสีตามช่วงเวลา: ไล่แสงสีทับภาพแบบ soft-light/multiply/screen (ไม่ต้องใช้ AI)
    if (st.tone !== 'none' && st.toneStrength > 0) {
      const a = st.toneStrength
      const blend = (op: GlobalCompositeOperation, from: string, to: string, alpha: number, dir: 'v' | 'd' = 'v') => {
        ctx.save(); ctx.globalCompositeOperation = op; ctx.globalAlpha = alpha
        const g = dir === 'v' ? ctx.createLinearGradient(0, 0, 0, H) : ctx.createLinearGradient(0, 0, W, H)
        g.addColorStop(0, from); g.addColorStop(1, to); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore()
      }
      if (st.tone === 'morning') { blend('soft-light', '#ffe7b8', '#ffb98a', a); blend('screen', '#fff1d0', '#00000000', a * 0.35) }
      else if (st.tone === 'golden') { blend('soft-light', '#ffc766', '#ff9a3c', a * 1.1); blend('screen', '#ffd28a', '#00000000', a * 0.25) }
      else if (st.tone === 'evening') { blend('soft-light', '#ff7a3d', '#7a3b8f', a * 1.15); blend('multiply', '#ffc9a0', '#7d5a9e', a * 0.3) }
      else if (st.tone === 'night') { blend('multiply', '#2c3e8f', '#0d1440', a * 0.55); blend('soft-light', '#4a6cff', '#1a1f5a', a * 0.7) }
      else if (st.tone === 'cool') { blend('soft-light', '#7fc0ff', '#4a78d8', a) }
    }
    // ฟิล์มสีทับ เพื่อให้ตัวอักษรอ่านชัด
    if (st.overlayOpacity > 0) {
      if (st.overlayMode === 'solid') { ctx.fillStyle = rgba(st.overlay, st.overlayOpacity); ctx.fillRect(0, 0, W, H) }
      else if (st.overlayMode === 'bottom') { const g = ctx.createLinearGradient(0, H * 0.15, 0, H); g.addColorStop(0, rgba(st.overlay, 0)); g.addColorStop(1, rgba(st.overlay, Math.min(1, st.overlayOpacity * 1.7))); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H) }
      else { const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.75); g.addColorStop(0, rgba(st.overlay, st.overlayOpacity * 0.3)); g.addColorStop(1, rgba(st.overlay, Math.min(1, st.overlayOpacity * 1.6))); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H) }
    }
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, st.bg1); g.addColorStop(0.55, st.bg2); g.addColorStop(1, st.bg3)
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    const glow = ctx.createRadialGradient(W / 2, 170, 20, W / 2, 170, 760)
    glow.addColorStop(0, rgba(lum(st.bg2) > 0.55 ? '#ffffff' : st.accent, lum(st.bg2) > 0.55 ? 0.5 : 0.3)); glow.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)
  }
  drawPattern(ctx, W, H, st.pattern, st.text)

  // ---------- ข้อความ ----------
  const left = st.align === 'left'
  const padX = 120
  const maxW = left ? W - padX * 2 : 860
  const cx = left ? padX : W / 2
  ctx.textAlign = left ? 'left' : 'center'; ctx.textBaseline = 'alphabetic'
  if (st.quote) { ctx.fillStyle = st.accent; ctx.globalAlpha = 0.65; ctx.font = '700 190px Georgia, serif'; ctx.fillText('“', cx - (left ? 8 : 0), 270); ctx.globalAlpha = 1 }
  const text = o.lines.map((l) => (o.lines.length > 1 && l.n ? sup(l.n) : '') + l.t).join(' ').replace(/\s+/g, ' ').trim()
  const top = 330, maxH = 640
  const weight = st.font === 'serif' ? 600 : 600
  let size = Math.round(56 * st.fontScale), rows: string[] = []
  for (; size >= 26; size -= 2) {
    ctx.font = `${weight} ${size}px ${family}`
    rows = wrap(ctx, text, maxW)
    if (rows.length * size * 1.55 <= maxH) break
  }
  const lh = size * 1.55
  const maxRows = Math.floor(maxH / lh)
  if (rows.length > maxRows) { rows = rows.slice(0, maxRows); rows[rows.length - 1] = rows[rows.length - 1].replace(/\s*\S{0,3}$/, '') + '…' }
  const blockH = rows.length * lh
  const y0 = top + Math.max(0, (maxH - blockH) / 2)
  if (st.box !== 'none') {
    const dark = lum(st.text) > 0.5
    ctx.save()
    ctx.fillStyle = st.box === 'glass' ? (dark ? 'rgba(0,0,0,.38)' : 'rgba(255,255,255,.5)') : dark ? 'rgba(0,0,0,.72)' : 'rgba(255,255,255,.9)'
    rrect(ctx, 70, y0 - 40, W - 140, blockH + 80, 36); ctx.fill(); ctx.restore()
  }
  ctx.fillStyle = st.text; ctx.font = `${weight} ${size}px ${family}`
  ctx.shadowColor = photo ? 'rgba(0,0,0,.45)' : 'rgba(0,0,0,.18)'; ctx.shadowBlur = photo ? 12 : 6
  let y = y0 + size
  for (const r of rows) { ctx.fillText(r, cx, y); y += lh }
  ctx.shadowBlur = 0
  ctx.fillStyle = st.accent; ctx.font = `700 54px ${family}`
  ctx.fillText(o.ref, cx, 1015)
  ctx.globalAlpha = 0.9; ctx.font = `400 30px ${family}`; ctx.fillStyle = st.text
  ctx.fillText('พระคัมภีร์ไทย ฉบับ 1971', cx, 1063)
  ctx.globalAlpha = 1
  ctx.fillStyle = st.accent; ctx.fillRect(left ? cx : W / 2 - 70, 1090, 140, 3)
  // โลโก้ + ข้อความท้ายภาพ
  let withLogo = false
  if (st.showLogo) {
    const img = await loadImg(o.logo || './icon-192.png')
    if (img) {
      const s = 100, k = Math.min(s / img.width, s / img.height)
      const w = img.width * k, h = img.height * k
      const lx = left ? cx + s / 2 : W / 2
      ctx.save(); ctx.beginPath(); ctx.arc(lx, 1160, s / 2 + 6, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill(); ctx.clip()
      ctx.drawImage(img, lx - w / 2, 1160 - h / 2, w, h); ctx.restore()
      withLogo = true
    }
  }
  if (st.footer) { ctx.fillStyle = st.text; ctx.globalAlpha = 0.92; ctx.font = `600 34px ${family}`; ctx.fillText(st.footer, cx, withLogo ? 1268 : 1190); ctx.globalAlpha = 1 }
  drawFrame(ctx, W, H, st.frame, st.frameColor)
  return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('สร้างภาพไม่ได้'))), 'image/jpeg', K < 1 ? 0.8 : 0.92))
}

/**
 * ปรับอัตโนมัติ (ในเครื่อง ไม่ใช้ AI): วิเคราะห์ความสว่าง/ช่วงแสงของรูป แล้วตั้งค่าสว่าง คอนทราสต์ ความสดสีที่เหมาะ
 * ไม่ตัดสิ่งของออกหรือแต่งเติมภาพ (ทำไม่ได้ด้วยการคำนวณธรรมดา — ใช้ "AI แต่งรูป" แทน)
 */
export async function autoAdjust(photo: string): Promise<Partial<ShareStyle>> {
  const img = await loadImg(photo)
  if (!img) return {}
  const N = 96
  const c = document.createElement('canvas'); c.width = N; c.height = N
  const x = c.getContext('2d')!; x.drawImage(img, 0, 0, N, N)
  const d = x.getImageData(0, 0, N, N).data
  const ys: number[] = []; let sat = 0
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255
    ys.push(0.299 * r + 0.587 * g + 0.114 * b)
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b); sat += mx ? (mx - mn) / mx : 0
  }
  ys.sort((p, q) => p - q)
  const mean = ys.reduce((p, q) => p + q, 0) / ys.length
  const lo = ys[Math.floor(ys.length * 0.05)], hi = ys[Math.floor(ys.length * 0.95)]
  const avgSat = sat / ys.length
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, Math.round(v)))
  return {
    brightness: clamp((0.5 - mean) * 70, -25, 30),
    contrast: clamp((0.75 - (hi - lo)) * 60, -10, 30),
    saturation: clamp((0.38 - avgSat) * 90, -10, 35),
  }
}
