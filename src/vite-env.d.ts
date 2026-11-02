/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** '1' เมื่อ build ไฟล์พรีวิวแบบไฟล์เดียว */
  readonly VITE_EMBED?: string
}

/** วัน-เวลาที่ build (ISO) — กำหนดใน vite.config.ts */
declare const __BUILD__: string
