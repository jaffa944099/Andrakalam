import { editionFields, error, indiaDay, maxPdfBytes, sample, shiftDay } from '../../lib/editions.mjs';

const sessionMs = 12 * 60 * 60 * 1000;
const loginWindowMs = 15 * 60 * 1000;
const encoder = new TextEncoder();
const cookieName = 'andhrakalam_session';
const readCookie = request => /(?:^|;\s*)andhrakalam_session=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('Cookie') || '')?.[1];
const cookie = (token, seconds, secure) =>
  `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${seconds}${secure ? '; Secure' : ''}`;
const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
const randomId = bytes => hex(crypto.getRandomValues(new Uint8Array(bytes)));
const digest = async value => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
const sessionHash = (env, token) => digest(JSON.stringify([env.EDITOR_USER, env.EDITOR_PASSWORD, token]));
const pdfKey = id => `editions/${id}.pdf`;
const configured = env => Boolean(env.DB && env.PDFS && env.EDITOR_USER && env.EDITOR_PASSWORD?.length >= 12);
const json = (data, status = 200, headers = {}) => Response.json(data, {
  status, headers: { ...headers, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

async function credentialsMatch(env, supplied) {
  if (!supplied || typeof supplied.user !== 'string' || typeof supplied.password !== 'string') return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.EDITOR_PASSWORD), {
    name: 'HMAC', hash: 'SHA-256',
  }, false, ['sign', 'verify']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(JSON.stringify([env.EDITOR_USER, env.EDITOR_PASSWORD])));
  return crypto.subtle.verify('HMAC', key, signature, encoder.encode(JSON.stringify([supplied.user, supplied.password])));
}

async function boundedBody(request, limit) {
  const contentLength = Number(request.headers.get('Content-Length'));
  if (contentLength > limit) throw error(413, 'too_large');
  if (!request.body) { throw error(400, 'invalid_fields'); }
  let size = 0;
  const limited = request.body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      size += chunk.byteLength;
      if (size > limit) throw error(413, 'too_large');
      controller.enqueue(chunk);
    },
  }));
  return new Response(limited, { headers: { 'Content-Type': request.headers.get('Content-Type') || '' } });
}

async function isSignedIn(request, env) {
  const token = readCookie(request);
  return Boolean(configured(env) && token && await env.DB
    .prepare('SELECT 1 FROM sessions WHERE token_hash = ? AND expires_at > ?')
    .bind(await sessionHash(env, token), Date.now()).first());
}

async function list(env) {
  const today = indiaDay();
  const archiveStart = shiftDay(today, -7);
  const tomorrow = shiftDay(today, 1);
  const { results: editions } = env.DB ? await env.DB.prepare(`
    SELECT id, title, title_en AS titleEn, summary, summary_en AS summaryEn,
      edition_date AS date, district, page_count AS pages
    FROM editions WHERE edition_date BETWEEN ? AND ? ORDER BY edition_date DESC, created_at DESC
  `).bind(archiveStart, tomorrow).all() : { results: [] };
  if (editions.length === 0 && env.SHOW_SAMPLE !== '0') editions.push(sample);
  return json({ today, tomorrow, archiveStart, editions });
}

async function signIn(request, env, secure) {
  if (!configured(env)) throw error(503, 'publishing_disabled');
  const client = await digest(request.headers.get('CF-Connecting-IP') || 'local');
  const now = Date.now();
  const counter = await env.DB.prepare(`
    INSERT INTO login_attempts (client, attempts, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(client) DO UPDATE SET
      attempts = CASE WHEN login_attempts.expires_at <= ? THEN 1 ELSE MIN(login_attempts.attempts + 1, 11) END,
      expires_at = CASE WHEN login_attempts.expires_at <= ? THEN excluded.expires_at ELSE login_attempts.expires_at END
    RETURNING attempts
  `).bind(client, now + loginWindowMs, now, now).first();
  if (counter.attempts > 10) throw error(429, 'try_later');
  let input;
  try {
    input = await (await boundedBody(request, 4096)).json();
  } catch (cause) {
    if (cause.status) throw cause;
    throw error(400, 'invalid_fields');
  }
  if (!await credentialsMatch(env, input)) throw error(401, 'invalid_login');

  const old = readCookie(request);
  const token = randomId(32);
  const operations = [
    env.DB.prepare('DELETE FROM login_attempts WHERE client = ? OR expires_at <= ?').bind(client, now),
    env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now),
    env.DB.prepare('INSERT INTO sessions VALUES (?, ?)').bind(await sessionHash(env, token), now + sessionMs),
  ];
  if (old) operations.push(env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sessionHash(env, old)));
  await env.DB.batch(operations);
  return json({ signedIn: true }, 200, { 'Set-Cookie': cookie(token, sessionMs / 1000, secure) });
}

async function upload(request, env) {
  if (!(request.headers.get('Content-Type') || '').startsWith('multipart/form-data;')) {
    throw error(400, 'invalid_fields');
  }
  let form;
  try {
    form = await (await boundedBody(request, maxPdfBytes + 65536)).formData();
  } catch (cause) {
    if (cause.status) throw cause;
    throw error(400, 'invalid_fields');
  }
  const fields = editionFields(form);
  const file = form.get('pdf');
  if (!(file instanceof File)) throw error(400, 'invalid_pdf');
  if (file.size > maxPdfBytes) throw error(413, 'too_large');
  if (await file.slice(0, 5).text() !== '%PDF-') throw error(400, 'invalid_pdf');
  const id = randomId(12);
  await env.PDFS.put(pdfKey(id), file, { httpMetadata: { contentType: 'application/pdf' } });
  try {
    await env.DB.prepare('INSERT INTO editions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, ...fields, Date.now()).run();
  } catch (cause) {
    try {
      // A failed connection can leave the outcome of the insert unknown.
      const inserted = await env.DB.prepare('SELECT 1 FROM editions WHERE id = ?').bind(id).first();
      if (inserted) return json({ id }, 201);
      await env.PDFS.delete(pdfKey(id));
    } catch (recoveryError) {
      console.error('Could not reconcile PDF upload', id, recoveryError);
    }
    throw cause;
  }
  return json({ id }, 201);
}

async function download(env, id, method) {
  if (!env.DB || !env.PDFS) throw error(404, 'not_found');
  const today = indiaDay();
  const visible = await env.DB.prepare('SELECT 1 FROM editions WHERE id = ? AND edition_date BETWEEN ? AND ?')
    .bind(id, shiftDay(today, -7), shiftDay(today, 1)).first();
  if (!visible) throw error(404, 'not_found');
  const file = await (method === 'HEAD' ? env.PDFS.head(pdfKey(id)) : env.PDFS.get(pdfKey(id)));
  if (!file) throw error(404, 'not_found');
  return new Response(method === 'HEAD' ? null : file.body, { headers: {
    'Content-Type': 'application/pdf', 'Content-Length': String(file.size),
    'Content-Disposition': `attachment; filename="andhrakalam-${id}.pdf"`,
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  } });
}

async function prune(env) {
  const { results } = await env.DB.prepare('SELECT id FROM editions WHERE edition_date < ? LIMIT 100')
    .bind(shiftDay(indiaDay(), -7)).all();
  if (!results.length) return;
  await env.PDFS.delete(results.map(({ id }) => pdfKey(id)));
  await env.DB.batch(results.map(({ id }) => env.DB.prepare('DELETE FROM editions WHERE id = ?').bind(id)));
}

export async function onRequest(context) {
  const { request, env } = context;
  const { pathname, protocol } = new URL(request.url);
  const secure = protocol === 'https:';
  const method = request.method;
  const site = request.headers.get('Sec-Fetch-Site');
  try {
    if (site && !['same-origin', 'none'].includes(site)) throw error(403, 'forbidden');
    if (pathname === '/api/editions' && method === 'GET') return await list(env);
    if (pathname === '/api/session' && method === 'GET') {
      return json({ signedIn: await isSignedIn(request, env), configured: configured(env) });
    }
    if (pathname === '/api/login' && method === 'POST') return await signIn(request, env, secure);
    if (pathname === '/api/logout' && method === 'POST') {
      const token = readCookie(request);
      if (token && configured(env)) {
        await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sessionHash(env, token)).run();
      }
      return json({ signedIn: false }, 200, { 'Set-Cookie': cookie('', 0, secure) });
    }
    if (pathname === '/api/editions' && method === 'POST') {
      if (!await isSignedIn(request, env)) throw error(401, 'sign_in_required');
      const response = await upload(request, env);
      context.waitUntil(prune(env).catch(cause => console.error('Archive cleanup failed', cause)));
      return response;
    }
    const match = /^\/api\/editions\/([a-f0-9]{24})(\/pdf)?$/.exec(pathname);
    if (match) {
      const [, id, pdf] = match;
      if (pdf && ['GET', 'HEAD'].includes(method)) return await download(env, id, method);
      if (!pdf && method === 'DELETE') {
        if (!await isSignedIn(request, env)) throw error(401, 'sign_in_required');
        if (!await env.DB.prepare('SELECT 1 FROM editions WHERE id = ?').bind(id).first()) throw error(404, 'not_found');
        await env.PDFS.delete(pdfKey(id));
        await env.DB.prepare('DELETE FROM editions WHERE id = ?').bind(id).run();
        return json({ removed: true });
      }
    }
    throw error(404, 'not_found');
  } catch (cause) {
    if (!cause.status) console.error(cause);
    return json({ error: cause.code || 'server_error' }, cause.status || 500);
  }
}
