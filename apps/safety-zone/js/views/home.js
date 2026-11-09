import { get } from '../store.js';
import { DISCLAIMER_SHORT } from '../data/legal.js';
import { GUIDE_STEPS, GUIDE_NOTE } from '../data/guide.js';
import { h, pageHead, badge, progressBar, linkButton } from '../utils/dom.js';
import { todayStr, formatKoreanDate } from '../utils/date.js';
import { computeDutyStats } from './duties.js';
import { countOpenHighRisks } from './risk.js';
import { findLog } from './log.js';

function profileCard() {
  const profile = get('profile');
  if (!profile || !profile.result) {
    return h('section', { class: 'card card-accent', 'aria-label': '사업장 정보' },
      h('h2', { class: 'card-title', text: '우리 사업장도 적용 대상일까?' }),
      h('p', { text: '1분 자가진단으로 산업안전보건법·중대재해처벌법 적용 여부와 우선 할 일을 확인하세요.' }),
      linkButton('#/check', '자가진단 시작')
    );
  }
  const applies = profile.result.seriousAccidentAct;
  return h('section', { class: 'card', 'aria-label': '사업장 정보' },
    h('p', { class: 'stat-label', text: `${profile.name || '내 사업장'} · 상시 ${profile.workers}명` }),
    h('p', { class: 'card-title' }, applies ? badge('● 중대재해처벌법 적용 대상', 'danger') : badge('– 중대재해처벌법 적용 제외', 'muted')),
    h('div', { class: 'btn-row' }, linkButton('#/check/result', '진단 결과 보기', 'secondary'), linkButton('#/check', '다시 진단', 'ghost'))
  );
}

function dutyCard() {
  const stats = computeDutyStats(get('duties'));
  return h('section', { class: 'card', 'aria-label': '관리체계 이행' },
    h('div', { class: 'stat-row' },
      h('h2', { class: 'card-title', text: '관리체계 이행' }),
      h('span', { class: 'stat-value', text: `${stats.percent}%` })
    ),
    progressBar(stats.percent, '관리체계 이행률'),
    h('p', { class: 'muted small', text: `완료 ${stats.done} / ${stats.denom}개` }),
    stats.overdue > 0
      ? h('p', { class: 'alert alert-danger', text: `⚠ 반기 점검 지난 항목 ${stats.overdue}개` })
      : null,
    linkButton('#/duties', '체크리스트 보기', 'secondary')
  );
}

function todayCard() {
  const today = todayStr();
  const log = findLog(get('logs'), today);
  const highCount = countOpenHighRisks(get('risks'));
  return h('section', { class: 'card', 'aria-label': '오늘 TBM' },
    h('div', { class: 'stat-row' },
      h('h2', { class: 'card-title', text: '오늘 TBM' }),
      h('time', { class: 'muted small', datetime: today, text: formatKoreanDate(today) })
    ),
    log
      ? h('div', { class: 'btn-row align-center' }, badge('✓ 기록 완료', 'ok'), linkButton(`#/log/${today}`, '보기·수정', 'secondary'))
      : linkButton(`#/log/${today}`, '기록하기 →'),
    h('p', { class: highCount ? 'alert alert-danger' : 'muted small' },
      highCount ? `▲ 높음 위험요인 미조치 ${highCount}건 ` : '높음 위험요인 미조치 없음 ',
      h('a', { class: 'touch-link', href: '#/risk', text: '위험성평가 보기' }))
  );
}

// 사용 순서 목록. 더보기의 '사용법' 섹션도 이 함수를 씁니다.
export function guideSteps() {
  return [
    h('ol', { class: 'plain-list' },
      GUIDE_STEPS.map((step) => h('li', {},
        h('strong', { text: step.title }), ` — ${step.desc} `,
        h('a', { class: 'touch-link', href: step.href, text: step.link })
      ))
    ),
    h('p', { class: 'small', text: GUIDE_NOTE })
  ];
}

// 자가진단 전에는 펼쳐 두고, 진단 후에는 접어 둡니다.
function guideCard() {
  const checked = Boolean(get('profile')?.result);
  return h('details', { class: 'card guide', open: !checked },
    h('summary', { text: '사용법' }),
    ...guideSteps()
  );
}

function disclaimerNote() {
  return h('p', { class: 'disclaimer-note' }, DISCLAIMER_SHORT, ' ', h('a', { href: '#/more/disclaimer', text: '(자세히)' }));
}

export function renderHome(root) {
  root.append(
    pageHead('오늘의 안전 현황'),
    profileCard(),
    guideCard(),
    dutyCard(),
    todayCard(),
    disclaimerNote()
  );
  return '안전지대';
}
