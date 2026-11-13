// =========================================================
// ตั้งค่าการเชื่อมต่อ (ไม่ใช่ความลับ ใส่ในหน้าเว็บได้)
// ดูวิธีหาค่าเหล่านี้ใน docs/SETUP.md
// =========================================================
export const CONFIG = {
  // LIFF ID จาก LINE Developers เช่น '2001234567-AbCdEfGh'
  LIFF_ID: '',
  // URL ของ Edge Function เช่น 'https://abcdxyz.supabase.co/functions/v1/api'
  API_URL: '',
};

// โหมดทดลอง: ยังตั้งค่าไม่ครบ หรือเปิดลิงก์ด้วย ?demo
// ใช้ข้อมูลจำลองในเครื่อง ไม่เชื่อมต่อ LINE และฐานข้อมูลจริง
const params = new URLSearchParams(location.search);
export const IS_DEMO = !CONFIG.LIFF_ID || !CONFIG.API_URL || params.has('demo');
