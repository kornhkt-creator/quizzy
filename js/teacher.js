// =========================================================
// หน้าครู (teacher.html)
// =========================================================
import { IS_DEMO } from './config.js';
import { initLine, lineLogin, lineLogout } from './line.js';
import { api, resetDemo, useAuth, authProvider } from './api.js';
import { emailLoginEnabled, getSession, signIn, signOut, getAccessToken, clearSession } from './email-auth.js';
import { esc, mascot, loadingHtml, stateHtml, demoBanner, toast, avatarHtml, confirmBox, fmtDate, fmtTime, fmtDuration, attPill } from './ui.js';
import { icon } from './icons.js';

const app = document.getElementById('app');
const state = { me: null, view: 'exams', exam: null, dirty: false };

// ใช้ token ของ Supabase Auth แทน LINE (ครูที่ login ด้วยอีเมล)
const EMAIL_AUTH = {
  provider: 'email',
  getToken: getAccessToken,
  onExpired: () => { clearSession(); location.reload(); },
};

// ---------- เริ่มต้น: เลือกวิธีเข้าสู่ระบบ ----------
// โหมดทดลอง → เข้าเป็นครูทดลองทันที
// มี session อีเมลอยู่แล้ว → ใช้ต่อ
// login LINE อยู่แล้ว → ใช้ LINE
// ยังไม่ได้ login → แสดงหน้าเข้าสู่ระบบ
async function start() {
  app.innerHTML = `<div class="page">${loadingHtml('กำลังเข้าสู่ระบบ')}</div>`;
  if (IS_DEMO) {
    await initLine('ครูทดลอง');
    return enter();
  }
  if (emailLoginEnabled() && getSession()) {
    useAuth(EMAIL_AUTH);
    return enter();
  }
  let lineReady = false;
  try {
    const profile = await initLine('', { autoLogin: false });
    lineReady = true;
    if (profile) return enter();
  } catch (err) {
    console.warn('LIFF ใช้งานไม่ได้', err); // ยัง login ด้วยอีเมลได้
  }
  renderLogin(lineReady);
}

async function enter() {
  app.innerHTML = `<div class="page">${loadingHtml('กำลังเข้าสู่ระบบ')}</div>`;
  try {
    state.me = await api('me');
    if (state.me.role !== 'teacher') return renderNotTeacher();
    if (!state.me.registered) return renderRegister();
    go('exams');
  } catch (err) {
    console.error(err);
    if (authProvider() === 'email' && !getSession()) return renderLogin(false, err.message);
    app.innerHTML = `<div class="page">${stateHtml({
      img: 'surprised', title: 'เชื่อมต่อไม่สำเร็จ', text: err.message,
      button: '<div style="display:flex;gap:10px"><button class="btn btn-secondary btn-sm" data-act="logout">ออกจากระบบ</button><button class="btn btn-primary btn-sm" data-act="reload">ลองอีกครั้ง</button></div>',
    })}</div>`;
  }
}

// ---------- หน้าเข้าสู่ระบบ ----------
function renderLogin(lineReady, message = '') {
  const email = emailLoginEnabled();
  const or = '<div class="center muted" style="font-size:13px;display:flex;align-items:center;gap:10px"><hr style="flex:1;border:0;border-top:1px solid var(--line)">หรือ<hr style="flex:1;border:0;border-top:1px solid var(--line)"></div>';
  app.innerHTML = `
    <div class="page" style="max-width:440px">
      <form class="body" id="login" style="padding-top:36px" novalidate>
        <div class="center"><img src="${mascot('happy')}" alt="" style="height:130px"></div>
        <h1 class="center" style="font-size:22px;color:var(--brown)">เข้าสู่ระบบสำหรับครู</h1>
        <p class="center muted" style="font-size:14px;margin-top:-6px">Quizzy · สนุกกับการสอบ เก่งขึ้นทุกวัน!</p>
        ${email ? `
          <label class="field"><span>อีเมล</span><input name="email" type="email" autocomplete="username" placeholder="kru@school.ac.th" required></label>
          <label class="field"><span>รหัสผ่าน</span><input name="password" type="password" autocomplete="current-password" required></label>
          <button class="btn btn-primary" type="submit">เข้าสู่ระบบ</button>
          ${or}` : ''}
        <button class="btn btn-secondary" type="button" data-act="line-login" ${lineReady ? '' : 'disabled'}>เข้าสู่ระบบด้วย LINE</button>
        ${lineReady ? '' : '<p class="center muted" style="font-size:12.5px">ตอนนี้ login ด้วย LINE ไม่ได้ (ตรวจ LIFF ID ใน js/config.js)</p>'}
        ${email ? '<p class="center muted" style="font-size:12.5px">บัญชีอีเมลของครูสร้างโดยผู้ดูแลระบบใน Supabase</p>' : ''}
      </form>
    </div>`;
  if (message) toast(message, 'error');

  const form = app.querySelector('#login');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!email) return;
    if (!form.email.value.trim() || !form.password.value) return toast('กรุณากรอกอีเมลและรหัสผ่าน', 'error');
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'กำลังเข้าสู่ระบบ…';
    try {
      await signIn(form.email.value, form.password.value);
      useAuth(EMAIL_AUTH);
      enter();
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'เข้าสู่ระบบ';
    }
  });
}

async function logout() {
  if (IS_DEMO) return;
  if (authProvider() === 'email') await signOut();
  else lineLogout();
  location.reload();
}

// ---------- ยังไม่ใช่ครู: บอกวิธีตั้งสิทธิ์ ----------
function renderNotTeacher() {
  const who = authProvider() === 'email' ? 'อีเมล' : 'LINE';
  app.innerHTML = `
    <div class="page" style="max-width:560px">
      <div class="body" style="padding-top:32px">
        <div class="center"><img src="${mascot('curious')}" alt="" style="height:110px"></div>
        <h1 class="center" style="font-size:21px;color:var(--brown)">หน้านี้สำหรับครูเท่านั้น</h1>
        <p class="center muted">บัญชี${who} <b style="color:var(--text)">${esc(state.me.display_name || '')}</b> ยังเป็นสิทธิ์นักเรียน</p>
        <div class="card" style="font-size:14.5px;display:flex;flex-direction:column;gap:8px">
          <b>วิธีตั้งเป็นครู (ทำครั้งเดียว)</b>
          <div>1. เปิด Supabase → <b>Table Editor</b> → ตาราง <b>profiles</b></div>
          <div>2. หาแถวที่ <code>display_name</code> เป็น <b>${esc(state.me.display_name || '')}</b></div>
          <div>3. แก้ช่อง <code>role</code> จาก <code>student</code> เป็น <code>teacher</code> แล้วกด Save</div>
          <div>4. กลับมากดปุ่มด้านล่าง</div>
        </div>
        <button class="btn btn-primary" data-act="reload">ตั้งค่าแล้ว โหลดใหม่</button>
        <button class="btn btn-secondary" data-act="logout">เข้าด้วยบัญชีอื่น</button>
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
  ['attendance', 'users', 'เช็คชื่อ'],
  ['import', 'upload', 'นำเข้า Excel'],
];
const MENU_OF = { edit: 'exams', att: 'attendance' };

function shell(content) {
  const current = MENU_OF[state.view] || state.view;
  const nav = NAV.map(([id, ic, label]) =>
    `<button class="nav ${current === id ? 'on' : ''}" data-go="${id}">${icon(ic)}${label}</button>`).join('');
  app.innerHTML = `
    ${IS_DEMO ? demoBanner() : ''}
    <div class="t-app">
      <aside class="side">
        <div class="brand"><img src="${mascot('icon')}" alt=""><b>Quiz<span>zy</span></b></div>
        ${nav}
        ${IS_DEMO ? `<button class="nav" data-act="reset-demo" style="margin-top:8px">${icon('trash')}ล้างข้อมูลทดลอง</button>` : ''}
        <div class="me">${avatarHtml(state.me)}<div style="min-width:0;flex:1">${esc(state.me.full_name)}<small style="overflow:hidden;text-overflow:ellipsis">${authProvider() === 'email' && !IS_DEMO ? esc(state.me.display_name || '') : 'ครู'}</small></div>
          ${IS_DEMO ? '' : `<button class="btn-icon" data-act="logout" title="ออกจากระบบ" aria-label="ออกจากระบบ">${icon('logout')}</button>`}</div>
      </aside>
      <main class="main" id="main">${content}</main>
    </div>`;
}
const main = () => document.getElementById('main');

async function go(view, params = {}) {
  if (state.dirty) {
    const leave = await confirmBox({ title: 'ยังไม่ได้บันทึก', text: 'ออกจากหน้านี้แล้วสิ่งที่แก้ไว้จะหายไป', ok: 'ออกโดยไม่บันทึก', cancel: 'อยู่ต่อ', center: true });
    if (!leave) return;
    state.dirty = false;
  }
  stopAttTimer();
  state.view = view;
  window.scrollTo(0, 0);
  const views = { exams: viewExams, edit: viewEditor, results: viewResults, import: viewImport, attendance: viewAttendance, att: viewAttSession };
  (views[view] || viewExams)(params);
}
window.addEventListener('beforeunload', (e) => { if (state.dirty) e.preventDefault(); });

const errorState = (err) => stateHtml({ img: 'surprised', title: 'โหลดข้อมูลไม่สำเร็จ', text: err.message });

// =========================================================
// รายการชุดสอบ
// =========================================================
const STATUS = {
  draft: ['orange', 'ฉบับร่าง'],
  scheduled: ['gray', 'ยังไม่ถึงเวลาเปิด'],
  open: ['green', '● เปิดสอบอยู่'],
  closed: ['gray', 'ปิดแล้ว'],
};
const statusPill = (s) => `<span class="pill ${STATUS[s][0]}">${STATUS[s][1]}</span>`;

async function viewExams() {
  shell(`
    <div class="main-head">
      <div><h1>ชุดสอบของฉัน</h1><p id="sub">กำลังโหลด…</p></div>
      <div class="head-actions">
        <button class="btn btn-secondary" data-go="import">${icon('upload')}นำเข้าจาก Excel</button>
        <button class="btn btn-primary" data-go="edit">${icon('plus')}สร้างชุดสอบ</button>
      </div>
    </div>
    <div id="list">${loadingHtml()}</div>`);
  const list = document.getElementById('list');
  try {
    const exams = await api('teacher_list_exams');
    document.getElementById('sub').textContent = `${exams.length} ชุด · เปิดสอบอยู่ ${exams.filter((e) => e.status === 'open').length} ชุด`;
    list.innerHTML = `<div class="exam-grid">${exams.map(examCard).join('')}
      <button class="card exam-card empty-new" data-go="edit"><div>${icon('plus', 'width:30px;height:30px')}<div>สร้างชุดสอบใหม่</div></div></button></div>`;
  } catch (err) { list.innerHTML = errorState(err); }
}

function examCard(e) {
  const published = e.status !== 'draft';
  const when = e.status === 'scheduled' ? `เปิด ${fmtDate(e.open_at)}` : e.close_at ? `ปิด ${fmtDate(e.close_at)}` : 'ไม่กำหนดเวลาปิด';
  const pct = e.student_count ? Math.round((e.submitted_count / e.student_count) * 100) : 0;
  return `
    <div class="card exam-card">
      <div style="display:flex;justify-content:space-between;gap:8px">${statusPill(e.status)}
        ${published ? `<span class="pill gray">ส่งแล้ว ${e.submitted_count}/${e.student_count}</span>` : ''}</div>
      <h3>${esc(e.title)}</h3>
      <div class="meta">
        <span>${icon('list')}${e.question_count} ข้อ · ${e.max_score} คะแนน</span>
        <span>${icon('clock')}${e.duration_minutes} นาที</span>
        <span>${esc(when)}</span>
      </div>
      ${published ? `<div class="progress"><i style="width:${pct}%"></i></div>` : '<div class="muted" style="font-size:13px">ยังไม่เผยแพร่ นักเรียนยังไม่เห็น</div>'}
      <div class="actions">
        <button class="btn btn-secondary btn-sm" data-go="edit" data-id="${e.id}">${icon(e.started_count ? 'eye' : 'edit')}${e.started_count ? 'ดูข้อสอบ' : 'แก้ไข'}</button>
        ${e.started_count ? `<button class="btn btn-secondary btn-sm" data-go="results" data-id="${e.id}">${icon('chart')}ดูผล</button>` : ''}
        ${!published ? `<button class="btn btn-primary btn-sm" data-act="publish" data-id="${e.id}">เผยแพร่</button>` : ''}
      </div>
    </div>`;
}

// =========================================================
// สร้าง / แก้ไขชุดสอบ
// =========================================================
const blankQuestion = () => ({ question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A', points: 1, explanation: '' });

// แปลงเวลา ISO ↔ ช่อง datetime-local (ตามเวลาเครื่อง)
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

async function viewEditor({ id } = {}) {
  state.dirty = false;
  if (!id) {
    state.exam = { id: null, title: '', description: '', duration_minutes: 15, pass_percent: 50, open_at: null, close_at: null, is_published: false, status: 'draft', locked: false, questions: [blankQuestion()] };
    return renderEditor();
  }
  shell(loadingHtml());
  try {
    state.exam = await api('get_exam', { exam_id: id });
    renderEditor();
  } catch (err) { main().innerHTML = errorState(err); }
}

function renderEditor() {
  const e = state.exam;
  const lock = e.locked;
  const total = e.questions.reduce((s, q) => s + (Number(q.points) || 0), 0);
  shell(`
    <div class="main-head">
      <div>
        <button class="btn-icon" data-go="exams" style="width:auto;border-radius:99px;padding:0 10px 0 4px;color:var(--muted);font-size:14px;display:inline-flex;gap:2px">${icon('back')}ชุดสอบทั้งหมด</button>
        <h1>${e.id ? esc(e.title) : 'สร้างชุดสอบใหม่'}</h1>
        <p>${statusPill(e.status)}</p>
      </div>
      <div class="head-actions">
        ${e.id ? `<button class="btn btn-secondary" data-act="toggle-publish">${e.is_published ? 'ซ่อนจากนักเรียน' : 'เผยแพร่'}</button>` : ''}
        <button class="btn btn-primary" data-act="save">${icon('check')}บันทึก</button>
      </div>
    </div>

    ${lock ? `<div class="lock-note">${icon('info')}มีนักเรียนเริ่มสอบชุดนี้แล้ว จึงแก้ไขข้อสอบและเวลาทำข้อสอบไม่ได้ (แก้ชื่อ คำอธิบาย และเวลาเปิด-ปิดได้)</div>` : ''}

    <div class="card form-grid" style="padding:18px">
      <label class="field full"><span>ชื่อชุดสอบ *</span><input data-f="title" maxlength="200" value="${esc(e.title)}" placeholder="เช่น บทที่ 3 เศษส่วน"></label>
      <label class="field full"><span>คำอธิบาย / คำชี้แจง</span><textarea data-f="description" maxlength="2000" placeholder="เช่น ข้อสอบปรนัย 10 ข้อ อ่านโจทย์ให้ดีก่อนตอบ">${esc(e.description)}</textarea></label>
      <label class="field"><span>เวลาทำข้อสอบ (นาที) *</span><input data-f="duration_minutes" type="number" min="1" max="300" value="${e.duration_minutes}" ${lock ? 'disabled' : ''}></label>
      <label class="field"><span>เกณฑ์ผ่าน (%)</span><input data-f="pass_percent" type="number" min="0" max="100" value="${e.pass_percent}"></label>
      <label class="field"><span>เปิดสอบ (เว้นว่าง = เปิดทันทีที่เผยแพร่)</span><input data-f="open_at" type="datetime-local" value="${toLocalInput(e.open_at)}"></label>
      <label class="field"><span>ปิดสอบ (เว้นว่าง = ไม่ปิด)</span><input data-f="close_at" type="datetime-local" value="${toLocalInput(e.close_at)}"></label>
    </div>

    <div class="sec"><h2>ข้อสอบ <span class="muted" style="font-weight:400" id="q-sum">${e.questions.length} ข้อ · ${total} คะแนน</span></h2>
      ${lock ? '' : `<button class="btn btn-secondary btn-sm" data-go="import" data-id="${e.id || ''}">${icon('upload')}นำเข้าจาก Excel</button>`}</div>
    <div id="qs" style="display:flex;flex-direction:column;gap:14px">${e.questions.map(questionCard).join('')}</div>
    ${lock ? '' : `<button class="btn btn-secondary" data-act="add-q">${icon('plus')}เพิ่มข้อสอบ</button>`}

    <div class="foot-actions">
      <div>${e.id ? `<button class="btn btn-danger" data-act="delete-exam">${icon('trash')}ลบชุดสอบ</button>` : ''}</div>
      <div><button class="btn btn-primary" data-act="save">${icon('check')}บันทึก</button></div>
    </div>`);
}

function questionCard(q, i) {
  const lock = state.exam.locked;
  const dis = lock ? 'disabled' : '';
  const n = state.exam.questions.length;
  const opt = (key, label) => `
    <label class="q-opt">
      <input type="radio" name="ans-${i}" data-q="${i}" data-qf="correct_answer" value="${key}" ${q.correct_answer === key ? 'checked' : ''} ${dis} title="เลือกเป็นเฉลย">
      <input class="input" data-q="${i}" data-qf="option_${key.toLowerCase()}" value="${esc(q[`option_${key.toLowerCase()}`] || '')}" placeholder="${label}${key > 'B' ? ' (ไม่บังคับ)' : ''}" maxlength="500" ${dis}>
    </label>`;
  return `
    <div class="card q-edit" data-qcard="${i}">
      <div class="q-head">
        <span class="q-num">ข้อ ${i + 1}</span>
        <div style="display:flex;gap:6px;align-items:center">
          <label class="muted" style="font-size:13px;display:flex;align-items:center;gap:6px">คะแนน
            <input class="input" style="width:70px;min-height:34px;padding:4px 10px" type="number" min="1" max="100" data-q="${i}" data-qf="points" value="${esc(q.points)}" ${dis}></label>
          ${lock ? '' : `
            <button class="btn-icon" data-act="q-up" data-i="${i}" ${i === 0 ? 'disabled' : ''} title="เลื่อนขึ้น">${icon('up')}</button>
            <button class="btn-icon" data-act="q-down" data-i="${i}" ${i === n - 1 ? 'disabled' : ''} title="เลื่อนลง">${icon('down')}</button>
            <button class="btn-icon" data-act="q-del" data-i="${i}" title="ลบข้อนี้" style="color:var(--red)">${icon('trash')}</button>`}
        </div>
      </div>
      <label class="field"><textarea data-q="${i}" data-qf="question_text" maxlength="2000" placeholder="พิมพ์คำถาม" ${dis}>${esc(q.question_text)}</textarea></label>
      <div class="muted" style="font-size:13px">ตัวเลือก (กดวงกลมหน้าตัวเลือกที่ถูกต้อง)</div>
      <div class="q-opts">${opt('A', 'ตัวเลือก ก')}${opt('B', 'ตัวเลือก ข')}${opt('C', 'ตัวเลือก ค')}${opt('D', 'ตัวเลือก ง')}</div>
      <label class="field"><span>คำอธิบายเฉลย (ครูเห็นคนเดียว ไม่บังคับ)</span><input data-q="${i}" data-qf="explanation" value="${esc(q.explanation || '')}" maxlength="1000" ${dis}></label>
    </div>`;
}

function refreshQuestions() {
  document.getElementById('qs').innerHTML = state.exam.questions.map(questionCard).join('');
  updateSum();
}
function updateSum() {
  const qs = state.exam.questions;
  const el = document.getElementById('q-sum');
  if (el) el.textContent = `${qs.length} ข้อ · ${qs.reduce((s, q) => s + (Number(q.points) || 0), 0)} คะแนน`;
}

// เก็บค่าที่พิมพ์ลง state ทันที
app.addEventListener('input', (e) => {
  if (state.view !== 'edit') return;
  const t = e.target;
  if (t.dataset.f) {
    const v = t.dataset.f.endsWith('_at') ? fromLocalInput(t.value) : t.value;
    state.exam[t.dataset.f] = v;
    state.dirty = true;
  } else if (t.dataset.qf) {
    state.exam.questions[Number(t.dataset.q)][t.dataset.qf] = t.value;
    state.dirty = true;
    if (t.dataset.qf === 'points') updateSum();
  }
});
app.addEventListener('change', (e) => {
  if (state.view === 'edit' && e.target.type === 'radio' && e.target.dataset.qf) {
    state.exam.questions[Number(e.target.dataset.q)].correct_answer = e.target.value;
    state.dirty = true;
  }
});

async function saveExam({ quiet = false } = {}) {
  const e = state.exam;
  const examFields = { id: e.id, title: e.title, description: e.description, duration_minutes: e.duration_minutes, pass_percent: e.pass_percent, open_at: e.open_at, close_at: e.close_at };
  let saved = await api('save_exam', { exam: examFields });
  state.exam.id = saved.id; // ถ้าบันทึกข้อสอบไม่ผ่าน ครั้งหน้าจะแก้ชุดเดิม ไม่สร้างซ้ำ
  if (!saved.locked) saved = await api('save_questions', { exam_id: saved.id, questions: e.questions, mode: 'replace' });
  state.exam = saved;
  state.dirty = false;
  if (!quiet) toast('บันทึกเรียบร้อย');
  return saved;
}

async function withBusy(btn, fn) {
  const buttons = [...app.querySelectorAll('[data-act="save"],[data-act="toggle-publish"]')];
  buttons.forEach((b) => { b.disabled = true; });
  try { await fn(); } catch (err) { toast(err.message, 'error'); } finally { buttons.forEach((b) => { b.disabled = false; }); }
}

// =========================================================
// ผลสอบ
// =========================================================
async function viewResults({ id } = {}) {
  shell(loadingHtml());
  try {
    const exams = (await api('teacher_list_exams')).filter((e) => e.started_count > 0);
    if (!id) {
      main().innerHTML = `
        <div class="main-head"><div><h1>ผลสอบ</h1><p>เลือกชุดสอบที่ต้องการดูผล</p></div></div>
        ${exams.length ? `<div style="display:flex;flex-direction:column;gap:10px">${exams.map((e) => `
          <button class="card list-row" data-go="results" data-id="${e.id}">
            <div class="tile g">${icon('chart')}</div>
            <div class="t"><b>${esc(e.title)}</b><small>ส่งแล้ว ${e.submitted_count}/${e.student_count} คน · ${e.question_count} ข้อ</small></div>
            <span class="btn btn-secondary btn-sm">ดูผล</span>
          </button>`).join('')}</div>`
        : stateHtml({ img: 'sleep', title: 'ยังไม่มีผลสอบ', text: 'เมื่อนักเรียนเริ่มทำข้อสอบ ผลจะขึ้นที่นี่' })}`;
      return;
    }
    state.results = await api('exam_results', { exam_id: id });
    renderResults(exams);
  } catch (err) { main().innerHTML = errorState(err); }
}

const ROW_STATUS = {
  in_progress: '<span class="pill orange">กำลังทำ</span>',
  expired: '<span class="pill gray">ไม่ได้ส่ง</span>',
  not_started: '<span class="pill gray">ยังไม่เริ่ม</span>',
};

function renderResults(exams) {
  const { exam, summary: s, rows, questions } = state.results;
  const hardest = questions.filter((q) => q.submitted > 0).sort((a, b) => b.wrong_percent - a.wrong_percent || a.order_no - b.order_no).slice(0, 5);
  const when = [exam.open_at && `เปิด ${fmtDate(exam.open_at)}`, exam.close_at && `ปิด ${fmtDate(exam.close_at)}`].filter(Boolean).join(' – ');
  const stat = (ic, g, big, small) => `<div class="card stat"><div class="tile ${g ? 'g' : ''}">${icon(ic)}</div><div><b>${big}</b><small>${small}</small></div></div>`;

  main().innerHTML = `
    <div class="main-head">
      <div>
        <h1>ผลสอบ: ${esc(exam.title)}</h1>
        <p>${when ? `${esc(when)} · ` : ''}${exam.question_count} ข้อ · ${exam.max_score} คะแนน · เกณฑ์ผ่าน ${exam.pass_percent}%</p>
      </div>
      <div class="head-actions">
        ${exams.length > 1 ? `<select class="input" data-act="switch-results" style="width:auto;min-height:42px">${exams.map((e) => `<option value="${e.id}" ${e.id === exam.id ? 'selected' : ''}>${esc(e.title)}</option>`).join('')}</select>` : ''}
        <button class="btn btn-secondary" data-act="export">${icon('download')}Export Excel</button>
      </div>
    </div>
    <div class="stats">
      ${stat('users', true, `${s.submitted_count}<span class="muted" style="font-size:16px">/${s.student_count}</span>`, 'ส่งแล้ว')}
      ${stat('chart', false, s.avg_score ?? '-', `คะแนนเฉลี่ย${s.avg_percent != null ? ` (${s.avg_percent}%)` : ''}`)}
      ${stat('star', true, s.max_score_got ?? '-', 'สูงสุด')}
      ${stat('check', false, `${s.pass_count}<span class="muted" style="font-size:16px">/${s.submitted_count}</span>`, `ผ่านเกณฑ์ · ต่ำสุด ${s.min_score_got ?? '-'}`)}
    </div>
    <div class="cols">
      <div class="card table-wrap" style="padding:8px 8px 4px">
        <table>
          <tr><th>รหัส</th><th>ชื่อ-นามสกุล</th><th>คะแนน</th><th>ส่งเมื่อ</th><th>สถานะ</th></tr>
          ${rows.map((r) => `
            <tr>
              <td>${esc(r.student_code || '-')}</td>
              <td>${esc(r.full_name || r.display_name || '-')}</td>
              <td>${r.status === 'submitted' ? `<b>${r.score}</b> / ${r.max_score}` : '<span class="muted">–</span>'}</td>
              <td>${r.submitted_at ? fmtDate(r.submitted_at) : '<span class="muted">–</span>'}</td>
              <td>${r.status === 'submitted' ? `<span class="pill ${r.passed ? 'green' : 'red'}">${r.passed ? 'ผ่าน' : 'ไม่ผ่าน'}</span>` : ROW_STATUS[r.status]}
                ${r.is_late ? ' <span class="pill orange">ส่งช้า</span>' : ''}</td>
            </tr>`).join('')}
        </table>
        ${rows.length ? '' : '<p class="muted center" style="padding:20px">ยังไม่มีนักเรียนลงทะเบียน</p>'}
      </div>
      <div class="card" style="padding:18px">
        <div style="font-weight:600;margin-bottom:2px">ข้อที่ตอบผิดมากที่สุด</div>
        <div class="muted" style="font-size:13px;margin-bottom:14px">ใช้ดูว่าเรื่องไหนควรสอนซ้ำ</div>
        ${hardest.length ? hardest.map((q) => `
          <div class="bar-row">
            <div class="top"><div>ข้อ ${q.order_no}: ${esc(q.question_text.length > 40 ? `${q.question_text.slice(0, 40)}…` : q.question_text)}</div><span>ผิด ${q.wrong_percent}%</span></div>
            <div class="progress"><i style="width:${q.wrong_percent}%"></i></div>
          </div>`).join('') : '<p class="muted" style="font-size:14px">ยังไม่มีคนส่งคำตอบ</p>'}
      </div>
    </div>`;
}

// =========================================================
// เช็คชื่อเข้าเรียน
// =========================================================
const statCard = (ic, g, big, small, id = '') =>
  `<div class="card stat"${id ? ` id="${id}"` : ''}><div class="tile ${g ? 'g' : ''}">${icon(ic)}</div><div><b>${big}</b><small>${small}</small></div></div>`;

function stopAttTimer() {
  clearInterval(state.attTimer);
  state.attTimer = null;
}

async function viewAttendance() {
  shell(`
    <div class="main-head">
      <div><h1>เช็คชื่อเข้าเรียน</h1><p id="sub">กำลังโหลด…</p></div>
      <div class="head-actions">
        <button class="btn btn-secondary" data-act="att-export-all">${icon('download')}Export สรุปทั้งหมด</button>
        <button class="btn btn-primary" data-act="att-new">${icon('plus')}เปิดเช็คชื่อ</button>
      </div>
    </div>
    <div id="att-new"></div>
    <div id="list">${loadingHtml()}</div>`);
  const list = document.getElementById('list');
  try {
    const sessions = await api('att_list');
    const open = sessions.filter((s) => s.status === 'open').length;
    document.getElementById('sub').textContent = `${sessions.length} คาบ${open ? ` · เปิดอยู่ ${open} คาบ` : ''}`;
    if (!sessions.length) {
      list.innerHTML = stateHtml({ img: 'sleep', title: 'ยังไม่มีการเช็คชื่อ', text: 'กด "เปิดเช็คชื่อ" ตอนเริ่มคาบ ระบบจะสุ่มรหัส 4 หลักให้ขึ้นจอ นักเรียนกรอกรหัสในแอป LINE' });
      return;
    }
    list.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px">${sessions.map((s) => {
      const c = s.counts;
      const open = s.status === 'open';
      return `
        <button class="card list-row" data-go="att" data-id="${s.id}">
          <div class="tile ${open ? '' : 'g'}">${icon(open ? 'clock' : 'users')}</div>
          <div class="t"><b>${esc(s.title)}</b><small>${fmtDate(s.opens_at)} · มา ${c.present} · สาย ${c.late} · ${open ? `ยังไม่เช็ค ${c.pending}` : `ขาด ${c.absent}`} · ลา ${c.leave}</small></div>
          ${open ? `<span class="pill green">● เปิดอยู่ · รหัส ${esc(s.code)}</span>` : '<span class="pill gray">ปิดแล้ว</span>'}
        </button>`;
    }).join('')}</div>`;
  } catch (err) { list.innerHTML = errorState(err); }
}

function renderAttForm() {
  const box = document.getElementById('att-new');
  if (!box || box.innerHTML) return box?.querySelector('input')?.focus();
  box.innerHTML = `
    <form class="card form-grid" id="att-form" style="padding:18px" novalidate>
      <label class="field full"><span>ชื่อคาบ</span><input name="title" maxlength="200" value="${esc(`เช็คชื่อ ${fmtDate(new Date().toISOString(), false)}`)}" placeholder="เช่น ม.4/1 คณิตศาสตร์ คาบ 2"></label>
      <label class="field"><span>เปิดให้เช็คชื่อนาน (นาที)</span><input name="minutes" type="number" min="1" max="240" value="15"></label>
      <label class="field"><span>เช็คหลังกี่นาทีนับว่าสาย (เว้นว่าง = ไม่นับสาย)</span><input name="late_minutes" type="number" min="0" max="240" value="10"></label>
      <div class="full" style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">
        <button type="button" class="btn btn-secondary btn-auto" data-act="att-cancel">ยกเลิก</button>
        <button type="submit" class="btn btn-primary btn-auto">${icon('check')}เปิดเช็คชื่อและแสดงรหัส</button>
      </div>
    </form>`;
  const form = box.querySelector('form');
  form.title.select();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      const s = await api('att_open', { session: { title: form.title.value, minutes: form.minutes.value, late_minutes: form.late_minutes.value } });
      go('att', { id: s.id });
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
    }
  });
}

async function viewAttSession({ id } = {}) {
  if (!id) return go('attendance');
  shell(loadingHtml());
  try {
    state.att = await api('att_detail', { session_id: id });
    renderAtt();
  } catch (err) { main().innerHTML = errorState(err); }
}

// มีบันทึกจริงไหม (ไม่ใช่ "ยังไม่เช็ค/ขาด" ที่ระบบคิดให้)
const hasRecord = (r) => r.checked_at != null || r.edited;

function attStatsHtml(s) {
  const c = s.counts;
  const open = s.status === 'open';
  return `
    ${statCard('check', true, `${c.present}`, 'มา')}
    ${statCard('clock', false, `${c.late}`, 'สาย')}
    ${statCard('users', false, `${open ? c.pending : c.absent}`, open ? 'ยังไม่เช็ค' : 'ขาด')}
    ${statCard('file', true, `${c.leave}`, `ลา · ทั้งหมด ${c.total} คน`)}`;
}

function attRowsHtml(s) {
  const open = s.status === 'open';
  const opt = (v, label, sel) => `<option value="${v}" ${sel ? 'selected' : ''}>${label}</option>`;
  return s.rows.map((r, i) => {
    const cur = hasRecord(r) ? r.status : 'none';
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(r.student_code || '-')}</td>
        <td>${esc(r.full_name || r.display_name || '-')}</td>
        <td>${r.checked_at ? fmtTime(r.checked_at) : '<span class="muted">–</span>'}${r.edited ? ' <span class="muted" style="font-size:12px">(ครูบันทึก)</span>' : ''}</td>
        <td>${attPill(r.status)}</td>
        <td><select class="input att-sel" data-act="att-set" data-pid="${r.profile_id}" aria-label="แก้สถานะ">
          ${opt('present', 'มา', cur === 'present')}${opt('late', 'สาย', cur === 'late')}${opt('leave', 'ลา', cur === 'leave')}${opt('absent', 'ขาด', cur === 'absent')}
          ${opt('none', open ? 'ยังไม่เช็ค' : 'ไม่ได้เช็ค (ขาด)', cur === 'none')}
        </select></td>
      </tr>`;
  }).join('');
}

function renderAtt() {
  const s = state.att;
  const open = s.status === 'open';
  const noLate = s.late_at === s.closes_at;
  state.attOffset = Date.parse(s.server_now) - Date.now(); // ชดเชยนาฬิกาเครื่องที่ไม่ตรง
  main().innerHTML = `
    <div class="main-head">
      <div>
        <button class="btn-icon" data-go="attendance" style="width:auto;border-radius:99px;padding:0 10px 0 4px;color:var(--muted);font-size:14px;display:inline-flex;gap:2px">${icon('back')}การเช็คชื่อทั้งหมด</button>
        <h1>${esc(s.title)}</h1>
        <p>${open ? '<span class="pill green">● เปิดอยู่</span>' : '<span class="pill gray">ปิดแล้ว</span>'}
          ${fmtDate(s.opens_at)} – ${fmtTime(s.closes_at)}${open ? ` · ${noLate ? 'ไม่นับสาย' : `เช็คหลัง ${fmtTime(s.late_at)} นับว่าสาย`}` : ''}</p>
      </div>
      <div class="head-actions">
        ${open ? `<button class="btn btn-secondary" data-act="att-close">${icon('close')}ปิดเช็คชื่อตอนนี้</button>` : ''}
        <button class="btn btn-secondary" data-act="att-export">${icon('download')}Export Excel</button>
      </div>
    </div>
    ${open ? `
      <div class="card att-code" id="att-code">
        <div class="code-row">
          <div class="att-qr" id="att-qr" aria-label="QR Code เช็คชื่อ"><div class="muted" style="font-size:13px">กำลังสร้าง QR…</div></div>
          <div>
            <div class="muted">สแกน QR หรือกรอกรหัส</div>
            <div class="digits">${s.code.split('').map((d) => `<i>${d}</i>`).join('')}</div>
            <div class="att-left" id="att-left">เหลือเวลา --:--</div>
            <div class="att-count" id="att-count"></div>
          </div>
        </div>
        <p class="muted">สแกน QR ด้วยกล้องมือถือหรือ LINE · หรือเปิด Quizzy ใน LINE → แท็บ <b>เช็คชื่อ</b> → กรอกรหัส</p>
        <button class="btn btn-secondary btn-sm" data-act="att-full">${icon('eye')}ขยายเต็มจอ (สำหรับโปรเจกเตอร์)</button>
      </div>` : ''}
    <div class="stats" id="att-stats">${attStatsHtml(s)}</div>
    <div class="card table-wrap" style="padding:8px 8px 4px">
      <table>
        <thead><tr><th>#</th><th>รหัส</th><th>ชื่อ-นามสกุล</th><th>เวลาเช็ค</th><th>สถานะ</th><th>แก้สถานะ</th></tr></thead>
        <tbody id="att-rows">${attRowsHtml(s)}</tbody>
      </table>
      ${s.rows.length ? '' : '<p class="muted center" style="padding:20px">ยังไม่มีนักเรียนลงทะเบียน</p>'}
    </div>
    <div class="foot-actions">
      <div><button class="btn btn-danger" data-act="att-delete">${icon('trash')}ลบคาบนี้</button></div>
      <p>${icon('info', 'width:16px;height:16px')}แก้สถานะรายคนได้ตลอด เช่น ลาป่วย หรือมาหลังปิดเช็คชื่อ</p>
    </div>`;
  stopAttTimer();
  if (open) {
    showAttQr(s.code);
    attTick();
    state.attTimer = setInterval(attTick, 1000);
  }
}

async function showAttQr(code) {
  const box = document.getElementById('att-qr');
  try {
    const { qrSvg, checkinUrl } = await import('./qr.js');
    const svg = await qrSvg(checkinUrl(code));
    if (box.isConnected) box.innerHTML = svg;
  } catch (err) {
    if (box.isConnected) box.innerHTML = `<div class="muted" style="font-size:13px;padding:10px">${esc(err.message)}<br>ใช้รหัสตัวเลขแทนได้</div>`;
  }
}

// ทุกวินาที: นับถอยหลัง / ทุก 5 วินาที: ดึงรายชื่อล่าสุด
let attTicks = 0;
function attTick() {
  const s = state.att;
  if (!s || state.view !== 'att') return stopAttTimer();
  const ms = Date.parse(s.closes_at) - (Date.now() + (state.attOffset || 0));
  const left = document.getElementById('att-left');
  if (left) {
    left.textContent = ms > 0 ? `เหลือเวลา ${fmtDuration(ms / 1000)}` : 'หมดเวลาแล้ว';
    left.classList.toggle('warn', ms < 60e3);
  }
  const count = document.getElementById('att-count');
  if (count) count.textContent = `เช็คแล้ว ${s.counts.total - s.counts.pending} / ${s.counts.total} คน`;
  attTicks += 1;
  if (ms <= 0 || attTicks % 5 === 0) refreshAtt();
}

async function refreshAtt() {
  if (state.attLoading || !state.att) return;
  state.attLoading = true;
  try {
    const fresh = await api('att_detail', { session_id: state.att.id });
    if (state.view !== 'att' || fresh.id !== state.att.id) return;
    const statusChanged = fresh.status !== state.att.status;
    state.att = fresh;
    if (statusChanged) return renderAtt(); // หมดเวลา: แสดงแบบปิดแล้ว
    document.getElementById('att-stats').innerHTML = attStatsHtml(fresh);
    // ไม่วาดตารางใหม่ระหว่างครูกำลังเลือกสถานะ
    if (!document.activeElement?.classList.contains('att-sel')) document.getElementById('att-rows').innerHTML = attRowsHtml(fresh);
  } catch (err) {
    console.warn('โหลดรายชื่อเช็คชื่อไม่สำเร็จ', err);
  } finally {
    state.attLoading = false;
  }
}

// =========================================================
// นำเข้าข้อสอบจาก Excel
// =========================================================
async function viewImport({ id } = {}) {
  state.imp = { target: id || '', exams: [], rows: null, fileName: '', mode: 'append', title: '', duration: 15 };
  shell(loadingHtml());
  try {
    state.imp.exams = (await api('teacher_list_exams')).filter((e) => e.started_count === 0);
    if (id && !state.imp.exams.some((e) => e.id === id)) state.imp.target = '';
    renderImportPick();
  } catch (err) { main().innerHTML = errorState(err); }
}

const importHead = (step) => {
  const s = (n, label) => `<div class="s ${n < step ? 'done' : n === step ? 'on' : ''}"><i>${n < step ? '✓' : n}</i>${label}</div>`;
  return `
    <div class="main-head">
      <div><h1>นำเข้าข้อสอบจาก Excel</h1><p>กรอกข้อสอบใน Excel แล้วนำเข้าทีเดียว</p></div>
      <div class="head-actions"><button class="btn btn-secondary" data-act="template">${icon('download')}ดาวน์โหลด Template</button></div>
    </div>
    <div class="steps">${s(1, 'เลือกไฟล์')}<hr>${s(2, 'ตรวจสอบข้อมูล')}<hr>${s(3, 'นำเข้าเสร็จ')}</div>`;
};

function renderImportPick() {
  const imp = state.imp;
  main().innerHTML = `
    ${importHead(1)}
    <div class="card form-grid" style="padding:18px">
      <label class="field full"><span>นำเข้าไปที่ชุดสอบ</span>
        <select data-imp="target">
          <option value="">+ สร้างชุดสอบใหม่</option>
          ${imp.exams.map((e) => `<option value="${e.id}" ${e.id === imp.target ? 'selected' : ''}>${esc(e.title)} (${e.question_count} ข้อ)</option>`).join('')}
        </select>
      </label>
      <div class="full muted" style="font-size:13px;margin-top:-6px">ชุดสอบที่มีนักเรียนเริ่มสอบแล้วจะไม่อยู่ในรายการ เพราะแก้ข้อสอบไม่ได้</div>
    </div>
    <label class="drop" id="drop">
      <img src="${mascot('front')}" alt="" style="height:80px">
      <b style="color:var(--text);font-weight:500">ลากไฟล์ Excel มาวางที่นี่ หรือกดเพื่อเลือกไฟล์</b>
      <span style="font-size:13px">รองรับ .xlsx .xls .csv · ไม่เกิน 200 ข้อ · ใช้หัวคอลัมน์ตาม Template</span>
      <span class="btn btn-primary btn-sm" style="margin-top:6px">${icon('upload')}เลือกไฟล์</span>
      <input type="file" accept=".xlsx,.xls,.csv" hidden data-imp="file">
    </label>`;

  const drop = document.getElementById('drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    if (e.dataTransfer.files[0]) handleImportFile(e.dataTransfer.files[0]);
  });
}

async function handleImportFile(file) {
  const imp = state.imp;
  try {
    const { readQuestionFile } = await import('./excel.js');
    imp.rows = await readQuestionFile(file);
    imp.fileName = file.name;
    imp.title = file.name.replace(/\.(xlsx|xls|csv)$/i, '').slice(0, 200);
    renderImportPreview();
  } catch (err) { toast(err.message, 'error'); }
}

function renderImportPreview() {
  const imp = state.imp;
  const good = imp.rows.filter((r) => !r.errors.length);
  const bad = imp.rows.length - good.length;
  const target = imp.exams.find((e) => e.id === imp.target);
  const L = { A: 'A', B: 'B', C: 'C', D: 'D', 'ก': 'A', 'ข': 'B', 'ค': 'C', 'ง': 'D' };
  const cell = (v) => (v ? esc(v) : '<span class="muted">–</span>');
  main().innerHTML = `
    ${importHead(2)}
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <div class="list-row"><div class="tile g">${icon('file')}</div><div class="t"><b>${esc(imp.fileName)}</b><small>${imp.rows.length} ข้อ → ${target ? esc(target.title) : 'ชุดสอบใหม่'}</small></div></div>
      <div style="display:flex;gap:10px"><span class="pill green" style="font-size:14px;padding:6px 14px">ถูกต้อง ${good.length} ข้อ</span>${bad ? `<span class="pill red" style="font-size:14px;padding:6px 14px">ต้องแก้ ${bad} ข้อ</span>` : ''}</div>
    </div>
    ${target ? (target.question_count ? `
      <div class="card" style="display:flex;gap:20px;flex-wrap:wrap;padding:12px 16px">
        <span class="muted">ชุดนี้มีข้อสอบอยู่แล้ว ${target.question_count} ข้อ:</span>
        <label class="check"><input type="radio" name="imp-mode" value="append" data-imp="mode" ${imp.mode === 'append' ? 'checked' : ''}>ต่อท้ายข้อเดิม</label>
        <label class="check"><input type="radio" name="imp-mode" value="replace" data-imp="mode" ${imp.mode === 'replace' ? 'checked' : ''}>แทนที่ข้อเดิมทั้งหมด</label>
      </div>` : '') : `
      <div class="card form-grid" style="padding:16px">
        <label class="field"><span>ชื่อชุดสอบใหม่</span><input data-imp="title" maxlength="200" value="${esc(imp.title)}"></label>
        <label class="field"><span>เวลาทำข้อสอบ (นาที)</span><input data-imp="duration" type="number" min="1" max="300" value="${imp.duration}"></label>
      </div>`}
    <div class="card table-wrap" style="padding:8px 8px 4px;max-height:460px;overflow:auto">
      <table>
        <tr><th>แถว</th><th>คำถาม</th><th>A</th><th>B</th><th>C</th><th>D</th><th>เฉลย</th><th>คะแนน</th><th>ผลตรวจ</th></tr>
        ${imp.rows.map((r) => `
          <tr class="${r.errors.length ? 'err' : ''}">
            <td>${r.rowNo}</td><td>${cell(r.q.question_text)}</td>
            <td>${cell(r.q.option_a)}</td><td>${cell(r.q.option_b)}</td><td>${cell(r.q.option_c)}</td><td>${cell(r.q.option_d)}</td>
            <td><b>${esc(L[r.q.correct_answer.toUpperCase()] || r.q.correct_answer)}</b></td><td>${esc(r.q.points || '1')}</td>
            ${r.errors.length ? `<td class="why">${esc(r.errors.join(' · '))}</td>` : '<td><span class="pill green">✓ ถูกต้อง</span></td>'}
          </tr>`).join('')}
      </table>
    </div>
    <div class="foot-actions">
      <p>${icon('info', 'width:16px;height:16px')}${bad ? 'แถวที่ต้องแก้จะไม่ถูกนำเข้า แก้ในไฟล์แล้วอัปโหลดใหม่ได้' : 'ข้อมูลถูกต้องทุกแถว'}</p>
      <div>
        <button class="btn btn-secondary" data-act="import-cancel">เลือกไฟล์ใหม่</button>
        <button class="btn btn-primary" data-act="import-go" ${good.length ? '' : 'disabled'}>นำเข้า ${good.length} ข้อ</button>
      </div>
    </div>`;
}

async function runImport(btn) {
  const imp = state.imp;
  const questions = imp.rows.filter((r) => !r.errors.length).map((r) => r.q);
  btn.disabled = true;
  btn.textContent = 'กำลังนำเข้า…';
  try {
    let examId = imp.target;
    if (!examId) {
      const created = await api('save_exam', { exam: { title: imp.title, duration_minutes: imp.duration, pass_percent: 50 } });
      examId = created.id;
      imp.target = examId; // ถ้าขั้นต่อไปพลาด กดใหม่จะไม่สร้างชุดซ้ำ
      imp.exams.push({ ...created, question_count: 0 });
    }
    const saved = await api('save_questions', { exam_id: examId, questions, mode: imp.mode });
    main().innerHTML = `
      ${importHead(4)}
      ${stateHtml({
        img: 'love', title: `นำเข้า ${questions.length} ข้อเรียบร้อย!`,
        text: `ชุดสอบ "${saved.title}" มีข้อสอบ ${saved.questions.length} ข้อแล้ว ตรวจความถูกต้องแล้วกดเผยแพร่ได้เลยครับ`,
        button: `<div style="display:flex;gap:10px;margin-top:6px"><button class="btn btn-secondary btn-sm" data-go="import">นำเข้าไฟล์อื่น</button><button class="btn btn-primary btn-sm" data-go="edit" data-id="${saved.id}">เปิดชุดสอบ</button></div>`,
      })}`;
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = `นำเข้า ${questions.length} ข้อ`;
  }
}

// ช่องต่าง ๆ ในหน้านำเข้า
app.addEventListener('change', (e) => {
  const t = e.target;
  if (state.view === 'import' && t.dataset.imp) {
    if (t.dataset.imp === 'file' && t.files[0]) handleImportFile(t.files[0]);
    else if (t.dataset.imp === 'target') state.imp.target = t.value;
    else if (t.dataset.imp === 'mode') state.imp.mode = t.value;
  }
  if (t.dataset.act === 'switch-results') go('results', { id: t.value });
  if (t.dataset.act === 'att-set') setAttStatus(t);
});

async function setAttStatus(sel) {
  sel.disabled = true;
  try {
    state.att = await api('att_set', { session_id: state.att.id, profile_id: sel.dataset.pid, status: sel.value });
    sel.blur();
    document.getElementById('att-stats').innerHTML = attStatsHtml(state.att);
    document.getElementById('att-rows').innerHTML = attRowsHtml(state.att);
    toast('บันทึกสถานะแล้ว');
  } catch (err) {
    toast(err.message, 'error');
    sel.disabled = false;
  }
}
app.addEventListener('input', (e) => {
  const t = e.target;
  if (state.view === 'import' && (t.dataset.imp === 'title' || t.dataset.imp === 'duration')) state.imp[t.dataset.imp] = t.value;
});

// =========================================================
// ปุ่มต่าง ๆ
// =========================================================
app.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-go],[data-act]');
  if (!el || el.disabled) return;
  if (el.dataset.go) return go(el.dataset.go, { id: el.dataset.id || null });

  const act = el.dataset.act;
  const ex = state.exam;
  switch (act) {
    case 'reload': return location.reload();
    case 'line-login': return lineLogin();
    case 'logout': {
      if (state.dirty && !(await confirmBox({ title: 'ยังไม่ได้บันทึก', text: 'ออกจากระบบแล้วสิ่งที่แก้ไว้จะหายไป', ok: 'ออกจากระบบ', cancel: 'อยู่ต่อ', center: true }))) return;
      state.dirty = false;
      return logout();
    }
    case 'reset-demo': {
      const ok = await confirmBox({ img: 'surprised', title: 'ล้างข้อมูลทดลองทั้งหมด?', text: 'ข้อมูลจำลองในเครื่องนี้จะกลับเป็นค่าเริ่มต้น', ok: 'ล้างข้อมูล', danger: true, center: true });
      if (ok) { state.dirty = false; await resetDemo(); location.reload(); }
      return;
    }
    case 'template':
      try { await (await import('./excel.js')).downloadTemplate(); } catch (err) { toast(err.message, 'error'); }
      return;
    case 'export':
      try { await (await import('./excel.js')).exportResults(state.results); toast('ดาวน์โหลดไฟล์ Excel แล้ว'); } catch (err) { toast(err.message, 'error'); }
      return;
    case 'import-cancel':
      return renderImportPick();
    case 'att-new':
      return renderAttForm();
    case 'att-cancel':
      document.getElementById('att-new').innerHTML = '';
      return;
    case 'att-full':
      return document.getElementById('att-code')?.requestFullscreen?.().catch(() => toast('เบราว์เซอร์นี้ขยายเต็มจอไม่ได้ กด F11 แทนได้', 'error'));
    case 'att-close': {
      const ok = await confirmBox({ title: 'ปิดเช็คชื่อตอนนี้?', text: 'นักเรียนที่ยังไม่เช็คจะนับว่าขาด (แก้สถานะรายคนทีหลังได้)', ok: 'ปิดเช็คชื่อ', center: true });
      if (!ok) return;
      try { state.att = await api('att_close', { session_id: state.att.id }); renderAtt(); toast('ปิดเช็คชื่อแล้ว'); }
      catch (err) { toast(err.message, 'error'); }
      return;
    }
    case 'att-delete': {
      const ok = await confirmBox({ img: 'surprised', title: 'ลบคาบเช็คชื่อนี้?', text: 'ข้อมูลการเข้าเรียนของคาบนี้จะถูกลบ และกู้คืนไม่ได้', ok: 'ลบถาวร', danger: true, center: true });
      if (!ok) return;
      try { await api('att_delete', { session_id: state.att.id }); toast('ลบคาบแล้ว'); go('attendance'); }
      catch (err) { toast(err.message, 'error'); }
      return;
    }
    case 'att-export':
      try { await (await import('./excel.js')).exportAttendance(state.att); toast('ดาวน์โหลดไฟล์ Excel แล้ว'); } catch (err) { toast(err.message, 'error'); }
      return;
    case 'att-export-all':
      try {
        const report = await api('att_report');
        if (!report.sessions.length) return toast('ยังไม่มีการเช็คชื่อให้ export');
        await (await import('./excel.js')).exportAttendanceSummary(report);
        toast('ดาวน์โหลดไฟล์ Excel แล้ว');
      } catch (err) { toast(err.message, 'error'); }
      return;
    case 'import-go':
      return runImport(el);
    case 'publish':
      try { await api('set_published', { exam_id: el.dataset.id, publish: true }); toast('เผยแพร่แล้ว นักเรียนเห็นชุดสอบนี้แล้ว'); viewExams(); }
      catch (err) { toast(err.message, 'error'); }
      return;
    case 'save':
      return withBusy(el, async () => { await saveExam(); renderEditor(); });
    case 'toggle-publish':
      return withBusy(el, async () => {
        if (ex.is_published) {
          const ok = await confirmBox({ title: 'ซ่อนชุดสอบนี้?', text: 'นักเรียนจะไม่เห็นชุดสอบนี้จนกว่าจะเผยแพร่อีกครั้ง', ok: 'ซ่อน', center: true });
          if (!ok) return;
        }
        if (state.dirty || !ex.id) await saveExam({ quiet: true });
        state.exam = await api('set_published', { exam_id: state.exam.id, publish: !state.exam.is_published });
        toast(state.exam.is_published ? 'เผยแพร่แล้ว นักเรียนเห็นชุดสอบนี้แล้ว' : 'ซ่อนชุดสอบแล้ว');
        renderEditor();
      });
    case 'delete-exam': {
      const ok = await confirmBox({
        img: 'surprised', title: 'ลบชุดสอบนี้?', danger: true, center: true, ok: 'ลบถาวร',
        text: ex.locked ? 'ผลสอบของนักเรียนในชุดนี้จะถูกลบด้วย และกู้คืนไม่ได้' : 'ข้อสอบทั้งหมดในชุดนี้จะถูกลบ และกู้คืนไม่ได้',
      });
      if (!ok) return;
      try { await api('delete_exam', { exam_id: ex.id }); state.dirty = false; toast('ลบชุดสอบแล้ว'); go('exams'); }
      catch (err) { toast(err.message, 'error'); }
      return;
    }
    case 'add-q':
      ex.questions.push(blankQuestion());
      state.dirty = true;
      refreshQuestions();
      document.querySelector(`[data-qcard="${ex.questions.length - 1}"] textarea`)?.focus();
      return;
    case 'q-del': {
      const i = Number(el.dataset.i);
      const q = ex.questions[i];
      if (q.question_text.trim() && !(await confirmBox({ title: `ลบข้อ ${i + 1}?`, ok: 'ลบ', danger: true, center: true }))) return;
      ex.questions.splice(i, 1);
      state.dirty = true;
      return refreshQuestions();
    }
    case 'q-up':
    case 'q-down': {
      const i = Number(el.dataset.i);
      const j = act === 'q-up' ? i - 1 : i + 1;
      [ex.questions[i], ex.questions[j]] = [ex.questions[j], ex.questions[i]];
      state.dirty = true;
      return refreshQuestions();
    }
  }
});

start();
