(() => {
  const iframe = document.querySelector('#site-preview');
  const pageSelect = document.querySelector('#page-select');
  const requestedPage = new URLSearchParams(location.search).get('page');
  let initialPageApplied = false;

  function syncAdminUrl(stem) {
    const url = new URL(location.href);
    url.searchParams.set('page', stem);
    history.replaceState({ page: stem }, '', `${url.pathname}${url.search}`);
  }

  function openPage(stem) {
    if (!stem || !pageSelect.querySelector(`option[value="${CSS.escape(stem)}"]`)) return false;
    pageSelect.value = stem;
    pageSelect.dispatchEvent(new Event('change', { bubbles: true }));
    setTimeout(() => {
      if (pageSelect.value === stem) syncAdminUrl(stem);
    }, 0);
    return true;
  }

  function pageStemFromUrl(url) {
    const fileName = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) || 'index.html');
    if (!fileName.endsWith('.html')) return null;
    return fileName.slice(0, -5) || 'index';
  }

  function scrollToHash(doc, hash) {
    if (!hash) return;
    try {
      doc.querySelector(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
      // Некорректный якорь не должен ломать редактор.
    }
  }

  function installNavigation() {
    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;
    if (!win || !doc) return;

    win.addEventListener('click', event => {
      const target = event.target;
      if (!(target instanceof win.HTMLElement)) return;

      const anchor = target.closest('a[href]');
      if (!anchor || event.altKey) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const rawHref = anchor.getAttribute('href') || '';
      if (!rawHref || rawHref === '#') return;

      if (rawHref.startsWith('#')) {
        scrollToHash(doc, rawHref);
        return;
      }

      let url;
      try {
        url = new URL(rawHref, win.location.href);
      } catch {
        return;
      }

      if (!['http:', 'https:'].includes(url.protocol) || url.origin !== location.origin) {
        window.open(url.href, '_blank', 'noopener');
        return;
      }

      const stem = pageStemFromUrl(url);
      if (!stem) return;

      if (stem === pageSelect.value) {
        scrollToHash(doc, url.hash);
        return;
      }

      openPage(stem);
    }, true);

    doc.querySelectorAll('a[href]').forEach(link => {
      link.title = link.title
        ? `${link.title} · Alt+клик — редактировать текст`
        : 'Клик — перейти · Alt+клик — редактировать текст ссылки';
    });

    if (!initialPageApplied && requestedPage) {
      initialPageApplied = true;
      setTimeout(() => openPage(requestedPage), 0);
    }
  }

  iframe.addEventListener('load', installNavigation);
})();
