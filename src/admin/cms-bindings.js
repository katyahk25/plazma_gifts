(() => {
  const fallbackCandidatesForElement = candidatesForElement;

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
})();
