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
