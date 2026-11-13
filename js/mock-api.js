// =========================================================
// โหมดทดลอง: จำลอง server ทั้งหมดในเบราว์เซอร์ (เก็บใน localStorage)
// ทำงานเหมือน supabase/schema.sql ให้มากที่สุด เพื่อให้ลองใช้ได้ก่อนตั้งค่าจริง
// ห้ามใช้เป็นระบบจริง: ข้อมูลอยู่ในเครื่องเดียวและแก้ไขได้
// =========================================================

const KEY = 'quizzy-demo-v1';
const onTeacherPage = location.pathname.includes('teacher');
const ME = onTeacherPage
  ? { line: 'demo-teacher', name: 'ครูทดลอง' }
  : { line: 'demo-student', name: 'ผู้ทดลอง' };

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const nowIso = () => new Date().toISOString();
const fail = (msg) => { throw new Error(msg); };

function seed() {
  return {
    profiles: [
      { id: 'p-teacher', line_user_id: 'demo-teacher', display_name: 'ครูทดลอง', picture_url: null, full_name: 'ครูทดลอง ใจดี', student_code: null, role: 'teacher', created_at: nowIso() },
    ],
    exams: [],
    questions: [],
    attempts: [],
  };
}

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { return seed(); }
}
function save(db) { localStorage.setItem(KEY, JSON.stringify(db)); }
export function reset() { localStorage.removeItem(KEY); }

function profileJson(p) {
  return {
    id: p.id, display_name: p.display_name, picture_url: p.picture_url, full_name: p.full_name,
    student_code: p.student_code, role: p.role, registered: p.full_name != null, created_at: p.created_at,
  };
}
function myProfile(db) {
  return db.profiles.find((p) => p.line_user_id === ME.line) || fail('ไม่พบบัญชีผู้ใช้ กรุณาเปิดแอปใหม่อีกครั้ง');
}
function teacher(db) {
  const p = myProfile(db);
  if (p.role !== 'teacher') fail('หน้านี้สำหรับครูเท่านั้น');
  return p;
}

// ---------- action (ชื่อเดียวกับ server) ----------
const H = {
  me(db) {
    let p = db.profiles.find((x) => x.line_user_id === ME.line);
    if (!p) {
      p = { id: uuid(), line_user_id: ME.line, display_name: ME.name, picture_url: null, full_name: null, student_code: null, role: 'student', created_at: nowIso() };
      db.profiles.push(p);
    }
    return profileJson(p);
  },

  register(db, d) {
    const p = myProfile(db);
    const name = String(d.full_name ?? '').trim();
    const code = String(d.student_code ?? '').trim() || null;
    if (p.full_name != null) fail('ลงทะเบียนไว้แล้ว ถ้าต้องการแก้ไขข้อมูลให้แจ้งครู');
    if (name.length < 2 || name.length > 100) fail('กรุณากรอกชื่อ-นามสกุล (2–100 ตัวอักษร)');
    if (p.role === 'student' && !code) fail('กรุณากรอกรหัสนักเรียน');
    if (code && code.length > 30) fail('รหัสนักเรียนยาวเกินไป');
    if (code && db.profiles.some((x) => x.student_code === code && x.id !== p.id)) fail('รหัสนักเรียนนี้ถูกใช้แล้ว ถ้าเป็นรหัสของคุณจริงให้แจ้งครู');
    Object.assign(p, { full_name: name, student_code: code });
    return profileJson(p);
  },
};

export async function call(action, data = {}) {
  await new Promise((r) => setTimeout(r, 200)); // จำลองความหน่วงของเครือข่าย
  if (!Object.hasOwn(H, action)) fail('ไม่รู้จักคำสั่งนี้');
  const db = load();
  const result = H[action](db, data ?? {});
  save(db);
  return structuredClone(result);
}
