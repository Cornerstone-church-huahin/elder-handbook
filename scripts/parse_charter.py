"""แยกข้อความ "ระเบียบปฏิบัติของธรรมนูญคริสตจักรภาค 7 (ฉบับ ค.ศ. 2021)" จาก PDF เป็น JSON รายข้อ

ใช้:  python3 scripts/parse_charter.py <charter.pdf> public/data/charter-bylaws-2021.json

- ข้อความต้นฉบับเก็บตามที่พิมพ์ในเอกสาร (รวมคำพิมพ์ผิดในต้นฉบับ) ไม่แก้ถ้อยคำ
- ต่อบรรทัดที่ถูกตัดโดยหน้ากระดาษให้เป็นย่อหน้าเดียว แต่ขึ้นบรรทัดใหม่ที่ข้อย่อย เช่น 3.1 หรือ (1)
- เลขหน้าคือเลขหน้าที่พิมพ์ในเอกสาร (หน้า PDF - 1)
"""
import json, re, subprocess, sys

pdf, out = sys.argv[1], sys.argv[2]
n_pages = int(re.search(r'Pages:\s+(\d+)', subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout).group(1))

FOOTER = re.compile(r'^(ระเบียบปฏิบ.?ต.?\s*.?ธ.?\s*รรมนูญคริสตจักรภาค 7|หน้า\s*\d+)$')
ART = re.compile(r'^(?:ข้อ|ช้อ)\s*(\d+)\s*(.*)$')
CHAP = re.compile(r'^หมวด\s*(\d+)\s*(.*)$')
PART = re.compile(r'^ส่วนที่\s*(\d+)\s*(.*)$')
SUB = re.compile(r'^(\d+\.\d+|\(\d+\))\s')
THAI = re.compile(r'[฀-๿]')

# ข้อความท้ายหน้า (header/footer) ที่ pdftotext -raw บางครั้งต่อติดท้ายบรรทัดเนื้อหา
INLINE_FOOTER = re.compile(r'\s*ระเบียบปฏิบ\S*\s*\S*รรมนูญคริสตจักรภาค 7\s*หน้า\s*\d+\s*$')
lines = []  # (printed_page, text)
for i in range(3, n_pages + 1):  # หน้า 1-2 ของ PDF คือปกและสารบัญ
    txt = subprocess.run(['pdftotext', '-raw', '-f', str(i), '-l', str(i), pdf, '-'], capture_output=True, text=True).stdout
    for ln in txt.splitlines():
        ln = INLINE_FOOTER.sub('', ln).strip()  # ท้ายหน้าที่ต่อติดกับบรรทัดเนื้อหา
        if ln and not FOOTER.match(ln):
            lines.append((i - 1, ln))

# ส่วนหัวเอกสาร (ก่อนหมวด 1) = คำนำ/การรับรอง
preamble, idx = [], 0
while idx < len(lines) and not CHAP.match(lines[idx][1]):
    preamble.append(lines[idx][1]); idx += 1

def join(parts):
    """ต่อบรรทัดที่ตัดกลางประโยค: ภาษาไทยต่อกันไม่เว้นวรรค, อย่างอื่นเว้นวรรค, ข้อย่อยขึ้นบรรทัดใหม่"""
    out = ''
    for p in parts:
        if not out:
            out = p
        elif SUB.match(p):
            out += '\n' + p
        elif THAI.search(out[-1:]) and THAI.search(p[:1]):
            out += p
        else:
            out += ' ' + p
    return out

chapters, articles = [], []
chap = part = None
cur = None
pending_title = None  # 'chapter' | 'part' เมื่อชื่อหมวด/ส่วนอยู่บรรทัดถัดไป
appendix = []
in_appendix = False

for page, ln in lines[idx:]:
    if in_appendix:
        appendix.append(ln); continue
    if ln.startswith('เอกสารแนบท้าย'):
        in_appendix = True; appendix.append(ln); continue
    if ln == 'บทเฉพาะกาล':
        chap = {'no': 'transitional', 'title': 'บทเฉพาะกาล', 'parts': []}
        chapters.append(chap); part = None; cur = None; continue
    m = CHAP.match(ln)
    if m and not ART.match(ln):
        chap = {'no': m.group(1), 'title': m.group(2).strip(), 'parts': []}
        chapters.append(chap); part = None; cur = None
        pending_title = 'chapter' if not chap['title'] else None
        continue
    m = PART.match(ln)
    if m:
        part = {'no': m.group(1), 'title': m.group(2).strip()}
        chap['parts'].append(part); cur = None
        pending_title = 'part' if not part['title'] else None
        continue
    if pending_title and not ART.match(ln):
        (chap if pending_title == 'chapter' else part)['title'] = ln
        pending_title = None
        continue
    pending_title = None
    m = ART.match(ln)
    if m:
        cur = {
            'no': int(m.group(1)),
            'chapter': chap['no'], 'part': part['no'] if part else None,
            'page_start': page, 'page_end': page,
            '_lines': [ln],
        }
        articles.append(cur); continue
    if cur is None:
        raise SystemExit(f'ข้อความไม่อยู่ในข้อใด (หน้า {page}): {ln}')
    cur['_lines'].append(ln); cur['page_end'] = page

for a in articles:
    a['text'] = join(a.pop('_lines'))
    assert 'รรมนูญคริสตจักรภาค 7 หน้า' not in a['text'], a['no']

nums = [a['no'] for a in articles]
missing = sorted(set(range(1, max(nums) + 1)) - set(nums))
dupes = sorted({n for n in nums if nums.count(n) > 1})

doc = {
    'document_id': 'bylaws-region7-2021',
    'title': 'ระเบียบปฏิบัติของธรรมนูญคริสตจักรภาค 7 แห่งสภาคริสตจักรในประเทศไทย',
    'version': 'ฉบับ ค.ศ. 2021',
    'effective': 'มีผลบังคับใช้ตั้งแต่ 1 พฤษภาคม ค.ศ. 2021',
    'source_file': 'ระเบียบปฏิบัติธรรมนูญคริสตจักรภาค 7 2021 FINAL.pdf',
    'preamble': join(preamble),
    'chapters': chapters,
    'articles': articles,
    'appendix_note': 'เอกสารแนบท้าย: ตารางการคำนวณจำนวนคณะกรรมการดำเนินงาน (อ้างถึงในข้อ 112 และ 115) — ดูตารางในไฟล์ PDF ต้นฉบับหน้าสุดท้าย',
}
with open(out, 'w', encoding='utf-8') as f:
    json.dump(doc, f, ensure_ascii=False, indent=1)
print(f'chapters={len(chapters)} articles={len(articles)} missing={missing} duplicates={dupes}')
for c in chapters:
    print(' หมวด', c['no'], c['title'], '|', '; '.join(f"ส่วนที่ {p['no']} {p['title']}" for p in c['parts']))
