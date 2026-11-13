// =========================================================
// หน้านักเรียน (index.html): LINE Mini App
// =========================================================
import { IS_DEMO } from './config.js';
import { initLine } from './line.js';
import { api } from './api.js';
import { esc, mascot, loadingHtml, stateHtml, demoBanner, toast, avatarHtml, fmtDateYear } from './ui.js';
import { icon, leaf } from './icons.js';

const app = document.getElementById('app');
const state = { me: null, tab: 'home' };

// ---------- เริ่มต้น ----------
async function start() {
  app.innerHTML = loadingHtml('น้องแต่วกำลังมา');
  try {
    await initLine();
    state.me = await api('me');
    if (!state.me.registered) renderRegister();
    else showTab('home');
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

// ---------- ลงทะเบียนครั้งแรก ----------
function renderRegister() {
  const me = state.me;
  app.innerHTML = `
    ${IS_DEMO ? demoBanner() : ''}
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
      showTab('home');
    } catch (err) {
      toast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'เริ่มเลย';
    }
  });
}

// ---------- แท็บหลัก ----------
function tabbar() {
  const t = (id, ic, label) => `<button class="${state.tab === id ? 'on' : ''}" data-tab="${id}">${icon(ic)}${label}</button>`;
  return `<nav class="tabbar">${t('home', 'home', 'หน้าแรก')}${t('history', 'chart', 'ผลสอบของฉัน')}${t('profile', 'user', 'โปรไฟล์')}</nav>`;
}

function showTab(tab) {
  state.tab = tab;
  window.scrollTo(0, 0);
  if (tab === 'home') renderHome();
  else if (tab === 'history') renderHistory();
  else renderProfile();
}

function renderHome() {
  const me = state.me;
  app.innerHTML = `
    ${IS_DEMO ? demoBanner() : ''}
    <div class="body with-tabbar">
      <div class="list-row" style="padding-top:10px">
        ${avatarHtml(me)}
        <div class="t"><small>สวัสดีครับ</small><b style="font-size:17px;font-weight:600">${esc(me.full_name)}</b></div>
      </div>
      ${stateHtml({ img: 'sleep', title: 'ยังไม่มีข้อสอบตอนนี้', text: 'พักผ่อนก่อนนะครับ เมื่อครูเปิดสอบจะขึ้นที่หน้านี้' })}
    </div>
    ${tabbar()}`;
}

function renderHistory() {
  app.innerHTML = `
    ${IS_DEMO ? demoBanner() : ''}
    <div class="appbar"><h1>ผลสอบของฉัน</h1></div>
    <div class="body with-tabbar">
      ${stateHtml({ img: 'sleep', title: 'ยังไม่มีผลสอบ', text: 'ทำข้อสอบชุดแรกแล้วผลจะขึ้นที่นี่ครับ' })}
    </div>
    ${tabbar()}`;
}

function renderProfile() {
  const me = state.me;
  app.innerHTML = `
    ${IS_DEMO ? demoBanner() : ''}
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
  const el = e.target.closest('[data-tab],[data-act]');
  if (!el) return;
  if (el.dataset.tab) return showTab(el.dataset.tab);
  if (el.dataset.act === 'reload') location.reload();
});

start();
