export const maxPdfBytes = 30 * 1024 * 1024;

const districts = new Set(['Andhra Pradesh', 'Amaravati', 'Visakhapatnam', 'Vijayawada', 'Guntur', 'Ongole', 'Tirupati']);

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
export const indiaDay = () => {
  const parts = Object.fromEntries(dayFormat.formatToParts().map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
export const shiftDay = (value, days) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && shiftDay(value, 0) === value;

export const sample = {
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

export const error = (status, code) => Object.assign(new Error(code), { status, code });

function inputText(form, key, max) {
  const value = form.get(key);
  if (typeof value !== 'string' || value.trim().length > max) throw error(400, 'invalid_fields');
  return value.trim();
}

export function editionFields(form) {
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
  return [title, titleEn, summary, summaryEn, date, district, pages];
}
