// =========================================================
// หน้านักเรียน (index.html): LINE Mini App
// =========================================================
import { IS_DEMO } from './config.js';
import { initLine, inLineApp, scanQr } from './line.js';
import { api } from './api.js';
import { esc, mascot, loadingHtml, stateHtml, demoBanner, toast, avatarHtml, confirmBox, fmtDate, fmtDateYear, fmtDuration, attPill } from './ui.js';
import { icon, leaf } from './icons.js';
import { checkinFromUrl, codeFromScan } from './qr.js';

const app = document.getElementById('app');
const state = {
  me: null,
  tab: 'home',
  exams: [],
  // ระหว่างสอบ
  paper: null, answers: {}, index: 0, offset: 0, timer: null, submitting: false,
};
const LETTER = { A: 'ก', B: 'ข', C: 'ค', D: 'ง' };

// ---------- รหัสจาก QR เช็คชื่อ ----------
// เก็บไว้ก่อน (ให้รอดตอน login LINE / ลงทะเบียน) แล้วลบออกจาก URL กันเช็คซ้ำตอนรีเฟรช
const PENDING = 'quizzy:checkin';
function takeQrCode() {
  const code = checkinFromUrl();
  if (!code) return;
  sessionStorage.setItem(PENDING, code);
  const url = new URL(location.href);
  if (url.searchParams.has('checkin')) {
    url.searchParams.delete('checkin');
    history.replaceState(null, '', url);
  }
}
const firstTab = () => (sessionStorage.getItem(PENDING) ? 'checkin' : 'home');

// ---------- เริ่มต้น ----------
async function start() {
  takeQrCode();
  app.innerHTML = loadingHtml('น้องแต่วกำลังมา');
  try {
    await initLine();
    takeQrCode(); // หลัง LIFF แปลง liff.state กลับเป็น ?checkin=
    state.me = await api('me');
    if (!state.me.registered) renderRegister();
    else showTab(firstTab());
  } catch (err) {
    renderError(err);
  }
}

function renderError(err) {
  console.error(err);
  app.innerHTML = stateHtml({
    img: 'surprised',
    title: 'เชื่อมต่อไม่สำเร็จ',
    text: err?.message || 'ลองใหม่อีกครั้งนะครับ',
    button: '<button class="btn btn-secondary btn-sm" data-act="reload">ลองอีกครั้ง</button>',
  });
}
const top = () => (IS_DEMO ? demoBanner() : '');

// ---------- ลงทะเบียนครั้งแรก ----------
function renderRegister() {
  const me = state.me;
  app.innerHTML = `
    ${top()}
    <div class="hero">
      ${leaf('left:-8px;top:70px;transform:rotate(-20deg)')}
      ${leaf('right:-10px;top:130px;transform:scaleX(-1) rotate(-10deg);width:46px;height:46px')}
      <div class="logo">Quiz<span>zy</span></div>
      <div class="tag">สนุกกับการสอบ เก่งขึ้นทุกวัน!</div>
      <div class="bubble" style="left:16px;top:120px">สวัสดีครับ<br>น้องแต่วมาแล้ว!</div>
      <img class="mascot" src="${mascot('happy')}" alt="น้องแต่ว">
    </div>
    <form class="welcome-card" id="reg" novalidate>
      <div class="list-row">
        ${avatarHtml(me)}
        <div class="t"><small>เข้าสู่ระบบด้วย LINE แล้ว</small><b>${esc(me.display_name || '')}</b></div>
      </div>
      <p class="muted" style="font-size:14px">ลงทะเบียนครั้งแรกครั้งเดียว ครูจะเห็นชื่อนี้ในผลสอบ</p>
      <label class="field"><span>ชื่อ-นามสกุล</span>
        <input name="full_name" autocomplete="name" maxlength="100" placeholder="เช่น ด.ช.ภูมิ ใจดี" required>
      </label>
      <label class="field"><span>รหัสนักเรียน</span>
        <input name="student_code" inputmode="numeric" maxlength="30" placeholder="เช่น 65012" required>
      </label>
      <button class="btn btn-primary" type="submit" style="margin-top:4px">เริ่มเลย</button>
    </form>`;

  const form = app.querySelector('#reg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const full_name = form.full_name.value.trim();
    const student_code = form.student_code.value.trim();
    if (full_name.length < 2) return toast('กรุณากรอกชื่อ-นามสกุล', 'error');
    if (!student_code) return toast('กรุณากรอกรหัสนักเรียน', 'error');

    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'กำลังบันทึก…';
    try {
      state.me = await api('register', { full_name, student_code });
      toast('ลงทะเบียนเรียบร้อย ยินดีต้อนรับครับ!');
      showTab(firstTab());
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'เริ่มเลย';
    }
  });
}

// =========================================================
// แท็บหลัก
// =========================================================
function tabbar() {
  const t = (id, ic, label) => `<button class="${state.tab === id ? 'on' : ''}" data-tab="${id}">${icon(ic)}${label}</button>`;
  return `<nav class="tabbar">${t('home', 'home', 'หน้าแรก')}${t('checkin', 'check', 'เช็คชื่อ')}${t('history', 'chart', 'ผลสอบของฉัน')}${t('profile', 'user', 'โปรไฟล์')}</nav>`;
}

function showTab(tab) {
  stopTimer();
  state.tab = tab;
  window.scrollTo(0, 0);
  if (tab === 'home') renderHome();
  else if (tab === 'checkin') renderCheckin();
  else if (tab === 'history') renderHistory();
  else renderProfile();
}

async function loadExams() {
  state.exams = await api('list_exams');
  return state.exams;
}

// ---------- หน้าแรก ----------
async function renderHome() {
  const me = state.me;
  app.innerHTML = `
    ${top()}
    <div class="body with-tabbar">
      <div class="list-row" style="padding-top:10px">
        ${avatarHtml(me)}
        <div class="t"><small>สวัสดีครับ</small><b style="font-size:17px;font-weight:600">${esc(me.full_name)}</b></div>
      </div>
      <div id="home-list">${loadingHtml()}</div>
    </div>
    ${tabbar()}`;

  const box = document.getElementById('home-list');
  try {
    const exams = await loadExams();
    const waiting = exams.filter((e) => e.status === 'open' && e.attempt?.status !== 'submitted');
    const firstClose = waiting.map((e) => e.close_at).filter(Boolean).sort()[0];
    // เรียง: ทำค้างไว้ → เปิดอยู่ → ยังไม่ถึงเวลา → ส่งแล้ว
    const rank = (e) => (e.attempt?.status === 'in_progress' ? 0 : e.attempt ? 3 : e.status === 'open' ? 1 : 2);
    const sorted = [...exams].sort((a, b) => rank(a) - rank(b));

    if (!exams.length) {
      box.innerHTML = stateHtml({ img: 'sleep', title: 'ยังไม่มีข้อสอบตอนนี้', text: 'พักผ่อนก่อนนะครับ เมื่อครูเปิดสอบจะขึ้นที่หน้านี้' });
      return;
    }
    box.innerHTML = `
      ${waiting.length ? `
        <div class="card banner">
          <div class="big">มีข้อสอบรอคุณ<br>อยู่ ${waiting.length} ชุด</div>
          <small>${firstClose ? `ปิดรับชุดแรก ${fmtDate(firstClose)}` : 'ทำได้เลยตอนนี้'}</small>
          <img src="${mascot('wink')}" alt="">
        </div>` : `
        <div class="card banner">
          <div class="big">ทำข้อสอบครบ<br>ทุกชุดแล้ว!</div>
          <small>เก่งมากครับ รอชุดต่อไปนะ</small>
          <img src="${mascot('love')}" alt="">
        </div>`}
      <div class="sec" style="margin-top:12px"><h2>ข้อสอบของฉัน</h2></div>
      <div style="display:flex;flex-direction:column;gap:10px">${sorted.map(examRow).join('')}</div>`;
  } catch (err) {
    box.innerHTML = stateHtml({ img: 'surprised', title: 'โหลดข้อสอบไม่สำเร็จ', text: err.message, button: '<button class="btn btn-secondary btn-sm" data-tab="home">ลองอีกครั้ง</button>' });
  }
}

function examRow(e) {
  const a = e.attempt;
  let tile = `<div class="tile">${icon('clip')}</div>`;
  let sub = `${e.question_count} ข้อ · ${e.duration_minutes} นาที${e.close_at ? ` · ปิด ${fmtDate(e.close_at)}` : ''}`;
  let btn = `<span class="btn btn-primary btn-sm">เริ่มสอบ</span>`;
  if (a?.status === 'submitted') {
    tile = `<div class="tile g">${icon('check')}</div>`;
    sub = `ส่งแล้ว ${fmtDate(a.submitted_at)}`;
    btn = `<span class="btn btn-green btn-sm">ได้ ${a.score}/${a.max_score}</span>`;
  } else if (a?.status === 'in_progress') {
    sub = 'กำลังทำอยู่ · เวลายังเดินอยู่';
    btn = `<span class="btn btn-primary btn-sm">ทำต่อ</span>`;
  } else if (e.status === 'scheduled') {
    sub = `เปิดสอบ ${fmtDate(e.open_at)}`;
    btn = `<span class="pill gray">ยังไม่เปิด</span>`;
  }
  return `
    <button class="card list-row" data-exam="${e.id}">
      ${tile}
      <div class="t"><b>${esc(e.title)}</b><small>${esc(sub)}</small></div>
      ${btn}
    </button>`;
}

function openExam(id) {
  const e = state.exams.find((x) => x.id === id);
  if (!e) return;
  if (e.attempt?.status === 'submitted') return renderResult(e.attempt);
  if (!e.attempt && e.status === 'scheduled') return toast(`ยังไม่ถึงเวลาเปิดสอบ (เปิด ${fmtDate(e.open_at)})`);
  renderIntro(e);
}

// ---------- คำชี้แจงก่อนสอบ ----------
function renderIntro(e) {
  const resume = e.attempt?.status === 'in_progress';
  app.innerHTML = `
    ${top()}
    <div class="appbar"><button class="btn-icon" data-tab="home" aria-label="กลับ">${icon('back')}</button><h1>คำชี้แจง</h1><span style="width:38px"></span></div>
    <div class="body" style="padding-top:0">
      <div class="card" style="padding:18px">
        <div style="font-size:20px;font-weight:600;line-height:1.35">${esc(e.title)}</div>
        ${e.close_at ? `<div class="muted" style="font-size:13.5px;margin-top:2px">ปิดรับ ${fmtDate(e.close_at)}</div>` : ''}
        ${e.description ? `<p style="font-size:14.5px;margin-top:8px;white-space:pre-wrap">${esc(e.description)}</p>` : ''}
        <div class="mini-stats"><div><b>${e.question_count}</b>ข้อ</div><div><b>${e.duration_minutes}</b>นาที</div><div><b>${e.max_score}</b>คะแนนเต็ม</div></div>
      </div>
      <div class="card" style="display:flex;flex-direction:column;gap:12px;font-size:14.5px">
        <div class="list-row"><div class="tile g sm">${icon('check')}</div>สอบได้ครั้งเดียว ส่งแล้วแก้ไม่ได้</div>
        <div class="list-row"><div class="tile g sm">${icon('clock')}</div>เวลาเริ่มนับทันทีที่กดเริ่ม</div>
        <div class="list-row"><div class="tile g sm">${icon('upload')}</div>หมดเวลา ระบบส่งคำตอบให้เอง</div>
        <div class="list-row"><div class="tile g sm">${icon('info')}</div>หลุดออกจากแอป กลับมาทำต่อได้ (เวลายังเดิน)</div>
      </div>
      <button class="btn btn-primary" data-start="${e.id}" style="margin-top:auto">${resume ? 'ทำข้อสอบต่อ' : 'เริ่มทำข้อสอบ'}</button>
    </div>`;
}

// =========================================================
// ทำข้อสอบ
// =========================================================
const storeKey = (examId) => `quizzy:answers:${state.me.id}:${examId}`;
const remaining = () => Date.parse(state.paper.deadline_at) - (Date.now() + state.offset);

async function beginExam(examId, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'กำลังเปิดข้อสอบ…'; }
  try {
    const res = await api('start_exam', { exam_id: examId });
    if (res.status === 'submitted') return renderResult(res.result);
    state.paper = res;
    state.offset = Date.parse(res.server_now) - Date.now(); // ชดเชยนาฬิกาเครื่องที่ไม่ตรง
    state.answers = JSON.parse(localStorage.getItem(storeKey(examId)) || '{}');
    state.index = Math.max(0, res.questions.findIndex((q) => !state.answers[q.id]));
    state.submitting = false;
    if (remaining() <= 0) return submitExam({ auto: true }); // กลับมาหลังหมดเวลา: ส่งที่ตอบไว้ทันที
    renderQuestion();
    startTimer();
  } catch (err) {
    toast(err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'เริ่มทำข้อสอบ'; }
  }
}

function renderQuestion() {
  const { paper, index, answers } = state;
  const q = paper.questions[index];
  const n = paper.questions.length;
  const last = index === n - 1;
  app.innerHTML = `
    ${top()}
    <div class="body" style="padding-top:12px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-weight:600">ข้อ ${index + 1} <span class="muted" style="font-weight:400">/ ${n}</span></div>
        <span class="timer" id="timer">${icon('clock', 'width:17px;height:17px')}<span>--:--</span></span>
      </div>
      <div class="progress"><i style="width:${(Object.keys(answers).length / n) * 100}%"></i></div>
      <div class="card" style="padding:18px">
        <span class="q-num">ข้อ ${index + 1} · ${q.points} คะแนน</span>
        <div class="q-text">${esc(q.question_text)}</div>
      </div>
      ${q.options.map((o) => `
        <button class="opt ${answers[q.id] === o.key ? 'sel' : ''}" data-pick="${o.key}">
          <span class="k">${LETTER[o.key]}</span><span>${esc(o.text)}</span>
        </button>`).join('')}
      <div class="saved" id="saved" ${answers[q.id] ? '' : 'hidden'}>${icon('check', 'width:14px;height:14px')}บันทึกคำตอบในเครื่องแล้ว</div>
    </div>
    <div class="exam-foot">
      <button class="grid-btn" data-act="grid" aria-label="ดูทุกข้อ">${icon('grid')}</button>
      <button class="btn btn-secondary" data-act="prev" ${index === 0 ? 'disabled' : ''}>ก่อนหน้า</button>
      <button class="btn btn-primary" data-act="${last ? 'finish' : 'next'}">${last ? 'ส่งคำตอบ' : 'ถัดไป'}</button>
    </div>`;
  tick();
}

function pick(key) {
  const q = state.paper.questions[state.index];
  state.answers[q.id] = key;
  localStorage.setItem(storeKey(state.paper.exam.id), JSON.stringify(state.answers));
  app.querySelectorAll('.opt').forEach((b) => b.classList.toggle('sel', b.dataset.pick === key));
  document.getElementById('saved').hidden = false;
  app.querySelector('.progress i').style.width = `${(Object.keys(state.answers).length / state.paper.questions.length) * 100}%`;
}

function numsHtml(current = -1) {
  return `<div class="nums">${state.paper.questions.map((q, i) => {
    const cls = state.answers[q.id] ? 'done' : current < 0 ? 'miss' : '';
    return `<button class="${cls} ${i === current ? 'cur' : ''}" data-jump="${i}">${i + 1}</button>`;
  }).join('')}</div>`;
}

// แผงเลขข้อ: กดเพื่อกระโดดไปข้อนั้น
function openGrid() {
  const wrap = document.createElement('div');
  wrap.className = 'overlay';
  wrap.innerHTML = `<div class="sheet"><h3>เลือกข้อ</h3><p class="muted" style="font-size:13.5px">สีเขียว = ตอบแล้ว</p>${numsHtml(state.index)}
    <button class="btn btn-secondary" data-v="close">ปิด</button></div>`;
  wrap.addEventListener('click', (e) => {
    const j = e.target.closest('[data-jump]');
    if (j) { state.index = Number(j.dataset.jump); renderQuestion(); }
    if (j || e.target === wrap || e.target.closest('[data-v]')) wrap.remove();
  });
  document.body.appendChild(wrap);
}

async function confirmSubmit() {
  const qs = state.paper.questions;
  const missing = qs.map((q, i) => (state.answers[q.id] ? null : i + 1)).filter(Boolean);
  const ok = await confirmBox({
    img: 'curious',
    title: 'ส่งคำตอบเลยไหมครับ?',
    text: missing.length
      ? `ตอบแล้ว ${qs.length - missing.length} จาก ${qs.length} ข้อ · ยังไม่ได้ตอบข้อ ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}`
      : `ตอบครบทั้ง ${qs.length} ข้อแล้ว ส่งแล้วแก้ไขไม่ได้นะครับ`,
    extra: numsHtml(),
    ok: 'ส่งคำตอบ',
    cancel: 'กลับไปตรวจ',
  });
  if (ok) submitExam();
}

async function submitExam({ auto = false } = {}) {
  if (state.submitting) return;
  state.submitting = true;
  stopTimer();
  document.querySelector('.overlay')?.remove();
  const examId = state.paper.exam.id;
  app.innerHTML = loadingHtml(auto ? 'หมดเวลา กำลังส่งคำตอบ' : 'กำลังส่งคำตอบ');
  try {
    const res = await api('submit_exam', { exam_id: examId, answers: state.answers });
    localStorage.removeItem(storeKey(examId));
    state.paper = null;
    renderResult(res.result, true);
  } catch (err) {
    // ส่งไม่สำเร็จ: คำตอบยังอยู่ในเครื่อง ให้กดส่งใหม่ได้
    state.submitting = false;
    app.innerHTML = `${top()}${stateHtml({
      img: 'surprised', title: 'ส่งคำตอบไม่สำเร็จ',
      text: `${err.message} · คำตอบยังเก็บไว้ในเครื่อง กดส่งอีกครั้งได้เลย`,
      button: '<button class="btn btn-primary btn-sm" data-act="retry-submit">ส่งอีกครั้ง</button>',
    })}`;
  }
}

// ---------- ตัวจับเวลา (อิงเวลา server) ----------
function startTimer() {
  stopTimer();
  state.timer = setInterval(tick, 1000);
}
function stopTimer() {
  clearInterval(state.timer);
  state.timer = null;
}
function tick() {
  if (!state.paper) return;
  const ms = remaining();
  const el = document.getElementById('timer');
  if (el) {
    el.querySelector('span').textContent = fmtDuration(ms / 1000);
    el.classList.toggle('warn', ms < 60e3);
  }
  if (ms <= 0 && state.timer) submitExam({ auto: true });
}
// กลับมาที่แอปหลังสลับไปแอปอื่น: อัปเดตเวลาทันที
document.addEventListener('visibilitychange', () => { if (!document.hidden && state.timer) tick(); });
window.addEventListener('beforeunload', (e) => { if (state.timer) e.preventDefault(); });

// =========================================================
// ผลคะแนน
// =========================================================
function renderResult(r, justSubmitted = false) {
  stopTimer();
  const pct = r.percent ?? 0;
  const [img, says] = pct >= 80 ? ['happy', 'เก่งมากเลยครับ!'] : r.passed ? ['wink', 'ผ่านแล้ว เยี่ยมเลย!'] : ['curious', 'สู้ใหม่นะ!'];
  const used = r.submitted_at && r.started_at ? (Date.parse(r.submitted_at) - Date.parse(r.started_at)) / 1000 : null;
  app.innerHTML = `
    ${top()}
    <div class="sun">
      <div class="bubble" style="left:20px;top:56px">${says}</div>
      <img class="mascot" src="${mascot(img)}" alt="">
    </div>
    <div class="card score-card">
      <div class="muted" style="font-size:14px">${esc(r.exam_title)}</div>
      <div class="score">${r.score} <small>/ ${r.max_score}</small></div>
      <span class="pill ${r.passed ? 'green' : 'orange'}" style="font-size:13.5px;padding:4px 12px;margin-top:6px">
        ${r.passed ? `${icon('check', 'width:15px;height:15px')}ผ่านเกณฑ์` : 'ยังไม่ผ่านเกณฑ์'} · ${pct}%</span>
      <div class="mini-stats">
        <div><b>${used != null ? fmtDuration(Math.min(used, 359999)) : '-'}</b>ใช้เวลา</div>
        <div><b>${r.correct_count}/${r.question_count}</b>ตอบถูก</div>
        <div><b>${fmtDate(r.submitted_at, false)}</b>ส่งเมื่อ</div>
      </div>
      ${r.is_late ? '<p class="muted" style="font-size:12.5px;margin-top:10px">ส่งหลังหมดเวลา ครูจะเห็นว่าส่งช้า</p>' : ''}
    </div>
    <div class="body" style="justify-content:flex-end;padding-top:20px">
      ${justSubmitted ? `<p class="center muted" style="font-size:13.5px">${icon('check', 'width:14px;height:14px;vertical-align:-2px;color:var(--green)')} ส่งคำตอบเรียบร้อยแล้ว</p>` : ''}
      <button class="btn btn-primary" data-tab="home">กลับหน้าแรก</button>
    </div>`;
}

// ---------- ผลสอบของฉัน ----------
async function renderHistory() {
  app.innerHTML = `
    ${top()}
    <div class="appbar"><h1>ผลสอบของฉัน</h1></div>
    <div class="body with-tabbar" id="hist">${loadingHtml()}</div>
    ${tabbar()}`;
  const box = document.getElementById('hist');
  try {
    const done = (await loadExams()).filter((e) => e.attempt?.status === 'submitted')
      .sort((a, b) => b.attempt.submitted_at.localeCompare(a.attempt.submitted_at));
    if (!done.length) {
      box.innerHTML = stateHtml({ img: 'sleep', title: 'ยังไม่มีผลสอบ', text: 'ทำข้อสอบชุดแรกแล้วผลจะขึ้นที่นี่ครับ' });
      return;
    }
    const avg = Math.round(done.reduce((s, e) => s + e.attempt.percent, 0) / done.length);
    const passed = done.filter((e) => e.attempt.passed).length;
    box.innerHTML = `
      <div class="card" style="padding:16px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><div class="muted" style="font-size:13px">คะแนนเฉลี่ย</div><div style="font-size:30px;font-weight:700;color:var(--brown);line-height:1.1">${avg}%</div></div>
          <div class="muted" style="text-align:right;font-size:13px">สอบแล้ว <b style="color:var(--text)">${done.length}</b> ชุด<br>ผ่าน <b style="color:var(--green)">${passed}</b> ชุด</div>
        </div>
        <div class="progress" style="margin-top:10px"><i style="width:${avg}%"></i></div>
      </div>
      ${done.map((e) => `
        <button class="card list-row" data-exam="${e.id}">
          <div class="tile ${e.attempt.passed ? 'g' : ''}">${icon(e.attempt.passed ? 'star' : 'clip')}</div>
          <div class="t"><b>${esc(e.title)}</b><small>${fmtDate(e.attempt.submitted_at, false)} · ${e.attempt.score}/${e.attempt.max_score}</small></div>
          <span class="pill ${e.attempt.passed ? 'green' : 'orange'}">${e.attempt.percent}%${e.attempt.passed ? '' : ' · ไม่ผ่าน'}</span>
        </button>`).join('')}`;
  } catch (err) {
    box.innerHTML = stateHtml({ img: 'surprised', title: 'โหลดผลสอบไม่สำเร็จ', text: err.message });
  }
}

// =========================================================
// เช็คชื่อเข้าเรียน
// =========================================================
function renderCheckin() {
  app.innerHTML = `
    ${top()}
    <div class="appbar"><h1>เช็คชื่อเข้าเรียน</h1></div>
    <div class="body with-tabbar">
      <div id="att-box">${checkinFormHtml()}</div>
      <div class="sec" style="margin-top:6px"><h2>ประวัติการเข้าเรียน</h2></div>
      <div id="att-hist">${loadingHtml()}</div>
    </div>
    ${tabbar()}`;
  bindCheckinForm();
  loadAttHistory();
  // เปิดมาจาก QR: เช็คชื่อให้ทันที
  const pending = sessionStorage.getItem(PENDING);
  if (pending) {
    sessionStorage.removeItem(PENDING);
    const form = document.getElementById('att-form');
    form.code.value = pending;
    checkIn(form);
  }
}

const checkinFormHtml = () => `
  <form class="card att-form" id="att-form" novalidate>
    <img src="${mascot('front')}" alt="" style="height:86px;margin:0 auto">
    <b style="font-size:17px;color:var(--brown);text-align:center">กรอกรหัส 4 หลักจากจอของครู</b>
    <input class="code-input" name="code" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="••••" aria-label="รหัสเช็คชื่อ">
    <button class="btn btn-primary" type="submit">เช็คชื่อ</button>
    <button class="btn btn-secondary" type="button" data-act="scan-qr">${icon('qr')}สแกน QR บนจอครู</button>
  </form>`;

function bindCheckinForm() {
  const form = document.getElementById('att-form');
  const input = form.code;
  input.addEventListener('input', () => {
    // รับเลขไทยได้ และเหลือเฉพาะตัวเลข
    input.value = input.value.replace(/[๐-๙]/g, (c) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(c))).replace(/\D/g, '').slice(0, 4);
    if (input.value.length === 4) form.requestSubmit();
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    checkIn(form);
  });
}

// สแกน QR ด้วยกล้องในแอป LINE แล้วเช็คชื่อทันที
// ปุ่มขึ้นตลอด ถ้าสแกนไม่ได้ให้บอกเหตุผล (ไม่ซ่อนปุ่มเฉย ๆ)
async function scanAndCheckIn() {
  if (IS_DEMO) return toast('โหมดทดลองสแกน QR ไม่ได้ กรอกรหัส 4 หลักจากจอครูแทนได้', 'error');
  if (!inLineApp()) {
    return toast('ปุ่มสแกนใช้ได้เมื่อเปิด Quizzy ในแอป LINE บนมือถือ (ลิงก์ liff.line.me) · ตอนนี้ใช้กล้องมือถือสแกน QR หรือกรอกรหัสแทนได้', 'error');
  }
  try {
    const text = await scanQr();
    if (!text) return; // กดยกเลิก
    const code = codeFromScan(text);
    if (!code) return toast('QR นี้ไม่ใช่ QR เช็คชื่อของ Quizzy', 'error');
    const form = document.getElementById('att-form');
    if (!form) return;
    form.code.value = code;
    checkIn(form);
  } catch (err) {
    toast(err.message || 'เปิดกล้องสแกนไม่สำเร็จ กรอกรหัสแทนได้', 'error');
  }
}

async function checkIn(form) {
  const code = form.code.value;
  if (code.length !== 4) return toast('กรอกรหัสให้ครบ 4 หลัก', 'error');
  const btn = form.querySelector('button[type=submit]');
  if (btn.disabled) return;
  btn.disabled = true;
  btn.textContent = 'กำลังเช็คชื่อ…';
  try {
    const r = await api('att_checkin', { code });
    if (r.result === 'wrong_code') {
      toast(`รหัสไม่ถูกต้อง ดูที่จอของครูอีกครั้งนะครับ (ลองได้อีก ${r.attempts_left} ครั้ง)`, 'error');
      form.code.value = '';
      form.code.focus();
      return;
    }
    const late = r.status === 'late';
    const title = r.result === 'already' ? 'เช็คชื่อคาบนี้ไปแล้ว' : late ? 'เช็คชื่อแล้ว (สาย)' : 'เช็คชื่อแล้ว!';
    document.getElementById('att-box').innerHTML = `
      <div class="card att-form center">
        <img src="${mascot(late ? 'surprised' : 'happy')}" alt="" style="height:100px;margin:0 auto">
        <b style="font-size:19px;color:var(--brown)">${title}</b>
        <div class="muted" style="font-size:14px">${esc(r.title)}${r.checked_at ? ` · ${fmtDate(r.checked_at)}` : ''}</div>
        <div>${attPill(r.status)}</div>
        <button class="btn btn-secondary btn-sm" data-act="att-again" style="margin:4px auto 0;width:auto">เช็คชื่อคาบอื่น</button>
      </div>`;
    loadAttHistory();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    if (document.body.contains(btn)) { btn.disabled = false; btn.textContent = 'เช็คชื่อ'; }
  }
}

async function loadAttHistory() {
  const box = document.getElementById('att-hist');
  if (!box) return;
  try {
    const h = await api('att_history');
    if (!document.body.contains(box)) return;
    if (!h.rows.length) {
      box.innerHTML = '<p class="muted center" style="font-size:14px;padding:12px">ยังไม่มีประวัติการเช็คชื่อ</p>';
      return;
    }
    const s = h.summary;
    box.innerHTML = `
      <div class="card" style="padding:12px 14px">
        <div class="mini-stats" style="margin-top:0">
          <div><b style="color:var(--green)">${s.present}</b>มา</div><div><b style="color:var(--orange-d)">${s.late}</b>สาย</div>
          <div><b style="color:var(--red)">${s.absent}</b>ขาด</div><div><b>${s.leave}</b>ลา</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">${h.rows.map((r) => `
        <div class="card list-row">
          <div class="tile ${['present', 'late'].includes(r.status) ? 'g' : ''} sm">${icon(['present', 'late'].includes(r.status) ? 'check' : 'clock')}</div>
          <div class="t"><b>${esc(r.title)}</b><small>${fmtDate(r.opens_at)}${r.checked_at ? ` · เช็คเมื่อ ${fmtDate(r.checked_at)}` : ''}</small></div>
          ${r.status === 'pending' ? '<span class="pill orange">ยังไม่เช็ค</span>' : attPill(r.status)}
        </div>`).join('')}</div>`;
  } catch (err) {
    box.innerHTML = `<p class="muted center" style="font-size:14px">${esc(err.message)}</p>`;
  }
}

// ---------- โปรไฟล์ ----------
function renderProfile() {
  const me = state.me;
  app.innerHTML = `
    ${top()}
    <div class="appbar"><h1>โปรไฟล์</h1></div>
    <div class="body with-tabbar">
      <div class="card center" style="padding:22px 16px">
        <div style="display:flex;justify-content:center">${avatarHtml(me, 'lg')}</div>
        <div style="font-size:19px;font-weight:600;margin-top:10px">${esc(me.full_name)}</div>
        <div class="muted" style="font-size:14px">รหัสนักเรียน ${esc(me.student_code || '-')}</div>
      </div>
      <div class="card" style="padding:4px 14px">
        <div class="list-row" style="padding:12px 0;border-bottom:1px solid var(--line)"><span class="t muted">ชื่อใน LINE</span><span>${esc(me.display_name || '-')}</span></div>
        <div class="list-row" style="padding:12px 0"><span class="t muted">ลงทะเบียนเมื่อ</span><span>${fmtDateYear(me.created_at)}</span></div>
      </div>
      <p class="muted center" style="font-size:12.5px;margin-top:auto">หากชื่อหรือรหัสไม่ถูกต้อง แจ้งครูประจำวิชาได้เลยครับ</p>
    </div>
    ${tabbar()}`;
}

// ---------- ปุ่มต่าง ๆ (ใช้ event delegation) ----------
app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-tab],[data-act],[data-exam],[data-start],[data-pick]');
  if (!el || el.disabled) return;
  if (el.dataset.tab) return showTab(el.dataset.tab);
  if (el.dataset.exam) return openExam(el.dataset.exam);
  if (el.dataset.start) return beginExam(el.dataset.start, el);
  if (el.dataset.pick) return pick(el.dataset.pick);
  switch (el.dataset.act) {
    case 'reload': return location.reload();
    case 'prev': state.index -= 1; return renderQuestion();
    case 'next': state.index += 1; return renderQuestion();
    case 'grid': return openGrid();
    case 'finish': return confirmSubmit();
    case 'retry-submit': return submitExam();
    case 'scan-qr': return scanAndCheckIn();
    case 'att-again':
      document.getElementById('att-box').innerHTML = checkinFormHtml();
      bindCheckinForm();
      return document.querySelector('#att-form input').focus();
  }
});

start();
