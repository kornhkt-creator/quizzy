// =========================================================
// Excel: ดาวน์โหลด Template, อ่านไฟล์ข้อสอบ, Export ผลสอบ
// ใช้ SheetJS (โหลดจาก CDN ทางการเมื่อจำเป็นเท่านั้น)
// =========================================================
import { fmtDate } from './ui.js';

const XLSX_URL = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs';
let XLSX;
async function loadXLSX() {
  try {
    XLSX ??= await import(XLSX_URL);
  } catch {
    throw new Error('โหลดตัวอ่าน Excel ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่');
  }
  return XLSX;
}

export const MAX_ROWS = 200;
export const COLUMNS = ['question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer', 'points', 'explanation'];

// หัวคอลัมน์ภาษาไทยที่รับได้ด้วย
const ALIASES = {
  question_text: ['question_text', 'คำถาม', 'โจทย์', 'question'],
  option_a: ['option_a', 'a', 'ก', 'ตัวเลือก ก', 'ตัวเลือกก', 'ตัวเลือก a'],
  option_b: ['option_b', 'b', 'ข', 'ตัวเลือก ข', 'ตัวเลือกข', 'ตัวเลือก b'],
  option_c: ['option_c', 'c', 'ค', 'ตัวเลือก ค', 'ตัวเลือกค', 'ตัวเลือก c'],
  option_d: ['option_d', 'd', 'ง', 'ตัวเลือก ง', 'ตัวเลือกง', 'ตัวเลือก d'],
  correct_answer: ['correct_answer', 'เฉลย', 'คำตอบ', 'คำตอบที่ถูก', 'answer'],
  points: ['points', 'คะแนน', 'score'],
  explanation: ['explanation', 'คำอธิบาย', 'คำอธิบายเฉลย'],
};
const norm = (v) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

// ---------- Template ----------
export async function downloadTemplate() {
  const X = await loadXLSX();
  const ws = X.utils.aoa_to_sheet([
    COLUMNS,
    ['1/2 + 1/4 = ?', '3/4', '2/6', '1/6', '2/4', 'A', 1, 'นำส่วนมาทำให้เท่ากันก่อน'],
    ['ข้อใดเป็นสัตว์เลี้ยงลูกด้วยนม', 'ปลาทู', 'กบ', 'แมว', 'ไก่', 'C', 1, ''],
    ['ดวงอาทิตย์ขึ้นทางทิศตะวันออก', 'ถูก', 'ผิด', '', '', 'A', 1, ''],
  ]);
  ws['!cols'] = [{ wch: 44 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 15 }, { wch: 8 }, { wch: 30 }];
  const help = X.utils.aoa_to_sheet([
    ['วิธีกรอกข้อสอบ'],
    ['1 แถว = 1 ข้อ เริ่มกรอกแถวที่ 2 ต่อจากตัวอย่างได้เลย (ลบตัวอย่างออกก่อนนำเข้า)'],
    ['question_text = คำถาม (ต้องมี)'],
    ['option_a, option_b = ตัวเลือก ก และ ข (ต้องมี) · option_c, option_d = ตัวเลือก ค และ ง (เว้นว่างได้)'],
    ['correct_answer = เฉลย ใส่ A, B, C, D หรือ ก, ข, ค, ง'],
    ['points = คะแนนของข้อนั้น (เว้นว่าง = 1 คะแนน)'],
    ['explanation = คำอธิบายเฉลย ครูเห็นคนเดียว (เว้นว่างได้)'],
    [`นำเข้าได้ครั้งละไม่เกิน ${MAX_ROWS} ข้อ`],
    ['ถ้าพิมพ์เศษส่วน เช่น 1/2 แล้ว Excel เปลี่ยนเป็นวันที่ ให้พิมพ์ \' นำหน้า เช่น \'1/2'],
  ]);
  help['!cols'] = [{ wch: 90 }];
  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, ws, 'ข้อสอบ');
  X.utils.book_append_sheet(wb, help, 'วิธีกรอก');
  X.writeFile(wb, 'quizzy-template.xlsx');
}

// ---------- ตรวจข้อสอบ 1 ข้อ (กฎเดียวกับ server) ----------
export function checkQuestion(q) {
  const errors = [];
  const s = (v) => String(v ?? '').trim();
  const ans = s(q.correct_answer).toUpperCase().replace(/[กขคง]/g, (ch) => 'ABCD'['กขคง'.indexOf(ch)]);
  const pts = s(q.points);
  if (!s(q.question_text)) errors.push('ไม่มีคำถาม');
  else if (s(q.question_text).length > 2000) errors.push('คำถามยาวเกิน 2000 ตัวอักษร');
  if (!s(q.option_a) || !s(q.option_b)) errors.push('ต้องมีตัวเลือก A และ B');
  if (s(q.option_d) && !s(q.option_c)) errors.push('มีตัวเลือก D แต่ไม่มี C');
  if (['option_a', 'option_b', 'option_c', 'option_d'].some((k) => s(q[k]).length > 500)) errors.push('ตัวเลือกยาวเกิน 500 ตัวอักษร');
  if (!['A', 'B', 'C', 'D'].includes(ans)) errors.push('เฉลยต้องเป็น A–D หรือ ก–ง');
  else if ((ans === 'C' && !s(q.option_c)) || (ans === 'D' && !s(q.option_d))) errors.push('เฉลยชี้ไปที่ตัวเลือกที่ว่าง');
  if (pts !== '' && !(/^\d+$/.test(pts) && Number(pts) >= 1 && Number(pts) <= 100)) errors.push('คะแนนต้องเป็นตัวเลข 1–100');
  return errors;
}

// ---------- อ่านไฟล์ข้อสอบ ----------
// คืนค่า [{ rowNo, q, errors }] โดย rowNo = เลขแถวใน Excel
export async function readQuestionFile(file) {
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error('รองรับเฉพาะไฟล์ .xlsx, .xls หรือ .csv');
  if (file.size > 2 * 1024 * 1024) throw new Error('ไฟล์ใหญ่เกิน 2 MB');
  const X = await loadXLSX();
  let wb;
  try { wb = X.read(await file.arrayBuffer()); } catch { throw new Error('อ่านไฟล์ไม่ได้ ไฟล์อาจเสียหรือไม่ใช่ Excel'); }
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const aoa = X.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false, blankrows: true });
  return parseRows(aoa);
}

export function parseRows(aoa) {
  const headerAt = aoa.findIndex((r) => r.some((c) => norm(c)));
  if (headerAt < 0) throw new Error('ไฟล์ว่าง ไม่พบข้อมูล');
  const header = aoa[headerAt].map(norm);
  const col = {};
  for (const [key, names] of Object.entries(ALIASES)) {
    const i = header.findIndex((h) => names.includes(h));
    if (i >= 0) col[key] = i;
  }
  const missing = ['question_text', 'option_a', 'option_b', 'correct_answer'].filter((k) => col[k] == null);
  if (missing.length) throw new Error(`ไม่พบคอลัมน์ ${missing.join(', ')} ในแถวแรก กรุณาใช้ Template ของ Quizzy`);

  const rows = [];
  aoa.slice(headerAt + 1).forEach((r, i) => {
    if (!r.some((c) => String(c ?? '').trim())) return; // ข้ามแถวว่าง
    const q = {};
    for (const key of COLUMNS) q[key] = col[key] == null ? '' : String(r[col[key]] ?? '').trim();
    rows.push({ rowNo: headerAt + i + 2, q, errors: checkQuestion(q) });
  });
  if (!rows.length) throw new Error('ไม่พบข้อสอบในไฟล์ (มีแต่หัวคอลัมน์)');
  if (rows.length > MAX_ROWS) throw new Error(`ไฟล์มี ${rows.length} ข้อ นำเข้าได้ครั้งละไม่เกิน ${MAX_ROWS} ข้อ`);
  return rows;
}

// ---------- Export ผลสอบ ----------
const STATUS_TEXT = { submitted: 'ส่งแล้ว', in_progress: 'กำลังทำ', expired: 'ไม่ได้ส่ง', not_started: 'ยังไม่เริ่ม' };
const LETTER = { A: 'ก', B: 'ข', C: 'ค', D: 'ง' };

export async function exportResults(data) {
  const X = await loadXLSX();
  const { exam, summary, rows, questions } = data;

  const people = X.utils.aoa_to_sheet([
    ['ลำดับ', 'รหัสนักเรียน', 'ชื่อ-นามสกุล', 'คะแนน', 'คะแนนเต็ม', 'ร้อยละ', 'ผลการสอบ', 'สถานะ', 'ส่งเมื่อ', 'ส่งช้า'],
    ...rows.map((r, i) => [
      i + 1, r.student_code ?? '', r.full_name ?? r.display_name ?? '',
      r.score ?? '', r.max_score ?? (r.status === 'submitted' ? exam.max_score : ''), r.percent ?? '',
      r.status === 'submitted' ? (r.passed ? 'ผ่าน' : 'ไม่ผ่าน') : '', STATUS_TEXT[r.status],
      r.submitted_at ? fmtDate(r.submitted_at) : '', r.is_late ? 'ใช่' : '',
    ]),
  ]);
  people['!cols'] = [{ wch: 6 }, { wch: 13 }, { wch: 28 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 11 }, { wch: 18 }, { wch: 7 }];

  const items = X.utils.aoa_to_sheet([
    ['ข้อ', 'คำถาม', 'เฉลย', 'คะแนน', 'ส่งแล้ว (คน)', 'ตอบถูก (คน)', 'ตอบผิด (%)', 'เลือก ก', 'เลือก ข', 'เลือก ค', 'เลือก ง', 'ไม่ตอบ'],
    ...questions.map((q) => [
      q.order_no, q.question_text, LETTER[q.correct_answer], q.points, q.submitted, q.correct, q.wrong_percent,
      q.choices.A, q.choices.B, q.choices.C, q.choices.D, q.choices.none,
    ]),
  ]);
  items['!cols'] = [{ wch: 5 }, { wch: 50 }, { wch: 6 }, { wch: 7 }, { wch: 12 }, { wch: 12 }, { wch: 11 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }];

  const sum = X.utils.aoa_to_sheet([
    ['ชุดสอบ', exam.title],
    ['จำนวนข้อ', exam.question_count],
    ['คะแนนเต็ม', exam.max_score],
    ['เกณฑ์ผ่าน (%)', exam.pass_percent],
    ['นักเรียนทั้งหมด', summary.student_count],
    ['ส่งแล้ว', summary.submitted_count],
    ['ผ่านเกณฑ์', summary.pass_count],
    ['คะแนนเฉลี่ย', summary.avg_score ?? '-'],
    ['คะแนนสูงสุด', summary.max_score_got ?? '-'],
    ['คะแนนต่ำสุด', summary.min_score_got ?? '-'],
    ['ส่งช้า', summary.late_count],
    ['ส่งออกเมื่อ', fmtDate(new Date().toISOString())],
  ]);
  sum['!cols'] = [{ wch: 16 }, { wch: 40 }];

  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, people, 'ผลสอบรายคน');
  X.utils.book_append_sheet(wb, items, 'วิเคราะห์รายข้อ');
  X.utils.book_append_sheet(wb, sum, 'สรุป');
  X.writeFile(wb, `ผลสอบ-${safeName(exam.title)}.xlsx`);
}

const safeName = (t) => String(t).replace(/[\\/:*?"<>|]/g, '-').slice(0, 80);

// ---------- Export เช็คชื่อ ----------
const ATT_TEXT = { present: 'มา', late: 'สาย', absent: 'ขาด', leave: 'ลา', pending: 'ยังไม่เช็ค' };

// คาบเดียว: รายชื่อ + สรุป
export async function exportAttendance(s) {
  const X = await loadXLSX();
  const people = X.utils.aoa_to_sheet([
    ['ลำดับ', 'รหัสนักเรียน', 'ชื่อ-นามสกุล', 'สถานะ', 'เวลาเช็คชื่อ', 'หมายเหตุ'],
    ...s.rows.map((r, i) => [
      i + 1, r.student_code ?? '', r.full_name ?? r.display_name ?? '', ATT_TEXT[r.status],
      r.checked_at ? fmtDate(r.checked_at) : '', r.edited ? 'ครูบันทึก/แก้ไข' : '',
    ]),
  ]);
  people['!cols'] = [{ wch: 6 }, { wch: 13 }, { wch: 28 }, { wch: 10 }, { wch: 18 }, { wch: 16 }];

  const c = s.counts;
  const sum = X.utils.aoa_to_sheet([
    ['คาบ', s.title],
    ['เปิดเช็คชื่อ', fmtDate(s.opens_at)],
    ['ปิดเช็คชื่อ', fmtDate(s.closes_at)],
    ['นับว่าสายหลัง', s.late_at === s.closes_at ? '-' : fmtDate(s.late_at)],
    ['มา', c.present], ['สาย', c.late], ['ขาด', c.absent], ['ลา', c.leave], ['ยังไม่เช็ค', c.pending], ['ทั้งหมด', c.total],
    ['ส่งออกเมื่อ', fmtDate(new Date().toISOString())],
  ]);
  sum['!cols'] = [{ wch: 16 }, { wch: 40 }];

  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, people, 'รายชื่อ');
  X.utils.book_append_sheet(wb, sum, 'สรุป');
  X.writeFile(wb, `เช็คชื่อ-${safeName(s.title)}.xlsx`);
}

// ทุกคาบ: ตารางนักเรียน × คาบ พร้อมรวมจำนวนและร้อยละการมาเรียน
export async function exportAttendanceSummary({ sessions, students, cells }) {
  const X = await loadXLSX();
  const at = new Map(cells.map((c) => [`${c.session_id}|${c.profile_id}`, c.status]));
  const rows = students.map((p, i) => {
    const marks = sessions.map((s) => at.get(`${s.id}|${p.id}`) ?? '');
    const n = (st) => marks.filter((m) => m === st).length;
    const counted = n('present') + n('late') + n('absent'); // ลา และยังไม่เช็ค ไม่นำมาคิด
    return [
      i + 1, p.student_code ?? '', p.full_name ?? '',
      ...marks.map((m) => ATT_TEXT[m] ?? '-'),
      n('present'), n('late'), n('absent'), n('leave'),
      counted ? Math.round(((n('present') + n('late')) * 100) / counted) : '',
    ];
  });
  const table = X.utils.aoa_to_sheet([
    ['ลำดับ', 'รหัสนักเรียน', 'ชื่อ-นามสกุล', ...sessions.map((s) => `${fmtDate(s.opens_at, false)} ${s.title}`), 'มา', 'สาย', 'ขาด', 'ลา', 'ร้อยละการมาเรียน'],
    ...rows,
  ]);
  table['!cols'] = [{ wch: 6 }, { wch: 13 }, { wch: 28 }, ...sessions.map(() => ({ wch: 14 })), { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 16 }];

  const list = X.utils.aoa_to_sheet([
    ['ลำดับ', 'วันที่', 'คาบ'],
    ...sessions.map((s, i) => [i + 1, fmtDate(s.opens_at), s.title]),
    [],
    ['ร้อยละการมาเรียน = (มา + สาย) ÷ (มา + สาย + ขาด) × 100 · ไม่นับคาบที่ลา'],
  ]);
  list['!cols'] = [{ wch: 8 }, { wch: 18 }, { wch: 50 }];

  const wb = X.utils.book_new();
  X.utils.book_append_sheet(wb, table, 'สรุปการเข้าเรียน');
  X.utils.book_append_sheet(wb, list, 'รายการคาบ');
  X.writeFile(wb, `สรุปเช็คชื่อ-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
