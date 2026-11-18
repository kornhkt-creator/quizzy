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
    att_sessions: [],
    att_records: [],
    att_failures: [],
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

  // นักเรียนจำลองที่ส่งข้อสอบชุดแรกแล้ว (ให้หน้าผลสอบมีข้อมูล)
  const names = ['ด.ญ.กานดา มีสุข', 'ด.ช.ธนกร แก้วดี', 'ด.ญ.ปิยะดา ศรีทอง', 'ด.ช.ณัฐวุฒิ บุญมา', 'ด.ญ.พิมพ์ชนก รุ่งเรือง', 'ด.ช.กิตติ สายใจ', 'ด.ญ.อรอุมา ทองคำ'];
  const picks = ['AACBA', 'AACAA', 'AAABA', 'BDCAB', null, 'AACBA', 'CACBB']; // null = ยังไม่เริ่ม
  const qs = db.questions.filter((q) => q.exam_id === 'demo-exam-1');
  names.forEach((name, i) => {
    const pid = `p-demo-${i}`;
    db.profiles.push({ id: pid, line_user_id: `demo-s${i}`, display_name: name, picture_url: null, full_name: name, student_code: String(65001 + i), role: 'student', created_at: new Date(Date.now() - 7 * 86400e3).toISOString() });
    if (!picks[i]) return;
    const answers = Object.fromEntries(qs.map((q, j) => [q.id, picks[i][j]]));
    const right = qs.filter((q) => answers[q.id] === q.correct_answer);
    const end = Date.now() - (i + 1) * 3600e3;
    db.attempts.push({
      id: uuid(), exam_id: 'demo-exam-1', profile_id: pid, started_at: new Date(end - 600e3).toISOString(), deadline_at: new Date(end + 300e3).toISOString(),
      submitted_at: new Date(end).toISOString(), answers, score: right.reduce((s, q) => s + q.points, 0), max_score: qs.reduce((s, q) => s + q.points, 0),
      correct_count: right.length, is_late: i === 3,
    });
  });

  // คาบเช็คชื่อเมื่อวาน (ปิดแล้ว): มา 4 สาย 1 ลา 1 ขาด 1
  const open = Date.now() - 86400e3;
  db.att_sessions.push({
    id: 'demo-att-1', title: 'ตัวอย่าง: คณิตศาสตร์ คาบ 1', code: '4821', opens_at: new Date(open).toISOString(),
    late_at: new Date(open + 10 * 60e3).toISOString(), closes_at: new Date(open + 15 * 60e3).toISOString(), created_by: 'p-teacher', created_at: new Date(open).toISOString(),
  });
  ['present', 'present', 'late', 'present', null, 'leave', 'present'].forEach((st, i) => {
    if (!st) return;
    const at = st === 'leave' ? null : new Date(open + (st === 'late' ? 12 : 2 + i) * 60e3).toISOString();
    db.att_records.push({ session_id: 'demo-att-1', profile_id: `p-demo-${i}`, status: st, checked_at: at, edited: st === 'leave' });
  });
  return db;
}

function load() {
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { db = seed(); }
  // ข้อมูลทดลองที่บันทึกไว้ก่อนมีระบบเช็คชื่อ
  db.att_sessions ??= [];
  db.att_records ??= [];
  db.att_failures ??= [];
  return db;
}
function save(db) { localStorage.setItem(KEY, JSON.stringify(db)); }
export function reset() { localStorage.removeItem(KEY); }

function profileJson(p) {
  return {
    id: p.id, display_name: p.display_name, picture_url: p.picture_url, full_name: p.full_name,
    student_code: p.student_code, role: p.role, registered: p.full_name != null, created_at: p.created_at,
  };
}
// แต้มสะสม: เช็คชื่อ (มา 10, สาย 5) + คะแนนข้อสอบที่ส่งแล้ว (ให้ตรงกับ qz_points ใน schema.sql)
const CHECKIN_POINTS = { present: 10, late: 5 };
function pointsJson(db, p) {
  const checkin = db.att_records.filter((r) => r.profile_id === p.id).reduce((s, r) => s + (CHECKIN_POINTS[r.status] ?? 0), 0);
  const exam = db.attempts.filter((a) => a.profile_id === p.id && a.submitted_at).reduce((s, a) => s + (a.score ?? 0), 0);
  return { total: checkin + exam, checkin, exam };
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

// ---------- ทำข้อสอบ (เหมือน qz_attempt_json / qz_exam_paper) ----------
function student(db) {
  const p = myProfile(db);
  if (p.full_name == null) fail('กรุณาลงทะเบียนก่อนเข้าสอบ');
  return p;
}
function attemptJson(db, a, e) {
  const done = !!a.submitted_at;
  const pct = !done ? null : a.max_score ? Math.round((a.score * 100) / a.max_score) : 0;
  return {
    status: done ? 'submitted' : 'in_progress', started_at: a.started_at, deadline_at: a.deadline_at, submitted_at: a.submitted_at,
    score: a.score ?? null, max_score: a.max_score ?? null, correct_count: a.correct_count ?? null,
    question_count: examQuestions(db, e.id).length, percent: pct,
    passed: done ? (a.max_score ? (a.score * 100) / a.max_score : 0) >= e.pass_percent : null,
    is_late: a.is_late, exam_title: e.title, exam_id: e.id, pass_percent: e.pass_percent,
  };
}
function paper(db, a, e) {
  return {
    status: 'in_progress',
    exam: { id: e.id, title: e.title, duration_minutes: e.duration_minutes, pass_percent: e.pass_percent },
    started_at: a.started_at, deadline_at: a.deadline_at, server_now: nowIso(),
    questions: examQuestions(db, e.id).map((q) => ({
      id: q.id, order_no: q.order_no, question_text: q.question_text, points: q.points,
      options: ['A', 'B', 'C', 'D'].map((k) => ({ key: k, text: q[`option_${k.toLowerCase()}`] })).filter((o) => o.text != null),
    })),
  };
}

// ---------- เช็คชื่อ (เหมือน qz_att_* ใน schema.sql) ----------
const byStudent = (x, y) => (x.student_code ?? '￿').localeCompare(y.student_code ?? '￿') || String(x.full_name).localeCompare(String(y.full_name));
function findSession(db, id) { return db.att_sessions.find((s) => s.id === id) || fail('ไม่พบคาบเช็คชื่อนี้'); }
function attRoster(db, s) {
  const recs = db.att_records.filter((r) => r.session_id === s.id);
  const open = Date.now() < Date.parse(s.closes_at);
  return db.profiles
    .filter((p) => (p.role === 'student' && p.full_name != null && p.created_at <= s.closes_at) || recs.some((r) => r.profile_id === p.id))
    .sort(byStudent)
    .map((p) => {
      const r = recs.find((x) => x.profile_id === p.id);
      return {
        profile_id: p.id, student_code: p.student_code, full_name: p.full_name, display_name: p.display_name,
        status: r ? r.status : open ? 'pending' : 'absent', checked_at: r?.checked_at ?? null, edited: !!r?.edited,
      };
    });
}
function attJson(db, s) {
  const rows = attRoster(db, s);
  const n = (st) => rows.filter((r) => r.status === st).length;
  return {
    id: s.id, title: s.title, code: s.code, opens_at: s.opens_at, late_at: s.late_at, closes_at: s.closes_at,
    status: Date.now() < Date.parse(s.closes_at) ? 'open' : 'closed', server_now: nowIso(),
    counts: { total: rows.length, present: n('present'), late: n('late'), absent: n('absent'), leave: n('leave'), pending: n('pending') },
  };
}
function attDetail(db, id) {
  const s = findSession(db, id);
  return { ...attJson(db, s), rows: attRoster(db, s) };
}

// ---------- action (ชื่อเดียวกับ server) ----------
const H = {
  me(db) {
    let p = db.profiles.find((x) => x.line_user_id === ME.line);
    if (!p) {
      p = { id: uuid(), line_user_id: ME.line, display_name: ME.name, picture_url: null, full_name: null, student_code: null, role: 'student', created_at: nowIso() };
      db.profiles.push(p);
    }
    return { ...profileJson(p), points: pointsJson(db, p) };
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
    return { ...profileJson(p), points: pointsJson(db, p) };
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

  exam_results(db, d) {
    teacher(db);
    const e = findExam(db, d.exam_id);
    const qs = examQuestions(db, e.id);
    const at = db.attempts.filter((a) => a.exam_id === e.id);
    const done = at.filter((a) => a.submitted_at);
    const pctOf = (a) => (a.max_score ? (a.score * 100) / a.max_score : 0);
    const people = db.profiles.filter((p) => (p.role === 'student' && p.full_name != null) || at.some((a) => a.profile_id === p.id));
    const rows = people.map((p) => {
      const a = at.find((x) => x.profile_id === p.id);
      const st = !a ? 'not_started' : a.submitted_at ? 'submitted' : Date.now() > Date.parse(a.deadline_at) + 60e3 ? 'expired' : 'in_progress';
      return {
        student_code: p.student_code, full_name: p.full_name, display_name: p.display_name, status: st,
        score: a?.score ?? null, max_score: a?.max_score ?? null, correct_count: a?.correct_count ?? null,
        percent: a?.submitted_at ? Math.round(pctOf(a)) : null, passed: a?.submitted_at ? pctOf(a) >= e.pass_percent : null,
        started_at: a?.started_at ?? null, submitted_at: a?.submitted_at ?? null, is_late: !!a?.is_late,
      };
    }).sort((x, y) => (x.student_code ?? '￿').localeCompare(y.student_code ?? '￿') || String(x.full_name).localeCompare(String(y.full_name)));
    const scores = done.map((a) => a.score);
    const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
    return {
      exam: { id: e.id, title: e.title, duration_minutes: e.duration_minutes, pass_percent: e.pass_percent, open_at: e.open_at, close_at: e.close_at, status: status(e), question_count: qs.length, max_score: qs.reduce((s, q) => s + q.points, 0) },
      summary: {
        student_count: rows.length, started_count: at.length, submitted_count: done.length,
        avg_score: done.length ? Math.round(avg(scores) * 10) / 10 : null,
        max_score_got: done.length ? Math.max(...scores) : null, min_score_got: done.length ? Math.min(...scores) : null,
        avg_percent: done.length ? Math.round(avg(done.map(pctOf))) : null,
        pass_count: done.filter((a) => pctOf(a) >= e.pass_percent).length, late_count: at.filter((a) => a.is_late).length,
      },
      rows,
      questions: qs.map((q) => {
        const n = done.length;
        const count = (k) => done.filter((a) => a.answers[q.id] === k).length;
        const correct = count(q.correct_answer);
        const choices = { A: count('A'), B: count('B'), C: count('C'), D: count('D') };
        choices.none = n - choices.A - choices.B - choices.C - choices.D;
        return {
          order_no: q.order_no, question_text: q.question_text, correct_answer: q.correct_answer, points: q.points,
          option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d,
          submitted: n, correct, wrong_percent: n ? Math.round(((n - correct) * 100) / n) : 0, choices,
        };
      }),
    };
  },

  // ---------- นักเรียน: ทำข้อสอบ ----------
  list_exams(db) {
    const p = student(db);
    return [...db.exams].sort((a, b) => b.created_at.localeCompare(a.created_at)).flatMap((e) => {
      const a = db.attempts.find((x) => x.exam_id === e.id && x.profile_id === p.id);
      const qs = examQuestions(db, e.id);
      if (!a && !(e.is_published && ['open', 'scheduled'].includes(status(e)) && qs.length)) return [];
      return [{
        id: e.id, title: e.title, description: e.description, duration_minutes: e.duration_minutes, pass_percent: e.pass_percent,
        open_at: e.open_at, close_at: e.close_at, status: status(e), question_count: qs.length,
        max_score: qs.reduce((s, q) => s + q.points, 0), attempt: a ? attemptJson(db, a, e) : null,
      }];
    });
  },

  start_exam(db, d) {
    const p = student(db);
    const e = findExam(db, d.exam_id);
    let a = db.attempts.find((x) => x.exam_id === e.id && x.profile_id === p.id);
    if (a) return a.submitted_at ? { status: 'submitted', result: attemptJson(db, a, e) } : paper(db, a, e);
    const s = status(e);
    if (s === 'draft') fail('ชุดสอบนี้ยังไม่เปิดให้สอบ');
    if (s === 'scheduled') fail('ยังไม่ถึงเวลาเปิดสอบ');
    if (s === 'closed') fail('ชุดสอบนี้ปิดรับคำตอบแล้ว');
    if (!examQuestions(db, e.id).length) fail('ชุดสอบนี้ยังไม่มีข้อสอบ');
    const now = Date.now();
    const end = Math.min(now + e.duration_minutes * 60e3, e.close_at ? Date.parse(e.close_at) : Infinity);
    a = { id: uuid(), exam_id: e.id, profile_id: p.id, started_at: new Date(now).toISOString(), deadline_at: new Date(end).toISOString(), submitted_at: null, answers: {}, score: null, max_score: null, correct_count: null, is_late: false };
    db.attempts.push(a);
    return paper(db, a, e);
  },

  submit_exam(db, d) {
    const p = student(db);
    const e = findExam(db, d.exam_id);
    const a = db.attempts.find((x) => x.exam_id === e.id && x.profile_id === p.id) || fail('ยังไม่ได้เริ่มสอบชุดนี้');
    if (a.submitted_at) return { status: 'submitted', result: attemptJson(db, a, e), points: pointsJson(db, p) };
    const given = d.answers && typeof d.answers === 'object' ? d.answers : {};
    const qs = examQuestions(db, e.id);
    const clean = {};
    qs.forEach((q) => {
      const ans = String(given[q.id] ?? '').toUpperCase();
      if (['A', 'B'].includes(ans) || (ans === 'C' && q.option_c) || (ans === 'D' && q.option_d)) clean[q.id] = ans;
    });
    const right = qs.filter((q) => clean[q.id] === q.correct_answer);
    Object.assign(a, {
      submitted_at: nowIso(), answers: clean, score: right.reduce((s, q) => s + q.points, 0),
      max_score: qs.reduce((s, q) => s + q.points, 0), correct_count: right.length,
      is_late: Date.now() > Date.parse(a.deadline_at) + 60e3,
    });
    return { status: 'submitted', result: attemptJson(db, a, e), points: pointsJson(db, p) };
  },

  // ---------- เช็คชื่อเข้าเรียน ----------
  att_open(db, d) {
    const t = teacher(db);
    const x = d.session || {};
    let title = String(x.title ?? '').trim();
    const min = String(x.minutes ?? '') === '' ? 15 : toInt(x.minutes);
    const lateRaw = String(x.late_minutes ?? '');
    const late = lateRaw === '' ? null : toInt(lateRaw);
    if (!title) title = `เช็คชื่อ ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '')}`;
    if (title.length > 200) fail('ชื่อคาบยาวเกิน 200 ตัวอักษร');
    if (min == null || min < 1 || min > 240) fail('เวลาเปิดเช็คชื่อต้องอยู่ระหว่าง 1–240 นาที');
    if (lateRaw !== '' && (late == null || late < 0)) fail('เวลานับสายต้องเป็นตัวเลข 0 ขึ้นไป');
    let code;
    do { code = String(Math.floor(Math.random() * 10000)).padStart(4, '0'); }
    while (db.att_sessions.some((s) => s.code === code && Date.parse(s.closes_at) > Date.now()));
    const now = Date.now();
    const s = {
      id: uuid(), title, code, opens_at: new Date(now).toISOString(),
      late_at: new Date(now + Math.min(late ?? min, min) * 60e3).toISOString(),
      closes_at: new Date(now + min * 60e3).toISOString(), created_by: t.id, created_at: nowIso(),
    };
    db.att_sessions.push(s);
    return attDetail(db, s.id);
  },

  att_list(db) {
    teacher(db);
    return [...db.att_sessions].sort((a, b) => b.opens_at.localeCompare(a.opens_at)).map((s) => attJson(db, s));
  },

  att_detail(db, d) {
    teacher(db);
    return attDetail(db, d.session_id);
  },

  att_set(db, d) {
    teacher(db);
    findSession(db, d.session_id);
    if (!db.profiles.some((p) => p.id === d.profile_id && p.role === 'student')) fail('ไม่พบนักเรียนคนนี้');
    const i = db.att_records.findIndex((r) => r.session_id === d.session_id && r.profile_id === d.profile_id);
    if (d.status === 'none') {
      if (i >= 0) db.att_records.splice(i, 1);
    } else if (['present', 'late', 'absent', 'leave'].includes(d.status)) {
      if (i >= 0) Object.assign(db.att_records[i], { status: d.status, edited: true });
      else db.att_records.push({ session_id: d.session_id, profile_id: d.profile_id, status: d.status, checked_at: null, edited: true });
    } else fail('สถานะไม่ถูกต้อง');
    return attDetail(db, d.session_id);
  },

  att_close(db, d) {
    teacher(db);
    const s = findSession(db, d.session_id);
    const end = new Date(Math.max(Date.now(), Date.parse(s.opens_at) + 1000)).toISOString();
    if (end < s.closes_at) s.closes_at = end;
    if (end < s.late_at) s.late_at = end;
    return attDetail(db, s.id);
  },

  att_delete(db, d) {
    teacher(db);
    findSession(db, d.session_id);
    db.att_sessions = db.att_sessions.filter((s) => s.id !== d.session_id);
    db.att_records = db.att_records.filter((r) => r.session_id !== d.session_id);
    return { deleted: true };
  },

  att_report(db) {
    teacher(db);
    const sessions = [...db.att_sessions].sort((a, b) => a.opens_at.localeCompare(b.opens_at));
    const students = db.profiles
      .filter((p) => (p.role === 'student' && p.full_name != null) || db.att_records.some((r) => r.profile_id === p.id))
      .sort(byStudent)
      .map((p) => ({ id: p.id, student_code: p.student_code, full_name: p.full_name ?? p.display_name }));
    return {
      sessions: sessions.map((s) => ({ id: s.id, title: s.title, opens_at: s.opens_at })),
      students,
      cells: sessions.flatMap((s) => attRoster(db, s).map((r) => ({ session_id: s.id, profile_id: r.profile_id, status: r.status }))),
    };
  },

  att_checkin(db, d) {
    const p = student(db);
    if (p.role !== 'student') fail('เช็คชื่อได้เฉพาะบัญชีนักเรียน');
    const now = Date.now();
    db.att_failures = db.att_failures.filter((f) => f.profile_id !== p.id || Date.parse(f.at) >= now - 10 * 60e3);
    const fails = db.att_failures.filter((f) => f.profile_id === p.id).length;
    if (fails >= 5) fail('ใส่รหัสผิดหลายครั้ง รอ 10 นาทีแล้วลองใหม่ หรือแจ้งครู');
    const code = String(d.code ?? '').replace(/[๐-๙]/g, (c) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(c))).replace(/\D/g, '');
    if (code.length !== 4) fail('รหัสเช็คชื่อมี 4 หลัก');
    const s = db.att_sessions
      .filter((x) => x.code === code && Date.parse(x.opens_at) <= now && Date.parse(x.closes_at) > now)
      .sort((a, b) => b.opens_at.localeCompare(a.opens_at))[0];
    if (!s) {
      if (db.att_sessions.some((x) => x.code === code && Date.parse(x.closes_at) <= now && Date.parse(x.closes_at) > now - 3 * 3600e3)) {
        fail('หมดเวลาเช็คชื่อคาบนี้แล้ว แจ้งครูได้เลย');
      }
      db.att_failures.push({ profile_id: p.id, at: nowIso() });
      return { result: 'wrong_code', attempts_left: 4 - fails };
    }
    const r = db.att_records.find((x) => x.session_id === s.id && x.profile_id === p.id);
    if (r) return { result: 'already', status: r.status, checked_at: r.checked_at, title: s.title };
    const rec = { session_id: s.id, profile_id: p.id, status: now > Date.parse(s.late_at) ? 'late' : 'present', checked_at: nowIso(), edited: false };
    db.att_records.push(rec);
    return { result: 'ok', status: rec.status, checked_at: rec.checked_at, title: s.title, earned: CHECKIN_POINTS[rec.status] ?? 0, points: pointsJson(db, p) };
  },

  att_history(db) {
    const p = student(db);
    const rows = [...db.att_sessions].sort((a, b) => b.opens_at.localeCompare(a.opens_at)).flatMap((s) => {
      const r = attRoster(db, s).find((x) => x.profile_id === p.id);
      return r ? [{
        id: s.id, title: s.title, opens_at: s.opens_at, closes_at: s.closes_at,
        session_status: Date.now() < Date.parse(s.closes_at) ? 'open' : 'closed', status: r.status, checked_at: r.checked_at,
      }] : [];
    }).slice(0, 200);
    const n = (st) => rows.filter((r) => r.status === st).length;
    return { rows, summary: { present: n('present'), late: n('late'), absent: n('absent'), leave: n('leave') } };
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
