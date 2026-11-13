// Phase 2: ครูจัดการชุดสอบ
import assert from 'node:assert/strict';

export const Q = (text, ans = 'A', extra = {}) => ({
  question_text: text, option_a: 'ก1', option_b: 'ข1', option_c: 'ค1', option_d: 'ง1', correct_answer: ans, points: 1, ...extra,
});

export default async function (ctx) {
  const { api, rejects, test } = ctx;
  console.log('Phase 2: ครูจัดการชุดสอบ');
  let examId;

  await test('นักเรียนเรียกฟังก์ชันของครูไม่ได้', async () => {
    await rejects(api('api_teacher_list_exams', 'U-stu1'), /สำหรับครูเท่านั้น/);
    await rejects(api('api_save_exam', 'U-stu1', { title: 'x', duration_minutes: 10 }), /สำหรับครูเท่านั้น/);
  });

  await test('สร้างชุดสอบใหม่ (ค่าเริ่มต้น: ยังไม่เผยแพร่ เกณฑ์ผ่าน 50%)', async () => {
    const e = await api('api_save_exam', 'U-teach', { title: ' บทที่ 3 เศษส่วน ', duration_minutes: '15' });
    examId = e.id;
    assert.equal(e.title, 'บทที่ 3 เศษส่วน');
    assert.equal(e.is_published, false);
    assert.equal(e.status, 'draft');
    assert.equal(e.pass_percent, 50);
    assert.deepEqual(e.questions, []);
  });

  await test('ตรวจข้อมูลชุดสอบ', async () => {
    await rejects(api('api_save_exam', 'U-teach', { title: '', duration_minutes: 10 }), /ตั้งชื่อ/);
    await rejects(api('api_save_exam', 'U-teach', { title: 'x', duration_minutes: 0 }), /1–300 นาที/);
    await rejects(api('api_save_exam', 'U-teach', { title: 'x', duration_minutes: 'abc' }), /1–300 นาที/);
    await rejects(api('api_save_exam', 'U-teach', { title: 'x', duration_minutes: 10, pass_percent: 120 }), /0–100%/);
    await rejects(api('api_save_exam', 'U-teach', { title: 'x', duration_minutes: 10, open_at: '2026-11-20T10:00:00Z', close_at: '2026-11-20T09:00:00Z' }), /หลังเวลาเปิด/);
    await rejects(api('api_save_exam', 'U-teach', { title: 'x', duration_minutes: 10, open_at: 'พรุ่งนี้' }), /รูปแบบเวลาเปิด/);
  });

  await test('เผยแพร่ชุดสอบที่ไม่มีข้อสอบไม่ได้', async () => {
    await rejects(api('api_set_published', 'U-teach', examId, true), /อย่างน้อย 1 ข้อ/);
  });

  await test('บันทึกข้อสอบแบบแทนที่ทั้งชุด เรียงลำดับ และแปลงเฉลย ก–ง เป็น A–D', async () => {
    const e = await api('api_save_questions', 'U-teach', examId, [
      Q('1/2 + 1/4 = ?', 'a'),
      Q('ข้อใดเท่ากับ 3/4', 'ค'),
      { question_text: 'ถูกหรือผิด', option_a: 'ถูก', option_b: 'ผิด', option_c: ' ', option_d: '', correct_answer: 'B', points: '2' },
    ], 'replace');
    assert.deepEqual(e.questions.map((q) => [q.order_no, q.correct_answer, q.points]), [[1, 'A', 1], [2, 'C', 1], [3, 'B', 2]]);
    assert.equal(e.questions[2].option_c, null, 'ตัวเลือกว่างต้องเป็น null');
  });

  await test('ข้อสอบผิดข้อเดียว ไม่บันทึกทั้งชุด และบอกเลขข้อ', async () => {
    await rejects(api('api_save_questions', 'U-teach', examId, [Q('ok'), Q('bad', 'E')], 'replace'), /ข้อ 2: เฉลยต้องเป็น/);
    const e = await api('api_get_exam', 'U-teach', examId);
    assert.equal(e.questions.length, 3, 'ข้อสอบเดิมต้องยังอยู่ครบ');
  });

  await test('ตรวจข้อสอบแต่ละแบบที่ผิด', async () => {
    const bad = [
      [{ ...Q(''), question_text: ' ' }, /กรอกคำถาม/],
      [{ ...Q('x'), option_b: '' }, /A และ B/],
      [{ ...Q('x'), option_c: '', option_d: 'มี' }, /มีตัวเลือก D แต่ไม่มี/],
      [{ ...Q('x', 'D'), option_d: '' }, /ตัวเลือกที่ว่าง/],
      [{ ...Q('x'), points: 'สอง' }, /คะแนนต้องเป็นตัวเลข/],
      [{ ...Q('x'), points: 0 }, /คะแนนต้องเป็นตัวเลข/],
    ];
    for (const [q, re] of bad) await rejects(api('api_save_questions', 'U-teach', examId, [q], 'append'), re);
  });

  await test('append ต่อท้ายลำดับเดิม', async () => {
    const e = await api('api_save_questions', 'U-teach', examId, [Q('ข้อที่สี่', 'B')], 'append');
    assert.deepEqual(e.questions.map((q) => q.order_no), [1, 2, 3, 4]);
  });

  await test('เผยแพร่แล้วสถานะเป็น open และลบข้อสอบจนหมดไม่ได้', async () => {
    const e = await api('api_set_published', 'U-teach', examId, true);
    assert.equal(e.status, 'open');
    await rejects(api('api_save_questions', 'U-teach', examId, [], 'replace'), /อย่างน้อย 1 ข้อ/);
  });

  await test('สถานะ scheduled / closed ตามเวลา', async () => {
    const future = new Date(Date.now() + 86400e3).toISOString();
    const past = new Date(Date.now() - 3600e3).toISOString();
    const s = await api('api_save_exam', 'U-teach', { title: 'อนาคต', duration_minutes: 10, open_at: future });
    await api('api_save_questions', 'U-teach', s.id, [Q('x')], 'replace');
    assert.equal((await api('api_set_published', 'U-teach', s.id, true)).status, 'scheduled');
    const c = await api('api_save_exam', 'U-teach', { title: 'ปิดแล้ว', duration_minutes: 10, close_at: past });
    await api('api_save_questions', 'U-teach', c.id, [Q('x')], 'replace');
    assert.equal((await api('api_set_published', 'U-teach', c.id, true)).status, 'closed');
  });

  await test('รายการชุดสอบของครูมีจำนวนข้อ คะแนนเต็ม และจำนวนนักเรียน', async () => {
    const list = await api('api_teacher_list_exams', 'U-teach');
    const e = list.find((x) => x.id === examId);
    assert.equal(e.question_count, 4);
    assert.equal(e.max_score, 5);
    assert.equal(e.student_count, 1); // U-stu1 ลงทะเบียนแล้วคนเดียว
    assert.equal(e.started_count, 0);
  });

  await test('ลบชุดสอบได้', async () => {
    const x = await api('api_save_exam', 'U-teach', { title: 'ลบทิ้ง', duration_minutes: 5 });
    await api('api_delete_exam', 'U-teach', x.id);
    await rejects(api('api_get_exam', 'U-teach', x.id), /ไม่พบชุดสอบ/);
  });

  ctx.examId = examId; // เก็บไว้ให้ phase ถัดไปใช้ต่อ
}
