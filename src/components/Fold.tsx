import type { ReactNode } from 'react'

/** กล่องตั้งค่าที่พับ/ขยายได้ — กดที่หัวข้อเพื่อเปิดหรือพับเก็บ ประหยัดพื้นที่หน้าจอ */
export default function Fold({ title, badge, className = '', defaultOpen = false, children }: { title: string; badge?: ReactNode; className?: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details className={`card fold ${className}`.trim()} open={defaultOpen || undefined}>
      <summary className="fold__sum">
        <h2 className="fold__t">{title}</h2>
        {badge}
        <span className="fold__chev" aria-hidden="true" />
      </summary>
      <div className="fold__body">{children}</div>
    </details>
  )
}
