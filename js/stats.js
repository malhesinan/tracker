/* ============================================================================
   STATS — derived numbers only. Nothing here is stored.
   ========================================================================== */

import { setVolume, estimated1RM } from './prescription.js';
import { completedSessions, exerciseHistory } from './store.js';
import { DAY_MS, startOfDay } from './util.js';

export function sessionTotals(session) {
  let sets = 0;
  let volume = 0;
  let reps = 0;
  let exercises = 0;
  let completedExercises = 0;
  const prs = [];

  for (const log of session.logs || []) {
    exercises += 1;
    let any = false;
    for (const set of log.sets || []) {
      if (!set.done) continue;
      any = true;
      sets += 1;
      volume += setVolume(set);
      reps += Number(set.reps) || 0;
      if (set.prs && set.prs.length) {
        prs.push({ exercise: log.name, labels: set.prs, set });
      }
    }
    if (any) completedExercises += 1;
  }

  const end = session.endedAt || Date.now();
  const minutes = Math.max(0, Math.round((end - session.startedAt) / 60000));

  return {
    sets, volume: Math.round(volume), reps,
    exercises, completedExercises, minutes, prs,
    percent: exercises ? Math.round((completedExercises / exercises) * 100) : 0
  };
}

/** Volume change versus the previous session of the same workout day. */
export function volumeDelta(session) {
  const previous = completedSessions()
    .filter((s) => s.dayId === session.dayId && s.id !== session.id && s.startedAt < session.startedAt)
    .sort((a, b) => b.startedAt - a.startedAt)[0];
  if (!previous) return null;

  const now = sessionTotals(session).volume;
  const before = sessionTotals(previous).volume;
  if (!before) return null;
  return { percent: Math.round(((now - before) / before) * 1000) / 10, previousDate: previous.startedAt };
}

/** Per-session series for one exercise, oldest first. */
export function exerciseSeries(exerciseId) {
  const history = exerciseHistory(exerciseId).slice().reverse();
  return history.map((h) => {
    let topWeight = 0, topE1rm = 0, volume = 0, totalReps = 0, bestTime = 0, bestDistance = 0;
    h.sets.forEach((s) => {
      topWeight = Math.max(topWeight, Number(s.weight) || 0);
      topE1rm = Math.max(topE1rm, estimated1RM(s));
      volume += setVolume(s);
      totalReps += Number(s.reps) || 0;
      bestTime = Math.max(bestTime, Number(s.timeSec) || 0);
      bestDistance = Math.max(bestDistance, Number(s.distance) || 0);
    });
    return {
      date: h.date,
      sessionId: h.sessionId,
      sets: h.sets,
      prescription: h.prescription,
      topWeight,
      e1rm: Math.round(topE1rm * 10) / 10,
      volume: Math.round(volume),
      reps: totalReps,
      time: bestTime,
      distance: bestDistance
    };
  });
}

/** '↗' | '→' | '↘' based on the last three points of a series key. */
export function trend(series, key = 'e1rm') {
  const points = series.map((p) => p[key]).filter((v) => v > 0);
  if (points.length < 2) return { arrow: '→', direction: 'flat', delta: 0 };
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const delta = Math.round(((last - prev) / prev) * 1000) / 10;
  if (delta > 0.5) return { arrow: '↗', direction: 'up', delta };
  if (delta < -0.5) return { arrow: '↘', direction: 'down', delta };
  return { arrow: '→', direction: 'flat', delta };
}

/** Sessions per week for the last n weeks, oldest first. */
export function consistency(weeks = 8) {
  const sessions = completedSessions();
  const today = startOfDay(Date.now()).getTime();
  const out = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const end = today - i * 7 * DAY_MS + DAY_MS;
    const start = end - 7 * DAY_MS;
    const count = sessions.filter((s) => s.startedAt >= start && s.startedAt < end).length;
    out.push({ weekEnding: end, count });
  }
  return out;
}

export function summaryStats() {
  const sessions = completedSessions();
  const totalSets = sessions.reduce((n, s) => n + sessionTotals(s).sets, 0);
  const totalVolume = sessions.reduce((n, s) => n + sessionTotals(s).volume, 0);
  const totalMinutes = sessions.reduce((n, s) => n + sessionTotals(s).minutes, 0);
  const last30 = sessions.filter((s) => s.startedAt > Date.now() - 30 * DAY_MS).length;
  return { count: sessions.length, totalSets, totalVolume, totalMinutes, last30 };
}

/** Every exercise that appears in history, with a quick summary. */
export function trainedExercises() {
  const map = new Map();
  for (const s of completedSessions()) {
    for (const log of s.logs || []) {
      const done = (log.sets || []).filter((x) => x.done);
      if (!done.length) continue;
      if (!map.has(log.exerciseId)) {
        map.set(log.exerciseId, { exerciseId: log.exerciseId, name: log.name, sessions: 0, lastDate: 0, category: log.category });
      }
      const entry = map.get(log.exerciseId);
      entry.sessions += 1;
      entry.lastDate = Math.max(entry.lastDate, s.startedAt);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.lastDate - a.lastDate);
}
