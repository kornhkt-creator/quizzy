// =========================================================
// Login ด้วยอีเมล + รหัสผ่าน (Supabase Auth) สำหรับหน้าครูบนคอมพิวเตอร์
// บัญชีครูสร้างโดยผู้ดูแลใน Supabase > Authentication > Users
// =========================================================
import { CONFIG } from './config.js';

const STORE = 'quizzy:teacher-session';

export const emailLoginEnabled = () => !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_PUBLISHABLE_KEY);
const authUrl = (path) => `${CONFIG.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/${path}`;

export function getSession() {
  try { return JSON.parse(localStorage.getItem(STORE)); } catch { return null; }
}
export function clearSession() { localStorage.removeItem(STORE); }

async function tokenRequest(grant, body) {
  let res;
  try {
    res = await fetch(authUrl(`token?grant_type=${grant}`), {
      method: 'POST',
      headers: { apikey: CONFIG.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (grant === 'refresh_token') { clearSession(); throw new Error('หมดเวลาการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่'); }
    if (res.status === 400 || res.status === 401) throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    if (res.status === 429) throw new Error('ลองหลายครั้งเกินไป รอสักครู่แล้วลองใหม่');
    throw new Error('เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง');
  }
  const session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    email: data.user?.email || getSession()?.email || '',
  };
  localStorage.setItem(STORE, JSON.stringify(session));
  return session;
}

export function signIn(email, password) {
  return tokenRequest('password', { email: email.trim(), password });
}

// คืน access token ที่ยังใช้ได้ (ต่ออายุให้อัตโนมัติถ้าใกล้หมด)
export async function getAccessToken() {
  const s = getSession();
  if (!s) throw new Error('กรุณาเข้าสู่ระบบ');
  if (Date.now() < s.expires_at - 60e3) return s.access_token;
  return (await tokenRequest('refresh_token', { refresh_token: s.refresh_token })).access_token;
}

export async function signOut() {
  const s = getSession();
  clearSession();
  if (s) {
    await fetch(authUrl('logout'), {
      method: 'POST',
      headers: { apikey: CONFIG.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${s.access_token}` },
    }).catch(() => {});
  }
}
