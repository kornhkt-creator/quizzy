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

> **อยากใช้ Netlify แทน Vercel?** ทำได้ ดู [ภาคผนวก: ใช้ Netlify แทน Vercel](#ภาคผนวก-ใช้-netlify-แทน-vercel) ท้ายคู่มือ แล้วใช้ URL ของ Netlify แทน URL ของ Vercel ในทุกขั้น

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

3. บันทึกไฟล์ไว้ก่อน แล้วทำขั้นที่ 5–7 ต่อ (พอใส่ `LIFF_ID` แล้ว push ระบบจะออกจากโหมดทดลอง จึงควรทำขั้นที่ 5–6 ให้เสร็จก่อน push)
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

## ขั้นที่ 6: ใส่ค่าลับใน Vercel (Environment Variables)

ระบบมี server ตัวเดียวคือไฟล์ `api/index.js` ซึ่ง Vercel เปิดให้อัตโนมัติที่ `https://quizzy-xxxx.vercel.app/api` ไม่ต้องสร้าง function ใน Supabase

1. หาค่า 3 ตัวนี้มาก่อน
   - **LINE_CHANNEL_ID**: Channel ID จากขั้นที่ 3
   - **SUPABASE_URL**: Supabase → **Project Settings → API Keys** → Project URL เช่น `https://abcdxyz.supabase.co`
   - **SUPABASE_SERVICE_ROLE_KEY**: หน้าเดียวกัน → **Secret keys** → คัดลอก key `sb_secret_...` (ถ้าไม่มี ใช้ `service_role` key ในแท็บ Legacy)
2. เปิดไฟล์ `.env.example` ในโฟลเดอร์โปรเจกต์ คัดลอกเป็นไฟล์ชื่อ `.env` แล้วกรอกค่าหลังเครื่องหมาย `=` ให้ครบ
   - ไฟล์ `.env` ถูกกันไว้ไม่ให้ขึ้น GitHub แล้ว **ห้ามใส่ค่าจริงในไฟล์ `.env.example`**
3. Vercel → เลือกโปรเจกต์ → **Settings → Environment Variables**
   - กด **Import .env** แล้วเลือกไฟล์ `.env` (หรือคัดลอกเนื้อหาทั้งไฟล์ไปวางในช่อง Key ระบบจะแยกให้เอง)
   - Environments: **Production and Preview**
   - ที่ `SUPABASE_SERVICE_ROLE_KEY` เปิด **Sensitive** (ไอคอนแม่กุญแจ) ไว้ แล้วกด **Save**
4. ไปที่แท็บ **Deployments** → กด **⋯** ที่รายการล่าสุด → **Redeploy** (ค่าที่เพิ่มใหม่จะใช้ได้หลัง deploy ใหม่เท่านั้น)

> secret key ใช้ได้เฉพาะใน Vercel เท่านั้น **ห้าม**ใส่ใน `js/config.js` หรือไฟล์ใดที่ขึ้น GitHub

## ขั้นที่ 7: push โค้ดแล้วตรวจ api

1. commit และ push `js/config.js` ที่ใส่ `LIFF_ID` แล้วขึ้น GitHub รอ Vercel อัปเดต
2. `API_URL` ใน `js/config.js` ตั้งเป็น `'/api'` ไว้แล้ว ไม่ต้องแก้
3. ตรวจว่า api ทำงาน: เปิด `https://quizzy-xxxx.vercel.app/api` ในเบราว์เซอร์ ควรเห็น `{"ok":false,"error":"method_not_allowed"}` (แปลว่า server ทำงานแล้ว ถ้าขึ้น 404 แปลว่า api ยังไม่ขึ้น)

ไฟล์ `vercel.json` ตั้งให้ api รันที่สิงคโปร์ (`sin1`) ใกล้ Supabase จะได้ตอบเร็ว ถ้าสร้าง Supabase ไว้ region อื่นให้แก้ให้ตรงกัน

## ขั้นที่ 8: สร้างบัญชีครู

หน้าครู (`teacher.html`) เข้าได้ 2 วิธี เลือกวิธีใดวิธีหนึ่งหรือใช้ทั้งสองแบบก็ได้

| วิธี | เหมาะกับ |
|---|---|
| **A. อีเมล + รหัสผ่าน** (แนะนำ) | ครูใช้บนคอมพิวเตอร์ และตอนทดสอบ: ครูใช้บัญชีอีเมล นักเรียนใช้ LINE แยกกัน ไม่ชนกัน |
| **B. LINE** | ไม่อยากสร้างบัญชีเพิ่ม แต่ LINE หนึ่งบัญชีเป็นได้แค่ครูหรือนักเรียนอย่างใดอย่างหนึ่ง |

ไม่ว่าวิธีไหน บัญชีใหม่ทุกบัญชีเริ่มเป็น**นักเรียน**เสมอ ต้องตั้งเป็นครูใน Supabase ก่อน (ข้อ 8.3) ระบบจึงปลอดภัยแม้มีคนอื่นได้บัญชีไป

### 8.1 วิธี A: สร้างบัญชีครูแบบอีเมล

1. Supabase → **Authentication → Users → Add user → Create new user**
   - ใส่อีเมลและรหัสผ่านของครู ติ๊ก **Auto Confirm User** แล้วกด Create
   - สร้างกี่บัญชีก็ได้ เช่น `kru.somsri@school.ac.th`, `test.teacher@school.ac.th`
2. **ปิดการสมัครเอง (แนะนำ):** Authentication → **Sign In / Providers** (หรือ Providers → Email) → ปิด **Allow new users to sign up** แล้วกด Save
   - เพื่อให้มีแค่บัญชีที่ผู้ดูแลสร้างเท่านั้น
3. Supabase → **Project Settings → API Keys** คัดลอก **Project URL** และ **Publishable key** (ถ้าไม่มีให้ใช้ `anon` `public` key) ใส่ใน `js/config.js`

```js
SUPABASE_URL: 'https://abcdxyz.supabase.co',
SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_xxxxxxxx',
```

   > **ห้าม**ใส่ `secret` key หรือ `service_role` key ในไฟล์นี้เด็ดขาด

4. commit และ push แล้วเปิด `https://quizzy-xxxx.vercel.app/teacher.html` จะเห็นช่องอีเมลและรหัสผ่าน
5. ถ้าครูลืมรหัสผ่าน ผู้ดูแลตั้งใหม่ได้ที่ Authentication → Users → เลือกบัญชี

### 8.2 วิธี B: ใช้บัญชี LINE

บนคอมพิวเตอร์ เปิด `teacher.html` แล้วกด **เข้าสู่ระบบด้วย LINE**

> ถ้าใช้วิธีนี้ ครูไม่ควรลงทะเบียนเป็นนักเรียนในหน้า LINE Mini App ด้วยบัญชีเดียวกัน

### 8.3 ตั้งบัญชีเป็นครู (ทำครั้งเดียวต่อบัญชี)

1. Login หน้าครูครั้งแรก จะขึ้นว่า **"หน้านี้สำหรับครูเท่านั้น"**
2. Supabase → **Table Editor** → ตาราง **profiles** → หาแถวที่ `display_name` เป็นอีเมลของครู (วิธี A) หรือชื่อ LINE (วิธี B)
3. ดับเบิลคลิกช่อง `role` เปลี่ยนเป็น `teacher` แล้วกด Save
4. กลับมาหน้าครู กด **ตั้งค่าแล้ว โหลดใหม่** แล้วตั้งชื่อครู

ออกจากระบบได้ที่ไอคอนข้างชื่อครูด้านล่างของแถบเมนู ควรกดทุกครั้งที่ใช้คอมพิวเตอร์ร่วมกับคนอื่น

### ตรวจว่า Phase 1 ใช้ได้

- [ ] เปิด LIFF URL ในมือถือ ลงทะเบียนชื่อและรหัสนักเรียนได้
- [ ] ปิดแล้วเปิดใหม่ ระบบจำได้ ไม่ต้องลงทะเบียนซ้ำ
- [ ] ใน Table Editor เห็นแถวของนักเรียนในตาราง `profiles`
- [ ] บัญชีนักเรียนเปิด `teacher.html` แล้วขึ้นว่า "สำหรับครูเท่านั้น"
- [ ] บัญชีครูเข้า `teacher.html` ได้ (ด้วยอีเมลหรือ LINE) และกดออกจากระบบได้

### แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| ขึ้น "ยังไม่ได้ตั้งค่า ... ใน Vercel" | ยังไม่ได้ใส่ Environment Variables ในขั้นที่ 6 หรือใส่แล้วแต่ยังไม่ได้ Redeploy |
| เปิดแอปแล้ว login วนไม่จบ | `LINE_CHANNEL_ID` ใน Vercel ไม่ตรงกับ channel ที่มี LIFF นี้ |
| ขึ้น "เกิดข้อผิดพลาด" ทุกหน้า และเปิด `/api` แล้วขึ้น 404 | ไฟล์ `api/index.js` หรือ `package.json` ไม่ได้ขึ้น GitHub ตรวจว่า push ครบ |
| ขึ้น "เกิดข้อผิดพลาดในระบบ" | ยังไม่ได้รัน `schema.sql` หรือรันไม่ครบ หรือ secret key ผิด ดู log ได้ที่ Vercel → โปรเจกต์ → **Logs** |

---

## เมื่อได้โค้ดเวอร์ชันใหม่ (เช่น จบแต่ละ Phase)

1. รัน `supabase/schema.sql` ทั้งไฟล์ใน SQL Editor อีกครั้ง (ข้อมูลเดิมไม่หาย)
2. push โค้ดขึ้น GitHub ให้ Vercel อัปเดตทั้งหน้าเว็บและ api

> ถ้าเคยติดตั้งเวอร์ชันที่ใช้ Supabase Edge Function มาก่อน: ทำขั้นที่ 6 ให้เสร็จ แล้วลบ function `api` ใน Supabase → Edge Functions ทิ้งได้เลย

### ตรวจว่า Phase 2 ใช้ได้ (ครูสร้างชุดสอบ)

- [ ] ในหน้าครู กด **สร้างชุดสอบ** ตั้งชื่อ เวลา และเพิ่มข้อสอบ 5 ข้อ แล้วกดบันทึกได้
- [ ] ลองเว้นคำถามว่างไว้ 1 ข้อแล้วบันทึก ระบบต้องบอกว่าข้อไหนผิด และไม่บันทึกข้อสอบเลยสักข้อ
- [ ] กด **เผยแพร่** สถานะเปลี่ยนเป็น "เปิดสอบอยู่"
- [ ] ตั้งเวลาเปิดสอบเป็นวันพรุ่งนี้ สถานะเป็น "ยังไม่ถึงเวลาเปิด"

### ตรวจว่า Phase 3 ใช้ได้ (นักเรียนทำข้อสอบ)

ใช้มือถือที่ลงทะเบียนเป็นนักเรียน และชุดสอบที่เผยแพร่แล้วจาก Phase 2

- [ ] หน้าแรกเห็นชุดสอบที่เปิดอยู่ กด **เริ่มสอบ** แล้วทำจนส่งได้ คะแนนตรงกับเฉลย
- [ ] ทำไปครึ่งหนึ่งแล้วปิด LINE เปิดใหม่ กด **ทำต่อ** คำตอบเดิมยังอยู่ และเวลายังเดินต่อจากเดิม
- [ ] ตั้งเวลาสอบ 1 นาที รอจนหมดเวลา ระบบส่งคำตอบให้เอง
- [ ] หลังส่งแล้ว กดชุดสอบเดิมอีกครั้งจะเห็นผลคะแนน ทำซ้ำไม่ได้
- [ ] เปิดหน้าเว็บบนคอมพิวเตอร์ (กด F12 → แท็บ Network) ระหว่างทำข้อสอบ แล้วดูคำตอบจาก `api` ต้องไม่มี `correct_answer`
- [ ] หลังมีนักเรียนเริ่มสอบแล้ว ครูแก้ข้อสอบชุดนั้นไม่ได้

### ตรวจว่า Phase 4 ใช้ได้ (ผลสอบ + Excel)

- [ ] หน้าครู → **ผลสอบ** เห็นตารางคะแนนรายคน ค่าเฉลี่ย สูงสุด ต่ำสุด และข้อที่ตอบผิดมากที่สุด
- [ ] กด **Export Excel** ได้ไฟล์ 3 แผ่นงาน (รายคน / วิเคราะห์รายข้อ / สรุป) เปิดใน Excel แล้วภาษาไทยไม่เพี้ยน
- [ ] **นำเข้า Excel** → ดาวน์โหลด Template กรอกข้อสอบ 20 ข้อ แล้วนำเข้าได้
- [ ] ลองใส่เฉลยเป็น `E` ใน 1 แถว ระบบต้องไฮไลต์แถวนั้นพร้อมเหตุผล ก่อนกดยืนยัน

---

## ขั้นที่ 9: เพิ่มปุ่ม "ทำข้อสอบ" ในเมนูของ LINE OA (Rich Menu)

ทำผ่านหน้าเว็บของ LINE ได้ทั้งหมด ไม่ต้องเขียนโค้ด

1. ถ้ายังไม่มี LINE Official Account ให้สมัครฟรีที่ https://manager.line.biz
2. เข้า **LINE Official Account Manager** → เลือกบัญชีของโรงเรียน/ห้องเรียน
3. ไปที่ **หน้าหลัก → ริชเมนู (Rich menus) → สร้าง**
4. ตั้งชื่อเมนู เช่น `Quizzy` และกำหนดช่วงเวลาแสดง (ตั้งยาว ๆ ได้)
5. **เลือกเทมเพลต** แบบ 1 ช่องใหญ่ หรือ 2 ช่องก็ได้
6. **รูปภาพ:** ออกแบบใน Canva ตามขนาดที่เทมเพลตบอก ใช้ภาพน้องแต่วจาก `assets/mascot/` และสีของ Quizzy (เขียว `#4F8B32` ส้ม `#F59A38`) พร้อมคำว่า "ทำข้อสอบ"
7. **การทำงาน (Action)** ของช่องนั้น เลือก **ลิงก์** แล้วใส่ LIFF URL เช่น `https://liff.line.me/2001234567-AbCdEfGh` ป้ายกำกับ `ทำข้อสอบ`
8. กด **บันทึก** เปิดห้องแชตของ OA ในมือถือ เมนูจะขึ้นด้านล่าง กดแล้วต้องเปิด Quizzy ได้

> ส่งลิงก์ LIFF URL ในกลุ่ม LINE ของห้องเรียนได้เหมือนกัน นักเรียนกดแล้วเปิดในแอป LINE ได้ทันที

### ตรวจว่าใช้ได้

- [ ] กดเมนูใน LINE OA แล้วเปิด Quizzy ในแอป LINE ได้

---

## ภาคผนวก: ใช้ Netlify แทน Vercel

โค้ดชุดเดียวกัน deploy บน Netlify ได้เลย ไฟล์ `netlify.toml` กับ `netlify/functions/api.js` ตั้งค่าไว้ให้แล้ว api จะเปิดที่ `/api` เหมือนกัน จึงไม่ต้องแก้ `js/config.js`

1. ไปที่ https://app.netlify.com แล้วสมัครด้วยบัญชี GitHub
2. กด **Add new site → Import an existing project → GitHub** แล้วเลือก repository `quizzy`
3. หน้าตั้งค่า build ไม่ต้องแก้อะไร (Netlify อ่านจาก `netlify.toml` เอง) กด **Deploy**
   - จะได้ URL เช่น `https://quizzy-xxxx.netlify.app` ใช้ URL นี้เป็น **Endpoint URL** ของ LIFF ในขั้นที่ 3
4. ใส่ค่าลับ (แทนขั้นที่ 6 ของ Vercel): **Site configuration → Environment variables → Add a variable → Import from a .env file**
   - วางเนื้อหาทั้งไฟล์ `.env` ที่กรอกแล้ว (ดูวิธีกรอกในขั้นที่ 6 ข้อ 1–2) แล้วกด Import
   - `SUPABASE_SERVICE_ROLE_KEY` ติ๊ก **Contains secret values** ถ้ามีตัวเลือกนี้
5. **Deploys → Trigger deploy → Deploy site** หนึ่งครั้ง เพื่อให้ api ใช้ค่าใหม่
6. ตรวจว่า api ทำงาน: เปิด `https://quizzy-xxxx.netlify.app/api` ควรเห็น `{"ok":false,"error":"method_not_allowed"}`
7. (แนะนำ) **Site configuration → Build & deploy → Functions → Functions region** ถ้าเลือกได้ ให้ตั้งเป็น **Asia Pacific (Singapore)** ใกล้ Supabase จะตอบเร็วขึ้น
   - ถ้าแพ็กเกจที่ใช้เปลี่ยนไม่ได้ ระบบยังใช้ได้ แต่ช้าลงเล็กน้อยทุกครั้งที่เรียก api

ดู log ของ api ได้ที่ **Logs → Functions → api** ส่วนไฟล์ `vercel.json` ไม่มีผลกับ Netlify ปล่อยไว้ได้
