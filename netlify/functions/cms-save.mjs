import crypto from 'node:crypto';

const REPOSITORY = 'katyahk25/plazma_gifts';
const API_VERSION = '2022-11-28';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function validPath(path) {
  return path === 'src/data/site.json' || /^src\/data\/pages\/[a-z0-9-]+\.json$/.test(path);
}

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Метод не поддерживается' }, 405);

  const githubToken = process.env.PLAZMA_CMS_GITHUB_TOKEN;
  const adminPassword = process.env.PLAZMA_CMS_PASSWORD;
  if (!githubToken || !adminPassword) {
    return json({ error: 'Сохранение ещё не подключено: добавьте PLAZMA_CMS_GITHUB_TOKEN и PLAZMA_CMS_PASSWORD в Netlify Environment variables.' }, 503);
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Некорректный запрос' }, 400);
  }

  if (!safeEqual(payload.password, adminPassword)) return json({ error: 'Неверный пароль админки' }, 401);
  if (!validPath(payload.path)) return json({ error: 'Этот файл нельзя изменять через админку' }, 400);
  if (!/^[A-Za-z0-9._/-]+$/.test(payload.branch || '')) return json({ error: 'Некорректная ветка' }, 400);

  const apiBase = `https://api.github.com/repos/${REPOSITORY}/contents/${payload.path}`;
  const headers = {
    authorization: `Bearer ${githubToken}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': API_VERSION,
    'user-agent': 'plazma-cms-admin',
  };

  const currentResponse = await fetch(`${apiBase}?ref=${encodeURIComponent(payload.branch)}`, { headers });
  if (!currentResponse.ok) {
    return json({ error: `GitHub не отдал текущий файл (${currentResponse.status})` }, 502);
  }
  const current = await currentResponse.json();
  const content = Buffer.from(`${JSON.stringify(payload.content, null, 2)}\n`, 'utf8').toString('base64');

  const saveResponse = await fetch(apiBase, {
    method: 'PUT',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      message: `CMS: update ${payload.path.split('/').at(-1)}`,
      content,
      sha: current.sha,
      branch: payload.branch,
    }),
  });
  const saved = await saveResponse.json().catch(() => ({}));
  if (!saveResponse.ok) {
    return json({ error: saved.message || `GitHub отклонил сохранение (${saveResponse.status})` }, 502);
  }

  return json({ ok: true, commit: saved.commit?.sha || null });
};

export const config = { path: '/.netlify/functions/cms-save' };
