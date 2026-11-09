// 중대재해처벌법 시행령 제4조(안전보건관리체계 9개 항목)와 제5조 점검 항목입니다.
// id는 저장 데이터의 키라서 바꾸지 않습니다.

export const DUTIES = [
  {
    id: 'goal',
    no: 1,
    title: '안전·보건 목표와 경영방침',
    plain: '대표가 "우리 회사 안전 목표"를 정해 문서로 공표합니다.',
    basis: '중대재해처벌법 시행령 제4조 제1호',
    semiannual: false
  },
  {
    id: 'org',
    no: 2,
    title: '전담 조직',
    plain: '안전·보건 업무를 총괄하는 전담 조직을 둡니다.',
    basis: '중대재해처벌법 시행령 제4조 제2호',
    semiannual: false,
    note: '일정 규모 이상 사업장만 해당하며, 5~49인 사업장은 대부분 해당하지 않을 수 있습니다. 세부 기준은 원문을 확인하세요.'
  },
  {
    id: 'hazard',
    no: 3,
    title: '유해·위험요인 확인·개선 절차',
    plain: '위험요인을 찾고 고치는 절차를 만들고 점검합니다. 위험성평가로 갈음할 수 있습니다.',
    basis: '중대재해처벌법 시행령 제4조 제3호',
    semiannual: true
  },
  {
    id: 'budget',
    no: 4,
    title: '안전·보건 예산 편성·집행',
    plain: '필요한 인력·시설·장비 예산을 편성하고 실제로 집행합니다.',
    basis: '중대재해처벌법 시행령 제4조 제4호',
    semiannual: false
  },
  {
    id: 'manager',
    no: 5,
    title: '책임자 권한·예산 부여 및 평가',
    plain: '안전보건관리책임자 등에게 권한과 예산을 주고 업무를 평가합니다.',
    basis: '중대재해처벌법 시행령 제4조 제5호',
    semiannual: true
  },
  {
    id: 'staff',
    no: 6,
    title: '전문인력 배치',
    plain: '산업안전보건법상 안전관리자·보건관리자·안전보건관리담당자·산업보건의를 배치합니다.',
    basis: '중대재해처벌법 시행령 제4조 제6호',
    semiannual: false
  },
  {
    id: 'opinion',
    no: 7,
    title: '종사자 의견 청취',
    plain: '일하는 사람의 의견을 듣고 개선하는 절차를 둡니다. 산업안전보건위원회 등으로 갈음할 수 있습니다.',
    basis: '중대재해처벌법 시행령 제4조 제7호',
    semiannual: true
  },
  {
    id: 'emergency',
    no: 8,
    title: '비상 대응 매뉴얼',
    plain: '중대산업재해 발생(우려) 시 작업중지·대피·구호·추가피해 방지 매뉴얼을 마련합니다.',
    basis: '중대재해처벌법 시행령 제4조 제8호',
    semiannual: true
  },
  {
    id: 'subcontract',
    no: 9,
    title: '도급·용역·위탁 관리',
    plain: '협력업체를 고를 때 안전보건 역량을 평가하는 기준과 절차를 마련합니다.',
    basis: '중대재해처벌법 시행령 제4조 제9호',
    semiannual: true
  },
  {
    id: 'lawCheck',
    no: 10,
    title: '안전보건 관계 법령 의무 이행 점검',
    plain: '안전보건 관계 법령의 의무를 지키고 있는지, 필요한 교육을 했는지 점검합니다.',
    basis: '중대재해처벌법 시행령 제5조',
    semiannual: true
  }
];

export const DUTY_IDS = DUTIES.map((duty) => duty.id);

// 자가진단이 전담 조직 항목에 자동으로 넣는 메모입니다. 자동 표시를 풀 때 이 문구와 같으면 지웁니다.
export const AUTO_ORG_MEMO = '자가진단 결과에 따라 자동 표시 (규모 기준은 원문 확인)';

export const STATUSES = [
  { value: 'todo', label: '미착수', icon: '○', tone: 'muted' },
  { value: 'in_progress', label: '진행 중', icon: '◐', tone: 'warn' },
  { value: 'done', label: '완료', icon: '●', tone: 'ok' },
  { value: 'na', label: '해당 없음', icon: '–', tone: 'muted' }
];

export const STATUS_IDS = STATUSES.map((status) => status.value);

export function statusInfo(value) {
  return STATUSES.find((status) => status.value === value) || STATUSES[0];
}

export function findDuty(id) {
  return DUTIES.find((duty) => duty.id === id) || null;
}
