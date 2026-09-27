import { useCallback, useEffect, useState } from 'react'

export type FontScale = 85 | 100 | 125 | 150
export const FONT_SCALES: FontScale[] = [85, 100, 125, 150] // 85 = เล็ก สำหรับมือถือที่ตั้งตัวอักษรของเครื่องไว้ใหญ่
const KEY = 'khatha.fontScale'

// Step A4: เมื่อ Login แล้วจะบันทึกค่านี้ใน users.font_scale ด้วย เพื่อให้ตามไปทุกเครื่อง
function read(): FontScale {
  try {
    const v = Number(localStorage.getItem(KEY))
    return (FONT_SCALES as number[]).includes(v) ? (v as FontScale) : 100
  } catch {
    return 100
  }
}

export function applyFontScale(scale: FontScale) {
  document.documentElement.dataset.scale = String(scale)
}

export function initFontScale() {
  applyFontScale(read())
}

export function useFontScale() {
  const [scale, setScaleState] = useState<FontScale>(read)
  useEffect(() => {
    applyFontScale(scale)
  }, [scale])
  const setScale = useCallback((s: FontScale) => {
    setScaleState(s)
    try {
      localStorage.setItem(KEY, String(s))
    } catch {
      /* โหมดส่วนตัวของเบราว์เซอร์อาจบันทึกไม่ได้ ใช้ค่าในหน่วยความจำแทน */
    }
  }, [])
  return { scale, setScale }
}
