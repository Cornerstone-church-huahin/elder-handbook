import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base './' ทำให้ build เปิดได้ทั้งบนโดเมนหลักและในโฟลเดอร์ย่อย
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'คู่มือผู้ปกครองคริสตจักร · Church Elder\'s Handbook',
        short_name: 'คู่มือผู้ปกครอง',
        description: 'คู่มืออภิบาล พระวจนะ และพันธกิจคริสตจักร สำหรับผู้ปกครองและผู้นำฝ่ายวิญญาณ',
        lang: 'th',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#F9F8F5',
        theme_color: '#1A2B4C',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // cache เฉพาะตัวแอปและฟอนต์
        // ห้ามเพิ่ม runtimeCaching สำหรับ API ข้อมูลสมาชิก/การเยี่ยม (ต้องออนไลน์เท่านั้น)
        globPatterns: ['**/*.{js,css,html,svg,png,json}'], // รวมระเบียบปฏิบัติฯ (json) ให้อ่านได้แม้ออฟไลน์
        // พระคัมภีร์ทั้งเล่ม (~11MB) ไม่โหลดล่วงหน้า — เก็บไว้ในเครื่องเฉพาะเล่มที่เปิดอ่านแล้ว
        globIgnores: ['**/data/bible/**'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /\/data\/bible\/\d+\.json$/,
            handler: 'CacheFirst',
            options: { cacheName: 'bible-th1971', expiration: { maxEntries: 70 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
})
