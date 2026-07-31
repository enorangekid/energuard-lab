/* ================================================================
   admin/work-notes.js — 업무노트 (Admin_backup js/notes.js 이식)
   의존성: admin-common.js(supabaseClient), common.js(showToast, AI_CHAT_URL)
   테이블: work_notes (authenticated 전용 RLS)
   ================================================================ */

let currentNoteTab = 'general';
let currentMediaChannel = 'blog'; // 미디어 채널 탭에서 마지막으로 보던 채널
let currentRecordView = 'organize'; // 업무기록 탭 안의 종류: 'timeline'(미이식) | 'organize'(=업무 정리, 기존 일반노트)
let currentNoteId = null;
let currentNoteMonth = '';
let noteOriginalContent = '';
let noteAutoSaveTimer = null;

/* ── 페이지 타이틀 탭(업무기록/미디어 채널) + 드롭박스(업무기록 종류·미디어 채널) 클릭 처리
   (블로그진단의 store-chips 드롭박스와 같은 패턴) ── */
document.addEventListener('click', (e) => {
  const titleTab = e.target.closest('#noteTitleTabs .app-title-tab');
  if (titleTab) {
    setNoteTab(titleTab.dataset.noteView === 'media' ? currentMediaChannel : 'general');
    return;
  }

  const recordChips = document.getElementById('recordViewChips');
  if (e.target.closest('[data-action="toggle-record-view-menu"]')) {
    recordChips?.classList.toggle('open');
    return;
  }
  const recordOption = e.target.closest('[data-record-view]');
  if (recordOption) {
    applyRecordView(recordOption.dataset.recordView);
    recordChips?.classList.remove('open');
    return;
  }
  if (recordChips && !e.target.closest('#recordViewChips')) recordChips.classList.remove('open');

  const mediaChips = document.getElementById('mediaChannelChips');
  if (e.target.closest('[data-action="toggle-media-menu"]')) {
    mediaChips?.classList.toggle('open');
    return;
  }
  const mediaOption = e.target.closest('[data-media-channel]');
  if (mediaOption) {
    setNoteTab(mediaOption.dataset.mediaChannel);
    mediaChips?.classList.remove('open');
    return;
  }
  if (mediaChips && !e.target.closest('#mediaChannelChips')) mediaChips.classList.remove('open');
});

// 업무기록 종류 전환(업무 타임라인 ↔ 업무 정리) — 업무 타임라인은 아직 미이식이라 안내만 보여준다.
function applyRecordView(view) {
  currentRecordView = view;
  document.getElementById('recordViewLabel').textContent = view === 'timeline' ? '업무 타임라인' : '업무 정리';
  document.querySelectorAll('[data-record-view]').forEach((chip) =>
    chip.classList.toggle('active', chip.dataset.recordView === view)
  );
  if (currentNoteTab === 'general') applyGeneralView();
}

// 업무기록(general) 탭 안에서 현재 currentRecordView에 맞는 화면만 보여준다.
function applyGeneralView() {
  const isOrganize = currentRecordView === 'organize';
  const monthCard = document.getElementById('noteMonthCard');
  const organizeContainer = document.getElementById('organizeContainer');
  const timelineView = document.getElementById('timelineView');
  if (monthCard) monthCard.hidden = !isOrganize;
  if (organizeContainer) organizeContainer.hidden = !isOrganize;
  if (timelineView) timelineView.hidden = isOrganize;
  // 오늘/인쇄/취소/저장은 Quill 에디터(업무 정리) 전용이라 업무 타임라인에선 숨긴다
  const noteControls = document.querySelector('.nt-filterbar .note-controls');
  if (noteControls) noteControls.style.display = isOrganize ? '' : 'none';
  if (!isOrganize) initTimelineOnce();
}

function initWorkNotesPage() {
  const now = new Date();
  document.getElementById('noteMonthPicker').value =
    now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  initQuill();
  initFontSizeSelects();
  initNoteMonthQuick();
  setNoteTab('general');
}
window.initWorkNotesPage = initWorkNotesPage;

/* ── 월별 바로가기 — 매출분석 month-quick UI 이식(연도 셀렉트 + 1~12월 카드).
   노트가 있는 달 + 이번 달(새 노트 작성용)만 활성화한다. ── */
let noteMonthQuickYear = new Date().getFullYear();
let noteMonthFillCache = {}; // year → Set("YYYY-MM") | null(조회 실패: 비활성화하지 않음)
const noteMonthFillLoading = new Set();

function initNoteMonthQuick() {
  const sel = document.getElementById('noteMonthYear');
  const curYear = new Date().getFullYear();
  const years = [];
  for (let y = curYear; y >= curYear - 3; y--) years.push(y);
  sel.innerHTML = years
    .map((y) => `<option value="${y}"${y === noteMonthQuickYear ? ' selected' : ''}>${y}년</option>`)
    .join('');
  sel.addEventListener('change', (e) => {
    noteMonthQuickYear = Number(e.target.value);
    renderNoteMonthQuick();
  });
  document.getElementById('noteMonthQuick').addEventListener('click', (e) => {
    const card = e.target.closest('.month-card');
    if (!card || card.disabled) return;
    document.getElementById('noteMonthPicker').value = card.dataset.month;
    handleNoteMonthChange();
  });
  renderNoteMonthQuick();
}

async function ensureNoteMonthFillLoaded(year) {
  if (year in noteMonthFillCache || noteMonthFillLoading.has(year)) return;
  noteMonthFillLoading.add(year);
  try {
    const { data, error } = await supabaseClient
      .from('work_notes')
      .select('date')
      .eq('type', 'general')
      .is('deleted_at', null)
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`);
    if (error) throw error;
    const months = new Set();
    (data || []).forEach((r) => r.date && months.add(String(r.date).slice(0, 7)));
    noteMonthFillCache[year] = months;
  } catch (_) {
    noteMonthFillCache[year] = null;
  } finally {
    noteMonthFillLoading.delete(year);
    renderNoteMonthQuick();
  }
}

function renderNoteMonthQuick() {
  const grid = document.getElementById('noteMonthQuick');
  if (!grid) return;
  const selected = document.getElementById('noteMonthPicker').value;
  const now = new Date();
  const curKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const fillSet = noteMonthFillCache[noteMonthQuickYear];
  const stillLoading = !(noteMonthQuickYear in noteMonthFillCache);
  ensureNoteMonthFillLoaded(noteMonthQuickYear);
  grid.innerHTML = Array.from({ length: 12 }, (_, i) => i + 1)
    .map((month) => {
      const monthKey = noteMonthQuickYear + '-' + String(month).padStart(2, '0');
      // 다음 달 1개까지는 미리 열어둔다(월말에 다음 달 계획을 미리 적는 용도)
      const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const nextKey = nextDate.getFullYear() + '-' + String(nextDate.getMonth() + 1).padStart(2, '0');
      const isFuture = monthKey > curKey && monthKey !== nextKey;
      const isCurrent = monthKey === curKey || monthKey === nextKey;
      const hasNote = !stillLoading && fillSet instanceof Set && fillSet.has(monthKey);
      // 조회 실패(null) 시에는 매출분석과 같은 정책으로 비활성화하지 않는다
      const enabled = !isFuture && (isCurrent || hasNote || (fillSet === null && !stillLoading));
      const active = enabled && selected === monthKey;
      return enabled
        ? `<button type="button" class="month-card${active ? ' active' : ''}" data-month="${monthKey}">${month}월</button>`
        : `<button type="button" class="month-card" disabled>${month}월</button>`;
    })
    .join('');
}

// 새 달에 첫 노트가 생성됐을 때 그 달을 즉시 활성 표시로 반영
function markNoteMonthFilled(monthStr) {
  const year = Number(monthStr.slice(0, 4));
  if (noteMonthFillCache[year] instanceof Set) noteMonthFillCache[year].add(monthStr);
  renderNoteMonthQuick();
}

/* ── 글꼴/크기 — Quill picker 대신 사이트 공용 .store-select 컴포넌트를 그대로 써서
   quill.format()만 호출한다. 열고 닫기는 블로그진단 드롭박스와 같은 패턴. ── */
function initFontSizeSelects() {
  const fontLabelMap = { 'nanum-square': '나눔스퀘어', 'nanum-myeongjo': '나눔명조', 'gowun-dodum': '고운돋움' };
  const sizeLabelMap = { '14px': '14', '15px': '15', '16px': '16', '18px': '18' };

  function setActiveChip(chipsId, value, attr) {
    document.querySelectorAll('#' + chipsId + ' [' + attr + ']').forEach((chip) => {
      chip.classList.toggle('active', chip.getAttribute(attr) === value);
    });
  }
  function applyFont(value) {
    window.quill.format('font', value);
    document.getElementById('wnFontLabel').textContent = fontLabelMap[value] || value;
    setActiveChip('wnFontChips', value, 'data-wn-font');
  }
  function applySize(value) {
    window.quill.format('size', value);
    document.getElementById('wnSizeLabel').textContent = sizeLabelMap[value] || value;
    setActiveChip('wnSizeChips', value, 'data-wn-size');
  }

  document.addEventListener('click', (e) => {
    const fontChips = document.getElementById('wnFontChips');
    const sizeChips = document.getElementById('wnSizeChips');

    if (e.target.closest('[data-action="toggle-wn-font-menu"]')) {
      fontChips?.classList.toggle('open');
      sizeChips?.classList.remove('open');
      return;
    }
    const fontOption = e.target.closest('[data-wn-font]');
    if (fontOption) {
      applyFont(fontOption.dataset.wnFont);
      fontChips?.classList.remove('open');
      return;
    }
    if (fontChips && !e.target.closest('#wnFontChips')) fontChips.classList.remove('open');

    if (e.target.closest('[data-action="toggle-wn-size-menu"]')) {
      sizeChips?.classList.toggle('open');
      fontChips?.classList.remove('open');
      return;
    }
    const sizeOption = e.target.closest('[data-wn-size]');
    if (sizeOption) {
      applySize(sizeOption.dataset.wnSize);
      sizeChips?.classList.remove('open');
      return;
    }
    if (sizeChips && !e.target.closest('#wnSizeChips')) sizeChips.classList.remove('open');
  });

  window.quill.on('selection-change', (range) => {
    if (!range) return;
    const format = window.quill.getFormat(range);
    const fontVal = format.font || 'nanum-square';
    const sizeVal = format.size || '15px';
    document.getElementById('wnFontLabel').textContent = fontLabelMap[fontVal] || fontVal;
    setActiveChip('wnFontChips', fontVal, 'data-wn-font');
    document.getElementById('wnSizeLabel').textContent = sizeLabelMap[sizeVal] || sizeVal;
    setActiveChip('wnSizeChips', sizeVal, 'data-wn-size');
  });
}

window.setNoteTab = function (tab) {
  currentNoteTab = tab;
  const isMedia = tab === 'blog' || tab === 'youtube';
  if (isMedia) currentMediaChannel = tab;

  // 페이지 타이틀 탭(업무기록/미디어 채널) + 드롭박스 상태 동기화
  document.querySelectorAll('#noteTitleTabs .app-title-tab').forEach((btn) =>
    btn.classList.toggle('active', btn.dataset.noteView === (isMedia ? 'media' : 'general'))
  );
  const mediaChips = document.getElementById('mediaChannelChips');
  if (mediaChips) mediaChips.hidden = !isMedia;
  const recordChips = document.getElementById('recordViewChips');
  if (recordChips) recordChips.hidden = isMedia;
  if (isMedia) {
    document.getElementById('mediaChannelLabel').textContent = tab === 'blog' ? '블로그 원고' : '유튜브 원고';
    document.querySelectorAll('[data-media-channel]').forEach((chip) =>
      chip.classList.toggle('active', chip.dataset.mediaChannel === tab)
    );
    document.getElementById('noteMonthCard').hidden = true;
    document.getElementById('timelineView').hidden = true;
    document.getElementById('organizeContainer').hidden = false;
    const noteControls = document.querySelector('.nt-filterbar .note-controls');
    if (noteControls) noteControls.style.display = '';
  } else {
    applyGeneralView();
  }

  document.getElementById('draftMetadataArea').style.display = 'none';
  const aiResultEl = document.getElementById('aiSuggestResult');
  aiResultEl.style.display = 'none';
  aiResultEl.innerHTML = '';

  const listContainer = document.getElementById('draftListContainer');
  const editorWrapper = document.getElementById('editor-wrapper');

  if (tab === 'general') {
    listContainer.style.display = 'none';
    editorWrapper.style.display = 'flex';
    if (window.quill) window.quill.enable(true);
    if (currentRecordView === 'organize') handleNoteMonthChange();
  } else {
    listContainer.style.display = 'block';
    editorWrapper.style.display = 'none';
    document.getElementById('draftTitle').placeholder =
      tab === 'blog' ? '블로그 원고 제목을 입력하세요' : '유튜브 기획/대본 제목을 입력하세요';
    loadDraftList(tab);
  }
};

window.backToList = function () {
  document.getElementById('draftMetadataArea').style.display = 'none';
  document.getElementById('editor-wrapper').style.display = 'none';
  document.getElementById('draftListContainer').style.display = 'block';
  loadDraftList(currentNoteTab);
};

/* ── 일반 노트: 월별 로드 ── */
window.handleNoteMonthChange = async function () {
  if (currentNoteTab !== 'general') return;
  const monthStr = document.getElementById('noteMonthPicker').value;
  if (!monthStr) return;
  currentNoteMonth = monthStr;
  const monthDate = monthStr + '-01';

  showLoading('노트를 불러오는 중...');
  try {
    const { data, error } = await supabaseClient
      .from('work_notes')
      .select('*')
      .eq('date', monthDate)
      .eq('type', 'general')
      .is('deleted_at', null)
      .limit(1);
    if (error) throw error;

    if (data && data.length > 0) {
      currentNoteId = data[0].id;
      const noteContent = data[0].content || '';
      if (window.quill) window.quill.root.innerHTML = noteContent;
      noteOriginalContent = noteContent;
    } else {
      currentNoteId = null;
      if (window.quill) window.quill.root.innerHTML = '';
      noteOriginalContent = '';
    }
    // 선택한 달이 다른 연도면 그리드 연도도 따라가고, active 표시 동기화
    const selYear = Number(monthStr.slice(0, 4));
    if (selYear !== noteMonthQuickYear) {
      noteMonthQuickYear = selYear;
      const yearSel = document.getElementById('noteMonthYear');
      if (yearSel) yearSel.value = String(selYear);
    }
    renderNoteMonthQuick();
    setSaveStatus('최신 상태');
  } catch (e) {
    console.error('노트 로드 실패:', e);
    showToast('원고 데이터를 불러오지 못했습니다.', 'error');
  } finally {
    hideLoading();
  }
};

function setSaveStatus(html) {
  const el = document.getElementById('noteSaveStatus');
  if (el) el.innerHTML = html;
}

/* ── 오늘 날짜 헤더 삽입 ── */
window.insertTodayHeader = function () {
  if (!window.quill) return;
  const now = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const label = now.getFullYear() + '년 ' + (now.getMonth() + 1) + '월 ' + now.getDate() + '일 (' + days[now.getDay()] + ')';
  const range = window.quill.getSelection(true);
  const index = range ? range.index : window.quill.getLength();
  if (window.quill.getLength() > 1) window.quill.insertText(index, '\n', 'user');
  window.quill.insertEmbed(index + (window.quill.getLength() > 1 ? 1 : 0), 'divider', true, 'user');
  const afterHr = index + (window.quill.getLength() > 1 ? 2 : 1);
  window.quill.insertText(afterHr, label + '\n', { bold: true, color: '#e85d2f' }, 'user');
  window.quill.setSelection(afterHr + label.length + 1, 'silent');
};

/* ── Quill 2.x 초기화 (+ quill-table-better) ── */
function initQuill() {
  if (window.quill) return;

  const Size = Quill.import('attributors/style/size');
  Size.whitelist = ['14px', '15px', '16px', '18px'];
  Quill.register(Size, true);

  const Font = Quill.import('formats/font');
  Font.whitelist = ['nanum-square', 'nanum-myeongjo', 'gowun-dodum'];
  Quill.register(Font, true);

  if (!Quill.imports['formats/divider']) {
    const BlockEmbed = Quill.import('blots/block/embed');
    class DividerBlot extends BlockEmbed {}
    DividerBlot.blotName = 'divider';
    DividerBlot.tagName = 'hr';
    Quill.register(DividerBlot);
  }

  // 툴바는 Quill이 자동 생성하지 않고 #nt-toolbar(work-notes.html에 직접 작성, 네이버
  // 블로그 에디터 참고해 아이콘+텍스트 라벨 버튼)를 그대로 사용한다. Quill은 기존 마크업을
  // 지우지 않고 클릭 이벤트만 붙이므로 버튼 내부 아이콘/라벨은 우리가 쓴 그대로 유지된다.
  // 단, color/background 피커는 Quill이 트리거 아이콘을 자체적으로 그려 넣으므로
  // ui/icons 맵을 오버라이드해야 우리가 준 아이콘으로 바뀐다.
  const pickerIcons = Quill.import('ui/icons');
  pickerIcons.color =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 15v-7a3 3 0 0 1 6 0v7"/><path d="M9 11h6"/><path d="M5 19h14"/></svg>';
  pickerIcons.background =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8l4 -4"/><path d="M14 4l-10 10"/><path d="M4 20l16 -16"/><path d="M20 10l-10 10"/><path d="M20 16l-4 4"/></svg>';

  // quill-table-better — 활발히 관리되는 라이브러리라 등록. CDN 로드 실패/API 변경 시에도
  // 나머지 에디터 기능은 정상 동작하도록 try/catch로 감싼다.
  let tableModuleConfig = false;
  let keyboardBindings;
  try {
    if (typeof QuillTableBetter !== 'undefined') {
      Quill.register({ 'modules/table-better': QuillTableBetter }, true);
      tableModuleConfig = {};
      keyboardBindings = QuillTableBetter.keyboardBindings;
    }
  } catch (e) {
    console.error('quill-table-better 등록 실패:', e);
  }

  const modules = {
    toolbar: {
      container: '#nt-toolbar',
      handlers: {
        image: imageUploadHandler,
        divider: function () {
          const range = this.quill.getSelection(true);
          this.quill.insertText(range.index, '\n', Quill.sources.USER);
          this.quill.insertEmbed(range.index + 1, 'divider', true, Quill.sources.USER);
          this.quill.setSelection(range.index + 2, Quill.sources.SILENT);
        },
        'table-insert': function () {
          const tableBetter = window.quill.getModule('table-better');
          if (tableBetter && typeof tableBetter.insertTable === 'function') {
            tableBetter.insertTable(3, 3);
          } else {
            showToast('표 모듈을 불러오지 못했습니다.', 'error');
          }
        },
      },
    },
  };
  if (tableModuleConfig !== false) {
    modules.table = false;
    modules['table-better'] = tableModuleConfig;
    if (keyboardBindings) modules.keyboard = { bindings: keyboardBindings };
  }

  window.quill = new Quill('#editor', {
    theme: 'snow',
    placeholder: '업무 내용을 자유롭게 기록하세요...',
    modules,
  });
  applyNoteToolbarUi();
  requestAnimationFrame(applyNoteToolbarUi);

  window.quill.on('text-change', function (delta, oldDelta, source) {
    if (source === 'user') {
      setSaveStatus('작성 중...');
      clearTimeout(noteAutoSaveTimer);
      noteAutoSaveTimer = setTimeout(autoSaveNote, 2000);
    }
  });

  window.quill.root.addEventListener('paste', handleImagePaste, true);
  window.quill.root.addEventListener(
    'dragover',
    function (e) {
      if (e.dataTransfer && e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    },
    true
  );
  window.quill.root.addEventListener('drop', handleImageDrop, true);

  document.addEventListener('dragover', (e) => e.preventDefault(), false);
  document.addEventListener(
    'drop',
    (e) => {
      if (e.target.closest('#editor')) return;
      e.preventDefault();
    },
    false
  );
}

function applyNoteToolbarUi() {
  // 사용자가 제공한 Tabler 아이콘 세트로 교체.
  const icons = {
    image:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 8h.01"/><path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12"/><path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5"/><path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3"/></svg>',
    blockquote:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5"/><path d="M19 11h-4a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h3a1 1 0 0 1 1 1v6c0 2.667 -1.333 4.333 -4 5"/></svg>',
    divider:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l16 0"/><path d="M4 4l0 .01"/><path d="M8 4l0 .01"/><path d="M12 4l0 .01"/><path d="M16 4l0 .01"/><path d="M20 4l0 .01"/><path d="M4 8l0 .01"/><path d="M12 8l0 .01"/><path d="M20 8l0 .01"/><path d="M4 16l0 .01"/><path d="M12 16l0 .01"/><path d="M20 16l0 .01"/><path d="M4 20l0 .01"/><path d="M8 20l0 .01"/><path d="M12 20l0 .01"/><path d="M16 20l0 .01"/><path d="M20 20l0 .01"/></svg>',
    'table-insert':
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14"/><path d="M3 10h18"/><path d="M10 3v18"/></svg>',
    bold:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 5h6a3.5 3.5 0 0 1 0 7h-6l0 -7"/><path d="M13 12h1a3.5 3.5 0 0 1 0 7h-7v-7"/></svg>',
    italic:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5l6 0"/><path d="M7 19l6 0"/><path d="M14 5l-4 14"/></svg>',
    underline:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 5v5a5 5 0 0 0 10 0v-5"/><path d="M5 19h14"/></svg>',
    strike:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l14 0"/><path d="M16 6.5a4 2 0 0 0 -4 -1.5h-1a3.5 3.5 0 0 0 0 7h2a3.5 3.5 0 0 1 0 7h-1.5a4 2 0 0 1 -4 -1.5"/></svg>',
    'ordered-list':
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 6h9"/><path d="M11 12h9"/><path d="M12 18h8"/><path d="M4 16a2 2 0 1 1 4 0c0 .591 -.5 1 -1 1.5l-3 2.5h4"/><path d="M6 10v-6l-2 2"/></svg>',
    'bullet-list':
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l11 0"/><path d="M9 12l11 0"/><path d="M9 18l11 0"/><path d="M5 6l0 .01"/><path d="M5 12l0 .01"/><path d="M5 18l0 .01"/></svg>',
    clean:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 15l4 4m0 -4l-4 4"/><path d="M7 6v-1h11v1"/><path d="M7 19l4 0"/><path d="M13 5l-4 14"/></svg>',
  };

  document.querySelectorAll('#nt-toolbar button.nt-tb-btn[data-label]').forEach((button) => {
    const key =
      button.dataset.icon ||
      Array.from(button.classList)
        .find((className) => className.startsWith('ql-'))
        ?.replace('ql-', '');
    if (!key || !icons[key]) return;
    button.innerHTML = icons[key] + '<span class="nt-tb-label">' + button.dataset.label + '</span>';
  });
}

/* ── 자동 저장 (일반 노트만, 원본은 갱신 안 함) ── */
async function autoSaveNote() {
  if (currentNoteTab !== 'general') return;
  const monthStr = currentNoteMonth || document.getElementById('noteMonthPicker').value;
  const noteContent = window.quill.root.innerHTML;
  if (!monthStr || !noteContent || noteContent === '<p><br></p>') return;

  try {
    if (currentNoteId) {
      const { error } = await supabaseClient
        .from('work_notes')
        .update({ content: noteContent, saved_at: new Date().toISOString() })
        .eq('id', currentNoteId);
      if (error) throw error;
    } else {
      const { data, error } = await supabaseClient
        .from('work_notes')
        .insert([{ date: monthStr + '-01', type: 'general', title: '일반 노트', content: noteContent, status: 'saving' }])
        .select();
      if (error) throw error;
      if (data && data.length > 0) currentNoteId = data[0].id;
      markNoteMonthFilled(monthStr);
    }
    const now = new Date();
    setSaveStatus(
      '<span style="color:#10b981;">자동 저장됨 (' +
        String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ')</span>'
    );
  } catch (e) {
    console.error('자동저장 실패:', e);
    showToast('자동저장에 실패했습니다.', 'error');
    setSaveStatus('자동저장 실패');
  }
}

/* ── 수동 저장 (성공 시에만 롤백 기준점 갱신) ── */
window.saveNoteManual = async function () {
  clearTimeout(noteAutoSaveTimer);
  await saveNoteToServer(true);
};

window.saveNoteToServer = async function (isManual = false) {
  const date =
    currentNoteTab === 'general'
      ? (currentNoteMonth || document.getElementById('noteMonthPicker').value) + '-01'
      : document.getElementById('noteDate').value;
  const title = currentNoteTab === 'general' ? '일반 노트' : document.getElementById('draftTitle').value.trim();
  const status = currentNoteTab === 'general' ? 'saving' : document.getElementById('draftStatus').value;
  const content = window.quill.root.innerHTML;

  if (!date) { showToast('날짜를 선택해주세요.', 'warning'); return; }
  if (content === '<p><br></p>' || !content) { showToast('내용을 입력해주세요.', 'warning'); return; }

  const saveBtn = document.querySelector('.note-controls .btn-primary');
  const originalText = saveBtn.innerHTML;
  saveBtn.innerHTML = '저장중...';
  saveBtn.disabled = true;

  try {
    if (currentNoteId) {
      const { error } = await supabaseClient
        .from('work_notes')
        .update({ title, content, status, saved_at: new Date().toISOString() })
        .eq('id', currentNoteId);
      if (error) throw error;
    } else {
      const { data, error } = await supabaseClient
        .from('work_notes')
        .insert([{ date, type: currentNoteTab, title, content, status }])
        .select();
      if (error) throw error;
      if (data && data.length > 0) currentNoteId = data[0].id;
      if (currentNoteTab === 'general') markNoteMonthFilled(String(date).slice(0, 7));
    }

    if (isManual) {
      noteOriginalContent = content;
      showToast('저장되었습니다.', 'success');
    }
    setSaveStatus('저장 완료');
    if (currentNoteTab !== 'general') loadDraftList(currentNoteTab);
  } catch (e) {
    console.error('저장 오류:', e);
    showToast('저장 중 오류가 발생했습니다.', 'error');
  } finally {
    saveBtn.innerHTML = originalText;
    saveBtn.disabled = false;
  }
};

/* ── 취소/롤백 ── */
window.cancelNoteChanges = async function () {
  if (!confirm('작성 중인 내용을 취소하고 마지막 저장 상태로 되돌리겠습니까?\n(자동 저장된 내용도 초기화됩니다.)')) return;
  clearTimeout(noteAutoSaveTimer);
  if (window.quill) window.quill.root.innerHTML = noteOriginalContent;
  setSaveStatus('복구 중...');

  if (currentNoteId) {
    try {
      const { error } = await supabaseClient
        .from('work_notes')
        .update({ content: noteOriginalContent, saved_at: new Date().toISOString() })
        .eq('id', currentNoteId);
      if (error) throw error;
      setSaveStatus('복구 완료');
    } catch (e) {
      console.error('롤백 실패:', e);
      showToast('서버 데이터 복구 중 오류가 발생했습니다.', 'error');
    }
  } else {
    setSaveStatus('초기화됨');
  }
};

window.printNote = function () { window.print(); };

/* ── 이미지 업로드 ── */
function handleImagePaste(e) {
  if (e.clipboardData && e.clipboardData.items) {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        e.stopPropagation();
        uploadFileToSupabase(items[i].getAsFile());
        return;
      }
    }
  }
}
function handleImageDrop(e) {
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
    const file = e.dataTransfer.files[0];
    if (file.type.startsWith('image/')) {
      e.preventDefault();
      e.stopPropagation();
      let dropIndex = null;
      if (document.caretRangeFromPoint) {
        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (range) {
          const blot = Quill.find(range.startContainer) || Quill.find(range.startContainer.parentNode);
          if (blot) dropIndex = window.quill.getIndex(blot) + range.startOffset;
        }
      }
      uploadFileToSupabase(file, dropIndex);
    }
  }
}
function imageUploadHandler() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => { if (input.files[0]) uploadFileToSupabase(input.files[0]); };
  input.click();
}
async function uploadFileToSupabase(file, dropIndex = null) {
  try {
    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
    const filePath = `editor/${fileName}`;
    const { error: uploadError } = await supabaseClient.storage
      .from('admin-images')
      .upload(filePath, file, { cacheControl: '3600', upsert: false });
    if (uploadError) throw uploadError;
    const { data } = supabaseClient.storage.from('admin-images').getPublicUrl(filePath);

    let index = dropIndex;
    if (index === null) {
      const range = window.quill.getSelection();
      index = range ? range.index : window.quill.getLength();
    }
    window.quill.insertEmbed(index, 'image', data.publicUrl, Quill.sources.USER);
    window.quill.setSelection(index + 1, Quill.sources.SILENT);
    showToast('이미지가 삽입되었습니다.', 'success');
  } catch (e) {
    console.error('이미지 업로드 오류:', e);
    showToast('이미지 업로드 실패: ' + (e.message || ''), 'error');
  }
}

/* ── 목록 / 상세 ── */
async function loadDraftList(type) {
  const listEl = document.getElementById('draftListBody');
  if (!listEl) return;
  listEl.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8;">로딩중...</td></tr>';
  try {
    const { data, error } = await supabaseClient
      .from('work_notes')
      .select('id, date, title, status, saved_at')
      .eq('type', type)
      .is('deleted_at', null)
      .order('saved_at', { ascending: false });
    if (error) throw error;

    if (data && data.length > 0) {
      listEl.innerHTML = data
        .map((item) => {
          const statusTxt = item.status === 'uploaded' ? '업로드 완료' : '작성중';
          const statusColor = item.status === 'uploaded' ? '#166534' : '#64748b';
          const statusBg = item.status === 'uploaded' ? '#dcfce7' : '#f1f5f9';
          const statusBadge = `<span style="background:${statusBg}; color:${statusColor}; padding:4px 8px; border-radius:12px; font-size:11px; font-weight:700;">${statusTxt}</span>`;
          const savedTime = new Date(item.saved_at);
          const timeStr = `${savedTime.getMonth() + 1}/${savedTime.getDate()} ${String(savedTime.getHours()).padStart(2, '0')}:${String(savedTime.getMinutes()).padStart(2, '0')}`;
          return `<tr onclick="loadDraftContent('${item.id}')"><td class="text-sub">${item.date}</td><td class="text-left font-bold">${item.title || '(제목 없음)'}</td><td>${statusBadge}</td><td class="text-sub">${timeStr}</td></tr>`;
        })
        .join('');
    } else {
      listEl.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px; color:#94a3b8; font-size:13px;">등록된 원고가 없습니다.</td></tr>';
    }
  } catch (e) {
    console.error('리스트 오류:', e);
    listEl.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#ef4444;">리스트 로드 실패</td></tr>';
  }
}

window.loadDraftContent = async function (noteId) {
  try {
    const { data, error } = await supabaseClient.from('work_notes').select('*').eq('id', noteId).single();
    if (error) throw error;
    if (!data) return;

    currentNoteId = data.id;
    document.getElementById('noteDate').value = data.date;
    document.getElementById('draftTitle').value = data.title || '';
    document.getElementById('draftStatus').value = data.status || 'saving';
    if (window.quill) window.quill.root.innerHTML = data.content || '';
    noteOriginalContent = data.content || '';

    document.getElementById('draftListContainer').style.display = 'none';
    document.getElementById('draftMetadataArea').style.display = 'flex';
    document.getElementById('editor-wrapper').style.display = 'flex';

    const aiResultEl = document.getElementById('aiSuggestResult');
    if (data.ai_suggestion) {
      aiResultEl.innerHTML = data.ai_suggestion;
      aiResultEl.style.display = 'block';
    } else {
      aiResultEl.innerHTML = '';
      aiResultEl.style.display = 'none';
    }
  } catch (e) {
    console.error('원고 불러오기 오류:', e);
    showToast('원고를 불러오지 못했습니다.', 'error');
  }
};

window.createNewDraft = function () {
  currentNoteId = null;
  document.getElementById('draftTitle').value = '';
  document.getElementById('draftStatus').value = 'saving';
  if (window.quill) window.quill.root.innerHTML = '';
  noteOriginalContent = '';
  document.getElementById('noteDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('aiSuggestResult').style.display = 'none';
  document.getElementById('aiSuggestResult').innerHTML = '';
  document.getElementById('draftListContainer').style.display = 'none';
  document.getElementById('draftMetadataArea').style.display = 'flex';
  document.getElementById('editor-wrapper').style.display = 'flex';
};

/* ── 검색 ── */
let noteSearchTimer = null;
window.searchNotes = function () {
  const query = document.getElementById('noteSearchInput').value.trim();
  const resultsEl = document.getElementById('noteSearchResults');
  clearTimeout(noteSearchTimer);
  if (!query) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; return; }
  noteSearchTimer = setTimeout(() => doSearchNotes(query), 150);
};

async function doSearchNotes(query) {
  const resultsEl = document.getElementById('noteSearchResults');
  resultsEl.style.display = 'block';
  resultsEl.innerHTML = '<div style="padding:12px 16px; color:#94a3b8; font-size:13px;">검색 중...</div>';

  try {
    const { data, error } = await supabaseClient
      .from('work_notes')
      .select('id, type, title, content, date')
      .is('deleted_at', null)
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .order('saved_at', { ascending: false })
      .limit(20);
    if (error) throw error;

    if (!data || data.length === 0) {
      resultsEl.innerHTML = '<div style="padding:16px; text-align:center; color:#94a3b8; font-size:13px;">검색 결과가 없습니다.</div>';
      return;
    }

    function stripHtml(html) {
      const tmp = document.createElement('div');
      tmp.innerHTML = html || '';
      return tmp.textContent || tmp.innerText || '';
    }
    function highlight(text, q) {
      if (!text) return '';
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return text.replace(new RegExp(escaped, 'gi'), (m) => `<mark style="background:#fef08a; color:#1e293b; border-radius:2px; padding:0 2px;">${m}</mark>`);
    }
    const typeLabel = { general: '일반', blog: '블로그', youtube: '유튜브' };
    const typeColor = { general: '#4f46e5', blog: '#16a34a', youtube: '#dc2626' };

    resultsEl.innerHTML =
      `<div style="padding:8px 16px; font-size:11px; font-weight:700; color:#94a3b8; background:#f8fafc; border-bottom:1px solid #f1f5f9;">검색 결과 ${data.length}건</div>` +
      data
        .map((item) => {
          const plain = stripHtml(item.content);
          const lc = plain.toLowerCase();
          const qi = lc.indexOf(query.toLowerCase());
          let snippet = '';
          if (qi !== -1) {
            const start = Math.max(0, qi - 40);
            const end = Math.min(plain.length, qi + query.length + 40);
            snippet = (start > 0 ? '…' : '') + plain.slice(start, end) + (end < plain.length ? '…' : '');
          } else {
            snippet = plain.slice(0, 80) + (plain.length > 80 ? '…' : '');
          }
          const titleHl = highlight(item.title || '(제목 없음)', query);
          const snippetHl = highlight(snippet, query);
          const label = typeLabel[item.type] || item.type;
          const color = typeColor[item.type] || '#64748b';
          return `<div class="note-search-item" onclick="openSearchResult('${item.id}', '${item.type}')"
            style="padding:10px 16px; cursor:pointer; border-bottom:1px solid #f1f5f9;"
            onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='white'">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <span style="font-size:10px; font-weight:700; color:${color}; background:${color}18; padding:2px 7px; border-radius:10px;">${label}</span>
              <span style="font-size:13px; font-weight:600; color:#1e293b; flex:1;">${titleHl}</span>
              <span style="font-size:11px; color:#94a3b8;">${(item.date || '').slice(0, 7)}</span>
            </div>
            ${snippet ? `<div style="font-size:12px; color:#64748b; line-height:1.5; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;">${snippetHl}</div>` : ''}
          </div>`;
        })
        .join('');
  } catch (e) {
    console.error('노트 검색 실패:', e);
    resultsEl.innerHTML = '<div style="padding:12px 16px; color:#ef4444; font-size:13px;">검색 중 오류가 발생했습니다.</div>';
  }
}

window.openSearchResult = async function (noteId, type) {
  document.getElementById('noteSearchResults').style.display = 'none';
  document.getElementById('noteSearchInput').value = '';
  setNoteTab(type);

  if (type === 'general') {
    try {
      const { data } = await supabaseClient.from('work_notes').select('date').eq('id', noteId).single();
      if (data && data.date) {
        document.getElementById('noteMonthPicker').value = data.date.slice(0, 7);
        handleNoteMonthChange();
      }
    } catch (e) { console.error(e); }
  } else {
    setTimeout(() => loadDraftContent(noteId), 300);
  }
};

document.addEventListener('DOMContentLoaded', function () {
  const input = document.getElementById('noteSearchInput');
  if (!input) return;
  input.addEventListener('blur', function () {
    setTimeout(() => {
      const el = document.getElementById('noteSearchResults');
      if (el) el.style.display = 'none';
    }, 200);
  });
  input.addEventListener('focus', function () {
    if (this.value.trim().length > 0) searchNotes();
  });
});

/* ── AI 추천 (문단별 이미지/영상 소스 추천, ai_suggestion 컬럼에 영구 저장) ── */
window.runAiSuggest = async function () {
  if (!currentNoteId) { showToast('먼저 원고를 저장해주세요.', 'warning'); return; }
  const btn = document.getElementById('aiSuggestBtn');
  const resultEl = document.getElementById('aiSuggestResult');
  if (!window.quill) return;

  const tmp = document.createElement('div');
  tmp.innerHTML = window.quill.root.innerHTML;

  const paragraphs = [];
  let current = [];
  tmp.childNodes.forEach((node) => {
    if (node.tagName === 'HR') {
      if (current.length) {
        const text = current.map((n) => n.textContent || '').join(' ').trim();
        if (text) paragraphs.push(text);
        current = [];
      }
    } else {
      current.push(node);
    }
  });
  if (current.length) {
    const text = current.map((n) => n.textContent || '').join(' ').trim();
    if (text) paragraphs.push(text);
  }
  if (!paragraphs.length) { showToast('원고 내용이 없습니다.', 'warning'); return; }

  const isYoutube = currentNoteTab === 'youtube';
  btn.disabled = true;
  btn.textContent = '분석중...';
  resultEl.style.display = 'none';
  resultEl.innerHTML = '';

  try {
    const prompt = `당신은 ${isYoutube ? '유튜브 영상 제작' : '블로그 포스팅'} 전문 콘텐츠 디렉터입니다.
아래 원고의 각 문단에 어울리는 ${isYoutube ? 'B-roll 영상 소스' : '이미지 소재'}를 추천해주세요.

[출력 형식 — 반드시 준수]
각 문단마다:

[문단 N] 문단 핵심 키워드
${isYoutube
  ? `① 강추 🎬 장면 설명 (구도·피사체·분위기)\n   🔍 검색어: footage keyword1, keyword2 (영문)\n② 차선 🎬 장면 설명\n   🔍 검색어: footage keyword1, keyword2 (영문)`
  : `① 강추 📷 이미지 설명 (구도·색감·분위기·소재)\n   🔍 검색어: image keyword1, keyword2 (영문)\n② 차선 📷 이미지 설명\n   🔍 검색어: image keyword1, keyword2 (영문)`}

[전체 요약] (맨 마지막에 한 번만)
👑 가장 임팩트 있는 ${isYoutube ? '장면' : '이미지'} TOP 3: 문단N-①, 문단N-①, 문단N-① 순으로 우선 확보 권장

[주의사항]
- 검색어는 반드시 영문으로, Pixabay·Pexels·${isYoutube ? 'Storyblocks' : 'Unsplash'}에서 바로 쓸 수 있는 실용적인 단어로
- 추상적 표현 금지, 구체적 피사체와 상황 묘사 필수
- 한국 단열재/건축자재 업체 콘텐츠임을 감안해 현장감 있는 소재 우선 추천
- [주의] 인사말, 도입 설명 없이 [문단 1]부터 바로 시작할 것

---원고---
${paragraphs.map((p, i) => `[문단 ${i + 1}]\n${p}`).join('\n\n')}`;

    const res = await fetch(AI_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ chatHistory: [{ role: 'user', parts: [{ text: prompt }] }] }),
    });
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) throw new Error('응답 없음');

    const sectionMatches = [...text.matchAll(/\[문단\s*(\d+)\]([\s\S]*?)(?=\[문단\s*\d+\]|\[전체 요약\]|$)/g)];
    const sectionMap = {};
    sectionMatches.forEach((m) => { sectionMap[parseInt(m[1])] = m[2].trim(); });

    const contentHTML = paragraphs
      .map((p, i) => {
        const suggestion = sectionMap[i + 1] || '-';
        const preview = p.length > 60 ? p.slice(0, 60) + '…' : p;
        return `<div class="ai-suggest-item">
          <div class="ai-suggest-paragraph">문단 ${i + 1}: ${preview}</div>
          <div class="ai-suggest-content">${suggestion.replace(/\n/g, '<br>')}</div>
        </div>`;
      })
      .join('');

    const summaryMatch = text.match(/\[전체 요약\]([\s\S]*?)$/);
    const summaryHTML = summaryMatch
      ? `<div class="ai-suggest-item" style="background:#fefce8;border-color:#fde047;">
          <div class="ai-suggest-paragraph" style="color:#854d0e;">👑 전체 요약</div>
          <div class="ai-suggest-content">${summaryMatch[1].trim().replace(/\n/g, '<br>')}</div>
        </div>`
      : '';

    const finalHTML = contentHTML + summaryHTML;
    resultEl.innerHTML = finalHTML;
    resultEl.style.display = 'block';

    // ai_suggestion 컬럼에 영구 저장 — 레거시(localStorage)와 달리 기기 바뀌어도 유지됨
    await supabaseClient.from('work_notes').update({ ai_suggestion: finalHTML }).eq('id', currentNoteId);
  } catch (e) {
    console.error('AI 추천 오류:', e);
    showToast('AI 추천 중 오류가 발생했습니다.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ AI 추천';
  }
};

/* ================================================================
   업무 타임라인 — Admin_backup(js/tasks.js)의 time_logs 이식.
   테이블: work_timelogs (authenticated 전용 RLS)
   ================================================================ */
let timeLogs = [];
let editingTimeLogIndex = -1;
let isTimelineFetched = false;
let timelineCollapsedDates = {};
let timelineMonthQuickYear = new Date().getFullYear();
let timelineSelectedMonth = '';
let timelineMonthFillCache = {}; // year → Set("YYYY-MM") | null
const timelineMonthFillLoading = new Set();

const TL_ICON_EDIT =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="M15 5l4 4"/></svg>';
const TL_ICON_TRASH =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

// 업무기록 > 업무 타임라인 탭을 처음 열 때 한 번만 초기화
let timelineInitDone = false;
function initTimelineOnce() {
  if (timelineInitDone) return;
  timelineInitDone = true;
  const todayStr = new Date().toISOString().slice(0, 10);
  document.getElementById('tlDate').value = todayStr;
  timelineSelectedMonth = todayStr.slice(0, 7);
  initTimelineMonthQuick();
  loadTimelineFromServer();
}

window.onTlCategoryChange = function () {
  const isHoliday = document.getElementById('tlCategory').value === '휴무';
  document.getElementById('tlStartField').style.display = isHoliday ? 'none' : '';
  document.getElementById('tlEndField').style.display = isHoliday ? 'none' : '';
};

// 같은 날짜에 이미 기록이 있으면, 마지막 종료 시각을 다음 시작 시각으로 자동 채워준다(연속 기록용)
function updateTlDefaultStartTime() {
  if (editingTimeLogIndex > -1) return;
  const selectedDate = document.getElementById('tlDate').value;
  if (!selectedDate) return;
  const dayLogs = timeLogs.filter((log) => log.date === selectedDate && log.category !== '휴무');
  if (dayLogs.length > 0) {
    dayLogs.sort((a, b) => a.end.localeCompare(b.end));
    const last = dayLogs[dayLogs.length - 1];
    if (last && last.end && last.end !== '00:00') {
      const [h, m] = last.end.split(':');
      document.getElementById('tlStartH').value = h;
      document.getElementById('tlStartM').value = m;
      return;
    }
  }
  document.getElementById('tlStartH').value = '';
  document.getElementById('tlStartM').value = '';
}

async function loadTimelineFromServer() {
  if (isTimelineFetched) {
    renderTimeLogList();
    updateTlDefaultStartTime();
    return;
  }
  showLoading('타임라인을 불러오는 중...');
  try {
    const { data, error } = await supabaseClient
      .from('work_timelogs')
      .select('*')
      .order('date', { ascending: false })
      .order('start_time', { ascending: true });
    if (error) throw error;

    timeLogs = (data || []).map((r) => ({
      id: r.id,
      date: r.date,
      category: r.category,
      task: r.task,
      start: r.start_time || '',
      end: r.end_time || '',
      duration: r.duration,
      min: r.minutes,
    }));
    isTimelineFetched = true;
    renderTimeLogList();
    renderTimelineMonthQuick();
    updateTlDefaultStartTime();
  } catch (e) {
    console.error('타임라인 로드 실패:', e);
    showToast('타임라인 데이터를 불러오지 못했습니다.', 'error');
  } finally {
    hideLoading();
  }
}

/* ── 월별 바로가기(업무 정리와 같은 컴포넌트, 별도 인스턴스) ── */
function initTimelineMonthQuick() {
  const sel = document.getElementById('timelineMonthYear');
  const curYear = new Date().getFullYear();
  const years = [];
  for (let y = curYear; y >= curYear - 3; y--) years.push(y);
  sel.innerHTML = years
    .map((y) => `<option value="${y}"${y === timelineMonthQuickYear ? ' selected' : ''}>${y}년</option>`)
    .join('');
  sel.addEventListener('change', (e) => {
    timelineMonthQuickYear = Number(e.target.value);
    renderTimelineMonthQuick();
  });
  document.getElementById('timelineMonthQuick').addEventListener('click', (e) => {
    const card = e.target.closest('.month-card');
    if (!card || card.disabled) return;
    timelineSelectedMonth = card.dataset.month;
    renderTimelineMonthQuick();
    renderTimeLogList();
  });
  renderTimelineMonthQuick();
}

function ensureTimelineMonthFillLoaded(year) {
  if (year in timelineMonthFillCache || timelineMonthFillLoading.has(year)) return;
  timelineMonthFillLoading.add(year);
  // 이미 전체 로드된 timeLogs 안에서 연도별로 집계 — 별도 조회 불필요
  const months = new Set();
  timeLogs.forEach((log) => {
    if (log.date && log.date.startsWith(String(year))) months.add(log.date.slice(0, 7));
  });
  timelineMonthFillCache[year] = months;
  timelineMonthFillLoading.delete(year);
  renderTimelineMonthQuick();
}

function renderTimelineMonthQuick() {
  const grid = document.getElementById('timelineMonthQuick');
  if (!grid) return;
  const now = new Date();
  const curKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextKey = nextDate.getFullYear() + '-' + String(nextDate.getMonth() + 1).padStart(2, '0');
  const fillSet = timelineMonthFillCache[timelineMonthQuickYear];
  const stillLoading = !(timelineMonthQuickYear in timelineMonthFillCache);
  if (isTimelineFetched) ensureTimelineMonthFillLoaded(timelineMonthQuickYear);
  grid.innerHTML = Array.from({ length: 12 }, (_, i) => i + 1)
    .map((month) => {
      const monthKey = timelineMonthQuickYear + '-' + String(month).padStart(2, '0');
      const isFuture = monthKey > curKey && monthKey !== nextKey;
      const isCurrent = monthKey === curKey || monthKey === nextKey;
      const hasLog = !stillLoading && fillSet instanceof Set && fillSet.has(monthKey);
      const enabled = !isFuture && (isCurrent || hasLog);
      const active = enabled && timelineSelectedMonth === monthKey;
      return enabled
        ? `<button type="button" class="month-card${active ? ' active' : ''}" data-month="${monthKey}">${month}월</button>`
        : `<button type="button" class="month-card" disabled>${month}월</button>`;
    })
    .join('');
}

/* ── 목록 렌더링(날짜별 접기/펼치기, 청크 렌더링) ── */
function getDayKor(dateStr) {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[new Date(dateStr).getDay()];
}

window.renderTimeLogList = function () {
  const tbody = document.getElementById('timelineListBody');
  if (!tbody) return;
  const searchQuery = (document.getElementById('tlSearchInput').value || '').toLowerCase();

  const filtered = timeLogs.filter(
    (log) =>
      log.date.startsWith(timelineSelectedMonth) &&
      (searchQuery === '' || log.task.toLowerCase().includes(searchQuery) || log.category.toLowerCase().includes(searchQuery))
  );
  filtered.sort((a, b) => b.date.localeCompare(a.date) || a.start.localeCompare(b.start));

  const idxMap = new Map(timeLogs.map((log, i) => [log, i]));
  const grouped = {};
  filtered.forEach((log) => {
    if (!grouped[log.date]) grouped[log.date] = [];
    grouped[log.date].push(log);
  });
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  tbody.innerHTML = '';
  if (sortedDates.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px; color:#94a3b8; font-size:13px;">기록이 없습니다.</td></tr>';
    return;
  }

  function buildDateFrag(date) {
    const frag = document.createDocumentFragment();
    const groupLogs = grouped[date];
    const isHoliday = groupLogs.some((l) => l.category === '휴무');
    const isCollapsed = timelineCollapsedDates[date] || false;

    const headerRow = document.createElement('tr');
    headerRow.className = 'nt-tl-date-row' + (isCollapsed ? ' collapsed' : '');
    headerRow.onclick = () => {
      timelineCollapsedDates[date] = !timelineCollapsedDates[date];
      renderTimeLogList();
    };
    headerRow.innerHTML =
      '<td colspan="6"><svg class="nt-tl-date-arrow" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>' +
      date +
      '<span class="nt-tl-date-day">(' +
      getDayKor(date) +
      ')</span>' +
      (isHoliday ? ' <span class="nt-tl-badge nt-tl-badge--holiday">휴무</span>' : '') +
      '</td>';
    frag.appendChild(headerRow);

    if (!isCollapsed) {
      groupLogs.forEach((log) => {
        const realIdx = idxMap.get(log) ?? timeLogs.indexOf(log);
        const row = document.createElement('tr');
        let durationCls = '';
        if (log.min >= 120) durationCls = 'nt-tl-duration nt-tl-duration--danger';
        else if (log.min >= 60) durationCls = 'nt-tl-duration nt-tl-duration--warn';

        const tdCat = document.createElement('td');
        const catSpan = document.createElement('span');
        catSpan.className = 'nt-tl-badge' + (log.category === '휴무' ? ' nt-tl-badge--holiday' : '');
        catSpan.textContent = log.category;
        tdCat.appendChild(catSpan);

        const tdTask = document.createElement('td');
        tdTask.className = 'text-left';
        tdTask.textContent = log.task;
        const tdStart = document.createElement('td');
        tdStart.textContent = log.start;
        const tdEnd = document.createElement('td');
        tdEnd.textContent = log.end;
        const tdDuration = document.createElement('td');
        if (durationCls) {
          const span = document.createElement('span');
          span.className = durationCls;
          span.textContent = log.duration;
          tdDuration.appendChild(span);
        } else {
          tdDuration.textContent = log.duration;
        }
        const tdBtns = document.createElement('td');
        tdBtns.innerHTML =
          '<div class="nt-tl-row-btns">' +
          '<button type="button" class="nt-tl-row-btn" title="수정" onclick="editTimeLog(' + realIdx + ')">' + TL_ICON_EDIT + '</button>' +
          '<button type="button" class="nt-tl-row-btn danger" title="삭제" onclick="deleteTimeLog(' + realIdx + ')">' + TL_ICON_TRASH + '</button>' +
          '</div>';

        row.appendChild(tdCat);
        row.appendChild(tdTask);
        row.appendChild(tdStart);
        row.appendChild(tdEnd);
        row.appendChild(tdDuration);
        row.appendChild(tdBtns);
        frag.appendChild(row);
      });
    }
    return frag;
  }

  // 날짜 그룹이 많아도 한 프레임에 다 그리지 않고 나눠서 렌더(메인스레드 블로킹 분산)
  const CHUNK_SIZE = 5;
  let idx = 0;
  function renderChunk() {
    const frag = document.createDocumentFragment();
    const end = Math.min(idx + CHUNK_SIZE, sortedDates.length);
    for (; idx < end; idx++) frag.appendChild(buildDateFrag(sortedDates[idx]));
    tbody.appendChild(frag);
    if (idx < sortedDates.length) requestAnimationFrame(renderChunk);
  }
  requestAnimationFrame(renderChunk);
};

/* ── 추가/수정/삭제 ── */
window.addTimeLog = async function () {
  const date = document.getElementById('tlDate').value;
  const category = document.getElementById('tlCategory').value;
  const task = document.getElementById('tlTask').value.trim();
  const sh = document.getElementById('tlStartH').value;
  const sm = document.getElementById('tlStartM').value;
  const eh = document.getElementById('tlEndH').value;
  const em = document.getElementById('tlEndM').value;

  if (!date) { showToast('날짜를 선택해주세요.', 'warning'); return; }
  if (!task) { showToast('업무 내용을 입력해주세요.', 'warning'); return; }

  const padTwo = (n) => String(n).padStart(2, '0');
  let start = null, end = null, duration = '0:00', min = 0;
  if (category !== '휴무') {
    if (sh === '' || eh === '') { showToast('시간을 입력해주세요.', 'warning'); return; }
    start = padTwo(sh) + ':' + padTwo(sm || 0);
    end = padTwo(eh) + ':' + padTwo(em || 0);
    const s = new Date('2000-01-01T' + start + ':00');
    const e = new Date('2000-01-01T' + end + ':00');
    const mTotal = Math.max(0, Math.floor((e - s) / 60000));
    duration = Math.floor(mTotal / 60) + ':' + padTwo(mTotal % 60);
    min = mTotal;
  }

  showLoading(editingTimeLogIndex > -1 ? '수정하는 중...' : '등록하는 중...');
  try {
    if (editingTimeLogIndex > -1) {
      const targetId = timeLogs[editingTimeLogIndex].id;
      const { error } = await supabaseClient
        .from('work_timelogs')
        .update({ date, category, task, start_time: start, end_time: end, duration, minutes: min })
        .eq('id', targetId);
      if (error) throw error;
      timeLogs[editingTimeLogIndex] = { id: targetId, date, category, task, start: start || '', end: end || '', duration, min };
      showToast('수정 완료!', 'success');
      cancelTimeLogEdit();
    } else {
      const { data, error } = await supabaseClient
        .from('work_timelogs')
        .insert([{ date, category, task, start_time: start, end_time: end, duration, minutes: min }])
        .select();
      if (error) throw error;
      if (data && data.length > 0) {
        timeLogs.push({ id: data[0].id, date, category, task, start: start || '', end: end || '', duration, min });
        document.getElementById('tlTask').value = '';
        document.getElementById('tlEndH').value = '';
        document.getElementById('tlEndM').value = '';
        updateTlDefaultStartTime();
      }
    }
    delete timelineMonthFillCache[Number(date.slice(0, 4))];
    renderTimeLogList();
    renderTimelineMonthQuick();
  } catch (e) {
    console.error('타임라인 저장 오류:', e);
    showToast('저장 중 오류가 발생했습니다.', 'error');
  } finally {
    hideLoading();
  }
};

window.editTimeLog = function (index) {
  const log = timeLogs[index];
  if (!log) return;
  editingTimeLogIndex = index;
  document.getElementById('tlDate').value = log.date;
  document.getElementById('tlCategory').value = log.category;
  onTlCategoryChange();
  document.getElementById('tlTask').value = log.task;
  if (log.category !== '휴무' && log.start) {
    const [sh, sm] = log.start.split(':');
    const [eh, em] = (log.end || '00:00').split(':');
    document.getElementById('tlStartH').value = sh;
    document.getElementById('tlStartM').value = sm;
    document.getElementById('tlEndH').value = eh;
    document.getElementById('tlEndM').value = em;
  } else {
    ['tlStartH', 'tlStartM', 'tlEndH', 'tlEndM'].forEach((id) => (document.getElementById(id).value = ''));
  }
  document.getElementById('tlEditingMsg').style.display = 'flex';
  document.getElementById('tlAddBtn').textContent = '수정 완료';
  document.getElementById('tlAddBtn').scrollIntoView({ behavior: 'smooth', block: 'center' });
};

window.cancelTimeLogEdit = function () {
  editingTimeLogIndex = -1;
  document.getElementById('tlEditingMsg').style.display = 'none';
  document.getElementById('tlAddBtn').textContent = '+ 등록';
  document.getElementById('tlTask').value = '';
  document.getElementById('tlEndH').value = '';
  document.getElementById('tlEndM').value = '';
  updateTlDefaultStartTime();
};

window.deleteTimeLog = async function (index) {
  if (!confirm('정말 이 기록을 삭제하시겠습니까?')) return;
  const target = timeLogs[index];
  if (!target || !target.id) return;

  showLoading('삭제하는 중...');
  try {
    const { error } = await supabaseClient.from('work_timelogs').delete().eq('id', target.id);
    if (error) throw error;
    timeLogs.splice(index, 1);
    delete timelineMonthFillCache[Number(target.date.slice(0, 4))];
    updateTlDefaultStartTime();
    renderTimeLogList();
    renderTimelineMonthQuick();
  } catch (e) {
    console.error('타임라인 삭제 오류:', e);
    showToast('삭제 중 오류가 발생했습니다.', 'error');
  } finally {
    hideLoading();
  }
};
