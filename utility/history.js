/* ─────────────────────────────────────────
   ENERGUARD LAB — calculator history compatibility shim
   ───────────────────────────────────────── */

'use strict';

try {
  localStorage.removeItem('energuard_utility_history');
} catch(e) {}

const UtilityHistory = {
  isRestoring: false,
  save() {},
  load() { return []; },
  remove() {},
  clear() {},
  restoreForm() {},
  renderPanel() {},
  renderClearBtn() {},
};

window.UtilityHistory = UtilityHistory;
