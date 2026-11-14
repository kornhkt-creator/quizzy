// =========================================================
// Quizzy Lite: Vercel Function "api" (ตัวเดียวทั้งระบบ) เปิดที่ /api
//
// ขั้นตอนทุกคำขอ:
// 1) รับ { action, provider, idToken, data } จากหน้าเว็บ
// 2) ตรวจตัวตน:
//    - provider "line"  (ค่าเริ่มต้น): ตรวจ LINE ID token กับ LINE
//    - provider "email" (ครูที่ login ด้วยอีเมลบนคอมพิวเตอร์): ตรวจ access token กับ Supabase Auth
// 3) เรียกฟังก์ชัน api_* ในฐานข้อมูลด้วย service role พร้อมรหัสผู้ใช้ที่ยืนยันแล้ว
//    (LINE ใช้ LINE user ID, อีเมลใช้ "auth:<user id>" เก็บในช่อง profiles.line_user_id)
// 4) ส่งผลกลับเป็น { ok: true, data } หรือ { ok: false, error }
//
// ตั้งค่าใน Vercel > Project > Settings > Environment Variables (ดู .env.example และ docs/SETUP.md):
// - LINE_CHANNEL_ID            Channel ID ของ LINE
// - SUPABASE_URL               Project URL ของ Supabase
// - SUPABASE_SERVICE_ROLE_KEY  Secret key (sb_secret_...) หรือ service_role key ของ Supabase
// =========================================================

// action ที่หน้าเว็บเรียกได้ → ชื่อฟังก์ชันในฐานข้อมูล + พารามิเตอร์
// (รับเฉพาะ action ในรายการนี้เท่านั้น)
const ACTIONS = {
  // ---------- ผู้ใช้ ----------
  me: { fn: 'api_me', args: (_d, u) => ({ p_display_name: u.name ?? null, p_picture_url: u.picture ?? null }) },
  register: { fn: 'api_register', args: (d) => ({ p_full_name: d.full_name ?? null, p_student_code: d.student_code ?? null }) },

  // ---------- ครู: จัดการชุดสอบ ----------
  teacher_list_exams: { fn: 'api_teacher_list_exams', args: () => ({}) },
  get_exam: { fn: 'api_get_exam', args: (d) => ({ p_exam_id: d.exam_id ?? null }) },
  save_exam: { fn: 'api_save_exam', args: (d) => ({ p_exam: d.exam ?? {} }) },
  save_questions: {
    fn: 'api_save_questions',
    args: (d) => ({ p_exam_id: d.exam_id ?? null, p_questions: d.questions ?? [], p_mode: d.mode === 'append' ? 'append' : 'replace' }),
  },
  set_published: { fn: 'api_set_published', args: (d) => ({ p_exam_id: d.exam_id ?? null, p_publish: d.publish === true }) },
  delete_exam: { fn: 'api_delete_exam', args: (d) => ({ p_exam_id: d.exam_id ?? null }) },
  exam_results: { fn: 'api_exam_results', args: (d) => ({ p_exam_id: d.exam_id ?? null }) },

  // ---------- นักเรียน: ทำข้อสอบ ----------
  list_exams: { fn: 'api_list_exams', args: () => ({}) },
  start_exam: { fn: 'api_start_exam', args: (d) => ({ p_exam_id: d.exam_id ?? null }) },
  submit_exam: { fn: 'api_submit_exam', args: (d) => ({ p_exam_id: d.exam_id ?? null, p_answers: d.answers ?? {} }) },
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const env = (name) => process.env[name]?.trim() || '';

const reply = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

function supabaseEnv() {
  const url = env('SUPABASE_URL').replace(/\/+$/, '');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new ApiError(500, 'ยังไม่ได้ตั้งค่า SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ใน Vercel');
  return { url, key };
}

// ตรวจ LINE ID token: https://developers.line.biz/en/reference/line-login/#verify-id-token
export async function verifyLine(idToken) {
  const channelId = env('LINE_CHANNEL_ID');
  if (!channelId) throw new ApiError(500, 'ยังไม่ได้ตั้งค่า LINE_CHANNEL_ID ใน Vercel');
  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  });
  if (!res.ok) throw new ApiError(401, 'invalid_token');
  const user = await res.json();
  if (!user?.sub) throw new ApiError(401, 'invalid_token');
  return user;
}

// ตรวจ access token ของ Supabase Auth (ครูที่ login ด้วยอีเมล)
export async function verifyEmail(accessToken) {
  const { url, key } = supabaseEnv();
  const res = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new ApiError(401, 'invalid_token');
  const user = await res.json();
  if (!user?.id) throw new ApiError(401, 'invalid_token');
  return { sub: `auth:${user.id}`, name: user.email ?? null, picture: null };
}

// เรียกฟังก์ชันในฐานข้อมูลผ่าน REST (PostgREST)
export async function callRpc(fn, params) {
  const { url, key } = supabaseEnv();
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`; // key แบบเก่า (JWT)

  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(params) });
  const body = await res.json().catch(() => null);
  if (res.ok) return body;

  // ข้อความที่ฐานข้อมูลตั้งใจแจ้งผู้ใช้ (raise exception) มีรหัส P0001
  if (body?.code === 'P0001' && body.message) throw new ApiError(400, body.message);
  // รหัสหรือรูปแบบข้อมูลผิด เช่น exam_id ไม่ใช่ uuid
  if (body?.code === '22P02' || body?.code === 'PGRST202') throw new ApiError(400, 'ข้อมูลไม่ถูกต้อง');
  console.error('rpc error', fn, res.status, body);
  throw new ApiError(500, 'เกิดข้อผิดพลาดในระบบ ลองใหม่อีกครั้งนะครับ');
}

export async function handle(req, deps = { verifyLine, verifyEmail, callRpc }) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'method_not_allowed' });

  try {
    const body = await req.json().catch(() => null);
    const action = typeof body?.action === 'string' ? body.action : '';
    const def = Object.hasOwn(ACTIONS, action) ? ACTIONS[action] : undefined;
    if (!def) throw new ApiError(400, 'ไม่รู้จักคำสั่งนี้');
    if (typeof body.idToken !== 'string' || !body.idToken) throw new ApiError(401, 'invalid_token');
    const data = body.data && typeof body.data === 'object' ? body.data : {};

    const user = body.provider === 'email' ? await deps.verifyEmail(body.idToken) : await deps.verifyLine(body.idToken);
    const result = await deps.callRpc(def.fn, { p_line_user_id: user.sub, ...def.args(data, user) });
    return reply(200, { ok: true, data: result });
  } catch (err) {
    if (err instanceof ApiError) return reply(err.status, { ok: false, error: err.message });
    console.error(err);
    return reply(500, { ok: false, error: 'เกิดข้อผิดพลาดในระบบ ลองใหม่อีกครั้งนะครับ' });
  }
}

// Vercel เรียกฟังก์ชันตามชื่อ HTTP method (Web Request / Response)
export const POST = (req) => handle(req);
export const OPTIONS = (req) => handle(req);
export const GET = (req) => handle(req);
