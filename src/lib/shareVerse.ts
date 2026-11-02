/**
 * แชร์ข้อพระคัมภีร์: (1) เป็นข้อความ (ไลน์/แอปอื่น) (2) เป็นภาพการ์ดมีพื้นหลัง แสง และโลโก้ (ตั้งค่าเองได้)
 * วาดด้วย canvas ในเครื่อง ไม่ส่งข้อมูลไปที่ไหน · ข้อความพระคัมภีร์มาจากฉบับ 1971 เท่านั้น
 */
export interface ShareLine { n?: number; t: string }

export interface ShareTheme { id: string; label: string; bg: [string, string, string]; text: string; accent: string; glow: string }
export const SHARE_THEMES: ShareTheme[] = [
  { id: 'navy', label: 'กรมท่า-ทอง', bg: ['#14213d', '#1d3557', '#0b132b'], text: '#fdf6e3', accent: '#e0b84c', glow: 'rgba(224,184,76,.35)' },
  { id: 'dawn', label: 'รุ่งอรุณ', bg: ['#ff9a6b', '#f7b267', '#fdd9a0'], text: '#3b1d0e', accent: '#8a3b12', glow: 'rgba(255,255,255,.5)' },
  { id: 'forest', label: 'ป่าเขียว', bg: ['#0f3d2e', '#1f6f50', '#0a2a20'], text: '#f1fff6', accent: '#c9e265', glow: 'rgba(201,226,101,.28)' },
  { id: 'parchment', label: 'กระดาษ', bg: ['#f6ecd3', '#efe0b8', '#fbf5e4'], text: '#2b2113', accent: '#9a6b1b', glow: 'rgba(255,255,255,.65)' },
]

export interface SharePrefs { theme: string; showLogo: boolean; logo?: string; footer: string }
const KEY = 'khatha.share.v1'
const DEFAULT_FOOTER = 'คริสตจักรศิลาเอก'
export function getSharePrefs(): SharePrefs {
  try {
    return { theme: 'navy', showLogo: true, footer: DEFAULT_FOOTER, ...(JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? {}) }
  } catch {
    return { theme: 'navy', showLogo: true, footer: DEFAULT_FOOTER }
  }
}
export function setSharePrefs(p: Partial<SharePrefs>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...getSharePrefs(), ...p }))
  } catch {
    /* ignore */
  }
}

/** ไฟล์รูปโลโก้ → ย่อเหลือไม่เกิน 256px เก็บเป็น data URL (เก็บในเครื่องนี้) */
export function fileToLogo(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, 256 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(img.width * k))
      c.height = Math.max(1, Math.round(img.height * k))
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      res(c.toDataURL('image/png'))
    }
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('เปิดรูปไม่ได้')) }
    img.src = url
  })
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
const sup = (n: number) => String(n).replace(/\d/g, (d) => SUP[+d])
export const verseBody = (lines: ShareLine[], numbers = true) => lines.map((l) => (numbers && lines.length > 1 && l.n ? `${l.n} ` : '') + l.t).join(' ').replace(/\s+/g, ' ').trim()

/** ข้อความสำหรับส่งไลน์/แอปอื่น */
export function shareText(ref: string, lines: ShareLine[], footer = getSharePrefs().footer): string {
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

const loadImg = (src: string) => new Promise<HTMLImageElement | null>((res) => {
  const i = new Image()
  i.onload = () => res(i)
  i.onerror = () => res(null)
  i.src = src
})

/** วาดการ์ดข้อพระคัมภีร์เป็นภาพ JPEG 1080×1350 */
export async function renderVerseImage(o: { ref: string; lines: ShareLine[]; prefs?: SharePrefs }): Promise<Blob> {
  const prefs = o.prefs ?? getSharePrefs()
  const th = SHARE_THEMES.find((x) => x.id === prefs.theme) ?? SHARE_THEMES[0]
  const W = 1080, H = 1350
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')!
  try { await document.fonts?.ready } catch { /* ignore */ }
  const family = getComputedStyle(document.body).fontFamily || 'sans-serif'
  // พื้นหลังไล่สี + แสงนุ่มด้านบน + ลำแสง
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, th.bg[0]); g.addColorStop(0.55, th.bg[1]); g.addColorStop(1, th.bg[2])
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W / 2, 170, 20, W / 2, 170, 760)
  glow.addColorStop(0, th.glow); glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)
  ctx.save(); ctx.globalAlpha = 0.07; ctx.fillStyle = th.text
  for (const dx of [-340, -170, 0, 170, 340]) { ctx.beginPath(); ctx.moveTo(W / 2, 140); ctx.lineTo(W / 2 + dx - 70, H); ctx.lineTo(W / 2 + dx + 70, H); ctx.closePath(); ctx.fill() }
  ctx.restore()
  // กรอบบาง
  ctx.strokeStyle = th.accent; ctx.globalAlpha = 0.55; ctx.lineWidth = 3
  ctx.strokeRect(40, 40, W - 80, H - 80); ctx.strokeRect(54, 54, W - 108, H - 108); ctx.globalAlpha = 1
  // เครื่องหมายคำพูด
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = th.accent; ctx.globalAlpha = 0.6; ctx.font = `700 190px Georgia, serif`; ctx.fillText('“', W / 2, 270); ctx.globalAlpha = 1
  // เนื้อหา: ย่อขนาดตัวอักษรให้พอดีพื้นที่
  const body = o.lines.map((l) => (o.lines.length > 1 && l.n ? sup(l.n) : '') + l.t).join(' ').replace(/\s+/g, ' ').trim()
  const maxW = 860, top = 330, maxH = 640
  let size = 56, rows: string[] = []
  for (; size >= 28; size -= 2) {
    ctx.font = `600 ${size}px ${family}`
    rows = wrap(ctx, body, maxW)
    if (rows.length * size * 1.55 <= maxH) break
  }
  const lh = size * 1.55
  const maxRows = Math.floor(maxH / lh)
  if (rows.length > maxRows) { rows = rows.slice(0, maxRows); rows[rows.length - 1] = rows[rows.length - 1].replace(/\s*\S{0,3}$/, '') + '…' }
  const blockH = rows.length * lh
  let y = top + Math.max(0, (maxH - blockH) / 2) + size
  ctx.fillStyle = th.text
  ctx.font = `600 ${size}px ${family}`
  ctx.shadowColor = 'rgba(0,0,0,.18)'; ctx.shadowBlur = 6
  for (const r of rows) { ctx.fillText(r, W / 2, y); y += lh }
  ctx.shadowBlur = 0
  // อ้างอิง
  ctx.fillStyle = th.accent
  ctx.font = `700 54px ${family}`
  ctx.fillText(o.ref, W / 2, 1015)
  ctx.globalAlpha = 0.85; ctx.font = `400 30px ${family}`; ctx.fillStyle = th.text
  ctx.fillText('พระคัมภีร์ไทย ฉบับ 1971', W / 2, 1063)
  ctx.globalAlpha = 1
  ctx.fillStyle = th.accent; ctx.fillRect(W / 2 - 70, 1090, 140, 3)
  // โลโก้ + ข้อความท้ายภาพ
  let by = 1215
  if (prefs.showLogo) {
    const img = await loadImg(prefs.logo || './icon-192.png')
    if (img) {
      const s = 100, k = Math.min(s / img.width, s / img.height)
      const w = img.width * k, h = img.height * k
      ctx.save(); ctx.beginPath(); ctx.arc(W / 2, 1160, s / 2 + 6, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill(); ctx.clip()
      ctx.drawImage(img, W / 2 - w / 2, 1160 - h / 2, w, h); ctx.restore()
      by = 1280
    }
  }
  if (prefs.footer) { ctx.fillStyle = th.text; ctx.globalAlpha = 0.9; ctx.font = `600 34px ${family}`; ctx.fillText(prefs.footer, W / 2, by === 1280 ? 1268 : 1190); ctx.globalAlpha = 1 }
  return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('สร้างภาพไม่ได้'))), 'image/jpeg', 0.92))
}
