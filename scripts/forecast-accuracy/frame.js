// Only runs inside the article's isolated chart documents.
function updateLinks() {
  for (const link of document.querySelectorAll('a[href][download]')) {
    const url = new URL(link.getAttribute('href'), location.href);
    if (url.origin === location.origin && /\/data\/.*\.json$/.test(url.pathname)) link.href = url.pathname + '.gz';
  }
}
function start() {
  if (!document.body) return;
  updateLinks();
  new MutationObserver(updateLinks).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
  if (window.parent !== window) {
    document.documentElement.classList.add('article-embedded');
    document.querySelectorAll('[data-article-back]').forEach(link => link.target = '_top');
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
