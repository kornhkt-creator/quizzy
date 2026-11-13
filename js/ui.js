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
  toastTimer = setTimeout(() => el.remove(), 3200);
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

export function demoBanner() {
  return '<div class="demo-banner">โหมดทดลอง: ข้อมูลจำลองเก็บในเครื่องนี้เท่านั้น ยังไม่เชื่อมต่อ LINE</div>';
}
