// =========================================================
// เชื่อมต่อ LINE ผ่าน LIFF SDK
// =========================================================
import { CONFIG, IS_DEMO } from './config.js';

// เริ่มต้น LIFF แล้วคืนข้อมูลโปรไฟล์ LINE { displayName, pictureUrl }
// ถ้ายังไม่ login จะพาไปหน้า login ของ LINE แล้วกลับมาหน้าเดิม
export async function initLine(demoName = 'ผู้ทดลอง') {
  if (IS_DEMO) return { displayName: demoName, pictureUrl: '' };
  if (!window.liff) throw new Error('โหลด LINE SDK ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่');

  await liff.init({ liffId: CONFIG.LIFF_ID });
  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: location.href });
    await new Promise(() => {}); // รอหน้าเปลี่ยนไป login
  }
  return liff.getProfile();
}

// ID token ใช้ยืนยันตัวตนกับ server (server จะตรวจกับ LINE อีกครั้ง)
export function getIdToken() {
  return IS_DEMO ? 'demo' : liff.getIDToken();
}

// token หมดอายุหรือใช้ไม่ได้: ออกจากระบบแล้ว login ใหม่
export function relogin() {
  if (IS_DEMO) return location.reload();
  liff.logout();
  liff.login({ redirectUri: location.href });
}
