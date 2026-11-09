import { DUTY_IDS, STATUS_IDS } from './data/duties.js';
import { ACCIDENT_IDS, RISK_TYPE_IDS, DEFAULT_CHECKS } from './data/hazards.js';
import { INDUSTRY_IDS } from './data/legal.js';
import { isValidDateStr, nowIso, todayStr } from './utils/date.js';

// 블로그가 쓰는 localStorage 키와 섞이지 않도록 접두사를 붙입니다.
const PREFIX = 'sz:';
export const SCHEMA_VERSION = 1;
const KEYS = ['meta', 'profile', 'duties', 'risks', 'logs', 'settings'];
const APP_ID = 'safety-zone';
const MAX_TEXT = 2000;

const cache = {};
const listeners = new Set();
let persistent = true;

/* ---------- 값 정리(손상된 저장값·가져온 파일 모두 같은 규칙으로 검증) ---------- */

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v, max = MAX_TEXT) => (typeof v === 'string' ? v.slice(0, max) : '');
const bool = (v) => v === true;
const dateOrNull = (v) => (isValidDateStr(v) ? v : null);
const scale = (v) => ([1, 2, 3].includes(v) ? v : null);
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const isoOrNull = (v) => (typeof v === 'string' && v.length <= 40 ? v : null);
const idOr = (v, fallback) => (typeof v === 'string' && /^[\w-]{1,60}$/.test(v) ? v : fallback);

function normMeta(v) {
  const o = isObj(v) ? v : {};
  return { schemaVersion: SCHEMA_VERSION, disclaimerAcceptedAt: isoOrNull(o.disclaimerAcceptedAt) };
}

function normResult(v) {
  if (!isObj(v)) return null;
  return {
    seriousAccidentAct: bool(v.seriousAccidentAct),
    needsSafetyHealthManager: bool(v.needsSafetyHealthManager),
    checkedAt: dateOrNull(v.checkedAt)
  };
}

function normProfile(v) {
  if (!isObj(v) || !Number.isInteger(v.workers) || v.workers < 0) return null;
  const amount = typeof v.constructionAmount === 'number' && v.constructionAmount >= 0 ? v.constructionAmount : null;
  return {
    name: str(v.name, 100),
    workers: v.workers,
    industry: oneOf(v.industry, INDUSTRY_IDS, 'other'),
    constructionAmount: amount,
    hasSubcontract: bool(v.hasSubcontract),
    handlesHazardous: bool(v.handlesHazardous),
    result: normResult(v.result)
  };
}

function normDutyItem(v) {
  const o = isObj(v) ? v : {};
  const item = { status: oneOf(o.status, STATUS_IDS, 'todo'), memo: str(o.memo), lastCheckedAt: dateOrNull(o.lastCheckedAt) };
  // 자가진단이 자동으로 '해당 없음'을 넣은 경우에만 표시해 두어, 재진단 때 앱이 넣은 값만 되돌릴 수 있게 합니다.
  if (o.autoNa === true && item.status === 'na') item.autoNa = true;
  return item;
}

function normDuties(v) {
  const o = isObj(v) ? v : {};
  const items = isObj(o.items) ? o.items : {};
  return {
    items: Object.fromEntries(DUTY_IDS.map((id) => [id, normDutyItem(items[id])])),
    updatedAt: isoOrNull(o.updatedAt)
  };
}

function normRow(v, index) {
  return {
    id: idOr(v.id, `h_${index + 1}`),
    hazard: str(v.hazard, 500),
    accidentType: oneOf(v.accidentType, ACCIDENT_IDS, 'other'),
    likelihood: scale(v.likelihood),
    severity: scale(v.severity),
    measure: str(v.measure, 1000),
    owner: str(v.owner, 50),
    dueDate: dateOrNull(v.dueDate),
    done: bool(v.done),
    afterLikelihood: scale(v.afterLikelihood),
    afterSeverity: scale(v.afterSeverity)
  };
}

function normRisk(v, index) {
  const rows = Array.isArray(v.rows) ? v.rows.filter(isObj).map(normRow) : [];
  return {
    id: idOr(v.id, `r_${index + 1}`),
    title: str(v.title, 100),
    assessedAt: dateOrNull(v.assessedAt) || todayStr(),
    type: oneOf(v.type, RISK_TYPE_IDS, 'regular'),
    rows
  };
}

function normRisks(v) {
  return Array.isArray(v) ? v.filter(isObj).map(normRisk) : [];
}

function normChecks(v) {
  if (!isObj(v)) return {};
  return Object.fromEntries(Object.entries(v).filter(([key, val]) => /^\w{1,40}$/.test(key) && typeof val === 'boolean'));
}

function normLog(v) {
  const attendees = Number.isInteger(v.attendees) && v.attendees >= 0 ? v.attendees : null;
  return {
    id: idOr(v.id, `l_${v.date}_1`),
    date: v.date,
    kind: oneOf(v.kind, ['tbm', 'inspection'], 'tbm'),
    work: str(v.work, 500),
    hazards: Array.isArray(v.hazards) ? v.hazards.filter((x) => typeof x === 'string').map((x) => x.slice(0, 500)) : [],
    measures: str(v.measures),
    attendees,
    attendeeNames: str(v.attendeeNames, 500),
    checks: normChecks(v.checks),
    note: str(v.note),
    createdAt: isoOrNull(v.createdAt)
  };
}

// 이 앱은 날짜당 기록 1건으로 다루므로 같은 날짜가 겹치면 앞의 것만 남깁니다.
function normLogs(v) {
  if (!Array.isArray(v)) return [];
  const seen = new Set();
  return v.filter((item) => isObj(item) && isValidDateStr(item.date))
    .filter((item) => !seen.has(item.date) && seen.add(item.date))
    .map(normLog)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

function normTemplate(v) {
  if (!Array.isArray(v)) return DEFAULT_CHECKS.map((item) => ({ ...item }));
  const seen = new Set();
  return v.filter((item) => isObj(item) && /^\w{1,40}$/.test(item.key) && typeof item.label === 'string')
    .filter((item) => !seen.has(item.key) && seen.add(item.key))
    .map((item) => ({ key: item.key, label: item.label.slice(0, 60) }));
}

function normSettings(v) {
  const o = isObj(v) ? v : {};
  return { theme: oneOf(o.theme, ['system', 'light', 'dark'], 'system'), checkTemplate: normTemplate(o.checkTemplate) };
}

const NORMALIZERS = {
  meta: normMeta,
  profile: normProfile,
  duties: normDuties,
  risks: normRisks,
  logs: normLogs,
  settings: normSettings
};

/* ---------- localStorage 입출력 ---------- */

function probeStorage() {
  try {
    const key = `${PREFIX}__probe`;
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function readRaw(key) {
  if (!persistent) return undefined;
  try {
    const text = localStorage.getItem(PREFIX + key);
    if (text === null) return undefined;
    const parsed = JSON.parse(text);
    return isObj(parsed) && 'value' in parsed ? parsed.value : undefined;
  } catch {
    return undefined;
  }
}

function notify() {
  listeners.forEach((fn) => fn(persistent));
}

// 저장에 실패하면(용량 초과·권한 거부) 메모리 모드로 바꾸고 배너로 알립니다.
function writeRaw(key) {
  if (!persistent) return;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ schemaVersion: SCHEMA_VERSION, value: cache[key] }));
  } catch {
    persistent = false;
    notify();
  }
}

function removeRaw(key) {
  if (!persistent) return;
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    persistent = false;
    notify();
  }
}

/* ---------- 공개 API ---------- */

export function initStore() {
  persistent = probeStorage();
  KEYS.forEach((key) => {
    cache[key] = NORMALIZERS[key](readRaw(key));
  });
  return persistent;
}

export function get(key) {
  return structuredClone(cache[key]);
}

export function set(key, value) {
  cache[key] = NORMALIZERS[key](value);
  writeRaw(key);
}

export function isPersistent() {
  return persistent;
}

export function onStatusChange(fn) {
  listeners.add(fn);
}

export function exportBackup() {
  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowIso(),
    data: Object.fromEntries(KEYS.map((key) => [key, get(key)]))
  };
}

function checkShape(data) {
  const arrays = ['risks', 'logs'];
  const objects = ['meta', 'duties', 'settings'];
  for (const key of arrays) {
    if (key in data && !Array.isArray(data[key])) throw new Error(`${key} 항목의 형식이 올바르지 않습니다.`);
  }
  for (const key of objects) {
    if (key in data && !isObj(data[key])) throw new Error(`${key} 항목의 형식이 올바르지 않습니다.`);
  }
  if ('profile' in data && data.profile !== null && !isObj(data.profile)) throw new Error('profile 항목의 형식이 올바르지 않습니다.');
  if (!KEYS.some((key) => key in data)) throw new Error('복원할 데이터가 없습니다.');
}

// 가져온 파일은 구조를 확인한 뒤 알려진 필드만 골라 담습니다.
export function parseBackup(obj) {
  if (!isObj(obj) || obj.app !== APP_ID) throw new Error('안전지대 백업 파일이 아닙니다.');
  if (!Number.isInteger(obj.schemaVersion) || obj.schemaVersion > SCHEMA_VERSION) {
    throw new Error('지원하지 않는 백업 버전입니다.');
  }
  if (!isObj(obj.data)) throw new Error('백업 데이터가 비어 있습니다.');
  checkShape(obj.data);
  // 면책 동의(meta)는 이 기기의 기록이라 복원하지 않고, 백업에 들어 있는 키만 돌려줍니다.
  const keys = KEYS.filter((key) => key !== 'meta' && key in obj.data);
  if (!keys.length) throw new Error('복원할 데이터가 없습니다.');
  return Object.fromEntries(keys.map((key) => [key, NORMALIZERS[key](obj.data[key])]));
}

// 백업에 없는 키는 지금 데이터를 그대로 둡니다.
export function restoreBackup(data) {
  KEYS.filter((key) => key !== 'meta' && key in data).forEach((key) => set(key, data[key]));
}

// 면책 고지 확인 기록(meta)은 남겨 두어 초기화 후 모달이 다시 뜨지 않게 합니다.
export function resetAll() {
  KEYS.filter((key) => key !== 'meta').forEach((key) => {
    cache[key] = NORMALIZERS[key](undefined);
    removeRaw(key);
  });
}
