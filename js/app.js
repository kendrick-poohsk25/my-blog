// 해시 라우팅과 화면 렌더링
import { parseMarkdown, escapeHtml } from './markdown.js';

const SITE_TITLE = '나의 블로그';
const app = document.getElementById('app');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let postsPromise = null;
let renderToken = 0;

// ---------- 데이터 ----------

async function fetchText(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url} 을(를) 불러오지 못했습니다 (${res.status})`);
  return res.text();
}

function summarize(html, max = 120) {
  // DOMParser 문서는 이미지 등을 실제로 불러오지 않아 안전하다
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('pre, table').forEach((el) => el.remove());
  const text = doc.body.textContent.replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function toPost(slug, source) {
  const { meta, html } = parseMarkdown(source);
  return {
    slug,
    title: meta.title || slug,
    date: meta.date || '',
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    description: meta.description || summarize(html),
    html,
  };
}

function loadPosts() {
  if (!postsPromise) {
    postsPromise = (async () => {
      const manifest = JSON.parse(await fetchText('posts/index.json'));
      const results = await Promise.allSettled(
        manifest.map(async ({ slug, file }) => toPost(slug, await fetchText(`posts/${file}`))),
      );
      const posts = [];
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') posts.push(result.value);
        else console.warn(`글을 건너뜁니다: ${manifest[idx].file}`, result.reason);
      });
      return posts.sort((a, b) => b.date.localeCompare(a.date));
    })().catch((err) => {
      postsPromise = null; // 다음 이동 때 다시 시도할 수 있게 한다
      throw err;
    });
  }
  return postsPromise;
}

// ---------- 화면 조각 ----------

function formatDate(date) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일` : date;
}

const postHref = (slug) => `#/post/${encodeURIComponent(slug)}`;
const tagHref = (tag) => `#/tag/${encodeURIComponent(tag)}`;

function dateHtml(date) {
  return date ? `<time datetime="${escapeHtml(date)}">${escapeHtml(formatDate(date))}</time>` : '';
}

function tagsHtml(tags) {
  if (!tags.length) return '';
  const items = tags
    .map((tag) => `<li><a class="tag" href="${tagHref(tag)}"><span>#${escapeHtml(tag)}</span></a></li>`)
    .join('');
  return `<ul class="tags">${items}</ul>`;
}

function cardHtml(post) {
  return `
    <li class="post-card">
      <article>
        <h2 class="post-card-title"><a href="${postHref(post.slug)}">${escapeHtml(post.title)}</a></h2>
        <div class="meta">${dateHtml(post.date)}</div>
        <p class="post-card-desc">${escapeHtml(post.description)}</p>
        ${tagsHtml(post.tags)}
      </article>
    </li>`;
}

// ---------- 화면 ----------

function renderList(posts, tag) {
  const list = tag ? posts.filter((p) => p.tags.includes(tag)) : posts;
  const heading = tag
    ? `<h1 class="page-title">#${escapeHtml(tag)}</h1><p class="page-sub">${list.length}개의 글</p>`
    : '<h1 class="page-title">최근 글</h1>';
  const body = list.length
    ? `<ul class="post-list">${list.map(cardHtml).join('')}</ul>`
    : '<p class="status">아직 글이 없습니다.</p>';
  const back = tag ? '<p class="back"><a href="#/">← 전체 글 보기</a></p>' : '';

  document.title = tag ? `#${tag} · ${SITE_TITLE}` : SITE_TITLE;
  app.innerHTML = `<section class="view">${heading}${body}${back}</section>`;
}

function renderPost(posts, slug) {
  const idx = posts.findIndex((p) => p.slug === slug);
  if (idx < 0) return renderNotFound('글을 찾을 수 없습니다');

  const post = posts[idx];
  const newer = posts[idx - 1];
  const older = posts[idx + 1];
  const navLink = (p, label, cls) =>
    p ? `<a class="${cls}" href="${postHref(p.slug)}"><span class="nav-label">${label}</span><span class="nav-title">${escapeHtml(p.title)}</span></a>` : '<span></span>';

  document.title = `${post.title} · ${SITE_TITLE}`;
  app.innerHTML = `
    <article class="view post">
      <header class="post-header">
        <h1 class="post-title">${escapeHtml(post.title)}</h1>
        <div class="meta">${dateHtml(post.date)}</div>
        ${tagsHtml(post.tags)}
      </header>
      <div class="prose">${post.html}</div>
      <footer class="post-footer">
        <nav class="post-nav" aria-label="이전·다음 글">
          ${navLink(older, '← 이전 글', 'prev')}
          ${navLink(newer, '다음 글 →', 'next')}
        </nav>
        <p class="back"><a href="#/">← 목록으로</a></p>
      </footer>
    </article>`;
}

function renderNotFound(message = '페이지를 찾을 수 없습니다') {
  document.title = `${message} · ${SITE_TITLE}`;
  app.innerHTML = `
    <section class="view empty">
      <h1 class="page-title">${escapeHtml(message)}</h1>
      <p class="status">주소가 바뀌었거나 삭제된 글일 수 있어요.</p>
      <p class="back"><a href="#/">← 목록으로</a></p>
    </section>`;
}

function renderError(err) {
  console.error(err);
  const hint = location.protocol === 'file:'
    ? '<p class="status">파일을 직접 열면 글을 불러올 수 없어요. 프로젝트 폴더에서 <code>python -m http.server 8000</code>을 실행한 뒤 <code>http://localhost:8000</code>으로 접속하세요.</p>'
    : '<p class="status">잠시 후 다시 시도해 주세요.</p>';
  document.title = `오류 · ${SITE_TITLE}`;
  app.innerHTML = `<section class="view empty"><h1 class="page-title">글을 불러오지 못했습니다</h1>${hint}</section>`;
}

// ---------- 라우팅 ----------

function parseRoute() {
  const path = location.hash.replace(/^#\/?/, '');
  const [view = '', ...rest] = path.split('/');
  let param = rest.join('/');
  try {
    param = decodeURIComponent(param);
  } catch {
    // 잘못 인코딩된 주소는 그대로 사용한다
  }
  return { view, param };
}

async function router() {
  const token = ++renderToken;
  const { view, param } = parseRoute();
  app.setAttribute('aria-busy', 'true');

  try {
    const posts = await loadPosts();
    if (token !== renderToken) return; // 그 사이 다른 페이지로 이동했다
    if (view === '') renderList(posts);
    else if (view === 'post') renderPost(posts, param);
    else if (view === 'tag') renderList(posts, param);
    else renderNotFound();
  } catch (err) {
    if (token === renderToken) renderError(err);
  } finally {
    if (token === renderToken) {
      app.removeAttribute('aria-busy');
      window.scrollTo(0, 0);
      app.focus({ preventScroll: true });
    }
  }
}

// 본문 속 "#제목" 앵커는 라우터 대신 해당 위치로 스크롤한다
app.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  const href = link?.getAttribute('href');
  if (!href || href.startsWith('#/')) return;

  let id = href.slice(1);
  try {
    id = decodeURIComponent(id);
  } catch {
    return;
  }
  const target = app.querySelector('.prose')?.querySelector(`#${CSS.escape(id)}`);
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth' });
});

window.addEventListener('hashchange', router);
router();
