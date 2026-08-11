(() => {
  const originalLoadPage = loadPage;
  const originalHandlePreviewClick = handlePreviewClick;
  const originalAttachPreviewEditing = attachPreviewEditing;
  const requestedPage = new URLSearchParams(location.search).get('page');
  let firstLoad = true;
  let pendingHash = '';

  function hasUnsavedChanges() {
    return state.dirtyScopes.size > 0 || state.pendingUploads.size > 0;
  }

  function confirmNavigation() {
    return !hasUnsavedChanges()
      || window.confirm('Есть несохранённые изменения. Сбросить их и перейти на другую страницу?');
  }

  function pageFromUrl(url) {
    const fileName = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) || 'index.html');
    return state.manifest?.pages?.find(page => page.output === fileName) || null;
  }

  function scrollPreviewToHash(hash) {
    if (!hash) return;
    const doc = els.iframe.contentDocument;
    if (!doc) return;
    try {
      doc.querySelector(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
      // Некорректный якорь просто игнорируем.
    }
  }

  loadPage = async function loadPageWithAdminUrl(stem) {
    if (firstLoad && requestedPage && state.manifest?.pages?.some(page => page.stem === requestedPage)) {
      stem = requestedPage;
    }
    firstLoad = false;

    await originalLoadPage(stem);
    els.pageSelect.value = state.page.stem;

    const adminUrl = new URL(location.href);
    adminUrl.searchParams.set('page', state.page.stem);
    history.replaceState({ page: state.page.stem }, '', `${adminUrl.pathname}${adminUrl.search}`);
  };

  handlePreviewClick = function handlePreviewNavigation(event) {
    const target = event.target;
    if (!(target instanceof els.iframe.contentWindow.HTMLElement)) return;

    const anchor = target.closest('a[href]');
    if (!anchor || event.altKey) {
      return originalHandlePreviewClick(event);
    }

    event.preventDefault();
    event.stopPropagation();

    const rawHref = anchor.getAttribute('href') || '';
    if (!rawHref || rawHref === '#') return;

    if (rawHref.startsWith('#')) {
      scrollPreviewToHash(rawHref);
      return;
    }

    let url;
    try {
      url = new URL(rawHref, els.iframe.contentWindow.location.href);
    } catch {
      return;
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
      window.open(url.href, '_blank', 'noopener');
      return;
    }

    if (url.origin !== location.origin) {
      window.open(url.href, '_blank', 'noopener');
      return;
    }

    const page = pageFromUrl(url);
    if (!page) {
      if (url.hash) scrollPreviewToHash(url.hash);
      return;
    }

    if (page.stem === state.page?.stem) {
      if (url.hash) scrollPreviewToHash(url.hash);
      return;
    }

    if (!confirmNavigation()) return;
    pendingHash = url.hash;
    loadPage(page.stem);
  };

  attachPreviewEditing = function attachPreviewEditingWithNavigation() {
    originalAttachPreviewEditing();

    const doc = els.iframe.contentDocument;
    if (doc) {
      doc.querySelectorAll('a[href]').forEach(link => {
        link.title = link.title
          ? `${link.title} · Alt+клик — редактировать ссылку`
          : 'Клик — перейти · Alt+клик — редактировать текст ссылки';
      });
    }

    if (pendingHash) {
      const hash = pendingHash;
      pendingHash = '';
      requestAnimationFrame(() => scrollPreviewToHash(hash));
    }
  };

  const hint = document.querySelector('.preview-hint');
  if (hint) {
    hint.textContent = 'Клик по ссылке — перейти · клик по обычному тексту — редактировать · Alt+клик по ссылке — редактировать её текст';
  }
})();
