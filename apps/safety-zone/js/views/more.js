import { get, set, isPersistent, exportBackup, parseBackup, restoreBackup, resetAll } from '../store.js';
import { DUTIES, statusInfo } from '../data/duties.js';
import { accidentLabel, riskTypeLabel, riskText, DEFAULT_CHECKS } from '../data/hazards.js';
import { DISCLAIMER_FULL, LAW_BASE_DATE, industryLabel } from '../data/legal.js';
import { h, pageHead, field, choiceGroup, button, linkButton, toast, randomId, uid } from '../utils/dom.js';
import { todayStr, inRange } from '../utils/date.js';
import { downloadCsv, downloadJson, printReport } from '../utils/export.js';
import { applyTheme, setThemeSetting } from '../theme.js';
import { dutyState, nextDue, isOverdue } from './duties.js';
import { kindLabel, checkLabel } from './log.js';
import { guideSteps } from './home.js';

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

const BACKUP_LABELS = {
  profile: '사업장',
  duties: '체크리스트',
  risks: '위험성평가',
  logs: 'TBM 기록',
  settings: '설정'
};

const TARGETS = [
  { value: 'duties', label: '이행 체크리스트' },
  { value: 'risks', label: '위험성평가' },
  { value: 'logs', label: 'TBM·점검 기록' }
];

/* ---------- 내보내기용 표 만들기 ---------- */

function dutyReport() {
  const duties = get('duties');
  const today = todayStr();
  const rows = DUTIES.map((duty) => {
    const state = dutyState(duties, duty.id);
    const due = nextDue(duty, state);
    const dueText = due ? `${due}${isOverdue(duty, state, today) ? ' (기한 지남)' : ''}` : (duty.semiannual ? '점검일 미입력' : '반기 점검 대상 아님');
    return [String(duty.no), duty.title, statusInfo(state.status).label, state.lastCheckedAt || '', dueText, state.memo, duty.basis];
  });
  return {
    title: '중대재해처벌법 안전보건관리체계 이행 현황',
    columns: ['번호', '항목', '상태', '최근 점검일', '다음 점검 예정일', '메모', '근거'],
    rows
  };
}

function riskReport(from, to) {
  const rows = get('risks')
    .filter((risk) => inRange(risk.assessedAt, from, to))
    .flatMap((risk) => risk.rows.map((row) => [
      risk.title, risk.assessedAt, riskTypeLabel(risk.type), accidentLabel(row.accidentType), row.hazard,
      row.likelihood ?? '', row.severity ?? '', riskText(row.likelihood, row.severity), row.measure, row.owner,
      row.dueDate || '', row.done ? '완료' : '미완료', riskText(row.afterLikelihood, row.afterSeverity)
    ].map(String)));
  return {
    title: '위험성평가 기록 (빈도×강도 3×3)',
    columns: ['평가명', '평가일', '구분', '재해 형태', '유해·위험요인', '빈도', '강도', '위험성', '감소대책', '담당자', '완료 예정일', '대책 완료', '개선 후 위험성'],
    rows
  };
}

function checkSummary(checks, template) {
  const entries = Object.entries(checks);
  const ok = entries.filter(([, v]) => v).map(([k]) => checkLabel(k, template));
  const no = entries.filter(([, v]) => !v).map(([k]) => checkLabel(k, template));
  return [ok.length ? `✓ ${ok.join(', ')}` : '', no.length ? `✗ ${no.join(', ')}` : ''].filter(Boolean).join(' / ');
}

function logReport(from, to) {
  const template = get('settings').checkTemplate;
  const rows = get('logs')
    .filter((log) => inRange(log.date, from, to))
    .sort((a, b) => (a.date > b.date ? 1 : -1))
    .map((log) => [
      log.date, kindLabel(log.kind), log.work, log.hazards.join(', '), log.measures,
      log.attendees === null ? '' : String(log.attendees), log.attendeeNames, checkSummary(log.checks, template), log.note
    ]);
  return {
    title: 'TBM·안전점검 기록',
    columns: ['날짜', '구분', '작업 내용', '위험요인', '안전대책', '참석 인원', '참석자', '점검 결과', '특이사항'],
    rows
  };
}

function buildReport(target, from, to) {
  if (target === 'risks') return riskReport(from, to);
  if (target === 'logs') return logReport(from, to);
  return dutyReport();
}

/* ---------- 섹션들 ---------- */

function section(id, title, ...children) {
  return h('section', { class: 'card more-section', id: `more-${id}`, 'aria-labelledby': `more-${id}-title` },
    h('h2', { class: 'card-title', id: `more-${id}-title`, text: title }),
    ...children
  );
}

function guideSection() {
  return section('guide', '사용법', ...guideSteps());
}

function profileSection() {
  const profile = get('profile');
  const text = profile
    ? `${profile.name || '내 사업장'} · 상시 ${profile.workers}명 · ${industryLabel(profile.industry)}`
    : '아직 자가진단을 하지 않았습니다.';
  return section('profile', '사업장', h('p', { text }),
    h('div', { class: 'btn-row' },
      linkButton('#/check', profile ? '자가진단 다시 하기' : '자가진단 시작', 'secondary'),
      profile ? linkButton('#/check/result', '결과 보기', 'ghost') : null));
}

function exportSection() {
  const state = { target: 'duties' };
  const from = h('input', { type: 'date' });
  const to = h('input', { type: 'date' });
  const run = (kind) => {
    if (from.value && to.value && from.value > to.value) {
      toast('시작일이 종료일보다 늦습니다.');
      return;
    }
    const usesPeriod = state.target !== 'duties';
    const report = buildReport(state.target, usesPeriod ? from.value : '', usesPeriod ? to.value : '');
    if (kind === 'csv') {
      downloadCsv(`safety-zone-${state.target}-${todayStr()}.csv`, report.columns, report.rows);
      toast('CSV 파일을 내려받았습니다.');
      return;
    }
    const period = usesPeriod && (from.value || to.value) ? `${from.value || '처음'} ~ ${to.value || '마지막 기록'}` : '';
    printReport({ ...report, orgName: get('profile')?.name, period });
  };
  return section('export', '기록 내보내기 (이행 증빙)',
    choiceGroup({ legend: '대상', name: uid('target'), options: TARGETS, value: state.target, onChange: (v) => { state.target = v; } }),
    h('div', { class: 'field-row' }, field({ label: '시작일', control: from, optional: true }), field({ label: '종료일', control: to, optional: true })),
    h('p', { class: 'field-hint', text: '기간은 위험성평가(평가일)와 TBM 기록(날짜)에만 적용됩니다. 비워 두면 기간 제한 없이 모두 내보냅니다.' }),
    h('div', { class: 'btn-row' },
      button('인쇄 (PDF로 저장)', () => run('print'), 'primary'),
      button('CSV 다운로드', () => run('csv'), 'secondary'))
  );
}

async function importFile(file, rerender) {
  if (!file) return;
  if (file.size > MAX_IMPORT_BYTES) {
    toast('파일이 너무 큽니다 (5MB 이하).');
    return;
  }
  try {
    const data = parseBackup(JSON.parse(await file.text()));
    const names = Object.keys(data).map((key) => BACKUP_LABELS[key] || key).join(', ');
    if (!window.confirm(`백업 파일에 있는 항목(${names})을 백업 내용으로 바꿀까요? 이 항목들의 현재 데이터는 사라지고, 나머지는 그대로 둡니다.`)) return;
    restoreBackup(data);
    applyTheme();
    toast('백업을 복원했습니다.');
    rerender();
  } catch (error) {
    toast(error instanceof SyntaxError ? 'JSON 파일 형식이 올바르지 않습니다.' : `가져오기 실패: ${error.message}`);
  }
}

function backupSection(rerender) {
  const fileInput = h('input', { type: 'file', accept: '.json,application/json', class: 'sr-only', id: uid('import') });
  fileInput.addEventListener('change', () => {
    importFile(fileInput.files[0], rerender);
    fileInput.value = '';
  });
  const reset = () => {
    if (!window.confirm('모든 기록(사업장·체크리스트·위험성평가·TBM·설정)을 지울까요? 되돌릴 수 없으니 먼저 백업을 권장합니다.')) return;
    resetAll();
    applyTheme();
    toast('모든 데이터를 지웠습니다.');
    rerender();
  };
  return section('backup', '백업·복원',
    h('p', { class: 'small', text: '데이터는 이 브라우저에만 저장됩니다. 기기를 바꾸거나 브라우저 데이터를 지우기 전에 백업하세요.' }),
    h('div', { class: 'btn-row' },
      button('전체 백업 (JSON) 내보내기', () => downloadJson(`safety-zone-backup-${todayStr()}.json`, exportBackup()), 'primary'),
      h('label', { class: 'btn btn-secondary', for: fileInput.id, tabindex: '0', role: 'button',
        onKeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } } }, '백업 가져오기'),
      fileInput),
    h('div', { class: 'danger-zone' }, button('모든 데이터 초기화', reset, 'danger'))
  );
}

function saveTemplate(template) {
  const settings = get('settings');
  settings.checkTemplate = template;
  set('settings', settings);
}

function templateRow(item, index, refresh) {
  const input = h('input', { type: 'text', maxlength: '60', value: item.label, 'aria-label': `점검 항목 ${index + 1} 이름` });
  input.addEventListener('input', () => {
    const template = get('settings').checkTemplate;
    if (template[index]) template[index].label = input.value;
    saveTemplate(template);
  });
  const remove = () => {
    saveTemplate(get('settings').checkTemplate.filter((_, i) => i !== index));
    refresh();
  };
  return h('li', { class: 'template-row' }, input, button('삭제', remove, 'ghost', { 'aria-label': `${item.label} 삭제` }));
}

function templateEditor() {
  const list = h('ul', { class: 'template-list' });
  const refresh = () => list.replaceChildren(...get('settings').checkTemplate.map((item, i) => templateRow(item, i, refresh)));
  const newInput = h('input', { type: 'text', maxlength: '60', placeholder: '예: 고소작업대 점검' });
  const add = () => {
    const label = newInput.value.trim();
    if (!label) return;
    saveTemplate([...get('settings').checkTemplate, { key: randomId('c'), label }]);
    newInput.value = '';
    refresh();
  };
  const restore = () => {
    if (!window.confirm('점검 항목을 기본값으로 되돌릴까요?')) return;
    saveTemplate(DEFAULT_CHECKS.map((item) => ({ ...item })));
    refresh();
  };
  refresh();
  return h('div', {},
    h('h3', { class: 'sub-title', text: 'TBM 점검 항목' }),
    list,
    h('div', { class: 'inline-form' }, field({ label: '항목 추가', control: newInput }), button('추가', add, 'secondary')),
    button('기본값으로 되돌리기', restore, 'ghost')
  );
}

function settingsSection() {
  const select = h('select', { value: get('settings').theme, onChange: (e) => setThemeSetting(e.target.value) },
    h('option', { value: 'system', text: '기기 설정 따르기' }),
    h('option', { value: 'light', text: '라이트' }),
    h('option', { value: 'dark', text: '다크' }));
  return section('settings', '설정', field({ label: '화면 테마', control: select }), templateEditor());
}

function storageSection() {
  const ok = isPersistent();
  return section('storage', '저장 상태',
    h('p', { class: ok ? 'small' : 'alert alert-warn', text: ok
      ? '이 브라우저의 저장소(localStorage)에 저장되고 있습니다. 외부로 전송되지 않습니다.'
      : '브라우저 저장소를 쓸 수 없어 임시(메모리)로만 동작합니다. 창을 닫으면 사라지니 백업을 내려받으세요.' }));
}

function disclaimerSection() {
  return section('disclaimer', '면책 고지',
    ...DISCLAIMER_FULL.map((text) => h('p', { text })),
    h('p', { class: 'muted small', text: `법령 기준일: ${LAW_BASE_DATE} 기준` })
  );
}

function scrollToSection(sectionId) {
  if (!sectionId) return;
  requestAnimationFrame(() => document.getElementById(`more-${sectionId}`)?.scrollIntoView({ block: 'start' }));
}

export function renderMore(root, params = {}) {
  const rerender = () => {
    root.replaceChildren();
    renderMore(root, {});
  };
  root.append(
    pageHead('더보기'),
    guideSection(),
    profileSection(),
    exportSection(),
    backupSection(rerender),
    settingsSection(),
    storageSection(),
    disclaimerSection(),
    h('p', { class: 'center' }, h('a', { class: 'btn btn-ghost', href: '../../', text: '← 블로그로 돌아가기' }))
  );
  scrollToSection(params.section);
  return '더보기';
}
