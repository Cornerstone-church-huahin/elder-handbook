"""แยกพระคัมภีร์ไทย ฉบับ 1971 (TH1971) เป็นไฟล์ JSON รายเล่ม → public/data/bible/<n>.json
ที่มา: Beblia/Holy-Bible-XML-Format (Thai1971Bible.xml) ตรงกับ bible.com/bible/275 (TH1971)
ข้อความพระคัมภีร์มาจากแหล่งนี้เท่านั้น — แอปไม่ให้ AI เขียนหรือแปลข้อพระคัมภีร์
ใช้: python3 scripts/build_bible.py path/to/Thai1971Bible.xml"""
import json, os, sys, xml.etree.ElementTree as ET
src = sys.argv[1]
out = 'public/data/bible'
os.makedirs(out, exist_ok=True)
root = ET.parse(src).getroot()
n = 0
for book in root.iter('book'):
    num = int(book.get('number'))
    chapters = []
    for ch in book.findall('chapter'):
        c = int(ch.get('number'))
        while len(chapters) < c: chapters.append([])
        verses = chapters[c - 1]
        for v in ch.findall('verse'):
            i = int(v.get('number'))
            while len(verses) < i: verses.append('')
            verses[i - 1] = ' '.join((v.text or '').split())
            n += 1
    with open(f'{out}/{num}.json', 'w', encoding='utf-8') as f:
        json.dump({'b': num, 'c': chapters}, f, ensure_ascii=False, separators=(',', ':'))
print('books', len(os.listdir(out)), 'verses', n)
