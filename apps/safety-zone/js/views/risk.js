import { get, set } from '../store.js';
import {
  ACCIDENT_TYPES, accidentExamples, LIKELIHOOD_OPTIONS, SEVERITY_OPTIONS,
  RISK_TYPES, riskTypeLabel, RISK_LEVELS, riskScore, riskLevel
} from '../data/hazards.js';
import { h, pageHead, field, choiceGroup, badge, button, emptyState, randomId, toast } from '../utils/dom.js';
import { todayStr } from '../utils/date.js';
import { navigate } from '../router.js';

/* ---------- 계산(홈·기록·내보내기에서도 사용) ---------- */

export function isOpenHigh(row) {
  const level = riskLevel(riskScore(row.likelihood, row.severity));
  return Boolean(level && level.id === 'high' && !row.done);
}

export function countOpenHighRisks(risks) {
  return risks.reduce((sum, risk) => sum + risk.rows.filter(isOpenHigh).length, 0);
}

export function riskBadge(likelihood, severity, prefix = '위험성') {
  const score = riskScore(likelihood, severity);
  const level = riskLevel(score);
  if (!level) return badge(`${prefix} · 빈도·강도 선택 필요`, 'muted');
  return badge(`${prefix} ${score} ${level.icon} ${level.label}`, level.tone);
}

function findRisk(risks, id) {
  return risks.find((risk) => risk.id === id) || null;
}

function updateRisk(id, mutate) {
  const risks = get('risks');
  const risk = findRisk(risks, id);
  if (!risk) return null;
  mutate(risk);
  set('risks', risks);
  return risk;
}

/* ---------- 목록 화면 ---------- */

function scaleGuide() {
  const cell = (l, s) => {
    const level = riskLevel(l * s);
    return h('td', { class: `cell-${level.tone}`, text: `${l * s} ${level.icon}` });
  };
  return h('details', { class: 'card guide' },
    h('summary', { text: '3×3 빈도×강도 방식 안내' }),
    h('p', { text: '위험성 = 가능성(빈도) × 중대성(강도). 1~2점 낮음, 3~4점 보통, 6~9점 높음으로 봅니다.' }),
    h('div', { class: 'table-wrap' },
      h('table', { class: 'matrix' },
        h('caption', { class: 'sr-only', text: '빈도와 강도에 따른 위험성 점수표' }),
        h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: '빈도＼강도' }), SEVERITY_OPTIONS.map((s) => h('th', { scope: 'col', text: `${s.value} ${s.desc}` })))),
        h('tbody', {}, LIKELIHOOD_OPTIONS.map((l) => h('tr', {},
          h('th', { scope: 'row', text: `${l.value} ${l.desc}` }),
          SEVERITY_OPTIONS.map((s) => cell(l.value, s.value))
        )))
      )
    ),
    h('p', { class: 'muted small', text: RISK_LEVELS.map((lv) => `${lv.icon} ${lv.label}`).join(' · ') })
  );
}

function createRisk(form) {
  const data = new FormData(form);
  const title = String(data.get('title') || '').trim();
  if (!title) {
    toast('작업·공정 이름을 입력하세요.');
    form.elements.title.focus();
    return;
  }
  const risk = {
    id: randomId('r'),
    title,
    assessedAt: String(data.get('assessedAt') || todayStr()),
    type: String(data.get('type') || 'regular'),
    rows: []
  };
  set('risks', [risk, ...get('risks')]);
  navigate(`risk/${risk.id}`);
}

function addForm() {
  const typeSelect = h('select', { name: 'type', value: 'regular' }, RISK_TYPES.map((t) => h('option', { value: t.value, text: t.label })));
  const form = h('form', { class: 'card form-card', 'aria-label': '평가 추가', novalidate: true },
    h('h2', { class: 'card-title', text: '평가 추가' }),
    field({ label: '작업·공정 이름', control: h('input', { type: 'text', name: 'title', maxlength: '100', required: true, placeholder: '예: 프레스 작업, 외부 비계 설치' }) }),
    field({ label: '평가일', control: h('input', { type: 'date', name: 'assessedAt', value: todayStr() }) }),
    field({ label: '평가 구분', control: typeSelect, hint: '최초평가, 매년 정기평가, 설비·공정 변경 등이 있을 때 수시평가를 합니다.' }),
    h('button', { type: 'submit', class: 'btn btn-primary', text: '평가 만들기' })
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    createRisk(form);
  });
  return form;
}

function riskListItem(risk) {
  const high = risk.rows.filter(isOpenHigh).length;
  return h('li', {},
    h('a', { class: 'list-card', href: `#/risk/${risk.id}` },
      h('span', { class: 'duty-main' },
        h('span', { class: 'duty-title', text: risk.title || '(제목 없음)' }),
        h('span', { class: 'duty-meta', text: `${risk.assessedAt} · ${riskTypeLabel(risk.type)} · 위험요인 ${risk.rows.length}개` })
      ),
      high > 0 ? badge(`▲ 높음 미조치 ${high}`, 'danger') : null
    )
  );
}

export function renderRisks(root) {
  const risks = get('risks');
  root.append(
    pageHead('위험성평가'),
    h('p', { class: 'muted', text: '일터의 위험요인을 찾고, 얼마나 위험한지 따져서, 줄이는 대책을 기록합니다(산업안전보건법 제36조).' }),
    scaleGuide(),
    addForm(),
    h('h2', { class: 'section-title', text: '평가 목록' }),
    risks.length
      ? h('ul', { class: 'card-list' }, risks.map(riskListItem))
      : emptyState('아직 위험성평가가 없습니다. 위에서 평가를 추가하세요.')
  );
  return '위험성평가';
}

/* ---------- 상세(표 편집) 화면 ---------- */

function newRow() {
  return {
    id: randomId('h'), hazard: '', accidentType: 'fall', likelihood: null, severity: null,
    measure: '', owner: '', dueDate: null, done: false, afterLikelihood: null, afterSeverity: null
  };
}

function scaleGroup(legend, name, options, value, onChange) {
  return choiceGroup({
    legend,
    name,
    options: options.map((o) => ({ value: o.value, label: o.label, desc: o.desc })),
    value,
    variant: 'segmented',
    onChange
  });
}

function exampleList(type, onPick) {
  return h('div', { class: 'chips' }, accidentExamples(type).map((text) => h('button', {
    type: 'button',
    class: 'chip',
    onClick: () => onPick(text)
  }, text)));
}

function exampleBox(row, onPick) {
  const box = h('details', { class: 'examples' }, h('summary', { text: '흔한 위험요인 예시 보기 (참고용)' }));
  const render = (type) => {
    box.querySelector('.chips')?.remove();
    box.append(exampleList(type, onPick));
  };
  render(row.accidentType);
  return { el: box, render };
}

function scoreLine(likelihood, severity, prefix) {
  return h('p', { class: 'score-line', 'aria-live': 'polite' }, riskBadge(likelihood, severity, prefix));
}

function afterSection(row, save) {
  const output = scoreLine(row.afterLikelihood, row.afterSeverity, '개선 후 위험성');
  const refresh = (current) => output.replaceChildren(riskBadge(current.afterLikelihood, current.afterSeverity, '개선 후 위험성'));
  const section = h('div', { class: 'after-box' },
    h('p', { class: 'field-label', text: '대책 완료 후 다시 평가' }),
    scaleGroup('개선 후 가능성(빈도)', `${row.id}-al`, LIKELIHOOD_OPTIONS, row.afterLikelihood, (v) => refresh(save({ afterLikelihood: v }))),
    scaleGroup('개선 후 중대성(강도)', `${row.id}-as`, SEVERITY_OPTIONS, row.afterSeverity, (v) => refresh(save({ afterSeverity: v }))),
    output
  );
  section.hidden = !row.done;
  return section;
}

function saveRow(riskId, rowId, patch) {
  let updated = null;
  updateRisk(riskId, (risk) => {
    const row = risk.rows.find((r) => r.id === rowId);
    if (row) updated = Object.assign(row, patch);
  });
  return updated;
}

function rowFields(row, save, examples) {
  const hazard = h('textarea', { rows: '2', maxlength: '500', value: row.hazard, onInput: (e) => save({ hazard: e.target.value }) });
  const typeSelect = h('select', {
    value: row.accidentType,
    onChange: (e) => {
      save({ accidentType: e.target.value });
      examples.render(e.target.value);
    }
  }, ACCIDENT_TYPES.map((t) => h('option', { value: t.value, text: t.label })));
  return { hazard, typeSelect };
}

function rowCard(riskId, row, index, onDelete) {
  const save = (patch) => saveRow(riskId, row.id, patch) || row;
  let hazardEl = null;
  const examples = exampleBox(row, (text) => {
    hazardEl.value = text;
    save({ hazard: text });
  });
  const { hazard, typeSelect } = rowFields(row, save, examples);
  hazardEl = hazard;
  const score = scoreLine(row.likelihood, row.severity, '위험성');
  const refresh = (current) => score.replaceChildren(riskBadge(current.likelihood, current.severity, '위험성'));
  const after = afterSection(row, save);
  const doneBox = h('input', { type: 'checkbox', checked: row.done, onChange: (e) => { save({ done: e.target.checked }); after.hidden = !e.target.checked; } });
  return h('article', { class: 'card risk-row', 'aria-label': `위험요인 ${index + 1}` },
    h('div', { class: 'row-head' },
      h('h2', { class: 'card-title', text: `위험요인 ${index + 1}` }),
      button('삭제', () => onDelete(row.id), 'ghost', { 'aria-label': `위험요인 ${index + 1} 삭제` })
    ),
    field({ label: '재해 형태', control: typeSelect }),
    field({ label: '유해·위험요인', control: hazard }),
    examples.el,
    scaleGroup('가능성(빈도)', `${row.id}-l`, LIKELIHOOD_OPTIONS, row.likelihood, (v) => refresh(save({ likelihood: v }))),
    scaleGroup('중대성(강도)', `${row.id}-s`, SEVERITY_OPTIONS, row.severity, (v) => refresh(save({ severity: v }))),
    score,
    field({ label: '감소대책', control: h('textarea', { rows: '2', maxlength: '1000', value: row.measure, onInput: (e) => save({ measure: e.target.value }) }) }),
    h('div', { class: 'field-row' },
      field({ label: '담당자', optional: true, control: h('input', { type: 'text', maxlength: '50', value: row.owner, onInput: (e) => save({ owner: e.target.value }) }) }),
      field({ label: '완료 예정일', control: h('input', { type: 'date', value: row.dueDate || '', onChange: (e) => save({ dueDate: e.target.value || null }) }) })
    ),
    h('label', { class: 'check-line' }, doneBox, h('span', { text: '대책 완료' })),
    after
  );
}

function metaForm(risk, onSaved) {
  const save = (patch) => {
    const updated = updateRisk(risk.id, (r) => Object.assign(r, patch));
    if (updated) onSaved(updated);
  };
  const title = h('input', { type: 'text', maxlength: '100', value: risk.title, onInput: (e) => save({ title: e.target.value }) });
  const date = h('input', { type: 'date', value: risk.assessedAt, onChange: (e) => { if (e.target.value) save({ assessedAt: e.target.value }); } });
  const type = h('select', { value: risk.type, onChange: (e) => save({ type: e.target.value }) },
    RISK_TYPES.map((t) => h('option', { value: t.value, text: t.label })));
  return h('details', { class: 'card form-card' },
    h('summary', { text: '평가 정보 수정' }),
    field({ label: '작업·공정 이름', control: title }),
    h('div', { class: 'field-row' }, field({ label: '평가일', control: date }), field({ label: '평가 구분', control: type }))
  );
}

function deleteRisk(id) {
  const risk = findRisk(get('risks'), id);
  if (!risk) return;
  if (!window.confirm(`'${risk.title || '제목 없음'}' 평가를 삭제할까요? 되돌릴 수 없습니다.`)) return;
  set('risks', get('risks').filter((r) => r.id !== risk.id));
  toast('평가를 삭제했습니다.');
  navigate('risk');
}

function rowsSection(riskId) {
  const container = h('div', { class: 'rows' });
  const render = () => {
    const risk = findRisk(get('risks'), riskId);
    const rows = risk ? risk.rows : [];
    container.replaceChildren(...(rows.length
      ? rows.map((row, i) => rowCard(riskId, row, i, removeRow))
      : [emptyState('아직 위험요인이 없습니다. 아래 버튼으로 추가하세요.')]));
  };
  function removeRow(rowId) {
    if (!window.confirm('이 위험요인을 삭제할까요?')) return;
    updateRisk(riskId, (risk) => { risk.rows = risk.rows.filter((r) => r.id !== rowId); });
    render();
    toast('위험요인을 삭제했습니다.');
  }
  const addRow = () => {
    const row = newRow();
    updateRisk(riskId, (risk) => risk.rows.push(row));
    render();
    container.lastElementChild?.querySelector('select')?.focus();
  };
  render();
  return [container, button('+ 위험요인 추가', addRow, 'primary', { class: 'btn btn-primary btn-block' })];
}

function subtitleText(risk) {
  return `${risk.assessedAt} · ${riskTypeLabel(risk.type)} · 변경 내용은 자동으로 저장됩니다.`;
}

export function renderRiskDetail(root, { id }) {
  const risk = findRisk(get('risks'), id);
  if (!risk) {
    root.append(pageHead('평가를 찾을 수 없습니다', '#/risk', '목록'), h('p', { text: '삭제되었거나 없는 평가입니다.' }));
    return '찾을 수 없음';
  }
  const head = pageHead(risk.title || '(제목 없음)', '#/risk', '목록');
  const subtitle = h('p', { class: 'muted', text: subtitleText(risk) });
  // 제목·평가일·구분을 고치면 제목, 부제, 브라우저 탭 제목을 바로 맞춥니다.
  const onSaved = (updated) => {
    head.querySelector('h1').textContent = updated.title || '(제목 없음)';
    subtitle.textContent = subtitleText(updated);
    document.title = `${updated.title || '위험성평가'} · 안전지대`;
  };
  root.append(
    head,
    subtitle,
    metaForm(risk, onSaved),
    ...rowsSection(risk.id),
    h('div', { class: 'danger-zone' }, button('이 평가 삭제', () => deleteRisk(risk.id), 'danger'))
  );
  return risk.title || '위험성평가';
}
