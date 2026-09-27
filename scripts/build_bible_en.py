"""World English Bible (WEB, public domain) → public/data/bible-en/<n>.json {"c": [[verse,...],...]}
ใช้เป็นฉบับภาษาอังกฤษคู่กับฉบับไทย 1971 (ไม่ใช้ AI แปล)
ที่มา: npm package world-english-bible (ข้อความ WEB เป็นสาธารณสมบัติ)
ใช้: python3 scripts/build_bible_en.py <โฟลเดอร์ json ของ world-english-bible>
"""
import json, os, re, sys
src = sys.argv[1]
NAMES = ['genesis','exodus','leviticus','numbers','deuteronomy','joshua','judges','ruth','1samuel','2samuel','1kings','2kings','1chronicles','2chronicles','ezra','nehemiah','esther','job','psalms','proverbs','ecclesiastes','songofsolomon','isaiah','jeremiah','lamentations','ezekiel','daniel','hosea','joel','amos','obadiah','jonah','micah','nahum','habakkuk','zephaniah','haggai','zechariah','malachi','matthew','mark','luke','john','acts','romans','1corinthians','2corinthians','galatians','ephesians','philippians','colossians','1thessalonians','2thessalonians','1timothy','2timothy','titus','philemon','hebrews','james','1peter','2peter','1john','2john','3john','jude','revelation']
out = 'public/data/bible-en'
os.makedirs(out, exist_ok=True)
for i, n in enumerate(NAMES, 1):
    d = json.load(open(os.path.join(src, n + '.json')))
    ch = {}
    for x in d:
        if 'chapterNumber' in x and 'verseNumber' in x and 'value' in x:
            ch.setdefault(x['chapterNumber'], {}).setdefault(x['verseNumber'], []).append(x['value'])
    c = []
    for cn in range(1, max(ch) + 1):
        vs = ch.get(cn, {})
        c.append([re.sub(r'\s+', ' ', ' '.join(vs.get(v, []))).strip() for v in range(1, (max(vs) if vs else 0) + 1)])
    json.dump({'b': n, 'c': c}, open(f'{out}/{i}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('ok')
