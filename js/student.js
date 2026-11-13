// =========================================================
// หน้านักเรียน (index.html)
// Phase 0: หน้าต้อนรับที่ทักทายด้วยชื่อจาก LINE
// =========================================================
import { IS_DEMO } from './config.js';
import { initLine } from './line.js';
import { esc, mascot, loadingHtml, stateHtml, demoBanner } from './ui.js';
import { leaf } from './icons.js';

const app = document.getElementById('app');

async function start() {
  app.innerHTML = loadingHtml('น้องแต่วกำลังมา');
  try {
    const profile = await initLine();
    renderHello(profile);
  } catch (err) {
    console.error(err);
    app.innerHTML = stateHtml({
      img: 'surprised',
      title: 'เชื่อมต่อไม่สำเร็จ',
      text: err.message || 'ลองใหม่อีกครั้งนะครับ',
      button: '<button class="btn btn-secondary btn-sm" onclick="location.reload()">ลองอีกครั้ง</button>',
    });
  }
}

function renderHello(profile) {
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
    <div class="welcome-card">
      <div class="list-row">
        <div class="avatar">${profile.pictureUrl ? `<img src="${esc(profile.pictureUrl)}" alt="">` : esc(profile.displayName.charAt(0))}</div>
        <div class="t">
          <small>เข้าสู่ระบบด้วย LINE แล้ว</small>
          <b style="font-size:18px">สวัสดีครับ ${esc(profile.displayName)}</b>
        </div>
      </div>
      <div class="card muted" style="font-size:14.5px">
        Quizzy พร้อมใช้งานแล้ว ระบบลงทะเบียนและทำข้อสอบจะเปิดในขั้นตอนถัดไปครับ
      </div>
    </div>`;
}

start();
