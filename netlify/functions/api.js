// =========================================================
// ทางเข้า api สำหรับ Netlify (ใช้โค้ดเดียวกับ Vercel ใน api/index.js)
// เปิดที่ /api เหมือนกัน หน้าเว็บจึงไม่ต้องแก้อะไร
// ค่าลับตั้งใน Netlify > Site configuration > Environment variables (ดู .env.example)
// =========================================================
import { handle } from '../../api/index.js';

export default (req) => handle(req);

export const config = { path: '/api' };
