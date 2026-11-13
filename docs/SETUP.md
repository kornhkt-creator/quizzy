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

3. บันทึกไฟล์ แล้ว commit และ push ขึ้น GitHub รอ Vercel อัปเดตประมาณ 1 นาที
4. ส่ง **LIFF URL** เข้าแชต LINE ของตัวเอง แล้วกดเปิดบนมือถือ ควรเห็น **"สวัสดีครับ {ชื่อ LINE}"** พร้อมรูปโปรไฟล์

ถ้าอยากดูโหมดทดลองหลังใส่ LIFF ID แล้ว ให้เติม `?demo` ท้าย URL เช่น `https://quizzy-xxxx.vercel.app/?demo`
