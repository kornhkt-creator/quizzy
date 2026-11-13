// Phase 4: ผลสอบ
import assert from 'node:assert/strict';

export default async function (ctx) {
  const { api, asService, rejects, test } = ctx;
  console.log('Phase 4: ผลสอบ');
  const examId = ctx.examId;

  await test('นักเรียนดูผลสอบของชั้นไม่ได้', async () => {
    await rejects(api('api_exam_results', 'U-stu1', examId), /สำหรับครูเท่านั้น/);
  });

  await test('สรุปผล: ส่งแล้ว เฉลี่ย สูงสุด ต่ำสุด จำนวนผ่าน และส่งช้า', async () => {
    const r = await api('api_exam_results', 'U-teach', examId);
    // จาก phase 3: U-stu1 ได้ 2/5, U-stu3 ได้ 5/5 (ส่งช้า), U-stu4 ไม่ได้เริ่มชุดนี้
    assert.equal(r.summary.submitted_count, 2);
    assert.equal(Number(r.summary.avg_score), 3.5);
    assert.equal(r.summary.max_score_got, 5);
    assert.equal(r.summary.min_score_got, 2);
    assert.equal(r.summary.pass_count, 1);
    assert.equal(r.summary.late_count, 1);
    assert.equal(r.exam.max_score, 5);
  });

  await test('รายคน: มีนักเรียนที่ยังไม่เริ่มด้วย และสถานะถูกต้อง', async () => {
    const r = await api('api_exam_results', 'U-teach', examId);
    const by = Object.fromEntries(r.rows.map((x) => [x.student_code, x]));
    assert.equal(by['65012'].status, 'submitted');
    assert.equal(by['65012'].percent, 40);
    assert.equal(by['65012'].passed, false);
    assert.equal(by['65099'].is_late, true);
    assert.equal(by['65100'].status, 'not_started');
    assert.equal(r.rows.some((x) => x.full_name === 'ครูสมศรี'), false, 'ครูไม่อยู่ในรายชื่อนักเรียน');
  });

  await test('เริ่มแล้วไม่ส่งจนเลยเวลา แสดงเป็น expired', async () => {
    await api('api_start_exam', 'U-stu4', examId);
    await asService(`update attempts set deadline_at = now() - interval '10 minutes' where exam_id = $1 and profile_id = (select id from profiles where line_user_id = 'U-stu4')`, [examId]);
    const r = await api('api_exam_results', 'U-teach', examId);
    assert.equal(r.rows.find((x) => x.student_code === '65100').status, 'expired');
    assert.equal(r.summary.submitted_count, 2, 'คนที่ไม่ส่งไม่ถูกนับในค่าเฉลี่ย');
  });

  await test('วิเคราะห์รายข้อ: นับคนตอบถูกและตัวเลือกที่เลือก', async () => {
    const r = await api('api_exam_results', 'U-teach', examId);
    const [q1, q2, q3, q4] = r.questions;
    // U-stu1 ตอบ A, C, (ไม่ตอบ), A · U-stu3 ตอบ A, C, B, B
    assert.deepEqual([q1.submitted, q1.correct, q1.wrong_percent], [2, 2, 0]);
    assert.deepEqual([q3.correct, q3.wrong_percent, q3.choices.none], [1, 50, 1]);
    assert.deepEqual(q4.choices, { A: 1, B: 1, C: 0, D: 0, none: 0 });
    assert.equal(q2.correct_answer, 'C');
  });
}
