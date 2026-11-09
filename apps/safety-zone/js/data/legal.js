// 법령 관련 문구는 spec.md 2절 범위 안에서만 씁니다. 세부 기준이 불확실한 항목은 "원문 확인"으로 완곡하게 표기합니다.

export const LAW_BASE_DATE = '2026-11';

export const DISCLAIMER_SHORT = '참고용 도구이며 법률 자문이 아닙니다.';

export const DISCLAIMER_FULL = [
  '안전지대는 산업안전보건법·중대재해처벌법 이행을 돕기 위한 참고용 도구이며, 법률 자문이 아닙니다.',
  '앱의 진단 결과와 체크리스트 완료가 법적 의무 이행이나 면책을 보장하지 않습니다.',
  '법령은 개정될 수 있으니 정확한 내용은 법제처 국가법령정보센터, 고용노동부, 안전보건공단 또는 전문가(노무사·변호사 등)에게 확인하세요.',
  '입력한 정보는 이 기기의 브라우저에만 저장되며 외부로 전송되지 않습니다.'
];

export const DISCLAIMER_PRINT = '이 문서는 참고용 도구 「안전지대」로 작성한 기록이며 법률 자문이 아닙니다. '
  + '법적 의무 이행이나 면책을 보장하지 않으며, 정확한 내용은 법령 원문 또는 관계 기관·전문가에게 확인하세요.';

export const INDUSTRIES = [
  { value: 'manufacturing', label: '제조업', managerCandidate: true },
  { value: 'construction', label: '건설업', managerCandidate: false },
  { value: 'forestry', label: '임업', managerCandidate: true },
  { value: 'environment', label: '하수·폐수·폐기물 처리, 환경 정화', managerCandidate: true },
  { value: 'service', label: '서비스업 (도소매·음식·숙박 등)', managerCandidate: false },
  { value: 'other', label: '기타', managerCandidate: false }
];

export const INDUSTRY_IDS = INDUSTRIES.map((item) => item.value);

export function industryLabel(value) {
  const found = INDUSTRIES.find((item) => item.value === value);
  return found ? found.label : '기타';
}

export const SERIOUS_ACCIDENT_DEFINITION = [
  '사망자 1명 이상',
  '같은 사고로 6개월 이상 치료가 필요한 부상자 2명 이상',
  '같은 유해요인으로 급성중독 등 직업성 질병자가 1년 이내 3명 이상'
];

export const PENALTY_SUMMARY = [
  '사망: 경영책임자 1년 이상 징역 또는 10억 원 이하 벌금 / 법인 50억 원 이하 벌금',
  '부상·질병: 7년 이하 징역 또는 1억 원 이하 벌금 / 법인 10억 원 이하 벌금',
  '손해액의 5배 이내 징벌적 손해배상'
];
