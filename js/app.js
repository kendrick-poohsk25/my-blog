// 해시 라우팅과 화면 그리기
import { parseMarkdown, escapeHtml } from './markdown.js';

const SITE_TITLE = '나의 블로그';
const app = document.getElementById('app');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

let postsRequest = null;
let currentRender = 0;

// ---------- 글 불러오기 ----------

async function getText(url) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${url} 을(를) 불러오지 못했습니다 (${response.status})`);
  return response.text();
}

function excerpt(html, limit = 120) {
  // DOMParser로 만든 문서는 이미지를 실제로 불러오지 않는다
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('pre, table').forEach((el) => el.remove());
  const text = doc.body.textContent.replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function buildPost(slug, source) {
  const { meta, html } = parseMarkdown(source);
  return {
    slug,
    html,
    title: meta.title || slug,
    date: meta.date || '',
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    description: meta.description || excerpt(html),
  };
}

async function fetchPosts() {
  const manifest = JSON.parse(await getText('posts/index.json'));
  const results = await Promise.allSettled(
    manifest.map(async ({ slug, file }) => buildPost(slug, await getText(`posts/${file}`))),
  );

  const posts = [];
  results.forEach((result, idx) => {
    if (result.status === 'fulfilled') posts.push(result.value);
    else console.warn(`글을 건너뜁니다: ${manifest[idx].file}`, result.reason);
  });
  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

function loadPosts() {
  postsRequest ??= fetchPosts().catch((error) => {
    postsRequest = null; // 실패하면 다음 이동 때 다시 시도한다
    throw error;
  });
  return postsRequest;
}

// ---------- 화면 조각 ----------

const postLink = (slug) => `#/post/${encodeURIComponent(slug)}`;
const tagLink = (tag) => `#/tag/${encodeURIComponent(tag)}`;

function formatDate(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? `${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}일` : date;
}

function dateHtml(date) {
  if (!date) return '';
  return `<time datetime="${escapeHtml(date)}">${escapeHtml(formatDate(date))}</time>`;
}

function tagsHtml(tags) {
  if (tags.length === 0) return '';
  const items = tags
    .map((tag) => `<li><a class="tag" href="${tagLink(tag)}"><span>#${escapeHtml(tag)}</span></a></li>`)
    .join('');
  return `<ul class="tags">${items}</ul>`;
}

function postCardHtml(post) {
  return `
    <li class="post-card">
      <article>
        <h2 class="post-card-title"><a href="${postLink(post.slug)}">${escapeHtml(post.title)}</a></h2>
        <p class="meta">${dateHtml(post.date)}</p>
        <p class="post-card-summary">${escapeHtml(post.description)}</p>
        ${tagsHtml(post.tags)}
      </article>
    </li>`;
}

function neighborHtml(post, label, className) {
  if (!post) return '<span></span>';
  return `
    <a class="${className}" href="${postLink(post.slug)}">
      <span class="neighbor-label">${label}</span>
      <span class="neighbor-title">${escapeHtml(post.title)}</span>
    </a>`;
}

// ---------- 화면 ----------

function showList(posts, tag = null) {
  const shown = tag === null ? posts : posts.filter((post) => post.tags.includes(tag));
  const header = tag === null
    ? '<h1 class="page-title">최근 글</h1>'
    : `<h1 class="page-title">#${escapeHtml(tag)}</h1><p class="muted">${shown.length}개의 글</p>`;
  const list = shown.length > 0
    ? `<ul class="post-list">${shown.map(postCardHtml).join('')}</ul>`
    : '<p class="muted">아직 글이 없습니다.</p>';
  const back = tag === null ? '' : '<p class="back-link"><a href="#/">← 전체 글 보기</a></p>';

  document.title = tag === null ? SITE_TITLE : `#${tag} · ${SITE_TITLE}`;
  app.innerHTML = `<section class="view">${header}${list}${back}</section>`;
}

function showPost(posts, slug) {
  const index = posts.findIndex((post) => post.slug === slug);
  if (index === -1) {
    showNotFound('글을 찾을 수 없습니다');
    return;
  }

  const post = posts[index];
  document.title = `${post.title} · ${SITE_TITLE}`;
  app.innerHTML = `
    <article class="view post">
      <header class="post-header">
        <h1 class="post-title">${escapeHtml(post.title)}</h1>
        <p class="meta">${dateHtml(post.date)}</p>
        ${tagsHtml(post.tags)}
      </header>
      <div class="prose">${post.html}</div>
      <footer class="post-footer">
        <nav class="neighbors" aria-label="이전·다음 글">
          ${neighborHtml(posts[index + 1], '← 이전 글', 'prev')}
          ${neighborHtml(posts[index - 1], '다음 글 →', 'next')}
        </nav>
        <p class="back-link"><a href="#/">← 목록으로</a></p>
      </footer>
    </article>`;
}

function showNotFound(message = '페이지를 찾을 수 없습니다') {
  document.title = `${message} · ${SITE_TITLE}`;
  app.innerHTML = `
    <section class="view">
      <h1 class="page-title">${escapeHtml(message)}</h1>
      <p class="muted">주소가 바뀌었거나 삭제된 글일 수 있어요.</p>
      <p class="back-link"><a href="#/">← 목록으로</a></p>
    </section>`;
}

function showError(error) {
  console.error(error);
  const hint = location.protocol === 'file:'
    ? '<p class="muted">파일을 직접 열면 글을 불러올 수 없어요. 프로젝트 폴더에서 <code>python -m http.server 8000</code>을 실행한 뒤 <code>http://localhost:8000</code>으로 접속하세요.</p>'
    : '<p class="muted">잠시 후 다시 시도해 주세요.</p>';
  document.title = `오류 · ${SITE_TITLE}`;
  app.innerHTML = `<section class="view"><h1 class="page-title">글을 불러오지 못했습니다</h1>${hint}</section>`;
}

// ---------- 라우팅 ----------

function currentRoute() {
  const path = location.hash.replace(/^#\/?/, '');
  const [view = '', ...rest] = path.split('/');
  let param = rest.join('/');
  try {
    param = decodeURIComponent(param);
  } catch {
    // 잘못 인코딩된 주소는 그대로 쓴다
  }
  return { view, param };
}

async function route() {
  const ticket = ++currentRender;
  const { view, param } = currentRoute();
  // 웹앱 카드는 메인(전체 글 목록)에서만 보여 준다
  const appsSection = document.getElementById('apps');
  if (appsSection) appsSection.hidden = view !== '';
  app.setAttribute('aria-busy', 'true');

  try {
    const posts = await loadPosts();
    if (ticket !== currentRender) return; // 기다리는 사이 다른 페이지로 이동했다

    if (view === '') showList(posts);
    else if (view === 'post') showPost(posts, param);
    else if (view === 'tag') showList(posts, param);
    else showNotFound();
  } catch (error) {
    if (ticket === currentRender) showError(error);
  } finally {
    if (ticket === currentRender) {
      app.removeAttribute('aria-busy');
      window.scrollTo(0, 0);
      app.focus({ preventScroll: true });
    }
  }
}

// 본문의 "#제목" 앵커는 라우터를 거치지 않고 그 위치로 스크롤한다
app.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  const href = link?.getAttribute('href');
  if (!href || href.startsWith('#/')) return;

  let id;
  try {
    id = decodeURIComponent(href.slice(1));
  } catch {
    return;
  }
  const target = app.querySelector('.prose')?.querySelector(`#${CSS.escape(id)}`);
  if (!target) return;

  event.preventDefault();
  target.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth' });
});

window.addEventListener('hashchange', route);
route();
