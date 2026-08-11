import crypto from 'node:crypto';

const REPOSITORY = 'katyahk25/plazma_gifts';
const API_VERSION = '2022-11-28';
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_JSON_BYTES = 2 * 1024 * 1024;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function validJsonPath(path) {
  return path === 'src/data/site.json' || /^src\/data\/pages\/[a-z0-9-]+\.json$/.test(path);
}

function validUploadPath(path) {
  return /^public\/assets\/images\/uploads\/[A-Za-z0-9._-]+\.(?:jpe?g|png|webp|gif)$/i.test(path);
}

function branchApiPath(branch) {
  return branch.split('/').map(encodeURIComponent).join('/');
}

function sameOriginRequest(req) {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}

async function githubFetch(path, options, headers) {
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || `GitHub API ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

function validateChanges(changes) {
  if (!Array.isArray(changes) || !changes.length) throw new Error('Нет изменений для сохранения');
  if (changes.length > 20) throw new Error('Слишком много файлов в одном сохранении');

  const seen = new Set();
  let uploadBytes = 0;

  for (const change of changes) {
    if (!change || typeof change.path !== 'string' || typeof change.content !== 'string') {
      throw new Error('Некорректный формат изменения');
    }
    if (seen.has(change.path)) throw new Error(`Файл продублирован: ${change.path}`);
    seen.add(change.path);

    if (validJsonPath(change.path)) {
      if (change.encoding !== 'utf-8') throw new Error('JSON должен передаваться как UTF-8');
      if (Buffer.byteLength(change.content, 'utf8') > MAX_JSON_BYTES) throw new Error('JSON слишком большой');
      try {
        JSON.parse(change.content);
      } catch {
        throw new Error(`Некорректный JSON: ${change.path}`);
      }
      continue;
    }

    if (validUploadPath(change.path)) {
      if (change.encoding !== 'base64') throw new Error('Изображение должно передаваться как Base64');
      uploadBytes += Buffer.from(change.content, 'base64').length;
      if (uploadBytes > MAX_UPLOAD_BYTES) throw new Error('Суммарный размер новых изображений больше 4 МБ');
      continue;
    }

    throw new Error(`Этот файл нельзя изменять через админку: ${change.path}`);
  }
}

export default async (req) => {
  const githubToken = process.env.PLAZMA_CMS_GITHUB_TOKEN;
  const adminPassword = process.env.PLAZMA_CMS_PASSWORD;
  const allowedBranch = process.env.PLAZMA_CMS_BRANCH;

  if (req.method === 'GET') {
    return json({
      ok: true,
      configured: Boolean(githubToken && adminPassword && allowedBranch),
      github_token: Boolean(githubToken),
      password: Boolean(adminPassword),
      branch: allowedBranch || null,
    });
  }

  if (req.method !== 'POST') return json({ error: 'Метод не поддерживается' }, 405);
  if (!sameOriginRequest(req)) return json({ error: 'Запрос с другого сайта запрещён' }, 403);

  if (!githubToken || !adminPassword || !allowedBranch) {
    return json({
      error: 'Сохранение ещё не подключено: добавьте PLAZMA_CMS_GITHUB_TOKEN, PLAZMA_CMS_PASSWORD и PLAZMA_CMS_BRANCH в Netlify Environment variables.',
    }, 503);
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Некорректный запрос' }, 400);
  }

  if (!safeEqual(payload.password, adminPassword)) return json({ error: 'Неверный пароль админки' }, 401);
  if (payload.branch !== allowedBranch) return json({ error: 'Эта админка не имеет права изменять указанную ветку' }, 403);

  try {
    validateChanges(payload.changes);
  } catch (error) {
    return json({ error: error.message }, 400);
  }

  const headers = {
    authorization: `Bearer ${githubToken}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': API_VERSION,
    'user-agent': 'plazma-visual-cms',
    'content-type': 'application/json',
  };

  try {
    const refPath = branchApiPath(allowedBranch);
    const ref = await githubFetch(`git/ref/heads/${refPath}`, {}, headers);
    const headSha = ref.object.sha;
    const headCommit = await githubFetch(`git/commits/${headSha}`, {}, headers);

    const tree = [];
    for (const change of payload.changes) {
      const blob = await githubFetch('git/blobs', {
        method: 'POST',
        body: JSON.stringify({ content: change.content, encoding: change.encoding }),
      }, headers);
      tree.push({ path: change.path, mode: '100644', type: 'blob', sha: blob.sha });
    }

    const newTree = await githubFetch('git/trees', {
      method: 'POST',
      body: JSON.stringify({ base_tree: headCommit.tree.sha, tree }),
    }, headers);

    const message = String(payload.message || 'CMS: update site content').slice(0, 120);
    const commit = await githubFetch('git/commits', {
      method: 'POST',
      body: JSON.stringify({ message, tree: newTree.sha, parents: [headSha] }),
    }, headers);

    await githubFetch(`git/refs/heads/${refPath}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha, force: false }),
    }, headers);

    return json({ ok: true, commit: commit.sha });
  } catch (error) {
    const status = error.status === 422 ? 409 : 502;
    const message = error.status === 422
      ? 'Ветка успела измениться. Обновите админку и повторите сохранение.'
      : error.message;
    return json({ error: message }, status);
  }
};

export const config = {
  path: '/.netlify/functions/cms-save',
  rateLimit: {
    windowLimit: 12,
    windowSize: 60,
    aggregateBy: ['domain', 'ip'],
  },
};
