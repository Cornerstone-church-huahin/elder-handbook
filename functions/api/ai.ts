/**
 * Cloudflare Pages Function: POST /api/ai
 * ตัวกลางเรียก Claude API สำหรับเว็บจริง (หน้าเว็บไม่ต้องรู้ API key)
 *
 * ตั้งค่าใน Cloudflare Pages › Settings › Environment variables (แบบ Secret):
 *   ANTHROPIC_API_KEY  คีย์จาก console.anthropic.com
 *   ACCESS_CODE        รหัสเข้าใช้ที่แจกเฉพาะผู้ปกครอง (กันคนนอกใช้ AI จนเสียค่าใช้จ่าย)
 *   AI_MODEL           (ไม่บังคับ) ค่าเริ่มต้น claude-sonnet-5
 *
 * Step A4: เปลี่ยนจากรหัสเข้าใช้เป็นการตรวจ Login ของ Supabase
 */
interface Env {
  ANTHROPIC_API_KEY?: string
  ACCESS_CODE?: string
  AI_MODEL?: string
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  if (!env.ANTHROPIC_API_KEY || !env.ACCESS_CODE) return json(503, { code: 'not_configured' })
  const code = request.headers.get('x-access-code') ?? ''
  if (!sameText(code, env.ACCESS_CODE)) return json(401, { code: 'locked' })

  let prompt = ''
  try {
    const body = (await request.json()) as { prompt?: unknown }
    prompt = typeof body.prompt === 'string' ? body.prompt : ''
  } catch {
    return json(400, { code: 'invalid_request' })
  }
  if (!prompt || prompt.length > 70000) return json(400, { code: 'invalid_request' })

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: env.AI_MODEL || 'claude-sonnet-5',
      max_tokens: 4096,
      system: 'Reply with exactly one JSON value and nothing else. The reply will be machine-parsed.',
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (r.status === 429) return json(429, { code: 'rate_limited' })
  if (!r.ok) return json(502, { code: 'upstream_error', status: r.status })
  const data = (await r.json()) as { content?: { type: string; text?: string }[]; stop_reason?: string }
  const text = (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('')
  if (!text.trim()) return json(502, { code: data.stop_reason === 'refusal' ? 'refused' : 'empty_completion' })
  return json(200, { text })
}

export const onRequest = async (): Promise<Response> => json(405, { code: 'method_not_allowed' })
