// =========================================================
// Quizzy Lite: Edge Function "api" (ตัวเดียวทั้งระบบ)
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
// ตั้งค่าใน Supabase > Edge Functions > api:
// - Secrets: LINE_CHANNEL_ID = Channel ID ของ LINE (ดู docs/SETUP.md)
// - ปิด "Verify JWT" เพราะเราตรวจ LINE token เอง
// (SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY มีให้อัตโนมัติ)
// =========================================================

type Json = Record<string, unknown>;
type LineUser = { sub: string; name?: string | null; picture?: string | null };

// action ที่หน้าเว็บเรียกได้ → ชื่อฟังก์ชันในฐานข้อมูล + พารามิเตอร์
// (รับเฉพาะ action ในรายการนี้เท่านั้น)
const ACTIONS: Record<string, { fn: string; args: (d: Json, u: LineUser) => Json }> = {
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

  // ---------- เช็คชื่อเข้าเรียน ----------
  att_open: { fn: 'api_att_open', args: (d) => ({ p_session: d.session ?? {} }) },
  att_list: { fn: 'api_att_list', args: () => ({}) },
  att_detail: { fn: 'api_att_detail', args: (d) => ({ p_session_id: d.session_id ?? null }) },
  att_set: { fn: 'api_att_set', args: (d) => ({ p_session_id: d.session_id ?? null, p_profile_id: d.profile_id ?? null, p_status: d.status ?? null }) },
  att_close: { fn: 'api_att_close', args: (d) => ({ p_session_id: d.session_id ?? null }) },
  att_delete: { fn: 'api_att_delete', args: (d) => ({ p_session_id: d.session_id ?? null }) },
  att_report: { fn: 'api_att_report', args: () => ({}) },
  att_checkin: { fn: 'api_att_checkin', args: (d) => ({ p_code: d.code ?? null }) },
  att_history: { fn: 'api_att_history', args: () => ({}) },
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

class ApiError extends Error {
  // reason: คำอธิบายสาเหตุที่ token ใช้ไม่ได้ (ส่งให้หน้าเว็บแสดงและบันทึกลง Logs) ไม่มีข้อมูลลับ
  constructor(public status: number, message: string, public reason?: string) { super(message); }
}

// token ใช้ไม่ได้: บันทึกสาเหตุลง Logs ของ Edge Function แล้วตอบ 401
function invalidToken(reason: string): ApiError {
  console.warn('401 invalid_token:', reason);
  return new ApiError(401, 'invalid_token', reason);
}

// แปลข้อความจาก LINE เป็นคำแนะนำที่ผู้ดูแลแก้ได้
export function lineReason(desc: string): string {
  if (/audience/i.test(desc)) return 'Channel ID ไม่ตรง: LINE_CHANNEL_ID ใน Supabase ต้องเป็น Channel ID ของ channel ที่มี LIFF นี้';
  if (/expired/i.test(desc)) return 'LINE token หมดอายุ';
  return `LINE ไม่ยอมรับ token (${desc || 'ไม่ทราบสาเหตุ'})`;
}

const reply = (status: number, body: Json) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// ตรวจ LINE ID token: https://developers.line.biz/en/reference/line-login/#verify-id-token
export async function verifyLine(idToken: string): Promise<LineUser> {
  const channelId = Deno.env.get('LINE_CHANNEL_ID')?.trim();
  if (!channelId) throw new ApiError(500, 'ยังไม่ได้ตั้งค่า LINE_CHANNEL_ID ใน Supabase');
  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw invalidToken(lineReason(String(err?.error_description ?? err?.error ?? '')));
  }
  const user = await res.json();
  if (!user?.sub) throw invalidToken('LINE ไม่ส่งรหัสผู้ใช้กลับมา');
  return user;
}

// ตรวจ access token ของ Supabase Auth (ครูที่ login ด้วยอีเมล)
export async function verifyEmail(accessToken: string): Promise<LineUser> {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new ApiError(500, 'ไม่พบการตั้งค่า Supabase');
  const res = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw invalidToken('token ของอีเมลหมดอายุหรือใช้ไม่ได้');
  const user = await res.json();
  if (!user?.id) throw invalidToken('token ของอีเมลหมดอายุหรือใช้ไม่ได้');
  return { sub: `auth:${user.id}`, name: user.email ?? null, picture: null };
}

// เรียกฟังก์ชันในฐานข้อมูลผ่าน REST (PostgREST)
export async function callRpc(fn: string, params: Json): Promise<unknown> {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new ApiError(500, 'ไม่พบการตั้งค่า Supabase');
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
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

export async function handle(req: Request, deps = { verifyLine, verifyEmail, callRpc }): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'method_not_allowed' });

  try {
    const body = await req.json().catch(() => null);
    const action = typeof body?.action === 'string' ? body.action : '';
    const def = Object.hasOwn(ACTIONS, action) ? ACTIONS[action] : undefined;
    if (!def) throw new ApiError(400, 'ไม่รู้จักคำสั่งนี้');
    if (typeof body.idToken !== 'string' || !body.idToken) {
      throw invalidToken(body.provider === 'email' ? 'ไม่ได้ส่ง token ของอีเมลมา' : 'ไม่ได้รับ ID token จาก LINE: ตรวจว่า LIFF ติ๊ก scope openid แล้ว');
    }
    const data: Json = body.data && typeof body.data === 'object' ? body.data : {};

    const user = body.provider === 'email' ? await deps.verifyEmail(body.idToken) : await deps.verifyLine(body.idToken);
    const result = await deps.callRpc(def.fn, { p_line_user_id: user.sub, ...def.args(data, user) });
    return reply(200, { ok: true, data: result as Json });
  } catch (err) {
    if (err instanceof ApiError) {
      return reply(err.status, err.reason ? { ok: false, error: err.message, reason: err.reason } : { ok: false, error: err.message });
    }
    console.error(err);
    return reply(500, { ok: false, error: 'เกิดข้อผิดพลาดในระบบ ลองใหม่อีกครั้งนะครับ' });
  }
}

// ตอนรันทดสอบ (QUIZZY_TEST=1) ไม่ต้องเปิด server
if (!Deno.env.get('QUIZZY_TEST')) Deno.serve((req) => handle(req));
