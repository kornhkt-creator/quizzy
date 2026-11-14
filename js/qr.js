// =========================================================
// QR Code สำหรับเช็คชื่อ
// - ลิงก์ใน QR: เปิด Quizzy ใน LINE พร้อมรหัสเช็คชื่อ (?checkin=1234)
// - ใช้ qrcode-generator (โหลดจาก CDN เมื่อจำเป็นเท่านั้น)
// =========================================================
import { CONFIG, IS_DEMO } from './config.js';

const QR_URL = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
let loading;

function loadLib() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = QR_URL;
    s.onload = () => resolve(window.qrcode);
    s.onerror = () => { loading = null; reject(new Error('โหลดตัวสร้าง QR ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่')); };
    document.head.appendChild(s);
  });
  return loading;
}

// ลิงก์ที่นักเรียนสแกนแล้วเปิดหน้าเช็คชื่อพร้อมรหัส
// ใช้งานจริง: LIFF URL (เปิดในแอป LINE) / โหมดทดลอง: หน้าแรกของเว็บนี้
export function checkinUrl(code) {
  if (!IS_DEMO) return `https://liff.line.me/${CONFIG.LIFF_ID}?checkin=${code}`;
  return `${new URL('./', location.href).href}?checkin=${code}`;
}

// คืน <svg> ของ QR ที่ย่อขยายตามกล่องได้
export async function qrSvg(text) {
  const qrcode = await loadLib();
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
}

// อ่านรหัสเช็คชื่อจาก URL ตอนเปิดแอป
// LINE ส่งค่ามาได้ 2 แบบ: ?checkin=1234 หรือ ?liff.state=%3Fcheckin%3D1234 (ก่อน LIFF redirect)
export function checkinFromUrl() {
  const params = new URLSearchParams(location.search);
  let code = params.get('checkin');
  const state = params.get('liff.state');
  if (!code && state) code = new URLSearchParams(state.split('?')[1] || '').get('checkin');
  return /^\d{4}$/.test(code || '') ? code : null;
}
