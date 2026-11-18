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
  return codeFromSearch(location.search);
}

// อ่านค่าจาก query ทั้งแบบปกติ และแบบที่ LINE ห่อไว้ใน liff.state (ก่อน LIFF redirect)
function param(search, name) {
  const params = new URLSearchParams(search);
  const state = params.get('liff.state');
  return params.get(name) ?? (state ? new URLSearchParams(state.split('?')[1] || '').get(name) : null);
}

function codeFromSearch(search) {
  const code = param(search, 'checkin');
  return /^\d{4}$/.test(code || '') ? code : null;
}

// แท็บที่ลิงก์ขอให้เปิด เช่น ?tab=checkin (ใช้กับปุ่ม Rich Menu)
const TABS = ['home', 'checkin', 'history', 'profile'];
export function tabFromUrl() {
  const tab = param(location.search, 'tab');
  return TABS.includes(tab) ? tab : null;
}

// ข้อความที่สแกนได้จาก QR → รหัสเช็คชื่อ (รับทั้งลิงก์เช็คชื่อ และตัวเลข 4 หลักล้วน)
export function codeFromScan(text) {
  const t = String(text ?? '').trim();
  if (/^\d{4}$/.test(t)) return t;
  try { return codeFromSearch(new URL(t).search); } catch { return null; }
}
