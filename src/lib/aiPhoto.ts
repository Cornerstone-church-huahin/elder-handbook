/**
 * AI แต่งรูป (Gemini): ส่งรูป + คำสั่ง (ตัดสายไฟ/ของรกออก โทนยามเช้า/เย็น ฯลฯ) → ได้รูปที่แต่งแล้วกลับมา · สร้างซ้ำให้ต่างจากครั้งก่อนได้
 * ใช้คีย์ Gemini ที่ผู้ใช้ใส่ไว้ (เก็บในเครื่อง) · รูปจะถูกส่งไปยัง Google ทุกครั้งที่กดสร้าง (ผู้ใช้ต้องยินยอมก่อน)
 * ผลลัพธ์ขึ้นกับโมเดล ไม่การันตีว่าจะตัดสายไฟได้สะอาดทุกภาพ
 */
import { getAiSettings } from './ai'

export const AI_PHOTO_MODEL = 'gemini-2.5-flash-image'
const MODEL_KEY = 'khatha.aiPhotoModel'
export const getPhotoModel = () => { try { return localStorage.getItem(MODEL_KEY) || AI_PHOTO_MODEL } catch { return AI_PHOTO_MODEL } }
export const hasGeminiKeyForPhoto = () => !!getAiSettings().keys.gemini?.trim()

export const AI_GOALS: { id: string; label: string; prompt: string }[] = [
  { id: 'wires', label: '✂️ ตัดสายไฟ/สายระโยงระยางออก', prompt: 'Remove all overhead power lines, electrical wires, cables and poles clutter. Fill the removed areas naturally so the sky and structures look clean and untouched.' },
  { id: 'clutter', label: '🧹 ลบของรก/สิ่งรบกวน', prompt: 'Remove distracting clutter and unwanted objects (trash, signs, stray objects) while keeping the main subject unchanged.' },
  { id: 'morning', label: '🌅 โทนยามเช้า', prompt: 'Give the photo a soft, fresh early-morning look: gentle warm sunrise light, light haze, clean cool-to-warm color balance.' },
  { id: 'evening', label: '🌇 โทนยามเย็น', prompt: 'Give the photo a warm golden-hour / sunset look: glowing orange and purple sky tones, warm directional light.' },
  { id: 'sky', label: '☁️ ท้องฟ้าสวยขึ้น', prompt: 'Improve the sky: richer, more beautiful colors and soft natural clouds, keeping everything else realistic.' },
  { id: 'light', label: '💡 ปรับแสง/สีให้สวยคม', prompt: 'Professionally correct exposure, contrast, white balance and sharpness for a clean, vibrant, natural result.' },
]
const VARIANTS = [
  'Use a natural, true-to-life look.',
  'Use a slightly more cinematic color grade with soft contrast.',
  'Use a brighter, airy and clean look.',
  'Use a warmer, richer and more dramatic mood.',
  'Use a calm pastel mood with gentle light.',
  'Use a crisp, high-clarity look with vivid but realistic colors.',
]

const dataUrlParts = (u: string) => {
  const m = /^data:([^;]+);base64,(.*)$/.exec(u)
  return m ? { mime: m[1], data: m[2] } : null
}

/** ย่อรูปก่อนส่ง (ไม่เกิน 1024px) ให้เร็วและประหยัดโควต้า */
async function shrink(src: string, max = 1024): Promise<string> {
  const img = await new Promise<HTMLImageElement | null>((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src })
  if (!img) return src
  const k = Math.min(1, max / Math.max(img.width, img.height))
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.9)
}

/** คืน data URL ของรูปที่แต่งแล้ว · throw Error พร้อมข้อความภาษาไทยเมื่อไม่สำเร็จ */
export async function aiEditPhoto(o: { photo: string; goals: string[]; note?: string; variant: number; signal?: AbortSignal }): Promise<string> {
  const key = getAiSettings().keys.gemini?.trim()
  if (!key) throw new Error('ยังไม่มีคีย์ Gemini — ใส่ที่ ตั้งค่า › ผู้ช่วย AI ก่อน')
  const goals = AI_GOALS.filter((g) => o.goals.includes(g.id)).map((g) => g.prompt)
  const prompt = [
    'Edit this photograph. Keep the same scene, composition, people and main subject. Do not add text, watermarks or new objects.',
    ...goals,
    o.note?.trim() ? `Extra request from the user: ${o.note.trim()}` : '',
    o.variant > 0 ? `This is attempt #${o.variant + 1}: make the result clearly different in look and color mood from previous attempts. ${VARIANTS[o.variant % VARIANTS.length]}` : VARIANTS[0],
    'Output the edited image only.',
  ].filter(Boolean).join('\n')
  const p = dataUrlParts(await shrink(o.photo))
  if (!p) throw new Error('อ่านรูปไม่ได้')
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${getPhotoModel()}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: p.mime, data: p.data } }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], temperature: 1 } }),
    signal: o.signal,
  }).catch(() => { throw new Error('ไม่มีอินเทอร์เน็ต หรือเชื่อมต่อ Gemini ไม่ได้') })
  if (!r.ok) {
    const d = await r.json().then((j) => j?.error?.message).catch(() => '')
    throw new Error(r.status === 400 || r.status === 403 ? `Gemini ปฏิเสธคำขอ (${r.status}) — ตรวจคีย์/โมเดล${d ? `: ${String(d).slice(0, 100)}` : ''}` : r.status === 429 ? 'โควต้า Gemini เต็มชั่วคราว รอสักครู่แล้วลองใหม่' : `Gemini ผิดพลาด (${r.status})`)
  }
  const j = await r.json()
  const parts: { inlineData?: { mimeType?: string; data?: string }; text?: string }[] = j?.candidates?.[0]?.content?.parts ?? []
  const img = parts.find((x) => x.inlineData?.data)
  if (!img?.inlineData?.data) {
    const t = parts.map((x) => x.text).filter(Boolean).join(' ').slice(0, 140)
    throw new Error(`Gemini ไม่ส่งรูปกลับมา${t ? `: ${t}` : ' (อาจถูกกรองเนื้อหา) ลองใหม่หรือเปลี่ยนคำสั่ง'}`)
  }
  return `data:${img.inlineData.mimeType || 'image/png'};base64,${img.inlineData.data}`
}

const BG_THEMES = [
  'a serene sunrise over rolling green hills with soft golden light', 'a peaceful calm lake at dawn with mist and reflections', 'a field of golden wheat under a warm evening sky',
  'majestic mountains above soft clouds at sunrise', 'a quiet forest path with sunbeams through morning fog', 'gentle ocean waves at sunset with warm pastel sky',
  'a starry night sky over silhouetted hills with a soft moon glow', 'a meadow of wildflowers in soft morning light', 'a tranquil waterfall in a lush green valley',
  'soft heavenly rays of light breaking through clouds', 'a calm desert dune landscape at golden hour', 'a still river winding through autumn trees in soft light',
  'a pastel watercolor sky blending pink, peach and lavender', 'snowy mountain peaks glowing at first light', 'a lone olive tree on a hill at dusk', 'a tranquil garden path with blossoming trees in spring',
]
/** AI สร้างพื้นหลังใหม่ (ไม่ส่งรูปของผู้ใช้ ส่งแต่คำบรรยาย) · n = ลำดับ ใช้เลือกธีม/ทำให้ต่างกัน */
export async function aiGenerateBackground(n: number, signal?: AbortSignal): Promise<{ dataUrl: string; label: string }> {
  const key = getAiSettings().keys.gemini?.trim()
  if (!key) throw new Error('ยังไม่มีคีย์ Gemini — ใส่ที่ ตั้งค่า › ผู้ช่วย AI ก่อน')
  const theme = BG_THEMES[(n + Math.floor(Math.random() * BG_THEMES.length)) % BG_THEMES.length]
  const prompt = `Create a beautiful, serene, high-quality portrait (4:5) background image for a Bible verse card: ${theme}. No text, no people, no logos, no watermarks. Soft calm colors, uncluttered composition with open space in the middle for text.`
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${getPhotoModel()}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], temperature: 1 } }),
    signal,
  }).catch(() => { throw new Error('ไม่มีอินเทอร์เน็ต หรือเชื่อมต่อ Gemini ไม่ได้') })
  if (!r.ok) throw new Error(r.status === 429 ? 'โควต้า Gemini เต็มชั่วคราว รอสักครู่แล้วลองใหม่' : r.status === 400 || r.status === 403 ? `Gemini ปฏิเสธคำขอ (${r.status}) — ตรวจคีย์/โมเดล` : `Gemini ผิดพลาด (${r.status})`)
  const j = await r.json()
  const parts: { inlineData?: { mimeType?: string; data?: string } }[] = j?.candidates?.[0]?.content?.parts ?? []
  const img = parts.find((x) => x.inlineData?.data)
  if (!img?.inlineData?.data) throw new Error('Gemini ไม่ส่งรูปกลับมา (อาจถูกกรองเนื้อหา) ลองใหม่')
  return { dataUrl: `data:${img.inlineData.mimeType || 'image/png'};base64,${img.inlineData.data}`, label: 'AI: ' + theme.split(' ').slice(0, 5).join(' ') }
}
