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

// ข้อมูลตัวอย่างตอนเปิดโหมดทดลองครั้งแรก
function seed() {
  const db = {
    profiles: [
      { id: 'p-teacher', line_user_id: 'demo-teacher', display_name: 'ครูทดลอง', picture_url: null, full_name: 'ครูทดลอง ใจดี', student_code: null, role: 'teacher', created_at: nowIso() },
    ],
    exams: [],
    questions: [],
    attempts: [],
  };
  const addExam = (id, title, minutes, published, qs) => {
    db.exams.push({ id, title, description: 'ชุดสอบตัวอย่างในโหมดทดลอง', duration_minutes: minutes, pass_percent: 50, open_at: null, close_at: null, is_published: published, created_by: 'p-teacher', created_at: nowIso(), updated_at: nowIso() });
    qs.forEach(([text, a, b, c, d, ans, points = 1], i) => db.questions.push({
      id: uuid(), exam_id: id, order_no: i + 1, question_text: text, option_a: a, option_b: b, option_c: c, option_d: d, correct_answer: ans, points, explanation: null,
    }));
  };
  addExam('demo-exam-1', 'ตัวอย่าง: บทที่ 3 เศษส่วน', 15, true, [
    ['1/2 + 1/4 = ?', '3/4', '2/6', '1/6', '2/4', 'A'],
    ['ข้อใดมีค่าเท่ากับ 3/4', '6/8', '3/8', '9/16', '4/3', 'A'],
    ['เศษส่วนใดมีค่ามากที่สุด', '1/2', '2/3', '3/4', '3/5', 'C'],
    ['2/3 + 1/6 = ?', '3/9', '5/6', '1/2', '4/6', 'B'],
    ['1/2 มีค่าเท่ากับ 0.5 ใช่หรือไม่', 'ใช่', 'ไม่ใช่', null, null, 'A'],
  ]);
  addExam('demo-exam-2', 'ตัวอย่าง: วิทยาศาสตร์ ป.5 หน่วยที่ 2', 20, false, [
    ['สิ่งมีชีวิตใดสร้างอาหารเองได้', 'เห็ด', 'ต้นมะม่วง', 'แมว', 'ปลา', 'B'],
    ['พืชใช้แก๊สใดในการสังเคราะห์ด้วยแสง', 'ออกซิเจน', 'ไนโตรเจน', 'คาร์บอนไดออกไซด์', null, 'C'],
  ]);
  return db;
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

// ---------- ชุดสอบ (เหมือน qz_* ใน schema.sql) ----------
const toInt = (v) => (v === '' || v == null || !/^-?\d+$/.test(String(v).trim()) ? null : Number(v));
const toTs = (v) => (v ? (Number.isNaN(Date.parse(v)) ? undefined : new Date(v).toISOString()) : null);
const locked = (db, examId) => db.attempts.some((a) => a.exam_id === examId);
function status(e) {
  const now = Date.now();
  if (!e.is_published) return 'draft';
  if (e.open_at && now < Date.parse(e.open_at)) return 'scheduled';
  if (e.close_at && now >= Date.parse(e.close_at)) return 'closed';
  return 'open';
}
const examQuestions = (db, examId) => db.questions.filter((q) => q.exam_id === examId).sort((a, b) => a.order_no - b.order_no);
function findExam(db, id) { return db.exams.find((e) => e.id === id) || fail('ไม่พบชุดสอบนี้'); }
function examFull(db, id) {
  const e = findExam(db, id);
  return {
    ...e, status: status(e), locked: locked(db, id),
    questions: examQuestions(db, id).map(({ exam_id, created_at, ...q }) => q),
  };
}
function cleanQuestion(q, i) {
  const s = (v) => String(v ?? '').trim();
  const opt = (v) => s(v) || null;
  const text = s(q.question_text);
  const [a, b, c, d] = [opt(q.option_a), opt(q.option_b), opt(q.option_c), opt(q.option_d)];
  const ans = s(q.correct_answer).toUpperCase().replace(/[กขคง]/g, (ch) => 'ABCD'['กขคง'.indexOf(ch)]);
  const pts = s(q.points) === '' ? 1 : toInt(q.points);
  if (!text) fail(`ข้อ ${i}: กรุณากรอกคำถาม`);
  if (text.length > 2000) fail(`ข้อ ${i}: คำถามยาวเกิน 2000 ตัวอักษร`);
  if (!a || !b) fail(`ข้อ ${i}: ต้องมีตัวเลือก A และ B เป็นอย่างน้อย`);
  if (d && !c) fail(`ข้อ ${i}: มีตัวเลือก D แต่ไม่มีตัวเลือก C`);
  if ([a, b, c, d].some((x) => x && x.length > 500)) fail(`ข้อ ${i}: ตัวเลือกยาวเกิน 500 ตัวอักษร`);
  if (!['A', 'B', 'C', 'D'].includes(ans)) fail(`ข้อ ${i}: เฉลยต้องเป็น A, B, C หรือ D`);
  if ((ans === 'C' && !c) || (ans === 'D' && !d)) fail(`ข้อ ${i}: เฉลยชี้ไปที่ตัวเลือกที่ว่าง`);
  if (pts == null || pts < 1 || pts > 100) fail(`ข้อ ${i}: คะแนนต้องเป็นตัวเลข 1–100`);
  return { question_text: text, option_a: a, option_b: b, option_c: c, option_d: d, correct_answer: ans, points: pts, explanation: opt(q.explanation) };
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

  // ---------- ครู: จัดการชุดสอบ ----------
  teacher_list_exams(db) {
    teacher(db);
    const students = db.profiles.filter((p) => p.role === 'student' && p.full_name != null).length;
    return [...db.exams].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((e) => {
      const qs = examQuestions(db, e.id);
      const at = db.attempts.filter((a) => a.exam_id === e.id);
      return {
        id: e.id, title: e.title, description: e.description, duration_minutes: e.duration_minutes, pass_percent: e.pass_percent,
        open_at: e.open_at, close_at: e.close_at, is_published: e.is_published, status: status(e), created_at: e.created_at,
        question_count: qs.length, max_score: qs.reduce((s, q) => s + q.points, 0),
        started_count: at.length, submitted_count: at.filter((a) => a.submitted_at).length, student_count: students,
      };
    });
  },

  get_exam(db, d) {
    teacher(db);
    return examFull(db, d.exam_id);
  },

  save_exam(db, d) {
    const t = teacher(db);
    const x = d.exam || {};
    const title = String(x.title ?? '').trim();
    const desc = String(x.description ?? '').trim();
    const dur = toInt(x.duration_minutes);
    const pass = String(x.pass_percent ?? '') === '' ? 50 : toInt(x.pass_percent);
    const open = toTs(x.open_at);
    const close = toTs(x.close_at);
    if (!title) fail('กรุณาตั้งชื่อชุดสอบ');
    if (title.length > 200) fail('ชื่อชุดสอบยาวเกิน 200 ตัวอักษร');
    if (desc.length > 2000) fail('คำอธิบายยาวเกิน 2000 ตัวอักษร');
    if (dur == null || dur < 1 || dur > 300) fail('เวลาทำข้อสอบต้องอยู่ระหว่าง 1–300 นาที');
    if (pass == null || pass < 0 || pass > 100) fail('เกณฑ์ผ่านต้องอยู่ระหว่าง 0–100%');
    if (open === undefined) fail('รูปแบบเวลาเปิดสอบไม่ถูกต้อง');
    if (close === undefined) fail('รูปแบบเวลาปิดสอบไม่ถูกต้อง');
    if (open && close && close <= open) fail('เวลาปิดสอบต้องอยู่หลังเวลาเปิดสอบ');
    const fields = { title, description: desc, duration_minutes: dur, pass_percent: pass, open_at: open, close_at: close, updated_at: nowIso() };
    if (!x.id) {
      const e = { id: uuid(), ...fields, is_published: false, created_by: t.id, created_at: nowIso() };
      db.exams.push(e);
      return examFull(db, e.id);
    }
    const e = findExam(db, x.id);
    if (locked(db, e.id) && dur !== e.duration_minutes) fail('มีนักเรียนเริ่มสอบแล้ว เปลี่ยนเวลาทำข้อสอบไม่ได้');
    Object.assign(e, fields);
    return examFull(db, e.id);
  },

  save_questions(db, d) {
    teacher(db);
    const e = findExam(db, d.exam_id);
    if (locked(db, e.id)) fail('มีนักเรียนเริ่มสอบชุดนี้แล้ว แก้ไขหรือเพิ่มข้อสอบไม่ได้');
    if (!Array.isArray(d.questions)) fail('ข้อมูลข้อสอบไม่ถูกต้อง');
    const append = d.mode === 'append';
    const cleaned = d.questions.map((q, i) => cleanQuestion(q || {}, i + 1)); // ตรวจก่อน ผิดข้อเดียวไม่บันทึกเลย
    const kept = append ? examQuestions(db, e.id) : [];
    const start = kept.reduce((m, q) => Math.max(m, q.order_no), 0);
    if (kept.length + cleaned.length > 200) fail('ชุดสอบหนึ่งชุดมีได้ไม่เกิน 200 ข้อ');
    if (kept.length + cleaned.length === 0 && e.is_published) fail('ชุดสอบที่เผยแพร่แล้วต้องมีอย่างน้อย 1 ข้อ');
    db.questions = db.questions.filter((q) => q.exam_id !== e.id || append);
    cleaned.forEach((q, i) => db.questions.push({ id: uuid(), exam_id: e.id, order_no: start + i + 1, ...q, created_at: nowIso() }));
    e.updated_at = nowIso();
    return examFull(db, e.id);
  },

  set_published(db, d) {
    teacher(db);
    const e = findExam(db, d.exam_id);
    if (d.publish === true && !examQuestions(db, e.id).length) fail('เพิ่มข้อสอบอย่างน้อย 1 ข้อก่อนเผยแพร่');
    e.is_published = d.publish === true;
    return examFull(db, e.id);
  },

  delete_exam(db, d) {
    teacher(db);
    findExam(db, d.exam_id);
    db.exams = db.exams.filter((e) => e.id !== d.exam_id);
    db.questions = db.questions.filter((q) => q.exam_id !== d.exam_id);
    db.attempts = db.attempts.filter((a) => a.exam_id !== d.exam_id);
    return { deleted: true };
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
