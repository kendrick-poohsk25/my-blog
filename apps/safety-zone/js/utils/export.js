import { h } from './dom.js';
import { todayStr } from './date.js';
import { DISCLAIMER_PRINT } from '../data/legal.js';

// 엑셀에서 =, +, -, @ 로 시작하는 칸을 수식으로 실행하지 않도록 앞에 작은따옴표를 붙입니다.
function safeCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export function toCsv(columns, rows) {
  const lines = [columns, ...rows].map((row) => row.map(safeCell).join(','));
  return lines.join('\r\n');
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url, download: filename });
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 엑셀이 UTF-8로 인식하도록 BOM을 붙입니다.
export function downloadCsv(filename, columns, rows) {
  const blob = new Blob(['﻿', toCsv(columns, rows)], { type: 'text/csv;charset=utf-8' });
  downloadBlob(filename, blob);
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(filename, blob);
}

function reportTable(columns, rows) {
  return h('table', { class: 'print-table' },
    h('thead', {}, h('tr', {}, columns.map((col) => h('th', { scope: 'col', text: col })))),
    h('tbody', {}, rows.length
      ? rows.map((row) => h('tr', {}, row.map((cell) => h('td', { text: cell ?? '' }))))
      : h('tr', {}, h('td', { colspan: String(columns.length), text: '기록이 없습니다.' })))
  );
}

export function printReport({ title, orgName, period, columns, rows }) {
  const area = document.getElementById('print-area');
  if (!area) return;
  const metaText = [`사업장: ${orgName || '(미입력)'}`, `출력일: ${todayStr()}`, period ? `기간: ${period}` : null]
    .filter(Boolean).join(' · ');
  area.replaceChildren(
    h('header', { class: 'print-header' }, h('h1', { text: title }), h('p', { text: metaText })),
    reportTable(columns, rows),
    h('footer', { class: 'print-footer' }, h('p', { text: DISCLAIMER_PRINT }))
  );
  // 버튼으로 인쇄할 때만 표 문서 모드로 바꾸고, 끝나면 되돌려 메뉴 인쇄(Ctrl+P)는 현재 화면이 나오게 합니다.
  document.body.classList.add('printing-report');
  window.addEventListener('afterprint', endReportPrint, { once: true });
  window.print();
}

function endReportPrint() {
  document.body.classList.remove('printing-report');
  document.getElementById('print-area')?.replaceChildren();
}
