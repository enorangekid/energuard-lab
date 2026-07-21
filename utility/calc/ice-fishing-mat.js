/* ─────────────────────────────────────────
   칸칸 — 빙어낚시 매트 소요량 계산기 (ice-fishing-mat.js)
   ───────────────────────────────────────── */

'use strict';

// ── 규격별 고정 데이터 ──
const PRESETS = {
  '1.8': {
    w: 1.8, h: 1.8,
    matM: 4, isoPink: 6, tape: 1,
    label: '180 × 180cm',
    matLayout: [
      {x:0,   y:0,  w:60, h:90},
      {x:60,  y:0,  w:60, h:90},
      {x:120, y:0,  w:60, h:90},
      {x:0,   y:90, w:60, h:90},
      {x:60,  y:90, w:60, h:90},
      {x:120, y:90, w:60, h:90},
    ],
    holes: [
      {x:30,  y:30,  lx:30, ly:30},
      {x:90,  y:30,  lx:30, ly:30},
      {x:150, y:30,  lx:30, ly:30},
    ],
  },
  '2.0': {
    w: 2.0, h: 2.0,
    matM: 5, isoPink: 8, tape: 2,
    label: '200 × 200cm',
    matLayout: [
      {x:0,   y:0,   w:90, h:20},
      {x:90,  y:0,   w:90, h:20},
      {x:180, y:0,   w:20, h:20},
      {x:0,   y:20,  w:90, h:60},
      {x:90,  y:20,  w:90, h:60},
      {x:180, y:20,  w:20, h:90},
      {x:0,   y:80,  w:90, h:60},
      {x:90,  y:80,  w:90, h:60},
      {x:180, y:110, w:20, h:90},
      {x:0,   y:140, w:90, h:60},
      {x:90,  y:140, w:90, h:60},
    ],
    holes: [
      {x:45,  y:10, lx:45, ly:10},
      {x:135, y:10, lx:45, ly:10},
    ],
  },
  '2.2': {
    w: 2.2, h: 2.2,
    matM: 6, isoPink: 11, tape: 2,
    label: '220 × 220cm',
    matLayout: [
      {x:0,     y:0,   w:73.3, h:40},
      {x:73.3,  y:0,   w:73.3, h:40},
      {x:146.6, y:0,   w:73.4, h:40},
      {x:0,     y:40,  w:55,   h:90},
      {x:55,    y:40,  w:55,   h:90},
      {x:110,   y:40,  w:55,   h:90},
      {x:165,   y:40,  w:55,   h:90},
      {x:0,     y:130, w:55,   h:90},
      {x:55,    y:130, w:55,   h:90},
      {x:110,   y:130, w:55,   h:90},
      {x:165,   y:130, w:55,   h:90},
    ],
    holes: [
      {x:36.65,  y:20, lx:36.65, ly:20},
      {x:109.95, y:20, lx:36.65, ly:20},
      {x:183.25, y:20, lx:36.65, ly:20},
    ],
  },
  '2.3': {
    w: 2.3, h: 2.3,
    matM: 7, isoPink: 11, tape: 2,
    label: '230 × 230cm',
    matLayout: [
      {x:0,   y:0,   w:90, h:50},
      {x:90,  y:0,   w:50, h:50},
      {x:140, y:0,   w:90, h:50},
      {x:0,   y:50,  w:60, h:90},
      {x:60,  y:50,  w:60, h:90},
      {x:120, y:50,  w:60, h:90},
      {x:180, y:50,  w:50, h:90},
      {x:0,   y:140, w:60, h:90},
      {x:60,  y:140, w:60, h:90},
      {x:120, y:140, w:60, h:90},
      {x:180, y:140, w:50, h:90},
    ],
    holes: [
      {x:45,  y:25, lx:45, ly:25},
      {x:115, y:25, lx:25, ly:25},
      {x:185, y:25, lx:45, ly:25},
    ],
  },
  '2.4': {
    w: 2.4, h: 2.4,
    matM: 7, isoPink: 11, tape: 2,
    label: '240 × 240cm',
    matLayout: [
      {x:0,   y:0,   w:90, h:60},
      {x:90,  y:0,   w:60, h:60},
      {x:150, y:0,   w:90, h:60},
      {x:0,   y:60,  w:60, h:90},
      {x:60,  y:60,  w:60, h:90},
      {x:120, y:60,  w:60, h:90},
      {x:180, y:60,  w:60, h:90},
      {x:0,   y:150, w:60, h:90},
      {x:60,  y:150, w:60, h:90},
      {x:120, y:150, w:60, h:90},
      {x:180, y:150, w:60, h:90},
    ],
    holes: [
      {x:45,  y:30, lx:45, ly:30},
      {x:120, y:30, lx:30, ly:30},
      {x:195, y:30, lx:45, ly:30},
    ],
  },
};

// ── 상태 변수 ──
let currentPreset = null;
let zoom = 1, panX = 0, panY = 0;
let isPanning = false, lastMX = 0, lastMY = 0;

function resetView() { zoom = 1; panX = 0; panY = 0; }

// ── 히스토리 ──
function addHistory(label, matM, isoPink, tape) {
  if (KankanHistory.isRestoring) return;
  KankanHistory.save({
    id: 'ice-fishing-mat',
    calcName: '빙어낚시 매트 소요량 계산기',
    url: 'ice-fishing-mat.html',
    resultLabel: `${label} · 열반사 ${matM}M`,
    params: {
      sizeValue: document.getElementById('sizeValue').value,
    },
    detail: [
      { key: '텐트 규격',    val: label },
      { key: '열반사단열재', val: `${matM}M` },
      { key: '아이소핑크',   val: `${isoPink}장` },
      { key: '면테이프',     val: `${tape}개` },
    ]
  });
  KankanHistory.renderPanel();
}

function initCustomSelect(wrapId, btnId, listId, hiddenId, onSelect) {
  const wrap = document.getElementById(wrapId);
  const btn = document.getElementById(btnId);
  const list = document.getElementById(listId);
  const hidden = document.getElementById(hiddenId);
  if (!wrap || !btn || !list || !hidden) return;

  btn.addEventListener('click', e => {
    if (btn.disabled) return;
    e.stopPropagation();
    wrap.classList.toggle('open');
    document.querySelectorAll('.custom-select-wrap').forEach(item => {
      if (item !== wrap) item.classList.remove('open');
    });
  });

  list.querySelectorAll('.custom-select-item:not(.soon)').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      list.querySelectorAll('.custom-select-item').forEach(option => option.classList.remove('active'));
      item.classList.add('active');
      const label = btn.querySelector('span');
      if (label) label.textContent = item.textContent.trim();
      hidden.value = item.dataset.value;
      wrap.classList.remove('open');
      if (onSelect) onSelect(item.dataset.value);
    });
  });

  document.addEventListener('click', () => wrap.classList.remove('open'));
}

// ── DOMContentLoaded ──
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('iceCanvas');
  const ctx    = canvas.getContext('2d');

  // ── 도면 그리기 ──
  function drawDiagram(preset) {
    const cw = canvas.width, ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();

    const { w, h, matLayout, holes } = preset;
    const pad = 120;
    const scale = Math.min((cw - pad * 2) / w, (ch - pad * 2) / h);
    const wPx = w * scale, hPx = h * scale;

    // ── 칸칸 디자인 토큰 ──
    const C_TEXT   = '#1a1a1a';
    const C_MUTED  = '#888';
    const C_BG     = '#f7f7f5';
    const C_ACCENT = '#ff4040';
    const mkMain = (sz, bold) => `${bold ? '700' : '500'} ${sz}px 'Pretendard Variable', Pretendard, sans-serif`;
    const mkMono = (sz) => `500 ${sz}px 'JetBrains Mono', monospace`;

    ctx.translate(cw / 2, ch / 2);
    ctx.translate(panX, panY);
    ctx.scale(zoom, zoom);

    // 텐트 외곽
    ctx.beginPath();
    ctx.rect(-wPx / 2, -hPx / 2, wPx, hPx);
    ctx.fillStyle = C_BG;
    ctx.fill();
    ctx.strokeStyle = C_TEXT;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 조각 배치
    ctx.save();
    ctx.clip();
    matLayout.forEach((m, i) => {
      const x  = -wPx / 2 + m.x * scale / 100;
      const y  = -hPx / 2 + m.y * scale / 100;
      const mw = m.w * scale / 100;
      const mh = m.h * scale / 100;

      ctx.beginPath();
      ctx.rect(x, y, mw, mh);
      ctx.strokeStyle = 'rgba(26, 26, 26, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = C_TEXT;
      ctx.font = mkMain(Math.max(11, Math.round(mw * 0.28)), true);
      ctx.fillText(`${i + 1}`, x + mw / 2, y + mh / 2 - 8);
      ctx.fillStyle = C_MUTED;
      ctx.font = mkMono(Math.max(9, Math.round(mw * 0.2)));
      ctx.fillText(`${m.w}×${m.h}`, x + mw / 2, y + mh / 2 + 12);
    });
    ctx.restore();

    // 얼음 구멍
    const holeR = 0.075 * scale;
    holes.forEach(hole => {
      const hx = -wPx / 2 + hole.x * scale / 100;
      const hy = -hPx / 2 + hole.y * scale / 100;
      const lxPx = hole.lx * scale / 100;
      const lyPx = hole.ly * scale / 100;

      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = 'rgba(255, 64, 64, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hx, hy); ctx.lineTo(hx - lxPx, hy);
      ctx.moveTo(hx, hy); ctx.lineTo(hx, hy - lyPx);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.fillStyle = C_ACCENT;
      ctx.font = mkMono(11);
      ctx.textAlign = 'center';
      ctx.fillText(`${hole.lx}cm`, hx - lxPx / 2, hy - 6);
      ctx.save();
      ctx.translate(hx - 8, hy - lyPx / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(`${hole.ly}cm`, 0, 0);
      ctx.restore();

      // 구멍 원
      ctx.beginPath();
      ctx.arc(hx, hy, holeR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();
      ctx.strokeStyle = C_ACCENT;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = C_ACCENT;
      ctx.font = mkMain(10, true);
      ctx.textAlign = 'center';
      ctx.fillText('지름 15cm', hx, hy + holeR + 13);
      ctx.restore();
    });

    // 모서리 컷팅 (10cm)
    const cutPx = 0.10 * scale;
    const corners = [
      {x: -wPx/2, y: -hPx/2, dx:  1, dy:  1},
      {x:  wPx/2, y: -hPx/2, dx: -1, dy:  1},
      {x: -wPx/2, y:  hPx/2, dx:  1, dy: -1},
      {x:  wPx/2, y:  hPx/2, dx: -1, dy: -1},
    ];
    ctx.save();
    corners.forEach(cp => {
      ctx.fillStyle = C_ACCENT;
      ctx.beginPath();
      ctx.moveTo(cp.x, cp.y);
      ctx.lineTo(cp.x + cutPx * cp.dx, cp.y);
      ctx.lineTo(cp.x, cp.y + cutPx * cp.dy);
      ctx.closePath();
      ctx.fill();

      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = C_MUTED;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cp.x + cutPx * cp.dx, cp.y);
      ctx.lineTo(cp.x, cp.y);
      ctx.lineTo(cp.x, cp.y + cutPx * cp.dy);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.fillStyle = C_MUTED;
      ctx.font = mkMono(10);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('10cm', cp.x + cutPx * cp.dx / 2, cp.y - 13 * cp.dy);
      ctx.fillText('10cm', cp.x - 22 * cp.dx,        cp.y + cutPx * cp.dy / 2);
    });
    ctx.restore();

    // 치수선
    ctx.save();
    ctx.strokeStyle = C_MUTED;
    ctx.lineWidth = 1.5;
    ctx.fillStyle = C_TEXT;
    ctx.font = mkMono(13);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 가로 치수
    const dimYTop = -hPx / 2 - 48;
    ctx.beginPath();
    ctx.moveTo(-wPx / 2, dimYTop); ctx.lineTo(wPx / 2, dimYTop);
    ctx.stroke();
    [[- wPx / 2, dimYTop], [wPx / 2, dimYTop]].forEach(([px, py]) => {
      ctx.beginPath();
      ctx.moveTo(px, py - 6); ctx.lineTo(px, py + 6);
      ctx.stroke();
    });
    ctx.fillText(`가로 ${Math.round(w * 100)}cm`, 0, dimYTop - 12);

    // 세로 치수
    const dimXLeft = -wPx / 2 - 52;
    ctx.beginPath();
    ctx.moveTo(dimXLeft, -hPx / 2); ctx.lineTo(dimXLeft, hPx / 2);
    ctx.stroke();
    [[-hPx / 2], [hPx / 2]].forEach(([py]) => {
      ctx.beginPath();
      ctx.moveTo(dimXLeft - 6, py); ctx.lineTo(dimXLeft + 6, py);
      ctx.stroke();
    });
    ctx.save();
    ctx.translate(dimXLeft - 14, 0);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`세로 ${Math.round(h * 100)}cm`, 0, 0);
    ctx.restore();

    ctx.restore();
    ctx.restore();

    // 조작 힌트 (화면 좌표 고정, 줌/팬 영향 없음)
    ctx.save();
    ctx.font = "400 11px 'Pretendard Variable', Pretendard, sans-serif";
    ctx.fillStyle = 'rgba(136, 136, 136, 0.75)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('휠 확대·축소  ·  드래그 이동  ·  더블클릭 초기화', cw / 2, ch - 8);
    ctx.restore();
  }

  // ── 휠 줌 / 드래그 팬 ──
  canvas.addEventListener('wheel', e => {
    if (!currentPreset) return;
    e.preventDefault();
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX - canvas.width  / 2;
    const my = (e.clientY - rect.top)  * scaleY - canvas.height / 2;
    const wx = (mx - panX) / zoom;
    const wy = (my - panY) / zoom;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    zoom = Math.max(0.4, Math.min(zoom * factor, 8));
    panX = mx - wx * zoom;
    panY = my - wy * zoom;
    drawDiagram(currentPreset);
  }, { passive: false });

  canvas.addEventListener('mousedown', e => {
    if (!currentPreset) return;
    isPanning = true;
    lastMX = e.clientX; lastMY = e.clientY;
    canvas.style.cursor = 'grabbing';
  });

  canvas.addEventListener('mousemove', e => {
    if (!currentPreset) { canvas.style.cursor = 'default'; return; }
    if (!isPanning) { canvas.style.cursor = 'grab'; return; }
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    panX += (e.clientX - lastMX) * scaleX;
    panY += (e.clientY - lastMY) * scaleY;
    lastMX = e.clientX; lastMY = e.clientY;
    drawDiagram(currentPreset);
  });

  canvas.addEventListener('mouseup',    () => { isPanning = false; if (currentPreset) canvas.style.cursor = 'grab'; });
  canvas.addEventListener('mouseleave', () => { isPanning = false; canvas.style.cursor = 'default'; });
  canvas.addEventListener('dblclick',   () => { if (!currentPreset) return; resetView(); drawDiagram(currentPreset); });

  // ── 계산하기 ──
  function calculate() {
    const size = document.getElementById('sizeValue').value;
    if (!size) { alert('텐트 규격을 선택해주세요.'); return; }

    const preset = PRESETS[size];
    if (!preset) return;
    currentPreset = preset;
    resetView();

    // 결과 채우기
    document.getElementById('resMainNum').textContent  = preset.matM;
    document.getElementById('resMainSub').textContent  = `${preset.label} 기준 열반사단열재`;
    document.getElementById('resMainDesc').textContent = `폭 1M 기준 ${preset.matM}M`;
    document.getElementById('resIsoPink').textContent  = `${preset.isoPink}장`;
    document.getElementById('resTape').textContent     = `${preset.tape}개`;

    document.getElementById('resultNote').innerHTML =
      `※ 예시 도면입니다. 얼음 구멍 위치와 조각 배치는 현장에 맞게 조정하세요.<br>` +
      `※ 모서리 컷팅(파란 삼각형)은 텐트 뼈대 간섭 방지를 위한 권장 사항입니다.`;

    drawDiagram(preset);

    const panel = document.getElementById('resultPanel');
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    addHistory(preset.label, preset.matM, preset.isoPink, preset.tape);
  }

  // ── 초기화 ──
  function resetAll() {
    document.getElementById('sizeBtnText').textContent = '규격을 선택하세요';
    document.getElementById('sizeValue').value = '';
    document.querySelectorAll('#sizeList .custom-select-item').forEach(i => i.classList.remove('active'));

    currentPreset = null;
    resetView();
    document.getElementById('resultPanel').style.display = 'none';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // ── 도면 저장 ──
  document.getElementById('btnSaveImg').addEventListener('click', () => {
    const tmp = document.createElement('canvas');
    tmp.width = canvas.width; tmp.height = canvas.height;
    const tc = tmp.getContext('2d');
    tc.fillStyle = '#fff';
    tc.fillRect(0, 0, tmp.width, tmp.height);
    tc.drawImage(canvas, 0, 0);
    const link = document.createElement('a');
    link.download = `칸칸_빙어매트_${new Date().toISOString().slice(0, 10)}.png`;
    link.href = tmp.toDataURL('image/png');
    link.click();
  });

  initCustomSelect('shapeWrap', 'shapeBtn', 'shapeList', 'shapeType', () => {});
  initCustomSelect('sizeWrap',  'sizeBtn',  'sizeList',  'sizeValue', () => {});

  document.getElementById('btnCalc').addEventListener('click', calculate);
  document.getElementById('btnReset').addEventListener('click', resetAll);
  document.getElementById('calcForm').addEventListener('keydown', e => {
    if (e.key === 'Enter') calculate();
  });

  KankanHistory.restoreForm();
  KankanHistory.renderPanel();
  KankanHistory.renderClearBtn();
});
