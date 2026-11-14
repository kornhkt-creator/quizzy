// =========================================================
// เชื่อมต่อ LINE ผ่าน LIFF SDK
// =========================================================
import { CONFIG, IS_DEMO } from './config.js';

// เริ่มต้น LIFF แล้วคืนข้อมูลโปรไฟล์ LINE { displayName, pictureUrl }
// autoLogin = true: ถ้ายังไม่ login จะพาไปหน้า login ของ LINE แล้วกลับมาหน้าเดิม
// autoLogin = false: ถ้ายังไม่ login คืน null (ใช้ในหน้าครูที่มีให้เลือกวิธี login)
// liffQuery: ถ้าเปิดในเบราว์เซอร์ในแอป LINE (กดลิงก์เว็บตรง ๆ ในแชต) ให้ส่งต่อไปเปิดแบบ LIFF พร้อม query นี้
//            (ใช้หน้านักเรียน เพื่อให้สแกน QR ในแอปได้) / null = ไม่ส่งต่อ
export async function initLine(demoName = 'ผู้ทดลอง', { autoLogin = true, liffQuery = null } = {}) {
  if (IS_DEMO) return { displayName: demoName, pictureUrl: '' };
  if (!window.liff) throw new Error('โหลด LINE SDK ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่');

  await liff.init({ liffId: CONFIG.LIFF_ID });
  if (liffQuery !== null && openViaLiff(liffQuery)) await new Promise(() => {}); // รอหน้าเปลี่ยน
  if (!liff.isLoggedIn()) {
    if (!autoLogin) return null;
    lineLogin();
    await new Promise(() => {}); // รอหน้าเปลี่ยนไป login
  }
  return liff.getProfile();
}

export function lineLogin() {
  liff.login({ redirectUri: location.href });
}

export function lineLogout() {
  if (!IS_DEMO && window.liff?.isLoggedIn?.()) liff.logout();
}

// กดลิงก์เว็บ (.netlify.app) ในแชต LINE จะเปิดใน "เบราว์เซอร์ในแอป LINE" ซึ่งไม่ใช่ LIFF
// → สแกน QR ในแอปไม่ได้ จึงส่งต่อไปเปิดผ่าน LIFF URL แทน (ทำครั้งเดียวต่อแท็บ กันวน)
const TO_LIFF = 'quizzy:to-liff';
function openViaLiff(query) {
  const inLineBrowser = /\bLine\//i.test(navigator.userAgent);
  if (!inLineBrowser || liff.isInClient() || sessionStorage.getItem(TO_LIFF)) return false;
  sessionStorage.setItem(TO_LIFF, '1');
  location.replace(`https://liff.line.me/${CONFIG.LIFF_ID}${query}`);
  return true;
}

// ---------- สแกน QR ด้วยกล้องของ LINE ----------
export const inLineApp = () => !IS_DEMO && !!window.liff?.isInClient?.();

// ตรวจก่อนสแกน: คืนข้อความบอกเหตุผลถ้าสแกนไม่ได้ / null = สแกนได้
export function scanBlockedReason() {
  if (IS_DEMO) return 'โหมดทดลองสแกน QR ไม่ได้ กรอกรหัส 4 หลักจากจอครูแทนได้';
  if (window.liff?.isApiAvailable?.('scanCodeV2')) return null;
  if (!inLineApp()) {
    return 'ปุ่มสแกนใช้ได้เมื่อเปิด Quizzy จากลิงก์ liff.line.me ในแอป LINE บนมือถือ · ตอนนี้ใช้กล้องมือถือสแกน QR หรือกรอกรหัสแทนได้';
  }
  return 'ยังสแกนในแอปไม่ได้ (ผู้ดูแล: เปิด Scan QR ในตั้งค่า LIFF แล้วปิด-เปิด LINE ใหม่) ใช้กล้องมือถือสแกน หรือกรอกรหัสแทนได้';
}

// คืนข้อความใน QR หรือ null ถ้ากดยกเลิก
export async function scanQr() {
  const { value } = await liff.scanCodeV2();
  return value || null;
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
