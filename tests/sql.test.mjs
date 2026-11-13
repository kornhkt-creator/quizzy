// =========================================================
// ทดสอบ supabase/schema.sql ด้วย PGlite (PostgreSQL ในเครื่อง ไม่ต้องมี Supabase)
// วิธีรัน:  npm install @electric-sql/pglite  แล้ว  node tests/sql.test.mjs
// =========================================================
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const schema = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const db = new PGlite();

// จำลอง role ของ Supabase
await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;`);
await db.exec(schema);
await db.exec(schema); // รันซ้ำต้องไม่พัง

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ✓', name); }
  catch (e) { console.error('  ✗', name, '\n    ', e.message); process.exitCode = 1; }
}
const asService = async (sql, params) => {
  await db.exec('set role service_role');
  try { return (await db.query(sql, params)).rows; } finally { await db.exec('reset role'); }
};
const api = async (fn, ...args) => {
  const ph = args.map((_, i) => `$${i + 1}`).join(',');
  const rows = await asService(`select public.${fn}(${ph}) as r`, args);
  return rows[0].r;
};
const rejects = async (p, re) => {
  await assert.rejects(p, (e) => { assert.match(e.message, re); return true; });
};

console.log('Phase 1: ผู้ใช้และสิทธิ์');

await test('api_me สร้างโปรไฟล์ใหม่ และยังไม่ลงทะเบียน', async () => {
  const p = await api('api_me', 'U-stu1', 'Phum', 'https://pic/1');
  assert.equal(p.display_name, 'Phum');
  assert.equal(p.role, 'student');
  assert.equal(p.registered, false);
  assert.equal(p.line_user_id, undefined, 'ต้องไม่ส่ง line_user_id กลับ');
});

await test('api_me เรียกซ้ำ อัปเดตชื่อ ไม่สร้างแถวใหม่', async () => {
  await api('api_me', 'U-stu1', 'Phum 🌱', null);
  const rows = await asService(`select count(*)::int n, max(display_name) d from profiles where line_user_id='U-stu1'`);
  assert.deepEqual(rows[0], { n: 1, d: 'Phum 🌱' });
});

await test('api_register บันทึกชื่อและรหัส', async () => {
  const p = await api('api_register', 'U-stu1', '  ด.ช.ภูมิ ใจดี ', '65012');
  assert.equal(p.full_name, 'ด.ช.ภูมิ ใจดี');
  assert.equal(p.student_code, '65012');
  assert.equal(p.registered, true);
});

await test('ลงทะเบียนซ้ำไม่ได้', async () => {
  await rejects(api('api_register', 'U-stu1', 'ชื่อใหม่', '99999'), /ลงทะเบียนไว้แล้ว/);
});

await test('รหัสนักเรียนซ้ำกับคนอื่นไม่ได้', async () => {
  await api('api_me', 'U-stu2', 'Copy', null);
  await rejects(api('api_register', 'U-stu2', 'ด.ญ.ก้อย', '65012'), /ถูกใช้แล้ว/);
});

await test('นักเรียนต้องกรอกรหัส และชื่อต้องยาวพอ', async () => {
  await rejects(api('api_register', 'U-stu2', 'ด.ญ.ก้อย', '  '), /รหัสนักเรียน/);
  await rejects(api('api_register', 'U-stu2', 'ก', '65013'), /ชื่อ-นามสกุล/);
});

await test('ครูลงทะเบียนโดยไม่มีรหัสนักเรียนได้', async () => {
  await api('api_me', 'U-teach', 'Kru', null);
  await asService(`update profiles set role='teacher' where line_user_id='U-teach'`);
  const p = await api('api_register', 'U-teach', 'ครูสมศรี', '');
  assert.equal(p.student_code, null);
  assert.equal(p.role, 'teacher');
});

await test('ผู้ใช้ที่ไม่มีโปรไฟล์เรียก api อื่นไม่ได้', async () => {
  await rejects(api('api_register', 'U-nobody', 'ใครก็ได้', '1'), /ไม่พบบัญชี/);
});

await test('anon อ่านตารางตรงไม่ได้', async () => {
  await db.exec('set role anon');
  try { await rejects(db.query('select * from profiles'), /permission denied/); }
  finally { await db.exec('reset role'); }
});

await test('anon / authenticated เรียกฟังก์ชัน api_* ไม่ได้', async () => {
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    try { await rejects(db.query(`select api_me('U-x','x',null)`), /permission denied/); }
    finally { await db.exec('reset role'); }
  }
});

await test('ทุกตารางเปิด RLS', async () => {
  const rows = await db.query(`select relname from pg_class where relnamespace='public'::regnamespace and relkind='r' and not relrowsecurity`);
  assert.deepEqual(rows.rows, []);
});

// ---------- ชุดทดสอบของ phase ถัดไป ----------
for (const f of ['./sql.phase2.mjs', './sql.phase3.mjs', './sql.phase4.mjs']) {
  try { await (await import(f)).default({ db, api, asService, rejects, test }); }
  catch (e) { if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e; }
}

console.log(`\n${passed} ผ่าน${process.exitCode ? ' · มีบางข้อไม่ผ่าน' : ''}`);
