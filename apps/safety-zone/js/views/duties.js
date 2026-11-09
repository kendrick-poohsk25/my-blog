import { get, set } from '../store.js';
import { DUTIES, STATUSES, statusInfo, findDuty, AUTO_ORG_MEMO } from '../data/duties.js';
import { h, pageHead, field, choiceGroup, badge, progressBar, uid } from '../utils/dom.js';
import { addMonths, todayStr, nowIso } from '../utils/date.js';

/* ---------- 계산(홈·내보내기에서도 사용) ---------- */

export function dutyState(duties, id) {
  return duties.items[id] || { status: 'todo', memo: '', lastCheckedAt: null };
}

export function nextDue(duty, state) {
  return duty.semiannual && state.lastCheckedAt ? addMonths(state.lastCheckedAt, 6) : null;
}

export function isOverdue(duty, state, today = todayStr()) {
  const due = nextDue(duty, state);
  return state.status !== 'na' && due !== null && due < today;
}

export function computeDutyStats(duties) {
  const today = todayStr();
  let done = 0;
  let na = 0;
  let overdue = 0;
  DUTIES.forEach((duty) => {
    const state = dutyState(duties, duty.id);
    if (state.status === 'done') done += 1;
    if (state.status === 'na') na += 1;
    if (isOverdue(duty, state, today)) overdue += 1;
  });
  const denom = DUTIES.length - na;
  const percent = denom > 0 ? Math.round((done / denom) * 100) : 0;
  return { done, na, denom, percent, overdue };
}

/* ---------- 목록 화면 ---------- */

function statusBadge(status) {
  const info = statusInfo(status);
  return badge(`${info.icon} ${info.label}`, info.tone);
}

function dueLine(duty, state) {
  if (!duty.semiannual) return null;
  if (state.status === 'na') return null;
  const due = nextDue(duty, state);
  if (!due) return h('span', { class: 'duty-meta', text: '반기 점검 · 최근 점검일 미입력' });
  if (isOverdue(duty, state)) {
    return h('span', { class: 'duty-meta' }, badge('⚠ 점검 기한 지남', 'danger'), ` 예정일 ${due}`);
  }
  return h('span', { class: 'duty-meta', text: `다음 점검 ${due}` });
}

function dutyListItem(duties, duty) {
  const state = dutyState(duties, duty.id);
  return h('li', {},
    h('a', { class: 'list-card duty-item', href: `#/duties/${duty.id}` },
      h('span', { class: 'duty-no', 'aria-hidden': 'true', text: String(duty.no) }),
      h('span', { class: 'duty-main' },
        h('span', { class: 'duty-title', text: duty.title }),
        dueLine(duty, state)
      ),
      statusBadge(state.status)
    )
  );
}

function summaryCard(stats) {
  return h('section', { class: 'card', 'aria-label': '이행 진척률' },
    h('div', { class: 'stat-row' },
      h('span', { class: 'stat-label', text: '안전보건관리체계' }),
      h('span', { class: 'stat-value', text: `${stats.done}/${stats.denom}` })
    ),
    progressBar(stats.percent, '관리체계 이행률'),
    h('p', { class: 'muted small', text: `이행률 ${stats.percent}% · '해당 없음' ${stats.na}개는 계산에서 뺍니다.` }),
    stats.overdue > 0 ? h('p', { class: 'alert alert-danger', text: `⚠ 반기 점검 기한이 지난 항목 ${stats.overdue}개` }) : null
  );
}

function scopeNotice() {
  const profile = get('profile');
  if (!profile || !profile.result) {
    return h('p', { class: 'alert alert-info' }, '자가진단을 먼저 하면 사업장에 맞게 표시됩니다. ', h('a', { href: '#/check', text: '자가진단 하기' }));
  }
  if (!profile.result.seriousAccidentAct) {
    return h('p', { class: 'alert alert-info', text: '자가진단 결과 중대재해처벌법 적용 제외 사업장으로 나왔습니다. 체크리스트는 참고용으로 활용하세요.' });
  }
  return null;
}

export function renderDuties(root) {
  const duties = get('duties');
  root.append(
    pageHead('이행 체크리스트'),
    h('p', { class: 'muted', text: '중대재해처벌법 시행령 제4조의 안전보건관리체계 9개 항목과 제5조 점검 항목입니다.' }),
    scopeNotice(),
    summaryCard(computeDutyStats(duties)),
    h('ul', { class: 'card-list' }, DUTIES.map((duty) => dutyListItem(duties, duty)))
  );
  return '이행 체크리스트';
}

/* ---------- 상세(편집) 화면 ---------- */

function saveDuty(id, patch) {
  const duties = get('duties');
  const next = { ...dutyState(duties, id), ...patch };
  // 사용자가 상태를 직접 바꾸면 자동 표시를 풀고, 손대지 않은 자동 메모도 함께 지웁니다.
  if ('status' in patch && next.autoNa) {
    delete next.autoNa;
    if (next.memo === AUTO_ORG_MEMO) next.memo = '';
  }
  duties.items[id] = next;
  duties.updatedAt = nowIso();
  set('duties', duties);
  return duties.items[id];
}

function infoList(duty) {
  return h('dl', { class: 'info-list' },
    h('dt', { text: '근거' }), h('dd', { text: duty.basis }),
    h('dt', { text: '점검 주기' }), h('dd', { text: duty.semiannual ? '반기 1회 이상' : '정해진 주기 없음(수시 관리)' })
  );
}

function dueOutput(duty, state) {
  const el = h('p', { class: 'due-output', 'aria-live': 'polite' });
  const update = (current) => {
    const due = nextDue(duty, current);
    el.replaceChildren();
    if (!duty.semiannual) return;
    if (!due) el.append('최근 점검일을 넣으면 다음 점검 예정일(6개월 뒤)을 계산합니다.');
    else if (isOverdue(duty, current)) el.append(badge('⚠ 점검 기한 지남', 'danger'), ` 다음 점검 예정일 ${due}`);
    else el.append(`다음 점검 예정일 ${due}`);
  };
  update(state);
  return { el, update };
}

function savedHint() {
  return h('p', { class: 'muted small', 'aria-live': 'polite', text: '변경 내용은 자동으로 저장됩니다.' });
}

export function renderDutyDetail(root, { id }) {
  const duty = findDuty(id);
  if (!duty) {
    root.append(pageHead('항목을 찾을 수 없습니다', '#/duties', '목록'), h('p', { text: '체크리스트에 없는 항목입니다.' }));
    return '찾을 수 없음';
  }
  const state = dutyState(get('duties'), id);
  const due = dueOutput(duty, state);
  const hint = savedHint();
  let memo = null;
  const persist = (patch) => {
    const saved = saveDuty(id, patch);
    due.update(saved);
    if (memo && memo.value !== saved.memo) memo.value = saved.memo;
    hint.textContent = '저장했습니다.';
  };
  memo = h('textarea', { rows: '3', value: state.memo, onInput: (e) => persist({ memo: e.target.value }) });
  const checked = h('input', { type: 'date', value: state.lastCheckedAt || '', max: todayStr(), onChange: (e) => persist({ lastCheckedAt: e.target.value || null }) });
  root.append(
    pageHead(`${duty.no}. ${duty.title}`, '#/duties', '목록'),
    h('p', { class: 'lead', text: duty.plain }),
    duty.note ? h('p', { class: 'alert alert-info', text: duty.note }) : null,
    infoList(duty),
    h('section', { class: 'card form-card', 'aria-label': '이행 상태 편집' },
      choiceGroup({
        legend: '상태',
        name: uid('status'),
        options: STATUSES.map((s) => ({ value: s.value, label: `${s.icon} ${s.label}` })),
        value: state.status,
        variant: 'grid',
        onChange: (value) => persist({ status: value })
      }),
      field({ label: '메모 (증빙 위치·담당자)', control: memo, optional: true }),
      field({ label: '최근 점검일', control: checked, optional: true }),
      due.el,
      hint
    )
  );
  return duty.title;
}
