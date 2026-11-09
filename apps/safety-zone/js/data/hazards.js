// 업종 공통 예시입니다. 건설 현장(고소작업·중장비·개구부 등)도 함께 담았습니다.

export const ACCIDENT_TYPES = [
  {
    value: 'fall',
    label: '추락',
    examples: ['사다리 작업 중 떨어짐', '비계·지붕 등 고소작업 중 추락', '개구부·바닥 구멍으로 떨어짐', '화물차 적재함에서 떨어짐']
  },
  {
    value: 'caught',
    label: '끼임',
    examples: ['기계 회전부에 손·옷이 끼임', '설비 정비·청소 중 갑자기 작동해 끼임', '컨베이어 점검 중 끼임', '금형 교체 시 손 끼임']
  },
  {
    value: 'struck',
    label: '부딪힘·맞음',
    examples: ['지게차·굴착기 등 중장비와 부딪힘', '인양 중 자재가 떨어져 맞음', '쌓아 둔 자재가 무너짐', '후진 차량에 부딪힘']
  },
  {
    value: 'slip',
    label: '넘어짐',
    examples: ['바닥 물기·기름에 미끄러짐', '통로에 둔 물건에 걸려 넘어짐', '계단 이동 중 넘어짐', '어두운 작업장에서 발을 헛디딤']
  },
  {
    value: 'fire',
    label: '화재·폭발',
    examples: ['용접·절단 불티로 화재', '인화성 물질 보관 부주의', '전기 과부하로 화재', '가스 누출 상태에서 점화']
  },
  {
    value: 'electric',
    label: '감전',
    examples: ['젖은 손으로 전기기기 조작', '피복이 손상된 전선 접촉', '분전반 정비 중 감전', '가설 전선이 물에 잠김']
  },
  {
    value: 'other',
    label: '기타',
    examples: ['무거운 물건을 들다 허리 부상', '밀폐공간 산소 부족·유해가스', '유해물질 취급 중 노출', '폭염 속 장시간 작업']
  }
];

export const ACCIDENT_IDS = ACCIDENT_TYPES.map((type) => type.value);

export function accidentLabel(value) {
  const found = ACCIDENT_TYPES.find((type) => type.value === value);
  return found ? found.label : '기타';
}

export function accidentExamples(value) {
  const found = ACCIDENT_TYPES.find((type) => type.value === value);
  return found ? found.examples : [];
}

export const LIKELIHOOD_OPTIONS = [
  { value: 1, label: '1', desc: '거의 없음' },
  { value: 2, label: '2', desc: '가끔' },
  { value: 3, label: '3', desc: '자주' }
];

export const SEVERITY_OPTIONS = [
  { value: 1, label: '1', desc: '경미' },
  { value: 2, label: '2', desc: '휴업 필요' },
  { value: 3, label: '3', desc: '사망·장해' }
];

export const RISK_TYPES = [
  { value: 'initial', label: '최초평가' },
  { value: 'regular', label: '정기평가' },
  { value: 'ad_hoc', label: '수시평가' }
];

export const RISK_TYPE_IDS = RISK_TYPES.map((type) => type.value);

export function riskTypeLabel(value) {
  const found = RISK_TYPES.find((type) => type.value === value);
  return found ? found.label : '정기평가';
}

// 색맹 사용자도 구분할 수 있게 색과 별개로 모양이 다른 기호를 함께 씁니다.
export const RISK_LEVELS = [
  { id: 'low', label: '낮음', icon: '●', tone: 'ok' },
  { id: 'mid', label: '보통', icon: '◆', tone: 'warn' },
  { id: 'high', label: '높음', icon: '▲', tone: 'danger' }
];

export function riskScore(likelihood, severity) {
  return likelihood && severity ? likelihood * severity : null;
}

export function riskLevel(score) {
  if (!score) return null;
  if (score <= 2) return RISK_LEVELS[0];
  if (score <= 4) return RISK_LEVELS[1];
  return RISK_LEVELS[2];
}

export function riskText(likelihood, severity) {
  const score = riskScore(likelihood, severity);
  const level = riskLevel(score);
  return level ? `${score} ${level.label}` : '';
}

export const DEFAULT_CHECKS = [
  { key: 'ppe', label: '보호구 착용' },
  { key: 'tidy', label: '정리정돈·통로 확보' },
  { key: 'equipment', label: '설비·공구 이상 유무' },
  { key: 'guard', label: '방호장치 정상 작동' },
  { key: 'fallGuard', label: '추락 방지 조치 (난간·안전대·개구부 덮개)' },
  { key: 'electric', label: '전기·가스 안전 상태' },
  { key: 'fireExit', label: '소화기·비상구 확인' },
  { key: 'health', label: '작업자 건강 상태 확인' }
];
