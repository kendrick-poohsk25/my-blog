import { initStore, get, set, isPersistent, onStatusChange } from './store.js';
import { initTheme } from './theme.js';
import { startRouter } from './router.js';
import { h, pageHead, linkButton } from './utils/dom.js';
import { nowIso } from './utils/date.js';
import { DISCLAIMER_FULL } from './data/legal.js';
import { renderHome } from './views/home.js';
import { renderCheck, renderCheckResult } from './views/check.js';
import { renderDuties, renderDutyDetail } from './views/duties.js';
import { renderRisks, renderRiskDetail } from './views/risk.js';
import { renderLogs, renderLogEditor } from './views/log.js';
import { renderMore } from './views/more.js';

const ROUTES = [
  { pattern: '', view: renderHome, tab: 'home' },
  { pattern: 'check', view: renderCheck, tab: 'home' },
  { pattern: 'check/result', view: renderCheckResult, tab: 'home' },
  { pattern: 'duties', view: renderDuties, tab: 'duties' },
  { pattern: 'duties/:id', view: renderDutyDetail, tab: 'duties' },
  { pattern: 'risk', view: renderRisks, tab: 'risk' },
  { pattern: 'risk/:id', view: renderRiskDetail, tab: 'risk' },
  { pattern: 'log', view: renderLogs, tab: 'log' },
  { pattern: 'log/:date', view: renderLogEditor, tab: 'log' },
  { pattern: 'more', view: renderMore, tab: 'more' },
  { pattern: 'more/:section', view: renderMore, tab: 'more' }
];

let firstRender = true;

function renderNotFound(root) {
  root.append(
    pageHead('페이지를 찾을 수 없습니다'),
    h('p', { text: '주소가 잘못되었거나 삭제된 항목입니다.' }),
    linkButton('#/', '홈으로')
  );
  return '찾을 수 없음';
}

function updateTabs(tab) {
  document.querySelectorAll('.tabbar a[data-tab]').forEach((link) => {
    if (link.dataset.tab === tab) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

// 화면 전환을 스크린리더 사용자도 알 수 있도록 새 화면의 제목으로 포커스를 옮깁니다.
function focusHeading(root) {
  const heading = root.querySelector('h1');
  if (heading) heading.focus({ preventScroll: true });
}

function renderRoute({ route, params }) {
  const root = document.getElementById('view');
  root.replaceChildren();
  const view = route ? route.view : renderNotFound;
  const title = view(root, params) || '안전지대';
  document.title = title === '안전지대' ? title : `${title} · 안전지대`;
  updateTabs(route ? route.tab : null);
  window.scrollTo(0, 0);
  if (!firstRender) focusHeading(root);
  firstRender = false;
}

function updateStorageBanner() {
  const banner = document.getElementById('storage-banner');
  if (banner) banner.hidden = isPersistent();
}

function acceptDisclaimer(dialog) {
  const meta = get('meta');
  meta.disclaimerAcceptedAt = nowIso();
  set('meta', meta);
  if (typeof dialog.close === 'function' && dialog.open) dialog.close();
  else dialog.removeAttribute('open');
}

function openDialog(dialog) {
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function showDisclaimer() {
  const dialog = document.getElementById('disclaimer-dialog');
  if (!dialog) return;
  const body = dialog.querySelector('.dialog-body');
  body.replaceChildren(...DISCLAIMER_FULL.map((text) => h('p', { text })));
  dialog.querySelector('[data-accept]').addEventListener('click', () => acceptDisclaimer(dialog));
  // 확인 버튼을 눌러야만 사용할 수 있도록 Esc로 닫히는 것을 막습니다.
  dialog.addEventListener('cancel', (event) => event.preventDefault());
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') event.preventDefault();
  });
  // 일부 브라우저는 Esc를 연달아 누르면 cancel을 막아도 닫으므로, 동의 없이 닫히면 다시 엽니다.
  dialog.addEventListener('close', () => {
    if (!get('meta').disclaimerAcceptedAt) openDialog(dialog);
  });
  openDialog(dialog);
}

function setupSkipLink() {
  const link = document.querySelector('.skip-link');
  if (!link) return;
  link.addEventListener('click', (event) => {
    event.preventDefault();
    document.getElementById('view').focus();
  });
}

function init() {
  initStore();
  initTheme(document.getElementById('theme-toggle'));
  updateStorageBanner();
  onStatusChange(updateStorageBanner);
  setupSkipLink();
  startRouter(ROUTES, renderRoute);
  if (!get('meta').disclaimerAcceptedAt) showDisclaimer();
}

init();
