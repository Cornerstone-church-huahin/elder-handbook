import type { ReactNode } from 'react'

const inline = (s: string): ReactNode[] =>
  s.split(/(\*\*[^*]+\*\*)/g).map((x, i) => (x.startsWith('**') && x.endsWith('**') && x.length > 4 ? <b key={i}>{x.slice(2, -2)}</b> : x.replace(/`/g, '')))

/** แสดง markdown แบบเบา ๆ (หัวข้อ ### · **ตัวหนา** · รายการ * / • · เส้น ---) ไม่ใช้ HTML ดิบ จึงปลอดภัย */
export default function MdLite({ text, className }: { text: string; className?: string }) {
  const lines = text.split('\n')
  return (
    <div className={className}>
      {lines.map((raw, i) => {
        const l = raw.trim()
        if (!l) return <div key={i} className="md-gap" />
        if (/^[-*_=]{3,}$/.test(l)) return <hr key={i} />
        const h = l.match(/^#{1,6}\s*(.*)$/)
        if (h) return <p key={i} className="md-h">{inline(h[1])}</p>
        const li = l.match(/^[*•\-–]\s+(.*)$/)
        if (li) return <p key={i} className="md-li">• {inline(li[1])}</p>
        return <p key={i} className="md-p">{inline(l)}</p>
      })}
    </div>
  )
}
