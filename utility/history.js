/* ─────────────────────────────────────────
   ENERGUARD LAB — calculator history compatibility shim
   ───────────────────────────────────────── */

'use strict';

try {
  localStorage.removeItem('kankan_history');
} catch(e) {}

const KankanHistory = {
  isRestoring: false,
  save() {},
  load() { return []; },
  remove() {},
  clear() {},
  restoreForm() {},
  renderPanel() {},
  renderClearBtn() {},
};
