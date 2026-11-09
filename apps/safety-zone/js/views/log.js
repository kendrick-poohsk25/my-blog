import { get, set } from '../store.js';
import { DEFAULT_CHECKS, riskScore, riskLevel } from '../data/hazards.js';
import { h, pageHead, field, choiceGroup, button, emptyState, linkButton, toast, uid } from '../utils/dom.js';
import { todayStr, formatKoreanDate, isValidDateStr, nowIso } from '../utils/date.js';
import { navigate } from '../router.js';

const KINDS = [
  { value: 'tbm', label: 'TBM (작업 전 안전점검회의)' },
  { value: 'inspection', label: '안전점검' }
];

export function kindLabel(value) {
  return value === 'inspection' ? '안전점검' : 'TBM';
}

export function findLog(logs, date) {
  return logs.find((log) => log.date === date) || null;
}

// 템플릿에서 지운 항목도 예전 기록에서는 이름이 보이도록 기본 목록까지 찾아봅니다.
export function checkLabel(key, template) {
  const found = template.find((item) => item.key === key) || DEFAULT_CHECKS.find((item) => item.key === key);
  return found ? found.label : key;
}

/* ---------- 목록 화면 ---------- */

function logListItem(log) {
  const values = Object.values(log.checks);
  const passed = values.filter(Boolean).length;
  const meta = [kindLabel(log.kind), log.attendees !== null ? `${log.attendees}명` : null, values.length ? `점검 ${passed}/${values.length}` : null]
    .filter(Boolean).join(' · ');
  return h('li', {},
    h('a', { class: 'list-card', href: `#/log/${log.date}`, 'aria-label': `${formatKoreanDate(log.date)} ${kindLabel(log.kind)} 기록 열기` },
      h('span', { class: 'duty-main' },
        h('span', { class: 'duty-title' }, h('time', { datetime: log.date, text: formatKoreanDate(log.date) })),
        h('span', { class: 'duty-meta', text: meta }),
        log.work ? h('span', { class: 'duty-meta', text: log.work }) : null
      )
    )
  );
}

function jumpForm() {
  const input = h('input', { type: 'date', name: 'date', value: todayStr(), required: true });
  const form = h('form', { class: 'inline-form', 'aria-label': '다른 날짜 기록' },
    field({ label: '다른 날짜 기록·보기', control: input }),
    h('button', { type: 'submit', class: 'btn btn-secondary', text: '이동' })
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (isValidDateStr(input.value)) navigate(`log/${input.value}`);
  });
  return form;
}

export function renderLogs(root) {
  const logs = get('logs');
  const today = todayStr();
  const hasToday = Boolean(findLog(logs, today));
  root.append(
    pageHead('TBM·점검 기록'),
    h('p', { class: 'muted', text: 'TBM은 법정 의무는 아니지만, 위험성평가 결과를 근로자와 공유하는 방법으로 권장됩니다. 하루 1건씩 기록합니다.' }),
    h('div', { class: 'card' },
      h('p', { class: 'stat-label', text: `오늘 ${formatKoreanDate(today)}` }),
      linkButton(`#/log/${today}`, hasToday ? '✓ 오늘 기록 보기·수정' : '오늘 기록하기 →', hasToday ? 'secondary' : 'primary')
    ),
    jumpForm(),
    h('h2', { class: 'section-title', text: `기록 목록 (${logs.length}건)` }),
    logs.length
      ? h('ul', { class: 'card-list' }, logs.map(logListItem))
      : emptyState('아직 기록이 없습니다.')
  );
  return 'TBM·점검 기록';
}

/* ---------- 작성/편집 화면 ---------- */

function blankLog(date, template) {
  return {
    id: `l_${date}_1`, date, kind: 'tbm', work: '', hazards: [], measures: '', attendees: null,
    attendeeNames: '', checks: Object.fromEntries(template.map((item) => [item.key, false])), note: '', createdAt: null
  };
}

function riskCandidates() {
  return get('risks').flatMap((risk) => risk.rows
    .filter((row) => row.hazard.trim())
    .map((row) => ({ risk, row, level: riskLevel(riskScore(row.likelihood, row.severity)) })));
}

function hazardChips(draft, rerender) {
  if (!draft.hazards.length) return h('p', { class: 'muted small', text: '아직 추가한 위험요인이 없습니다.' });
  return h('ul', { class: 'chips', 'aria-label': '오늘의 위험요인' }, draft.hazards.map((text, i) => h('li', { class: 'chip chip-static' },
    h('span', { text }),
    h('button', {
      type: 'button', class: 'chip-remove', 'aria-label': `${text} 삭제`, text: '×',
      onClick: () => { draft.hazards.splice(i, 1); rerender(); }
    })
  )));
}

function addHazard(draft, text, measuresEl, measure) {
  const value = text.trim();
  if (!value || draft.hazards.includes(value)) return false;
  draft.hazards.push(value);
  // 위험성평가의 감소대책을 함께 옮겨 두면 TBM에서 바로 공유할 수 있습니다.
  if (measure && !measuresEl.value.includes(measure)) {
    measuresEl.value = measuresEl.value ? `${measuresEl.value}\n· ${measure}` : `· ${measure}`;
  }
  return true;
}

function importPanel(draft, measuresEl, rerender) {
  const candidates = riskCandidates();
  const panel = h('details', { class: 'examples' }, h('summary', { text: '위험성평가에서 불러오기' }));
  if (!candidates.length) {
    panel.append(h('p', { class: 'muted small' }, '불러올 위험요인이 없습니다. ', h('a', { href: '#/risk', text: '위험성평가 작성하기' })));
    return panel;
  }
  panel.append(h('ul', { class: 'pick-list' }, candidates.map(({ risk, row, level }) => h('li', {},
    h('button', {
      type: 'button',
      class: 'pick-item',
      onClick: () => { if (addHazard(draft, row.hazard, measuresEl, row.measure)) rerender(); else toast('이미 추가된 위험요인입니다.'); }
    },
    h('span', { text: row.hazard }),
    h('span', { class: 'muted small', text: `${risk.title}${level ? ` · ${level.icon} ${level.label}` : ''}${row.done ? ' · 대책 완료' : ''}` }))
  ))));
  return panel;
}

function manualHazard(draft, measuresEl, rerender) {
  const input = h('input', { type: 'text', maxlength: '500', placeholder: '직접 입력' });
  const add = () => {
    if (addHazard(draft, input.value, measuresEl, '')) {
      input.value = '';
      rerender();
    }
    input.focus();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); add(); }
  });
  return h('div', { class: 'inline-form' }, field({ label: '위험요인 직접 추가', control: input }), button('추가', add, 'secondary'));
}

function hazardSection(draft, measuresEl) {
  const chipsBox = h('div', { 'aria-live': 'polite' });
  const rerender = () => chipsBox.replaceChildren(hazardChips(draft, rerender));
  rerender();
  return h('fieldset', { class: 'choice-group' },
    h('legend', { class: 'field-label', text: '오늘의 위험요인' }),
    chipsBox,
    importPanel(draft, measuresEl, rerender),
    manualHazard(draft, measuresEl, rerender)
  );
}

function checksSection(draft, template) {
  return choiceGroup({
    legend: '점검 항목',
    name: uid('checks'),
    type: 'checkbox',
    options: template.map((item) => ({ value: item.key, label: item.label })),
    value: template.filter((item) => draft.checks[item.key]).map((item) => item.key),
    hint: '점검 항목은 더보기 화면에서 바꿀 수 있습니다.',
    onChange: (key, checked) => { draft.checks[key] = checked; }
  });
}

function readForm(draft, els) {
  const count = els.attendees.value.trim();
  return {
    ...draft,
    hazards: [...draft.hazards],
    work: els.work.value,
    measures: els.measures.value,
    attendees: count === '' ? null : Math.max(0, Math.floor(Number(count)) || 0),
    attendeeNames: els.names.value,
    note: els.note.value,
    createdAt: draft.createdAt || nowIso()
  };
}

function saveLog(record) {
  const others = get('logs').filter((log) => log.date !== record.date);
  set('logs', [record, ...others]);
}

function deleteLog(date) {
  if (!window.confirm(`${date} 기록을 삭제할까요? 되돌릴 수 없습니다.`)) return;
  set('logs', get('logs').filter((log) => log.date !== date));
  toast('기록을 삭제했습니다.');
  navigate('log');
}

function formControls(draft) {
  return {
    work: h('input', { type: 'text', maxlength: '500', value: draft.work, placeholder: '예: 프레스 금형 교체, 2층 슬래브 거푸집 설치' }),
    measures: h('textarea', { rows: '3', value: draft.measures }),
    attendees: h('input', { type: 'number', min: '0', max: '9999', step: '1', inputmode: 'numeric', value: draft.attendees ?? '' }),
    names: h('input', { type: 'text', maxlength: '500', value: draft.attendeeNames, autocomplete: 'off' }),
    note: h('textarea', { rows: '3', value: draft.note })
  };
}

export function renderLogEditor(root, { date }) {
  if (!isValidDateStr(date)) {
    root.append(pageHead('날짜가 올바르지 않습니다', '#/log', '목록'), h('p', { text: '기록 목록에서 다시 선택하세요.' }));
    return '찾을 수 없음';
  }
  const template = get('settings').checkTemplate;
  const existing = findLog(get('logs'), date);
  const draft = existing || blankLog(date, template);
  template.forEach((item) => {
    if (!(item.key in draft.checks)) draft.checks[item.key] = false;
  });
  const els = formControls(draft);
  const form = h('form', { class: 'card form-card', novalidate: true },
    choiceGroup({ legend: '구분', name: uid('kind'), options: KINDS, value: draft.kind, variant: 'grid', onChange: (v) => { draft.kind = v; } }),
    field({ label: '작업 내용', control: els.work }),
    hazardSection(draft, els.measures),
    field({ label: '안전대책', control: els.measures }),
    field({ label: '참석 인원 (명)', control: els.attendees }),
    field({ label: '참석자 이름', optional: true, control: els.names, hint: '개인정보를 줄이려면 비워 두세요. 이 기기에만 저장됩니다.' }),
    checksSection(draft, template),
    field({ label: '특이사항', optional: true, control: els.note }),
    h('button', { type: 'submit', class: 'btn btn-primary btn-block', text: '저장' })
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    saveLog(readForm(draft, els));
    toast('기록을 저장했습니다.');
    navigate('log');
  });
  root.append(
    pageHead(`${formatKoreanDate(date)} 기록`, '#/log', '목록'),
    existing ? null : h('p', { class: 'muted', text: '새 기록입니다. 저장 버튼을 눌러야 저장됩니다.' }),
    form,
    existing ? h('div', { class: 'danger-zone' }, button('이 기록 삭제', () => deleteLog(date), 'danger')) : null
  );
  return `${date} 기록`;
}
