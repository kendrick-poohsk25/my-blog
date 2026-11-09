import { get, set } from './store.js';

const media = window.matchMedia('(prefers-color-scheme: dark)');
let toggleButton = null;

function currentSetting() {
  return get('settings').theme;
}

function effectiveTheme(setting) {
  if (setting === 'light' || setting === 'dark') return setting;
  return media.matches ? 'dark' : 'light';
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
