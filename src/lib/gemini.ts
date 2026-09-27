/**
 * เปิดแอป AI ที่ผู้ใช้สมัครรายเดือนไว้โดยตรง (Gemini / ChatGPT / Claude) — ไม่ใช้ API ไม่เสียค่าโทเค็น
 * มือถือที่ติดตั้งแอปไว้จะเปิดในแอป ไม่งั้นเปิดเว็บ · ใช้บัญชีของผู้ใช้เอง
 * ถ้ามีคำถาม: คัดลอกไว้ให้เสมอ และใส่ในช่องพิมพ์ให้เลยสำหรับ ChatGPT และ Claude (Gemini ต้องกดวางเอง)
 */
export const AI_APPS = [
  { id: 'gemini', name: 'Gemini', icon: '✨', url: () => 'https://gemini.google.com/app', prefill: false },
  { id: 'chatgpt', name: 'ChatGPT', icon: '💬', url: (q?: string) => `https://chatgpt.com/${q ? `?q=${encodeURIComponent(q)}` : ''}`, prefill: true },
  { id: 'claude', name: 'Claude', icon: '✳️', url: (q?: string) => `https://claude.ai/new${q ? `?q=${encodeURIComponent(q)}` : ''}`, prefill: true },
] as const
export type AiAppId = (typeof AI_APPS)[number]['id']
export const GEMINI_URL = AI_APPS[0].url()

/** เปิดแอป AI · คืน true ถ้าคัดลอกคำถามไว้ให้ */
export function openAiApp(id: AiAppId, text?: string): boolean {
  const app = AI_APPS.find((a) => a.id === id)!
  const q = text?.trim()
  let copied = false
  if (q && navigator.clipboard) {
    navigator.clipboard.writeText(q).catch(() => {})
    copied = true
  }
  window.open(app.url(q), '_blank', 'noopener')
  return copied
}
export const openGemini = (text?: string) => openAiApp('gemini', text)
