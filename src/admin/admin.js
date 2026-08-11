const state = {
  manifest: null,
  page: null,
  docs: { page: null, site: null },
  original: { page: null, site: null },
  fields: [],
  selectedElement: null,
  selectedField: null,
  selectedItem: null,
  selectedBlockKey: null,
  dirtyScopes: new Set(),
  pendingUploads: new Map(),
  objectUrls: new Set(),
  blockElements: new Map(),
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
  imageTools: document.querySelector('#image-tools'),
  imagePreview: document.querySelector('#image-preview'),
  imageFile: document.querySelector('#image-file'),
  blockControl: document.querySelector('#block-control'),
  blockControlTitle: document.querySelector('#block-control-title'),
  blockVisible: document.querySelector('#block-visible'),
  itemActions: document.querySelector('#item-actions'),
  blockList: document.querySelector('#block-list'),
  seoTitle: document.querySelector('#seo-title'),
  seoDescription: document.querySelector('#seo-description'),
};

const BLOCK_LABELS = {
  hero: 'Первый экран',
  directions: 'Направления',
  catalog: 'Популярные заказы',
  portfolio: 'Примеры работ',
  advantages: 'Преимущества',
  process: 'Этапы заказа',
  request: 'Форма заявки',
  faq: 'Частые вопросы',
  gallery: 'Галерея',
  summary: 'Краткие карточки',
  benefits: 'Преимущества',
  price_includes: 'Что входит в стоимость',
  constructor: 'Конструктор гравировки',
  delivery_info: 'Доставка',
  form: 'Форма',
};

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalize(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function parsePath(path) {
  return path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
}

function getPath(root, path) {
  let current = root;
  for (const part of parsePath(path)) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function setPath(root, path, value) {
  const parts = parsePath(path);
  let current = root;
  for (let i = 0; i < parts.length - 1; i += 1) current = current[parts[i]];
  current[parts.at(-1)] = value;
}

function flatten(value, path = '', scope = 'page') {
  const result = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => result.push(...flatten(item, `${path}[${index}]`, scope)));
    return result;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => {
      const next = path ? `${path}.${key}` : key;
      result.push(...flatten(item, next, scope));
    });
    return result;
  }
  result.push({ scope, path, value, normalized: normalize(value) });
  return result;
}

function rebuildFields() {
  state.fields = [
    ...flatten(state.docs.page, '', 'page'),
    ...flatten(state.docs.site, '', 'site'),
  ];
}

function docForScope(scope) {
  return state.docs[scope];
}

function scopeLabel(scope) {
  return scope === 'site' ? 'site' : 'page';
}

function fieldKey(field) {
  return `${field.scope}:${field.path}`;
}

function labelFromPath(path) {
  const last = parsePath(path).at(-1) || 'Поле';
  const labels = {
    heading: 'Заголовок', title: 'Заголовок', lead: 'Описание', text: 'Текст',
    label: 'Надпись', price: 'Цена', image: 'Изображение', src: 'Изображение',
    alt: 'ALT-текст', image_alt: 'ALT-текст', kicker: 'Надзаголовок',
    description: 'Описание', question: 'Вопрос', answer: 'Ответ', url: 'Ссылка',
    breadcrumb: 'Хлебные крошки', hint: 'Подсказка', note: 'Примечание',
  };
  return labels[last] || last.replaceAll('_', ' ');
}

function blockLabel(key, block) {
  return BLOCK_LABELS[key]
    || block?.heading
    || block?.title
    || block?.kicker
    || key.replaceAll('_', ' ');
}

function syncDirtyUi(message = null) {
  const dirty = state.dirtyScopes.size > 0 || state.pendingUploads.size > 0;
  els.save.disabled = !dirty;
  els.status.textContent = message || (dirty ? 'Есть несохранённые изменения' : 'Без изменений');
  els.status.style.color = dirty ? '#7d1736' : '#667085';
}

function markDirty(scope, message = null) {
  state.dirtyScopes.add(scope);
  syncDirtyUi(message);
}

function clearDirty() {
  state.dirtyScopes.clear();
  state.pendingUploads.clear();
  syncDirtyUi();
}

function ownText(element) {
  const direct = [...element.childNodes]
    .filter(node => node.nodeType === 3)
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

function isImageField(field) {
  const last = parsePath(field.path).at(-1);
  return ['image', 'src', 'hero_image', 'background_image', 'thumbnail'].includes(last)
    || (typeof field.value === 'string' && /^\/?assets\/images\//.test(field.value));
}

function candidatesForElement(element) {
  if (!element) return [];
  if (element.tagName === 'IMG') {
    const image = relativeImagePath(element);
    return state.fields.filter(field => (
      typeof field.value === 'string'
      && normalize(field.value).replace(/^\//, '') === image
    ));
  }

  const text = ownText(element);
  if (!text) return [];

  const visibleFields = state.fields.filter(field => {
    if (typeof field.value !== 'string' || !field.normalized) return false;
    const last = parsePath(field.path).at(-1);
    return !['url', 'src', 'image', 'image_alt', 'alt', 'class_name', 'card_class', 'active_class'].includes(last);
  });

  let matches = visibleFields.filter(field => field.normalized === text);
  if (!matches.length && text.length > 3) {
    matches = visibleFields.filter(field => field.normalized.length > 2 && text.includes(field.normalized));
  }
  return matches;
}

function findDescendantCandidates(element) {
  const nodes = element.querySelectorAll?.('h1,h2,h3,h4,p,span,strong,a,img,summary') || [];
  for (const node of nodes) {
    const candidates = candidatesForElement(node);
    if (candidates.length) return { candidates, element: node };
  }
  return null;
}

function clearPreviewSelection() {
  const doc = els.iframe.contentDocument;
  if (!doc) return;
  doc.querySelectorAll('.cms-hover').forEach(node => node.classList.remove('cms-hover'));
  doc.querySelectorAll('.cms-selected').forEach(node => node.classList.remove('cms-selected'));
}

function topBlockKey(field) {
  if (!field || field.scope !== 'page') return null;
  const key = parsePath(field.path)[0];
  const block = state.docs.page?.[key];
  return block && typeof block === 'object' && typeof block.visible === 'boolean' ? key : null;
}

function itemContextForField(field, element) {
  if (!field) return null;
  const match = field.path.match(/^(.*)\[(\d+)\](?:\..*)?$/);
  if (!match) return null;
  const arrayPath = match[1];
  const index = Number(match[2]);
  const array = getPath(docForScope(field.scope), arrayPath);
  if (!Array.isArray(array) || !Number.isInteger(index) || index < 0 || index >= array.length) return null;

  let itemElement = element;
  if (arrayPath.endsWith('.tags')) {
    itemElement = element?.closest?.('.tags > span') || element;
  } else if (arrayPath.endsWith('.images')) {
    itemElement = element?.closest?.('button') || element?.closest?.('img') || element;
  } else if (field.scope === 'page') {
    itemElement = element?.closest?.('article,li,details') || element;
  }

  return { scope: field.scope, arrayPath, index, array, element: itemElement };
}

function updateBlockControl() {
  const key = topBlockKey(state.selectedField);
  state.selectedBlockKey = key;
  if (!key) {
    els.blockControl.hidden = true;
    return;
  }
  const block = state.docs.page[key];
  els.blockControl.hidden = false;
  els.blockControlTitle.textContent = blockLabel(key, block);
  els.blockVisible.checked = Boolean(block.visible);
}

function updateItemActions() {
  state.selectedItem = itemContextForField(state.selectedField, state.selectedElement);
  els.itemActions.hidden = !state.selectedItem;
  if (!state.selectedItem) return;
  const buttons = els.itemActions.querySelectorAll('[data-item-action]');
  buttons.forEach(button => {
    const action = button.dataset.itemAction;
    if (action === 'up') button.disabled = state.selectedItem.index === 0;
    else if (action === 'down') button.disabled = state.selectedItem.index === state.selectedItem.array.length - 1;
    else button.disabled = false;
  });
}

function selectField(field, element) {
  state.selectedField = field;
  state.selectedElement = element;
  els.empty.hidden = true;
  els.content.hidden = false;
  els.candidates.hidden = true;
  els.candidates.innerHTML = '';
  els.title.textContent = labelFromPath(field.path);
  els.path.textContent = `${scopeLabel(field.scope)}.${field.path}`;
  els.text.value = String(field.value ?? '');

  const image = isImageField(field) || element?.tagName === 'IMG';
  els.imageTools.hidden = !image;
  if (image) {
    const pending = state.pendingUploads.get(fieldKey(field));
    els.imagePreview.src = pending?.previewUrl || element?.currentSrc || element?.src || field.value || '';
    els.note.textContent = 'Выберите новый файл или измените путь вручную. Новое изображение попадёт в GitHub вместе с остальными изменениями после «Сохранить».';
  } else {
    els.note.textContent = 'Изменение сразу показывается в предпросмотре. После «Сохранить» оно записывается в данные сайта.';
  }

  updateBlockControl();
  updateItemActions();
  clearPreviewSelection();
  element?.classList.add('cms-selected');
}

function showCandidates(candidates, element) {
  els.empty.hidden = true;
  els.content.hidden = false;
  els.title.textContent = 'Выберите поле';
  els.path.textContent = 'На странице найдено несколько одинаковых значений';
  els.text.value = '';
  els.imageTools.hidden = true;
  els.blockControl.hidden = true;
  els.itemActions.hidden = true;
  els.candidates.innerHTML = '';
  candidates.forEach(field => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${scopeLabel(field.scope)} · ${labelFromPath(field.path)} — ${field.path}`;
    button.addEventListener('click', () => selectField(field, element));
    els.candidates.append(button);
  });
  els.candidates.hidden = false;
}

function clearSelection(message = null) {
  clearPreviewSelection();
  state.selectedField = null;
  state.selectedElement = null;
  state.selectedItem = null;
  state.selectedBlockKey = null;
  els.content.hidden = true;
  els.empty.hidden = false;
  if (message) {
    els.empty.innerHTML = `<strong>${message}</strong><p>Выберите следующий элемент на странице.</p>`;
  }
}

function handlePreviewClick(event) {
  event.preventDefault();
  event.stopPropagation();
  let target = event.target;
  if (!(target instanceof els.iframe.contentWindow.HTMLElement)) return;

  let candidates = candidatesForElement(target);
  if (candidates.length === 1) return selectField(candidates[0], target);
  if (candidates.length > 1) return showCandidates(candidates, target);

  const descendant = findDescendantCandidates(target);
  if (descendant) {
    if (descendant.candidates.length === 1) return selectField(descendant.candidates[0], descendant.element);
    return showCandidates(descendant.candidates, descendant.element);
  }

  for (let parent = target.parentElement; parent && parent !== target.ownerDocument.body; parent = parent.parentElement) {
    candidates = candidatesForElement(parent);
    if (candidates.length === 1) return selectField(candidates[0], target);
    if (candidates.length > 1) return showCandidates(candidates, target);
  }
  clearSelection('У этого элемента пока нет отдельного поля');
}

function injectPreviewStyles(doc) {
  const style = doc.createElement('style');
  style.dataset.cmsEditor = 'true';
  style.textContent = `
    .cms-hover { outline: 2px solid #7d1736 !important; outline-offset: 2px !important; cursor: pointer !important; }
    .cms-selected { outline: 3px solid #7d1736 !important; outline-offset: 2px !important; }
    [data-cms-hidden-preview="true"] { display: none !important; }
  `;
  doc.head.append(style);
}

function attachPreviewEditing() {
  const doc = els.iframe.contentDocument;
  if (!doc) return;
  state.blockElements.clear();
  injectPreviewStyles(doc);
  doc.documentElement.style.scrollBehavior = 'auto';
  doc.addEventListener('click', handlePreviewClick, true);
  doc.addEventListener('mouseover', event => {
    const target = event.target;
    if (!(target instanceof els.iframe.contentWindow.HTMLElement)) return;
    if (candidatesForElement(target).length || findDescendantCandidates(target)) target.classList.add('cms-hover');
  }, true);
  doc.addEventListener('mouseout', event => event.target?.classList?.remove('cms-hover'), true);
}

function updateLivePreview(value, oldValue) {
  const element = state.selectedElement;
  if (!element) return;

  if (element.tagName === 'IMG') {
    element.src = value;
    return;
  }

  const directNodes = [...element.childNodes].filter(node => node.nodeType === 3);
  const matchingNode = directNodes.find(node => normalize(node.textContent) === normalize(oldValue));
  if (matchingNode) {
    matchingNode.textContent = value;
    return;
  }
  if (element.children.length === 0) element.textContent = value;
}

function findBlockElement(key) {
  const cached = state.blockElements.get(key);
  if (cached?.isConnected) return cached;

  const doc = els.iframe.contentDocument;
  const block = state.docs.page?.[key];
  if (!doc || !block) return null;
  const blockFields = flatten(block, key, 'page')
    .filter(field => typeof field.value === 'string' && field.normalized.length > 2)
    .sort((a, b) => b.normalized.length - a.normalized.length);

  const nodes = [...doc.querySelectorAll('h1,h2,h3,h4,p,span,strong,a')];
  for (const field of blockFields) {
    const node = nodes.find(candidate => normalize(candidate.textContent) === field.normalized);
    const section = node?.closest('section');
    if (section) {
      state.blockElements.set(key, section);
      return section;
    }
  }
  return null;
}

function applyBlockVisibility(key, visible) {
  const section = findBlockElement(key);
  if (section) section.dataset.cmsHiddenPreview = visible ? 'false' : 'true';
  else if (visible) syncDirtyUi('Блок появится после сохранения и пересборки превью');
}

function renderBlockList() {
  els.blockList.innerHTML = '';
  Object.entries(state.docs.page || {}).forEach(([key, block]) => {
    if (!block || typeof block !== 'object' || typeof block.visible !== 'boolean') return;
    const row = document.createElement('div');
    row.className = 'block-row';
    row.innerHTML = `
      <div><strong></strong><small>${key}</small></div>
      <label class="switch"><input type="checkbox"><span></span></label>
    `;
    row.querySelector('strong').textContent = blockLabel(key, block);
    const checkbox = row.querySelector('input');
    checkbox.checked = block.visible;
    checkbox.addEventListener('change', () => {
      block.visible = checkbox.checked;
      markDirty('page');
      applyBlockVisibility(key, checkbox.checked);
      if (state.selectedBlockKey === key) els.blockVisible.checked = checkbox.checked;
    });
    els.blockList.append(row);
  });

  if (!els.blockList.children.length) {
    els.blockList.innerHTML = '<div style="padding:0 8px 10px;color:#8a94a3;font-size:11px">На этой странице нет переключаемых блоков.</div>';
  }
}

function syncSeoFields() {
  els.seoTitle.value = state.docs.page?.seo?.title || '';
  els.seoDescription.value = state.docs.page?.seo?.description || '';
}

function revokeObjectUrls() {
  state.objectUrls.forEach(url => URL.revokeObjectURL(url));
  state.objectUrls.clear();
}

async function loadPage(stem) {
  const page = state.manifest.pages.find(item => item.stem === stem) || state.manifest.pages[0];
  state.page = page;
  revokeObjectUrls();

  const [pageData, siteData] = await Promise.all([
    fetch(page.data_url, { cache: 'no-store' }).then(response => response.json()),
    fetch(state.manifest.site_data_url, { cache: 'no-store' }).then(response => response.json()),
  ]);

  state.docs.page = pageData;
  state.docs.site = siteData;
  state.original.page = clone(pageData);
  state.original.site = clone(siteData);
  state.pendingUploads.clear();
  state.blockElements.clear();
  rebuildFields();
  clearDirty();
  syncSeoFields();
  renderBlockList();
  clearSelection();
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

function uint8ToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}

async function prepareImageUpload(file) {
  if (!IMAGE_TYPES.has(file.type)) throw new Error('Поддерживаются JPG, PNG, WEBP и GIF.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Файл больше 4 МБ. Сначала уменьшите изображение.');

  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const token = Math.random().toString(36).slice(2, 8);
  const fileName = `cms-${Date.now()}-${token}.${extension}`;
  const publicPath = `assets/images/uploads/${fileName}`;
  const repositoryPath = `public/${publicPath}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const content = uint8ToBase64(bytes);
  const previewUrl = URL.createObjectURL(file);
  state.objectUrls.add(previewUrl);
  return { publicPath, repositoryPath, content, previewUrl, size: file.size };
}

async function saveChanges() {
  if (!state.dirtyScopes.size && !state.pendingUploads.size) return;
  const password = await requestPassword();
  if (!password) return;

  const changes = [];
  if (state.dirtyScopes.has('page')) {
    changes.push({
      path: state.page.source_path,
      encoding: 'utf-8',
      content: `${JSON.stringify(state.docs.page, null, 2)}\n`,
    });
  }
  if (state.dirtyScopes.has('site')) {
    changes.push({
      path: state.manifest.site_source_path,
      encoding: 'utf-8',
      content: `${JSON.stringify(state.docs.site, null, 2)}\n`,
    });
  }
  state.pendingUploads.forEach(upload => {
    changes.push({ path: upload.repositoryPath, encoding: 'base64', content: upload.content });
  });

  els.save.disabled = true;
  els.status.textContent = 'Сохраняю…';
  els.status.style.color = '#667085';

  try {
    const response = await fetch('/.netlify/functions/cms-save', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        password,
        branch: state.manifest.branch,
        changes,
        message: `CMS: ${state.page.label}`,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);

    state.original.page = clone(state.docs.page);
    state.original.site = clone(state.docs.site);
    clearDirty();
    els.status.textContent = `Сохранено · ${String(result.commit || '').slice(0, 7)} · Netlify пересобирает ветку`;
    els.status.style.color = '#18794e';
  } catch (error) {
    if (/password|парол|401/i.test(error.message)) sessionStorage.removeItem('plazmaCmsPassword');
    els.status.textContent = `Не сохранено: ${error.message}`;
    els.status.style.color = '#b42318';
    els.save.disabled = false;
  }
}

function updateSelectedFieldValue(value, previewValue = value) {
  const field = state.selectedField;
  if (!field) return;
  const doc = docForScope(field.scope);
  const oldValue = field.value;
  setPath(doc, field.path, value);
  field.value = value;
  field.normalized = normalize(value);
  updateLivePreview(previewValue, oldValue);
  markDirty(field.scope);
}

function moveDomItem(element, direction) {
  if (!element?.parentElement) return;
  if (direction < 0) {
    const previous = element.previousElementSibling;
    if (previous) element.parentElement.insertBefore(element, previous);
  } else {
    const next = element.nextElementSibling;
    if (next) element.parentElement.insertBefore(next, element);
  }
}

function handleItemAction(action) {
  const context = state.selectedItem;
  if (!context) return;
  const doc = docForScope(context.scope);
  const array = getPath(doc, context.arrayPath);
  if (!Array.isArray(array)) return;

  if (action === 'up' && context.index > 0) {
    [array[context.index - 1], array[context.index]] = [array[context.index], array[context.index - 1]];
    moveDomItem(context.element, -1);
    markDirty(context.scope);
    rebuildFields();
    return clearSelection('Элемент перемещён выше');
  }

  if (action === 'down' && context.index < array.length - 1) {
    [array[context.index + 1], array[context.index]] = [array[context.index], array[context.index + 1]];
    moveDomItem(context.element, 1);
    markDirty(context.scope);
    rebuildFields();
    return clearSelection('Элемент перемещён ниже');
  }

  if (action === 'duplicate') {
    const copy = clone(array[context.index]);
    array.splice(context.index + 1, 0, copy);
    if (context.element?.parentElement) {
      const cloneNode = context.element.cloneNode(true);
      context.element.insertAdjacentElement('afterend', cloneNode);
    }
    markDirty(context.scope);
    rebuildFields();
    return clearSelection('Добавлена копия — нажмите на её текст и измените содержимое');
  }

  if (action === 'delete') {
    if (!window.confirm('Удалить этот элемент из списка?')) return;
    array.splice(context.index, 1);
    context.element?.remove();
    markDirty(context.scope);
    rebuildFields();
    return clearSelection('Элемент удалён');
  }
}

async function handleImageFile() {
  const file = els.imageFile.files?.[0];
  const field = state.selectedField;
  if (!file || !field) return;
  try {
    const upload = await prepareImageUpload(file);
    const key = fieldKey(field);
    const previous = state.pendingUploads.get(key);
    if (previous?.previewUrl) {
      URL.revokeObjectURL(previous.previewUrl);
      state.objectUrls.delete(previous.previewUrl);
    }
    state.pendingUploads.set(key, upload);
    updateSelectedFieldValue(upload.publicPath, upload.previewUrl);
    els.text.value = upload.publicPath;
    els.imagePreview.src = upload.previewUrl;
    els.note.textContent = 'Новое изображение выбрано. Оно загрузится в GitHub вместе с JSON после нажатия «Сохранить».';
  } catch (error) {
    els.note.textContent = error.message;
  } finally {
    els.imageFile.value = '';
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

  els.pageSelect.addEventListener('change', async () => {
    if ((state.dirtyScopes.size || state.pendingUploads.size) && !window.confirm('Сбросить несохранённые изменения и открыть другую страницу?')) {
      els.pageSelect.value = state.page.stem;
      return;
    }
    await loadPage(els.pageSelect.value);
  });

  els.iframe.addEventListener('load', attachPreviewEditing);

  els.text.addEventListener('input', () => {
    if (!state.selectedField) return;
    updateSelectedFieldValue(els.text.value);
    if (!els.imageTools.hidden) els.imagePreview.src = els.text.value;
  });

  els.imageFile.addEventListener('change', handleImageFile);

  els.blockVisible.addEventListener('change', () => {
    const key = state.selectedBlockKey;
    if (!key) return;
    state.docs.page[key].visible = els.blockVisible.checked;
    markDirty('page');
    applyBlockVisibility(key, els.blockVisible.checked);
    renderBlockList();
  });

  els.itemActions.addEventListener('click', event => {
    const button = event.target.closest('[data-item-action]');
    if (button) handleItemAction(button.dataset.itemAction);
  });

  els.seoTitle.addEventListener('input', () => {
    state.docs.page.seo.title = els.seoTitle.value;
    markDirty('page');
  });

  els.seoDescription.addEventListener('input', () => {
    state.docs.page.seo.description = els.seoDescription.value;
    markDirty('page');
  });

  document.querySelectorAll('[data-toggle-target]').forEach(button => {
    button.addEventListener('click', () => {
      const target = document.getElementById(button.dataset.toggleTarget);
      target.hidden = !target.hidden;
    });
  });

  els.reload.addEventListener('click', async () => {
    if ((state.dirtyScopes.size || state.pendingUploads.size) && !window.confirm('Сбросить все несохранённые изменения?')) return;
    await loadPage(state.page.stem);
  });

  els.save.addEventListener('click', saveChanges);

  window.addEventListener('beforeunload', event => {
    if (!state.dirtyScopes.size && !state.pendingUploads.size) return;
    event.preventDefault();
    event.returnValue = '';
  });

  await loadPage(state.manifest.pages[0].stem);
}

init().catch(error => {
  document.body.innerHTML = `<pre style="padding:24px">Ошибка запуска редактора: ${String(error)}</pre>`;
});
