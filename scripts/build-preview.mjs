// สร้างไฟล์พรีวิวไฟล์เดียว (HTML + CSS + JS รวมกัน) สำหรับเปิดในแผงพรีวิว / แชร์ดู
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
process.env.VITE_EMBED = '1'
const out = 'dist-preview'
await build({
  configFile: false, base: './', plugins: [react()],
  build: { outDir: out, emptyOutDir: true, modulePreload: false, cssCodeSplit: false, rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } } },
})
const dir = path.join(out, 'assets')
const files = fs.readdirSync(dir)
const css = fs.readFileSync(path.join(dir, files.find(f => f.endsWith('.css'))), 'utf8')
const js = fs.readFileSync(path.join(dir, files.find(f => f.endsWith('.js'))), 'utf8').replace(/<\/script/g, '<\\/script').replace(/"<script>/g, '"\\x3cscript>').replace(/"<svg>"/g, '"\\x3csvg>"').replace(/"<\/svg>"/g, '"\\x3c/svg>"')
// ตัวแจ้งปัญหา: ถ้าแอปโหลดไม่ขึ้น จะแสดงสาเหตุบนหน้าจอแทนหน้าว่าง
const guard = `<script>(function(){function show(m){var r=document.getElementById('root');if(!r)return;r.innerHTML='<div style="padding:20px;font:16px sans-serif;color:#1a2b4c;background:#fff4d6;border:2px solid #a77b00;border-radius:12px;margin:16px"><b>แอปโหลดไม่สำเร็จ</b><br>กรุณาถ่ายภาพหน้าจอนี้ส่งให้ผู้พัฒนา<br><code style="word-break:break-all;font-size:13px"></code></div>';r.querySelector('code').textContent=String(m).slice(0,400)}window.addEventListener('error',function(e){if(e.target&&e.target.tagName==='SCRIPT'){show('script file blocked: '+e.target.src);return}show(e.message||e.error)},true);window.addEventListener('unhandledrejection',function(e){show(e.reason&&(e.reason.message||e.reason.code)||e.reason)});setTimeout(function(){var r=document.getElementById('root');if(r&&r.getAttribute('data-booting')!==null&&!document.querySelector('.app'))show('timeout: script did not start')},8000)})();<\/script>`
const html = `<!doctype html>
<html lang="th"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>คทาผู้เลี้ยง</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pridi:wght@500;600&family=Sarabun:wght@400;500;700&display=swap">
<style>${css}</style></head>
<body>${guard}<div id="root" data-booting><p style="padding:24px;font:18px sans-serif;color:#1a2b4c;background:#f9f8f5">กำลังเปิดคทาผู้เลี้ยง…</p></div><script>${js}</script></body></html>
`
fs.writeFileSync('preview.html', html)

// ชุดสำหรับเผยแพร่เป็น Artifact: หน้า HTML (ไม่มี doctype/head เพราะระบบห่อให้) + ไฟล์สคริปต์แยก
fs.mkdirSync('artifact', { recursive: true })
// แปลงอักษรไทยเป็น \\uXXXX เพื่อไม่ขึ้นกับ charset ที่เซิร์ฟเวอร์ส่งมา
const asciiJs = js.replace(/[\u0080-\uffff]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
fs.writeFileSync('artifact/app.js', asciiJs)
const page = `<title>คทาผู้เลี้ยง</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pridi:wght@500;600&family=Sarabun:wght@400;500;700&display=swap">
<style>${css}</style>
${guard}<div id="root" data-booting><p style="padding:24px;font:18px sans-serif;color:#1a2b4c;background:#f9f8f5">กำลังเปิดคทาผู้เลี้ยง…</p></div>
<script src="app.js"></script>
`
fs.writeFileSync('artifact/index.html', page)
console.log('preview.html', (html.length / 1024).toFixed(0), 'KB')
