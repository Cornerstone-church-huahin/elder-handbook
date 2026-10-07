import { unzipSync, strFromU8 } from 'fflate'

/** ดึงข้อความจากไฟล์ตอนอัปโหลด (ครั้งเดียว) แล้วเก็บเป็นตัวอักษร — ตอนค้นหาไม่ต้องเปิดไฟล์อีก */
export const MAX_FILE_MB = 20
export const MAX_TEXT = 60000

const clean = (s: string) => s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()

async function pdfText(buf: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const worker = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages && pages.join('').length < MAX_TEXT; i++) {
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
  return pages.join('\n\n')
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
export async function extractText(file: File): Promise<Extracted> {
  const name = file.name.toLowerCase()
  try {
    const buf = await file.arrayBuffer()
    let text = ''
    if (name.endsWith('.pdf') || file.type === 'application/pdf') text = await pdfText(buf)
    else if (name.endsWith('.docx')) text = docxText(buf)
    else return { text: '', note: 'ไฟล์ .doc รุ่นเก่าดึงข้อความอัตโนมัติไม่ได้ (เก็บและดาวน์โหลดได้ตามปกติ) — แนะนำบันทึกเป็น .docx หรือ PDF' }
    text = clean(text)
    if (!text) return { text: '', note: 'ไม่พบข้อความในไฟล์ (อาจเป็นไฟล์สแกนเป็นรูป) — เก็บไฟล์ไว้ได้ แต่ค้นหาจากเนื้อไฟล์ไม่ได้ พิมพ์มติลงในช่องด้านบนเพื่อให้ค้นหาเจอ' }
    return { text: text.slice(0, MAX_TEXT), note: text.length > MAX_TEXT ? `ดึงข้อความ ${MAX_TEXT.toLocaleString()} ตัวอักษรแรก` : `ดึงข้อความแล้ว ${text.length.toLocaleString()} ตัวอักษร` }
  } catch {
    return { text: '', note: 'อ่านเนื้อหาไฟล์ไม่สำเร็จ (ไฟล์อาจมีรหัสผ่านหรือเสีย) — ยังเก็บไฟล์ไว้ได้' }
  }
}

export const safeName = (n: string) => n.replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(-80) || 'file'
export const sizeLabel = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
