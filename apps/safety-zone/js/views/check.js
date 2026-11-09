import { get, set } from '../store.js';
import { AUTO_ORG_MEMO } from '../data/duties.js';
import {
  INDUSTRIES, industryLabel, SERIOUS_ACCIDENT_DEFINITION, PENALTY_SUMMARY, DISCLAIMER_FULL
} from '../data/legal.js';
import { h, pageHead, field, choiceGroup, badge, linkButton } from '../utils/dom.js';
import { todayStr, nowIso } from '../utils/date.js';
import { navigate } from '../router.js';

const YES_NO = [
  { value: 'yes', label: '예' },
  { value: 'no', label: '아니요' }
];

/* ---------- 판정 ---------- */

export function computeResult(profile) {
  const industry = INDUSTRIES.find((item) => item.value === profile.industry);
  const inManagerRange = profile.workers >= 20 && profile.workers <= 49;
  return {
    seriousAccidentAct: profile.workers >= 5,
    needsSafetyHealthManager: inManagerRange && Boolean(industry && industry.managerCandidate),
    checkedAt: todayStr()
  };
}

function constructionText(amount) {
  if (amount === null) return '건설업은 공사금액 50억 원 미만 공사도 2024년 1월 27일부터 적용되고 있습니다.';
  if (amount >= 50) return '공사금액 50억 원 이상 건설 공사는 2022년 1월 27일 시행 때부터 적용 대상이었습니다.';
  return '공사금액 50억 원 미만 건설 공사는 유예되었다가 2024년 1월 27일부터 적용되고 있습니다.';
}

function seriousActText(profile) {
  if (profile.workers < 5) {
    return '상시 근로자 5인 미만 사업(장)의 사업주는 중대재해처벌법 적용에서 제외됩니다(제3조). 다만 산업안전보건법은 적용됩니다.';
  }
  if (profile.industry === 'construction') return constructionText(profile.constructionAmount);
  if (profile.workers < 50) return '상시 근로자 5인 이상이므로 적용 대상입니다. 50인 미만 사업장은 유예되었다가 2024년 1월 27일부터 적용되고 있습니다.';
  return '상시 근로자 50인 이상 사업장은 2022년 1월 27일 시행 때부터 적용 대상입니다.';
}

function managerText(profile, result) {
  if (result.needsSafetyHealthManager) {
    return '20~49인인 제조업 등 일부 업종은 안전보건관리담당자를 1명 이상 선임해야 할 수 있습니다(산업안전보건법 제19조). 해당 업종 목록은 원문을 확인하세요.';
  }
  if (profile.workers >= 50) return '50인 이상은 안전관리자·보건관리자 선임 등 다른 기준이 적용될 수 있습니다. 세부 기준은 원문을 확인하세요.';
  if (profile.workers >= 20) return '선택한 업종은 앱이 참고하는 업종(제조업, 임업, 하수·폐수·폐기물 처리, 환경 정화 등)에 없습니다. 정확한 업종 목록은 원문을 확인하세요.';
  return '20~49인 일부 업종 기준에 해당하지 않습니다.';
}

function safetyActDuties(profile) {
  const items = [
    '안전·보건 조치: 추락·끼임·화재·질식 등 위험을 막는 조치 (제38조·제39조)',
    '위험성평가: 위험요인을 찾고 위험 정도를 따져 대책을 세우고 기록·보존 (제36조). 최초평가, 매년 정기평가, 설비·공정 변경 시 수시평가',
    '안전보건교육: 정기교육, 채용 시 교육, 작업내용 변경 시 교육, 특별교육 (제29조, 교육 시간 기준은 원문 확인)',
    'TBM(작업 전 안전점검회의): 법정 의무는 아니지만 위험성평가 결과를 공유하는 방법으로 권장'
  ];
  if (profile.handlesHazardous) items.push('유해물질 취급: 물질·작업에 따라 추가 의무가 있을 수 있습니다. 위험성평가에 꼭 포함하고 세부 기준은 원문을 확인하세요.');
  return items;
}

function priorities(profile, result) {
  if (!result.seriousAccidentAct) {
    return ['위험성평가를 하고 기록으로 남기기', '추락·끼임 등 안전·보건 조치 점검', '안전보건교육 실시', '매일 TBM 기록 남기기'];
  }
  const list = [
    '위험성평가 실시·기록 (체크리스트 3번 항목을 위험성평가로 갈음할 수 있음)',
    '안전·보건 목표와 경영방침을 정해 공표하기',
    '비상 대응 매뉴얼 마련하기'
  ];
  if (profile.hasSubcontract) list.push('협력업체 선정 시 안전보건 역량 평가 기준·절차 마련하기');
  list.push('반기 1회 이상 점검 항목 일정 잡기', '매일 TBM 기록 남기기');
  return list;
}

function markOrgNa(org) {
  if (org.status !== 'todo' || org.memo) return null;
  return { ...org, status: 'na', memo: AUTO_ORG_MEMO, autoNa: true };
}

// 앱이 자동으로 넣은 '해당 없음'만 되돌리고, 사용자가 직접 바꾼 값은 그대로 둡니다.
function unmarkOrgNa(org) {
  if (!org.autoNa || org.status !== 'na') return null;
  const rest = { ...org };
  delete rest.autoNa;
  return { ...rest, status: 'todo', memo: org.memo === AUTO_ORG_MEMO ? '' : org.memo };
}

// 5~49인은 전담 조직 대상이 아닌 경우가 많아, 사용자가 아직 손대지 않았을 때만 '해당 없음'으로 표시합니다.
function autoMarkOrg(profile) {
  const duties = get('duties');
  const org = duties.items.org;
  const next = profile.workers >= 50 ? unmarkOrgNa(org) : markOrgNa(org);
  if (!next) return;
  duties.items.org = next;
  duties.updatedAt = nowIso();
  set('duties', duties);
}

/* ---------- 질문 화면 ---------- */

function readProfile(form, previous) {
  const data = new FormData(form);
  const workersRaw = String(data.get('workers') || '').trim();
  const workers = workersRaw === '' ? NaN : Number(workersRaw);
  const amountRaw = String(data.get('amount') || '').trim();
  const industry = String(data.get('industry') || '');
  return {
    name: String(data.get('name') || '').trim(),
    workers,
    industry,
    constructionAmount: industry === 'construction' && amountRaw !== '' ? Number(amountRaw) : null,
    hasSubcontract: data.get('subcontract') === 'yes',
    handlesHazardous: data.get('hazardous') === 'yes',
    result: previous ? previous.result : null
  };
}

function validate(profile) {
  if (!Number.isInteger(profile.workers) || profile.workers < 0) return '상시 근로자 수를 0 이상의 정수로 입력하세요.';
  if (!profile.industry) return '업종을 선택하세요.';
  if (profile.constructionAmount !== null && (!Number.isFinite(profile.constructionAmount) || profile.constructionAmount < 0)) {
    return '공사금액은 0 이상의 숫자로 입력하세요.';
  }
  return '';
}

function amountField(profile) {
  const input = h('input', { type: 'number', name: 'amount', min: '0', step: '0.1', inputmode: 'decimal', value: profile?.constructionAmount ?? '' });
  const wrap = field({ label: '공사금액 (억 원)', control: input, optional: true, hint: '중대재해처벌법은 50억 원 기준으로 적용 시기가 달랐습니다.' });
  wrap.hidden = profile?.industry !== 'construction';
  return wrap;
}

function buildForm(profile) {
  const amount = amountField(profile);
  const error = h('p', { class: 'alert alert-danger', role: 'alert', hidden: true });
  const workersHint = '건설업의 상시 근로자 수 산정 방식은 세부 기준 원문을 확인하세요.';
  const form = h('form', { class: 'card form-card', novalidate: true },
    field({ label: '사업장 이름', optional: true, control: h('input', { type: 'text', name: 'name', maxlength: '100', value: profile?.name || '' }) }),
    field({ label: '상시 근로자 수 (명)', hint: workersHint, control: h('input', { type: 'number', name: 'workers', min: '0', step: '1', inputmode: 'numeric', required: true, value: profile?.workers ?? '' }) }),
    choiceGroup({
      legend: '업종', name: 'industry', options: INDUSTRIES, value: profile?.industry,
      onChange: (value) => { amount.hidden = value !== 'construction'; }
    }),
    amount,
    choiceGroup({ legend: '도급·용역·위탁(협력업체)을 주나요?', name: 'subcontract', options: YES_NO, value: profile?.hasSubcontract ? 'yes' : 'no', variant: 'grid' }),
    choiceGroup({ legend: '유해물질(화학물질 등)을 취급하나요?', name: 'hazardous', options: YES_NO, value: profile?.handlesHazardous ? 'yes' : 'no', variant: 'grid' }),
    error,
    h('button', { type: 'submit', class: 'btn btn-primary btn-block', text: '결과 보기' })
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitForm(form, profile, error);
  });
  return form;
}

function submitForm(form, previous, error) {
  const profile = readProfile(form, previous);
  const message = validate(profile);
  if (message) {
    error.textContent = message;
    error.hidden = false;
    return;
  }
  profile.result = computeResult(profile);
  set('profile', profile);
  autoMarkOrg(profile);
  navigate('check/result');
}

export function renderCheck(root) {
  const profile = get('profile');
  root.append(
    pageHead('법 적용 자가진단', '#/', '홈'),
    h('p', { class: 'muted', text: '질문 몇 개에 답하면 산업안전보건법·중대재해처벌법 적용 여부와 우선 할 일을 알려 드립니다.' }),
    buildForm(profile)
  );
  return '자가진단';
}

/* ---------- 결과 화면 ---------- */

function resultBlock(title, badgeEl, body) {
  return h('section', { class: 'result-block' },
    h('h2', { class: 'result-title' }, h('span', { text: title }), badgeEl),
    ...[].concat(body)
  );
}

function listEl(items, ordered = false) {
  return h(ordered ? 'ol' : 'ul', { class: 'plain-list' }, items.map((text) => h('li', { text })));
}

function seriousDetails() {
  return h('details', { class: 'examples' },
    h('summary', { text: '중대산업재해와 처벌 기준 보기' }),
    h('p', { class: 'small', text: '중대산업재해(제2조 제2호)는 다음 중 하나입니다.' }),
    listEl(SERIOUS_ACCIDENT_DEFINITION),
    h('p', { class: 'small', text: '처벌(제6조·제7조·제15조)' }),
    listEl(PENALTY_SUMMARY)
  );
}

function resultCard(profile) {
  const { result } = profile;
  const summary = `${profile.name || '내 사업장'} · 상시 ${profile.workers}명 · ${industryLabel(profile.industry)}`;
  return h('article', { class: 'card result-card' },
    h('p', { class: 'stat-label', text: summary }),
    resultBlock('중대재해처벌법', result.seriousAccidentAct ? badge('● 적용 대상', 'danger') : badge('– 적용 제외', 'muted'),
      [h('p', { text: seriousActText(profile) }), result.seriousAccidentAct ? seriousDetails() : null]),
    resultBlock('산업안전보건법', badge('● 적용', 'warn'), [h('p', { class: 'small', text: '근로자를 쓰는 사업장은 원칙적으로 적용됩니다(일부 조항은 업종·규모에 따라 제외될 수 있음).' }), listEl(safetyActDuties(profile))]),
    resultBlock('안전보건관리담당자', result.needsSafetyHealthManager ? badge('◆ 선임 대상일 수 있음', 'warn') : badge('– 가능성 낮음', 'muted'),
      h('p', { text: managerText(profile, result) })),
    resultBlock('우선 할 일', null, listEl(priorities(profile, result), true)),
    h('p', { class: 'muted small', text: `진단일 ${result.checkedAt || '-'}` })
  );
}

export function renderCheckResult(root) {
  const profile = get('profile');
  if (!profile || !profile.result) {
    root.append(pageHead('자가진단 결과', '#/', '홈'), h('p', { text: '아직 자가진단을 하지 않았습니다.' }), linkButton('#/check', '자가진단 시작'));
    return '자가진단 결과';
  }
  root.append(
    pageHead('자가진단 결과', '#/', '홈'),
    resultCard(profile),
    h('aside', { class: 'disclaimer-box', 'aria-label': '면책 고지' }, DISCLAIMER_FULL.slice(0, 3).map((text) => h('p', { text }))),
    h('div', { class: 'btn-row' },
      linkButton('#/duties', '체크리스트로 이동 →'),
      linkButton('#/check', '다시 진단하기', 'secondary')
    )
  );
  return '자가진단 결과';
}

