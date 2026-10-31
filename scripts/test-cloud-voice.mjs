// ฟังต่อเนื่องแบบไฟล์เสียง (Gemini TTS) — จำลองคำตอบของ Gemini: ต้องเล่นด้วย <audio> ไม่ใช้ speechSynthesis · ไฮไลต์เดินตามเสียง · หยุด/ฟังต่อได้ · ล้มเหลวแล้วกลับไปใช้เสียงมือถือ
import { chromium } from 'playwright'
const URL = process.env.URL || 'http://localhost:4173/'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] })
let fail = 0; const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) fail++ }
// เสียงเงียบ 1.2 วินาที 24kHz 16 บิต (PCM) ตามรูปแบบที่ Gemini ส่งกลับ
const pcm = Buffer.alloc(24000 * 2 * 1.2).toString('base64')
async function run(mode) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
  await ctx.addInitScript(() => {
    localStorage.setItem('khatha.aiSettings.v1', JSON.stringify({ vendor: 'gemini', keys: { gemini: 'AIzaFAKEKEYFORTEST' }, models: {} }))
    window.__said = []
    window.SpeechSynthesisUtterance = function (t) { this.text = t }
    const synth = { speaking: false, pending: false, getVoices: () => [{ name: 'Google ไทย', lang: 'th-TH' }], speak: (u) => { window.__said.push(u.text); synth.speaking = true; setTimeout(() => { synth.speaking = false; u.onend && u.onend() }, 30) }, cancel: () => { synth.speaking = false } }
    Object.defineProperty(window, 'speechSynthesis', { value: synth })
  })
  const calls = []
  await ctx.route('**/generativelanguage.googleapis.com/**', (r) => {
    calls.push(r.request().url())
    if (mode === 'fail') return r.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: { message: 'API key not valid' } }) })
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;rate=24000', data: pcm } }] } }] }) })
  })
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
  await p.goto(URL + '#/prayer'); await p.waitForSelector('.nb-card'); await p.fill('#nb-q', 'อาหาร'); await p.waitForSelector('.nb-card--open .nb-verse')
  await p.waitForFunction(() => !document.querySelector('.nb-card--open .nb-verse')?.textContent.includes('กำลังเปิด'))
  await p.click('[aria-label^="ฟังต่อเนื่อง"]'); await p.waitForTimeout(2500)
  return { p, calls, errs, ctx }
}
{
  const { p, calls, errs, ctx } = await run('ok')
  const st = await p.evaluate(() => ({ said: window.__said.length, playing: [...document.querySelectorAll('audio')].length, ms: navigator.mediaSession?.playbackState }))
  check(calls.length >= 1 && /gemini.*tts.*generateContent/.test(calls[0]), 'calls Gemini TTS (' + calls.length + ' calls)')
  check(st.said === 0, 'does not use device speech while cloud voice works (said ' + st.said + ')')
  check(st.ms === 'playing', 'Media Session says playing: ' + st.ms)
  let hl = false
  for (let i = 0; i < 12 && !hl; i++) { hl = await p.evaluate(() => !!document.querySelector('mark.spoken-now')); if (!hl) await p.waitForTimeout(250) }
  check(hl, 'text highlight follows the audio')
  if (await p.locator('[aria-label="หยุดชั่วคราว"]').count()) { await p.click('[aria-label="หยุดชั่วคราว"]'); await p.waitForTimeout(300)
    check(await p.evaluate(() => navigator.mediaSession.playbackState) === 'paused', 'pause works (media session paused)')
    const before = calls.length; await p.click('[aria-label="ฟังต่อ"]').catch(() => {}); await p.waitForTimeout(500) }
  check(errs.length === 0, 'no JS errors ' + errs.join(';'))
  await ctx.close()
}
{
  const { p, calls, errs, ctx } = await run('fail')
  const said = await p.evaluate(() => window.__said.length)
  check(calls.length >= 1 && said > 0, 'Gemini error → falls back to device speech (calls ' + calls.length + ', said ' + said + ')')
  check(errs.length === 0, 'fallback: no JS errors ' + errs.join(';'))
  await ctx.close()
}
await b.close(); console.log(fail ? 'FAILED' : 'ALL PASSED'); process.exit(fail ? 1 : 0)
