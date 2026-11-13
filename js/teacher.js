// =========================================================
// หน้าครู (teacher.html)
// =========================================================
import { IS_DEMO } from './config.js';
import { initLine } from './line.js';
import { api, resetDemo } from './api.js';
import { esc, mascot, loadingHtml, stateHtml, demoBanner, toast, avatarHtml, confirmBox } from './ui.js';
import { icon } from './icons.js';

const app = document.getElementById('app');
const state = { me: null, view: 'exams' };

async function start() {
  app.innerHTML = `<div class="page">${loadingHtml('กำลังเข้าสู่ระบบ')}</div>`;
  try {
    await initLine('ครูทดลอง');
    state.me = await api('me');
    if (state.me.role !== 'teacher') return renderNotTeacher();
    if (!state.me.registered) return renderRegister();
    go('exams');
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="page">${stateHtml({
      img: 'surprised', title: 'เชื่อมต่อไม่สำเร็จ', text: err.message,
      button: '<button class="btn btn-secondary btn-sm" data-act="reload">ลองอีกครั้ง</button>',
    })}</div>`;
  }
}

// ---------- ยังไม่ใช่ครู: บอกวิธีตั้งสิทธิ์ ----------
function renderNotTeacher() {
  app.innerHTML = `
    <div class="page" style="max-width:560px">
      <div class="body" style="padding-top:32px">
        <div class="center"><img src="${mascot('curious')}" alt="" style="height:110px"></div>
        <h1 class="center" style="font-size:21px;color:var(--brown)">หน้านี้สำหรับครูเท่านั้น</h1>
        <p class="center muted">บัญชี LINE <b style="color:var(--text)">${esc(state.me.display_name || '')}</b> ยังเป็นสิทธิ์นักเรียน</p>
        <div class="card" style="font-size:14.5px;display:flex;flex-direction:column;gap:8px">
          <b>วิธีตั้งเป็นครู (ทำครั้งเดียว)</b>
          <div>1. เปิด Supabase → <b>Table Editor</b> → ตาราง <b>profiles</b></div>
          <div>2. หาแถวที่ <code>display_name</code> เป็น <b>${esc(state.me.display_name || '')}</b></div>
          <div>3. แก้ช่อง <code>role</code> จาก <code>student</code> เป็น <code>teacher</code> แล้วกด Save</div>
          <div>4. กลับมากดปุ่มด้านล่าง</div>
        </div>
        <button class="btn btn-primary" data-act="reload">ตั้งค่าแล้ว โหลดใหม่</button>
      </div>
    </div>`;
}

// ---------- ครูลงทะเบียนชื่อครั้งแรก ----------
function renderRegister() {
  app.innerHTML = `
    <div class="page" style="max-width:520px">
      <form class="body" id="reg" style="padding-top:32px" novalidate>
        <div class="center"><img src="${mascot('happy')}" alt="" style="height:130px"></div>
        <h1 class="center" style="font-size:21px;color:var(--brown)">ยินดีต้อนรับคุณครู</h1>
        <p class="center muted">ตั้งชื่อที่จะแสดงในระบบ</p>
        <label class="field"><span>ชื่อครู</span><input name="full_name" maxlength="100" placeholder="เช่น ครูสมศรี ใจดี" required></label>
        <button class="btn btn-primary" type="submit">เริ่มใช้งาน</button>
      </form>
    </div>`;
  const form = app.querySelector('#reg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      state.me = await api('register', { full_name: form.full_name.value.trim(), student_code: '' });
      go('exams');
    } catch (err) { toast(err.message, 'error'); }
  });
}

// ---------- โครงหน้า: แถบเมนู + พื้นที่ทำงาน ----------
const NAV = [
  ['exams', 'clip', 'ชุดสอบ'],
  ['results', 'chart', 'ผลสอบ'],
  ['import', 'upload', 'นำเข้า Excel'],
];

function shell(content) {
  const nav = NAV.map(([id, ic, label]) =>
    `<button class="nav ${state.view === id ? 'on' : ''}" data-go="${id}">${icon(ic)}${label}</button>`).join('');
  app.innerHTML = `
    ${IS_DEMO ? demoBanner() : ''}
    <div class="t-app">
      <aside class="side">
        <div class="brand"><img src="${mascot('icon')}" alt=""><b>Quiz<span>zy</span></b></div>
        ${nav}
        ${IS_DEMO ? `<button class="nav" data-act="reset-demo" style="margin-top:8px">${icon('trash')}ล้างข้อมูลทดลอง</button>` : ''}
        <div class="me">${avatarHtml(state.me)}<div>${esc(state.me.full_name)}<small>ครู</small></div></div>
      </aside>
      <main class="main" id="main">${content}</main>
    </div>`;
}

function go(view, params = {}) {
  state.view = view;
  window.scrollTo(0, 0);
  const views = { exams: viewExams, results: viewResults, import: viewImport };
  (views[view] || viewExams)(params);
}

function viewExams() {
  shell(`
    <div class="main-head"><div><h1>ชุดสอบของฉัน</h1><p>สร้างและจัดการชุดข้อสอบ</p></div></div>
    ${stateHtml({ img: 'sleep', title: 'ยังไม่มีชุดสอบ', text: 'ระบบสร้างชุดสอบจะเปิดใน Phase 2' })}`);
}

function viewResults() {
  shell(`<div class="main-head"><div><h1>ผลสอบ</h1></div></div>${stateHtml({ img: 'sleep', title: 'ยังไม่มีผลสอบ' })}`);
}

function viewImport() {
  shell(`<div class="main-head"><div><h1>นำเข้าข้อสอบจาก Excel</h1></div></div>${stateHtml({ img: 'sleep', title: 'เร็ว ๆ นี้' })}`);
}

// ---------- ปุ่มต่าง ๆ ----------
app.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-go],[data-act]');
  if (!el) return;
  if (el.dataset.go) return go(el.dataset.go);
  const act = el.dataset.act;
  if (act === 'reload') location.reload();
  if (act === 'reset-demo') {
    const ok = await confirmBox({ img: 'surprised', title: 'ล้างข้อมูลทดลองทั้งหมด?', text: 'ชุดสอบและผลสอบจำลองในเครื่องนี้จะหายไป', ok: 'ล้างข้อมูล', danger: true, center: true });
    if (ok) { await resetDemo(); location.reload(); }
  }
});

start();
