import { useEffect, useState } from 'react'
import { BIBLE_BOOKS, getVerses, keyWords, parseRef, searchBible, type VerseText } from '../data/bible'
import { topicRefs } from '../data/bibleTopics'
import { popularRank } from '../data/popularVerses'

/** ข้อความของข้ออ้างอิง (null = กำลังโหลด · [] = ไม่พบ) */
type Texts = Record<string, VerseText[] | null>

const norm = (r: string) => parseRef(r)?.label ?? ''

/**
 * ค้นหาข้อพระคัมภีร์: พิมพ์เรื่องที่ต้องการเป็นประโยคยาวได้ → ข้อพระคัมภีร์ที่เกี่ยวข้องขึ้นเป็นแท็กเล็ก ๆ (ลบ ✕ / พิมพ์เพิ่มได้)
 * → เนื้อหาของแต่ละแท็กขึ้นด้านล่าง (ฉบับ 1971) → เก็บเข้าหมวดท่องจำได้
 * ค้นจาก: หัวข้อที่คัดไว้ล่วงหน้า (ป่วย ท้อแท้ กลัว ฯลฯ) + ค้นคำสำคัญในพระคัมภีร์ทั้งเล่ม (ไม่ใช้ AI ไม่เสียค่าใช้จ่าย)
 */
export default function BibleSearchPanel({ categories, onSave }: { categories: string[]; /** คืน false ถ้าข้อนี้มีอยู่ในหมวดนั้นแล้ว (ไม่เก็บซ้ำ) */ onSave: (category: string, label: string, verses: VerseText[]) => boolean }) {
  const [q, setQ] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [texts, setTexts] = useState<Texts>({})
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [note, setNote] = useState('')
  const [add, setAdd] = useState('')
  const [cat, setCat] = useState('')
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [pop, setPop] = useState<Record<string, boolean>>({}) // แท็กที่เป็นข้อนิยมใช้
  const [found, setFound] = useState<Record<string, boolean>>({}) // แท็กที่ได้จากการค้นคำในพระคัมภีร์ (ไม่ใช่ข้อที่คัดไว้/นิยม)

  // แท็กใหม่ → โหลดเนื้อหา
  useEffect(() => {
    let alive = true
    for (const t of tags) {
      if (texts[t] !== undefined) continue
      setTexts((m) => ({ ...m, [t]: null }))
      const ref = parseRef(t)
      getVerses(ref ?? ({ verses: [] } as never)).then((v) => alive && setTexts((m) => ({ ...m, [t]: v })))
    }
    return () => { alive = false }
  }, [tags]) // eslint-disable-line react-hooks/exhaustive-deps

  const search = async () => {
    const text = q.trim()
    if (!text) return
    setMsg('')
    setNote('')
    setBusy('กำลังค้น…')
    try {
      // รวมผู้สมัครพร้อมคะแนน: ข้อที่คัดไว้ตามหัวข้อ (ตรงทั้งข้อความ > ตรงคำสำคัญ) > ข้อที่ค้นเจอจากคำในพระคัมภีร์
      // + ข้อที่ใช้สอน/ท่องจำกันแพร่หลายที่สุด (popularVerses) ได้คะแนนเพิ่ม จึงขึ้นก่อน
      const cand = new Map<string, { score: number; text: boolean }>()
      const add = (r: string, score: number, text: boolean) => {
        const n = norm(r)
        if (!n) return
        const cur = cand.get(n)
        if (!cur) cand.set(n, { score, text })
        else if (score > cur.score) cand.set(n, { score, text: cur.text && text })
        else if (!text) cand.set(n, { score: cur.score, text: false })
      }
      topicRefs(text, 14).forEach((r, i) => add(r, 100 - i * 3, false))
      const kws = keyWords(text)
      kws.forEach((w) => topicRefs(w, 5).forEach((r, i) => add(r, 70 - i * 3, false)))
      // ค้นคำสำคัญในพระคัมภีร์ทั้งเล่ม (คำยาวก่อน)
      const strong = [...kws].filter((w) => w.length >= 3).sort((a, b) => b.length - a.length).slice(0, 3)
      for (const w of strong) {
        setBusy(`กำลังค้น “${w}” …`)
        const hits = await searchBible(w)
        hits.slice(0, 4).forEach((h, i) => add(`${BIBLE_BOOKS[h.book - 1].name} ${h.chapter}:${h.verse}`, 25 - i, true))
      }
      const ranked = [...cand.entries()]
        .map(([ref, c]) => {
          const pr = popularRank(ref)
          return { ref, text: c.text, pop: pr >= 0, score: c.score + (pr >= 0 ? 60 - Math.min(pr, 60) * 0.5 : 0) }
        })
        .sort((a, b) => b.score - a.score)
      // ข้อที่ค้นเจอจากคำเพียงอย่างเดียวเกี่ยวน้อยกว่า: ใส่เฉพาะเมื่อข้อที่คัดไว้/นิยมมีไม่ถึง 10 ข้อ (ค้นคำเฉพาะที่ไม่มีหัวข้อรองรับก็ยังได้ผลลัพธ์)
        .filter((x, _i, all) => !x.text || x.pop || all.filter((y) => !y.text || y.pop).length < 10)
        .slice(0, 16)
      setFound(Object.fromEntries(ranked.filter((x) => x.text && !x.pop).map((x) => [x.ref, true])))
      setPop(Object.fromEntries(ranked.filter((x) => x.pop).map((x) => [x.ref, true])))
      const out = ranked.map((x) => x.ref)
      setTags(out)
      setSaved({})
      if (!out.length) setMsg('ไม่พบข้อพระคัมภีร์ที่เกี่ยวข้อง ลองเปลี่ยนคำ หรือพิมพ์ชื่อข้อเพิ่มเองด้านล่าง')
    } finally {
      setBusy('')
    }
  }

  const saveAll = () => {
    let n = 0, dup = 0
    const next = { ...saved }
    for (const t of tags) {
      const v = texts[t]
      if (saved[t] || !v?.length) continue
      if (onSave(cat, t, v)) n++
      else dup++
      next[t] = true
    }
    setSaved(next)
    setNote(`เก็บ ${n} ข้อเข้าหมวด${cat ? ` “${cat}”` : 'ไม่มีหมวด'} แล้ว${dup ? ` · ข้ามที่มีอยู่แล้ว ${dup} ข้อ` : ''}`)
  }

  const addTag = () => {
    const r = parseRef(add)
    if (!r || !r.verses.length) return setMsg('พิมพ์ข้อไม่ถูก เช่น สดุดี 23:1 หรือ ยอห์น 3:16–17')
    setMsg('')
    if (!tags.includes(r.label)) setTags([...tags, r.label])
    setAdd('')
  }

  return (
    <section className="bs" aria-label="ค้นหาข้อพระคัมภีร์">
      <label className="bs__q">
        <span>🔎 พิมพ์เรื่องที่ต้องการ (พิมพ์ยาวเป็นประโยคได้)</span>
        <textarea id="bs-q" rows={3} value={q} placeholder="เช่น ผู้ป่วยที่หมดกำลังใจ ต้องการความเข้มแข็ง ขอให้หายขาดและมีเรี่ยวแรง" onChange={(e) => setQ(e.target.value)} />
      </label>
      <button type="button" className="btn btn--gold" onClick={search} disabled={!q.trim() || !!busy}>{busy || '🔎 ค้นหา'}</button>
      {msg && <p className="ai-keys__err" role="alert">{msg}</p>}

      {(tags.length > 0 || q) && (
        <div className="bs__tags">
          <p className="bs__h">ข้อพระคัมภีร์ที่เลือก ({tags.length}) — เรียงจากข้อที่นิยมใช้และตรงเรื่องที่สุดก่อน · ⭐ = ใช้สอน/ท่องจำกันแพร่หลาย · ขอบเส้น = ค้นเจอจากคำ (อาจเกี่ยวน้อยกว่า) · แตะ ✕ เพื่อเอาออก</p>
          <ul aria-label="ข้อที่เลือก">
            {tags.map((t) => (
              <li key={t} className={`bs__tag${found[t] ? ' bs__tag--found' : ''}`} title={pop[t] ? 'ข้อที่ใช้สอน/ท่องจำกันแพร่หลาย' : found[t] ? 'ค้นเจอจากคำในพระคัมภีร์ (อาจเกี่ยวข้องน้อยกว่า)' : 'ข้อที่คัดไว้ตามหัวข้อ'}>
                <span>{pop[t] ? '⭐ ' : ''}{t}</span>
                <button type="button" aria-label={`ลบ ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))}>✕</button>
              </li>
            ))}
          </ul>
          <div className="bs__add">
            <input id="bs-add" value={add} placeholder="พิมพ์เพิ่มเอง เช่น สดุดี 23:1" onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTag()} />
            <button type="button" className="btn btn--ghost" onClick={addTag}>＋ เพิ่ม</button>
          </div>
        </div>
      )}

      {tags.length > 0 && (
        <div className="bs__saveall edit-only">
          <label className="bs__cat">เก็บเข้าหมวด
            <select id="bs-cat" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">ไม่มีหมวด</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <button type="button" className="btn btn--gold" id="bs-saveall" disabled={!tags.some((t) => !saved[t] && texts[t]?.length)} onClick={saveAll}>💾 บันทึกทั้งหมด ({tags.filter((t) => !saved[t] && texts[t]?.length).length})</button>
        </div>
      )}
      {note && <p className="nb-sync nb-sync--ok" role="status">{note}</p>}

      <ul className="bs__cards">
        {tags.map((t) => {
          const v = texts[t]
          return (
            <li key={t} className="bs__card">
              <b>📖 {t}</b> <small>ฉบับ 1971</small>
              {v === null || v === undefined ? <p className="source-note">กำลังเปิดพระคัมภีร์…</p>
                : v.length ? <p className="bs__text">{v.map((x) => <span key={x.n}>{v.length > 1 && <sup>{x.n}</sup>}{x.text} </span>)}</p>
                  : <p className="source-note">ไม่พบข้อความข้อนี้</p>}
              {v && v.length > 0 && (
                <button type="button" className="mini edit-only" disabled={saved[t]} onClick={() => { const ok = onSave(cat, t, v); setSaved({ ...saved, [t]: true }); setNote(ok ? `เก็บ ${t} แล้ว` : `${t} มีอยู่ในหมวดนี้แล้ว`) }}>{saved[t] ? '✅ เก็บแล้ว' : '💾 เก็บข้อนี้'}</button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
