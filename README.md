# Quizzy Lite

**สนุกกับการสอบ เก่งขึ้นทุกวัน!** ระบบสอบออนไลน์ผ่าน LINE สำหรับห้องเรียน มีน้องแต่วเป็นเพื่อนคู่ใจ

ครูสร้างชุดข้อสอบปรนัย นักเรียนเปิดผ่าน LINE ทำข้อสอบแล้วรู้คะแนนทันที ครูดูผลสอบและ export เป็น Excel ได้

## ลองใช้ทันที (โหมดทดลอง)

ยังไม่ต้องตั้งค่าอะไร เปิดผ่านเว็บเซิร์ฟเวอร์ในเครื่อง (เช่น VS Code Live Server หรือคำสั่งด้านล่าง) แล้วเข้า `index.html` (นักเรียน) หรือ `teacher.html` (ครู)

```bash
python -m http.server 8000
```

โหมดทดลองใช้ข้อมูลจำลองที่เก็บในเบราว์เซอร์เครื่องนั้นเท่านั้น ไม่เชื่อมต่อ LINE หรือฐานข้อมูลจริง

## ติดตั้งใช้งานจริง

ทำตาม [docs/SETUP.md](docs/SETUP.md) ทีละขั้น (GitHub → Vercel → LINE Developers → Supabase)

## เทคโนโลยี

- HTML, CSS, Vanilla JavaScript (ES Modules) ไม่มี build step ไม่ใช้ npm
- LINE LIFF SDK v2, ฟอนต์ Kanit, SheetJS (โหลดจาก CDN)
- Supabase PostgreSQL + Edge Function ตัวเดียวชื่อ `api`
- Vercel สำหรับเปิดเว็บ

## โครงสร้างโปรเจกต์

```
index.html            หน้านักเรียน (LINE Mini App)
teacher.html          หน้าครู
css/style.css         Design system
js/config.js          LIFF ID และ URL ของ api
js/line.js            เชื่อมต่อ LINE (LIFF)
js/ui.js, icons.js    ส่วนแสดงผลที่ใช้ร่วมกัน
js/student.js         หน้าจอฝั่งนักเรียน
assets/mascot/        ภาพน้องแต่วท่าต่าง ๆ
assets/reference/     ภาพอ้างอิงตัวละครและสไตล์ UI
mockup/index.html     Mockup ทุกหน้าจอ
docs/SETUP.md         คู่มือติดตั้ง
Prompt-Lite.md        ข้อกำหนดของโปรเจกต์ (prompt สำหรับ AI)
```

## ความคืบหน้า

- [x] Phase 0: เตรียมระบบ + Hello LINE
- [ ] Phase 1: ฐานข้อมูล + ระบบผู้ใช้
- [ ] Phase 2: ครูสร้างชุดสอบ
- [ ] Phase 3: นักเรียนทำข้อสอบ
- [ ] Phase 4: ผลสอบ + Excel + เมนู LINE OA
