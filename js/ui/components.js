/* ============================================================================
   UI COMPONENTS — sheets, toasts, confirmations, icons, charts.
   Everything is plain DOM. No template library.
   ========================================================================== */

import { el, esc, haptic } from '../util.js';

/* ------------------------------------------------------------------ icons */
const PATHS = {
  train:   '<path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/>',
  program: '<path d="M4 6h16M4 12h16M4 18h10"/><circle cx="19" cy="18" r="2"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4.5l3 1.8"/>',
  more:    '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  check:   '<path d="M4.5 12.5l5 5 10-11"/>',
  back:    '<path d="M15 5l-7 7 7 7"/>',
  close:   '<path d="M6 6l12 12M18 6L6 18"/>',
  plus:    '<path d="M12 5v14M5 12h14"/>',
  search:  '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  up:      '<path d="M12 19V5M5 12l7-7 7 7"/>',
  down:    '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  trash:   '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
  edit:    '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z"/>',
  copy:    '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  play:    '<path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/>',
  timer:   '<circle cx="12" cy="13" r="8"/><path d="M12 9v4.5l3 1.5M9 2h6"/>',
  flame:   '<path d="M12 3s5 4.5 5 9a5 5 0 0 1-10 0c0-2 1-3 1-3s0 2 1.5 2S12 3 12 3z"/>',
  dots:    '<circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>'
};

export function icon(name, size) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.9');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  if (size) { svg.style.width = size + 'px'; svg.style.height = size + 'px'; }
  svg.innerHTML = PATHS[name] || '';
  return svg;
}

export function iconButton(name, label, onClick, extraClass = '') {
  const b = el('button', { class: `icon-btn ${extraClass}`, type: 'button', 'aria-label': label, onclick: onClick });
  b.appendChild(icon(name));
  return b;
}

/* ------------------------------------------------------------------ toast */
let toastHost = null;

export function toast(message, variant = '', ms = 2400) {
  if (!toastHost) {
    toastHost = el('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(toastHost);
  }
  const node = el('div', { class: `toast ${variant}`, text: message });
  toastHost.appendChild(node);
  setTimeout(() => {
    node.style.transition = 'opacity .25s ease, transform .25s ease';
    node.style.opacity = '0';
    node.style.transform = 'translateY(6px)';
    setTimeout(() => node.remove(), 260);
  }, ms);
}

/* ------------------------------------------------------------------ sheet */
const openSheets = [];

/**
 * Bottom sheet.
 * @returns {{close:Function, body:HTMLElement, foot:HTMLElement, root:HTMLElement}}
 */
export function sheet({ title, body, actions = [], tall = false, onClose = null, dismissible = true }) {
  const scrim = el('div', { class: 'scrim' });
  const root = el('div', {
    class: `sheet ${tall ? 'tall' : ''}`,
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': title || 'Dialog'
  });

  const grip = el('div', { class: 'sheet-grip' });
  const head = el('div', { class: 'sheet-head' }, [
    el('div', { class: 'h', text: title || '' })
  ]);
  const closeBtn = iconButton('close', 'Close', () => close());
  head.appendChild(closeBtn);

  const bodyWrap = el('div', { class: 'sheet-body' });
  if (typeof body === 'string') bodyWrap.innerHTML = body;
  else if (body) bodyWrap.appendChild(body);

  const foot = el('div', { class: 'sheet-foot' });
  actions.forEach((a) => {
    const b = el('button', { class: `btn ${a.variant || ''}`, type: 'button', text: a.label });
    b.addEventListener('click', () => a.onClick && a.onClick({ close }));
    foot.appendChild(b);
  });

  root.append(grip, head, bodyWrap);
  if (actions.length) root.appendChild(foot);
  document.body.append(scrim, root);
  document.body.style.overflow = 'hidden';

  requestAnimationFrame(() => {
    scrim.classList.add('show');
    root.classList.add('show');
  });

  function close() {
    scrim.classList.remove('show');
    root.classList.remove('show');
    setTimeout(() => { scrim.remove(); root.remove(); }, 280);
    const i = openSheets.indexOf(api);
    if (i >= 0) openSheets.splice(i, 1);
    if (!openSheets.length) document.body.style.overflow = '';
    if (onClose) onClose();
  }

  if (dismissible) scrim.addEventListener('click', close);

  const api = { close, body: bodyWrap, foot, root };
  openSheets.push(api);
  return api;
}

export function closeAllSheets() {
  [...openSheets].forEach((s) => s.close());
}

/* ------------------------------------------------------------- confirm */
export function confirmSheet({ title, message, confirmLabel = 'Confirm', danger = true, onConfirm }) {
  const body = el('div', {}, [
    el('p', { class: 'muted small', text: message, style: 'line-height:1.55' })
  ]);
  const s = sheet({
    title,
    body,
    actions: [
      { label: 'Cancel', onClick: ({ close }) => close() },
      {
        label: confirmLabel,
        variant: danger ? 'btn-primary' : '',
        onClick: ({ close }) => { close(); haptic(18); onConfirm && onConfirm(); }
      }
    ]
  });
  return s;
}

/** Single-line text prompt in a sheet. */
export function promptSheet({ title, label, value = '', placeholder = '', confirmLabel = 'Save', onSubmit }) {
  const input = el('input', { class: 'input', type: 'text', value, placeholder, id: 'prompt-input' });
  const body = el('div', { class: 'field' }, [
    el('label', { for: 'prompt-input', text: label || '' }),
    input
  ]);
  const s = sheet({
    title,
    body,
    actions: [
      { label: 'Cancel', onClick: ({ close }) => close() },
      {
        label: confirmLabel,
        variant: 'btn-primary',
        onClick: ({ close }) => {
          const v = input.value.trim();
          if (!v) { input.focus(); return; }
          close();
          onSubmit && onSubmit(v);
        }
      }
    ]
  });
  setTimeout(() => input.focus(), 320);
  return s;
}

/* ------------------------------------------------------------- controls */
export function switchRow(labelText, checked, onChange, hint) {
  const sw = el('button', {
    class: 'switch', type: 'button', role: 'switch',
    'aria-checked': checked ? 'true' : 'false',
    'aria-label': labelText
  });
  sw.addEventListener('click', () => {
    const next = sw.getAttribute('aria-checked') !== 'true';
    sw.setAttribute('aria-checked', next ? 'true' : 'false');
    haptic(8);
    onChange(next);
  });
  return el('div', { class: 'switch-row' }, [
    el('div', { class: 'grow' }, [
      el('div', { class: 'h3', text: labelText }),
      hint ? el('div', { class: 'tiny dim', text: hint, style: 'margin-top:3px' }) : null
    ]),
    sw
  ]);
}

export function segmented(options, value, onChange) {
  const wrap = el('div', { class: 'segmented', role: 'group' });
  options.forEach((o) => {
    const b = el('button', {
      type: 'button',
      text: o.label,
      'aria-pressed': o.value === value ? 'true' : 'false'
    });
    b.addEventListener('click', () => {
      Array.from(wrap.children).forEach((c) => c.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      onChange(o.value);
    });
    wrap.appendChild(b);
  });
  return wrap;
}

export function field(labelText, control, hint) {
  return el('div', { class: 'field' }, [
    el('div', { class: 'field-label', text: labelText }),
    control,
    hint ? el('div', { class: 'hint', text: hint }) : null
  ]);
}

export function emptyState({ title, message, actionLabel, onAction }) {
  return el('div', { class: 'empty' }, [
    el('div', { class: 'h1', text: title }),
    el('p', { text: message }),
    actionLabel ? el('button', { class: 'btn btn-primary', type: 'button', text: actionLabel, onclick: onAction }) : null
  ]);
}

/* ---------------------------------------------------------------- charts */
/** Small line chart. points = [{x:timestamp, y:number}] */
export function lineChart(points, { height = 150, format = (v) => String(Math.round(v)) } = {}) {
  const ns = 'http://www.w3.org/2000/svg';
  const w = 320;
  const h = height;
  const pad = { l: 6, r: 6, t: 14, b: 18 };

  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'chart');
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('role', 'img');

  if (points.length < 2) {
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', w / 2); t.setAttribute('y', h / 2);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('class', 'lbl');
    t.textContent = 'NOT ENOUGH DATA YET';
    svg.appendChild(t);
    return svg;
  }

  const ys = points.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = maxY - minY || Math.max(1, maxY * 0.1);
  const lo = minY - span * 0.25;
  const hi = maxY + span * 0.25;

  const X = (i) => pad.l + (i / (points.length - 1)) * (w - pad.l - pad.r);
  const Y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (h - pad.t - pad.b);

  const defs = document.createElementNS(ns, 'defs');
  defs.innerHTML = `<linearGradient id="redfade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ED1C24" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#ED1C24" stop-opacity="0"/>
    </linearGradient>`;
  svg.appendChild(defs);

  [0, 0.5, 1].forEach((f) => {
    const line = document.createElementNS(ns, 'line');
    const y = pad.t + f * (h - pad.t - pad.b);
    line.setAttribute('x1', 0); line.setAttribute('x2', w);
    line.setAttribute('y1', y); line.setAttribute('y2', y);
    line.setAttribute('class', 'grid');
    svg.appendChild(line);
  });

  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ');

  const area = document.createElementNS(ns, 'path');
  area.setAttribute('class', 'area');
  area.setAttribute('d', `${d} L${X(points.length - 1).toFixed(1)} ${h - pad.b} L${X(0).toFixed(1)} ${h - pad.b} Z`);
  svg.appendChild(area);

  const path = document.createElementNS(ns, 'path');
  path.setAttribute('class', 'line');
  path.setAttribute('d', d);
  svg.appendChild(path);

  points.forEach((p, i) => {
    if (i !== points.length - 1 && points.length > 12) return;
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', X(i)); c.setAttribute('cy', Y(p.y));
    c.setAttribute('r', i === points.length - 1 ? 4 : 2.5);
    c.setAttribute('class', 'pt');
    svg.appendChild(c);
  });

  const first = document.createElementNS(ns, 'text');
  first.setAttribute('x', 2); first.setAttribute('y', h - 5);
  first.setAttribute('class', 'lbl');
  first.textContent = format(points[0].y);
  svg.appendChild(first);

  const last = document.createElementNS(ns, 'text');
  last.setAttribute('x', w - 2); last.setAttribute('y', h - 5);
  last.setAttribute('text-anchor', 'end');
  last.setAttribute('class', 'lbl');
  last.textContent = format(points[points.length - 1].y);
  svg.appendChild(last);

  svg.setAttribute('aria-label', `Progression from ${format(points[0].y)} to ${format(points[points.length - 1].y)}`);
  return svg;
}

/** Simple bar strip for consistency. */
export function barStrip(values, { max = null } = {}) {
  const top = max || Math.max(1, ...values.map((v) => v.count));
  return el('div', { class: 'bars' }, values.map((v) => el('div', {
    class: `b ${v.count > 0 ? 'on' : ''}`,
    style: `height:${Math.max(4, (v.count / top) * 100)}%`,
    title: `${v.count} sessions`
  })));
}

/* --------------------------------------------------------------- header */
export function topbar({ title, subtitle, onBack, right }) {
  const bar = el('div', { class: 'topbar' });
  if (onBack) bar.appendChild(iconButton('back', 'Back', onBack));
  bar.appendChild(el('div', { class: 'grow' }, [
    el('div', { class: 'title', text: title || '' }),
    subtitle ? el('div', { class: 'sub', text: subtitle }) : null
  ]));
  if (right) bar.appendChild(right);
  return bar;
}

export const html = (strings, ...values) =>
  strings.reduce((out, s, i) => out + s + (i < values.length ? esc(values[i]) : ''), '');
