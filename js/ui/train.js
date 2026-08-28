/* ============================================================================
   TRAIN — the home screen.
   One question: what should I do now?
   ========================================================================== */

import { el, esc, mmss } from '../util.js';
import { WEEKDAYS } from '../config.js';
import {
  getActiveProgram, todaysDay, todaysSession, getActiveSession,
  startSession, getPrograms, getExercise
} from '../store.js';
import { prescriptionLabel } from '../prescription.js';
import { sessionTotals } from '../stats.js';
import { emptyState, sheet, icon, iconButton, toast } from './components.js';

export function renderTrain(root, ctx) {
  root.innerHTML = '';
  const screen = el('div', { class: 'screen' });
  root.appendChild(screen);

  const program = getActiveProgram();
  const programs = getPrograms();

  /* ---------- no programme at all ---------- */
  if (!programs.length) {
    screen.appendChild(brand());
    screen.appendChild(emptyState({
      title: 'No programme',
      message: 'Build your first programme. Create your workout days, add exercises and start training.',
      actionLabel: 'Create programme',
      onAction: () => ctx.go({ tab: 'program', name: 'programList', createNow: true })
    }));
    return;
  }
  if (!program) {
    screen.appendChild(brand());
    screen.appendChild(emptyState({
      title: 'No active programme',
      message: 'Pick which programme you are training right now. Activate one and today\'s workout appears here.',
      actionLabel: 'Choose programme',
      onAction: () => ctx.go({ tab: 'program', name: 'programList' })
    }));
    return;
  }

  /* ---------- an unfinished session takes priority ---------- */
  const live = getActiveSession();
  const today = todaysDay();
  const doneToday = today ? todaysSession(today.id) : null;

  screen.appendChild(brand(program.name));

  if (live) {
    screen.appendChild(heroInProgress(live, ctx));
    screen.appendChild(otherWorkouts(program, ctx, live));
    return;
  }

  if (!today) {
    screen.appendChild(heroRest(ctx));
    screen.appendChild(otherWorkouts(program, ctx, null));
    return;
  }

  if (doneToday && doneToday.status === 'completed') {
    screen.appendChild(heroComplete(doneToday, ctx));
    screen.appendChild(otherWorkouts(program, ctx, null));
    return;
  }

  screen.appendChild(heroReady(program, today, ctx));
  screen.appendChild(otherWorkouts(program, ctx, null, today.id));
}

/* ------------------------------------------------------------- pieces */
function brand(programName) {
  return el('div', { class: 'row between', style: 'padding-top:4px' }, [
    el('div', { class: 'eyebrow', text: 'WORKOUT TRACKER' }),
    programName ? el('div', { class: 'eyebrow', text: programName.toUpperCase() }) : null
  ]);
}

function heroReady(program, day, ctx) {
  const wrap = el('div', {});
  const now = new Date();

  wrap.appendChild(el('div', { class: 'today-hero' }, [
    el('div', { class: 'eyebrow accent day', text: WEEKDAYS[now.getDay()].toUpperCase() }),
    el('h1', { class: 'display', text: day.name }),
    day.subtitle ? el('div', { class: 'sub', text: day.subtitle }) : null
  ]));

  /* Some days are scheduled but carry no lifting — a step target, a walk. */
  if (!day.exercises.length) {
    if (day.notes) {
      wrap.appendChild(el('div', { class: 'metrics' }, [metric(day.notes, 'Target')]));
    } else {
      wrap.appendChild(el('div', { class: 'rule' }));
    }
    return wrap;
  }

  wrap.appendChild(el('div', { class: 'metrics' }, [
    metric(String(day.exercises.length), 'Exercises'),
    metric(`~${day.estMinutes || 60}`, 'Minutes'),
    metric(String(totalSets(day)), 'Sets')
  ]));

  const start = el('button', { class: 'btn btn-primary btn-lg btn-block', type: 'button', text: 'START WORKOUT' });
  start.addEventListener('click', () => {
    const session = startSession(program.id, day.id);
    if (session) ctx.go({ tab: 'train', name: 'workout', sessionId: session.id });
  });
  wrap.appendChild(start);

  wrap.appendChild(el('div', { class: 'section-head' }, [
    el('div', { class: 'eyebrow', text: 'Today\'s work' })
  ]));
  wrap.appendChild(exercisePreview(day));

  if (day.notes) {
    wrap.appendChild(el('div', { class: 'cue', text: day.notes, style: 'margin-top:16px' }));
  }
  return wrap;
}

function heroInProgress(session, ctx) {
  const totals = sessionTotals(session);
  const wrap = el('div', {});

  wrap.appendChild(el('div', { class: 'today-hero' }, [
    el('div', { class: 'eyebrow accent', text: 'IN PROGRESS' }),
    el('h1', { class: 'display', text: session.dayName }),
    el('div', { class: 'sub', text: `${totals.completedExercises} / ${totals.exercises} exercises · ${totals.percent}% complete` })
  ]));

  wrap.appendChild(el('div', { class: 'bar', style: 'margin:8px 0 22px' }, [
    el('i', { style: `width:${totals.percent}%` })
  ]));

  const cont = el('button', { class: 'btn btn-primary btn-lg btn-block', type: 'button', text: 'CONTINUE' });
  cont.addEventListener('click', () => ctx.go({ tab: 'train', name: 'workout', sessionId: session.id }));
  wrap.appendChild(cont);

  wrap.appendChild(el('div', { class: 'metrics' }, [
    metric(String(totals.sets), 'Sets done'),
    metric(String(totals.minutes), 'Minutes'),
    metric(totals.volume ? `${Math.round(totals.volume / 1000)}k` : '0', 'Volume kg')
  ]));

  return wrap;
}

function heroComplete(session, ctx) {
  const totals = sessionTotals(session);
  const wrap = el('div', {});

  wrap.appendChild(el('div', { class: 'today-hero' }, [
    el('div', { class: 'complete-mark' }, [icon('check', 30)]),
    el('div', { class: 'eyebrow accent', text: 'WORKOUT COMPLETE', style: 'margin-top:20px' }),
    el('h1', { class: 'display', text: session.dayName })
  ]));

  wrap.appendChild(el('div', { class: 'metrics' }, [
    metric(`${totals.completedExercises}/${totals.exercises}`, 'Exercises'),
    metric(String(totals.sets), 'Sets'),
    metric(String(totals.minutes), 'Minutes')
  ]));

  const view = el('button', { class: 'btn btn-lg btn-block btn-outline', type: 'button', text: 'VIEW SUMMARY' });
  view.addEventListener('click', () => ctx.go({ tab: 'history', name: 'sessionDetail', sessionId: session.id }));
  wrap.appendChild(view);

  if (totals.prs.length) {
    wrap.appendChild(el('div', { class: 'section-head' }, [el('div', { class: 'eyebrow accent', text: 'Personal records' })]));
    totals.prs.forEach((pr) => {
      wrap.appendChild(el('div', { class: 'kv' }, [
        el('div', { class: 'k', text: pr.exercise }),
        el('div', { class: 'v accent-text', text: pr.labels.join(' · ') })
      ]));
    });
  }
  return wrap;
}

function heroRest(ctx) {
  const now = new Date();
  const wrap = el('div', {});
  wrap.appendChild(el('div', { class: 'today-hero' }, [
    el('div', { class: 'eyebrow day accent', text: WEEKDAYS[now.getDay()].toUpperCase() }),
    el('h1', { class: 'display', text: 'Rest day' }),
    el('div', { class: 'sub', text: 'Nothing scheduled. Recovery is part of the programme.' })
  ]));

  const next = nextScheduled();
  if (next) {
    wrap.appendChild(el('div', { class: 'metrics' }, [
      metric(next.inDays === 1 ? 'TOMORROW' : WEEKDAYS[next.day.dayOfWeek].toUpperCase(), 'Next session'),
      metric(String(next.day.exercises.length), 'Exercises')
    ]));
    wrap.appendChild(el('div', { class: 'h1', text: next.day.name }));
    if (next.day.subtitle) wrap.appendChild(el('div', { class: 'sub muted', style: 'margin-top:6px', text: next.day.subtitle }));
    wrap.appendChild(el('div', { class: 'section-head' }, [el('div', { class: 'eyebrow', text: 'What is coming' })]));
    wrap.appendChild(exercisePreview(next.day));
  }
  return wrap;
}

/** The next enabled day in the active programme, searching forward a week. */
function nextScheduled() {
  const program = getActiveProgram();
  if (!program) return null;
  const today = new Date().getDay();
  for (let i = 1; i <= 7; i += 1) {
    const dow = (today + i) % 7;
    const day = program.days.find((d) => d.enabled !== false && d.dayOfWeek === dow);
    if (day) return { day, inDays: i };
  }
  return null;
}

function metric(value, key) {
  return el('div', { class: 'metric' }, [
    el('div', { class: 'v num', text: value }),
    el('div', { class: 'k', text: key })
  ]);
}

function totalSets(day) {
  return day.exercises.reduce((n, rx) => n + (rx.sets.max || rx.sets.min || 1), 0);
}

function exercisePreview(day) {
  const list = el('div', {});
  day.exercises.forEach((rx, i) => {
    const ex = getExercise(rx.exerciseId);
    list.appendChild(el('div', { class: 'preview-item' }, [
      el('div', { class: 'idx num', text: String(i + 1).padStart(2, '0') }),
      el('div', { class: 'nm', text: rx.displayName || ex.name }),
      el('div', { class: 'rx', text: prescriptionLabel(rx) })
    ]));
  });
  return list;
}

/** "Train something else" — any day from any programme, without leaving Train. */
function otherWorkouts(program, ctx, liveSession, excludeDayId) {
  const wrap = el('div', { style: 'margin-top:28px' });
  wrap.appendChild(el('div', { class: 'section-head' }, [
    el('div', { class: 'eyebrow', text: 'Train something else' })
  ]));

  const btn = el('button', { class: 'btn btn-block btn-outline', type: 'button', text: 'CHOOSE A WORKOUT' });
  btn.addEventListener('click', () => pickWorkout(ctx, liveSession));
  wrap.appendChild(btn);
  return wrap;
}

function pickWorkout(ctx, liveSession) {
  const body = el('div', {});
  const programs = getPrograms().filter((p) => p.status !== 'archived');

  if (!programs.length) {
    body.appendChild(el('p', { class: 'muted small', text: 'No programmes available.' }));
  }

  programs.forEach((p) => {
    body.appendChild(el('div', { class: 'eyebrow', style: 'margin:18px 0 8px', text: p.name.toUpperCase() }));
    const card = el('div', { class: 'card flush' });
    if (!p.days.length) {
      card.appendChild(el('div', { class: 'list-item' }, [el('div', { class: 'muted small', text: 'No days yet.' })]));
    }
    p.days.forEach((d) => {
      const item = el('button', { class: 'list-item', type: 'button' }, [
        el('div', { class: 'grow' }, [
          el('div', { class: 'h3', text: d.name }),
          el('div', { class: 'tiny dim', text: `${d.exercises.length} exercises · ${d.dayOfWeek === null || d.dayOfWeek === undefined ? 'unscheduled' : WEEKDAYS[d.dayOfWeek]}` })
        ]),
        el('span', { class: 'chev', text: '›' })
      ]);
      item.addEventListener('click', () => {
        if (liveSession) {
          toast('Finish or discard the workout in progress first.', 'warn');
          return;
        }
        const s = startSession(p.id, d.id);
        sheetRef.close();
        if (s) ctx.go({ tab: 'train', name: 'workout', sessionId: s.id });
      });
      card.appendChild(item);
    });
    body.appendChild(card);
  });

  const sheetRef = sheet({ title: 'Choose a workout', body, tall: true });
}
