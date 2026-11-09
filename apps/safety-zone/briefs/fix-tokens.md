# Build 수정 지침 — 4차 검증 M1·N1

## 수정 허용 범위
- `apps/safety-zone/css/app.css`, `apps/safety-zone/css/print.css`만 수정한다.
- 다른 파일은 고치지 않는다. git 명령은 쓰지 않는다.

## 고칠 문제 (상세는 `apps/safety-zone/review.md` 4차 검증 섹션)
1. **M1** 접힌 `<details>`에 펼칠 수 있다는 표시가 없다 — `css/app.css:794-801`
   - 원인: `.guide summary`, `.examples summary`, `details.form-card summary`의 `display:flex` 때문에 기본 삼각형 표시가 사라졌다. 세 곳 모두 같은 문제다.
   - 수정: 세 summary에 공통 펼침 표시를 붙인다.
     - CSS `::after`(또는 `::before`)로 ▸/▾ 모양 셰브론을 넣는다. `[open]` 상태에서 회전시키거나 모양을 바꾼다.
     - 색은 `var(--text-muted)`를 쓴다.
     - `prefers-reduced-motion`에서는 회전 전환을 끈다.
     - 표시는 장식이다. summary 자체가 이미 접근 가능하니 내용 문자에는 넣지 않는다.
     - 기존 기본 마커(`::-webkit-details-marker`, `list-style`)와 겹쳐 두 개가 보이지 않게 한다.
2. **N1** 다크 테마에서 Ctrl+P로 인쇄하면 `--ok`, `--ok-bg`가 다크 값으로 남는다 — `css/print.css:5-29`
   - 수정: 같은 변수 블록에 `--ok: #1e6b43; --ok-bg: #e6f4ec;`를 추가한다.

## 보고
항목별로 한 줄씩 적는다(파일:줄 포함).
