// 외부 라이브러리 없이 구현한 마크다운 → HTML 변환기
// 사용법: const { meta, html } = parseMarkdown(text);

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

// 인라인 처리 중 완성된 HTML 조각을 잠시 맡겨 두는 표시와, 강제 줄바꿈 표시
const SLOT = '\u0000';
const HARD_BREAK = '\u0001';

const RE = {
  fence: /^ {0,3}(`{3,}|~{3,})\s*([\w+#.-]*)/,
  heading: /^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/,
  rule: /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/,
  quote: /^ {0,3}>\s?/,
  listItem: /^( *)([-*+]|\d{1,9}[.)])\s+(.*)$/,
  tableDivider: /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/,
  task: /^\[([ xX])\]\s+(.*)$/,
};

const ALLOWED_SCHEMES = new Set(['http', 'https', 'mailto', 'tel']);

export function parseMarkdown(source) {
  const text = String(source)
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000\u0001]/g, '�')
    .replace(/\t/g, '    ');
  const { meta, body } = readFrontMatter(text);
  const state = { headingIds: new Map() };
  return { meta, html: renderBlocks(body.split('\n'), state) };
}

// ---------- 프론트매터 ----------

function readFrontMatter(text) {
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text);
  if (!match) return { meta: {}, body: text };

  const meta = {};
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    const key = line.slice(0, colon).trim();
    const raw = line.slice(colon + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
    meta[key] = key === 'tags' ? splitTags(raw) : raw;
  }
  return { meta, body: text.slice(match[0].length) };
}

function splitTags(raw) {
  return raw
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

// ---------- 블록 ----------

const isBlank = (line) => line.trim() === '';
const leadingSpaces = (line) => /^ */.exec(line)[0].length;
const isOrderedMarker = (marker) => /\d/.test(marker);

function startsTable(lines, i) {
  const next = lines[i + 1];
  return next !== undefined && lines[i].includes('|') && next.includes('|') && RE.tableDivider.test(next);
}

// 문단 중간에 나와도 새 블록으로 끊어야 하는 줄인지
function breaksParagraph(lines, i) {
  const line = lines[i];
  if (RE.fence.test(line) || RE.heading.test(line) || RE.rule.test(line) || RE.quote.test(line)) return true;
  if (startsTable(lines, i)) return true;
  const item = RE.listItem.exec(line);
  // 번호 목록은 "1."일 때만 끊는다. "2024. 올해는" 같은 문장을 목록으로 오인하지 않기 위해서다.
  return Boolean(item && (!isOrderedMarker(item[2]) || Number.parseInt(item[2], 10) === 1));
}

function renderBlocks(lines, state, tight = false) {
  const html = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i += 1;
      continue;
    }

    const block = readCodeBlock(lines, i)
      ?? readHeading(lines, i, state)
      ?? readRule(lines, i)
      ?? readQuote(lines, i, state)
      ?? (startsTable(lines, i) ? readTable(lines, i) : null)
      ?? (RE.listItem.test(line) ? readList(lines, i, state) : null)
      ?? readParagraph(lines, i, tight);

    html.push(block.html);
    i = block.next;
  }

  return html.join('\n');
}

function readCodeBlock(lines, start) {
  const open = RE.fence.exec(lines[start]);
  if (!open) return null;

  const [fence, lang] = [open[1], open[2]];
  const close = new RegExp(`^ {0,3}\\${fence[0]}{${fence.length},}\\s*$`);
  const code = [];
  let i = start + 1;
  while (i < lines.length && !close.test(lines[i])) {
    code.push(lines[i]);
    i += 1;
  }

  const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : '';
  return { html: `<pre><code${langAttr}>${escapeHtml(code.join('\n'))}</code></pre>`, next: i + 1 };
}

function readHeading(lines, start, state) {
  const match = RE.heading.exec(lines[start]);
  if (!match) return null;

  const level = match[1].length;
  const id = headingId(match[2], state);
  return { html: `<h${level} id="${id}">${renderInline(match[2])}</h${level}>`, next: start + 1 };
}

function headingId(text, state) {
  const base = text
    .replace(/[*_`~[\]()!#<>]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-') || 'section';
  const seen = state.headingIds.get(base) ?? 0;
  state.headingIds.set(base, seen + 1);
  return escapeHtml(seen === 0 ? base : `${base}-${seen}`);
}

function readRule(lines, start) {
  return RE.rule.test(lines[start]) ? { html: '<hr>', next: start + 1 } : null;
}

function readQuote(lines, start, state) {
  if (!RE.quote.test(lines[start])) return null;

  const inner = [];
  let i = start;
  while (i < lines.length && !isBlank(lines[i]) && RE.quote.test(lines[i])) {
    inner.push(lines[i].replace(RE.quote, ''));
    i += 1;
  }
  return { html: `<blockquote>${renderBlocks(inner, state)}</blockquote>`, next: i };
}

function readParagraph(lines, start, tight) {
  const parts = [lines[start]];
  let i = start + 1;
  while (i < lines.length && !isBlank(lines[i]) && !breaksParagraph(lines, i)) {
    parts.push(lines[i]);
    i += 1;
  }

  const content = renderInline(joinParagraphLines(parts));
  return { html: tight ? content : `<p>${content}</p>`, next: i };
}

// 줄 끝 공백 두 칸 또는 역슬래시는 강제 줄바꿈이다
function joinParagraphLines(parts) {
  return parts
    .map((line, idx) => {
      const last = idx === parts.length - 1;
      const forced = !last && /( {2,}|\\)$/.test(line);
      let trimmed = line.trim();
      if (forced && trimmed.endsWith('\\')) trimmed = trimmed.slice(0, -1);
      return forced ? trimmed + HARD_BREAK : trimmed;
    })
    .join('\n');
}

function readList(lines, start, state) {
  const first = RE.listItem.exec(lines[start]);
  const baseIndent = first[1].length;
  const ordered = isOrderedMarker(first[2]);
  const items = [];
  let item = null;
  let i = start;

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) {
      let next = i + 1;
      while (next < lines.length && isBlank(lines[next])) next += 1;
      if (next >= lines.length) break;

      const nextItem = RE.listItem.exec(lines[next]);
      const sameList = nextItem && nextItem[1].length <= baseIndent && isOrderedMarker(nextItem[2]) === ordered;
      if (leadingSpaces(lines[next]) <= baseIndent && !sameList) break;

      item.lines.push('');
      item.loose = true;
      i = next;
      continue;
    }

    const match = RE.listItem.exec(line);
    if (match && match[1].length <= baseIndent) {
      if (isOrderedMarker(match[2]) !== ordered) break;
      item = { lines: [match[3]], indent: match[0].length - match[3].length, loose: false };
      items.push(item);
      i += 1;
      continue;
    }

    if (leadingSpaces(line) > baseIndent) {
      item.lines.push(line.replace(new RegExp(`^ {0,${item.indent}}`), ''));
      i += 1;
      continue;
    }

    // 들여쓰지 않고 이어 쓴 문장은 앞 항목의 일부로 본다
    if (!item.loose && !breaksParagraph(lines, i)) {
      item.lines.push(line);
      i += 1;
      continue;
    }

    break;
  }

  const loose = items.some((it) => it.loose);
  const body = items.map((it) => renderListItem(it, state, loose)).join('\n');
  const tag = ordered ? 'ol' : 'ul';
  const startNumber = ordered ? Number.parseInt(first[2], 10) : 1;
  const startAttr = startNumber !== 1 ? ` start="${startNumber}"` : '';
  return { html: `<${tag}${startAttr}>\n${body}\n</${tag}>`, next: i };
}

function renderListItem(item, state, loose) {
  const task = RE.task.exec(item.lines[0]);
  if (!task) return `<li>${renderBlocks(item.lines, state, !loose)}</li>`;

  const checked = task[1] === ' ' ? '' : ' checked';
  const rest = [task[2], ...item.lines.slice(1)];
  return `<li class="task"><input type="checkbox" disabled${checked}> ${renderBlocks(rest, state, !loose)}</li>`;
}

function splitCells(row) {
  let text = row.trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0, -1);
  return text.split(/(?<!\\)\|/).map((cell) => cell.trim());
}

function columnAlign(cell) {
  const left = cell.startsWith(':');
  const right = cell.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return '';
}

function readTable(lines, start) {
  const headers = splitCells(lines[start]);
  const aligns = splitCells(lines[start + 1]).map(columnAlign);
  const styleFor = (col) => (aligns[col] ? ` style="text-align: ${aligns[col]}"` : '');

  const rows = [];
  let i = start + 2;
  while (i < lines.length && !isBlank(lines[i]) && lines[i].includes('|')) {
    rows.push(splitCells(lines[i]));
    i += 1;
  }

  const head = headers.map((cell, col) => `<th${styleFor(col)}>${renderInline(cell)}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${headers.map((_, col) => `<td${styleFor(col)}>${renderInline(row[col] ?? '')}</td>`).join('')}</tr>`)
    .join('\n');

  return {
    html: `<div class="table-wrap"><table>\n<thead><tr>${head}</tr></thead>\n<tbody>\n${body}\n</tbody>\n</table></div>`,
    next: i,
  };
}

// ---------- 인라인 ----------

// 이미 이스케이프된 주소를 받아, 허용하지 않는 스킴이면 빈 문자열을 돌려준다
function safeUrl(escapedUrl) {
  const compact = escapedUrl.replace(/[\s\u0000-\u001f]/g, '');
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(compact);
  if (scheme && !ALLOWED_SCHEMES.has(scheme[1].toLowerCase())) return '';
  return escapedUrl;
}

// 위키백과 주소처럼 괄호가 한 겹 들어간 링크도 받아들인다
const TARGET = String.raw`\(\s*((?:[^\s()]|\([^\s()]*\))+)(?:\s+&quot;(.*?)&quot;)?\s*\)`;
const IMAGE = new RegExp(String.raw`!\[([^\]]*)\]` + TARGET, 'g');
const LINK = new RegExp(String.raw`\[([^\]]+)\]` + TARGET, 'g');
const SLOT_REF = new RegExp(`${SLOT}(\\d+)${SLOT}`, 'g');

function renderInline(text) {
  const kept = [];
  const keep = (html) => `${SLOT}${kept.push(html) - 1}${SLOT}`;
  let s = text;

  // 코드 안은 어떤 문법도 해석하지 않으므로 가장 먼저 떼어 둔다
  s = s.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, ticks, code) => keep(`<code>${escapeHtml(code.trim())}</code>`));
  s = s.replace(/\\([\\`*_{}[\]()#+\-.!~|>])/g, (_, ch) => keep(escapeHtml(ch)));
  s = escapeHtml(s);

  // 위험한 주소는 src/href 속성을 아예 빼서 눌러도 아무 일이 없게 한다
  s = s.replace(IMAGE, (_, alt, url, title) => {
    const src = safeUrl(url);
    const attrs = `${src ? ` src="${src}"` : ''} alt="${alt}"${title ? ` title="${title}"` : ''}`;
    return keep(`<img${attrs} loading="lazy">`);
  });

  s = s.replace(LINK, (_, label, url, title) => {
    const href = safeUrl(url);
    const external = /^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : '';
    const attrs = `${href ? ` href="${href}"` : ''}${title ? ` title="${title}"` : ''}${external}`;
    return `${keep(`<a${attrs}>`)}${label}${keep('</a>')}`;
  });

  s = s
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, '$1<strong>$2</strong>')
    .replace(/\*(?=\S)([^*]*?\S)\*/g, '<em>$1</em>')
    .replace(/(^|[^\w])_(?=\S)([^_]*?\S)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>')
    .replaceAll(HARD_BREAK, '<br>');

  return s.replace(SLOT_REF, (_, n) => kept[Number(n)]);
}
