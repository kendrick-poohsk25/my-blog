# Build 지침 — 공통 색상 토큰(tokens.css) 분리와 사용법 안내

배경: CLAUDE.md에 새 규칙이 생겼다.
- 모든 웹앱은 블로그의 색상 팔레트를 따르고, 블로그 CSS 변수를 참조한다.
- 웹앱에 사용법 안내 문구를 반드시 포함한다.

점검 결과 안전지대는 강조색이 초록(블로그는 파랑)이고, 색 값을 복사해 쓰며, 앱 전체 사용 순서 안내가 없다.

## 수정 허용 범위
- 새 파일 `css/tokens.css` (블로그 루트)
- `css/style.css` — 맨 위 테마 변수 블록(`:root`, `[data-theme="dark"]`)만 옮긴다. 다른 규칙은 건드리지 않는다.
- `index.html` (블로그) — `<head>`에 tokens.css `<link>` 한 줄 추가만.
- `apps/safety-zone/` 안의 앱 코드: `index.html`, `css/`, `js/`
- 수정 금지: `spec.md`, `review.md`, `briefs/*`, `preview.png`, 위에 없는 모든 파일. git 명령 금지.

## 작업 1 — css/tokens.css 만들기
- `css/style.css` 1~37행의 `:root`, `[data-theme="dark"]` 블록에서 **색상 관련 변수와 `color-scheme`, `--font-sans`, `--font-mono`, `--radius`** 를 tokens.css로 옮긴다.
  - 색상 변수: bg, surface, text, text-muted, border, accent, accent-soft, code-bg, code-text, header-bg, selection
- 레이아웃 변수(`--measure`, `--gutter`, `--header-height`)는 style.css에 남긴다.
- 값은 한 글자도 바꾸지 않는다. 블로그 화면이 전과 픽셀 단위로 같아야 한다.
- tokens.css 맨 위에 주석을 단다: "블로그와 모든 웹앱이 공유하는 색상 팔레트. 웹앱은 ../../css/tokens.css로 불러온다."
- 블로그 `index.html`에서 `css/style.css` `<link>` **바로 앞**에 `<link rel="stylesheet" href="css/tokens.css">` 를 넣는다. `@import`는 쓰지 않는다.

## 작업 2 — 안전지대가 tokens.css를 참조
- `apps/safety-zone/index.html`에서 `css/app.css` 앞에 `<link rel="stylesheet" href="../../css/tokens.css">` 를 넣는다.
- `app.css`의 `:root`, `[data-theme="dark"]` 블록 수정:
  - tokens.css에 있는 변수(bg, surface, text, text-muted, border, accent, accent-soft, code-bg, radius)의 정의는 **지운다**.
  - `--font`는 `var(--font-sans)`로 바꾼다.
  - 앱 전용 변수는 남기고, 강조색 계열은 블로그 파랑에 맞춘다.
    - `--accent-hover`: 라이트 `#1a4db8`, 다크 `#a3c6ff` 정도
    - `--on-accent`: 라이트 `#ffffff`, 다크 `#0e1a2e`처럼 대비 4.5:1 이상
    - `--focus: var(--accent)`
  - `--ok`, `--ok-bg`는 지금처럼 accent를 쓰지 말고 초록 계열 상태색으로 따로 둔다. 완료 배지가 강조색과 구분되게 한다. 라이트·다크 모두 대비 4.5:1 이상.
  - warn, danger, info 상태색은 유지한다.
  - `surface-strong`, `border-strong`, `overlay`, `shadow`도 유지한다.
- `accent-soft`가 이제 반투명(rgb … / 0.1)이다. 그 위에 글자를 올리는 곳(배지, 선택된 칩, card-accent 등)의 대비가 4.5:1 이상인지 확인하고, 모자라면 앱 쪽 규칙을 조정한다.
- `app.css`와 `js/` 안에 초록 강조색(`#1f7a4d`, `#186340`, `#5fd39a`, `#7fe0b0`, `#e4f3ea`, `#173a29`)이 하드코딩된 곳이 있으면 변수로 바꾼다.
- `print.css`: 인쇄는 흰 배경 고정이 맞으니 별도 값을 유지한다. `--accent`, `--accent-soft`만 블로그 라이트 값(`#1f5bd8`, 옅은 파랑 단색)으로 바꾼다.
- `assets/icon.svg`가 초록이면 블로그 강조색 파랑으로 바꾼다. 앱 폴더 안이라 수정해도 된다.
- 안전망: tokens.css를 못 불러와도 앱이 깨지지 않게, 앱 루트 index.html을 직접 열 때도 같은 상대 경로로 동작하는지만 확인한다. 별도 fallback 값은 넣지 않는다.

## 작업 3 — 테마 설정 공유
- 지금은 블로그가 `localStorage['theme']`, 앱이 `sz:settings.theme`(`system|light|dark`)에 테마를 따로 저장한다.
- 앱 설정이 `system`일 때는 블로그의 `theme` 키('light'/'dark')를 먼저 보고, 없으면 OS 설정을 따른다.
  - `index.html` 인라인 스크립트와 `js/theme.js` 둘 다 이렇게 바꾼다.
- 앱에서 테마를 토글하면 `sz:settings`와 함께 블로그 `theme` 키에도 같은 값을 쓴다. try/catch로 감싼다.
- 이렇게 하면 블로그와 앱을 오갈 때 테마가 이어진다.
- 백업 JSON 형식은 바꾸지 않는다.

## 작업 4 — 사용법 안내
- 홈(`js/views/home.js`)에 '사용법' 카드를 추가한다.
  - `<details>` 기반으로, 자가진단 전에는 펼친 상태, 진단 후에는 접힌 상태로 둔다.
  - 내용은 순서형 목록(`<ol>`)으로, 각 단계에 해당 화면 링크(44px 터치 대상)를 붙인다.
    1. 자가진단 — 법 적용 여부와 우선 할 일 확인 (`#/check`)
    2. 관리체계 체크리스트 — 시행령 제4조 9개 항목 상태 기록, 반기 점검일 관리 (`#/duties`)
    3. 위험성평가 — 작업별 위험요인을 빈도×강도로 평가하고 대책 기록 (`#/risk`)
    4. TBM 기록 — 매일 작업 전 위험요인 공유 내용 기록 (`#/log`)
    5. 인쇄·내보내기·백업 — 서류 출력, CSV, JSON 백업 (`#/more`)
  - 마지막 줄 안내: "데이터는 이 브라우저에만 저장되므로 정기적으로 백업하세요."
- '더보기'(`js/views/more.js`)에도 같은 내용의 '사용법' 섹션을 둔다. 홈과 같은 데이터·함수를 재사용한다(문구 중복 정의 금지).
  - 한 곳에 단계 배열을 두고 둘 다 그걸 쓰게 한다. 예: `js/data/guide.js`.
- 기존 화면별 설명 문구는 그대로 둔다.

## 확인
- 수정한 JS 파일은 모두 `node --check`로 확인한다.
- 블로그 `css/style.css`에서 옮긴 변수 이름이 tokens.css에 빠짐없이 있는지 grep으로 대조한다.
- 브라우저 검증은 Review 담당이 한다.

## 보고
작업별로 무엇을 바꿨는지 한 줄씩 적는다(파일:줄 포함). 바꾼 색 값과, 대비를 계산했다면 그 결과도 적는다.
