import { speakableRef } from './speech'

/** ข้อความที่วางมาจากแชต AI มักมีเครื่องหมาย markdown (** ### --- *) — ตัดออกก่อนอ่านออกเสียง (ข้อความที่เก็บยังเป็นต้นฉบับ แก้ได้) */
export function plainMd(text: string): string {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^[-*_=]{3,}$/.test(l))
    .map((l) => l.replace(/^#{1,6}\s*/, '').replace(/^[*•\-–]\s+/, '').replace(/\*\*|__|`/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('. ')
    .replace(/\.\s*\./g, '.')
    .replace(/:\.\s/g, ': ')
}

/**
 * ข้อความความหมายฝ่ายวิญญาณ → ข้อความสำหรับอ่านออกเสียง:
 * ตัด markdown / อีโมจิ / สัญลักษณ์แปลก ๆ / วงเล็บภาษาอังกฤษล้วน แล้วอ่านข้ออ้างอิงแบบอ่านพระคัมภีร์ (อิสยาห์ 42:3 → "อิสยาห์ บทที่ 42 ข้อ 3")
 */
export function speakMeaning(text: string): string {
  return speakableRef(
    plainMd(text)
      .replace(/\([^()ก-๛]*[A-Za-z][^()ก-๛]*\)/g, ' ') // (A bruised reed…) วงเล็บภาษาอังกฤษล้วน
      .replace(/[\p{Extended_Pictographic}️‍]/gu, ' ')
      .replace(/[#*_~`|<>{}[\]\\^=+→←↑↓►▶•●○■□◆◇★☆※«»"“”‘’…]/g, ' ')
      .replace(/\s*\/\s*/g, ' ')
      .replace(/\s+([.,;:!?])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}
