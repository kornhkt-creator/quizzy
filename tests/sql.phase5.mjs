// Phase 5: เช็คชื่อเข้าเรียน
// นักเรียนที่ลงทะเบียนแล้วจาก phase ก่อน: U-stu1 (65012), U-stu3 (65099), U-stu4 (65100) · ครู: U-teach
import assert from 'node:assert/strict';

export default async function (ctx) {
  const { db, api, asService, rejects, test } = ctx;
  console.log('Phase 5: เช็คชื่อเข้าเรียน');
  let s; // คาบแรก

  const byCode = (detail) => Object.fromEntries(detail.rows.map((r) => [r.student_code, r]));
  const clearFails = () => asService('delete from att_failures');

  await test('นักเรียนเปิดคาบเช็คชื่อไม่ได้', async () => {
    await rejects(api('api_att_open', 'U-stu1', JSON.stringify({ title: 'แอบเปิด' })), /สำหรับครูเท่านั้น/);
  });

  await test('ครูเปิดคาบ: ได้รหัส 4 หลัก สถานะเปิด และทุกคนยังไม่เช็ค', async () => {
    s = await api('api_att_open', 'U-teach', JSON.stringify({ title: ' ม.4/1 คาบ 2 ', minutes: 15, late_minutes: 10 }));
    assert.match(s.code, /^\d{4}$/);
    assert.equal(s.title, 'ม.4/1 คาบ 2');
    assert.equal(s.status, 'open');
    assert.equal(s.counts.total, 3);
    assert.equal(s.counts.pending, 3);
    assert.equal(s.rows.some((r) => r.full_name === 'ครูสมศรี'), false, 'ครูไม่อยู่ในรายชื่อ');
    const mins = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 60000);
    assert.equal(mins(s.opens_at, s.closes_at), 15);
    assert.equal(mins(s.opens_at, s.late_at), 10);
  });

  await test('ตรวจค่าที่ครูกรอก และไม่ใส่ชื่อคาบได้ชื่ออัตโนมัติ', async () => {
    await rejects(api('api_att_open', 'U-teach', JSON.stringify({ minutes: 0 })), /1–240 นาที/);
    await rejects(api('api_att_open', 'U-teach', JSON.stringify({ minutes: 999 })), /1–240 นาที/);
    await rejects(api('api_att_open', 'U-teach', JSON.stringify({ late_minutes: 'abc' })), /นับสาย/);
    const auto = await api('api_att_open', 'U-teach', JSON.stringify({ minutes: 5, late_minutes: '' }));
    assert.match(auto.title, /^เช็คชื่อ \d{2}\/\d{2}\/\d{4}/);
    assert.equal(auto.late_at, auto.closes_at, 'ไม่ใส่เวลานับสาย = ไม่มีใครสาย');
    assert.notEqual(auto.code, s.code, 'รหัสไม่ซ้ำกับคาบที่ยังเปิดอยู่');
    await api('api_att_delete', 'U-teach', auto.id);
  });

  await test('รหัสผิด: ไม่เช็ค และบอกจำนวนครั้งที่เหลือ', async () => {
    const wrong = s.code === '0000' ? '1111' : '0000';
    const r = await api('api_att_checkin', 'U-stu1', wrong);
    assert.deepEqual(r, { result: 'wrong_code', attempts_left: 4 });
    await rejects(api('api_att_checkin', 'U-stu1', '12'), /4 หลัก/);
    await clearFails();
  });

  await test('รหัสถูก: เช็คเป็น "มา" เช็คซ้ำได้ผลเดิม', async () => {
    const r = await api('api_att_checkin', 'U-stu1', s.code);
    assert.equal(r.result, 'ok');
    assert.equal(r.status, 'present');
    assert.equal(r.title, 'ม.4/1 คาบ 2');
    const again = await api('api_att_checkin', 'U-stu1', s.code);
    assert.equal(again.result, 'already');
    assert.equal(again.status, 'present');
  });

  await test('รับเลขไทยและช่องว่างในรหัส', async () => {
    const thai = s.code.replace(/\d/g, (d) => '๐๑๒๓๔๕๖๗๘๙'[d]);
    const r = await api('api_att_checkin', 'U-stu3', ` ${thai.slice(0, 2)} ${thai.slice(2)} `);
    assert.equal(r.result, 'ok');
  });

  await test('เช็คหลังเวลานับสาย = "สาย"', async () => {
    await asService(`update att_sessions set late_at = now() - interval '1 minute', opens_at = now() - interval '12 minutes' where id = $1`, [s.id]);
    const r = await api('api_att_checkin', 'U-stu4', s.code);
    assert.equal(r.status, 'late');
  });

  await test('ใส่รหัสผิด 5 ครั้งใน 10 นาที ต้องรอ (ถึงรหัสถูกก็ยังเช็คไม่ได้)', async () => {
    await api('api_me', 'U-stu5', 'Guess', null);
    await api('api_register', 'U-stu5', 'ด.ช.สุ่มรหัส', '65200');
    const wrong = s.code === '0000' ? '1111' : '0000';
    for (let i = 0; i < 5; i++) await api('api_att_checkin', 'U-stu5', wrong);
    await rejects(api('api_att_checkin', 'U-stu5', s.code), /รอ 10 นาที/);
    await asService(`update att_failures set at = now() - interval '11 minutes'`);
    assert.equal((await api('api_att_checkin', 'U-stu5', s.code)).result, 'ok', 'ครบ 10 นาทีแล้วเช็คได้');
  });

  await test('ครูดูรายชื่อ: สถานะและจำนวนถูกต้อง', async () => {
    const d = await api('api_att_detail', 'U-teach', s.id);
    const by = byCode(d);
    assert.equal(by['65012'].status, 'present');
    assert.equal(by['65099'].status, 'present');
    assert.equal(by['65100'].status, 'late');
    assert.ok(by['65012'].checked_at);
    assert.equal(by['65200'].status, 'late', 'เช็คหลังเวลานับสาย');
    assert.deepEqual(d.counts, { total: 4, present: 2, late: 2, absent: 0, leave: 0, pending: 0 });
  });

  await test('ครูแก้สถานะได้ และ none = ลบบันทึก', async () => {
    const id4 = byCode(await api('api_att_detail', 'U-teach', s.id))['65100'].profile_id;
    let d = await api('api_att_set', 'U-teach', s.id, id4, 'leave');
    assert.equal(byCode(d)['65100'].status, 'leave');
    assert.equal(byCode(d)['65100'].edited, true);
    d = await api('api_att_set', 'U-teach', s.id, id4, 'none');
    assert.equal(byCode(d)['65100'].status, 'pending');
    await rejects(api('api_att_set', 'U-teach', s.id, id4, 'vip'), /สถานะไม่ถูกต้อง/);
    await rejects(api('api_att_set', 'U-stu1', s.id, id4, 'present'), /สำหรับครูเท่านั้น/);
    const teacherId = (await asService(`select id from profiles where line_user_id = 'U-teach'`))[0].id;
    await rejects(api('api_att_set', 'U-teach', s.id, teacherId, 'present'), /ไม่พบนักเรียน/);
  });

  await test('ปิดคาบ: คนที่ยังไม่เช็คเป็น "ขาด" และเช็คเองไม่ได้แล้ว', async () => {
    const d = await api('api_att_close', 'U-teach', s.id);
    assert.equal(d.status, 'closed');
    assert.equal(byCode(d)['65100'].status, 'absent');
    await rejects(api('api_att_checkin', 'U-stu4', s.code), /หมดเวลาเช็คชื่อ/);
  });

  await test('ครูเช็คชื่อหลังปิดคาบให้ได้ (เช่น มาสายมาก)', async () => {
    const id4 = byCode(await api('api_att_detail', 'U-teach', s.id))['65100'].profile_id;
    const d = await api('api_att_set', 'U-teach', s.id, id4, 'late');
    assert.equal(byCode(d)['65100'].status, 'late');
  });

  await test('รายการคาบของครู และนักเรียนดูรายการไม่ได้', async () => {
    const list = await api('api_att_list', 'U-teach');
    assert.equal(list.length, 1);
    assert.equal(list[0].counts.late, 2);
    await rejects(api('api_att_list', 'U-stu1'), /สำหรับครูเท่านั้น/);
  });

  await test('ประวัติของนักเรียน: เห็นเฉพาะของตัวเอง พร้อมสรุป', async () => {
    const s2 = await api('api_att_open', 'U-teach', JSON.stringify({ title: 'คาบ 3', minutes: 10 }));
    const h = await api('api_att_history', 'U-stu4');
    assert.equal(h.rows.length, 2);
    assert.equal(h.rows[0].title, 'คาบ 3', 'ใหม่สุดอยู่บน');
    assert.equal(h.rows[0].status, 'pending');
    assert.equal(h.rows[1].status, 'late');
    assert.deepEqual(h.summary, { present: 0, late: 1, absent: 0, leave: 0 });
    assert.equal(JSON.stringify(h).includes(s2.code), false, 'นักเรียนต้องไม่เห็นรหัส');
    ctx.att2 = s2;
  });

  await test('ครูเช็คชื่อแทนไม่ได้ด้วยบัญชีครู', async () => {
    await rejects(api('api_att_checkin', 'U-teach', ctx.att2.code), /เฉพาะบัญชีนักเรียน/);
  });

  await test('รายงานสรุป: ครบทุกคาบ ทุกคน', async () => {
    const r = await api('api_att_report', 'U-teach');
    assert.equal(r.sessions.length, 2);
    assert.equal(r.students.length, 4);
    assert.equal(r.cells.length, 8);
    assert.equal(r.sessions[0].title, 'ม.4/1 คาบ 2', 'เรียงจากเก่าไปใหม่');
  });

  await test('ลบคาบ: บันทึกในคาบหายด้วย', async () => {
    await api('api_att_delete', 'U-teach', ctx.att2.id);
    await rejects(api('api_att_detail', 'U-teach', ctx.att2.id), /ไม่พบคาบ/);
    await rejects(api('api_att_delete', 'U-teach', ctx.att2.id), /ไม่พบคาบ/);
  });

  await test('anon เรียก api_att_* และอ่านตารางเช็คชื่อตรงไม่ได้', async () => {
    await db.exec('set role anon');
    try {
      await rejects(db.query(`select api_att_checkin('U-stu1', '1234')`), /permission denied/);
      await rejects(db.query('select * from att_sessions'), /permission denied/);
    } finally { await db.exec('reset role'); }
  });
}
