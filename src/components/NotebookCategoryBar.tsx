import { useState } from 'react'
import type { NbCategory } from '../lib/prayerNotebook'

export const ALL = '__all'
export const NONE = '__none'

/**
 * แถบเลือกหมวด (ท่องจำคัมภีร์): เลือกหมวดจากรายการ · ⚙️ จัดการหมวด (เพิ่ม เปลี่ยนชื่อ ลบ ได้ตลอดเวลา) · ＋ เพิ่ม
 * เปลี่ยนชื่อ/ลบหมวด → รายการในหมวดนั้นย้ายตาม (ลบหมวด = รายการอยู่ในกลุ่ม "ไม่มีหมวด" ไม่ถูกลบ)
 */
export default function NotebookCategoryBar({ icon, cats, counts, noneCount, total, value, onChange, onAdd, onRename, onRemove, onNew, showNew }: {
  icon: string
  cats: NbCategory[]
  counts: Record<string, number>
  noneCount: number
  total: number
  value: string
  onChange: (v: string) => void
  onAdd: (name: string) => boolean
  onRename: (c: NbCategory, name: string) => boolean
  onRemove: (c: NbCategory) => void
  onNew: () => void
  showNew: boolean
}) {
  const [manage, setManage] = useState(false)
  const [name, setName] = useState('')
  const [edit, setEdit] = useState<Record<string, string>>({})
  const [del, setDel] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const add = () => {
    if (!name.trim()) return
    if (!onAdd(name)) return setErr('มีหมวดชื่อนี้อยู่แล้ว')
    setName('')
    setErr('')
  }
  return (
    <>
      <div className="nb-bar nb-catbar">
        <label className="nb-catsel">
          <span className="nb-catsel__icon" aria-hidden="true">{icon}</span>
          <span className="sr-only">เลือกหมวด</span>
          <select id="nb-catsel" value={value} onChange={(e) => onChange(e.target.value)} aria-label="เลือกหมวด">
            <option value={ALL}>ทุกหมวด ({total})</option>
            {cats.map((c) => <option key={c.id} value={c.name}>{c.name} ({counts[c.name] ?? 0})</option>)}
            {noneCount > 0 && <option value={NONE}>ไม่มีหมวด ({noneCount})</option>}
          </select>
        </label>
        <button type="button" className={`nb-gear${manage ? ' nb-gear--on' : ''}`} aria-label="จัดการหมวด" aria-expanded={manage} onClick={() => setManage(!manage)}>⚙️</button>
        {showNew && <button type="button" className="btn btn--gold nb-add edit-only" onClick={onNew}>＋ เพิ่ม</button>}
      </div>
      {manage && (
        <section className="card nb-catmgr" aria-label="จัดการหมวด">
          <h2 className="section__title">⚙️ จัดการหมวด</h2>
          <ul className="nb-catmgr__list">
            {cats.length === 0 && <li className="source-note">ยังไม่มีหมวด — พิมพ์ชื่อด้านล่างแล้วกด ＋ เพิ่มหมวด</li>}
            {cats.map((c) => {
              const v = edit[c.id] ?? c.name
              return (
                <li key={c.id}>
                  <input aria-label={`ชื่อหมวด ${c.name}`} value={v} onChange={(e) => setEdit({ ...edit, [c.id]: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} />
                  {v.trim() !== c.name && v.trim() && (
                    <button type="button" className="mini" onClick={() => { if (onRename(c, v)) { setEdit({ ...edit, [c.id]: undefined as unknown as string }); setErr('') } else setErr('มีหมวดชื่อนี้อยู่แล้ว') }}>💾 บันทึกชื่อ</button>
                  )}
                  {del === c.id ? (
                    <span className="nb-catmgr__del">
                      <span>ลบ? ({counts[c.name] ?? 0} รายการจะไปอยู่ “ไม่มีหมวด”)</span>
                      <button type="button" className="btn btn--danger" onClick={() => { onRemove(c); setDel(null) }}>ลบ</button>
                      <button type="button" className="btn btn--ghost" onClick={() => setDel(null)}>ไม่ลบ</button>
                    </span>
                  ) : <button type="button" className="mini" aria-label={`ลบหมวด ${c.name}`} onClick={() => setDel(c.id)}>🗑️</button>}
                </li>
              )
            })}
          </ul>
          <div className="nb-catmgr__add">
            <input aria-label="ชื่อหมวดใหม่" placeholder="ชื่อหมวดใหม่ เช่น ความรัก ความเชื่อ" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
            <button type="button" className="btn btn--gold" onClick={add}>＋ เพิ่มหมวด</button>
          </div>
          {err && <p className="ai-keys__err" role="alert">{err}</p>}
        </section>
      )}
    </>
  )
}
