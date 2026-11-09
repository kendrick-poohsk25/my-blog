// 외부 라이브러리 없이 구현한 마크다운 → HTML 변환기
// 사용법: const { meta, html } = parseMarkdown(text);

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})\s*([\w+#.-]*)/;
const HEADING_RE = /^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const HR_RE = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE_RE = /^ {0,3}>\s?/;
const LIST_RE = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const TABLE_SEP_RE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const SAFE_SCHEMES = ['http', 'https', 'mailto', 'tel'];

// 문단 안 줄바꿈(줄 끝 공백 2개 또는 \)을 표시하는 내부 기호
const BR = '\u0001';
// 인라인 처리 중 완성된 HTML 조각을 잠시 보관하는 자리표시자 기호
const HOLD = '\u0000';

export function parseMarkdown(source) {
  const text = String(source)
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000\u0001]/g, '�')
    .replace(/\t/g, '    ');
  const { meta, body } = parseFrontMatter(text);
  const ctx = { ids: new Map() };
  const html = parseBlocks(body.split('\n'), ctx);
  return { meta, html };
}

function parseFrontMatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) return { meta: {}, body: text };

  const meta = {};
  for (const line of match[1].split('\n')) {
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim().replace(/^(["'])(.*)\1$/, '$2');
    if (key === 'tags') {
      value = value.replace(/^\[|\]$/g, '').split(',').map((t) => t.trim()).filter(Boolean);
    }
    if (key) meta[key] = value;
  }
  return { meta, body: text.slice(match[0].length) };
}

// ---------- 블록 ----------

const isBlank = (line) => line.trim() === '';
const indentOf = (line) => line.match(/^ */)[0].length;
const isOrdered = (marker) => /\d/.test(marker);

function isTableStart(lines, i) {
  const next = lines[i + 1];
  return next !== undefined && lines[i].includes('|') && next.includes('|') && TABLE_SEP_RE.test(next);
}

// 문단을 끊고 새 블록을 시작하는 줄인지 판단한다
function interruptsParagraph(lines, i) {
  const line = lines[i];
  if (FENCE_RE.test(line) || HEADING_RE.test(line) || HR_RE.test(line) || QUOTE_RE.test(line)) return true;
  if (isTableStart(lines, i)) return true;
  const list = line.match(LIST_RE);
  // 번호 목록은 "1."로 시작할 때만 문단을 끊는다 (문장 속 "2024. " 같은 오인 방지)
  return Boolean(list && (!isOrdered(list[2]) || parseInt(list[2], 10) === 1));
}

function parseBlocks(lines, ctx, tight = false) {
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) {
      i++;
      continue;
    }

    const fence = line.match(FENCE_RE);
    if (fence) {
      const marker = fence[1];
      const closeRe = new RegExp(`^ {0,3}\\${marker[0]}{${marker.length},}\\s*$`);
      const code = [];
      i++;
      while (i < lines.length && !closeRe.test(lines[i])) code.push(lines[i++]);
      i++; // 닫는 펜스
      const lang = fence[2] ? ` class="language-${escapeHtml(fence[2])}"` : '';
      out.push(`<pre><code${lang}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      const level = heading[1].length;
      const id = uniqueId(heading[2], ctx);
      out.push(`<h${level} id="${id}">${renderInline(heading[2], ctx)}</h${level}>`);
      i++;
      continue;
    }

    if (HR_RE.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const inner = [];
      while (i < lines.length && !isBlank(lines[i]) && QUOTE_RE.test(lines[i])) {
        inner.push(lines[i++].replace(QUOTE_RE, ''));
      }
      out.push(`<blockquote>${parseBlocks(inner, ctx)}</blockquote>`);
      continue;
    }

    if (isTableStart(lines, i)) {
      const table = parseTable(lines, i, ctx);
      out.push(table.html);
      i = table.next;
      continue;
    }

    if (LIST_RE.test(line)) {
      const list = parseList(lines, i, ctx);
      out.push(list.html);
      i = list.next;
      continue;
    }

    const para = [line];
    i++;
    while (i < lines.length && !isBlank(lines[i]) && !interruptsParagraph(lines, i)) {
      para.push(lines[i++]);
    }
    const content = renderInline(joinParagraph(para), ctx);
    out.push(tight ? content : `<p>${content}</p>`);
  }

  return out.join('\n');
}

function joinParagraph(lines) {
  return lines
    .map((line, idx) => {
      const isLast = idx === lines.length - 1;
      const hardBreak = !isLast && /( {2,}|\\)$/.test(line);
      const trimmed = line.trim().replace(/\\$/, (m) => (hardBreak ? '' : m));
      return hardBreak ? trimmed + BR : trimmed;
    })
    .join('\n');
}

function uniqueId(rawText, ctx) {
  const base = rawText
    .replace(/[*_`~[\]()!#<>]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-') || 'section';
  const count = ctx.ids.get(base) || 0;
  ctx.ids.set(base, count + 1);
  return escapeHtml(count ? `${base}-${count}` : base);
}

function parseList(lines, start, ctx) {
  const first = lines[start].match(LIST_RE);
  const baseIndent = first[1].length;
  const ordered = isOrdered(first[2]);
  const startNum = ordered ? parseInt(first[2], 10) : 1;
  const items = [];
  let current = null;
  let i = start;

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) {
      let j = i + 1;
      while (j < lines.length && isBlank(lines[j])) j++;
      if (j >= lines.length) break;
      const nextItem = lines[j].match(LIST_RE);
      const continues = indentOf(lines[j]) > baseIndent
        || (nextItem && nextItem[1].length <= baseIndent && isOrdered(nextItem[2]) === ordered);
      if (!continues) break;
      current.lines.push('');
      current.hadBlank = true;
      i = j;
      continue;
    }

    const item = line.match(LIST_RE);
    if (item && item[1].length <= baseIndent) {
      if (isOrdered(item[2]) !== ordered) break;
      current = { lines: [item[3]], contentIndent: item[0].length - item[3].length, hadBlank: false };
      items.push(current);
      i++;
      continue;
    }

    if (indentOf(line) > baseIndent) {
      current.lines.push(line.replace(new RegExp(`^ {0,${current.contentIndent}}`), ''));
      i++;
      continue;
    }

    // 들여쓰기 없이 이어 쓴 문장은 앞 항목에 붙인다
    if (!current.hadBlank && !interruptsParagraph(lines, i)) {
      current.lines.push(line);
      i++;
      continue;
    }

    break;
  }

  const loose = items.some((it) => it.hadBlank);
  const body = items
    .map((it) => {
      const task = it.lines[0].match(/^\[([ xX])\]\s+(.*)$/);
      let checkbox = '';
      if (task) {
        checkbox = `<input type="checkbox" disabled${task[1] === ' ' ? '' : ' checked'}> `;
        it.lines[0] = task[2];
      }
      const content = parseBlocks(it.lines, ctx, !loose);
      return `<li${task ? ' class="task"' : ''}>${checkbox}${content}</li>`;
    })
    .join('\n');

  const tag = ordered ? 'ol' : 'ul';
  const startAttr = ordered && startNum !== 1 ? ` start="${startNum}"` : '';
  return { html: `<${tag}${startAttr}>\n${body}\n</${tag}>`, next: i };
}

function splitRow(row) {
  let s = row.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((cell) => cell.trim());
}

function parseTable(lines, start, ctx) {
  const headers = splitRow(lines[start]);
  const aligns = splitRow(lines[start + 1]).map((cell) => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    if (left) return 'left';
    return '';
  });
  const alignAttr = (idx) => (aligns[idx] ? ` style="text-align: ${aligns[idx]}"` : '');

  let i = start + 2;
  const rows = [];
  while (i < lines.length && !isBlank(lines[i]) && lines[i].includes('|')) {
    rows.push(splitRow(lines[i++]));
  }

  const head = headers.map((h, idx) => `<th${alignAttr(idx)}>${renderInline(h, ctx)}</th>`).join('');
  const bodyRows = rows
    .map((row) => `<tr>${headers.map((_, idx) => `<td${alignAttr(idx)}>${renderInline(row[idx] ?? '', ctx)}</td>`).join('')}</tr>`)
    .join('\n');

  const html = `<div class="table-wrap"><table>\n<thead><tr>${head}</tr></thead>\n<tbody>\n${bodyRows}\n</tbody>\n</table></div>`;
  return { html, next: i };
}

// ---------- 인라인 ----------

function safeUrl(escapedUrl) {
  const compact = escapedUrl.replace(/[\s\u0000-\u001f]/g, '');
  const scheme = compact.match(/^([a-z][a-z0-9+.-]*):/i);
  if (scheme && !SAFE_SCHEMES.includes(scheme[1].toLowerCase())) return '';
  return escapedUrl;
}

// 괄호가 한 단계 들어간 주소(예: 위키백과 링크)도 받아들이는 링크·이미지 패턴
const URL_PART = String.raw`\(\s*((?:[^\s()]|\([^\s()]*\))+)(?:\s+&quot;(.*?)&quot;)?\s*\)`;
const IMAGE_RE = new RegExp(String.raw`!\[([^\]]*)\]` + URL_PART, 'g');
const LINK_RE = new RegExp(String.raw`\[([^\]]+)\]` + URL_PART, 'g');

function renderInline(text, _ctx) {
  const held = [];
  const hold = (html) => `${HOLD}${held.push(html) - 1}${HOLD}`;
  let s = text;

  // 코드 안쪽은 어떤 문법도 해석하지 않으므로 가장 먼저 떼어 둔다
  s = s.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, __, code) => hold(`<code>${escapeHtml(code.trim())}</code>`));
  s = s.replace(/\\([\\`*_{}[\]()#+\-.!~|>])/g, (_, ch) => hold(escapeHtml(ch)));
  s = escapeHtml(s);

  // 위험한 주소는 src/href 속성 자체를 빼서 눌러도 아무 일이 없게 한다
  s = s.replace(IMAGE_RE, (_, alt, url, title) => {
    const src = safeUrl(url);
    const srcAttr = src ? ` src="${src}"` : '';
    return hold(`<img${srcAttr} alt="${alt}"${title ? ` title="${title}"` : ''} loading="lazy">`);
  });

  s = s.replace(LINK_RE, (_, label, url, title) => {
    const href = safeUrl(url);
    const hrefAttr = href ? ` href="${href}"` : '';
    const external = /^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : '';
    const titleAttr = title ? ` title="${title}"` : '';
    return `${hold(`<a${hrefAttr}${titleAttr}${external}>`)}${label}${hold('</a>')}`;
  });

  s = s
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, '$1<strong>$2</strong>')
    .replace(/\*(?=\S)([^*]*?\S)\*/g, '<em>$1</em>')
    .replace(/(^|[^\w])_(?=\S)([^_]*?\S)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>')
    .replaceAll(BR, '<br>');

  return s.replace(new RegExp(`${HOLD}(\\d+)${HOLD}`, 'g'), (_, n) => held[Number(n)]);
}
