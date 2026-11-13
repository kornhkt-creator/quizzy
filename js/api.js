// =========================================================
// เรียก server (Edge Function "api") พร้อมแนบ LINE ID token
// ในโหมดทดลองจะใช้ js/mock-api.js แทน
// =========================================================
import { CONFIG, IS_DEMO } from './config.js';
import { getIdToken, relogin } from './line.js';

let mock;

export async function api(action, data = {}) {
  if (IS_DEMO) {
    mock ??= await import('./mock-api.js');
    return mock.call(action, data);
  }

  let res;
  try {
    res = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, idToken: getIdToken(), data }),
    });
  } catch {
    throw new Error('เชื่อมต่ออินเทอร์เน็ตไม่ได้ ลองใหม่อีกครั้งนะครับ');
  }

  const body = await res.json().catch(() => null);
  if (res.status === 401) {
    // token หมดอายุ: login ใหม่อัตโนมัติ
    relogin();
    throw new Error('กำลังเข้าสู่ระบบใหม่');
  }
  if (!body?.ok) throw new Error(body?.error || 'เกิดข้อผิดพลาด ลองใหม่อีกครั้งนะครับ');
  return body.data;
}

export async function resetDemo() {
  mock ??= await import('./mock-api.js');
  mock.reset();
}
