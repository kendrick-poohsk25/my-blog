function safeDecode(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function currentSegments() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  return raw.split('/').filter(Boolean).map(safeDecode);
}

function matchPattern(pattern, segments) {
  const parts = pattern.split('/').filter(Boolean);
  if (parts.length !== segments.length) return null;
  const params = {};
  for (let i = 0; i < parts.length; i += 1) {
    if (parts[i].startsWith(':')) params[parts[i].slice(1)] = segments[i];
    else if (parts[i] !== segments[i]) return null;
  }
  return params;
}

function resolve(routes, segments) {
  for (const route of routes) {
    const params = matchPattern(route.pattern, segments);
    if (params) return { route, params };
  }
  return { route: null, params: {} };
}

export function startRouter(routes, onMatch) {
  const handle = () => onMatch(resolve(routes, currentSegments()));
  window.addEventListener('hashchange', handle);
  handle();
}

export function navigate(path) {
  const target = `#/${path}`;
  if (window.location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else window.location.hash = target;
}
