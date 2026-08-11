(() => {
  const fallbackCandidatesForElement = candidatesForElement;
  const fallbackLoadPage = loadPage;
  const fallbackSaveChanges = saveChanges;

  function explicitFieldForElement(element) {
    if (!element) return null;
    const boundElement = element.closest?.('[data-cms-path]');
    if (!boundElement) return null;

    const path = boundElement.dataset.cmsPath;
    const scope = boundElement.dataset.cmsScope || 'page';
    if (!path) return null;

    return state.fields.find(field => field.scope === scope && field.path === path) || null;
  }

  candidatesForElement = function candidatesForBoundElement(element) {
    const explicitField = explicitFieldForElement(element);
    if (explicitField) return [explicitField];
    return fallbackCandidatesForElement(element);
  };

  function saveStatus() {
    return String(els.status?.textContent || '').trim();
  }

  function saveInProgress() {
    return saveStatus().startsWith('Сохраняю');
  }

  function savedSuccessfully() {
    return saveStatus().startsWith('Сохранено');
  }

  function hasEmbeddedData(page) {
    return Boolean(page && page.data && state.manifest?.site_data);
  }

  async function loadEmbeddedPage(stem, options = {}) {
    const { force = false, hash = '' } = options;
    const page = pageFromStem(stem);

    if (!page) {
      setStatus(`Страница «${stem}» не найдена в CMS`, 'error');
      if (state.page) els.pageSelect.value = state.page.stem;
      return false;
    }

    const switching = state.page && state.page.stem !== page.stem;
    if (!force && switching && hasUnsavedChanges()) {
      const discard = window.confirm('Есть несохранённые изменения. Сбросить их и перейти на другую страницу?');
      if (!discard) {
        els.pageSelect.value = state.page.stem;
        return false;
      }
    }

    revokeObjectUrls();
    state.page = page;
    state.docs.page = clone(page.data);
    state.docs.site = clone(state.manifest.site_data);
    state.original.page = clone(state.docs.page);
    state.original.site = clone(state.docs.site);
    state.pendingUploads.clear();
    state.blockElements.clear();
    state.pendingPreviewHash = hash;

    rebuildFields();
    clearDirty();
    syncSeoFields();
    renderBlockList();
    clearSelection();
    els.pageSelect.value = page.stem;
    syncAdminUrl(page.stem);
    els.iframe.src = `../${page.output}?cms-preview=1&_=${Date.now()}`;
    return true;
  }

  loadPage = async function loadPageFromSession(stem, options = {}) {
    if (saveInProgress()) {
      if (state.page) els.pageSelect.value = state.page.stem;
      setStatus('Сохранение ещё выполняется. Дождитесь сообщения «Сохранено» и затем переходите.', 'neutral');
      return false;
    }

    if (savedSuccessfully()) {
      state.dirtyScopes.clear();
      state.pendingUploads.clear();
    }

    const page = pageFromStem(stem);
    if (hasEmbeddedData(page)) return loadEmbeddedPage(stem, options);
    return fallbackLoadPage(stem, options);
  };

  saveChanges = async function saveChangesAndRefreshSession() {
    await fallbackSaveChanges();

    if (!savedSuccessfully()) return;
    if (state.page) state.page.data = clone(state.docs.page);
    if (state.manifest) state.manifest.site_data = clone(state.docs.site);
    state.original.page = clone(state.docs.page);
    state.original.site = clone(state.docs.site);
    state.dirtyScopes.clear();
    state.pendingUploads.clear();
  };
})();
