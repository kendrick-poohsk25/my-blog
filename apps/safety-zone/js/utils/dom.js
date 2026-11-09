// 모든 텍스트는 textContent/속성으로만 넣습니다. innerHTML은 쓰지 않아 사용자 입력이 HTML로 해석되지 않습니다.

const PROP_KEYS = new Set(['value', 'checked', 'disabled', 'hidden', 'selected', 'open', 'required', 'readOnly', 'multiple', 'indeterminate']);

let idCounter = 0;
let toastTimer = null;

export function uid(prefix = 'f') {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function applyProp(el, key, val) {
  if (key === 'class') el.className = val;
  else if (key === 'text') el.textContent = String(val);
  else if (key === 'dataset') Object.assign(el.dataset, val);
  else if (key.startsWith('on') && typeof val === 'function') el.addEventListener(key.slice(2).toLowerCase(), val);
  else if (PROP_KEYS.has(key)) el[key] = val;
  else el.setAttribute(key, val === true ? '' : String(val));
}

function applyProps(el, props) {
  for (const [key, val] of Object.entries(props || {})) {
    if (val === null || val === undefined) continue;
    if (val === false && !PROP_KEYS.has(key)) continue;
    applyProp(el, key, val);
  }
}

function appendChildren(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

// select의 value는 option이 붙은 뒤에 넣어야 적용되므로 자식을 먼저 붙입니다.
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  appendChildren(el, children);
  applyProps(el, props);
  return el;
}

export function pageHead(title, backHref, backLabel = '뒤로') {
  return h('div', { class: 'page-head' },
    backHref ? h('a', { class: 'back-link', href: backHref, 'aria-label': `${backLabel}로 돌아가기` }, '← ', backLabel) : null,
    h('h1', { class: 'page-title', tabindex: '-1', text: title })
  );
}

export function field({ label, control, hint, optional }) {
  const id = control.id || uid('field');
  control.id = id;
  const hintEl = hint ? h('p', { class: 'field-hint', id: `${id}-hint`, text: hint }) : null;
  if (hintEl) control.setAttribute('aria-describedby', hintEl.id);
  return h('div', { class: 'field' },
    h('label', { for: id, class: 'field-label' }, label, optional ? h('span', { class: 'optional', text: ' (선택)' }) : null),
    control,
    hintEl
  );
}

function choiceOption({ name, type, option, checked, onChange }) {
  const input = h('input', { type, name, value: String(option.value), checked });
  input.addEventListener('change', () => onChange(option.value, input.checked));
  return h('label', { class: 'choice' },
    input,
    h('span', { class: 'choice-body' },
      h('span', { class: 'choice-label', text: option.label }),
      option.desc ? h('span', { class: 'choice-desc', text: option.desc }) : null
    )
  );
}

// 라디오/체크박스 묶음. label 전체가 터치 영역이 되도록 감쌉니다.
export function choiceGroup({ legend, name, options, value, type = 'radio', variant = 'list', hint, onChange }) {
  const selected = Array.isArray(value) ? value : [value];
  const hintEl = hint ? h('p', { class: 'field-hint', text: hint }) : null;
  return h('fieldset', { class: `choice-group choice-${variant}` },
    h('legend', { class: 'field-label', text: legend }),
    hintEl,
    h('div', { class: 'choice-options' },
      options.map((option) => choiceOption({
        name,
        type,
        option,
        checked: selected.includes(option.value),
        onChange: onChange || (() => {})
      }))
    )
  );
}

export function badge(text, tone = 'muted') {
  return h('span', { class: `badge badge-${tone}`, text });
}

export function progressBar(percent, label) {
  const safe = Math.max(0, Math.min(100, Math.round(percent)));
  const fill = h('span', { class: 'progress-fill' });
  fill.style.width = `${safe}%`;
  return h('div', {
    class: 'progress',
    role: 'progressbar',
    'aria-valuemin': '0',
    'aria-valuemax': '100',
    'aria-valuenow': String(safe),
    'aria-label': label
  }, fill);
}

export function emptyState(text, action) {
  return h('div', { class: 'empty' }, h('p', { text }), action || null);
}

export function linkButton(href, text, variant = 'primary') {
  return h('a', { class: `btn btn-${variant}`, href, text });
}

export function button(text, onClick, variant = 'secondary', extra = {}) {
  return h('button', { type: 'button', class: `btn btn-${variant}`, onClick, ...extra }, text);
}

export function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

export function randomId(prefix) {
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}
