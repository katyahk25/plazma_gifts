const state = {
  manifest: null,
  page: null,
  data: null,
  original: null,
  fields: [],
  selectedElement: null,
  selectedField: null,
  dirty: false,
};

const els = {
  pageSelect: document.querySelector('#page-select'),
  branch: document.querySelector('#branch-pill'),
  status: document.querySelector('#save-status'),
  iframe: document.querySelector('#site-preview'),
  empty: document.querySelector('#editor-empty'),
  content: document.querySelector('#editor-content'),
  title: document.querySelector('#editor-title'),
  path: document.querySelector('#editor-path'),
  text: document.querySelector('#editor-text'),
  note: document.querySelector('#editor-note'),
  candidates: document.querySelector('#candidate-list'),
  save: document.querySelector('#save-button'),
  reload: document.querySelector('#reload-button'),
  passwordDialog: document.querySelector('#password-dialog'),
  password: document.querySelector('#admin-password'),
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalize(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function flatten(value, path = '') {
  const result = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => result.push(...flatten(item, `${path}[${index}]`)));
    return result;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => {
      const next = path ? `${path}.${key}` : key;
      result.push(...flatten(item, next));
    });
    return result;
  }
  result.push({ path, value, normalized: normalize(value) });
  return result;
}

function parsePath(path) {
  return path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
}

function setPath(root, path, value) {
  const parts = parsePath(path);
  let current = root;
  for (let i = 0; i < parts.length - 1; i += 1) current = current[parts[i]];
  current[parts.at(-1)] = value;
}

function labelFromPath(path) {
  const last = parsePath(path).at(-1) || 'Поле';
  const labels = {
    heading: 'Заголовок', title: 'Заголовок', lead: 'Описание', text: 'Текст',
    label: 'Надпись', price: 'Цена', image: 'Изображение', src: 'Изображение',
    alt: 'ALT-текст', image_alt: 'ALT-текст', kicker: 'Надзаголовок',
    description: 'Описание', question: 'Вопрос', answer: 'Ответ', url: 'Ссылка',
  };
  return labels[last] || last.replaceAll('_', ' ');
}

function setDirty(value) {
  state.dirty = value;
  els.status.textContent = value ? 'Есть несохранённые изменения' : 'Без изменений';
  els.status.style.color = value ? '#7d1736' : '#667085';
}

function ownText(element) {
  const direct = [...element.childNodes]
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.textContent)
    .join(' ');
  return normalize(direct) || normalize(element.innerText);
}

function relativeImagePath(element) {
  try {
    const url = new URL(element.currentSrc || element.src, location.href);
    return url.pathname.replace(/^\//, '');
  } catch {
    return '';
  }
}

function candidatesForElement(element) {
  if (!element) return [];
  if (element.tagName === 'IMG') {
    const image = relativeImagePath(element);
    return state.fields.filter(field => normalize(field.value).replace(/^\//, '') === image);
  }

  const text = ownText(element);
  if (!text) return [];
  let matches = state.fields.filter(field => typeof field.value === 'string' && field.normalized === text);
  if (!matches.length && text.length > 3) {
    matches = state.fields.filter(field => typeof field.value === 'string' && field.normalized && text.includes(field.normalized));
  }
  return matches;
}

function clearPreviewSelection() {
  const doc = els.iframe.contentDocument;
  if (!doc) return;
  doc.querySelectorAll('.cms-hover').forEach(node => node.classList.remove('cms-hover'));
  doc.querySelectorAll('.cms-selected').forEach(node => node.classList.remove('cms-selected'));
}

function selectField(field, element) {
  state.selectedField = field;
  state.selectedElement = element;
  els.empty.hidden = true;
  els.content.hidden = false;
  els.candidates.hidden = true;
  els.candidates.innerHTML = '';
  els.title.textContent = labelFromPath(field.path);
  els.path.textContent = `page.${field.path}`;
  els.text.value = String(field.value ?? '');
  els.note.textContent = element?.tagName === 'IMG'
    ? 'Сейчас можно менять путь к изображению. Загрузку нового файла добавим следующим шагом.'
    : 'Изменение сразу показывается в предпросмотре. Кнопка «Сохранить» записывает данные в GitHub.';
  clearPreviewSelection();
  element?.classList.add('cms-selected');
}

function showCandidates(candidates, element) {
  els.empty.hidden = true;
  els.content.hidden = false;
  els.title.textContent = 'Выберите поле';
  els.path.textContent = 'На странице найдено несколько одинаковых значений';
  els.text.value = '';
  els.candidates.innerHTML = '';
  candidates.forEach(field => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${labelFromPath(field.path)} — ${field.path}`;
    button.addEventListener('click', () => selectField(field, element));
    els.candidates.append(button);
  });
  els.candidates.hidden = false;
}

function handlePreviewClick(event) {
  event.preventDefault();
  event.stopPropagation();
  let target = event.target;
  if (!(target instanceof els.iframe.contentWindow.HTMLElement)) return;

  const candidates = candidatesForElement(target);
  if (candidates.length === 1) selectField(candidates[0], target);
  else if (candidates.length > 1) showCandidates(candidates, target);
  else {
    for (let parent = target.parentElement; parent && parent !== target.ownerDocument.body; parent = parent.parentElement) {
      const parentCandidates = candidatesForElement(parent);
      if (parentCandidates.length === 1) return selectField(parentCandidates[0], target);
      if (parentCandidates.length > 1) return showCandidates(parentCandidates, target);
    }
    els.empty.hidden = false;
    els.content.hidden = true;
  }
}

function attachPreviewEditing() {
  const doc = els.iframe.contentDocument;
  if (!doc) return;
  doc.documentElement.style.scrollBehavior = 'auto';
  doc.addEventListener('click', handlePreviewClick, true);
  doc.addEventListener('mouseover', event => {
    const target = event.target;
    if (!(target instanceof els.iframe.contentWindow.HTMLElement)) return;
    if (candidatesForElement(target).length) target.classList.add('cms-hover');
  }, true);
  doc.addEventListener('mouseout', event => event.target?.classList?.remove('cms-hover'), true);
}

function updateLivePreview(value) {
  const element = state.selectedElement;
  if (!element) return;
  if (element.tagName === 'IMG') element.src = value;
  else element.textContent = value;
}

async function loadPage(stem) {
  const page = state.manifest.pages.find(item => item.stem === stem) || state.manifest.pages[0];
  state.page = page;
  state.data = await fetch(page.data_url, { cache: 'no-store' }).then(response => response.json());
  state.original = clone(state.data);
  state.fields = flatten(state.data);
  state.selectedField = null;
  state.selectedElement = null;
  setDirty(false);
  els.empty.hidden = false;
  els.content.hidden = true;
  els.iframe.src = `../${page.output}?cms-preview=1&_=${Date.now()}`;
}

function requestPassword() {
  return new Promise(resolve => {
    const saved = sessionStorage.getItem('plazmaCmsPassword');
    if (saved) return resolve(saved);
    els.password.value = '';
    els.passwordDialog.showModal();
    const close = () => {
      els.passwordDialog.removeEventListener('close', close);
      if (els.passwordDialog.returnValue === 'default' && els.password.value) {
        sessionStorage.setItem('plazmaCmsPassword', els.password.value);
        resolve(els.password.value);
      } else resolve(null);
    };
    els.passwordDialog.addEventListener('close', close);
  });
}

async function saveCurrentPage() {
  if (!state.dirty) return;
  const password = await requestPassword();
  if (!password) return;
  els.save.disabled = true;
  els.status.textContent = 'Сохраняю…';
  try {
    const response = await fetch('/.netlify/functions/cms-save', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        password,
        branch: state.manifest.branch,
        path: state.page.source_path,
        content: state.data,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    state.original = clone(state.data);
    setDirty(false);
    els.status.textContent = 'Сохранено. Netlify пересобирает ветку.';
  } catch (error) {
    if (/password|парол|401/i.test(error.message)) sessionStorage.removeItem('plazmaCmsPassword');
    els.status.textContent = `Не сохранено: ${error.message}`;
    els.status.style.color = '#b42318';
  } finally {
    els.save.disabled = false;
  }
}

async function init() {
  state.manifest = await fetch('data/manifest.json', { cache: 'no-store' }).then(response => response.json());
  els.branch.textContent = state.manifest.branch;
  state.manifest.pages.forEach(page => {
    const option = document.createElement('option');
    option.value = page.stem;
    option.textContent = page.label;
    els.pageSelect.append(option);
  });
  els.pageSelect.addEventListener('change', () => loadPage(els.pageSelect.value));
  els.iframe.addEventListener('load', attachPreviewEditing);
  els.text.addEventListener('input', () => {
    if (!state.selectedField) return;
    const value = els.text.value;
    setPath(state.data, state.selectedField.path, value);
    state.selectedField.value = value;
    state.selectedField.normalized = normalize(value);
    updateLivePreview(value);
    setDirty(true);
  });
  els.reload.addEventListener('click', () => loadPage(state.page.stem));
  els.save.addEventListener('click', saveCurrentPage);
  window.addEventListener('beforeunload', event => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
  await loadPage(state.manifest.pages[0].stem);
}

init().catch(error => {
  document.body.innerHTML = `<pre style="padding:24px">Ошибка запуска редактора: ${String(error)}</pre>`;
});
