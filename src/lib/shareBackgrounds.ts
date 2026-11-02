/**
 * พื้นหลังสำเร็จรูป: ภาพวาดสไตล์เดียวกัน (ไล่สีนุ่ม ๆ เบา ๆ เหมาะกับข้อพระคัมภีร์) สร้างด้วยโค้ดในแอปเอง
 * ไม่ใช่ภาพถ่ายจากอินเทอร์เน็ต → ไม่มีปัญหาลิขสิทธิ์ ใช้ฟรีได้ทุกที่ และใช้ออฟไลน์ได้ · ปรับฟิลเตอร์/โทน/ความคมชัดซ้อนทับได้เหมือนรูปปกติ
 */
export interface Art { id: string; scene: string; label: string; v: number }
export const SCENES: { id: string; label: string; variants: number }[] = [
  { id: 'sunrise', label: 'รุ่งอรุณ', variants: 8 }, { id: 'sunset', label: 'อาทิตย์ตก+กางเขน', variants: 8 }, { id: 'night', label: 'ดาวและพระจันทร์', variants: 8 },
  { id: 'sea', label: 'ทะเลสงบ', variants: 8 }, { id: 'field', label: 'ทุ่งข้าว', variants: 8 }, { id: 'rays', label: 'ลำแสงผ่านเมฆ', variants: 8 },
  { id: 'bokeh', label: 'แสงโบเก้', variants: 8 }, { id: 'water', label: 'สีน้ำพาสเทล', variants: 8 }, { id: 'forest', label: 'ป่าหมอก', variants: 8 },
  { id: 'purple', label: 'ภูเขาหมอก', variants: 8 }, { id: 'dunes', label: 'เนินทราย', variants: 8 }, { id: 'paper', label: 'กระดาษนุ่ม', variants: 8 },
  { id: 'mesh', label: 'ไล่สีออโรรา', variants: 12 }, { id: 'arch', label: 'โค้งเรขาคณิต', variants: 12 },
]

/** โทนสี 8 แบบ ใช้กับพื้นหลังทุกฉาก (เปลี่ยนเฉดทั้งภาพด้วยเมทริกซ์สี ไม่ต้องใช้ canvas filter จึงใช้ได้ทุกเครื่อง) */
interface Grade { label: string; hue: number; sat: number; bri: number; tint?: [number, number, number, number] }
const GRADES: Grade[] = [
  { label: 'ดั้งเดิม', hue: 0, sat: 1, bri: 1 },
  { label: 'อุ่นทอง', hue: -6, sat: 1.1, bri: 1.03, tint: [255, 190, 90, 0.14] },
  { label: 'เย็นฟ้า', hue: 8, sat: 1, bri: 1, tint: [90, 150, 255, 0.16] },
  { label: 'ชมพูพาสเทล', hue: -18, sat: 0.95, bri: 1.06, tint: [255, 150, 190, 0.16] },
  { label: 'เขียวมิ้นต์', hue: 35, sat: 0.9, bri: 1.04, tint: [120, 230, 190, 0.14] },
  { label: 'ลาเวนเดอร์', hue: -35, sat: 0.95, bri: 1.02, tint: [170, 130, 240, 0.16] },
  { label: 'ซีเปียเก่า', hue: 0, sat: 0.55, bri: 1.02, tint: [190, 130, 70, 0.28] },
  { label: 'ขาวดำนุ่ม', hue: 0, sat: 0.12, bri: 1.05, tint: [230, 225, 215, 0.1] },
]
const MESH_PALETTES: string[][] = [
  ['#ff9a9e', '#fad0c4', '#fbc2eb', '#a1c4fd'], ['#84fab0', '#8fd3f4', '#c2e9fb', '#e0c3fc'], ['#f6d365', '#fda085', '#fbc2eb', '#ffecd2'], ['#667eea', '#764ba2', '#f093fb', '#4facfe'],
  ['#43e97b', '#38f9d7', '#4facfe', '#fee140'], ['#fa709a', '#fee140', '#a18cd1', '#fbc2eb'], ['#0f2027', '#203a43', '#2c5364', '#6dd5ed'], ['#ffecd2', '#fcb69f', '#ff9a9e', '#fecfef'],
  ['#2b5876', '#4e4376', '#c471ed', '#f64f59'], ['#89f7fe', '#66a6ff', '#c3cfe2', '#f5f7fa'], ['#232526', '#414345', '#d4af37', '#f5e6c8'], ['#d299c2', '#fef9d7', '#a8edea', '#fed6e3'],
]
const ARCH_PALETTES: [string, string, string, string][] = [
  ['#f4e3d0', '#e8b4a0', '#c9806b', '#7a4b3f'], ['#e8f1ec', '#b7d3c6', '#6fa08c', '#2f5d4e'], ['#f9f1e3', '#f0c987', '#d98b3a', '#7a4a1a'], ['#eef0fb', '#b9c3f0', '#7c8be0', '#3b4a99'],
  ['#fbeaf0', '#f2b5c9', '#d9738f', '#8a2f4f'], ['#e9f4f7', '#a9d3df', '#5aa1b8', '#1f5870'], ['#f3efe6', '#d9cdb4', '#a99872', '#5e5238'], ['#2a2a40', '#47476e', '#8a8ad6', '#d6d6ff'],
  ['#fff4e0', '#ffd08a', '#f28a4b', '#a9441f'], ['#efe8f7', '#cbb6e8', '#9a7cd0', '#573d93'], ['#e8f5e9', '#c1e1c5', '#7dbb86', '#35703f'], ['#1f2a44', '#31456f', '#d4af37', '#f6e3a8'],
]
export const ARTS: Art[] = (() => {
  // เรียงแบบสลับฉาก (แบบที่ 1 ของทุกฉาก ก่อน แล้วแบบที่ 2 …) หน้าแรกจึงเห็นความหลากหลายทุกฉาก
  const out: Art[] = []
  const max = Math.max(...SCENES.map((x) => x.variants))
  for (let v = 0; v < max; v++) for (const sc of SCENES) if (v < sc.variants) out.push({ id: `${sc.id}.${v}`, scene: sc.id, v, label: `${sc.label}${sc.id === 'mesh' || sc.id === 'arch' ? ` ${v + 1}` : ` · ${GRADES[v].label}`}` })
  return out
})()

const W = 1080, H = 1350
let VAR = 0 // แบบที่ (ขยับตำแหน่งดาว/ภูเขา/แสง ให้แต่ละแบบไม่ซ้ำกัน)
const rng = (seed: number) => { seed = (seed + VAR * 977) % 2147483646 + 1; return () => (seed = (seed * 16807) % 2147483647) / 2147483647 }
type C = CanvasRenderingContext2D

function lin(c: C, y0: number, y1: number, stops: [number, string][]) {
  const g = c.createLinearGradient(0, y0, 0, y1)
  stops.forEach(([o, col]) => g.addColorStop(o, col))
  c.fillStyle = g; c.fillRect(0, 0, W, H)
}
function glow(c: C, x: number, y: number, r: number, col: string, a = 1) {
  const g = c.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,255,0)')
  c.save(); c.globalAlpha = a; c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore()
}
/** สันเขา/เนินแบบคลื่นนุ่ม */
function ridge(c: C, base: number, amp: number, freq: number, phase: number, fill: string | CanvasGradient, seed = 1) {
  const r = rng(seed); const ph2 = r() * 6
  c.beginPath(); c.moveTo(0, H)
  for (let x = 0; x <= W; x += 8) c.lineTo(x, base + Math.sin(x * freq + phase + VAR * 1.7) * amp * (1 + (VAR % 3) * 0.12) + Math.sin(x * freq * 2.3 + ph2) * amp * 0.45)
  c.lineTo(W, H); c.closePath(); c.fillStyle = fill; c.fill()
}
function cloud(c: C, x: number, y: number, s: number, a: number) {
  c.save(); c.globalAlpha = a; c.fillStyle = '#fff'
  for (const [dx, dy, r] of [[0, 0, 70], [70, -20, 90], [150, 0, 75], [60, 25, 60], [120, 25, 60]] as const) { c.beginPath(); c.arc(x + dx * s, y + dy * s, r * s, 0, 7); c.fill() }
  c.restore()
}

const PAINT: Record<string, (c: C) => void> = {
  sunrise(c) {
    lin(c, 0, H, [[0, '#35508f'], [0.35, '#8d7bb8'], [0.55, '#f4a96a'], [0.72, '#ffe0a2'], [1, '#ffd49a']])
    glow(c, W / 2, 800, 620, 'rgba(255,236,170,.95)', 0.9)
    c.fillStyle = '#fff4cf'; c.beginPath(); c.arc(W / 2, 800, 90, 0, 7); c.fill()
    ridge(c, 860, 40, 0.006, 0, '#b88fa8', 3); ridge(c, 930, 55, 0.005, 1, '#7f6d97', 5); ridge(c, 1020, 60, 0.004, 2, '#4d5b83', 7); ridge(c, 1130, 50, 0.005, 3, '#25324f', 9)
    glow(c, W / 2, 1000, 500, 'rgba(255,200,140,.35)', 0.8)
  },
  sunset(c) {
    lin(c, 0, H, [[0, '#2a1b4a'], [0.4, '#b64a73'], [0.65, '#ff9a56'], [0.85, '#ffd18a'], [1, '#ffe7b5']])
    glow(c, W * 0.62, 900, 560, 'rgba(255,214,150,.9)', 0.85)
    c.fillStyle = '#ffe9bd'; c.beginPath(); c.arc(W * 0.62, 900, 78, 0, 7); c.fill()
    ridge(c, 1000, 38, 0.005, 1, '#5b2a56', 2); ridge(c, 1090, 45, 0.004, 0.5, '#2a1431', 4)
    c.fillStyle = '#140b1c'; c.fillRect(W * 0.2 - 7, 840, 14, 200); c.fillRect(W * 0.2 - 55, 884, 110, 14) // กางเขนบนเนิน
    ridge(c, 1180, 30, 0.006, 2, '#140b1c', 6)
  },
  night(c) {
    lin(c, 0, H, [[0, '#040818'], [0.55, '#10204f'], [1, '#2a3f7a']])
    const r = rng(11); c.fillStyle = '#fff'
    for (let i = 0; i < 320; i++) { c.globalAlpha = 0.25 + r() * 0.75; c.beginPath(); c.arc(r() * W, r() * H * 0.8, 0.8 + r() * 2.2, 0, 7); c.fill() }
    c.globalAlpha = 1
    glow(c, W * 0.74, 250, 360, 'rgba(255,244,214,.55)', 0.9)
    c.fillStyle = '#fff6d8'; c.beginPath(); c.arc(W * 0.74, 250, 62, 0, 7); c.fill()
    c.fillStyle = '#10204f'; c.beginPath(); c.arc(W * 0.74 + 24, 238, 56, 0, 7); c.fill()
    ridge(c, 1090, 50, 0.005, 0, '#0b1535', 3); ridge(c, 1190, 40, 0.006, 2, '#060c20', 5)
  },
  sea(c) {
    lin(c, 0, 880, [[0, '#7fb6e8'], [0.7, '#cfe8ff'], [1, '#fff1d6']])
    glow(c, W / 2, 840, 500, 'rgba(255,240,200,.9)', 0.8)
    const g = c.createLinearGradient(0, 840, 0, H); g.addColorStop(0, '#6fa9cf'); g.addColorStop(1, '#1d4e7a'); c.fillStyle = g; c.fillRect(0, 840, W, H)
    c.fillStyle = 'rgba(255,240,200,.35)'; c.fillRect(W / 2 - 60, 840, 120, 220)
    c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 3
    for (let y = 880; y < H; y += 44) { c.beginPath(); for (let x = 0; x <= W; x += 10) c.lineTo(x, y + Math.sin(x / 70 + y / 30) * 7); c.stroke() }
  },
  field(c) {
    lin(c, 0, 760, [[0, '#8fcaf5'], [1, '#fff0c0']])
    glow(c, W * 0.5, 740, 600, 'rgba(255,238,170,.85)', 0.9)
    const g = c.createLinearGradient(0, 740, 0, H); g.addColorStop(0, '#e9c25a'); g.addColorStop(1, '#9c6d1f'); c.fillStyle = g; c.fillRect(0, 740, W, H)
    const r = rng(5); c.strokeStyle = 'rgba(120,80,15,.35)'; c.lineWidth = 2
    for (let i = 0; i < 900; i++) { const y = 760 + Math.pow(r(), 1.6) * 590, x = r() * W, l = 10 + (y - 740) * 0.12; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 8, y - l); c.stroke() }
    ridge(c, 760, 14, 0.01, 0, 'rgba(120,150,90,.55)', 8)
  },
  rays(c) {
    lin(c, 0, H, [[0, '#3b6ea8'], [0.5, '#9cc7ee'], [1, '#e9f4ff']])
    c.save(); c.globalCompositeOperation = 'screen'; c.fillStyle = 'rgba(255,255,255,.16)'
    for (const dx of [-420, -240, -90, 90, 240, 420]) { c.beginPath(); c.moveTo(W / 2, -80); c.lineTo(W / 2 + dx - 90, H); c.lineTo(W / 2 + dx + 90, H); c.closePath(); c.fill() }
    c.restore(); glow(c, W / 2, 60, 520, 'rgba(255,255,255,.9)', 0.85)
    cloud(c, 80, 420, 1.5, 0.85); cloud(c, 640, 560, 1.3, 0.8); cloud(c, 260, 900, 1.7, 0.9); cloud(c, 700, 1060, 1.4, 0.85); cloud(c, -60, 1200, 1.8, 0.9)
  },
  bokeh(c) {
    lin(c, 0, H, [[0, '#0c1633'], [1, '#2a2147']])
    const r = rng(21)
    for (let i = 0; i < 46; i++) {
      const x = r() * W, y = r() * H, rad = 30 + r() * 110
      const g = c.createRadialGradient(x, y, 0, x, y, rad); const warm = r() > 0.4
      g.addColorStop(0, warm ? 'rgba(255,214,130,.30)' : 'rgba(180,200,255,.22)'); g.addColorStop(0.75, warm ? 'rgba(255,200,110,.12)' : 'rgba(160,180,255,.08)'); g.addColorStop(1, 'rgba(255,255,255,0)')
      c.fillStyle = g; c.beginPath(); c.arc(x, y, rad, 0, 7); c.fill()
    }
  },
  water(c) {
    c.fillStyle = '#fbf3e6'; c.fillRect(0, 0, W, H)
    for (const [x, y, rr, col] of [[200, 260, 520, 'rgba(255,170,160,.5)'], [880, 420, 560, 'rgba(120,200,210,.45)'], [300, 900, 600, 'rgba(255,214,140,.5)'], [900, 1100, 520, 'rgba(180,160,230,.4)'], [540, 640, 420, 'rgba(255,255,255,.5)']] as const) {
      const g = c.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H)
    }
    const r = rng(9); c.fillStyle = 'rgba(120,90,60,.05)'; for (let i = 0; i < 1400; i++) c.fillRect(r() * W, r() * H, 2, 2)
  },
  forest(c) {
    lin(c, 0, H, [[0, '#a9c9bb'], [0.6, '#e6f1ea'], [1, '#cfe3d6']])
    const r = rng(17)
    const trees = (base: number, size: number, col: string, n: number, seed: number) => {
      const rr = rng(seed); c.fillStyle = col
      for (let i = 0; i < n; i++) { const x = rr() * W, h = size * (0.7 + rr() * 0.6); c.beginPath(); c.moveTo(x, base); c.lineTo(x - h * 0.22, base); c.lineTo(x, base - h); c.lineTo(x + h * 0.22, base); c.closePath(); c.fill() }
    }
    trees(800, 420, 'rgba(120,160,140,.45)', 16, 3); glow(c, W / 2, 900, 520, 'rgba(255,255,255,.65)', 0.9)
    trees(980, 520, 'rgba(70,115,95,.6)', 14, 5); glow(c, W / 2, 1050, 460, 'rgba(255,255,255,.5)', 0.8)
    trees(1180, 640, 'rgba(32,70,56,.85)', 10, 8); r()
    lin(c, 1000, H, [[0, 'rgba(255,255,255,0)'], [1, 'rgba(235,245,238,.55)']])
  },
  purple(c) {
    lin(c, 0, H, [[0, '#2b1055'], [0.5, '#6a5fb5'], [0.8, '#a6b6e8'], [1, '#e8d9f2']])
    const r = rng(4); c.fillStyle = '#fff'
    for (let i = 0; i < 90; i++) { c.globalAlpha = 0.2 + r() * 0.6; c.beginPath(); c.arc(r() * W, r() * 600, 0.8 + r() * 1.8, 0, 7); c.fill() }
    c.globalAlpha = 1
    ridge(c, 760, 90, 0.007, 0, '#8a7bc4', 2); ridge(c, 880, 80, 0.006, 1, '#6a5aa8', 4); ridge(c, 1000, 70, 0.005, 2, '#4a3c86', 6); ridge(c, 1130, 60, 0.006, 3, '#2d2260', 8)
    lin(c, 760, H, [[0, 'rgba(255,255,255,.18)'], [0.5, 'rgba(255,255,255,0)']])
  },
  dunes(c) {
    lin(c, 0, 700, [[0, '#ffd2a0'], [1, '#fff0d4']])
    glow(c, W * 0.3, 560, 520, 'rgba(255,240,200,.9)', 0.8)
    for (const [b, a, col, s] of [[760, 70, '#f1b878', 1], [900, 90, '#e39a58', 3], [1040, 100, '#c97b3d', 5], [1190, 90, '#9f5a28', 7]] as const) {
      const g = c.createLinearGradient(0, b - a, 0, H); g.addColorStop(0, col); g.addColorStop(1, 'rgba(120,60,20,.9)'); ridge(c, b, a, 0.004, s, g, s)
    }
  },
  paper(c) {
    lin(c, 0, H, [[0, '#f6ecd3'], [1, '#e9d9b3']])
    const r = rng(33); for (let i = 0; i < 2600; i++) { c.fillStyle = `rgba(120,90,40,${0.02 + r() * 0.05})`; c.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 3) }
    const g = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(120,80,30,.25)'); c.fillStyle = g; c.fillRect(0, 0, W, H)
  },
}

PAINT.mesh = (c: C) => {
  const pal = MESH_PALETTES[VAR % MESH_PALETTES.length]
  lin(c, 0, H, [[0, pal[0]], [1, pal[1]]])
  const r = rng(77)
  pal.forEach((col, i) => { const x = r() * W, y = (i / 4 + r() * 0.3) * H, rad = 480 + r() * 360; const g = c.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,255,0)'); c.globalAlpha = 0.85; c.fillStyle = g; c.fillRect(0, 0, W, H) })
  c.globalAlpha = 1
  const g2 = c.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.35, 700); g2.addColorStop(0, 'rgba(255,255,255,.25)'); g2.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g2; c.fillRect(0, 0, W, H)
}
PAINT.arch = (c: C) => {
  const pal = ARCH_PALETTES[VAR % ARCH_PALETTES.length]
  c.fillStyle = pal[0]; c.fillRect(0, 0, W, H)
  const arch = (cx: number, base: number, w: number, h: number, col: string) => { c.fillStyle = col; c.beginPath(); c.moveTo(cx - w / 2, base); c.lineTo(cx - w / 2, base - h + w / 2); c.arc(cx, base - h + w / 2, w / 2, Math.PI, 0); c.lineTo(cx + w / 2, base); c.closePath(); c.fill() }
  arch(W / 2, H, 900, 1100, pal[1]); arch(W / 2, H, 640, 820, pal[2]); arch(W / 2, H, 380, 560, pal[3])
  c.fillStyle = pal[3]; c.globalAlpha = 0.5; c.beginPath(); c.arc(W * (0.25 + (VAR % 4) * 0.17), 260, 70, 0, 7); c.fill(); c.globalAlpha = 1
}

function applyGrade(ctx: C, w: number, h: number, g: Grade) {
  if (g.hue === 0 && g.sat === 1 && g.bri === 1 && !g.tint) return
  const img = ctx.getImageData(0, 0, w, h), d = img.data
  const a = (g.hue * Math.PI) / 180, cs = Math.cos(a), sn = Math.sin(a)
  const m = [0.213 + cs * 0.787 - sn * 0.213, 0.715 - cs * 0.715 - sn * 0.715, 0.072 - cs * 0.072 + sn * 0.928, 0.213 - cs * 0.213 + sn * 0.143, 0.715 + cs * 0.285 + sn * 0.14, 0.072 - cs * 0.072 - sn * 0.283, 0.213 - cs * 0.213 - sn * 0.787, 0.715 - cs * 0.715 + sn * 0.715, 0.072 + cs * 0.928 + sn * 0.072]
  const t = g.tint
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], gg = d[i + 1], b = d[i + 2]
    const r2 = m[0] * r + m[1] * gg + m[2] * b, g2 = m[3] * r + m[4] * gg + m[5] * b, b2 = m[6] * r + m[7] * gg + m[8] * b
    const L = 0.299 * r2 + 0.587 * g2 + 0.114 * b2
    r = (L + (r2 - L) * g.sat) * g.bri; gg = (L + (g2 - L) * g.sat) * g.bri; b = (L + (b2 - L) * g.sat) * g.bri
    if (t) { r += (t[0] - r) * t[3]; gg += (t[1] - gg) * t[3]; b += (t[2] - b) * t[3] }
    d[i] = r; d[i + 1] = gg; d[i + 2] = b
  }
  ctx.putImageData(img, 0, 0)
}

/** วาดพื้นหลังเป็น data URL JPEG (id = "ฉาก.แบบที่" เช่น sunrise.3 · w = ความกว้าง สัดส่วน 4:5) */
export function makeArt(id: string, w = W): string {
  const [scene, vs] = id.split('.')
  const v = Math.max(0, Number(vs) || 0)
  const c = document.createElement('canvas')
  c.width = w; c.height = Math.round((w * H) / W)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.scale(w / W, w / W)
  VAR = v
  const base = SCENES.find((x) => x.id === scene)
  ;(PAINT[scene] ?? PAINT.sunrise)(ctx)
  VAR = 0
  if (base && base.id !== 'mesh' && base.id !== 'arch') { ctx.setTransform(1, 0, 0, 1, 0, 0); applyGrade(ctx, c.width, c.height, GRADES[v % GRADES.length]) }
  return c.toDataURL('image/jpeg', w >= 600 ? 0.9 : 0.8)
}
