// 다크 모드 토글: 기본은 OS 설정, 사용자가 고르면 localStorage에 기억한다
const STORAGE_KEY = 'theme';
const root = document.documentElement;
const button = document.getElementById('theme-toggle');
const media = window.matchMedia('(prefers-color-scheme: dark)');

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function store(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // 시크릿 모드 등 저장할 수 없는 환경에서는 이번 방문 동안만 적용된다
  }
}

function apply(theme) {
  root.dataset.theme = theme;
  const label = theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환';
  button.setAttribute('aria-label', label);
  button.title = label;
}

apply(root.dataset.theme === 'dark' ? 'dark' : 'light');

button.addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  apply(next);
  store(next);
});

// 사용자가 직접 고른 적이 없으면 OS 설정 변경을 그대로 따라간다
media.addEventListener('change', (event) => {
  if (!readStored()) apply(event.matches ? 'dark' : 'light');
});
