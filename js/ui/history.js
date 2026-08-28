/* ============================================================================
   HISTORY — what I did, and whether it is going anywhere.
   ========================================================================== */

import { el, num, mmss, shortDate, longDate, monthKey, relativeDay, timeOfDay, restLabel } from '../util.js';
import { completedSessions, getSession, deleteSession, getExercise } from '../store.js';
import { sessionTotals, volumeDelta, exerciseSeries, trend, consistency, summaryStats, trainedExercises } from '../stats.js';
import { prescriptionLabel, setLabel, estimated1RM } from '../prescription.js';
import { topbar, icon, iconButton, emptyState, lineChart, barStrip, segmented, confirmSheet, sheet } from './components.js';

let historyTab = 'sessions';

/* ================================================================== LIST */
export function renderHistory(root, ctx) {
  root.innerHTML = '';
  root.appendChild(topbar({ title: 'History' }));
  const screen = el('div', { class: 'screen' });
  root.appendChild(screen);

  const sessions = completedSessions();

  if (!sessions.length) {
    screen.appendChild(emptyState({
      title: 'No workouts yet',
      message: 'Complete your first workout to start building your history.',
      actionLabel: 'Go to today',
      onAction: () => ctx.go({ tab: 'train', name: 'today' })
    }));
    return;
  }

  const stats = summaryStats();
  screen.appendChild(el('div', { class: 'stat-grid' }, [
    statCell(String(stats.count), 'Workouts'),
    statCell(String(stats.totalSets), 'Sets'),
    statCell(String(stats.last30), 'Last 30d')
  ]));

  screen.appendChild(el('div', { style: 'margin:20px 0 4px' }, [
    segmented(
      [{ label: 'Sessions', value: 'sessions' }, { label: 'Exercises', value: 'exercises' }],
      historyTab,
      (v) => { historyTab = v; ctx.rerender(); }
    )
  ]));

  const body = el('div', {});
  screen.appendChild(body);

  if (historyTab === 'sessions') renderSessionList(body, sessions, ctx);
  else renderExerciseList(body, ctx);
}

function statCell(v, k) {
  return el('div', { class: 'cell' }, [
    el('div', { class: 'v num', text: v }),
    el('div', { class: 'k', text: k })
  ]);
}

function renderSessionList(body, sessions, ctx) {
  const weeks = consistency(8);
  body.appendChild(el('div', { class: 'section-head' }, [
    el('div', { class: 'eyebrow', text: 'Consistency · 8 weeks' }),
    el('div', { class: 'eyebrow', text: `${weeks.reduce((n, w) => n + w.count, 0)} TOTAL` })
  ]));
  body.appendChild(barStrip(weeks));

  let currentMonth = null;
  sessions.forEach((s) => {
    const key = monthKey(s.startedAt);
    if (key !== currentMonth) {
      currentMonth = key;
      body.appendChild(el('div', { class: 'month-label', text: key }));
    }
    const totals = sessionTotals(s);
    const item = el('button', { class: 'card tappable', type: 'button', style: 'display:block;width:100%;text-align:left;margin-bottom:10px' }, [
      el('div', { class: 'row between' }, [
        el('div', {}, [
          el('div', { class: 'h2', text: s.dayName }),
          el('div', { class: 'tiny dim', style: 'margin-top:3px', text: `${s.programName} · ${timeOfDay(s.startedAt)}` })
        ]),
        el('div', { class: 'eyebrow accent', text: relativeDay(s.startedAt) })
      ]),
      el('div', { class: 'row', style: 'gap:18px;margin-top:12px' }, [
        miniStat(`${totals.completedExercises}/${totals.exercises}`, 'EXERCISES'),
        miniStat(String(totals.sets), 'SETS'),
        miniStat(String(totals.minutes), 'MIN'),
        totals.prs.length ? el('div', { class: 'badge pr', text: `${totals.prs.length} PR` }) : null
      ])
    ]);
    item.addEventListener('click', () => ctx.go({ tab: 'history', name: 'sessionDetail', sessionId: s.id }));
    body.appendChild(item);
  });
}

function miniStat(v, k) {
  return el('div', {}, [
    el('div', { class: 'num', style: 'font-size:17px;font-weight:800', text: v }),
    el('div', { class: 'tiny dim', style: 'letter-spacing:.14em', text: k })
  ]);
}

function renderExerciseList(body, ctx) {
  const list = trainedExercises();
  if (!list.length) {
    body.appendChild(el('p', { class: 'muted small', style: 'margin-top:20px', text: 'No exercise data yet.' }));
    return;
  }
  body.appendChild(el('div', { class: 'spacer' }));
  const card = el('div', { class: 'card flush' });
  list.forEach((e) => {
    const series = exerciseSeries(e.exerciseId);
    const t = trend(series, series.some((p) => p.e1rm) ? 'e1rm' : 'volume');
    const item = el('button', { class: 'list-item', type: 'button' }, [
      el('div', { class: 'grow' }, [
        el('div', { class: 'h3', text: e.name }),
        el('div', { class: 'tiny dim', text: `${e.sessions} sessions · last ${shortDate(e.lastDate)}` })
      ]),
      el('div', { class: `h2 trend-${t.direction}`, text: t.arrow }),
      el('span', { class: 'chev', text: '›' })
    ]);
    item.addEventListener('click', () => ctx.go({ tab: 'history', name: 'exerciseDetail', exerciseId: e.exerciseId }));
    card.appendChild(item);
  });
  body.appendChild(card);
}

/* ======================================================== SESSION DETAIL */
export function renderSessionDetail(root, ctx, params) {
  const session = getSession(params.sessionId);
  if (!session) { ctx.go({ tab: 'history', name: 'historyList' }); return; }

  root.innerHTML = '';
  const bar = topbar({
    title: session.dayName,
    subtitle: longDate(session.startedAt),
    onBack: () => ctx.go({ tab: 'history', name: 'historyList' })
  });
  bar.appendChild(iconButton('trash', 'Delete session', () => {
    confirmSheet({
      title: 'Delete workout',
      message: 'This session and everything logged in it will be removed. A backup is written first.',
      confirmLabel: 'Delete',
      onConfirm: () => { deleteSession(session.id); ctx.go({ tab: 'history', name: 'historyList' }); }
    });
  }));
  root.appendChild(bar);

  const screen = el('div', { class: 'screen' });
  root.appendChild(screen);

  const totals = sessionTotals(session);
  const delta = volumeDelta(session);

  if (params.celebrate) {
    screen.appendChild(el('div', { style: 'text-align:center;padding:10px 0 22px' }, [
      el('div', { class: 'complete-mark', style: 'margin:0 auto' }, [icon('check', 30)]),
      el('div', { class: 'eyebrow accent', style: 'margin-top:16px', text: 'WORKOUT COMPLETE' })
    ]));
  }

  screen.appendChild(el('div', { class: 'stat-grid' }, [
    statCell(String(totals.sets), 'Sets'),
    statCell(String(totals.minutes), 'Minutes'),
    statCell(totals.volume ? String(totals.volume) : '—', 'Volume')
  ]));

  if (delta) {
    const up = delta.percent >= 0;
    screen.appendChild(el('div', { class: 'row between', style: 'margin-top:14px' }, [
      el('div', { class: 'eyebrow', text: `VS ${shortDate(delta.previousDate)}` }),
      el('div', { class: `h2 ${up ? 'trend-up' : 'trend-down'}`, text: `${up ? '+' : ''}${delta.percent}% VOLUME` })
    ]));
  }

  if (totals.prs.length) {
    screen.appendChild(el('div', { class: 'section-head' }, [el('div', { class: 'eyebrow accent', text: 'Personal records' })]));
    totals.prs.forEach((pr) => {
      screen.appendChild(el('div', { class: 'card', style: 'margin-bottom:8px;border-color:var(--accent-line)' }, [
        el('div', { class: 'row between' }, [
          el('div', {}, [
            el('div', { class: 'h3', text: pr.exercise }),
            el('div', { class: 'tiny dim', style: 'margin-top:3px', text: pr.labels.join(' · ') })
          ]),
          el('div', { class: 'h2 num accent-text', text: setLabel(pr.set, null) })
        ])
      ]));
    });
  }

  if (session.notes || session.rpe || session.energy) {
    screen.appendChild(el('div', { class: 'section-head' }, [el('div', { class: 'eyebrow', text: 'Session' })]));
    if (session.rpe) screen.appendChild(kv('Difficulty', `RPE ${session.rpe}`));
    if (session.energy) screen.appendChild(kv('Energy', String(session.energy)));
    if (session.notes) screen.appendChild(el('div', { class: 'cue', style: 'margin-top:12px', text: session.notes }));
  }

  screen.appendChild(el('div', { class: 'section-head' }, [
    el('div', { class: 'eyebrow', text: 'Exercises' }),
    el('div', { class: 'tiny dim', text: 'AS PRESCRIBED THAT DAY' })
  ]));

  session.logs.forEach((log, i) => {
    const done = log.sets.filter((s) => s.done);
    const card = el('div', { class: 'card', style: 'margin-bottom:10px' });
    card.appendChild(el('div', { class: 'row', style: 'align-items:flex-start' }, [
      el('div', { class: 'num', style: 'font-size:13px;font-weight:800;color:var(--text-dim);width:24px', text: String(i + 1).padStart(2, '0') }),
      el('div', { class: 'grow' }, [
        el('div', { class: 'h3', text: log.name }),
        el('div', { class: 'tiny dim', style: 'margin-top:3px', text: `${prescriptionLabel(log.prescription)} · REST ${restLabel(log.prescription.restSec)}` })
      ]),
      done.length ? null : el('div', { class: 'badge', text: 'SKIPPED' })
    ]));

    if (done.length) {
      const sets = el('div', { style: 'margin-top:12px' });
      done.forEach((s, j) => {
        sets.appendChild(el('div', { class: 'kv' }, [
          el('div', { class: 'k num', text: `SET ${String(j + 1).padStart(2, '0')}` }),
          el('div', { class: 'row', style: 'gap:8px' }, [
            s.prs && s.prs.length ? el('span', { class: 'badge pr', text: 'PR' }) : null,
            el('div', { class: 'v', text: setLabel(s, log.prescription) })
          ])
        ]));
      });
      card.appendChild(sets);
    }

    if (log.notes) card.appendChild(el('div', { class: 'cue', style: 'margin-top:12px', text: log.notes }));
    screen.appendChild(card);
  });

  screen.appendChild(el('div', { class: 'attribution', style: 'margin-top:20px', text:
    `Recorded against ${session.programName} v${session.programVersion}. Editing the programme later does not change this record.` }));
}

function kv(k, v) {
  return el('div', { class: 'kv' }, [el('div', { class: 'k', text: k }), el('div', { class: 'v', text: v })]);
}

/* ======================================================= EXERCISE DETAIL */
export function renderExerciseDetail(root, ctx, params) {
  const ex = getExercise(params.exerciseId);
  const series = exerciseSeries(params.exerciseId);

  root.innerHTML = '';
  root.appendChild(topbar({
    title: ex.name,
    subtitle: `${ex.category} · ${ex.equipment}`,
    onBack: () => ctx.go({ tab: 'history', name: 'historyList' })
  }));
  const screen = el('div', { class: 'screen' });
  root.appendChild(screen);

  if (!series.length) {
    screen.appendChild(emptyState({
      title: 'No history',
      message: 'Log this exercise in a workout and its progression appears here.'
    }));
    return;
  }

  const latest = series[series.length - 1];
  const previous = series.length > 1 ? series[series.length - 2] : null;
  const weighted = series.some((p) => p.topWeight > 0);

  const bestSet = bestOf(series);
  const t = trend(series, weighted ? 'e1rm' : 'volume');

  screen.appendChild(el('div', { class: 'stat-grid' }, [
    statCell(topLine(latest, weighted), relativeDay(latest.date)),
    statCell(previous ? topLine(previous, weighted) : '—', 'Previous'),
    statCell(bestSet.label, 'Best')
  ]));

  screen.appendChild(el('div', { class: 'row between', style: 'margin-top:16px' }, [
    el('div', { class: 'eyebrow', text: 'Trend' }),
    el('div', { class: `h2 trend-${t.direction}`, text: `${t.arrow} ${t.delta > 0 ? '+' : ''}${t.delta}%` })
  ]));

  /* chart selector */
  let metric = weighted ? 'e1rm' : 'volume';
  const chartHost = el('div', { style: 'margin-top:16px' });

  const options = weighted
    ? [{ label: 'Est. 1RM', value: 'e1rm' }, { label: 'Top set', value: 'topWeight' }, { label: 'Volume', value: 'volume' }]
    : [{ label: 'Volume', value: 'volume' }, { label: 'Reps', value: 'reps' }, { label: 'Time', value: 'time' }];

  const seg = segmented(options, metric, (v) => { metric = v; drawChart(); });
  screen.appendChild(seg);
  screen.appendChild(chartHost);

  function drawChart() {
    chartHost.innerHTML = '';
    const points = series.filter((p) => p[metric] > 0).map((p) => ({ x: p.date, y: p[metric] }));
    chartHost.appendChild(lineChart(points, {
      format: (v) => (metric === 'time' ? mmss(v) : String(Math.round(v)))
    }));
    chartHost.appendChild(el('div', { class: 'row between', style: 'margin-top:4px' }, [
      el('div', { class: 'tiny dim', text: shortDate(series[0].date) }),
      el('div', { class: 'tiny dim', text: shortDate(series[series.length - 1].date) })
    ]));
  }
  drawChart();

  screen.appendChild(el('div', { class: 'section-head' }, [el('div', { class: 'eyebrow', text: 'Session by session' })]));

  [...series].reverse().forEach((p) => {
    const card = el('div', { class: 'card', style: 'margin-bottom:10px' });
    card.appendChild(el('div', { class: 'row between' }, [
      el('div', {}, [
        el('div', { class: 'h3', text: shortDate(p.date) }),
        el('div', { class: 'tiny dim', style: 'margin-top:3px', text: prescriptionLabel(p.prescription) })
      ]),
      el('div', { class: 'num small dim', text: p.volume ? `${p.volume} vol` : `${p.sets.length} sets` })
    ]));
    card.appendChild(el('div', { class: 'ls-sets', style: 'margin-top:10px' },
      p.sets.map((s) => el('div', {
        class: 'ls-set',
        style: s.prs && s.prs.length ? 'border-color:var(--accent);color:var(--accent)' : '',
        text: setLabel(s, p.prescription)
      }))));
    screen.appendChild(card);
  });
}

function topLine(point, weighted) {
  if (weighted) return `${num(point.topWeight)}`;
  if (point.time) return mmss(point.time);
  if (point.distance) return `${num(point.distance)}`;
  return String(point.reps);
}

function bestOf(series) {
  let best = { value: 0, label: '—' };
  series.forEach((p) => {
    p.sets.forEach((s) => {
      const w = Number(s.weight) || 0;
      const score = w ? estimated1RM(s) : (Number(s.reps) || Number(s.timeSec) || Number(s.distance) || 0);
      if (score > best.value) {
        best = { value: score, label: setLabel(s, p.prescription) };
      }
    });
  });
  return best;
}
