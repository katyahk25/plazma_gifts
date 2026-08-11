(() => {
  const fallbackCandidatesForElement = candidatesForElement;
  const fallbackLoadPage = loadPage;

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

  loadPage = async function loadPageWithSaveGuard(stem, options = {}) {
    if (saveInProgress()) {
      if (state.page) els.pageSelect.value = state.page.stem;
      setStatus('Сохранение ещё выполняется. Дождитесь сообщения «Сохранено» и затем переходите.', 'neutral');
      return false;
    }

    if (savedSuccessfully()) {
      state.dirtyScopes.clear();
      state.pendingUploads.clear();
    }

    return fallbackLoadPage(stem, options);
  };
})();
