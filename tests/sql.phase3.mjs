// Phase 3: นักเรียนทำข้อสอบ
import assert from 'node:assert/strict';

export default async function (ctx) {
  const { api, asService, rejects, test } = ctx;
  console.log('Phase 3: นักเรียนทำข้อสอบ');
  const examId = ctx.examId; // จาก phase 2: เผยแพร่แล้ว 4 ข้อ เฉลย A, C, B, B คะแนน 1,1,2,1
  let paper;

  await test('นักเรียนที่ยังไม่ลงทะเบียนเข้าสอบไม่ได้', async () => {
    await rejects(api('api_list_exams', 'U-stu2'), /ลงทะเบียน/);
    await rejects(api('api_start_exam', 'U-stu2', examId), /ลงทะเบียน/);
  });

  await test('รายการชุดสอบ: เห็นชุดที่เปิดอยู่และยังไม่ถึงเวลา ไม่เห็นฉบับร่างและชุดที่ปิดแล้ว', async () => {
    await api('api_save_exam', 'U-teach', { title: 'ฉบับร่าง', duration_minutes: 5 });
    const list = await api('api_list_exams', 'U-stu1');
    const titles = list.map((e) => e.title);
    assert.ok(titles.includes('บทที่ 3 เศษส่วน'));
    assert.ok(titles.includes('อนาคต'));
    assert.ok(!titles.includes('ฉบับร่าง'));
    assert.ok(!titles.includes('ปิดแล้ว'));
    assert.equal(list.find((e) => e.id === examId).attempt, null);
  });

  await test('เริ่มสอบชุดที่ยังไม่เปิด / ปิดแล้วไม่ได้', async () => {
    const exams = await api('api_teacher_list_exams', 'U-teach');
    const id = (t) => exams.find((e) => e.title === t).id;
    await rejects(api('api_start_exam', 'U-stu1', id('อนาคต')), /ยังไม่ถึงเวลา/);
    await rejects(api('api_start_exam', 'U-stu1', id('ปิดแล้ว')), /ปิดรับคำตอบ/);
    await rejects(api('api_start_exam', 'U-stu1', id('ฉบับร่าง')), /ยังไม่เปิดให้สอบ/);
  });

  await test('เริ่มสอบได้ข้อสอบที่ไม่มีเฉลย และเวลาสิ้นสุด = เริ่ม + เวลาทำข้อสอบ', async () => {
    paper = await api('api_start_exam', 'U-stu1', examId);
    assert.equal(paper.status, 'in_progress');
    assert.equal(paper.questions.length, 4);
    const json = JSON.stringify(paper);
    assert.ok(!json.includes('correct_answer') && !json.includes('explanation'), 'ห้ามมีเฉลยในข้อสอบที่ส่งให้นักเรียน');
    assert.equal(Date.parse(paper.deadline_at) - Date.parse(paper.started_at), 15 * 60e3);
    assert.deepEqual(paper.questions[2].options.map((o) => o.key), ['A', 'B'], 'ตัวเลือกว่างต้องไม่ถูกส่งไป');
  });

  await test('กดเริ่มซ้ำได้ attempt เดิม เวลาเริ่มไม่เปลี่ยน', async () => {
    const again = await api('api_start_exam', 'U-stu1', examId);
    assert.equal(again.started_at, paper.started_at);
    const rows = await asService(`select count(*)::int n from attempts where exam_id = $1`, [examId]);
    assert.equal(rows[0].n, 1);
  });

  await test('เมื่อมีคนเริ่มสอบแล้ว ครูแก้ข้อสอบและเวลาทำข้อสอบไม่ได้', async () => {
    await rejects(api('api_save_questions', 'U-teach', examId, [{ question_text: 'x', option_a: '1', option_b: '2', correct_answer: 'A' }], 'append'), /เริ่มสอบชุดนี้แล้ว/);
    await rejects(api('api_save_exam', 'U-teach', { id: examId, title: 'บทที่ 3 เศษส่วน', duration_minutes: 99 }), /เปลี่ยนเวลาทำข้อสอบไม่ได้/);
    const e = await api('api_save_exam', 'U-teach', { id: examId, title: 'บทที่ 3 เศษส่วน (แก้ชื่อได้)', duration_minutes: 15 });
    assert.equal(e.locked, true);
  });

  await test('ส่งคำตอบ: ตรวจคะแนนถูก ไม่สนคำตอบปลอมหรือข้อที่ไม่อยู่ในชุด', async () => {
    const [q1, q2, q3, q4] = paper.questions.map((q) => q.id);
    const answers = { [q1]: 'a', [q2]: 'C', [q3]: 'D' /* ไม่มีตัวเลือก D */, [q4]: 'A', 'not-a-question': 'A', __proto__: 'x' };
    const r = await api('api_submit_exam', 'U-stu1', examId, answers);
    assert.equal(r.status, 'submitted');
    assert.equal(r.result.score, 2);          // ข้อ 1 (1) + ข้อ 2 (1)
    assert.equal(r.result.max_score, 5);
    assert.equal(r.result.correct_count, 2);
    assert.equal(r.result.percent, 40);
    assert.equal(r.result.passed, false);     // เกณฑ์ 50%
    assert.equal(r.result.is_late, false);
    const rows = await asService(`select answers from attempts where exam_id = $1`, [examId]);
    assert.deepEqual(Object.keys(rows[0].answers).sort(), [q1, q2, q4].sort(), 'เก็บเฉพาะคำตอบที่ถูกต้องตามรูปแบบ');
  });

  await test('ส่งซ้ำได้ผลเดิม แก้คำตอบหลังส่งไม่ได้', async () => {
    const all = Object.fromEntries(paper.questions.map((q, i) => [q.id, ['A', 'C', 'B', 'B'][i]]));
    const r = await api('api_submit_exam', 'U-stu1', examId, all);
    assert.equal(r.result.score, 2);
  });

  await test('หลังส่งแล้ว เปิดชุดสอบอีกครั้งได้ผลสอบ ไม่ได้ข้อสอบ', async () => {
    const r = await api('api_start_exam', 'U-stu1', examId);
    assert.equal(r.status, 'submitted');
    assert.equal(r.questions, undefined);
    const list = await api('api_list_exams', 'U-stu1');
    assert.equal(list.find((e) => e.id === examId).attempt.score, 2);
  });

  await test('ส่งช้ากว่าเวลาเกิน 60 วินาที ยังบันทึกแต่ทำเครื่องหมายส่งช้า', async () => {
    await api('api_me', 'U-stu3', 'Late', null);
    await api('api_register', 'U-stu3', 'ด.ญ.มาสาย', '65099');
    const p = await api('api_start_exam', 'U-stu3', examId);
    await asService(`update attempts set deadline_at = now() - interval '5 minutes' where exam_id = $1 and profile_id = (select id from profiles where line_user_id = 'U-stu3')`, [examId]);
    const all = Object.fromEntries(p.questions.map((q, i) => [q.id, ['A', 'C', 'B', 'B'][i]]));
    const r = await api('api_submit_exam', 'U-stu3', examId, all);
    assert.equal(r.result.is_late, true);
    assert.equal(r.result.score, 5);
    assert.equal(r.result.passed, true);
  });

  await test('ส่งคำตอบโดยไม่ได้เริ่มสอบไม่ได้', async () => {
    await api('api_me', 'U-stu4', 'NoStart', null);
    await api('api_register', 'U-stu4', 'ด.ช.ไม่ได้เริ่ม', '65100');
    await rejects(api('api_submit_exam', 'U-stu4', examId, {}), /ยังไม่ได้เริ่มสอบ/);
  });

  await test('เวลาสิ้นสุดไม่เกินเวลาปิดสอบ', async () => {
    const close = new Date(Date.now() + 5 * 60e3).toISOString();
    const e = await api('api_save_exam', 'U-teach', { title: 'ใกล้ปิด', duration_minutes: 60, close_at: close });
    await api('api_save_questions', 'U-teach', e.id, [{ question_text: 'x', option_a: '1', option_b: '2', correct_answer: 'A' }], 'replace');
    await api('api_set_published', 'U-teach', e.id, true);
    const p = await api('api_start_exam', 'U-stu4', e.id);
    assert.equal(Date.parse(p.deadline_at), Date.parse(close));
  });
}
