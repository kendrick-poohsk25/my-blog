// 앱 전체 사용 순서. 홈의 '사용법' 카드와 더보기의 '사용법' 섹션이 함께 씁니다.

export const GUIDE_STEPS = [
  { title: '자가진단', desc: '법 적용 여부와 우선 할 일 확인', href: '#/check', link: '자가진단으로 가기' },
  { title: '관리체계 체크리스트', desc: '시행령 제4조 9개 항목 상태 기록, 반기 점검일 관리', href: '#/duties', link: '체크리스트로 가기' },
  { title: '위험성평가', desc: '작업별 위험요인을 빈도×강도로 평가하고 대책 기록', href: '#/risk', link: '위험성평가로 가기' },
  { title: 'TBM 기록', desc: '매일 작업 전 위험요인 공유 내용 기록', href: '#/log', link: 'TBM 기록으로 가기' },
  { title: '인쇄·내보내기·백업', desc: '서류 출력, CSV, JSON 백업', href: '#/more', link: '더보기로 가기' }
];

export const GUIDE_NOTE = '데이터는 이 브라우저에만 저장되므로 정기적으로 백업하세요.';
