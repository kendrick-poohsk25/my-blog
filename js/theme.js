// 다크 모드: 처음에는 OS 설정을 따르고, 버튼으로 고르면 그 선택을 기억한다
const KEY = 'theme';
const root = document.documentElement;
const toggle = document.getElementById('theme-toggle');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

function savedTheme() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // 저장할 수 없는 환경(시크릿 창 등)에서는 이번 방문 동안만 적용된다
  }
}

function setTheme(theme) {
  root.dataset.theme = theme;
  const label = theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환';
  toggle.setAttribute('aria-label', label);
  toggle.title = label;
}

setTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');

toggle.addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(next);
  saveTheme(next);
});

// 직접 고른 적이 없을 때만 OS 설정 변화를 따라간다
prefersDark.addEventListener('change', (event) => {
  if (!savedTheme()) setTheme(event.matches ? 'dark' : 'light');
});
