/* ─────────────────────────────────────────
   칸칸 — 캠핑단열재 수량 계산기 (insulation-board-camp.js)
   ───────────────────────────────────────── */

'use strict';

let canvas;
let ctx;

let currentMode = 'square';
let currentDiagramData = null;

// ── 칸칸 디자인 토큰 ──
const C_TEXT   = '#1a1a1a';
const C_MUTED  = '#888';
const C_BG     = '#f7f7f5';
const mkMain = (sz, bold) => `${bold ? '700' : '500'} ${sz}px 'Pretendard Variable', Pretendard, sans-serif`;
const mkMono = (sz) => `500 ${sz}px 'JetBrains Mono', monospace`;

// ── 휠 줌 / 드래그 팬 ──
let zoom = 1, panX = 0, panY = 0;
let isPanning = false, lastMX = 0, lastMY = 0;
function resetView() { zoom = 1; panX = 0; panY = 0; }


// ── 단위 → m 변환 ──
function toM(value, unit) {
  const v = parseFloat(value) || 0;
  return unit === 'cm' ? v / 100 : v;
}

// ── 유틸 ──
function r(n, d = 1) {
  return Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
}
function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// ── 최적 시공 방향 ──
function getOptimalLayout(w, h) {
  const lenV = Math.ceil(w) * h;
  const lenH = Math.ceil(h) * w;
  return lenV <= lenH
    ? { dir: 'vertical',   len: lenV, label: '세로' }
    : { dir: 'horizontal', len: lenH, label: '가로' };
}

// ── 폴리곤 정규화 좌표 ──
function getPolyPoints(type) {
  const sides = type === 'hex' ? 6 : type === 'oct' ? 8 : 4;
  const startAngle = type === 'oct' ? Math.PI / 8 : type === 'square' ? Math.PI / 4 : 0;
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = startAngle + (i * 2 * Math.PI / sides);
    pts.push({ x: Math.cos(a), y: Math.sin(a) });
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  pts.forEach(p => {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  });
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const scX = maxX - minX, scY = maxY - minY;
  return pts.map(p => ({ x: (p.x - cx) / scX, y: (p.y - cy) / scY }));
}

// ── 해치 패턴 ──
function makeHatch(color) {
  const p = document.createElement('canvas');
  p.width = 10; p.height = 10;
  const c = p.getContext('2d');
  c.strokeStyle = color; c.lineWidth = 1;
  c.beginPath(); c.moveTo(0, 10); c.lineTo(10, 0); c.stroke();
  return ctx.createPattern(p, 'repeat');
}

// ── 치수선 ──
function drawDim(x1, y1, x2, y2, label, vertical = false) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = C_MUTED; ctx.lineWidth = 1.5; ctx.stroke();

  const hl = 8, angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  [[x1, y1], [x2, y2]].forEach(([px, py], idx) => {
    const sign = idx === 0 ? 1 : -1;
    ctx.moveTo(px, py);
    ctx.lineTo(px + hl * Math.cos(angle + Math.PI / 6) * sign, py + hl * Math.sin(angle + Math.PI / 6) * sign);
    ctx.moveTo(px, py);
    ctx.lineTo(px + hl * Math.cos(angle - Math.PI / 6) * sign, py + hl * Math.sin(angle - Math.PI / 6) * sign);
  });
  ctx.stroke();

  ctx.font = mkMono(13);
  ctx.fillStyle = C_TEXT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  if (vertical) {
    ctx.translate(mx, my); ctx.rotate(-Math.PI / 2);
    ctx.fillText(label, 0, -10);
  } else {
    ctx.fillText(label, mx, my - 10);
  }
  ctx.restore();
}

// ── 도면 그리기 ──
function drawDiagram(data) {
  clearCanvas();
  const cw = canvas.width, ch = canvas.height;
  const pad = 110;

  const { w, h, type, dir, method } = data;
  const scale = Math.min((cw - pad * 2) / w, (ch - pad * 2) / h);
  const wPx = w * scale, hPx = h * scale;

  ctx.save();
  ctx.translate(cw / 2, ch / 2);
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  const isEfficient = method === 'efficient' || method === 'circle';
  const rollPx = scale;

  const shapePath = () => {
    ctx.beginPath();
    if (type === 'circle') {
      ctx.arc(0, 0, wPx / 2, 0, Math.PI * 2);
    } else if (type === 'square') {
      ctx.rect(-wPx / 2, -hPx / 2, wPx, hPx);
    } else {
      const pts = getPolyPoints(type);
      pts.forEach((p, i) => {
        const px = p.x * wPx, py = p.y * hPx;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.closePath();
    }
  };

  if (!isEfficient && type !== 'square') {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-wPx / 2, -hPx / 2, wPx, hPx);
    ctx.fillStyle = makeHatch('rgba(26,26,26,0.12)');
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  shapePath();
  ctx.clip();
  ctx.fillStyle = C_BG;
  ctx.fillRect(-wPx / 2, -hPx / 2, wPx, hPx);

  let numStrips;
  if (isEfficient) {
    const ratio = type === 'hex' ? 0.75 : type === 'oct' ? 0.82 : type === 'circle' ? 0.785 : 1.0;
    const area = (type === 'circle' ? w * w : w * h) * ratio;
    const longSide = type === 'circle' ? w : (dir === 'horizontal' ? w : h);
    numStrips = Math.max(1, Math.round(area / longSide));
  } else {
    numStrips = Math.ceil(dir === 'horizontal' ? h : w);
  }

  const startPos = -(numStrips * rollPx) / 2;
  ctx.fillStyle = 'rgba(26,26,26,0.05)';
  ctx.strokeStyle = 'rgba(26,26,26,0.18)';
  ctx.lineWidth = 1;

  for (let i = 0; i < numStrips; i++) {
    let rx, ry, rw, rh;
    if (dir === 'horizontal') {
      rx = -wPx / 2; ry = startPos + i * rollPx; rw = wPx; rh = rollPx;
    } else {
      rx = startPos + i * rollPx; ry = -hPx / 2; rw = rollPx; rh = hPx;
    }
    ctx.beginPath(); ctx.rect(rx, ry, rw, rh);
    ctx.fill(); ctx.stroke();

    if (scale > 24) {
      ctx.save();
      ctx.fillStyle = C_MUTED;
      ctx.font = mkMono(11);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('1M', rx + rw / 2, ry + rh / 2);
      ctx.restore();
    }
  }
  ctx.restore();

  shapePath();
  ctx.strokeStyle = C_TEXT;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  const dimLabel = type === 'circle' ? `지름 ${w}m` : `가로 ${w}m`;
  drawDim(-wPx / 2, -hPx / 2 - 55, wPx / 2, -hPx / 2 - 55, dimLabel);
  if (type !== 'circle') {
    drawDim(-wPx / 2 - 55, -hPx / 2, -wPx / 2 - 55, hPx / 2, `세로 ${h}m`, true);
  }

  ctx.fillStyle = C_TEXT;
  ctx.font = mkMain(13, true);
  ctx.textAlign = 'center';
  ctx.fillText(
    dir === 'horizontal' ? '← 가로 방향 시공 →' : '↕ 세로 방향 시공',
    0, hPx / 2 + 42
  );

  ctx.restore();

  // 조작 힌트 (화면 좌표 고정)
  ctx.save();
  ctx.font = mkMain(11, false);
  ctx.fillStyle = 'rgba(136,136,136,0.75)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('휠 확대·축소  ·  드래그 이동  ·  더블클릭 초기화', cw / 2, ch - 8);
  ctx.restore();
}

// ── 계산하기 ──
function calculate() {
  const numEl  = document.getElementById('resMainNum');
  const unitEl = document.getElementById('resMainUnit');
  const subEl  = document.getElementById('resMainSub');
  const descEl = document.getElementById('resMainDesc');
  const noteEl = document.getElementById('resultNote');
  const panel  = document.getElementById('resultPanel');

  const method = document.getElementById('methodValue').value;
  let w = 0, h = 0, d = 0, baseLen = 0, note = '', data = {};

  if (currentMode === 'square') {
    w = toM(document.getElementById('sq_width').value,  document.getElementById('sq_width_unit').value);
    h = toM(document.getElementById('sq_height').value, document.getElementById('sq_height_unit').value);
    if (!w || !h) { alert('가로, 세로 길이를 입력해주세요.'); return; }
    const opt = getOptimalLayout(w, h);
    baseLen = opt.len;
    data = { type: 'square', w, h, dir: opt.dir, method: 'square' };
    const cutLen = opt.dir === 'vertical' ? h : w;
    const strips = Math.ceil(opt.dir === 'vertical' ? w : h);
    note = `추천 방향: <strong>${opt.label} 시공</strong> — 폭 1m 단열재를 <strong>${r(cutLen)}m</strong> 길이로 잘라 <strong>${strips}줄</strong> 나란히 시공`;

  } else if (currentMode === 'hex' || currentMode === 'oct') {
    const prefix = currentMode === 'hex' ? 'hex' : 'oct';
    w = toM(document.getElementById(`${prefix}_width`).value,  document.getElementById(`${prefix}_width_unit`).value);
    h = toM(document.getElementById(`${prefix}_height`).value, document.getElementById(`${prefix}_height_unit`).value);
    if (!w || !h) { alert('가로, 세로 길이를 입력해주세요.'); return; }
    const opt = getOptimalLayout(w, h);
    if (method === 'square') {
      baseLen = opt.len;
      note = `<strong>편하게 시공</strong> — 사각형 기준으로 계산. 추천 방향: <strong>${opt.label} 시공</strong>. 텐트 외곽 자투리는 잘라내세요.`;
    } else {
      const ratio = currentMode === 'hex' ? 0.75 : 0.82;
      baseLen = w * h * ratio;
      note = `<strong>알뜰 시공</strong> — 실제 바닥 면적(약 ${r(w * h * ratio)}㎡) 기준. 남은 자투리 조각으로 빈 곳을 메워야 합니다.`;
    }
    data = { type: currentMode, w, h, dir: opt.dir, method };

  } else if (currentMode === 'circle') {
    d = toM(document.getElementById('cir_diameter').value, document.getElementById('cir_diameter_unit').value);
    if (!d) { alert('텐트 지름을 입력해주세요.'); return; }
    if (method === 'square') {
      baseLen = Math.ceil(d) * d;
      note = `<strong>편하게 시공</strong> — 지름 ${d}m 기준 사각형으로 계산. 둥근 라인에 맞춰 가장자리를 잘라내세요.`;
    } else {
      baseLen = Math.pow(d / 2, 2) * Math.PI;
      note = `<strong>알뜰 시공</strong> — 원형 실면적(${r(baseLen)}㎡) 기준. 조각을 이어붙여 빈 곳을 채워야 합니다.`;
    }
    data = { type: 'circle', w: d, h: d, d, dir: 'vertical', method };
  }

  const finalM = Math.ceil(baseLen);
  numEl.textContent  = finalM;
  unitEl.textContent = 'M';
  subEl.textContent  = '필요한 열반사단열재 길이';
  descEl.textContent = `폭 1M 기준 ${finalM}M`;
  noteEl.innerHTML   = `※ ${note}<br/>※ 최종 소요량 <strong>${finalM}M</strong>은 발주 권장 수량입니다. 여유분 5~10% 추가를 권장합니다.`;

  currentDiagramData = data;
  resetView();
  drawDiagram(data);
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  addHistory(getModeLabel(currentMode), `${finalM}M`, note.replace(/<[^>]+>/g, ''));
}

function getModeLabel(mode) {
  return { square: '사각 텐트', hex: '육각 텐트', oct: '팔각 텐트', circle: '원형 텐트' }[mode] || '';
}

// ── 히스토리 ──
function addHistory(name, result, detail) {
  if (KankanHistory.isRestoring) return;
  KankanHistory.save({
    id: 'insulation-board-camp',
    calcName: '캠핑단열재 수량 계산기',
    url: 'insulation-board-camp.html',
    resultLabel: `${name} · ${result}`,
    params: {
      shapeType:   document.getElementById('shapeType').value,
      methodValue: document.getElementById('methodValue').value,
      sq_width:    document.getElementById('sq_width').value,
      sq_width_unit:  document.getElementById('sq_width_unit').value,
      sq_height:   document.getElementById('sq_height').value,
      sq_height_unit: document.getElementById('sq_height_unit').value,
      hex_width:   document.getElementById('hex_width').value,
      hex_width_unit:  document.getElementById('hex_width_unit').value,
      hex_height:  document.getElementById('hex_height').value,
      hex_height_unit: document.getElementById('hex_height_unit').value,
      oct_width:   document.getElementById('oct_width').value,
      oct_width_unit:  document.getElementById('oct_width_unit').value,
      oct_height:  document.getElementById('oct_height').value,
      oct_height_unit: document.getElementById('oct_height_unit').value,
      cir_diameter: document.getElementById('cir_diameter').value,
      cir_diameter_unit: document.getElementById('cir_diameter_unit').value,
    },
    detail: [
      { key: '텐트 형태', val: name },
      { key: '소요량',    val: result },
      { key: '비고',      val: detail },
    ]
  });
  KankanHistory.renderPanel();
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
  link.download = `칸칸_캠핑단열재_${new Date().toISOString().slice(0, 10)}.png`;
  link.href = tmp.toDataURL('image/png');
  link.click();
});

// ── 시공 방식 드롭다운 활성/비활성 ──
function updateMethodDropdown(mode) {
  const btn  = document.getElementById('methodBtn');
  const wrap = document.getElementById('methodWrap');
  const text = document.getElementById('methodBtnText');
  const val  = document.getElementById('methodValue');

  if (mode === 'square') {
    // 사각: 비활성화, 고정 텍스트
    btn.disabled = true;
    btn.style.opacity = '0.45';
    btn.style.cursor  = 'not-allowed';
    text.textContent  = '편하게 시공 (사각 기준)';
    val.value = 'square';
    wrap.classList.remove('open');
    document.querySelectorAll('#methodList .custom-select-item').forEach(i => {
      i.classList.toggle('active', i.dataset.value === 'square');
    });
  } else {
    // 그 외: 활성화
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.cursor  = '';
    // 원형일 때 알뜰 시공 텍스트 조정
    const efficientLabel = mode === 'circle' ? '알뜰 시공 (이어붙이기)' : '알뜰 시공 (자투리 활용)';
    document.querySelector('#methodList [data-value="efficient"]').textContent = efficientLabel;
    // 현재 선택된 값이 efficient면 텍스트 맞게 갱신
    if (val.value === 'efficient') text.textContent = efficientLabel;
  }
}

// ── 텐트 형태 변경 ──
function onShapeSelect(value) {
  currentMode = value;

  ['square', 'hex', 'oct', 'circle'].forEach(m => {
    document.getElementById(`mode_${m}`).style.display = m === value ? '' : 'none';
  });

  updateMethodDropdown(value);

  const titles = {
    square: '캠핑단열재 수량 계산기 — 사각',
    hex:    '캠핑단열재 수량 계산기 — 육각',
    oct:    '캠핑단열재 수량 계산기 — 팔각',
    circle: '캠핑단열재 수량 계산기 — 원형',
  };
  document.getElementById('pageTitle').textContent = titles[value];
  document.getElementById('bcCurrent').textContent = titles[value];

  currentDiagramData = null;
  resetView();
  document.getElementById('resultPanel').style.display = 'none';
  clearCanvas();
}

// ── 계산 / 초기화 ──
function resetAll() {
  document.getElementById('sq_width').value     = '3.0';
  document.getElementById('sq_height').value    = '4.0';
  document.getElementById('hex_width').value    = '3.3';
  document.getElementById('hex_height').value   = '2.9';
  document.getElementById('oct_width').value    = '3.6';
  document.getElementById('oct_height').value   = '3.3';
  document.getElementById('cir_diameter').value = '5.0';

  ['sq_width_unit','sq_height_unit','hex_width_unit','hex_height_unit',
   'oct_width_unit','oct_height_unit','cir_diameter_unit'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = 'm';
  });

  document.getElementById('methodBtnText').textContent = '편하게 시공 (사각 기준)';
  document.getElementById('methodValue').value = 'square';
  document.querySelectorAll('#methodList .custom-select-item').forEach(i => {
    i.classList.toggle('active', i.dataset.value === 'square');
  });

  currentDiagramData = null;
  resetView();
  document.getElementById('resultPanel').style.display = 'none';
  clearCanvas();
}

// ── DOMContentLoaded ──
document.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('campCanvas');
  ctx    = canvas.getContext('2d');
  canvas.addEventListener('wheel', e => {
    if (!currentDiagramData) return;
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
    drawDiagram(currentDiagramData);
  }, { passive: false });
  canvas.addEventListener('mousedown', e => {
    if (!currentDiagramData) return;
    isPanning = true; lastMX = e.clientX; lastMY = e.clientY;
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('mousemove', e => {
    if (!currentDiagramData) { canvas.style.cursor = 'default'; return; }
    if (!isPanning) { canvas.style.cursor = 'grab'; return; }
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    panX += (e.clientX - lastMX) * scaleX;
    panY += (e.clientY - lastMY) * scaleY;
    lastMX = e.clientX; lastMY = e.clientY;
    drawDiagram(currentDiagramData);
  });
  canvas.addEventListener('mouseup',    () => { isPanning = false; if (currentDiagramData) canvas.style.cursor = 'grab'; });
  canvas.addEventListener('mouseleave', () => { isPanning = false; canvas.style.cursor = 'default'; });
  canvas.addEventListener('dblclick',   () => { if (!currentDiagramData) return; resetView(); drawDiagram(currentDiagramData); });
  initCustomSelect('shapeWrap',  'shapeBtn',  'shapeList',  'shapeType',  onShapeSelect);
  initCustomSelect('methodWrap', 'methodBtn', 'methodList', 'methodValue', () => {});
  updateMethodDropdown('square');

  document.getElementById('btnCalc').addEventListener('click', calculate);
  document.getElementById('btnReset').addEventListener('click', resetAll);
  document.getElementById('calcForm').addEventListener('keydown', e => {
    if (e.key === 'Enter') calculate();
  });

  KankanHistory.restoreForm();
  KankanHistory.renderPanel();
  KankanHistory.renderClearBtn();
});