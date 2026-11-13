// =========================================================
// ตั้งค่าการเชื่อมต่อ (ไม่ใช่ความลับ ใส่ในหน้าเว็บได้)
// ดูวิธีหาค่าเหล่านี้ใน docs/SETUP.md
// =========================================================
export const CONFIG = {
  // LIFF ID จาก LINE Developers เช่น '2001234567-AbCdEfGh'
  LIFF_ID: '',
};

// โหมดทดลอง: ยังไม่ได้ใส่ LIFF ID หรือเปิดลิงก์ด้วย ?demo
// ใช้ข้อมูลจำลองในเครื่อง ไม่เชื่อมต่อ LINE
const params = new URLSearchParams(location.search);
export const IS_DEMO = !CONFIG.LIFF_ID || params.has('demo');
