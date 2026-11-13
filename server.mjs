import { createServer } from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream, mkdirSync, statSync } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = dirname(fileURLToPath(import.meta.url));
const publicRoot = resolve(root, 'public');
const pdfjsRoot = resolve(root, 'node_modules/pdfjs-dist');
const dataDir = resolve(process.env.DATA_DIR || resolve(root, 'data'));
const editorUser = process.env.EDITOR_USER;
const editorPassword = process.env.EDITOR_PASSWORD;
const secureCookies = process.env.COOKIE_SECURE === '1' ||
  (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== '0');
const maxPdfBytes = 30 * 1024 * 1024;
const sessionMs = 12 * 60 * 60 * 1000;
const districts = new Set(['Andhra Pradesh', 'Amaravati', 'Visakhapatnam', 'Vijayawada', 'Guntur', 'Ongole', 'Tirupati']);

if (Boolean(editorUser) !== Boolean(editorPassword) || (editorPassword && editorPassword.length < 12)) {
  throw new Error('Set EDITOR_USER and EDITOR_PASSWORD together. Use at least 12 characters for EDITOR_PASSWORD.');
}

mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const db = new DatabaseSync(resolve(dataDir, 'andhrakalam.sqlite'));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS editions (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, title_en TEXT NOT NULL, summary TEXT NOT NULL,
    summary_en TEXT NOT NULL, edition_date TEXT NOT NULL, district TEXT NOT NULL,
    page_count INTEGER NOT NULL, pdf BLOB NOT NULL, created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS edition_date_index ON editions(edition_date DESC);
  CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
`);

const digest = value => createHash('sha256').update(value).digest('hex');
const same = (first, second) => timingSafeEqual(Buffer.from(digest(first)), Buffer.from(digest(second)));
const sessions = {
  read: db.prepare('SELECT 1 FROM sessions WHERE token_hash = ? AND expires_at > ?'),
  create: db.prepare('INSERT INTO sessions VALUES (?, ?)'),
  remove: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
  sweep: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
};
const editorBinding = digest(JSON.stringify([editorUser, editorPassword]));
const sessionCookie = 'andhrakalam_session';
const cookieToken = request => /(?:^|;\s*)andhrakalam_session=([a-f0-9]{64})(?:;|$)/.exec(request.headers.cookie || '')?.[1];
const tokenHash = token => digest(token + editorBinding);
const signedIn = request => {
  const token = cookieToken(request);
  return Boolean(editorUser && token && sessions.read.get(tokenHash(token), Date.now()));
};
const cookie = (token, seconds) =>
  `${sessionCookie}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${seconds}${secureCookies ? '; Secure' : ''}`;

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
const indiaDay = () => {
  const parts = Object.fromEntries(dayFormat.formatToParts().map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const shiftDay = (value, days) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && shiftDay(value, 0) === value;

const listEditions = db.prepare(`
  SELECT id, title, title_en AS titleEn, summary, summary_en AS summaryEn,
    edition_date AS date, district, page_count AS pages
  FROM editions WHERE edition_date BETWEEN ? AND ? ORDER BY edition_date DESC, created_at DESC
`);
const insertEdition = db.prepare('INSERT INTO editions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
const getPdf = db.prepare('SELECT pdf FROM editions WHERE id = ? AND edition_date BETWEEN ? AND ?');
const deleteEdition = db.prepare('DELETE FROM editions WHERE id = ?');
const pruneEditions = db.prepare('DELETE FROM editions WHERE edition_date < ?');
const prune = () => {
  sessions.sweep.run(Date.now());
  pruneEditions.run(shiftDay(indiaDay(), -7));
};
prune();
setInterval(prune, 60 * 60 * 1000).unref();

const sample = {
  id: 'amaravati-2026-11-09', date: '2026-11-09', district: 'Amaravati', pages: 3, sample: true,
  title: 'ఆంధ్రకలం అమరావతి ప్రధాన సంచిక • తాజా వార్తలు',
  titleEn: 'Andhara Kalam Amaravati Main Edition • Latest News',
  summary: 'రాష్ట్రవ్యాప్త తాజా వార్తా విశేషాలు, రాజకీయ విశ్లేషణలు మరియు సమగ్ర నివేదిక.',
  summaryEn: 'Statewide news, political analysis and in-depth reporting.',
  highlights: [
    { page: 1, title: 'రాష్ట్రవ్యాప్త సమగ్ర అభివృద్ధి పథకాల ప్రకటన', titleEn: 'Statewide development initiative announced' },
    { page: 3, title: 'ఆర్థిక వృద్ధి & ఐటీ రంగ విస్తరణ', titleEn: 'Economic growth and IT expansion' },
  ],
};

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp', '.wasm': 'application/wasm', '.pfb': 'application/octet-stream',
  '.ttf': 'font/ttf', '.bcmap': 'application/octet-stream',
};
const error = (status, code) => Object.assign(new Error(code), { status, code });
function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}
async function readBody(request, limit) {
  if (Number(request.headers['content-length']) > limit) throw error(413, 'too_large');
  const chunks = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > limit) {
      request.resume();
      throw error(413, 'too_large');
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
function serveFile(request, response, path, base) {
  const target = resolve(base, `.${path}`);
  const type = types[extname(target)];
  if (!target.startsWith(base + sep) || !type) throw error(404, 'not_found');
  const stat = statSync(target, { throwIfNoEntry: false });
  if (!stat?.isFile()) throw error(404, 'not_found');
  response.writeHead(200, {
    'Content-Type': type, 'Content-Length': stat.size,
    'Cache-Control': path.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache',
  });
  if (request.method === 'HEAD') return response.end();
  const stream = createReadStream(target);
  stream.on('error', () => response.destroy());
  response.on('close', () => stream.destroy());
  stream.pipe(response);
}
function inputText(form, key, max) {
  const value = form.get(key);
  if (typeof value !== 'string' || value.trim().length > max) throw error(400, 'invalid_fields');
  return value.trim();
}
const attempts = new Map();
const retryAfter = 15 * 60 * 1000;
function checkLoginRate(request) {
  const now = Date.now();
  for (const [key, attempt] of attempts) {
    if (attempt.expires <= now) attempts.delete(key);
  }
  const key = request.socket.remoteAddress;
  const attempt = attempts.get(key) || { count: 0, expires: now + retryAfter };
  if (attempt.count >= 10 || attempts.size >= 10000) throw error(429, 'try_later');
  attempt.count++;
  attempts.set(key, attempt);
  return key;
}
async function upload(request, response) {
  const type = request.headers['content-type'] || '';
  if (!type.startsWith('multipart/form-data;')) throw error(400, 'invalid_fields');
  const body = await readBody(request, maxPdfBytes + 65536);
  let form;
  try {
    form = await new Response(body, { headers: { 'Content-Type': type } }).formData();
  } catch {
    throw error(400, 'invalid_fields');
  }
  const title = inputText(form, 'title', 160);
  const titleEn = inputText(form, 'titleEn', 160);
  const summary = inputText(form, 'summary', 600);
  const summaryEn = inputText(form, 'summaryEn', 600);
  const date = inputText(form, 'date', 10);
  const district = inputText(form, 'district', 30);
  const pages = Number(inputText(form, 'pages', 3));
  const today = indiaDay();
  if (!title || !districts.has(district) || !validDate(date) ||
      date < shiftDay(today, -7) || date > shiftDay(today, 1) ||
      !Number.isInteger(pages) || pages < 1 || pages > 200) throw error(400, 'invalid_fields');
  const file = form.get('pdf');
  if (!(file instanceof File)) throw error(400, 'invalid_pdf');
  if (file.size > maxPdfBytes) throw error(413, 'too_large');
  const pdf = Buffer.from(await file.arrayBuffer());
  if (pdf.subarray(0, 5).toString() !== '%PDF-') throw error(400, 'invalid_pdf');
  const id = randomBytes(12).toString('hex');
  insertEdition.run(id, title, titleEn, summary, summaryEn, date, district, pages, pdf, Date.now());
  json(response, 201, { id });
}

const server = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: blob: https://fonts.gstatic.com; img-src 'self' data: blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  try {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const method = request.method;
    if (path.startsWith('/api/')) {
      if (request.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(request.headers['sec-fetch-site'])) {
        throw error(403, 'forbidden');
      }
      if (path === '/api/editions' && method === 'GET') {
        const today = indiaDay();
        const from = shiftDay(today, -7);
        const until = shiftDay(today, 1);
        const editions = listEditions.all(from, until);
        if (editions.length === 0 && process.env.SHOW_SAMPLE !== '0') editions.push(sample);
        return json(response, 200, { today, tomorrow: until, archiveStart: from, editions });
      }
      if (path === '/api/session' && method === 'GET') {
        return json(response, 200, { signedIn: signedIn(request), configured: Boolean(editorUser) });
      }
      if (path === '/api/login' && method === 'POST') {
        if (!editorUser) throw error(503, 'publishing_disabled');
        const key = checkLoginRate(request);
        let input;
        try {
          input = JSON.parse((await readBody(request, 4096)).toString());
        } catch (cause) {
          if (cause.status) throw cause;
          throw error(400, 'invalid_fields');
        }
        if (!input || typeof input.user !== 'string' || typeof input.password !== 'string' ||
            !(same(input.user, editorUser) & same(input.password, editorPassword))) {
          throw error(401, 'invalid_login');
        }
        attempts.delete(key);
        const oldToken = cookieToken(request);
        if (oldToken) sessions.remove.run(tokenHash(oldToken));
        const token = randomBytes(32).toString('hex');
        sessions.create.run(tokenHash(token), Date.now() + sessionMs);
        response.setHeader('Set-Cookie', cookie(token, sessionMs / 1000));
        return json(response, 200, { signedIn: true });
      }
      if (path === '/api/logout' && method === 'POST') {
        const token = cookieToken(request);
        if (token) sessions.remove.run(tokenHash(token));
        response.setHeader('Set-Cookie', cookie('', 0));
        return json(response, 200, { signedIn: false });
      }
      if (path === '/api/editions' && method === 'POST') {
        if (!signedIn(request)) throw error(401, 'sign_in_required');
        return await upload(request, response);
      }
      const pdfMatch = /^\/api\/editions\/([a-f0-9]{24})\/pdf$/.exec(path);
      if (pdfMatch && (method === 'GET' || method === 'HEAD')) {
        const today = indiaDay();
        const record = getPdf.get(pdfMatch[1], shiftDay(today, -7), shiftDay(today, 1));
        if (!record) throw error(404, 'not_found');
        response.writeHead(200, {
          'Content-Type': 'application/pdf', 'Content-Length': record.pdf.byteLength,
          'Content-Disposition': `attachment; filename="andhrakalam-${pdfMatch[1]}.pdf"`,
          'Cache-Control': 'no-store',
        });
        return response.end(method === 'HEAD' ? undefined : record.pdf);
      }
      const editionMatch = /^\/api\/editions\/([a-f0-9]{24})$/.exec(path);
      if (editionMatch && method === 'DELETE') {
        if (!signedIn(request)) throw error(401, 'sign_in_required');
        if (!deleteEdition.run(editionMatch[1]).changes) throw error(404, 'not_found');
        return json(response, 200, { removed: true });
      }
      throw error(404, 'not_found');
    }
    if (method !== 'GET' && method !== 'HEAD') throw error(405, 'method_not_allowed');
    if (path.startsWith('/pdfjs/')) {
      const resource = path.slice('/pdfjs'.length);
      if (!/^\/(build\/(pdf|pdf\.worker)\.mjs|cmaps\/[\w-]+\.bcmap|standard_fonts\/[\w.-]+\.(pfb|ttf)|wasm\/[\w.-]+\.(wasm|js))$/.test(resource)) {
        throw error(404, 'not_found');
      }
      return serveFile(request, response, resource, pdfjsRoot);
    }
    return serveFile(request, response, path === '/' ? '/index.html' : path, publicRoot);
  } catch (cause) {
    if (response.headersSent || response.destroyed) return;
    if (!cause.status && !(cause instanceof URIError)) console.error(cause);
    json(response, cause.status || (cause instanceof URIError ? 400 : 500), { error: cause.code || 'server_error' });
  }
});

const argValue = option => {
  const index = process.argv.indexOf(option);
  return index === -1 ? undefined : process.argv[index + 1];
};
const port = Number(argValue('--port') || process.env.PORT || 8080);
const host = argValue('--host') || '0.0.0.0';
server.listen(port, host, () => console.log(`Andhara Kalam is listening on port ${port}`));
