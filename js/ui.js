// =========================================================
// ส่วนแสดงผลที่ใช้ร่วมกันทั้งหน้านักเรียนและหน้าครู
// =========================================================

// ป้องกันข้อความจากผู้ใช้ถูกตีความเป็น HTML (กันโค้ดแปลกปลอม)
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export const mascot = (name) => `assets/mascot/${name}.png`;

// ---------- วันที่ / เวลา (เวลาประเทศไทย ปี พ.ศ.) ----------
const TZ = 'Asia/Bangkok';
export function fmtDate(iso, withTime = true) {
  if (!iso) return '-';
  const opts = { timeZone: TZ, day: 'numeric', month: 'short' };
  if (withTime) Object.assign(opts, { hour: '2-digit', minute: '2-digit' });
  return new Date(iso).toLocaleString('th-TH', opts);
}
export function fmtDateYear(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('th-TH', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
}
export function fmtDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ---------- หน้าสถานะ ----------
export function loadingHtml(text = 'กำลังโหลด') {
  return `<div class="state"><img class="bounce" src="${mascot('front')}" alt=""><b>${esc(text)}</b><div class="dots"><i></i><i></i><i></i></div></div>`;
}
export function stateHtml({ img = 'sleep', title, text = '', button = '' }) {
  return `<div class="state"><img src="${mascot(img)}" alt=""><b>${esc(title)}</b>${text ? `<p>${esc(text)}</p>` : ''}${button}</div>`;
}

// ---------- ข้อความแจ้งเตือนสั้น ๆ ----------
let toastTimer;
export function toast(message, type = '') {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), Math.max(3200, message.length * 60)); // ข้อความยาวอยู่นานขึ้น
}

// ---------- กล่องยืนยัน (คืนค่า true/false) ----------
export function confirmBox({ img = 'curious', title, text = '', ok = 'ตกลง', cancel = 'ยกเลิก', danger = false, center = false, extra = '' }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = `overlay${center ? ' center' : ''}`;
    wrap.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true">
        ${img ? `<img class="mascot" src="${mascot(img)}" alt="">` : ''}
        <h3>${esc(title)}</h3>
        ${text ? `<p class="muted" style="font-size:14px;margin-top:4px">${esc(text)}</p>` : ''}
        ${extra}
        <div class="row">
          ${cancel ? `<button class="btn btn-secondary" data-v="0">${esc(cancel)}</button>` : ''}
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-v="1">${esc(ok)}</button>
        </div>
      </div>`;
    const close = (v) => { wrap.remove(); resolve(v); };
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) return close(false);
      const b = e.target.closest('[data-v]');
      if (b) close(b.dataset.v === '1');
    });
    document.body.appendChild(wrap);
  });
}

export function avatarHtml(profile, cls = '') {
  // ตัดคำนำหน้าชื่อออกก่อนเอาตัวอักษรแรก (ด.ช.ภูมิ → ภ)
  const name = (profile?.full_name || profile?.display_name || '?')
    .trim().replace(/^(ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง|นางสาว|นาย|นาง|ครู|น\.ส\.)\s*/, '');
  const pic = profile?.picture_url;
  return `<div class="avatar ${cls}">${pic ? `<img src="${esc(pic)}" alt="">` : esc(name.charAt(0) || '?')}</div>`;
}

// ---------- ป๊อปอัปรับแต้ม/คะแนน (ดาวเด้งขึ้น) ----------
// stars = จำนวนดาวที่ได้, of = จำนวนดาวทั้งหมด (of = 1 จะเป็นเหรียญดาวใหญ่เหรียญเดียว)
export const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.6 2.9 6 6.6 1-4.8 4.6 1.1 6.6L12 17.7l-5.8 3.1 1.1-6.6L2.5 9.6l6.6-1z"/></svg>';
// total = แต้มสะสมหลังรับครั้งนี้ (ไม่ส่งมา = ไม่แสดง)
export function rewardBox({ img = 'happy', title, amount = 0, unit = 'แต้ม', from = '', stars = 1, of = 1, ok = 'รับแต้ม', total = null }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'overlay center reward';
    const burst = stars > 0
      ? Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 + 0.3;
        const d = 70 + (i % 3) * 22;
        return `<i style="--x:${Math.round(Math.cos(a) * d)}px;--y:${Math.round(Math.sin(a) * d)}px;--d:${(i % 4) * 0.05}s">${STAR}</i>`;
      }).join('')
      : '';
    wrap.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true">
        <img class="mascot" src="${mascot(img)}" alt="">
        <div class="reward-stars${of === 1 ? ' one' : ''}">
          <div class="reward-burst">${burst}</div>
          ${Array.from({ length: of }, (_, i) => `<span class="reward-star${i < stars ? ' on' : ''}" style="--i:${i}">${STAR}</span>`).join('')}
        </div>
        <h3>${esc(title)}</h3>
        <div class="reward-amount">+<span>0</span> <small>${esc(unit)}</small></div>
        ${from ? `<p class="muted" style="font-size:14px">${esc(from)}</p>` : ''}
        ${total != null ? `<div class="points-chip" style="margin-top:10px">${STAR}แต้มสะสม ${Number(total).toLocaleString('th-TH')}</div>` : ''}
        <div class="row"><button class="btn btn-primary">${esc(ok)}</button></div>
      </div>`;
    // ตัวเลขวิ่งขึ้น
    const num = wrap.querySelector('.reward-amount span');
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t0 = performance.now();
    const step = (t) => {
      const k = still ? 1 : Math.min(1, Math.max(0, (t - t0 - 350) / 700));
      num.textContent = Math.round(amount * (1 - (1 - k) ** 3));
      if (k < 1 && wrap.isConnected) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    const close = () => { wrap.remove(); resolve(); };
    wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('button')) close(); });
    document.body.appendChild(wrap);
    wrap.querySelector('button').focus();
  });
}

// ---------- สถานะการเช็คชื่อ ----------
export const ATT_STATUS = {
  present: ['green', 'มา'],
  late: ['orange', 'สาย'],
  absent: ['red', 'ขาด'],
  leave: ['gray', 'ลา'],
  pending: ['gray', 'ยังไม่เช็ค'],
};
export const attPill = (status) => `<span class="pill ${ATT_STATUS[status][0]}">${ATT_STATUS[status][1]}</span>`;
export const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('th-TH', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) : '-');

export function demoBanner() {
  return '<div class="demo-banner">โหมดทดลอง: ข้อมูลจำลองเก็บในเครื่องนี้เท่านั้น ยังไม่เชื่อมต่อ LINE</div>';
}
