const shell = document.querySelector('#shell');
const panel = document.querySelector('#panel');
const toast = document.querySelector('#toast');
const store = {
  get(key, fallback) {
    try { return JSON.parse(localStorage.getItem('andhrakalam-' + key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('andhrakalam-' + key, JSON.stringify(value)); }
    catch { /* The current tab remains usable with storage disabled. */ }
  },
};
const state = {
  lang: store.get('language', 'te') === 'en' ? 'en' : 'te', district: '', tab: 'all',
  saved: new Set(store.get('bookmarks', [])), seen: new Set(store.get('seen', [])),
  editions: [], today: '', tomorrow: '', archiveStart: '', loaded: false, failed: false,
  signedIn: false, configured: false, zoom: 100, phone: false,
};
const districtNames = {
  'Andhra Pradesh': 'ఆంధ్రప్రదేశ్', Amaravati: 'అమరావతి', Visakhapatnam: 'విశాఖపట్నం',
  Vijayawada: 'విజయవాడ', Guntur: 'గుంటూరు', Ongole: 'ఒంగోలు', Tirupati: 'తిరుపతి',
};
const words = {
  districts: ['ఎడిషన్లు', 'Editions'], allDistricts: ['అన్ని జిల్లాలు', 'All districts'],
  all: ['అన్నీ', 'All'], today: ['నేటి వార్తలు', 'Today'], archive: ['పాత వార్తలు', 'Archive'],
  ads: ['ప్రకటనలు', 'Advertisements'], todayHeading: ['నేటి తాజా వార్తలు', 'Today’s latest news'],
  retention: ['ఆర్కైవ్ ఎడిషన్లు (1-వారం నిలుపుదల)', 'Archived editions (one-week retention)'],
  emptyToday: ['నేటి లేదా రేపటి తేదీతో దినపత్రికలు ఏవీ లేవు.', 'No editions dated today or tomorrow.'],
  browse: ['పాత వార్తలు చూడండి', 'Browse the archive'],
  browseHint: ['గత సంచికలను వీక్షించడానికి పాత వార్తలు విభాగాన్ని చూడండి.', 'Read previous issues in the archive.'],
  emptyArchive: ['ఈ జిల్లాకు ఆర్కైవ్ సంచికలు లేవు.', 'There are no archived editions for this selection.'],
  adHeading: ['ప్రత్యేక వాణిజ్య ప్రకటనలు & సప్లిమెంట్లు', 'Special advertisements & supplements'],
  adTitle: ['ఆంధ్రకలం పండుగ మెగా కార్నివాల్ & వినియోగదారుల ఎక్స్‌పో', 'Andhara Kalam Festival Mega Carnival & Consumer Expo'],
  adBody: ['మా రాబోయే ఆదివారం ప్రత్యేక రంగుల సంచికలో మీ వాణిజ్య ప్రకటనలు బుక్ చేసుకోండి. స్థానిక వ్యాపారులకు ప్రత్యేక రాయితీలు కలవు.', 'Book an advertisement in our special Sunday colour edition. Special rates are available for local businesses.'],
  contact: ['సంప్రదించండి', 'Contact'], phone: ['ఫోన్', 'Phone'], view: ['చూడండి', 'View'],
  home: ['హోమ్', 'Home'], back: ['హోమ్‌కు తిరిగి వెళ్లండి', 'Back to home'],
  search: ['వెతకండి', 'Search'], searchTitle: ['సంచికల శోధన', 'Search editions'],
  searchPlaceholder: ['శీర్షిక, జిల్లా లేదా తేదీతో వెతకండి', 'Search by headline, district or date'],
  noMatches: ['సరిపోలే సంచికలు లేవు.', 'No matching editions.'],
  share: ['షేర్', 'Share'], shareHelp: ['ఈ లింకును షేర్ చేయండి.', 'Share this link.'],
  copy: ['లింక్ కాపీ చేయండి', 'Copy link'], copied: ['లింక్ కాపీ అయింది.', 'Link copied.'],
  saved: ['సేవ్ చేసినవి', 'Saved'], save: ['సేవ్', 'Save'], removeSave: ['బుక్‌మార్క్ తీసివేయండి', 'Remove bookmark'],
  emptySaved: ['ఇంకా సంచికలు సేవ్ చేయలేదు.', 'You have no saved editions available.'],
  login: ['లాగిన్', 'Login'], signIn: ['సైన్ ఇన్', 'Sign in'], logout: ['సైన్ అవుట్', 'Sign out'],
  editorial: ['నిర్వాహక & ఎడిటోరియల్ పోర్టల్', 'Editorial portal'],
  loginHint: ['పాఠకులు లాగిన్ లేకుండా పత్రికను చదవవచ్చు.', 'Readers can open editions without signing in.'],
  user: ['యూజర్‌నేమ్', 'Username'], password: ['పాస్‌వర్డ్', 'Password'],
  upload: ['పీడీఎఫ్ అప్‌లోడ్', 'Upload PDF'], publish: ['సంచిక ప్రచురించండి', 'Publish edition'],
  remove: ['సంచికను తొలగించండి', 'Remove edition'], confirmRemove: ['ఈ సంచికను తొలగించాలా?', 'Remove this edition?'],
  title: ['తెలుగు శీర్షిక', 'Telugu headline'], titleEn: ['ఆంగ్ల శీర్షిక', 'English headline'],
  summary: ['తెలుగు వివరణ', 'Telugu description'], summaryEn: ['ఆంగ్ల వివరణ', 'English description'],
  date: ['సంచిక తేదీ', 'Edition date'], district: ['జిల్లా', 'District'],
  notifications: ['నోటిఫికేషన్లు', 'Notifications'], emptyNotifications: ['కొత్త సంచికలు లేవు.', 'No new editions.'],
  close: ['మూసివేయండి', 'Close'], loading: ['లోడ్ అవుతోంది…', 'Loading…'],
  todayEdition: ['నేటి ఈ-పేపర్', 'Today’s ePaper'], sample: ['నమూనా సంచిక', 'Sample edition'],
  sampleHint: ['మూల సైట్‌లో ఈ సంచికకు మాస్ట్‌హెడ్ మాత్రమే ఉంది.', 'The reference site displays its masthead in place of the newspaper pages for this issue.'],
  pages: ['పేజీలు', 'Pages'], page: ['పేజీ', 'Page'], next: ['తదుపరి పేజీ', 'Next page'],
  highlights: ['టాప్ ముఖ్యాంశాలు (క్లిక్ చేసి పేజీకి వెళ్లండి)', 'Top headlines (select to jump to the page)'],
  continuous: ['పూర్తి పీడీఎఫ్ సంచిక నిరంతర వీక్షణ', 'Complete ePaper • Continuous reading'],
  pdf: ['పీడీఎఫ్ డౌన్‌లోడ్', 'Download PDF'], print: ['ప్రింట్ / పీడీఎఫ్', 'Print / Save as PDF'],
  zoomIn: ['పెద్దదిగా చూపండి', 'Zoom in'], zoomOut: ['చిన్నదిగా చూపండి', 'Zoom out'],
  preview: ['మొబైల్ వీక్షణ', 'Phone preview'], desktop: ['డెస్క్‌టాప్ వీక్షణ', 'Desktop view'],
  unavailable: ['ఈ సంచిక అందుబాటులో లేదు.', 'This edition is unavailable.'],
  retry: ['మళ్లీ ప్రయత్నించండి', 'Try again'], failed: ['సంచికలను లోడ్ చేయలేకపోయాము.', 'Could not load editions.'],
  invalid_login: ['యూజర్‌నేమ్ లేదా పాస్‌వర్డ్ సరికాదు.', 'Username or password is incorrect.'],
  try_later: ['కొంతసేపటి తరువాత మళ్లీ ప్రయత్నించండి.', 'Too many attempts. Please try again later.'],
  publishing_disabled: ['ఎడిటర్ ఖాతాను ఇంకా సెటప్ చేయలేదు.', 'The editor account has not been configured.'],
  invalid_pdf: ['చదవగలిగే పీడీఎఫ్ ఎంచుకోండి.', 'Select a readable, unlocked PDF.'],
  too_large: ['పీడీఎఫ్ గరిష్ఠ పరిమాణం 30 MB.', 'The maximum PDF size is 30 MB.'],
  invalid_fields: ['సంచిక వివరాలు, తేదీ మరియు పేజీల సంఖ్యను తనిఖీ చేయండి.', 'Check the edition details, date and number of pages.'],
  sign_in_required: ['దయచేసి లాగిన్ అవ్వండి.', 'Please sign in.'],
  server_error: ['అభ్యర్థన పూర్తి కాలేదు. మళ్లీ ప్రయత్నించండి.', 'The request failed. Please try again.'],
};
const t = key => words[key]?.[state.lang === 'te' ? 0 : 1] || key;
const district = value => state.lang === 'te' ? districtNames[value] || value : value;
const local = (item, key) => (state.lang === 'en' && item[key + 'En']) || item[key] || '';
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const icons = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4m-6.8 7 6.8 4"/>',
  save: '<path d="M6 4h12v16l-6-4-6 4z"/>',
  login: '<circle cx="12" cy="7" r="3"/><path d="M5 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0"/>',
  phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  upload: '<path d="M12 16V4m-4 4 4-4 4 4M4 16v4h16v-4"/>',
  arrow: '<path d="m11 5-7 7 7 7m-7-7h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  print: '<path d="M6 8V3h12v5M6 17H3V8h18v9h-3M6 14h12v7H6z"/>',
  plus: '<path d="M5 12h14m-7-7v14"/>',
  minus: '<path d="M5 12h14"/>',
};
const svg = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const btn = (action, content, classes = 'button', attrs = '') =>
  `<button type="button" class="${classes}" data-action="${action}" ${attrs}>${content}</button>`;
const iconBtn = (action, name, label, extra = '', attrs = '') =>
  btn(action, svg(name) + extra, 'icon-button ' + name, `aria-label="${escape(label)}" title="${escape(label)}" ${attrs}`);
const masthead = () => '<div class="masthead"><a href="#" data-action="home" aria-label="' + t('home') +
  '"><img src="./assets/masthead.webp" alt="ఆంధ్రకలం • Andhara Kalam Telugu Daily" width="1440" height="391"></a></div>';
const email = 'contactandhrakalam@gmail.com';
const contacts = () => `<p>${t('contact')} <a href="mailto:${email}">${email}</a></p><p>${t('phone')} <a href="tel:+918374176633">+91-8374176633</a></p>`;
const footer = () => `<footer class="site-footer"><strong>ANDHARA KALAM MEDIA NETWORK</strong>${contacts()}<p>© ${state.today.slice(0, 4) || new Date().getFullYear()} Andhara Kalam • Ongole &amp; Amaravati Editions</p></footer>`;
const language = () => btn('language', state.lang === 'te' ? 'తె&nbsp; తెలుగు' : 'EN&nbsp; English', 'button white',
  'aria-label="Switch language / భాష మార్చండి"');
const editionHash = id => '#edition=' + encodeURIComponent(id);
const currentEdition = () => state.editions.find(item => editionHash(item.id) === location.hash);
const chip = (action, label, value, active, classes = '') =>
  btn(action, label, 'chip ' + classes, `data-value="${value}" aria-pressed="${active}"`);
const saveButton = item => {
  const saved = state.saved.has(item.id);
  return iconBtn('bookmark', 'save', t(saved ? 'removeSave' : 'save'), '', `data-value="${item.id}" aria-pressed="${saved}"`);
};
const sectionHead = (title, right = '', eyebrow = '') =>
  `<div class="section-head"><div>${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}<h2>${title}</h2></div>${right}</div>`;
const editionCard = (item, hero = false) => `<article class="edition">
  <a class="open-edition" href="${editionHash(item.id)}">
    <span class="cover" aria-hidden="true">${hero ? '<img src="./assets/masthead.webp" alt="">' :
      `<span>ePaper</span><b>${item.date.slice(5)}</b><small>${item.pages}P</small>`}</span>
    <div class="details"><time datetime="${item.date}">${item.date}</time>
      <h3>${escape(local(item, 'title'))}</h3><p class="muted">${escape(local(item, 'summary'))}</p>
      <p class="muted">${district(item.district)} • ${item.pages} ${t('pages')}${item.sample ? ' • ' + t('sample') : ''}</p></div>
  </a>${saveButton(item)}</article>`;
const cards = (items, hero = false) => '<div class="cards">' + items.map(item => editionCard(item, hero)).join('') + '</div>';
const adBody = () => `<span class="badge">${t('ads')}</span><h3>${t('adTitle')}</h3><p>${t('adBody')}</p>`;
function home() {
  const unread = state.editions.filter(item => !item.sample && !state.seen.has(item.id)).length;
  const filtered = state.editions.filter(item => !state.district || item.district === state.district);
  const latest = filtered.filter(item => !item.sample && item.date >= state.today && item.date <= state.tomorrow);
  const past = filtered.filter(item => item.sample || item.date < state.today);
  const show = key => state.tab === 'all' || state.tab === key;
  return `<header>${masthead()}<div class="bar"><span class="badge daily">DAILY EPAPER</span><div class="actions">
    ${iconBtn('notifications', 'bell', t('notifications'), unread ? `<span class="dot">${unread}</span>` : '')}
    ${iconBtn('phone', 'phone', t(state.phone ? 'desktop' : 'preview'))}${language()}
    ${btn('account', svg('login') + t(state.signedIn ? 'editorial' : 'login'), 'button primary')}
  </div></div>
  <nav class="districts" aria-label="${t('districts')}"><strong>${t('districts')}</strong>
    ${chip('district', t('allDistricts'), '', !state.district)}
    ${Object.keys(districtNames).map(key => chip('district', district(key), key, state.district === key)).join('')}
  </nav></header>
  <nav class="tabs" aria-label="${t('districts')}">
    ${['all', 'today', 'archive', 'ads'].map(key => chip('tab', (key === 'ads' ? '📢 ' : '') + t(key), key, state.tab === key, key === 'ads' ? 'ad-tab' : '')).join('')}
    ${btn('upload', svg('upload') + t('upload'), 'button gold upload')}
  </nav>
  <main id="content">
    ${state.failed ? `<div class="empty"><strong>${t('failed')}</strong>${btn('retry', t('retry'), 'button cream')}</div>` : ''}
    ${show('today') ? `<section class="today">${sectionHead(t('todayHeading'), `<time class="badge date-badge">${state.today}</time>`)}
      ${!state.loaded ? `<p class="empty">${t('loading')}</p>` : latest.length ? cards(latest, true) : `<div class="empty">
      <strong>${t('emptyToday')}</strong><p class="muted">${t('browseHint')}</p>${btn('tab', t('browse'), 'button cream', 'data-value="archive"')}</div>`}</section>` : ''}
    ${show('archive') ? `<section class="archive">${sectionHead(t('archive'), '<span class="badge retention">Auto-Retention 7D</span>', t('retention'))}
      ${past.length ? cards(past) : `<p class="empty muted">${t(state.loaded ? 'emptyArchive' : 'loading')}</p>`}</section>` : ''}
    ${show('ads') ? `<section class="advertising">${sectionHead(t('adHeading'), `<small class="muted">${t('ads')}</small>`)}
      <article class="ad-card">${adBody()}<div class="ad-footer"><p>${email} | +91-8374176633</p>
      ${btn('ad', t('view'), 'button orange')}</div></article></section>` : ''}
  </main>${footer()}
  <nav class="bottom" aria-label="${t('home')}">
    ${['home', 'search', 'share', 'saved', 'account'].map(action =>
      btn(action, svg({ saved: 'save', account: 'login' }[action] || action) + t(action === 'account' ? 'login' : action), '')).join('')}
  </nav>`;
}
function reader(item) {
  const isSample = item.sample;
  const labels = state.lang === 'te' ? ['ప్రధాన సంచిక', 'జిల్లా సమాచారం', 'వాణిజ్యం & మార్కెట్లు'] :
    ['Main edition', 'District news', 'Trade & markets'];
  const jump = (page, label) => btn('page', label, 'button white', `data-value="${page}"`);
  return `<header class="reader-header">${masthead()}<div class="bar">
    ${btn('home', svg('arrow') + t('back'), 'button primary')}<div class="actions">
    ${saveButton(item)}${iconBtn('share', 'share', t('share'))}${language()}</div></div></header>
  <nav class="reader-tools" aria-label="${t('pages')}"><div class="page-links"><span>${t('pages')}</span>
    ${Array.from({ length: item.pages }, (_, index) => jump(index + 1, 'P' + (index + 1))).join('')}</div>
    <div class="actions">${iconBtn('zoom', 'minus', t('zoomOut'), '', 'data-value="-25"')}
    <span id="zoom-level">${state.zoom}%</span>${iconBtn('zoom', 'plus', t('zoomIn'), '', 'data-value="25"')}
    ${isSample ? iconBtn('print', 'print', t('print')) :
      `<a class="button white" href="./api/editions/${item.id}/pdf" download>${t('pdf')}</a>`}</div></nav>
  ${item.highlights?.length ? `<section class="highlights"><p class="eyebrow">${t('highlights')}</p><div class="highlight-list">${item.highlights.map(highlight =>
    btn('page', escape(local(highlight, 'title')), '', `data-value="${highlight.page}"`)).join('')}</div></section>` : ''}
  <main class="reader-main" id="content" style="--zoom:${state.zoom}%"><div class="reader-title">
    <h2>${t('continuous')}</h2><p class="muted">${item.date} • ${district(item.district)} • ${item.pages} ${t('pages')}</p>
    ${isSample ? `<p class="muted">${t('sampleHint')}</p>` : ''}</div>
  ${Array.from({ length: item.pages }, (_, index) => {
    const page = index + 1;
    return `<article class="paper-page" id="page-${page}"><header><strong>${t('page')} ${page}${isSample ? ' • ' + labels[index] : ''}</strong>
      <span>${item.date} • ${district(item.district)} • ${page}/${item.pages}</span></header>
      <div class="page-media" data-page="${page}">${isSample ? '<img src="./assets/masthead.webp" alt="ఆంధ్రకలం • Andhara Kalam">' :
        `<p class="loading muted">${t('loading')}</p>`}</div>
      <footer><span>Andhara Kalam Digital Broadsheet</span>${page < item.pages ? jump(page + 1, t('next') + ' ›') : ''}</footer></article>`;
  }).join('')}</main>${footer()}`;
}

let pdfjsPromise;
let cancelPdf = () => {};
async function pdfjs() {
  pdfjsPromise ||= import('./pdfjs/build/pdf.mjs').then(module => {
    module.GlobalWorkerOptions.workerSrc = new URL('./pdfjs/build/pdf.worker.mjs', location.href).href;
    return module;
  }).catch(error => {
    pdfjsPromise = undefined;
    throw error;
  });
  return pdfjsPromise;
}
function pdfOptions() {
  return {
    cMapUrl: './pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: './pdfjs/standard_fonts/',
    wasmUrl: './pdfjs/wasm/', isEvalSupported: false, enableXfa: false,
  };
}
async function renderPdf(item) {
  const pages = [...shell.querySelectorAll('.page-media')];
  let cancelled = false;
  let task;
  let observer;
  cancelPdf = () => {
    cancelled = true;
    observer?.disconnect();
    task?.destroy().catch(() => {});
  };
  try {
    const module = await pdfjs();
    if (cancelled) return;
    task = module.getDocument({ ...pdfOptions(), url: './api/editions/' + item.id + '/pdf' });
    const pdf = await task.promise;
    if (cancelled) return;
    observer = new IntersectionObserver(entries => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        observer.unobserve(target);
        draw(target).catch(() => { if (!cancelled) target.textContent = t('invalid_pdf'); });
      }
    }, { rootMargin: '600px' });
    for (const page of pages) observer.observe(page);
    async function draw(target) {
      const page = await pdf.getPage(Number(target.dataset.page));
      if (cancelled) return;
      const canvas = document.createElement('canvas');
      const original = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(1.8, 1300 / original.width, 2400 / original.height) });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.setAttribute('aria-label', t('page') + ' ' + target.dataset.page);
      await page.render({ canvas, viewport }).promise;
      page.cleanup();
      if (!cancelled) target.replaceChildren(canvas);
    }
  } catch {
    if (!cancelled) pages.forEach(page => { page.textContent = t('invalid_pdf'); });
  }
}
function render() {
  cancelPdf();
  cancelPdf = () => {};
  document.documentElement.lang = state.lang;
  shell.classList.toggle('phone', state.phone);
  const item = currentEdition();
  shell.innerHTML = item ? reader(item) :
    state.loaded && location.hash.startsWith('#edition=') ?
      `${masthead()}<main id="content"><div class="empty"><strong>${t('unavailable')}</strong>${btn('home', t('back'), 'button primary')}</div></main>${footer()}` : home();
  if (item && !item.sample) void renderPdf(item);
}
function dialog(title, content) {
  panel.innerHTML = `<div class="dialog-head"><h2 id="panel-title">${title}</h2>${iconBtn('close', 'close', t('close'))}</div><div class="dialog-body">${content}</div>`;
  if (!panel.open) panel.showModal();
}
let toastTimeout;
function notify(message) {
  toast.textContent = message;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toast.textContent = ''; }, 2500);
}
async function api(path, options) {
  const response = await fetch('./api/' + path, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'server_error');
  return body;
}
async function load() {
  try {
    const data = await api('editions');
    Object.assign(state, data, { failed: false });
  } catch {
    state.failed = true;
  } finally {
    state.loaded = true;
    render();
  }
}
async function refreshSession() {
  try { Object.assign(state, await api('session')); }
  catch { state.configured = false; state.signedIn = false; }
}
function search() {
  dialog(t('searchTitle'), `<input class="search-input" type="search" aria-label="${t('searchTitle')}" placeholder="${t('searchPlaceholder')}">
    <div id="search-results" aria-live="polite"></div>`);
  const input = panel.querySelector('input');
  const results = panel.querySelector('#search-results');
  function filter() {
    const term = input.value.trim().toLocaleLowerCase();
    const found = state.editions.filter(item => [item.title, item.titleEn, item.summary, item.summaryEn,
      item.date, item.district, districtNames[item.district]].join(' ').toLocaleLowerCase().includes(term));
    results.innerHTML = found.length ? cards(found) : `<p class="empty muted">${t('noMatches')}</p>`;
  }
  input.addEventListener('input', filter);
  input.focus();
  filter();
}
function saved() {
  const found = state.editions.filter(item => state.saved.has(item.id));
  dialog(t('saved'), found.length ? cards(found) : `<p class="empty muted">${t('emptySaved')}</p>`);
}
function toggleBookmark(button) {
  const id = button.dataset.value;
  if (state.saved.has(id)) state.saved.delete(id);
  else state.saved.add(id);
  store.set('bookmarks', [...state.saved]);
  for (const element of document.querySelectorAll(`[data-action="bookmark"][data-value="${id}"]`)) {
    const active = state.saved.has(id);
    element.setAttribute('aria-pressed', active);
    element.setAttribute('aria-label', t(active ? 'removeSave' : 'save'));
    element.title = t(active ? 'removeSave' : 'save');
  }
  if (panel.querySelector('#panel-title')?.textContent === t('saved')) saved();
}
function account(uploadAfter = false) {
  if (state.signedIn) {
    if (uploadAfter) return uploadForm();
    const issues = state.editions.filter(item => !item.sample).map(item => `<p>${escape(local(item, 'title'))} · ${item.date}
      ${btn('remove', t('remove'), 'button', `data-value="${item.id}"`)}</p>`).join('');
    return dialog(t('editorial'), `${btn('upload', svg('upload') + t('upload'), 'button gold')}${issues}${btn('logout', t('logout'))}`);
  }
  dialog(t('editorial'), `<p>${t('loginHint')}</p>${state.configured ? `<form class="form" data-form="${uploadAfter ? 'upload-login' : 'login'}">
    <label>${t('user')}<input name="user" required maxlength="200" autocomplete="username"></label>
    <label>${t('password')}<input name="password" type="password" required maxlength="200" autocomplete="current-password"></label>
    <p role="alert"></p><button class="button primary">${t('signIn')}</button>
  </form>` : `<p class="muted">${t('publishing_disabled')}</p>`}`);
}
function uploadForm() {
  dialog(t('publish'), `<form class="form" data-form="upload">
    <label>${t('title')}<input name="title" required maxlength="160"></label>
    <label>${t('titleEn')}<input name="titleEn" maxlength="160"></label>
    <label>${t('summary')}<textarea name="summary" maxlength="600"></textarea></label>
    <label>${t('summaryEn')}<textarea name="summaryEn" maxlength="600"></textarea></label>
    <label>${t('date')}<input type="date" name="date" required value="${state.today}" min="${state.archiveStart}" max="${state.tomorrow}"></label>
    <label>${t('district')}<select name="district">${Object.keys(districtNames).map(key => `<option value="${key}">${district(key)}</option>`).join('')}</select></label>
    <label>PDF (30 MB)<input type="file" name="pdf" required accept="application/pdf,.pdf"></label>
    <p role="alert"></p><button class="button gold">${t('publish')}</button></form>`);
}
async function submit(form) {
  const data = new FormData(form);
  const button = form.querySelector('button');
  const alert = form.querySelector('[role="alert"]');
  button.disabled = true;
  alert.textContent = '';
  try {
    if (form.dataset.form !== 'upload') {
      await api('login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(data)) });
      state.signedIn = true;
      render();
      if (form.dataset.form === 'upload-login') uploadForm();
      else panel.close();
      return;
    }
    const file = data.get('pdf');
    if (file.size > 30 * 1024 * 1024) throw new Error('too_large');
    let task;
    try {
      const module = await pdfjs();
      task = module.getDocument({ ...pdfOptions(), data: new Uint8Array(await file.arrayBuffer()) });
      const pdf = await task.promise;
      data.set('pages', pdf.numPages);
    } catch {
      throw new Error('invalid_pdf');
    } finally {
      await task?.destroy().catch(() => {});
    }
    const { id } = await api('editions', { method: 'POST', body: data });
    panel.close();
    await load();
    location.hash = editionHash(id);
  } catch (error) {
    alert.textContent = t(words[error.message] ? error.message : 'server_error');
  } finally {
    button.disabled = false;
  }
}
async function share() {
  const url = location.href;
  if (navigator.share) {
    try { await navigator.share({ title: document.title, url }); return; }
    catch (error) { if (error.name === 'AbortError') return; }
  }
  dialog(t('share'), `<p>${t('shareHelp')}</p><input class="search-input" readonly aria-label="${t('share')}" value="${escape(url)}">
    ${btn('copy', t('copy'), 'button primary')}`);
}
function goHome() {
  if (panel.open) panel.close();
  state.tab = 'all';
  state.district = '';
  if (location.hash) history.pushState(null, '', location.pathname + location.search);
  render();
  window.scrollTo(0, 0);
}
async function perform(button) {
  const { action, value } = button.dataset;
  switch (action) {
    case 'home': goHome(); break;
    case 'language':
      state.lang = state.lang === 'te' ? 'en' : 'te';
      store.set('language', state.lang);
      render();
      break;
    case 'tab': state.tab = value; render(); break;
    case 'district': state.district = value; render(); break;
    case 'phone': state.phone = !state.phone; render(); break;
    case 'retry': await load(); break;
    case 'search': search(); break;
    case 'saved': saved(); break;
    case 'share': await share(); break;
    case 'copy': {
      const input = panel.querySelector('input');
      input.select();
      if (navigator.clipboard) {
        try { await navigator.clipboard.writeText(input.value); notify(t('copied')); }
        catch { input.focus(); }
      }
      break;
    }
    case 'bookmark': toggleBookmark(button); break;
    case 'close': panel.close(); break;
    case 'account':
    case 'upload':
      await refreshSession();
      account(action === 'upload');
      break;
    case 'logout':
      await api('logout', { method: 'POST' });
      state.signedIn = false;
      panel.close();
      render();
      break;
    case 'remove':
      if (!window.confirm(t('confirmRemove'))) break;
      await api('editions/' + value, { method: 'DELETE' });
      await load();
      account();
      break;
    case 'notifications': {
      const fresh = state.editions.filter(item => !item.sample && !state.seen.has(item.id));
      fresh.forEach(item => state.seen.add(item.id));
      store.set('seen', [...state.seen]);
      render();
      dialog(t('notifications'), fresh.length ? cards(fresh) : `<p class="empty muted">${t('emptyNotifications')}</p>`);
      break;
    }
    case 'ad': dialog(t('ads'), adBody() + contacts()); break;
    case 'page': document.querySelector('#page-' + value)?.scrollIntoView({ block: 'start' }); break;
    case 'zoom':
      state.zoom = Math.max(75, Math.min(250, state.zoom + Number(value)));
      shell.querySelector('main').style.setProperty('--zoom', state.zoom + '%');
      shell.querySelector('#zoom-level').textContent = state.zoom + '%';
      break;
    case 'print': window.print(); break;
  }
}
document.addEventListener('click', event => {
  const control = event.target.closest('[data-action]');
  if (control) {
    event.preventDefault();
    perform(control).catch(error => notify(t(words[error.message] ? error.message : 'server_error')));
  } else if (event.target.closest('a.open-edition') && panel.open) panel.close();
});
panel.addEventListener('submit', event => {
  event.preventDefault();
  void submit(event.target);
});
window.addEventListener('hashchange', () => {
  if (location.hash === '#content') return;
  state.zoom = 100;
  render();
  window.scrollTo(0, 0);
});
render();
void load();
void refreshSession().then(() => {
  if (state.signedIn && !panel.open) render();
});
