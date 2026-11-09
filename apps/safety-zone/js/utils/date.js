const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function pad(value) {
  return String(value).padStart(2, '0');
}

export function toDateStr(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayStr() {
  return toDateStr(new Date());
}

export function parseDate(str) {
  const match = typeof str === 'string' ? DATE_RE.exec(str) : null;
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  const valid = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return valid ? date : null;
}

export function isValidDateStr(str) {
  return parseDate(str) !== null;
}

// 8월 31일 + 6개월처럼 없는 날짜가 되면 그달 말일로 맞춥니다.
export function addMonths(str, months) {
  const date = parseDate(str);
  if (!date) return null;
  const targetMonth = date.getMonth() + months;
  const lastDay = new Date(date.getFullYear(), targetMonth + 1, 0).getDate();
  const result = new Date(date.getFullYear(), targetMonth, Math.min(date.getDate(), lastDay));
  return toDateStr(result);
}

export function formatKoreanDate(str) {
  const date = parseDate(str);
  if (!date) return str || '';
  return `${str} (${WEEKDAYS[date.getDay()]})`;
}

export function nowIso() {
  const date = new Date();
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${toDateStr(date)}T${time}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export function inRange(dateStr, from, to) {
  if (!dateStr) return !from && !to;
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}
