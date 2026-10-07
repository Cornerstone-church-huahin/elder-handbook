import { unzipSync, strFromU8 } from 'fflate'

/** ดึงข้อความจากไฟล์ตอนอัปโหลด (ครั้งเดียว) แล้วเก็บเป็นตัวอักษร — ตอนค้นหาไม่ต้องเปิดไฟล์อีก */
export const MAX_FILE_MB = 20
export const MAX_TEXT = 120000
const OCR_PAGES = 20

const clean = (s: string) => s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()

type Progress = (s: string) => void
const asset = (p: string) => new URL(`ocr/${p}`, document.baseURI).href

/** อ่านตัวหนังสือจากภาพ (OCR ไทย+อังกฤษ) — ใช้เมื่อ PDF เป็นไฟล์สแกนที่ไม่มีข้อความ · ไฟล์ OCR มากับแอป ไม่ต้องพึ่งเว็บภายนอก */
async function ocrPdf(doc: { numPages: number; getPage: (n: number) => Promise<any> }, onProgress?: Progress): Promise<string> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { createWorker } = await import('tesseract.js')
  const total = Math.min(doc.numPages, OCR_PAGES)
  let page = 0
  onProgress?.('กำลังเตรียมตัวอ่านภาพ (ครั้งแรกใช้เวลาสักครู่)…')
  const worker = await createWorker(['tha', 'eng'], 1, {
    workerPath: asset('worker.min.js'),
    corePath: asset(''),
    langPath: asset('').replace(/\/$/, ''),
    workerBlobURL: false,
    gzip: true,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(`กำลังอ่านภาพหน้า ${page}/${total} … ${Math.round(m.progress * 100)}%${doc.numPages > total ? ` (อ่านเฉพาะ ${total} หน้าแรก)` : ''}`)
    },
  })
  const out: string[] = []
  try {
    for (page = 1; page <= total; page++) {
      const pg = await doc.getPage(page)
      const vp = pg.getViewport({ scale: 2 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.floor(vp.width)
      canvas.height = Math.floor(vp.height)
      await pg.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise
      const r = await worker.recognize(canvas)
      out.push(r.data.text)
    }
  } finally {
    await worker.terminate()
  }
  return out.join('\n\n')
}

async function pdfText(buf: ArrayBuffer, onProgress?: Progress): Promise<{ text: string; ocr: boolean }> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const worker = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages && pages.join('').length < MAX_TEXT; i++) {
    onProgress?.(`กำลังอ่านข้อความหน้า ${i}/${doc.numPages}…`)
    const tc = await (await doc.getPage(i)).getTextContent()
    let line = ''
    const lines: string[] = []
    for (const it of tc.items as { str: string; hasEOL?: boolean }[]) {
      line += it.str
      if (it.hasEOL) { lines.push(line); line = '' }
    }
    if (line) lines.push(line)
    pages.push(lines.join('\n'))
  }
  const text = pages.join('\n\n')
  // ข้อความน้อยมาก (ไฟล์สแกนเป็นภาพ หรือฟอนต์ที่อ่านรหัสไม่ได้) → อ่านจากภาพแทน
  const thin = text.replace(/\s+/g, '').length < Math.min(doc.numPages, 3) * 25
  if (!thin) return { text, ocr: false }
  try { return { text: await ocrPdf(doc, onProgress), ocr: true } } catch { return { text, ocr: false } }
}

function docxText(buf: ArrayBuffer): string {
  const files = unzipSync(new Uint8Array(buf), { filter: (f) => f.name === 'word/document.xml' })
  const xml = files['word/document.xml']
  if (!xml) return ''
  const doc = new DOMParser().parseFromString(strFromU8(xml), 'application/xml')
  const out: string[] = []
  doc.querySelectorAll('p').forEach((p) => {
    const t = [...p.querySelectorAll('t, tab, br')].map((n) => (n.localName === 't' ? n.textContent ?? '' : n.localName === 'tab' ? ' ' : '\n')).join('')
    out.push(t)
  })
  return out.join('\n')
}

export type Extracted = { text: string; note: string }
export async function extractText(file: File, onProgress?: Progress): Promise<Extracted> {
  const name = file.name.toLowerCase()
  try {
    const buf = await file.arrayBuffer()
    let text = ''
    let ocr = false
    if (name.endsWith('.pdf') || file.type === 'application/pdf') ({ text, ocr } = await pdfText(buf, onProgress))
    else if (name.endsWith('.docx')) text = docxText(buf)
    else return { text: '', note: 'ไฟล์ .doc รุ่นเก่าดึงข้อความอัตโนมัติไม่ได้ (เก็บและดาวน์โหลดได้ตามปกติ) — แนะนำบันทึกเป็น .docx หรือ PDF' }
    text = clean(text)
    if (!text) return { text: '', note: 'อ่านข้อความจากไฟล์ไม่ได้ (ภาพไม่ชัดหรือไฟล์ถูกป้องกัน) — เก็บไฟล์ไว้ได้ แต่ค้นหาจากเนื้อไฟล์ไม่ได้ พิมพ์มติลงในช่องด้านบนเพื่อให้ค้นหาเจอ' }
    const how = ocr ? 'อ่านจากภาพ (ไฟล์สแกน) ' : 'ดึงข้อความแล้ว '
    return { text: text.slice(0, MAX_TEXT), note: text.length > MAX_TEXT ? `${how}${MAX_TEXT.toLocaleString()} ตัวอักษรแรก` : `${how}${text.length.toLocaleString()} ตัวอักษร${ocr ? ' · ตัวอักษรอาจผิดเพี้ยนบ้าง ตรวจดูได้ที่ "ข้อความในไฟล์"' : ''}` }
  } catch {
    return { text: '', note: 'อ่านเนื้อหาไฟล์ไม่สำเร็จ (ไฟล์อาจมีรหัสผ่านหรือเสีย) — ยังเก็บไฟล์ไว้ได้' }
  }
}

export const safeName = (n: string) => n.replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(-80) || 'file'
export const sizeLabel = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

/** ชื่อที่แสดง: ตัดนามสกุล และส่วนท้ายที่เครื่อง/แอปสแกนต่อให้ เช่น "(_261005_204444" หรือ "(1)" */
export function cleanName(n: string): string {
  let t = n.replace(/\.(pdf|docx?|PDF|DOCX?)$/, '')
  t = t.replace(/[\s_(\[-]*\d{6,8}[_-]\d{4,6}[\s)\]]*$/, '') // ตราเวลาท้ายชื่อ เช่น _261005_204444
  t = t.replace(/[\s_-]*\(\d{1,2}\)\s*$/, '') // เลขสำเนา เช่น (1)
  t = t.replace(/[\s_(\[-]+$/, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
  return t || n
}
