/* ============================================================================
   WORKOUT SCREEN
   ----------------------------------------------------------------------------
   Built for someone standing in a gym between sets. One card is open at a
   time, one obvious next action, everything else recedes.
   ========================================================================== */

import { el, num, mmss, mmssPadded, restLabel, shortDate, haptic, clamp } from '../util.js';
import {
  getSession, toggleSetDone, updateSet, addSet, removeSet, updateLog,
  copyLastSession, previousPerformance, finishSession, discardSession,
  updateSession, getExercise, getSettings
} from '../store.js';
import {
  prescriptionLabel, targetLabel, setsLabel, logFields, setLabel, setHasValue
} from '../prescription.js';
import { sessionTotals } from '../stats.js';
import { icon, iconButton, sheet, confirmSheet, toast, topbar, field, segmented } from './components.js';
import { startRest, stop as stopRest } from './resttimer.js';

let openLogId = null;
let clockTimer = null;

export function renderWorkout(root, ctx, params) {
  const session = getSession(params.sessionId);
  if (!session) {
    ctx.go({ tab: 'train', name: 'today' });
    return;
  }
  if (session.status === 'completed') {
    ctx.go({ tab: 'history', name: 'sessionDetail', sessionId: session.id });
    return;
  }

  root.innerHTML = '';
  clearInterval(clockTimer);

  const totals = sessionTotals(session);

  /* ---- header ---- */
  const elapsed = () => Math.max(0, Math.round((Date.now() - session.startedAt) / 1000));
  const clock = el('div', { class: 'sub num', text: mmssPadded(elapsed()) });
  const bar = topbar({
    title: session.dayName,
    onBack: () => ctx.go({ tab: 'train', name: 'today' })
  });
  bar.querySelector('.grow').appendChild(clock);
  bar.appendChild(iconButton('dots', 'Workout options', () => openMenu(session, ctx)));
  root.appendChild(bar);

  clockTimer = setInterval(() => { clock.textContent = mmssPadded(elapsed()); }, 1000);
  ctx.onLeave(() => clearInterval(clockTimer));

  const screen = el('div', { class: 'screen' });
  root.appendChild(screen);

  /* ---- progress ---- */
  screen.appendChild(el('div', { class: 'row between', style: 'margin-bottom:8px' }, [
    el('div', { class: 'eyebrow', text: `${totals.completedExercises} / ${totals.exercises} EXERCISES` }),
    el('div', { class: 'eyebrow', text: `${totals.sets} SETS` })
  ]));
  screen.appendChild(el('div', { class: 'bar', style: 'margin-bottom:20px' }, [
    el('i', { style: `width:${totals.percent}%` })
  ]));

  /* ---- default open card: first unfinished exercise ---- */
  if (!openLogId || !session.logs.some((l) => l.id === openLogId)) {
    const next = session.logs.find((l) => !l.sets.every((s) => s.done));
    openLogId = next ? next.id : session.logs[0] && session.logs[0].id;
  }

  const list = el('div', { class: 'stack' });
  screen.appendChild(list);
  session.logs.forEach((log, i) => list.appendChild(exerciseCard(session, log, i, ctx, screen)));

  /* ---- finish ---- */
  const finish = el('button', {
    class: 'btn btn-lg btn-block ' + (totals.sets ? 'btn-primary' : 'btn-outline'),
    type: 'button',
    text: 'FINISH WORKOUT',
    style: 'margin-top:26px'
  });
  finish.addEventListener('click', () => openFinish(session, ctx));
  screen.appendChild(finish);
}

/* ------------------------------------------------------------- one card */
function exerciseCard(session, log, index, ctx, screen) {
  const rx = log.prescription;
  const ex = getExercise(log.exerciseId);
  const isOpen = log.id === openLogId;
  const doneSets = log.sets.filter((s) => s.done).length;
  const allDone = doneSets > 0 && doneSets === log.sets.length;

  const card = el('div', { class: `ex-card ${isOpen ? 'open' : ''} ${allDone ? 'done' : ''}` });

  const head = el('button', {
    class: 'ex-head',
    type: 'button',
    'aria-expanded': isOpen ? 'true' : 'false'
  }, [
    el('div', { class: 'idx', text: String(index + 1).padStart(2, '0') }),
    el('div', { class: 'grow' }, [
      el('div', { class: 'nm', text: log.name }),
      el('div', { class: 'meta', text: `${ex.category} · ${log.equipment}` })
    ]),
    allDone
      ? el('div', { class: 'tick' }, [icon('check', 20)])
      : el('div', { class: 'rx', text: doneSets ? `${doneSets}/${log.sets.length}` : prescriptionLabel(rx) })
  ]);
  head.addEventListener('click', () => {
    openLogId = isOpen ? null : log.id;
    ctx.rerender();
  });
  card.appendChild(head);

  if (!isOpen) return card;

  const body = el('div', { class: 'ex-body' });

  /* target strip */
  body.appendChild(el('div', { class: 'ex-strip' }, [
    stripItem('SETS', setsLabel(rx)),
    stripItem('TARGET', targetLabel(rx)),
    stripItem('REST', restLabel(rx.restSec)),
    rx.tempo ? stripItem('TEMPO', rx.tempo) : null,
    rx.rpe ? stripItem('RPE', String(rx.rpe)) : null
  ]));

  const cue = rx.cue || (ex.coachingCues && ex.coachingCues[0]);
  if (cue) body.appendChild(el('div', { class: 'cue', text: cue }));

  /* previous performance */
  const prev = previousPerformance(log.exerciseId, session.id);
  if (prev) {
    body.appendChild(el('div', { class: 'last-session' }, [
      el('div', { class: 'ls-head' }, [
        el('div', { class: 'eyebrow', text: 'LAST SESSION' }),
        el('div', { class: 'tiny dim', text: shortDate(prev.date) })
      ]),
      el('div', { class: 'ls-sets' }, prev.sets.map((s) => el('div', { class: 'ls-set', text: setLabel(s, rx) })))
    ]));
  }

  /* set table */
  const fields = logFields(rx, getSettings());
  const cols = `26px ${fields.map(() => 'minmax(0,1fr)').join(' ')} 46px`;

  const headRow = el('div', { class: 'set-head', style: `grid-template-columns:${cols}` }, [
    el('div', { text: 'SET', style: 'text-align:center' }),
    ...fields.map((f) => el('div', { text: f.label, style: 'text-align:center' })),
    el('div', { text: '', 'aria-hidden': 'true' })
  ]);
  body.appendChild(headRow);

  log.sets.forEach((set, i) => {
    body.appendChild(setRow(session, log, set, i, fields, cols, ctx, prev));
  });

  /* actions */
  const actions = el('div', { class: 'set-actions' });

  const copy = el('button', { class: 'btn btn-sm btn-outline', type: 'button', text: 'COPY LAST' });
  copy.disabled = !prev;
  copy.addEventListener('click', () => {
    const n = copyLastSession(session.id, log.id);
    haptic(10);
    toast(n ? `Copied ${n} sets — nothing marked done` : 'No previous session to copy');
    ctx.rerender();
  });

  const add = el('button', { class: 'btn btn-sm btn-outline', type: 'button', text: '+ SET' });
  add.addEventListener('click', () => { addSet(session.id, log.id); haptic(8); ctx.rerender(); });

  const note = el('button', { class: 'btn btn-sm btn-outline', type: 'button', text: log.notes ? 'NOTE •' : 'NOTE' });
  note.addEventListener('click', () => openNote(session, log, ctx));

  actions.append(copy, add, note);
  body.appendChild(actions);

  if (rx.notes) body.appendChild(el('div', { class: 'hint', style: 'margin-top:12px', text: rx.notes }));

  card.appendChild(body);
  return card;
}

function stripItem(k, v) {
  return el('div', {}, [el('div', { class: 'k', text: k }), el('div', { class: 'v', text: v })]);
}

/* ------------------------------------------------------------- set row */
function setRow(session, log, set, index, fields, cols, ctx, prev) {
  const row = el('div', {
    class: `set-row ${set.done ? 'is-done' : ''} ${set.prs && set.prs.length ? 'is-pr' : ''}`,
    style: `grid-template-columns:${cols}`
  });

  row.appendChild(el('div', { class: 'setno', text: String(index + 1).padStart(2, '0') }));

  const ghost = prev && prev.sets[index] ? prev.sets[index] : null;
  fields.forEach((f) => {
    row.appendChild(stepper(session, log, set, f, ctx, ghost));
  });

  const check = el('button', {
    class: 'check',
    type: 'button',
    'aria-label': set.done ? `Set ${index + 1} completed, tap to undo` : `Complete set ${index + 1}`,
    'aria-pressed': set.done ? 'true' : 'false'
  }, [icon('check', 22)]);

  check.addEventListener('click', () => {
    const wasDone = set.done;
    const updated = toggleSetDone(session.id, log.id, set.id);
    haptic(wasDone ? 6 : 14);

    if (updated && updated.done) {
      if (updated.prs && updated.prs.length) {
        toast(`NEW PR · ${log.name} · ${setLabel(updated, log.prescription)}`, 'pr', 3200);
        haptic([15, 60, 15, 60, 25]);
      }
      const settings = getSettings();
      const rest = log.prescription.restSec;
      const remaining = log.sets.filter((s) => !s.done).length;
      if (settings.restAutoStart && rest > 0 && remaining > 0) startRest(rest);
      if (remaining === 0) {
        stopRestIfIdle(log);
        advance(session, log);
      }
    }
    ctx.rerender();
  });

  row.appendChild(check);

  if (set.prs && set.prs.length) {
    row.appendChild(el('div', { class: 'pr-flag' }, [
      el('span', { text: '★' }),
      el('span', { text: `NEW PR · ${set.prs.join(' · ')}` })
    ]));
  }

  /* long-press a set number to remove it */
  const no = row.firstChild;
  let pressTimer = null;
  const startPress = () => {
    pressTimer = setTimeout(() => {
      if (log.sets.length <= 1) return;
      confirmSheet({
        title: 'Remove set',
        message: `Remove set ${index + 1} from ${log.name}?`,
        confirmLabel: 'Remove',
        onConfirm: () => { removeSet(session.id, log.id, set.id); ctx.rerender(); }
      });
    }, 550);
  };
  const endPress = () => clearTimeout(pressTimer);
  no.addEventListener('touchstart', startPress, { passive: true });
  no.addEventListener('touchend', endPress);
  no.addEventListener('touchmove', endPress);
  no.addEventListener('mousedown', startPress);
  no.addEventListener('mouseup', endPress);
  no.addEventListener('mouseleave', endPress);

  return row;
}

function stepper(session, log, set, f, ctx, ghost) {
  const wrap = el('div', { class: 'stepper' });

  const value = set[f.key];
  const ghostValue = ghost && ghost[f.key] !== null && ghost[f.key] !== undefined && ghost[f.key] !== ''
    ? (f.mode === 'clock' ? mmss(ghost[f.key]) : num(ghost[f.key]))
    : null;
  const input = el('input', {
    type: f.mode === 'clock' ? 'text' : 'number',
    inputmode: f.mode === 'clock' ? 'numeric' : 'decimal',
    step: String(f.step),
    'aria-label': `${log.name} set ${f.label}`,
    value: f.mode === 'clock' ? (value ? mmss(value) : '') : (value === null || value === undefined ? '' : num(value)),
    placeholder: ghostValue || (f.mode === 'clock' ? '0:00' : '—'),
    title: ghostValue ? `Last session: ${ghostValue}` : ''
  });

  const commit = (raw) => {
    let v;
    if (f.mode === 'clock') {
      v = parseClock(raw);
    } else {
      v = raw === '' ? null : Number(raw);
      if (Number.isNaN(v)) v = null;
    }
    updateSet(session.id, log.id, set.id, { [f.key]: v }, true);
  };

  input.addEventListener('input', (e) => commit(e.target.value));
  input.addEventListener('blur', (e) => {
    if (f.mode === 'clock') {
      const v = parseClock(e.target.value);
      e.target.value = v ? mmss(v) : '';
    }
  });
  input.addEventListener('focus', (e) => e.target.select());

  const bump = (delta) => {
    const current = Number(set[f.key]) || 0;
    let next = current + delta;
    if (f.mode === 'clock') next = clamp(Math.round(next), 0, 86400);
    else next = Math.max(0, Math.round(next * 100) / 100);
    updateSet(session.id, log.id, set.id, { [f.key]: next }, true);
    input.value = f.mode === 'clock' ? (next ? mmss(next) : '') : num(next);
    haptic(6);
  };

  const minus = el('button', { type: 'button', text: '−', 'aria-label': `Decrease ${f.label}` });
  const plus = el('button', { type: 'button', text: '+', 'aria-label': `Increase ${f.label}` });
  minus.addEventListener('click', () => bump(-f.step));
  plus.addEventListener('click', () => bump(f.step));

  wrap.append(minus, input, plus);
  return wrap;
}

function parseClock(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (s.includes(':')) {
    const [m, sec] = s.split(':');
    return (Number(m) || 0) * 60 + (Number(sec) || 0);
  }
  const n = Number(s);
  return Number.isNaN(n) ? null : Math.round(n);
}

function stopRestIfIdle(log) {
  if (log.prescription.restSec === 0) stopRest();
}

function advance(session, log) {
  const i = session.logs.findIndex((l) => l.id === log.id);
  const next = session.logs.slice(i + 1).find((l) => !l.sets.every((s) => s.done));
  openLogId = next ? next.id : log.id;
}

/* -------------------------------------------------------------- sheets */
function openNote(session, log, ctx) {
  const ta = el('textarea', { class: 'textarea', placeholder: 'How did it feel? Anything to remember next time?' });
  ta.value = log.notes || '';
  const body = el('div', {}, [
    el('div', { class: 'field-label', text: 'Exercise note' }),
    ta
  ]);
  sheet({
    title: log.name,
    body,
    actions: [
      { label: 'Cancel', onClick: ({ close }) => close() },
      {
        label: 'Save note',
        variant: 'btn-primary',
        onClick: ({ close }) => {
          updateLog(session.id, log.id, { notes: ta.value.trim() });
          close();
          ctx.rerender();
        }
      }
    ]
  });
  setTimeout(() => ta.focus(), 320);
}

function openMenu(session, ctx) {
  const body = el('div', { class: 'card flush' });

  const items = [
    {
      label: 'Session notes',
      hint: 'Free text kept with this workout',
      run: ({ close }) => { close(); openSessionNotes(session, ctx); }
    },
    {
      label: 'Finish workout',
      hint: 'Save and see the summary',
      run: ({ close }) => { close(); openFinish(session, ctx); }
    },
    {
      label: 'Discard workout',
      hint: 'Delete this session entirely',
      danger: true,
      run: ({ close }) => {
        close();
        confirmSheet({
          title: 'Discard workout',
          message: 'This deletes the session and everything logged in it. A backup is written first, but this cannot be undone from inside the app.',
          confirmLabel: 'Discard',
          onConfirm: () => {
            discardSession(session.id);
            stopRest();
            openLogId = null;
            ctx.go({ tab: 'train', name: 'today' });
          }
        });
      }
    }
  ];

  const ref = { close: null };
  items.forEach((it) => {
    const b = el('button', { class: 'list-item', type: 'button' }, [
      el('div', { class: 'grow' }, [
        el('div', { class: 'h3', text: it.label, style: it.danger ? 'color:var(--accent-bright)' : '' }),
        el('div', { class: 'tiny dim', text: it.hint })
      ])
    ]);
    b.addEventListener('click', () => it.run({ close: () => ref.close() }));
    body.appendChild(b);
  });

  const s = sheet({ title: session.dayName, body });
  ref.close = s.close;
}

function openSessionNotes(session, ctx) {
  const ta = el('textarea', { class: 'textarea', placeholder: 'Sleep, energy, anything that affected the session.' });
  ta.value = session.notes || '';
  sheet({
    title: 'Session notes',
    body: ta,
    actions: [
      { label: 'Cancel', onClick: ({ close }) => close() },
      {
        label: 'Save',
        variant: 'btn-primary',
        onClick: ({ close }) => {
          updateSession(session.id, { notes: ta.value.trim() });
          close();
          ctx.rerender();
        }
      }
    ]
  });
  setTimeout(() => ta.focus(), 320);
}

function openFinish(session, ctx) {
  const totals = sessionTotals(session);
  const body = el('div', {});

  body.appendChild(el('div', { class: 'stat-grid', style: 'margin-bottom:20px' }, [
    cell(String(totals.sets), 'Sets'),
    cell(String(totals.minutes), 'Minutes'),
    cell(totals.volume ? String(totals.volume) : '—', 'Volume')
  ]));

  if (totals.completedExercises < totals.exercises) {
    body.appendChild(el('div', { class: 'hint', style: 'margin-bottom:16px' , text:
      `${totals.exercises - totals.completedExercises} exercises have no completed sets. They will be saved as skipped.` }));
  }

  let rpe = session.rpe || null;
  let energy = session.energy || null;

  body.appendChild(field('Session difficulty (optional)',
    segmented(
      [{ label: 'Easy', value: 6 }, { label: 'Solid', value: 7 }, { label: 'Hard', value: 8 }, { label: 'Brutal', value: 9 }],
      rpe, (v) => { rpe = v; }
    )));

  body.appendChild(field('Energy (optional)',
    segmented(
      [{ label: 'Low', value: 'low' }, { label: 'Normal', value: 'normal' }, { label: 'High', value: 'high' }],
      energy, (v) => { energy = v; }
    )));

  const ta = el('textarea', { class: 'textarea', placeholder: 'Session notes (optional)' });
  ta.value = session.notes || '';
  body.appendChild(field('Notes', ta));

  sheet({
    title: 'Finish workout',
    body,
    tall: true,
    actions: [
      { label: 'Keep going', onClick: ({ close }) => close() },
      {
        label: 'Finish',
        variant: 'btn-primary',
        onClick: ({ close }) => {
          finishSession(session.id, { rpe, energy, notes: ta.value.trim() });
          stopRest();
          openLogId = null;
          close();
          haptic([12, 40, 12]);
          ctx.go({ tab: 'history', name: 'sessionDetail', sessionId: session.id, celebrate: true });
        }
      }
    ]
  });
}

function cell(v, k) {
  return el('div', { class: 'cell' }, [
    el('div', { class: 'v num', text: v }),
    el('div', { class: 'k', text: k })
  ]);
}

export function resetWorkoutView() {
  openLogId = null;
  clearInterval(clockTimer);
}
