// =========================================================
// เรียก server (Edge Function "api") พร้อมแนบ token ยืนยันตัวตน
// - ค่าเริ่มต้น: LINE ID token
// - หน้าครูที่ login ด้วยอีเมล: เรียก useAuth(...) เพื่อเปลี่ยนเป็น token ของ Supabase Auth
// ในโหมดทดลองจะใช้ js/mock-api.js แทน
// =========================================================
import { CONFIG, IS_DEMO } from './config.js';
import { getIdToken, relogin } from './line.js';

let mock;
let auth = { provider: 'line', getToken: async () => getIdToken(), onExpired: relogin };

export function useAuth(a) { auth = a; }
export const authProvider = () => auth.provider;

export async function api(action, data = {}) {
  if (IS_DEMO) {
    mock ??= await import('./mock-api.js');
    return mock.call(action, data);
  }

  const idToken = await auth.getToken();
  let res;
  try {
    res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, provider: auth.provider, idToken, data }),
    });
  } catch {
    throw new Error('เชื่อมต่ออินเทอร์เน็ตไม่ได้ ลองใหม่อีกครั้งนะครับ');
  }

  const body = await res.json().catch(() => null);
  if (res.status === 401) {
    // token หมดอายุหรือใช้ไม่ได้: login ใหม่
    auth.onExpired();
    throw new Error('กำลังเข้าสู่ระบบใหม่');
  }
  if (!body?.ok) throw new Error(body?.error || 'เกิดข้อผิดพลาด ลองใหม่อีกครั้งนะครับ');
  return body.data;
}

export async function resetDemo() {
  mock ??= await import('./mock-api.js');
  mock.reset();
}
