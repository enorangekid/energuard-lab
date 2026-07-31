/* ================================================================
   admin/work-notes.js — 업무노트 (Admin_backup js/notes.js 이식)
   의존성: admin-common.js(supabaseClient), common.js(showToast, AI_CHAT_URL)
   테이블: work_notes (authenticated 전용 RLS)
   ================================================================ */

let currentNoteTab = 'general';
let currentNoteId = null;
let currentNoteMonth = '';
let noteOriginalContent = '';
let noteAutoSaveTimer = null;

function initWorkNotesPage() {
  const now = new Date();
  document.getElementById('noteMonthPicker').value =
    now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  initQuill();
  setNoteTab('general');
}
window.initWorkNotesPage = initWorkNotesPage;

window.setNoteTab = function (tab) {
  currentNoteTab = tab;
  document.querySelectorAll('.nt-tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));

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
    handleNoteMonthChange();
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
    setSaveStatus('최신 상태');
  } catch (e) {
    console.error('노트 로드 실패:', e);
    showToast('원고 데이터를 불러오지 못했습니다.', 'error');
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
  Size.whitelist = ['14px', '16px', '18px'];
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
  const icons = {
    image:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M21 16l-4.2-4.2a2 2 0 0 0-2.8 0L8 18"/></svg>',
    blockquote:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 10H5a4 4 0 0 1 4-4"/><path d="M19 10h-4a4 4 0 0 1 4-4"/><path d="M5 10v7h6v-7"/><path d="M15 10v7h6v-7"/></svg>',
    divider:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16"/></svg>',
    'table-insert':
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16M15 4v16"/></svg>',
    bold:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 5h6a4 4 0 0 1 0 8H7z"/><path d="M7 13h7a4 4 0 0 1 0 8H7z"/></svg>',
    italic:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M10 5h8M6 19h8M14 5 10 19"/></svg>',
    underline:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M7 4v7a5 5 0 0 0 10 0V4"/><path d="M5 21h14"/></svg>',
    'ordered-list':
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 5h1v3M4 11h2l-2 3h2M4 17h2v3H4"/></svg>',
    'bullet-list':
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M10 6h10M10 12h10M10 18h10"/><circle cx="5" cy="6" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="18" r="1"/></svg>',
    clean:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5h11M10.5 5 8 19M5 19h8"/><path d="m15 14 5 5M20 14l-5 5"/></svg>',
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
