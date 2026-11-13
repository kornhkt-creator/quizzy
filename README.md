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

## ความปลอดภัย

- หน้าเว็บไม่อ่าน/เขียนฐานข้อมูลโดยตรง ทุกอย่างผ่าน Edge Function `api`
- `api` ตรวจ LINE ID token กับ LINE ทุกครั้ง แล้วใช้ LINE user ID ที่ยืนยันแล้วเท่านั้น
- ทุกตารางเปิด RLS โดยไม่มี policy และฟังก์ชัน `api_*` เรียกได้เฉพาะ service role
- Service role key อยู่ใน Edge Function เท่านั้น ไม่อยู่ในหน้าเว็บ

## ทดสอบ (สำหรับนักพัฒนา)

ต้องมี Node.js 22 ขึ้นไป

```bash
cd tests && npm install && npm test
```

- `sql.test.mjs` รัน `schema.sql` บน PostgreSQL จำลอง (PGlite) แล้วทดสอบทุกฟังก์ชัน
- `api.test.ts` ทดสอบ Edge Function ด้วย Deno โดยจำลอง LINE และฐานข้อมูล

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
js/api.js             เรียก server พร้อมแนบ LINE token
js/mock-api.js        server จำลองสำหรับโหมดทดลอง
js/ui.js, icons.js    ส่วนแสดงผลที่ใช้ร่วมกัน
js/student.js         หน้าจอฝั่งนักเรียน
js/teacher.js         หน้าจอฝั่งครู
supabase/schema.sql   ตาราง + ฟังก์ชันในฐานข้อมูล (รันใน SQL Editor)
supabase/functions/api/index.ts   Edge Function ตัวเดียวของระบบ
tests/                ชุดทดสอบสำหรับนักพัฒนา
assets/mascot/        ภาพน้องแต่วท่าต่าง ๆ
assets/reference/     ภาพอ้างอิงตัวละครและสไตล์ UI
mockup/index.html     Mockup ทุกหน้าจอ
docs/SETUP.md         คู่มือติดตั้ง
Prompt-Lite.md        ข้อกำหนดของโปรเจกต์ (prompt สำหรับ AI)
```

## ความคืบหน้า

- [x] Phase 0: เตรียมระบบ + Hello LINE
- [x] Phase 1: ฐานข้อมูล + ระบบผู้ใช้
- [x] Phase 2: ครูสร้างชุดสอบ
- [x] Phase 3: นักเรียนทำข้อสอบ
- [ ] Phase 4: ผลสอบ + Excel + เมนู LINE OA
