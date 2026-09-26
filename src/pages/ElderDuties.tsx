import { useState, type FormEvent } from 'react'
import { useElderDuties } from '../lib/elderDuties'

/** ตั้งค่า › หน้าที่ผู้ปกครอง — เพิ่ม แก้ไข ลบ เรียงลำดับ (ยืนยันในหน้าแทน confirm() ของเบราว์เซอร์) */
export default function ElderDutiesPage() {
  const { list, saved, add, update, remove, move, reset } = useElderDuties()
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [newText, setNewText] = useState('')

  const onAdd = (e: FormEvent) => {
    e.preventDefault()
    if (!newText.trim()) return
    add(newText)
    setNewText('')
  }

  return (
    <>
      <div className="page-head">
        <span className="page-icon" aria-hidden="true">📋</span>
        <h1>หน้าที่ผู้ปกครอง</h1>
        <p>{list.length} ข้อ · เพิ่ม แก้ไข ลบ หรือเลื่อนลำดับได้ตามที่คริสตจักรของท่านใช้จริง</p>
      </div>

      {!saved && <p className="empty">เครื่องนี้บันทึกข้อมูลไม่ได้ (อาจเปิดแบบส่วนตัว) รายการจะหายเมื่อปิดหน้า</p>}

      <ol className="duty-list">
        {list.map((d, i) => (
          <li key={d.id} className="duty">
            <span className="duty__no">{i + 1}</span>
            <div className="duty__body">
              {editing === d.id ? (
                <form
                  className="duty__edit"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (draft.trim()) update(d.id, draft)
                    setEditing(null)
                  }}
                >
                  <textarea id={`duty-edit-${d.id}`} rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
                  <div className="duty__btns">
                    <button type="submit" className="btn">บันทึก</button>
                    <button type="button" className="btn btn--ghost" onClick={() => setEditing(null)}>ยกเลิก</button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="duty__text">{d.text}</p>
                  {d.source && <span className="duty__src">{d.source}</span>}
                  {confirmDel === d.id ? (
                    <div className="duty__btns duty__btns--warn">
                      <span>ลบข้อนี้?</span>
                      <button type="button" className="btn btn--danger" onClick={() => { remove(d.id); setConfirmDel(null) }}>ลบ</button>
                      <button type="button" className="btn btn--ghost" onClick={() => setConfirmDel(null)}>ไม่ลบ</button>
                    </div>
                  ) : (
                    <div className="duty__btns">
                      <button type="button" className="mini" onClick={() => { setEditing(d.id); setDraft(d.text); setConfirmDel(null) }}>✏️ แก้ไข</button>
                      <button type="button" className="mini" onClick={() => setConfirmDel(d.id)}>🗑️ ลบ</button>
                      <button type="button" className="mini" aria-label="เลื่อนขึ้น" disabled={i === 0} onClick={() => move(d.id, -1)}>▲</button>
                      <button type="button" className="mini" aria-label="เลื่อนลง" disabled={i === list.length - 1} onClick={() => move(d.id, 1)}>▼</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
      {list.length === 0 && <p className="empty">ยังไม่มีรายการ เพิ่มหน้าที่ข้อแรกได้ด้านล่าง</p>}

      <form className="card" onSubmit={onAdd}>
        <label htmlFor="duty-new" className="section__title">เพิ่มหน้าที่</label>
        <textarea id="duty-new" rows={2} className="duty-new" placeholder="เช่น เยี่ยมผู้สูงอายุที่มาโบสถ์ไม่ได้เดือนละครั้ง" value={newText} onChange={(e) => setNewText(e.target.value)} />
        <button type="submit" className="btn btn--gold">＋ เพิ่ม</button>
      </form>

      {confirmReset ? (
        <div className="duty__btns duty__btns--warn">
          <span>คืนเป็นรายการตั้งต้น? สิ่งที่แก้ไขไว้จะหายทั้งหมด</span>
          <button type="button" className="btn btn--danger" onClick={() => { reset(); setConfirmReset(false) }}>คืนค่า</button>
          <button type="button" className="btn btn--ghost" onClick={() => setConfirmReset(false)}>ยกเลิก</button>
        </div>
      ) : (
        <button type="button" className="btn btn--ghost" onClick={() => setConfirmReset(true)}>↺ คืนเป็นรายการตั้งต้น</button>
      )}

      <p className="source-note">
        รายการตั้งต้นมาจากระเบียบปฏิบัติของธรรมนูญคริสตจักรภาค 7 (ข้อ 80 และที่เกี่ยวข้อง) และบทเรียนการบริหารคริสตจักร
        ตอนนี้บันทึกไว้ในเครื่องนี้เท่านั้น เมื่อมีระบบเข้าสู่ระบบแล้ว รายการจะใช้ร่วมกันได้ทั้งสองเครื่องของคู่ผู้ปกครอง
      </p>
    </>
  )
}
