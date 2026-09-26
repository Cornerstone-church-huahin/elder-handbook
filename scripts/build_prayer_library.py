"""คลังคำอธิษฐานของคริสตจักร (ผู้ใช้ให้มา) → public/data/prayer-library.json
แอปใช้เป็นแนวทางเมื่อหัวข้อที่พิมพ์ตรงกับเรื่อง: ถวายทรัพย์ · ขอบคุณอาหาร · การเงิน
ข้อความพระคัมภีร์ที่ยกไว้ในต้นฉบับถูกตัดออก เหลือข้ออ้างอิง (แอปแสดงข้อความจริงจากฉบับ 1971 เอง)"""
import json, re
src = open('scripts/src/church-prayers.txt', encoding='utf-8').read()
parts = [p.strip() for p in src.split('\n---') if p.strip()]

def clean(t: str) -> str:
    t = re.sub(r'^#+.*$', '', t, flags=re.M)          # หัวข้อ markdown
    t = re.sub(r'^\(แนะนำ.*\)$|^\(เหมาะ.*\)$', '', t, flags=re.M)
    t = t.replace('**', '').replace('***', '')
    t = re.sub(r'^\s*>\s?', '', t, flags=re.M)
    t = re.sub(r'\*+', '', t)
    t = t.replace('ทถกคน', 'ทุกคน').replace('ณ.ที่นี่', 'ณ ที่นี่').replace('น้ําพระทัย', 'น้ำพระทัย').replace('ยัดสั่น', 'ยัดสั่น')
    lines = [re.sub(r'\s+', ' ', l).strip() for l in t.split('\n')]
    out, para = [], []
    for l in lines:
        if not l:
            if para: out.append(' '.join(para)); para = []
        else: para.append(l)
    if para: out.append(' '.join(para))
    t = '\n\n'.join(out).strip().strip('"“”').strip()
    return re.sub(r'\s+"$|^"\s*', '', t)

offer = parts[0]
i = offer.index('***"ข้าแต่พระบิดาเจ้า')
invite = clean(offer[:i])
invite = re.sub(r"ในพระธรรม 1 พงศาวดาร 29 ข้อ 14\s*ได้กล่าวไว้ว่า:.*?แด่พระองค์'", 'ในพระธรรม 1 พงศาวดาร 29:14', invite, flags=re.S)
invite = re.sub(r'\(ผู้นำกล่าวเชิญชวน\)\s*', '', invite).replace('(ให้เราร่วมใจกันอธิษฐานครับ)', 'ให้เราร่วมใจกันอธิษฐานครับ').strip().strip('"').strip()
lib = {
  'source': 'คำอธิษฐานที่ผู้ปกครองคริสตจักรให้ไว้ (เก็บเป็นแนวทาง)',
  'entries': [
    {
      'id': 'offering', 'title': 'อธิษฐานนำถวายทรัพย์',
      'match': 'ถวายทรัพย์|ถวายเงิน|การถวาย|ของถวาย|ทศางค์|ท้องพระคลัง|ถวายคืน|นำถวาย|เก็บถวาย|ถวายเพื่อ',
      'invite': invite,
      'versions': [{ 'label': 'ถวายคืนสู่ท้องพระคลัง', 'text': clean(offer[i:]) }],
    },
    {
      'id': 'meal', 'title': 'อธิษฐานขอบคุณและชำระพระกระยาหาร',
      'match': 'อาหาร|กินข้าว|ทานข้าว|มื้อ|ก่อนทาน|ก่อนกิน|งานเลี้ยง|พระกระยาหาร|โต๊ะอาหาร|ขอบคุณสำหรับอาหาร',
      'versions': [
        { 'label': 'แบบที่ 1', 'text': clean(parts[1]) },
        { 'label': 'แบบที่ 2', 'text': clean(parts[2]) },
      ],
    },
    {
      'id': 'finance', 'title': 'อธิษฐานเรื่องการเงิน',
      'match': 'การเงิน|ทะลุทะลวง|มั่งคั่ง|พระพรการเงิน|ธุรกิจ|หนี้|ขัดสน|รายได้|ตกงาน|ค้าขาย|เงิน',
      'versions': [
        { 'label': 'ฉบับกระชับ (ประกาศความเชื่อทุกเช้า)', 'text': clean(parts[4]) },
        { 'label': 'ฉบับลึกซึ้ง (อธิษฐานส่วนตัว)', 'text': clean(parts[3]) },
      ],
    },
  ],
}
json.dump(lib, open('public/data/prayer-library.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for e in lib['entries']:
    print('==', e['id'], e.get('invite', '')[:300])
    for v in e['versions']: print('--', v['label'], len(v['text']), v['text'][:120].replace('\n', ' / '), '…', v['text'][-80:].replace('\n', ' / '))
