// =========================================================
// ตั้งค่าการเชื่อมต่อ (ไม่ใช่ความลับ ใส่ในหน้าเว็บได้)
// ดูวิธีหาค่าเหล่านี้ใน docs/SETUP.md
// =========================================================
export const CONFIG = {
  // LIFF ID จาก LINE Developers เช่น '2001234567-AbCdEfGh'
  LIFF_ID: '',
  // URL ของ Edge Function เช่น 'https://abcdxyz.supabase.co/functions/v1/api'
  API_URL: '',

  // ---- ไม่บังคับ: ให้ครู login หน้าครูด้วยอีเมล + รหัสผ่าน (ไม่ต้องใช้ LINE) ----
  // ดูได้ที่ Supabase > Project Settings > API Keys
  // Project URL เช่น 'https://abcdxyz.supabase.co'
  SUPABASE_URL: '',
  // Publishable key (sb_publishable_...) หรือ anon public key ห้ามใส่ secret / service_role key
  SUPABASE_PUBLISHABLE_KEY: '',
};

// โหมดทดลอง: ยังตั้งค่าไม่ครบ หรือเปิดลิงก์ด้วย ?demo
// ใช้ข้อมูลจำลองในเครื่อง ไม่เชื่อมต่อ LINE และฐานข้อมูลจริง
const params = new URLSearchParams(location.search);
export const IS_DEMO = !CONFIG.LIFF_ID || !CONFIG.API_URL || params.has('demo');
