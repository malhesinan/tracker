/* ============================================================================
   UTIL — tiny helpers. No framework, no dependencies.
   ========================================================================== */

/* ---- ids & clones ---- */
export const uid = (p = 'id') =>
  p + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);

export const clone = (o) => (typeof structuredClone === 'function'
  ? structuredClone(o)
  : JSON.parse(JSON.stringify(o)));

/* ---- DOM ---- */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

/** Escape untrusted text before it goes into an innerHTML template. */
export function esc(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/* ---- numbers ---- */
export function round(n, dp = 2) {
  const f = Math.pow(10, dp);
  return Math.round((n + Number.EPSILON) * f) / f;
}

/** 80 -> "80", 77.5 -> "77.5" */
export function num(n) {
  if (n === null || n === undefined || n === '' || Number.isNaN(n)) return '';
  return String(round(Number(n), 2));
}

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/* ---- time ---- */
export function mmss(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function mmssPadded(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** 150 -> "2:30", 60 -> "1:00", 45 -> "45s" */
export function restLabel(sec) {
  if (!sec) return '—';
  return sec < 60 ? `${sec}s` : mmss(sec);
}

export function minutesBetween(a, b) {
  return Math.max(0, Math.round((b - a) / 60000));
}

/* ---- dates ---- */
export const DAY_MS = 86400000;

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function isSameDay(a, b) {
  const x = new Date(a), y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** 1724800000000 -> "27 AUG" */
export function shortDate(ts) {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function longDate(ts) {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function monthKey(ts) {
  const d = new Date(ts);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function relativeDay(ts) {
  const today = startOfDay(Date.now()).getTime();
  const then = startOfDay(ts).getTime();
  const diff = Math.round((today - then) / DAY_MS);
  if (diff === 0) return 'TODAY';
  if (diff === 1) return 'YESTERDAY';
  if (diff < 7 && diff > 0) return `${diff} DAYS AGO`;
  return shortDate(ts);
}

export function timeOfDay(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* ---- misc ---- */
export function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function pluralise(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Case/diacritic-insensitive contains. */
export function matches(haystack, needle) {
  return String(haystack || '').toLowerCase().includes(String(needle || '').toLowerCase());
}

export function download(filename, text, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function haptic(pattern = 12) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* unsupported */ }
}
