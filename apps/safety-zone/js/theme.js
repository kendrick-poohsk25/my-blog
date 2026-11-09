import { get, set } from './store.js';

// 블로그(../../js/theme.js)가 테마를 저장하는 localStorage 키. 블로그와 앱을 오갈 때 테마를 잇기 위해 함께 씁니다.
const BLOG_THEME_KEY = 'theme';

const media = window.matchMedia('(prefers-color-scheme: dark)');
let toggleButton = null;

function currentSetting() {
  return get('settings').theme;
}

function blogTheme() {
  try {
    const saved = localStorage.getItem(BLOG_THEME_KEY);
    return saved === 'light' || saved === 'dark' ? saved : null;
  } catch {
    return null;
  }
}

// 라이트/다크를 고르면 블로그 키에도 같은 값을 씁니다.
// '기기 설정 따르기'를 고르면 블로그 키를 지워, 블로그와 앱 모두 OS 설정을 따르게 합니다.
function saveBlogTheme(setting) {
  try {
    if (setting === 'light' || setting === 'dark') localStorage.setItem(BLOG_THEME_KEY, setting);
    else localStorage.removeItem(BLOG_THEME_KEY);
  } catch {
    // 저장소를 쓸 수 없으면 앱 설정만 바뀝니다.
  }
}

function effectiveTheme(setting) {
  if (setting === 'light' || setting === 'dark') return setting;
  return blogTheme() || (media.matches ? 'dark' : 'light');
}

function updateButton(theme) {
  if (!toggleButton) return;
  const label = theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환';
  toggleButton.setAttribute('aria-label', label);
  toggleButton.setAttribute('title', label);
}

export function applyTheme() {
  const theme = effectiveTheme(currentSetting());
  document.documentElement.dataset.theme = theme;
  updateButton(theme);
}

export function setThemeSetting(value) {
  const settings = get('settings');
  settings.theme = value;
  set('settings', settings);
  saveBlogTheme(value);
  applyTheme();
}

function toggleTheme() {
  const next = effectiveTheme(currentSetting()) === 'dark' ? 'light' : 'dark';
  setThemeSetting(next);
}

export function initTheme(button) {
  toggleButton = button;
  applyTheme();
  if (button) button.addEventListener('click', toggleTheme);
  media.addEventListener('change', () => {
    if (currentSetting() === 'system') applyTheme();
  });
}
