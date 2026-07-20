/* ─────────────────────────────────────────
   칸칸 — history.js
   localStorage 히스토리 공통 유틸
   모든 페이지에서 calculators-data.js 다음에 로드
   ───────────────────────────────────────── */

'use strict';

const KankanHistory = {
  KEY: 'kankan_history',
  MAX: 50,

  // 저장
  save(entry) {
    const list = this.load();
    entry.date = new Date().toISOString();
    list.unshift(entry);
    if (list.length > this.MAX) list.splice(this.MAX);
    try {
      localStorage.setItem(this.KEY, JSON.stringify(list));
    } catch(e) {
      console.warn('KankanHistory: localStorage 저장 실패', e);
    }
  },

  // 전체 불러오기
  load() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY) || '[]');
    } catch(e) {
      return [];
    }
  },

  // 단건 삭제
  remove(index) {
    const list = this.load();
    list.splice(index, 1);
    localStorage.setItem(this.KEY, JSON.stringify(list));
  },

  // 전체 삭제
  clear() {
    localStorage.removeItem(this.KEY);
  },

  // 복원 중 여부 플래그 — addHistory() 안에서 체크해 중복 저장 방지
  isRestoring: false,

  // URL 파라미터로 폼 복원 + 자동 계산
  // 각 계산기 페이지 DOMContentLoaded 안에서 호출
  restoreForm() {
    const params = new URLSearchParams(location.search);
    if (!params.has('_restore')) return;
    params.forEach((val, key) => {
      if (key === '_restore') return;
      const el = document.getElementById(key);
      if (!el) return;
      el.value = val;
      // 커스텀 드롭다운 텍스트 복원
      const wrap = el.closest('.custom-select-wrap');
      if (wrap) {
        const item = wrap.querySelector(`.custom-select-item[data-value="${val}"]`);
        if (item) {
          wrap.querySelectorAll('.custom-select-item').forEach(i => i.classList.remove('active'));
          item.classList.add('active');
          const textEl = wrap.querySelector('.custom-select-btn span');
          if (textEl) textEl.textContent = item.textContent.trim();
        }
      }
    });
    // 복원 후 자동 계산 (히스토리 중복 저장 방지)
    const btnCalc = document.getElementById('btnCalc');
    if (btnCalc) {
      this.isRestoring = true;
      btnCalc.click();
      this.isRestoring = false;
    }
  },

  // 히스토리 패널 렌더링 (우측 패널이 있는 모든 페이지에서 사용)
  renderPanel() {
    const list = document.getElementById('calcHistoryList');
    if (!list) return;
    const entries = this.load();
    if (!entries.length) {
      list.innerHTML = '<div class="history-empty">아직 계산 내역이 없습니다.</div>';
      return;
    }

    list.innerHTML = entries.map((e, i) => {
      const date = new Date(e.date);
      const h = date.getHours();
      const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} `
        + `${h >= 12 ? 'PM' : 'AM'} `
        + `${String(h % 12 || 12).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
      const details = (e.detail || []).map(d => `
        <div class="detail-row">
          <span class="detail-key">${d.key}:</span>
          <span class="detail-val">${d.val}</span>
        </div>`).join('');
      return `
        <div class="history-item" data-index="${i}">
          <div class="history-date">${dateStr}</div>
          <div class="history-calc-name">${e.calcName}</div>
          <div class="history-result-label">${e.resultLabel}</div>
          <div class="history-detail">${details}</div>
        </div>`;
    }).join('');

    // 클릭 시 해당 계산기로 이동 + 폼 복원
    list.querySelectorAll('.history-item').forEach(el => {
      el.addEventListener('click', () => {
        const entry = entries[parseInt(el.dataset.index)];
        if (!entry || !entry.url) return;
        const params = new URLSearchParams({ _restore: '1', ...entry.params });
        // 현재 위치 기준 경로 결정
        const isRoot = location.pathname.endsWith('index.html')
          || location.pathname.endsWith('/')
          || location.pathname === '';
        // entry.url이 'calc/foo.html' 형태이면 루트에서 그대로, calc/ 하위에서는 'calc/' 제거
        // entry.url이 'foo.html' 형태이면 루트에서 'calc/' 붙이기, calc/ 하위에서는 그대로
        let targetUrl = entry.url;
        if (isRoot && !targetUrl.startsWith('calc/')) {
          targetUrl = 'calc/' + targetUrl;
        } else if (!isRoot && targetUrl.startsWith('calc/')) {
          targetUrl = targetUrl.replace(/^calc\//, '');
        }
        const fullUrl = `${targetUrl}?${params.toString()}`;
        if (window.KankanRouter) {
          window.KankanRouter.navigate(fullUrl);
        } else {
          window.location.href = fullUrl;
        }
      });
    });
  },

  // 전체 삭제 버튼 (한 번만 추가)
  renderClearBtn() {
    const panel = document.getElementById('calcHistoryPanel');
    if (!panel || panel.querySelector('.history-clear-btn')) return;
    const header = panel.querySelector('.history-header');
    if (!header) return;
    const btn = document.createElement('button');
    btn.className = 'history-clear-btn';
    btn.textContent = '전체 삭제';
    btn.addEventListener('click', () => {
      if (!confirm('계산 내역을 모두 삭제할까요?')) return;
      this.clear();
      this.renderPanel();
    });
    header.appendChild(btn);
  }
};
