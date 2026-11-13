import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

const path = name => new URL('../' + name, import.meta.url);
await rm(path('dist'), { recursive: true, force: true });
await cp(path('public'), path('dist'), { recursive: true });
await mkdir(path('dist/pdfjs/build'), { recursive: true });

const commit = process.env.CF_PAGES_COMMIT_SHA;

await Promise.all([
  writeFile(path('dist/build-info.json'), JSON.stringify({
    commit: commit && /^[a-f0-9]{40}$/i.test(commit) ? commit : null,
  }) + '\n'),
  ...['pdf.mjs', 'pdf.worker.mjs'].map(file =>
    cp(path('node_modules/pdfjs-dist/build/' + file), path('dist/pdfjs/build/' + file))),
  ...['cmaps', 'standard_fonts', 'wasm'].map(dir =>
    cp(path('node_modules/pdfjs-dist/' + dir), path('dist/pdfjs/' + dir), { recursive: true })),
  cp(path('node_modules/pdfjs-dist/LICENSE'), path('dist/pdfjs/LICENSE')),
  writeFile(path('dist/_routes.json'), JSON.stringify({ version: 1, include: ['/api/*'], exclude: [] })),
  writeFile(path('dist/_headers'), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: blob: https://fonts.gstatic.com; img-src 'self' data: blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'
`),
]);
