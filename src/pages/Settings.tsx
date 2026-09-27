import { Link } from 'react-router-dom'
import { FONT_SCALES, useFontScale } from '../lib/prefs'
import { useElderDuties } from '../lib/elderDuties'
import { useState } from 'react'
import { DEFAULT_REPO, getSync, saveSync, testSync } from '../lib/sync'
import { RATES, useSpeech } from '../lib/speech'
import { BUILTIN_PRON, getVoicePrefs, PITCHES, PRON_KEY, setVoicePrefs, type Pron } from '../lib/voicePrefs'
import { useSharedStore } from '../lib/sharedStore'
import { canInstall, install, isInstalled, isIOS, onInstallChange } from '../lib/install'
import { useEffect } from 'react'
import { getAiSettings, isStandaloneSite, saveAiSettings, testAiKey, VENDORS, type AiSettings, type AiVendor } from '../lib/ai'

export default function Settings() {
  const { scale, setScale } = useFontScale()
  const { list } = useElderDuties()

  return (
    <>
      <div className="page-head">
        <h1>ตั้งค่า</h1>
      </div>

      <section className="card" aria-labelledby="font-title">
        <h2 id="font-title" style={{ fontSize: '1.2rem' }}>ขนาดตัวอักษร</h2>
        <p style={{ color: 'var(--ink-soft)' }}>เลือกขนาดที่อ่านสบายตาที่สุด ทั้งแอปจะขยายตาม</p>
        <div className="scale-options" role="group" aria-label="ขนาดตัวอักษร">
          {FONT_SCALES.map((s) => (
            <button
              key={s}
              id={`scale-${s}`}
              type="button"
              className="scale-option"
              aria-pressed={scale === s}
              onClick={() => setScale(s)}
            >
              <span className="scale-option__sample" style={{ fontSize: `${s / 100}em` }}>ก</span>
              <span className="scale-option__pct">{s === 85 ? 'เล็ก' : s === 100 ? 'ปกติ' : s === 125 ? 'ใหญ่' : 'ใหญ่มาก'} {s}%</span>
            </button>
          ))}
        </div>
      </section>

      <InstallSettings />
      <SpeechSettings />
      <VoiceSettings />
      <PronounceSettings />

      <Link to="/settings/duties" className="result settings-row">
        <span className="result__icon" aria-hidden="true">📋</span>
        <span className="result__body">
          <span className="result__title">หน้าที่ผู้ปกครอง</span>
          <span className="art-where">{list.length} ข้อ · เพิ่ม แก้ไข ลบ หรือเลื่อนลำดับ</span>
        </span>
        <span aria-hidden="true" className="settings-row__go">›</span>
      </Link>

      {isStandaloneSite() && <SyncSettings />}
      {isStandaloneSite() && <AiKeySettings />}

      <section className="card">
        <h2 style={{ fontSize: '1.2rem' }}>บัญชีผู้ใช้</h2>
        <p style={{ color: 'var(--ink-soft)' }}>การเข้าสู่ระบบและพื้นที่ทำงานร่วมกันของคู่ผู้ปกครองจะเปิดใช้ในรุ่นถัดไป</p>
      </section>

      <p className="disclaimer">คู่มือผู้ปกครองคริสตจักร (Church Elder's Handbook) รุ่น 0.1 (ทดลอง)</p>
    </>
  )
}

/** ตั้งค่าคีย์ AI: เลือกได้ Claude · Gemini · ChatGPT เก็บคีย์ในเครื่องนี้เท่านั้น */
function AiKeySettings() {
  const [st, setSt] = useState<AiSettings>(getAiSettings)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const v = VENDORS.find((x) => x.id === st.vendor)!
  const key = st.keys[st.vendor] ?? ''
  const model = st.models[st.vendor] ?? ''
  const edit = (patch: Partial<AiSettings>) => {
    setSt((s) => ({ ...s, ...patch }))
    setMsg(null)
  }
  const pick = (id: AiVendor) => edit({ vendor: id })
  const save = () => {
    saveAiSettings(st)
    setMsg({ ok: true, text: key.trim() ? `บันทึกแล้ว ใช้ ${v.label} ทุกหน้า` : 'บันทึกแล้ว (ไม่มีคีย์ — ใช้ข้อมูลในแอป)' })
  }
  const test = async () => {
    if (!key.trim()) return setMsg({ ok: false, text: 'ใส่คีย์ก่อน' })
    setTesting(true)
    setMsg(null)
    const err = await testAiKey(st.vendor, key, model || v.model)
    setTesting(false)
    if (err) return setMsg({ ok: false, text: err })
    saveAiSettings(st)
    setMsg({ ok: true, text: `ใช้ได้ ✓ บันทึกแล้ว ใช้ ${v.label} ทุกหน้า` })
  }

  return (
    <form className="card ai-keys" onSubmit={(e) => { e.preventDefault(); save() }}>
      <h2 style={{ fontSize: '1.1rem' }}>🔑 ผู้ช่วย AI (ไม่บังคับ)</h2>
      <p className="source-note">ใส่คีย์แล้วใช้ผู้ช่วย AI ได้ในหน้าคู่มืออภิบาล ธรรมนูญ การบริหาร และบุคคลในพระคัมภีร์ คีย์เก็บในเครื่องนี้เท่านั้น ไม่ขึ้นไปที่ GitHub</p>

      <div className="ai-vendors" role="radiogroup" aria-label="เลือกผู้ให้บริการ AI">
        {VENDORS.map((x) => (
          <button key={x.id} type="button" role="radio" aria-checked={st.vendor === x.id} className="ai-vendor" onClick={() => pick(x.id)}>
            <span className="ai-vendor__name">{x.label}</span>
            <span className="ai-vendor__state">{st.keys[x.id] ? '● มีคีย์' : '○ ยังไม่มี'}</span>
          </button>
        ))}
      </div>

      <label htmlFor="ai-key" className="ai-keys__label">คีย์ {v.label}</label>
      <input
        id="ai-key"
        className="code-input"
        type="password"
        autoComplete="off"
        spellCheck={false}
        placeholder={v.hint}
        value={key}
        onChange={(e) => edit({ keys: { ...st.keys, [st.vendor]: e.target.value } })}
      />
      <a className="source-note" href={v.keyUrl} target="_blank" rel="noreferrer">ขอคีย์ {v.label} ได้ที่นี่ ›</a>

      <details className="ai-keys__adv">
        <summary>ขั้นสูง: ชื่อรุ่น AI</summary>
        <input
          id="ai-model"
          className="code-input"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder={v.model}
          value={model}
          onChange={(e) => edit({ models: { ...st.models, [st.vendor]: e.target.value } })}
        />
        <p className="source-note">เว้นว่างเพื่อใช้ค่าตั้งต้น ({v.model})</p>
      </details>

      <div className="ai-keys__btns">
        <button type="button" className="btn btn--gold" onClick={test} disabled={testing}>{testing ? 'กำลังทดสอบ…' : 'ทดสอบและบันทึก'}</button>
        <button type="submit" className="btn btn--ghost">บันทึก</button>
      </div>
      {msg && <p className={msg.ok ? 'ai-keys__ok' : 'ai-keys__err'} role="status">{msg.text}</p>}
    </form>
  )
}

/** ใช้ร่วมกันออนไลน์: สมุดคำอธิษฐานซิงก์ผ่าน repo ส่วนตัวบน GitHub */
function SyncSettings() {
  const cur = getSync()
  const [name, setName] = useState(cur?.name ?? '')
  const [token, setToken] = useState(cur?.token ?? '')
  const [repo, setRepo] = useState(cur?.repo ?? DEFAULT_REPO)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const connect = async () => {
    if (!token.trim()) {
      saveSync(null)
      return setMsg({ ok: true, text: 'ปิดการใช้ร่วมกันแล้ว สมุดบันทึกในเครื่องนี้อย่างเดียว' })
    }
    setBusy(true)
    setMsg(null)
    const cfg = { name: name.trim(), token: token.trim(), repo: repo.trim() || DEFAULT_REPO }
    const err = await testSync(cfg)
    setBusy(false)
    if (err) return setMsg({ ok: false, text: err })
    saveSync(cfg)
    setMsg({ ok: true, text: 'เชื่อมต่อแล้ว ✓ สมุดคำอธิษฐานจะบันทึกออนไลน์และเห็นร่วมกันทุกเครื่องที่ใส่รหัสนี้' })
  }
  return (
    <form className="card ai-keys" onSubmit={(e) => { e.preventDefault(); connect() }}>
      <h2 style={{ fontSize: '1.1rem' }}>☁️ ใช้ร่วมกันออนไลน์</h2>
      <p className="source-note">ใส่รหัสเข้าใช้ร่วมครั้งเดียวต่อเครื่อง แล้วสมุดคำอธิษฐานจะบันทึกขึ้น GitHub ของคริสตจักร (repo ส่วนตัว) ทุกคนที่ใส่รหัสเดียวกันจะเห็นและแก้ไขได้</p>
      <label htmlFor="sync-name" className="ai-keys__label">ชื่อของท่าน (แสดงว่าใครแก้ไข)</label>
      <input id="sync-name" className="code-input" type="text" placeholder="เช่น เจ็ท" value={name} onChange={(e) => { setName(e.target.value); setMsg(null) }} />
      <label htmlFor="sync-token" className="ai-keys__label">รหัสเข้าใช้ร่วม</label>
      <input id="sync-token" className="code-input" type="password" autoComplete="off" spellCheck={false} placeholder="github_pat_..." value={token} onChange={(e) => { setToken(e.target.value); setMsg(null) }} />
      <details className="ai-keys__adv">
        <summary>ขั้นสูง: ที่เก็บข้อมูล</summary>
        <input id="sync-repo" className="code-input" type="text" spellCheck={false} value={repo} onChange={(e) => { setRepo(e.target.value); setMsg(null) }} />
      </details>
      <div className="ai-keys__btns">
        <button type="submit" className="btn btn--gold" disabled={busy}>{busy ? 'กำลังตรวจ…' : 'เชื่อมต่อและบันทึก'}</button>
      </div>
      {msg && <p className={msg.ok ? 'ai-keys__ok' : 'ai-keys__err'} role="status">{msg.text}</p>}
      {getSync() && <InviteLink />}
    </form>
  )
}

/** ลิงก์เข้าร่วมสำหรับเครื่องอื่น: ส่งทาง Line ส่วนตัว เปิดครั้งเดียวก็เชื่อมต่อ */
function InviteLink() {
  const [note, setNote] = useState('')
  const cfg = getSync()!
  const link = `${location.origin}${location.pathname}#/join?t=${encodeURIComponent(cfg.token)}${cfg.repo !== DEFAULT_REPO ? `&r=${encodeURIComponent(cfg.repo)}` : ''}`
  const share = async () => {
    const text = `ลิงก์เข้าร่วมสมุดคำอธิษฐาน (คู่มือผู้ปกครองคริสตจักร) เปิดครั้งเดียวบนมือถือของท่าน:\n${link}`
    try {
      if (navigator.share) await navigator.share({ title: 'เข้าร่วมสมุดคำอธิษฐาน', text })
      else {
        await navigator.clipboard.writeText(text)
        setNote('คัดลอกลิงก์แล้ว วางในแชต Line ส่วนตัวได้เลย')
      }
    } catch {
      /* ผู้ใช้ปิดหน้าต่างแชร์ */
    }
  }
  return (
    <div className="invite">
      <button type="button" className="btn btn--ghost" onClick={share}>📤 ส่งลิงก์ให้อีกเครื่อง (เช่น ภรรยา)</button>
      <p className="source-note">เปิดลิงก์ครั้งเดียวบนเครื่องนั้น ใส่ชื่อ แล้วใช้ร่วมกันได้ทันที ส่งเฉพาะแชตส่วนตัว อย่าโพสต์ในกลุ่ม</p>
      {note && <p className="ai-keys__ok">{note}</p>}
    </div>
  )
}

/** ความเร็วเสียงอ่าน: ตั้งครั้งเดียว ใช้กับการฟังทุกที่ในแอป */
function SpeechSettings() {
  const tts = useSpeech()
  if (!tts.supported) return null
  const i = Math.max(0, RATES.findIndex((r) => r.rate === tts.rate))
  return (
    <section className="card">
      <h2 style={{ fontSize: '1.1rem' }}>🔊 ความเร็วเสียงอ่าน</h2>
      <label className="nb-speed">
        <span className="nb-speed__label">ความเร็ว: <b>{RATES[i].label}</b></span>
        <input
          id="speech-rate"
          type="range"
          min={0}
          max={RATES.length - 1}
          step={1}
          value={i}
          aria-valuetext={RATES[i].label}
          onChange={(e) => { tts.setRate(RATES[+e.target.value].rate); tts.stop() }}
        />
        <span className="nb-speed__ends" aria-hidden="true"><span>🐢 ช้าที่สุด</span><span>ปกติ</span></span>
      </label>
      {tts.speaking ? (
        <button type="button" className="btn btn--ghost" onClick={tts.stop}>⏸ หยุด</button>
      ) : (
        <button type="button" className="btn btn--ghost" onClick={() => tts.speak('ข้าแต่พระบิดาเจ้า ขอบพระคุณที่ทรงอยู่กับข้าพระองค์ทุกวัน ในพระนามพระเยซูคริสต์ อาเมน')}>▶️ ทดลองฟัง</button>
      )}
      <p className="source-note">ใช้กับการฟังทุกที่ในแอป · เครื่องนี้เท่านั้น</p>
      {tts.noVoice && <p className="ai-keys__err">มือถือเครื่องนี้ยังไม่มีเสียงภาษาไทย · Android: ตั้งค่า › การจัดการทั่วไป › การอ่านออกเสียง › Google › ติดตั้งข้อมูลเสียง › ไทย · iPhone: ตั้งค่า › การช่วยการเข้าถึง › เนื้อหาที่ถูกพูด › เสียง › ไทย</p>}
    </section>
  )
}

/** ใช้แบบแอปเต็มจอ: ติดตั้งบนหน้าจอหลัก + วิธีซ่อนปุ่มระบบของมือถือ */
function InstallSettings() {
  const [, force] = useState(0)
  useEffect(() => {
    const off = onInstallChange(() => force((n) => n + 1))
    return () => { off() }
  }, [])
  const [msg, setMsg] = useState('')
  if (isInstalled())
    return (
      <section className="card">
        <h2 style={{ fontSize: '1.1rem' }}>📲 ใช้แบบแอปเต็มจอ</h2>
        <p className="ai-keys__ok">✓ เปิดแบบแอปอยู่แล้ว (ไม่มีแถบเว็บ)</p>
        <GestureTip />
      </section>
    )
  return (
    <section className="card">
      <h2 style={{ fontSize: '1.1rem' }}>📲 ใช้แบบแอปเต็มจอ</h2>
      <p className="source-note">ติดตั้งไว้บนหน้าจอหลัก เปิดแล้วเต็มจอเหมือนแอป ไม่มีแถบที่อยู่เว็บ ได้พื้นที่อ่านมากขึ้น</p>
      {canInstall() ? (
        <button type="button" className="btn btn--gold" onClick={async () => setMsg((await install()) ? 'ติดตั้งแล้ว ✓ เปิดจากไอคอนบนหน้าจอหลักได้เลย' : '')}>📲 ติดตั้งแอปบนหน้าจอหลัก</button>
      ) : isIOS() ? (
        <ol className="install-steps">
          <li>เปิดหน้านี้ใน Safari</li>
          <li>แตะปุ่มแชร์ (สี่เหลี่ยมมีลูกศรชี้ขึ้น) ด้านล่าง</li>
          <li>เลือก “เพิ่มไปยังหน้าจอโฮม” แล้วแตะ “เพิ่ม”</li>
        </ol>
      ) : (
        <ol className="install-steps">
          <li>เปิดหน้านี้ใน Chrome</li>
          <li>แตะ ⋮ มุมขวาบน</li>
          <li>เลือก “ติดตั้งแอป” หรือ “เพิ่มลงในหน้าจอหลัก”</li>
        </ol>
      )}
      {msg && <p className="ai-keys__ok">{msg}</p>}
      <GestureTip />
    </section>
  )
}

function GestureTip() {
  return (
    <details className="ai-keys__adv">
      <summary>ซ่อนปุ่ม III ○ ‹ ด้านล่างของมือถือ (Samsung)</summary>
      <ol className="install-steps">
        <li>เปิด “การตั้งค่า” ของมือถือ</li>
        <li>เลือก “จอแสดงผล” แล้ว “แถบนำทาง”</li>
        <li>เลือก “ท่าทางการปัด” — ปุ่มจะเหลือเป็นเส้นบาง ๆ ปัดขึ้นจากขอบล่างเพื่อกลับหน้าหลัก</li>
      </ol>
    </details>
  )
}

/** เลือกเสียงอ่าน (จากเสียงที่มือถือมี) + ระดับเสียงทุ้ม/แหลม · เครื่องนี้เท่านั้น */
function VoiceSettings() {
  const th = useSpeech()
  const en = useSpeech('en-US')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [prefs, setPrefs] = useState(getVoicePrefs())
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const load = () => setVoices(window.speechSynthesis.getVoices())
    load()
    window.speechSynthesis.addEventListener?.('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', load)
  }, [])
  if (!th.supported) return null
  const thv = voices.filter((v) => /^th/i.test(v.lang))
  const env = voices.filter((v) => /^en/i.test(v.lang))
  const update = (p: Partial<typeof prefs>) => {
    setVoicePrefs(p)
    setPrefs(getVoicePrefs())
    th.stop()
    en.stop()
  }
  const label = (v: SpeechSynthesisVoice) => `${v.name}${v.localService ? '' : ' (ออนไลน์)'}`
  return (
    <section className="card voice-settings">
      <h2 style={{ fontSize: '1.1rem' }}>🗣️ เสียงผู้อ่าน</h2>
      <label className="voice-row">
        <span>เสียงภาษาไทย</span>
        <select id="voice-th" value={prefs.th ?? ''} onChange={(e) => update({ th: e.target.value || undefined })}>
          <option value="">อัตโนมัติ</option>
          {thv.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{label(v)}</option>)}
        </select>
      </label>
      <label className="voice-row">
        <span>เสียงภาษาอังกฤษ</span>
        <select id="voice-en" value={prefs.en ?? ''} onChange={(e) => update({ en: e.target.value || undefined })}>
          <option value="">อัตโนมัติ</option>
          {env.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{label(v)}</option>)}
        </select>
      </label>
      <p className="voice-row__label">ระดับเสียง (ทุ้ม = โทนผู้ชาย · แหลม = โทนผู้หญิง)</p>
      <div className="font-scale" role="group" aria-label="ระดับเสียง">
        {PITCHES.map((p) => (
          <button key={p.v} type="button" aria-pressed={prefs.pitch === p.v} onClick={() => update({ pitch: p.v })}>{p.label}</button>
        ))}
      </div>
      <div className="voice-test">
        <button type="button" className="btn btn--ghost" onClick={() => th.speak('เอโนคดำเนินชีวิตกับพระเจ้า อิสอัคเป็นบุตรของอับราฮัม ในพระนามพระเยซูคริสต์ อาเมน')}>▶️ ฟังเสียงไทย</button>
        <button type="button" className="btn btn--ghost" onClick={() => en.speak('The Lord is my shepherd. I shall lack nothing.')}>▶️ ฟังเสียงอังกฤษ</button>
      </div>
      <p className="source-note">
        มือถือแต่ละเครื่องมีเสียงไม่เท่ากัน · เสียงไทยส่วนใหญ่มีเสียงเดียว ปรับระดับเสียงแทนได้ ·
        เพิ่มเสียง: Android › ตั้งค่า › การจัดการทั่วไป › การอ่านออกเสียง (Text-to-speech) › เลือก Google › ติดตั้งข้อมูลเสียง › ไทย (เลือกเสียงคุณภาพสูง) ·
        iPhone › ตั้งค่า › การช่วยการเข้าถึง › เนื้อหาที่ถูกพูด › เสียง › ไทย (ดาวน์โหลดเสียง Enhanced)
      </p>
    </section>
  )
}

/** คำที่เครื่องอ่านผิด → เขียนแบบที่อ่านถูก (ใช้ร่วมกันออนไลน์) */
function PronounceSettings() {
  const store = useSharedStore<Pron>({ localKey: PRON_KEY, file: 'pronounce.json', label: 'คำอ่าน' })
  const tts = useSpeech()
  const [word, setWord] = useState('')
  const [say, setSay] = useState('')
  const [showBuiltin, setShowBuiltin] = useState(false)
  if (!tts.supported) return null
  const add = () => {
    const w = word.trim()
    const s2 = say.trim()
    if (!w || !s2) return
    store.put([{ id: `p:${w}`, word: w, say: s2, updated: 0 }])
    setWord('')
    setSay('')
  }
  return (
    <section className="card pron-settings">
      <h2 style={{ fontSize: '1.1rem' }}>🔤 แก้คำที่เสียงอ่านผิด</h2>
      <p className="source-note">เช่น เครื่องอ่าน “เอโนค” เป็น “เอ-โน-คอ” ให้ใส่คำอ่านว่า “เอโนก” · ข้อความบนจอไม่เปลี่ยน · ใช้ร่วมกันทุกเครื่อง</p>
      <div className="pron-add">
        <input id="pron-word" value={word} onChange={(e) => setWord(e.target.value)} placeholder="คำที่อ่านผิด" aria-label="คำที่อ่านผิด" />
        <input id="pron-say" value={say} onChange={(e) => setSay(e.target.value)} placeholder="ให้อ่านว่า" aria-label="ให้อ่านว่า" />
        <button type="button" className="btn btn--ghost" disabled={!say.trim()} onClick={() => tts.speak(say)} aria-label="ทดลองฟังคำอ่าน">▶️</button>
        <button type="button" className="btn btn--gold" disabled={!word.trim() || !say.trim()} onClick={add}>＋ เพิ่ม</button>
      </div>
      {store.items.length > 0 && (
        <ul className="pron-list">
          {store.items.map((x) => (
            <li key={x.id}>
              <span><b>{x.word}</b> → {x.say}</span>
              <button type="button" className="mini" onClick={() => tts.speak(x.word)} aria-label={`ฟัง ${x.word}`}>▶️</button>
              <button type="button" className="mini" onClick={() => store.remove(x.id)} aria-label={`ลบ ${x.word}`}>🗑️</button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="linkish" onClick={() => setShowBuiltin(!showBuiltin)}>{showBuiltin ? '▴' : '▾'} คำที่แก้ไว้ให้แล้ว ({BUILTIN_PRON.length} คำ)</button>
      {showBuiltin && <p className="source-note">{BUILTIN_PRON.map(([w, s2]) => `${w} → ${s2}`).join(' · ')}</p>}
    </section>
  )
}
