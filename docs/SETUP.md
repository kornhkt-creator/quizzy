# คู่มือติดตั้ง Quizzy Lite (ทีละขั้น)

คู่มือนี้เขียนสำหรับครูที่ไม่เคยเขียนโปรแกรม ทำตามทีละข้อได้เลยครับ

> **ลองก่อนได้ทันที:** ยังไม่ต้องตั้งค่าอะไร เปิด `index.html` (นักเรียน) หรือ `teacher.html` (ครู) จะเข้า **โหมดทดลอง** ที่ใช้ข้อมูลจำลองในเครื่อง

สิ่งที่ต้องมี: บัญชี LINE, บัญชี GitHub, อีเมลสำหรับสมัคร Vercel และ Supabase (ใช้แพ็กเกจฟรีได้ทั้งหมด)

หน้าเว็บของ LINE, Vercel และ Supabase อาจเปลี่ยนชื่อเมนูหรือตำแหน่งปุ่มได้ ถ้าหาไม่เจอให้มองหาคำที่ใกล้เคียงครับ

---

## ขั้นที่ 1: เอาโค้ดขึ้น GitHub

ถ้าโค้ดอยู่ใน GitHub แล้ว ข้ามขั้นนี้ได้

1. สร้าง repository ใหม่ใน GitHub (เช่นชื่อ `quizzy`)
2. ในโฟลเดอร์โปรเจกต์ รันคำสั่ง (เปลี่ยน URL เป็นของตัวเอง)

```bash
git remote add origin https://github.com/<ชื่อผู้ใช้>/quizzy.git
```

```bash
git push -u origin main
```

---

## ขั้นที่ 2: เปิดเว็บด้วย Vercel

1. ไปที่ https://vercel.com แล้วสมัครด้วยบัญชี GitHub
2. กด **Add New… → Project** แล้วเลือก repository `quizzy` กด **Import**
3. Framework Preset เลือก **Other** ไม่ต้องตั้งค่า Build อะไรเพิ่ม กด **Deploy**
4. เสร็จแล้วจะได้ URL เช่น `https://quizzy-xxxx.vercel.app` **จดไว้**
5. เปิด URL นั้นในเบราว์เซอร์ ควรเห็นหน้าต้อนรับน้องแต่ว (โหมดทดลอง)

ทุกครั้งที่ push โค้ดใหม่ขึ้น GitHub, Vercel จะอัปเดตเว็บให้อัตโนมัติ

---

## ขั้นที่ 3: สร้างแอปใน LINE Developers

1. ไปที่ https://developers.line.biz/console/ แล้ว login ด้วยบัญชี LINE
2. กด **Create a new provider** ตั้งชื่อ เช่น ชื่อโรงเรียน
3. ใน provider นั้น กด **Create a new channel** เลือก **LINE Login**
   - Region: **Thailand**
   - Channel name: `Quizzy`
   - Channel icon: ใช้ไฟล์ `assets/mascot/icon.png`
   - App types: เลือก **Web app**
   - กรอกอีเมลแล้วยอมรับเงื่อนไข กด **Create**
4. แท็บ **Basic settings**: จด **Channel ID** ไว้ (ใช้ในขั้นที่ 5)
5. แท็บ **LIFF** กด **Add**
   - LIFF app name: `Quizzy`
   - Size: **Full**
   - Endpoint URL: URL จาก Vercel เช่น `https://quizzy-xxxx.vercel.app/` (**ต้องเป็นหน้าแรกของโดเมน** เพื่อให้หน้าครูใช้ LIFF ตัวเดียวกันได้)
   - Scopes: ติ๊ก **openid** และ **profile**
   - Bot link feature: **Off** (หรือ On ถ้าจะผูกกับ LINE OA)
   - กด **Add** แล้วจด **LIFF ID** (หน้าตาแบบ `2001234567-AbCdEfGh`) และ **LIFF URL** (`https://liff.line.me/...`)
6. ที่หัว channel เปลี่ยนสถานะจาก **Developing** เป็น **Published** ไม่อย่างนั้นนักเรียนที่ไม่ใช่ผู้ดูแล channel จะเข้าไม่ได้

> ถ้า LINE Developers ไม่ให้เพิ่ม LIFF ใน LINE Login channel แล้ว ให้สร้าง channel แบบ **LINE MINI App** แทน ขั้นตอนคล้ายกัน: Endpoint URL อยู่ในแท็บ Web app settings และต้องเผยแพร่ MINI App ก่อนนักเรียนจึงเข้าได้

---

## ขั้นที่ 4: ใส่ LIFF ID ในโค้ด

1. เปิดไฟล์ `js/config.js`
2. ใส่ LIFF ID ที่ได้จากขั้นที่ 3

```js
LIFF_ID: '2001234567-AbCdEfGh',
```

3. บันทึกไฟล์ไว้ก่อน แล้วทำขั้นที่ 5–7 ต่อ (ระบบจะใช้งานจริงเมื่อใส่ครบทั้ง `LIFF_ID` และ `API_URL` ถ้าใส่ไม่ครบจะยังเป็นโหมดทดลอง)
4. เมื่อตั้งค่าครบแล้ว ส่ง **LIFF URL** เข้าแชต LINE ของตัวเอง แล้วกดเปิดบนมือถือ ควรเห็นชื่อและรูปโปรไฟล์ LINE ของคุณในหน้าลงทะเบียน

ถ้าอยากดูโหมดทดลองหลังตั้งค่าครบแล้ว ให้เติม `?demo` ท้าย URL เช่น `https://quizzy-xxxx.vercel.app/?demo`

---

## ขั้นที่ 5: สร้างฐานข้อมูลด้วย Supabase

1. ไปที่ https://supabase.com กด **Start your project** แล้วสมัคร (ใช้บัญชี GitHub ได้)
2. กด **New project**
   - Name: `quizzy`
   - Database Password: ตั้งรหัสผ่านแล้ว **จดเก็บไว้ในที่ปลอดภัย**
   - Region: **Southeast Asia (Singapore)** (ใกล้ไทยที่สุด)
   - กด **Create new project** แล้วรอประมาณ 2 นาที
3. เมนูซ้าย **SQL Editor** → **New query**
   - เปิดไฟล์ `supabase/schema.sql` คัดลอก **ทั้งไฟล์** มาวาง แล้วกด **Run**
   - ควรขึ้น `Success. No rows returned`
   - ทุกครั้งที่ได้โค้ดเวอร์ชันใหม่ ให้รันไฟล์นี้ซ้ำได้เลย ข้อมูลเดิมไม่หาย

## ขั้นที่ 6: สร้าง Edge Function ชื่อ `api`

1. เมนูซ้าย **Edge Functions** → **Deploy a new function** → **Via Editor**
2. ตั้งชื่อ function ว่า `api` (ตัวพิมพ์เล็ก)
3. ลบโค้ดตัวอย่างออกให้หมด เปิดไฟล์ `supabase/functions/api/index.ts` คัดลอก **ทั้งไฟล์** มาวาง แล้วกด **Deploy**
4. เข้าไปที่ function `api` → แท็บ **Details** (หรือ Settings) → **ปิด** ตัวเลือก **Verify JWT** (Enforce JWT verification) แล้วกด Save
   - ต้องปิด เพราะระบบตรวจตัวตนด้วย LINE token เอง
5. ไปที่ **Edge Functions → Secrets** (หรือ Project Settings → Edge Functions) → **Add new secret**
   - Name: `LINE_CHANNEL_ID`
   - Value: Channel ID ที่จดไว้ในขั้นที่ 3
6. กลับไปที่ function `api` คัดลอก **URL** ของ function เช่น `https://abcdxyz.supabase.co/functions/v1/api`

ทุกครั้งที่โค้ดใน `index.ts` เปลี่ยน ให้วางโค้ดใหม่แล้วกด Deploy อีกครั้ง

## ขั้นที่ 7: ใส่ URL ของ api ในโค้ด

1. เปิด `js/config.js` ใส่ URL จากขั้นที่ 6

```js
API_URL: 'https://abcdxyz.supabase.co/functions/v1/api',
```

2. commit และ push ขึ้น GitHub รอ Vercel อัปเดต

เมื่อใส่ทั้ง `LIFF_ID` และ `API_URL` แล้ว ระบบจะออกจากโหมดทดลองและใช้ข้อมูลจริงทันที

## ขั้นที่ 8: ตั้งตัวเองเป็นครู (ทำครั้งเดียว)

1. บนคอมพิวเตอร์ เปิด `https://quizzy-xxxx.vercel.app/teacher.html` แล้ว login ด้วย LINE
2. จะขึ้นว่า **"หน้านี้สำหรับครูเท่านั้น"** (เพราะบัญชีใหม่ทุกบัญชีเป็นนักเรียน)
3. ใน Supabase เมนู **Table Editor** → ตาราง **profiles** → หาแถวที่ `display_name` เป็นชื่อ LINE ของคุณ
4. ดับเบิลคลิกช่อง `role` เปลี่ยนเป็น `teacher` แล้วกด Save
5. กลับมาหน้าครู กด **ตั้งค่าแล้ว โหลดใหม่** แล้วตั้งชื่อครู

> ครูควรเปิด `teacher.html` ก่อน ไม่ต้องลงทะเบียนเป็นนักเรียนในหน้า LINE Mini App

### ตรวจว่า Phase 1 ใช้ได้

- [ ] เปิด LIFF URL ในมือถือ ลงทะเบียนชื่อและรหัสนักเรียนได้
- [ ] ปิดแล้วเปิดใหม่ ระบบจำได้ ไม่ต้องลงทะเบียนซ้ำ
- [ ] ใน Table Editor เห็นแถวของนักเรียนในตาราง `profiles`
- [ ] บัญชีนักเรียนเปิด `teacher.html` แล้วขึ้นว่า "สำหรับครูเท่านั้น"
- [ ] บัญชีครูเข้า `teacher.html` ได้

### แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| ขึ้น "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ID" | ยังไม่ได้เพิ่ม secret ในขั้นที่ 6 ข้อ 5 |
| เปิดแอปแล้ว login วนไม่จบ | Channel ID ใน secret ไม่ตรงกับ channel ที่มี LIFF นี้ |
| ขึ้น "เชื่อมต่ออินเทอร์เน็ตไม่ได้" ทั้งที่เน็ตปกติ | `API_URL` ผิด หรือยังไม่ได้ปิด Verify JWT |
| ขึ้น "เกิดข้อผิดพลาดในระบบ" | ยังไม่ได้รัน `schema.sql` หรือรันไม่ครบ ดู log ได้ที่ Edge Functions → api → Logs |

---

## เมื่อได้โค้ดเวอร์ชันใหม่ (เช่น จบแต่ละ Phase)

1. รัน `supabase/schema.sql` ทั้งไฟล์ใน SQL Editor อีกครั้ง (ข้อมูลเดิมไม่หาย)
2. วางโค้ด `supabase/functions/api/index.ts` ใหม่ใน Edge Function `api` แล้วกด Deploy
3. push โค้ดขึ้น GitHub ให้ Vercel อัปเดตหน้าเว็บ

### ตรวจว่า Phase 2 ใช้ได้ (ครูสร้างชุดสอบ)

- [ ] ในหน้าครู กด **สร้างชุดสอบ** ตั้งชื่อ เวลา และเพิ่มข้อสอบ 5 ข้อ แล้วกดบันทึกได้
- [ ] ลองเว้นคำถามว่างไว้ 1 ข้อแล้วบันทึก ระบบต้องบอกว่าข้อไหนผิด และไม่บันทึกข้อสอบเลยสักข้อ
- [ ] กด **เผยแพร่** สถานะเปลี่ยนเป็น "เปิดสอบอยู่"
- [ ] ตั้งเวลาเปิดสอบเป็นวันพรุ่งนี้ สถานะเป็น "ยังไม่ถึงเวลาเปิด"
